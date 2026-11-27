import mongoose from "mongoose";
import FitCheck from "../models/FitCheck.js";

// Never erase a GridFS image that is still part of a shared FitCheck snapshot.
// A removed wardrobe item must not destroy previously shared community photos.
export async function removeOldImageIfUnused(bucket, imageId, ownerId) {
  if (!mongoose.isValidObjectId(imageId)) return false;

  const usedInPoll = await FitCheck.exists({
    ownerId,
    "looks.pieces.imagePublicId": String(imageId)
  });

  if (usedInPoll) return false;

  await bucket.delete(new mongoose.Types.ObjectId(imageId));
  return true;
}
