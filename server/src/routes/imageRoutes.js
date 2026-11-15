
import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import ClothingItem from "../models/ClothingItem.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB per clothing photo.

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
    fields: 0,
    parts: 1
  },
  fileFilter(req, file, callback) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        file.mimetype
      )
    ) {
      return callback(
        new Error("Only JPG, PNG, and WebP images are allowed")
      );
    }

    callback(null, true);
  }
});

function imageType(buffer) {
  if (!buffer) return null;

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function bucketOrNull() {
  if (
    mongoose.connection.readyState !== 1 ||
    !mongoose.connection.db
  ) {
    return null;
  }

  return new mongoose.mongo.GridFSBucket(
    mongoose.connection.db,
    { bucketName: "clothingImages" }
  );
}

function validateClothingId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.itemId)) {
    return res.status(400).json({
      error: "Invalid clothing item ID"
    });
  }

  next();
}

function receiveImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "Image must be 2 MB or smaller"
      });
    }

    return res.status(400).json({
      error: error.message || "Invalid image upload"
    });
  });
}

// POST /api/images/clothing/:itemId
// Upload a clothing photo using multipart/form-data.

router.post(
  "/clothing/:itemId",
  validateClothingId,

  async (req, res, next) => {
    const item = await ClothingItem.findOne({
      _id: req.params.itemId,
      ownerId: req.userId
    });

    if (!item) {
      return res.status(404).json({
        error: "Clothing item not found"
      });
    }

    req.clothingItem = item;
    next();
  },

  receiveImage,

  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: "Choose a clothing photo"
      });
    }

    const contentType = imageType(req.file.buffer);

    if (!contentType || contentType !== req.file.mimetype) {
      return res.status(400).json({
        error: "Image content does not match its file type"
      });
    }

    const bucket = bucketOrNull();

    if (!bucket) {
      return res.status(503).json({
        error: "Database is unavailable"
      });
    }

    const item = req.clothingItem;
    const previousId = item.imagePublicId;

    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }[contentType];

    const stream = bucket.openUploadStream(
      `${item._id}.${extension}`,
      {
        contentType,
        metadata: {
          ownerId: String(req.userId),
          clothingId: String(item._id)
        }
      }
    );

    try {
      await pipeline(
        Readable.from([req.file.buffer]),
        stream
      );

      const updatedItem =
        await ClothingItem.findOneAndUpdate(
          {
            _id: item._id,
            ownerId: req.userId
          },
          {
            $set: {
              imagePublicId: String(stream.id),
              imageUrl: null
            }
          },
          { new: true }
        );

      if (!updatedItem) {
        await bucket.delete(stream.id);

        return res.status(404).json({
          error: "Clothing item no longer exists"
        });
      }

      if (
        previousId &&
        mongoose.isValidObjectId(previousId)
      ) {
        try {
          await bucket.delete(
            new mongoose.Types.ObjectId(previousId)
          );
        } catch (error) {
          console.warn(
            "Could not remove old clothing photo:",
            error.message
          );
        }
      }

      return res.json({
        item: updatedItem,
        message: "Clothing photo uploaded"
      });
    } catch (error) {
      try {
        await bucket.delete(stream.id);
      } catch {
        // Upload may have failed before saving.
      }

      throw error;
    }
  }
);

// GET /api/images/clothing/:itemId
// Return a clothing photo to its authenticated owner.

router.get(
  "/clothing/:itemId",
  validateClothingId,
  async (req, res) => {
    const item = await ClothingItem.findOne({
      _id: req.params.itemId,
      ownerId: req.userId
    });

    if (
      !item ||
      !item.imagePublicId ||
      !mongoose.isValidObjectId(item.imagePublicId)
    ) {
      return res.status(404).json({
        error: "Clothing photo not found"
      });
    }

    const bucket = bucketOrNull();

    if (!bucket) {
      return res.status(503).json({
        error: "Database is unavailable"
      });
    }

    const fileId = new mongoose.Types.ObjectId(
      item.imagePublicId
    );

    const file = await bucket.find({
      _id: fileId
    }).next();

    if (!file) {
      return res.status(404).json({
        error: "Clothing photo not found"
      });
    }

    res.set(
      "Content-Type",
      file.contentType || "application/octet-stream"
    );

    res.set("Cache-Control", "private, no-store");

    const stream = bucket.openDownloadStream(fileId);

    stream.on("error", () => {
      if (!res.headersSent) {
        res.status(500).json({
          error: "Could not load clothing photo"
        });
      } else {
        res.destroy();
      }
    });

    stream.pipe(res);
  }
);

export default router;
