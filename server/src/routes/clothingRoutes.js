import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import ClothingItem, { CATEGORIES } from '../models/ClothingItem.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth); // Every clothing endpoint is private.

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(CATEGORIES),
  color: z.string().trim().max(40).optional(),
  imageUrl: z.url().max(500).refine((url) => url.startsWith('https://'), 'Use an HTTPS image URL').optional(),
}).strict(); // Unknown fields like ownerId are REJECTED.

const updateSchema = createSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Provide at least one field' }
);

function validId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }
  next();
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/', async (req, res) => {
  const filter = { ownerId: req.userId };
  if (req.query.category !== undefined) {
    if (typeof req.query.category !== 'string' || !CATEGORIES.includes(req.query.category)) {
      return res.status(400).json({ error: 'Invalid category filter' });
    }
    filter.category = req.query.category;
  }
  if (req.query.search !== undefined) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 80) {
      return res.status(400).json({ error: 'Invalid search filter' });
    }
    filter.name = { $regex: escapeRegex(req.query.search), $options: 'i' };
  }

  const items = await ClothingItem.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json({ items });
});

router.post('/', validateBody(createSchema), async (req, res) => {
  const item = await ClothingItem.create({ ...req.validatedBody, ownerId: req.userId });
  res.status(201).json({ item });
});

router.get('/:id', validId, async (req, res) => {
  const item = await ClothingItem.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ item });
});

router.patch('/:id', validId, validateBody(updateSchema), async (req, res) => {
  const item = await ClothingItem.findOneAndUpdate(
    { _id: req.params.id, ownerId: req.userId },
    { $set: req.validatedBody },
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ item });
});

router.delete('/:id', validId, async (req, res) => {
  const item = await ClothingItem.findOneAndDelete({ _id: req.params.id, ownerId: req.userId });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.status(204).end();
});

export default router;
