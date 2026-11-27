import { randomUUID } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import ClothingItem from "../models/ClothingItem.js";

// Legacy FASHN image routes. They are kept for compatibility with older
// clients but isolated from protected wardrobe image storage operations.
export function createLegacyTryOnRouter({
  receive, modelUpload, imageType, imageBucket,
  ALLOWED, MAX_CLOTHING_SIZE
}) {
  const router = Router();
  const JOB_TTL = 20 * 60 * 1000;
  const JOB_LIMIT = 5;
  const FASHN_URL = "https://api.fashn.ai/v1";
  const jobs = new Map();

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


  return router;
}
