import mongoose from "mongoose";

export const CATEGORIES = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "bag",
  "accessory"
];

const clothingItemSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      required: true,
      enum: CATEGORIES
    },

    color: {
      type: String,
      trim: true,
      default: ""
    },

    // NEW FIELDS FOR MIX & MATCH
    material: {
      type: String,
      trim: true,
      default: ""
    },

    style: {
      type: String,
      trim: true,
      default: ""
    },

    occasion: {
      type: String,
      trim: true,
      default: ""
    },

    season: {
      type: String,
      trim: true,
      default: ""
    },

    // IMAGE FIELDS FOR FUTURE PHOTO UPLOAD
    imageUrl: {
      type: String,
      default: null
    },

    imagePublicId: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

clothingItemSchema.index({
  ownerId: 1,
  createdAt: -1
});

export default mongoose.model(
  "ClothingItem",
  clothingItemSchema
);
