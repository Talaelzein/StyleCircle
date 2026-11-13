import mongoose from 'mongoose';

export const CATEGORIES = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'accessory'];

const clothingItemSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: CATEGORIES },
    color: { type: String, trim: true, default: '' },
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null },
  },
  { timestamps: true }
);

clothingItemSchema.index({ ownerId: 1, createdAt: -1 });

export default mongoose.model('ClothingItem', clothingItemSchema);
