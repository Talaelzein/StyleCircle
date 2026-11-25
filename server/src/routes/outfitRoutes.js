
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import Outfit from "../models/Outfit.js";
import ClothingItem from "../models/ClothingItem.js";

import { requireAuth } from "../middleware/requireAuth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();

// Every outfit endpoint requires login.
router.use(requireAuth);

// Validate MongoDB ObjectIds.
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid clothing item ID");

// An outfit must contain 2 to 10 different clothes.
const clothingIdsSchema = z
  .array(objectIdSchema)
  .min(2, "Choose at least 2 clothing items")
  .max(10, "Choose no more than 10 clothing items")
  .refine(
    (ids) =>
      new Set(ids.map((id) => id.toLowerCase())).size ===
      ids.length,
    "You cannot select the same clothing item twice"
  );

// Validation for creating an outfit.
const createSchema = z
  .object({
    name: z.string().trim().min(1).max(80),

    clothingItemIds: clothingIdsSchema,

    occasion: z.string().trim().max(60).optional(),

    notes: z.string().trim().max(300).optional()
  })
  .strict();

// Validation for editing an outfit.
const updateSchema = createSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one field to update"
  );

// Check if an outfit ID is valid.
function validOutfitId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      error: "Invalid outfit ID"
    });
  }

  next();
}

// Verify that all selected clothes belong to the user.
async function ownsAllClothingItems(ids, ownerId) {
  const count = await ClothingItem.countDocuments({
    _id: { $in: ids },
    ownerId
  });

  return count === ids.length;
}

// Populate outfit clothing details safely.
function populateClothing(query, ownerId) {
  return query.populate({
    path: "clothingItemIds",
    match: { ownerId },
    select:
      "name category color material style occasion season brand size price favorite imageUrl imagePublicId"
  });
}

// GET /api/outfits
// List all outfits belonging to the logged-in user.
router.get("/", async (req, res) => {
  const outfits = await populateClothing(
    Outfit.find({
      ownerId: req.userId
    })
      .sort({ createdAt: -1 })
      .limit(100),
    req.userId
  );

  res.json({ outfits });
});

// POST /api/outfits
// Create a new outfit.
router.post(
  "/",
  validateBody(createSchema),
  async (req, res) => {
    const data = req.validatedBody;

    const validClothing = await ownsAllClothingItems(
      data.clothingItemIds,
      req.userId
    );

    if (!validClothing) {
      return res.status(400).json({
        error:
          "Some clothing items do not exist or do not belong to you"
      });
    }

    const outfit = await Outfit.create({
      ...data,
      ownerId: req.userId
    });

    await outfit.populate({
      path: "clothingItemIds",
      match: { ownerId: req.userId },
      select:
        "name category color material style occasion season brand size price favorite imageUrl imagePublicId"
    });

    res.status(201).json({
      outfit,
      message: "Outfit created successfully"
    });
  }
);

// GET /api/outfits/:id
// View one saved outfit.
router.get("/:id", validOutfitId, async (req, res) => {
  const outfit = await populateClothing(
    Outfit.findOne({
      _id: req.params.id,
      ownerId: req.userId
    }),
    req.userId
  );

  if (!outfit) {
    return res.status(404).json({
      error: "Outfit not found"
    });
  }

  res.json({ outfit });
});

// PATCH /api/outfits/:id
// Edit an existing outfit.
router.patch(
  "/:id",
  validOutfitId,
  validateBody(updateSchema),
  async (req, res) => {
    const data = req.validatedBody;

    // If clothes are changed, verify their ownership.
    if (data.clothingItemIds) {
      const validClothing = await ownsAllClothingItems(
        data.clothingItemIds,
        req.userId
      );

      if (!validClothing) {
        return res.status(400).json({
          error:
            "Some clothing items do not exist or do not belong to you"
        });
      }
    }

    const outfit = await Outfit.findOneAndUpdate(
      {
        _id: req.params.id,
        ownerId: req.userId
      },
      {
        $set: data
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!outfit) {
      return res.status(404).json({
        error: "Outfit not found"
      });
    }

    await outfit.populate({
      path: "clothingItemIds",
      match: { ownerId: req.userId },
      select:
        "name category color material style occasion season brand size price favorite imageUrl imagePublicId"
    });

    res.json({
      outfit,
      message: "Outfit updated successfully"
    });
  }
);

// DELETE /api/outfits/:id
// Delete one of the user's saved outfits.
router.delete(
  "/:id",
  validOutfitId,
  async (req, res) => {
    const outfit = await Outfit.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.userId
    });

    if (!outfit) {
      return res.status(404).json({
        error: "Outfit not found"
      });
    }

    res.status(204).end();
  }
);

export default router;
