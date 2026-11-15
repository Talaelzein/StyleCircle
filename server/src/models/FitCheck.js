
import mongoose from "mongoose";

const clothingPreviewSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    color: {
      type: String,
      default: ""
    }
  },
  { _id: false }
);

const lookSchema = new mongoose.Schema(
  {
    outfitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Outfit",
      required: true
    },

    name: {
      type: String,
      required: true
    },

    pieces: {
      type: [clothingPreviewSchema],
      default: []
    }
  },
  { _id: false }
);

const fitCheckSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    question: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 160
    },

    looks: {
      type: [lookSchema],
      required: true,
      validate: {
        validator(looks) {
          return looks.length === 2;
        },
        message: "A FitCheck must contain exactly two outfits"
      }
    },

    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open"
    }
  },
  { timestamps: true }
);

fitCheckSchema.index({ createdAt: -1 });

export default mongoose.model(
  "FitCheck",
  fitCheckSchema
);
