
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";

import ClothingItem from "../models/ClothingItem.js";
import FitCheck from "../models/FitCheck.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_CLOTHING_SIZE = 2 * 1024 * 1024;
const MAX_MODEL_SIZE = 15 * 1024 * 1024;
const JOB_TTL = 20 * 60 * 1000;
const JOB_LIMIT = 5;
const FASHN_URL = "https://api.fashn.ai/v1";

// Short-lived, owner-scoped jobs. For a university demo this works with
// one Node server; for multi-instance hosting use shared persistent storage.
const jobs = new Map();

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

async function removeOldImageIfUnused(bucket, imageId, ownerId) {
  if (!mongoose.isValidObjectId(imageId)) return;

  // FitCheck snapshots can refer to old photo files after wardrobe edits.
  const usedInPoll = await FitCheck.exists({
    ownerId,
    "looks.pieces.imagePublicId": String(imageId)
  });

  if (!usedInPoll) {
    await bucket.delete(new mongoose.Types.ObjectId(imageId));
  }
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

// -----------------------------------------
// STYLE STUDIO: AI VIRTUAL TRY-ON
// -----------------------------------------

// FormData input:
// modelImage = uploaded front-view model photograph
// itemId = wardrobe item ID

// Returns a jobId.
// The frontend checks GET /tryon/:jobId
// until the generation is completed.

function cleanupJobs() {
  const cutoff = Date.now() - JOB_TTL;

  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) {
      jobs.delete(id);
    }
  }
}

function publicProviderError(data, fallback) {
  const error = data?.error;

  const message =
    typeof error === "string"
      ? error
      : error?.message;

  return String(
    message || data?.message || fallback
  ).slice(0, 250);
}

async function fashnRequest(path, options = {}) {
  const response = await fetch(
    `${FASHN_URL}/${path}`,
    {
      ...options,
      headers: {
        Authorization:
          `Bearer ${process.env.FASHN_API_KEY}`,
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {})
      },
      signal: AbortSignal.timeout(25000)
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      publicProviderError(
        data,
        "AI service unavailable"
      )
    );

    error.status =
      response.status === 429 ? 429 : 502;

    throw error;
  }

  return data;
}

router.post(
  "/tryon",

  (req, res, next) => {
    if (!process.env.FASHN_API_KEY?.trim()) {
      return res.status(503).json({
        error:
          "AI try-on is not configured on the server"
      });
    }

    next();
  },

  receive(
    modelUpload,
    "modelImage",
    "Model photo (15 MB maximum)"
  ),

  async (req, res) => {
    cleanupJobs();

    if (!req.file) {
      return res.status(400).json({
        error: "Upload a model photo"
      });
    }

    const modelType = imageType(req.file.buffer);

    if (
      !modelType ||
      modelType !== req.file.mimetype
    ) {
      return res.status(400).json({
        error: "Invalid model image content"
      });
    }

    const { itemId } = req.body;

    if (
      typeof itemId !== "string" ||
      !mongoose.isValidObjectId(itemId)
    ) {
      return res.status(400).json({
        error: "Select a valid wardrobe item"
      });
    }

    const userId = String(req.userId);

    const recent = [...jobs.values()].filter(
      (job) =>
        job.ownerId === userId &&
        job.createdAt >
          Date.now() - 15 * 60 * 1000
    );

    if (recent.length >= JOB_LIMIT) {
      return res.status(429).json({
        error:
          "Try-on limit reached (5 generations per 15 minutes). Please try later."
      });
    }

    if (
      recent.some(
        (job) => job.state === "processing"
      )
    ) {
      return res.status(409).json({
        error:
          "Finish your current try-on before starting another"
      });
    }

    const item = await ClothingItem.findOne({
      _id: itemId,
      ownerId: req.userId
    }).lean();

    if (!item) {
      return res.status(404).json({
        error: "Wardrobe item not found"
      });
    }

    if (
      !mongoose.isValidObjectId(
        item.imagePublicId
      )
    ) {
      return res.status(400).json({
        error:
          "Upload a clothing photo to this item in My Closet first"
      });
    }

    const bucket = imageBucket();

    if (!bucket) {
      return res.status(503).json({
        error: "Database unavailable"
      });
    }

    const imageId =
      new mongoose.Types.ObjectId(
        item.imagePublicId
      );

    const file = await bucket
      .find({ _id: imageId })
      .next();

    if (
      !file ||
      String(file.metadata?.ownerId) !== userId ||
      !ALLOWED.includes(file.contentType) ||
      file.length > MAX_CLOTHING_SIZE
    ) {
      return res.status(404).json({
        error: "Wardrobe photo unavailable"
      });
    }

    const parts = [];

    for await (
      const part of bucket.openDownloadStream(imageId)
    ) {
      parts.push(part);
    }

    const garmentBuffer = Buffer.concat(parts);

    if (
      imageType(garmentBuffer) !==
      file.contentType
    ) {
      return res.status(415).json({
        error: "Invalid wardrobe photo"
      });
    }

    const payload = {
      model_name: "tryon-max",
      inputs: {
        model_image:
          `data:${modelType};base64,` +
          req.file.buffer.toString("base64"),

        product_image:
          `data:${file.contentType};base64,` +
          garmentBuffer.toString("base64"),

        generation_mode: "fast",
        resolution: "1k",
        output_format: "jpeg",
        num_images: 1,
        return_base64: true
      }
    };

    // Reserve a slot before the paid request.
    const jobId = randomUUID();

    const job = {
      ownerId: userId,
      predictionId: null,
      createdAt: Date.now(),
      state: "processing"
    };

    jobs.set(jobId, job);

    try {
      const data = await fashnRequest(
        "run",
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );

      if (
        typeof data.id !== "string" ||
        !data.id
      ) {
        jobs.delete(jobId);

        return res.status(502).json({
          error:
            "AI service returned no job ID"
        });
      }

      job.predictionId = data.id;

      return res.status(202).json({
        jobId,
        status: "processing"
      });
    } catch (error) {
      jobs.delete(jobId);

      return res
        .status(error.status || 502)
        .json({
          error:
            error.name === "TimeoutError"
              ? "AI service timed out. Please retry."
              : error.message ||
                "Could not start virtual try-on"
        });
    }
  }
);

router.get(
  "/tryon/:jobId",
  async (req, res) => {
    cleanupJobs();

    const job = jobs.get(req.params.jobId);

    if (
      !job ||
      job.ownerId !== String(req.userId)
    ) {
      return res.status(404).json({
        error:
          "Try-on job not found or expired"
      });
    }

    if (job.state === "failed") {
      return res.json({
        status: "failed",
        error:
          "Virtual try-on could not complete"
      });
    }

    if (!job.predictionId) {
      return res.json({
        status: "processing"
      });
    }

    try {
      const result = await fashnRequest(
        `status/${encodeURIComponent(
          job.predictionId
        )}`
      );

      if (
        [
          "starting",
          "in_queue",
          "processing"
        ].includes(result.status)
      ) {
        return res.json({
          status: "processing"
        });
      }

      if (result.status === "completed") {
        job.state = "completed";

        const image = result.output?.[0];

        if (
          typeof image !== "string" ||
          !/^data:image\/(png|jpeg);base64,/.test(
            image
          )
        ) {
          return res.status(502).json({
            error:
              "AI service returned an invalid image"
          });
        }

        res.set(
          "Cache-Control",
          "private, no-store"
        );

        return res.json({
          status: "completed",
          image
        });
      }

      job.state = "failed";

      return res.json({
        status: "failed",
        error: publicProviderError(
          result,
          "Virtual try-on could not complete"
        )
      });
    } catch (error) {
      return res
        .status(error.status || 502)
        .json({
          error:
            error.name === "TimeoutError"
              ? "AI service is slow; retry checking the job shortly"
              : error.message ||
                "Could not check try-on status"
        });
    }
  }
);

export default router;
