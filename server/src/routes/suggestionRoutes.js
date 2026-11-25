
import { Router } from "express";
import { z } from "zod";

import ClothingItem from "../models/ClothingItem.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { suggestOutfits } from "../utils/outfitMatcher.js";
import { generateStyleLooks, replaceStylePiece } from "../utils/styleGenerator.js";

const router = Router();

router.use(requireAuth);

const preferenceSchema = z.object({
  occasion: z.string().trim().max(60).optional(),
  season: z.string().trim().max(40).optional(),
  style: z.string().trim().max(40).optional()
}).strict();


const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const personalPrefs = z.object({
  occasion: z.string().trim().max(60).default(''),
  season: z.string().trim().max(40).default(''),
  style: z.string().trim().max(40).default(''),
  weather: z.enum(['mild','hot','warm','cold','chilly']).default('mild')
}).strict();
const generateSchema = z.object({
  preferences: personalPrefs,
  lockedItemIds: z.array(objectId).max(8).default([]),
  excludeSignatures: z.array(z.string().max(600)).max(60).default([]),
  limit: z.number().int().min(1).max(5).default(3)
}).strict();
const replaceSchema = z.object({
  preferences: personalPrefs,
  clothingItemIds: z.array(objectId).min(2).max(10),
  category: z.enum(['top','bottom','dress','outerwear','shoes','bag','accessory']),
  lockedItemIds: z.array(objectId).max(8).default([])
}).strict();
router.post('/generate', async (req,res) => {
  const input=generateSchema.safeParse(req.body);
  if(!input.success) return res.status(400).json({error:'Invalid styling preferences'});
  const clothes=await ClothingItem.find({ownerId:req.userId}).limit(200).lean();
  const owned=new Set(clothes.map(i=>String(i._id)));
  if(input.data.lockedItemIds.some(id=>!owned.has(id))) return res.status(400).json({error:'Locked clothing must belong to you'});
  const {looks,error,available}=generateStyleLooks(clothes,input.data.preferences,input.data.lockedItemIds,input.data.excludeSignatures,input.data.limit);
  res.json({looks,error,available:available||0,clothingCount:clothes.length});
});
router.post('/replace', async (req,res) => {
  const input=replaceSchema.safeParse(req.body);
  if(!input.success) return res.status(400).json({error:'Invalid replacement request'});
  const clothes=await ClothingItem.find({ownerId:req.userId}).limit(200).lean();
  const owned=new Set(clothes.map(i=>String(i._id)));
  if([...input.data.clothingItemIds,...input.data.lockedItemIds].some(id=>!owned.has(id))) return res.status(400).json({error:'Invalid clothing selection'});
  const {look,error}=replaceStylePiece(clothes,input.data.clothingItemIds,input.data.category,input.data.lockedItemIds,input.data.preferences);
  if(error) return res.status(400).json({error});
  res.json({look});
});

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
