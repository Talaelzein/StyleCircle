
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import ClothingItem, {
  CATEGORIES
} from "../models/ClothingItem.js";

import { validateBody } from "../middleware/validate.js";
import { requireAuth } from "../middleware/requireAuth.js";
import Outfit from "../models/Outfit.js";
import { removeOldImageIfUnused } from "../utils/imageRetention.js";

const router = Router();

// All wardrobe routes require a logged-in user.
router.use(requireAuth);

// Validation for creating a clothing item.
const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(CATEGORIES),
  color: z.string().trim().max(40).optional(),
  material: z.string().trim().max(50).optional(),
  style: z.string().trim().max(50).optional(),
  occasion: z.string().trim().max(50).optional(),
  season: z.string().trim().max(50).optional(),

  brand: z.string().trim().max(80).optional(),
  size: z.string().trim().max(40).optional(),
  price: z.number().min(0).max(100000000).optional(),
  purchaseDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  favorite: z.boolean().optional(),
  sourceUrl: z.union([z.literal(""), z.string().url().max(1200).refine(v=>v.startsWith("https://"))]).optional(),
  // Direct HTTPS image URL support for product photos.
  imageUrl: z.union([z.literal(""), z.url().max(1200)
    .refine(
      (url) => url.startsWith("https://"),
      "Use an HTTPS image URL"
    )])
    .optional()
}).strict();

// Editing allows any valid combination of existing fields.
const updateSchema = createSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "Provide at least one field" }
  );

// Reject invalid MongoDB IDs.
function validId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      error: "Invalid item ID"
    });
  }

  next();
}

// Treat search input as plain text, not a regular expression.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/clothing-items
// Return only clothing belonging to the logged-in user.
router.get("/", async (req, res) => {
  const filter = {
    ownerId: req.userId
  };

  // Optional category filter.
  if (req.query.category !== undefined) {
    if (
      typeof req.query.category !== "string" ||
      !CATEGORIES.includes(req.query.category)
    ) {
      return res.status(400).json({
        error: "Invalid category filter"
      });
    }

    filter.category = req.query.category;
  }

  // Optional name search.
  if (req.query.search !== undefined) {
    if (
      typeof req.query.search !== "string" ||
      req.query.search.length > 80
    ) {
      return res.status(400).json({
        error: "Invalid search filter"
      });
    }

    const search = req.query.search.trim();

    if (search) {
      filter.name = {
        $regex: escapeRegex(search),
        $options: "i"
      };
    }
  }

  const items = await ClothingItem
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(100);

  return res.json({ items });
});

// POST /api/clothing-items
// Create a new clothing item for the logged-in user.
router.post(
  "/",
  validateBody(createSchema),
  async (req, res) => {
    const item = await ClothingItem.create({
      ...req.validatedBody,
      ownerId: req.userId
    });

    return res.status(201).json({ item });
  }
);

// GET /api/clothing-items/:id
router.get("/:id", validId, async (req, res) => {
  const item = await ClothingItem.findOne({
    _id: req.params.id,
    ownerId: req.userId
  });

  if (!item) {
    return res.status(404).json({
      error: "Item not found"
    });
  }

  return res.json({ item });
});

// PATCH /api/clothing-items/:id
// Update only clothing belonging to the logged-in user.
router.patch(
  "/:id",
  validId,
  validateBody(updateSchema),
  async (req, res) => {
    const item = await ClothingItem.findOneAndUpdate(
      {
        _id: req.params.id,
        ownerId: req.userId
      },
      {
        $set: req.validatedBody
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!item) {
      return res.status(404).json({
        error: "Item not found"
      });
    }

    return res.json({ item });
  }
);

// DELETE /api/clothing-items/:id
// Delete only clothing belonging to the logged-in user.

router.delete("/:id", validId, async (req, res) => {
  // Check ownership before inspecting references (no cross-account disclosure).
  const ownedItem = await ClothingItem.findOne({
    _id: req.params.id,
    ownerId: req.userId
  });

  if (!ownedItem) {
    return res.status(404).json({ error: "Item not found" });
  }

  // Keep saved outfits complete: clients must remove the item from
  // their outfits before deleting the underlying wardrobe record.
  const usedInOutfit = await Outfit.exists({
    ownerId: req.userId,
    clothingItemIds: ownedItem._id
  });

  if (usedInOutfit) {
    return res.status(409).json({
      error: "This item is used in a saved outfit. Remove it from your saved outfits before deleting it."
    });
  }

  const item = await ClothingItem.findOneAndDelete({
    _id: ownedItem._id,
    ownerId: req.userId
  });

  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  // FitCheck stores photo snapshots, which may outlive their outfits.
  // Keep photo files when those shared snapshots still reference them.
  if (item.imagePublicId && mongoose.isValidObjectId(item.imagePublicId)) {
    try {
      const bucket = new mongoose.mongo.GridFSBucket(
        mongoose.connection.db,
        { bucketName: "clothingImages" }
      );
      await removeOldImageIfUnused(bucket, item.imagePublicId, req.userId);
    } catch (error) {
      console.error("Could not clean up clothing photo:", error.message);
    }
  }

  return res.status(204).end();
});

export default router;
