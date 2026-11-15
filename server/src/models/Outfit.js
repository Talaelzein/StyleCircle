
import mongoose from "mongoose";

const outfitSchema = new mongoose.Schema(
  {
    // The user who owns this outfit
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // Name of the outfit
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },

    // Clothing items selected from My Closet
    clothingItemIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ClothingItem"
        }
      ],
      required: true,
      validate: {
        validator(items) {
          if (items.length < 2 || items.length > 10) {
            return false;
          }

          // Prevent the same clothing item being added twice
          const uniqueIds = new Set(
            items.map((id) => String(id))
          );

          return uniqueIds.size === items.length;
        },
        message: "An outfit must contain 2 to 10 different clothing items"
      }
    },

    // Optional information
    occasion: {
      type: String,
      trim: true,
      maxlength: 60,
      default: ""
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

// Show the user's newest outfits first
outfitSchema.index({
  ownerId: 1,
  createdAt: -1
});

export default mongoose.model("Outfit", outfitSchema);

