import mongoose from 'mongoose';

const styleEntrySchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['plan','wear','packing','wishlist','moodboard'], required: true, index: true },
  title: { type: String, trim: true, required: true, maxlength: 120 },
  date: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '', maxlength: 600 },
  url: { type: String, trim: true, default: '', maxlength: 1200 },
  imageUrl: { type: String, trim: true, default: '', maxlength: 1200 },
  price: { type: Number, min: 0, default: 0 },
  itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClothingItem' }],
  checkedIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClothingItem' }],
  outfitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outfit', default: null },
  completed: { type: Boolean, default: false }
}, { timestamps: true });
styleEntrySchema.index({ ownerId: 1, kind: 1, date: 1 });
export default mongoose.model('StyleEntry', styleEntrySchema);
