
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";

import ClothingItem from "../models/ClothingItem.js";
import FitCheck from "../models/FitCheck.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { removeOldImageIfUnused } from "../utils/imageRetention.js";
import { createLegacyTryOnRouter } from "./legacyTryOnRoutes.js";

const router = Router();
router.use(requireAuth);

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_CLOTHING_SIZE = 2 * 1024 * 1024;
const MAX_MODEL_SIZE = 15 * 1024 * 1024;

function imageType(buffer) {
  if (!buffer) return null;

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) return "image/jpeg";

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) return "image/png";

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) return "image/webp";

  return null;
}

function imageBucket() {
  if (
    mongoose.connection.readyState !== 1 ||
    !mongoose.connection.db
  ) return null;

  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "clothingImages"
  });
}

const clothingUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_CLOTHING_SIZE,
    files: 1,
    fields: 0,
    parts: 1
  },
  fileFilter(_req, file, done) {
    done(
      ALLOWED.includes(file.mimetype)
        ? null
        : new Error("Only JPG, PNG and WebP images are allowed"),
      ALLOWED.includes(file.mimetype)
    );
  }
});

const modelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_MODEL_SIZE,
    files: 1,
    fields: 1,
    parts: 2
  },
  fileFilter(_req, file, done) {
    done(
      ALLOWED.includes(file.mimetype)
        ? null
        : new Error("Use a JPG, PNG or WebP model photo"),
      ALLOWED.includes(file.mimetype)
    );
  }
});

function receive(upload, field, maxLabel) {
  return (req, res, next) => {
    upload.single(field)(req, res, (error) => {
      if (!error) return next();

      return res
        .status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
        .json({
          error:
            error.code === "LIMIT_FILE_SIZE"
              ? `${maxLabel} is too large`
              : error.message || "Invalid image upload"
        });
    });
  };
}

function validItemId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.itemId)) {
    return res.status(400).json({
      error: "Invalid clothing item ID"
    });
  }

  next();
}

async function findOwnedItem(req, res, next) {
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
}

async function sendImage(res, imageId, ownerId) {
  if (!mongoose.isValidObjectId(imageId)) {
    return res.status(404).json({
      error: "Photo not found"
    });
  }

  const bucket = imageBucket();

  if (!bucket) {
    return res.status(503).json({
      error: "Database unavailable"
    });
  }

  const id = new mongoose.Types.ObjectId(imageId);
  const file = await bucket.find({ _id: id }).next();

  if (
    !file ||
    String(file.metadata?.ownerId) !== String(ownerId)
  ) {
    return res.status(404).json({
      error: "Photo not found"
    });
  }

  if (!ALLOWED.includes(file.contentType)) {
    return res.status(415).json({
      error: "Unsupported image type"
    });
  }

  res.set("Content-Type", file.contentType);
  res.set("Cache-Control", "private, no-store");

  const stream = bucket.openDownloadStream(id);

  stream.on("error", () => {
    if (!res.headersSent) res.status(500).end();
    else res.destroy();
  });

  stream.pipe(res);
}

// Upload or replace a clothing photo.
router.post(
  "/clothing/:itemId",
  validItemId,
  findOwnedItem,
  receive(clothingUpload, "image", "Image (2 MB maximum)"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: "Choose a clothing photo"
      });
    }

    const type = imageType(req.file.buffer);

    if (!type || type !== req.file.mimetype) {
      return res.status(400).json({
        error: "Invalid image content"
      });
    }

    const bucket = imageBucket();

    if (!bucket) {
      return res.status(503).json({
        error: "Database unavailable"
      });
    }

    const item = req.clothingItem;
    const oldId = item.imagePublicId;

    const ext = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }[type];

    const stream = bucket.openUploadStream(
      `${item._id}.${ext}`,
      {
        contentType: type,
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

      const updated = await ClothingItem.findOneAndUpdate(
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

      if (!updated) {
        await bucket.delete(stream.id);

        return res.status(404).json({
          error: "Clothing item no longer exists"
        });
      }

      if (mongoose.isValidObjectId(oldId)) {
        try {
          await removeOldImageIfUnused(
            bucket,
            oldId,
            req.userId
          );
        } catch (error) {
          console.warn("Old photo cleanup:", error.message);
        }
      }

      return res.json({
        item: updated,
        message: "Clothing photo uploaded"
      });
    } catch (error) {
      try {
        await bucket.delete(stream.id);
      } catch {
        // Upload may be incomplete.
      }

      throw error;
    }
  }
);

// View a private clothing photo.
router.get(
  "/clothing/:itemId",
  validItemId,
  findOwnedItem,
  (req, res) => {
    return sendImage(
      res,
      req.clothingItem.imagePublicId,
      req.userId
    );
  }
);

// View a photo explicitly shared in FitCheck.
router.get(
  "/fitcheck/:pollId/:choice/:pieceIndex",
  async (req, res) => {
    const { pollId, choice, pieceIndex } = req.params;

    if (
      !mongoose.isValidObjectId(pollId) ||
      !["A", "B"].includes(choice) ||
      !/^\d{1,2}$/.test(pieceIndex)
    ) {
      return res.status(400).json({
        error: "Invalid FitCheck photo request"
      });
    }

    const poll = await FitCheck.findById(pollId).lean();

    if (!poll?.photosShared) {
      return res.status(404).json({
        error: "Photo not shared"
      });
    }

    const look = poll.looks?.[
      choice === "A" ? 0 : 1
    ];

    const piece = look?.pieces?.[
      Number(pieceIndex)
    ];

    if (!piece?.imagePublicId) {
      return res.status(404).json({
        error: "Photo unavailable"
      });
    }

    return sendImage(
      res,
      piece.imagePublicId,
      poll.ownerId
    );
  }
);

// Remove a photo without deleting the clothing item.
router.delete(
  "/clothing/:itemId",
  validItemId,
  findOwnedItem,
  async (req, res) => {
    const item = req.clothingItem;
    const oldId = item.imagePublicId;

    item.imagePublicId = null;
    item.imageUrl = null;

    await item.save();

    if (mongoose.isValidObjectId(oldId)) {
      const bucket = imageBucket();

      if (bucket) {
        try {
          await removeOldImageIfUnused(
            bucket,
            oldId,
            req.userId
          );
        } catch (error) {
          console.warn("Photo cleanup:", error.message);
        }
      }
    }

    return res.status(204).end();
  }
);

// Preserve the original /api/images/tryon endpoints in a separate module.
// The active AI Style Studio uses /api/try-on (see tryOnRoutes.js).
router.use(createLegacyTryOnRouter({
  receive, modelUpload, imageType, imageBucket,
  ALLOWED, MAX_CLOTHING_SIZE
}));

export default router;
