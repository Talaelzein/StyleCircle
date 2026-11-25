import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import StyleEntry from '../models/StyleEntry.js';
import ClothingItem from '../models/ClothingItem.js';
import Outfit from '../models/Outfit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);
const kinds = ['plan','wear','packing','wishlist','moodboard'];
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const httpsUrl = z.union([z.literal(''), z.string().url().max(1200).refine(value => value.startsWith('https://'), 'Use HTTPS links')]);
const fields = z.object({
  kind: z.enum(kinds),
  title: z.string().trim().min(1).max(120),
  date: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  notes: z.string().trim().max(600).optional(),
  url: httpsUrl.optional(), imageUrl: httpsUrl.optional(),
  price: z.number().min(0).max(100000000).optional(),
  itemIds: z.array(objectId).max(100).optional(),
  checkedIds: z.array(objectId).max(100).optional(),
  outfitId: z.union([objectId, z.null()]).optional(),
  completed: z.boolean().optional()
}).strict();
const update = fields.partial().omit({ kind: true }).refine(v => Object.keys(v).length > 0);

async function checkReferences(data, ownerId) {
  const ids = [...new Set([...(data.itemIds || []), ...(data.checkedIds || [])])];
  if (ids.length) {
    const count = await ClothingItem.countDocuments({ _id: { $in: ids }, ownerId });
    if (count !== ids.length) return 'At least one clothing item is unavailable';
  }
  if (data.checkedIds && data.itemIds && data.checkedIds.some(id => !data.itemIds.includes(id))) {
    return 'Packed items must belong to this packing list';
  }
  if (data.outfitId && !await Outfit.exists({ _id: data.outfitId, ownerId })) {
    return 'Outfit not found in your account';
  }
  return null;
}
router.get('/', async (req,res) => {
  if (!kinds.includes(req.query.kind)) return res.status(400).json({error:'Choose a valid collection type'});
  const entries = await StyleEntry.find({ ownerId:req.userId, kind:req.query.kind })
    .sort({ date: -1, createdAt: -1 }).limit(250).lean();
  res.json({ entries });
});
router.post('/', validateBody(fields), async (req,res) => {
  const error = await checkReferences(req.validatedBody, req.userId);
  if (error) return res.status(400).json({ error });
  const entry = await StyleEntry.create({ ...req.validatedBody, ownerId:req.userId });
  res.status(201).json({entry});
});
router.patch('/:id', validateBody(update), async (req,res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({error:'Invalid entry ID'});
  const existing = await StyleEntry.findOne({_id:req.params.id, ownerId:req.userId});
  if(!existing) return res.status(404).json({error:'Entry not found'});
  const incoming = req.validatedBody;
  const merged = { itemIds: incoming.itemIds || existing.itemIds.map(String), checkedIds: incoming.checkedIds || existing.checkedIds.map(String), outfitId: incoming.outfitId === undefined ? existing.outfitId : incoming.outfitId };
  const error = await checkReferences(merged, req.userId);
  if (error) return res.status(400).json({error});
  Object.assign(existing, incoming);
  await existing.save();
  res.json({ entry: existing });
});
router.delete('/:id', async (req,res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({error:'Invalid entry ID'});
  const entry = await StyleEntry.findOneAndDelete({_id:req.params.id,ownerId:req.userId});
  if(!entry) return res.status(404).json({error:'Entry not found'});
  res.status(204).end();
});
export default router;
