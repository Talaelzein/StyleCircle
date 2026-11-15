
import mongoose from "mongoose";

const fitCheckVoteSchema = new mongoose.Schema(
  {
    fitCheckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FitCheck",
      required: true,
      index: true
    },

    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    choice: {
      type: String,
      enum: ["A", "B"],
      required: true
    }
  },
  { timestamps: true }
);

// Each user can have only one vote per FitCheck.
// They can change their choice later.
fitCheckVoteSchema.index(
  {
    fitCheckId: 1,
    voterId: 1
  },
  {
    unique: true
  }
);

export default mongoose.model(
  "FitCheckVote",
  fitCheckVoteSchema
);
