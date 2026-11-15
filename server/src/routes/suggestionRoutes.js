
import { Router } from "express";
import { z } from "zod";

import ClothingItem from "../models/ClothingItem.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { suggestOutfits } from "../utils/outfitMatcher.js";

const router = Router();

router.use(requireAuth);

const preferenceSchema = z.object({
  occasion: z.string().trim().max(60).optional(),
  season: z.string().trim().max(40).optional(),
  style: z.string().trim().max(40).optional()
}).strict();

// GET /api/suggestions
router.get("/", async (req, res) => {
  const result = preferenceSchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      error: "Invalid suggestion preferences"
    });
  }

  // Retrieve only the logged-in user's clothing.
  const clothes = await ClothingItem.find({
    ownerId: req.userId
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  // Generate recommendations.
  const suggestions = suggestOutfits(
    clothes,
    result.data
  );

  return res.json({
    suggestions,
    clothingCount: clothes.length
  });
});

export default router;
