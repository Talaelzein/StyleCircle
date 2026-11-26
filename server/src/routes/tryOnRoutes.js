
import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { Client, handle_file } from "@gradio/client";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
const connections = new Map();

const validTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const validCategories = new Set([
  "top",
  "outerwear",
  "bottom",
  "dress"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 5,
    fields: 4,
    parts: 10
  },
  fileFilter(_req, file, done) {
    done(
      validTypes.has(file.mimetype)
        ? null
        : new Error("Use JPG, PNG, or WebP photographs."),
      validTypes.has(file.mimetype)
    );
  }
});

function receivePhotos(req, res, next) {
  upload.fields([
    { name: "person", maxCount: 1 },
    { name: "garments", maxCount: 4 }
  ])(req, res, (error) => {
    if (!error) return next();

    return res.status(
      error instanceof multer.MulterError ? 413 : 400
    ).json({
      error: error.code === "LIMIT_FILE_SIZE"
        ? "Each photograph must be smaller than 15 MB."
        : error.message ||
          "The photographs could not be uploaded."
    });
  });
}

async function connect(space, token) {
  if (!connections.has(space)) {
    const promise = Client.connect(space, {
      token
    }).catch((error) => {
      connections.delete(space);
      throw error;
    });

    connections.set(space, promise);
  }

  return connections.get(space);
}

function resultUrl(result) {
  const image = result?.data?.[0];

  const url = typeof image === "string"
    ? image
    : image?.url;

  if (
    typeof url !== "string" ||
    !url.startsWith("https://")
  ) {
    throw new Error(
      "The AI model did not return a valid image."
    );
  }

  return url;
}

function isQuotaError(error) {
  return /quota|zerogpu|limit exceeded|429|too many requests/i.test(
    String(error?.message || "")
  );
}

function isAuthError(error) {
  return /invalid token|unauthorized|authentication failed|401|403/i.test(
    String(error?.message || "")
  );
}

// IDM-VTON: tops and jackets.
async function generateUpper(
  person,
  garment,
  description,
  token
) {
  const space = "yisol/IDM-VTON";

  try {
    const client = await connect(space, token);

    const result = await client.predict("/tryon", {
      dict: {
        background: handle_file(person),
        layers: [],
        composite: null
      },
      garm_img: handle_file(garment),
      garment_des: description,
      is_checked: true,
      is_checked_crop: false,
      denoise_steps: 30,
      seed: Math.floor(Math.random() * 1000000)
    });

    return resultUrl(result);
  } catch (error) {
    connections.delete(space);
    throw error;
  }
}

// Leffa: first choice for skirts, pants, and dresses.
async function generateLowerWithLeffa(
  person,
  garment,
  category,
  token
) {
  const space = "franciszzj/Leffa";

  try {
    const client = await connect(space, token);
    const api = await client.view_api();

    const endpoints = {
      ...(api.named_endpoints || {}),
      ...(api.unnamed_endpoints || {})
    };

    const named = Object.keys(endpoints).find(
      (name) => /leffa_predict_vt/i.test(name)
    );

    const endpoint = named || "/leffa_predict_vt";

    const result = await client.predict(endpoint, [
      handle_file(person),
      handle_file(garment),
      false,
      30,
      2.5,
      42,
      "dress_code",
      category === "bottom"
        ? "lower_body"
        : "dresses",
      false
    ]);

    return resultUrl(result);
  } catch (error) {
    connections.delete(space);
    throw error;
  }
}

// CatVTON: fallback for skirts, pants, and dresses.
async function generateLowerWithCatVTON(
  person,
  garment,
  category,
  token
) {
  const space = "zhengchong/CatVTON";

  try {
    const client = await connect(space, token);
    const api = await client.view_api();

    const endpoints = {
      ...(api.named_endpoints || {}),
      ...(api.unnamed_endpoints || {})
    };

    const match = Object.entries(endpoints).find(
      ([, endpoint]) => {
        const labels = (endpoint.parameters || [])
          .map((p) =>
            String(
              p.label ||
              p.parameter_name ||
              ""
            ).toLowerCase()
          )
          .join(" ");

        return (
          labels.includes("person image") &&
          labels.includes("condition image") &&
          labels.includes("try-on cloth type")
        );
      }
    );

    if (!match) {
      throw new Error(
        "CatVTON's public API is unavailable."
      );
    }

    const emptyMask = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==",
      "base64"
    );

    const result = await client.predict(
      match[0],
      [
        {
          background: handle_file(person),
          layers: [handle_file(emptyMask)],
          composite: null
        },
        handle_file(garment),
        category === "bottom"
          ? "lower"
          : "overall",
        30,
        2.5,
        42,
        "result only"
      ]
    );

    return resultUrl(result);
  } catch (error) {
    connections.delete(space);
    throw error;
  }
}

// Try Leffa first, then CatVTON.
async function generateLower(
  person,
  garment,
  category,
  token
) {
  try {
    return await generateLowerWithLeffa(
      person,
      garment,
      category,
      token
    );
  } catch (leffaError) {
    if (
      isQuotaError(leffaError) ||
      isAuthError(leffaError)
    ) {
      throw leffaError;
    }

    console.warn(
      "Leffa unavailable for lower-body try-on; trying CatVTON:",
      String(
        leffaError?.message || "unknown error"
      ).slice(0, 150)
    );

    try {
      return await generateLowerWithCatVTON(
        person,
        garment,
        category,
        token
      );
    } catch (catError) {
      if (
        isQuotaError(catError) ||
        isAuthError(catError)
      ) {
        throw catError;
      }

      throw new Error(
        "Both lower-body AI services are currently unavailable. " +
        "Please try again later, or import a saved AI result."
      );
    }
  }
}

// Validate selected garments.
function selectedGarments(req) {
  let selections;

  try {
    selections = JSON.parse(
      String(req.body?.items || "[]")
    );
  } catch {
    throw new Error(
      "The selected garment data is invalid."
    );
  }

  const files = req.files?.garments || [];

  if (
    !Array.isArray(selections) ||
    selections.length < 1 ||
    selections.length > 4
  ) {
    throw new Error(
      "Select between 1 and 4 garments."
    );
  }

  if (files.length !== selections.length) {
    throw new Error(
      "Some garment images are missing."
    );
  }

  const garments = selections.map(
    (item, index) => ({
      category: String(
        item?.category || ""
      ).toLowerCase(),

      description: String(
        item?.description || ""
      ).slice(0, 200),

      buffer: files[index].buffer
    })
  );

  if (
    garments.some(
      (g) => !validCategories.has(g.category)
    )
  ) {
    throw new Error(
      "Try-on supports tops, bottoms, dresses and outerwear."
    );
  }

  const categories = garments.map(
    (g) => g.category
  );

  if (
    new Set(categories).size !== categories.length
  ) {
    throw new Error(
      "Select only one garment from each clothing category."
    );
  }

  if (
    categories.includes("dress") &&
    (
      categories.includes("top") ||
      categories.includes("bottom")
    )
  ) {
    throw new Error(
      "Choose either a dress or a top and bottom, not both."
    );
  }

  const byCategory = new Map(
    garments.map(
      (g) => [g.category, g]
    )
  );

  const order = categories.includes("dress")
    ? ["dress", "outerwear"]
    : ["bottom", "top", "outerwear"];

  return order
    .map((name) => byCategory.get(name))
    .filter(Boolean);
}

// Download intermediate AI results.
async function downloadGeneratedImage(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(
      "The intermediate outfit image could not be downloaded."
    );
  }

  const bytes = Buffer.from(
    await response.arrayBuffer()
  );

  if (bytes.length > 20 * 1024 * 1024) {
    throw new Error(
      "The intermediate outfit image is too large."
    );
  }

  return bytes;
}

// Apply selected garments one after another.
async function generateOutfit(
  person,
  garments,
  token
) {
  let current = person;
  let lastUrl = "";

  for (
    let index = 0;
    index < garments.length;
    index += 1
  ) {
    const garment = garments[index];

    lastUrl =
      garment.category === "top" ||
      garment.category === "outerwear"
        ? await generateUpper(
            current,
            garment.buffer,
            garment.description,
            token
          )
        : await generateLower(
            current,
            garment.buffer,
            garment.category,
            token
          );

    // Pass the previous generated image
    // to the next garment generation.
    if (index + 1 < garments.length) {
      current = await downloadGeneratedImage(
        lastUrl
      );
    }
  }

  return lastUrl;
}

router.use(requireAuth);

// Protect the shared Hugging Face quota.
router.use(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 8,
    keyGenerator: (req) => String(req.userId),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Too many AI requests. Try again later."
    }
  })
);

// Generate AI try-on.
router.post(
  "/",
  receivePhotos,
  async (req, res) => {
    const token = process.env.HF_TOKEN?.trim();

    if (
      !token ||
      !token.startsWith("hf_")
    ) {
      return res.status(503).json({
        error:
          "Hugging Face is not configured. Check HF_TOKEN in server/.env."
      });
    }

    const person =
      req.files?.person?.[0]?.buffer;

    if (!person) {
      return res.status(400).json({
        error: "A person photo is required."
      });
    }

    let garments;

    try {
      garments = selectedGarments(req);
    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }

    try {
      const url = await generateOutfit(
        person,
        garments,
        token
      );

      return res.json({
        url,
        appliedCategories: garments.map(
          (garment) => garment.category
        )
      });
    } catch (error) {
      const reason = String(
        error?.message || ""
      )
        .replace(
          /hf_[A-Za-z0-9]+/g,
          "[redacted]"
        );

      if (isQuotaError(error)) {
        return res.status(429).json({
          error:
            "Hugging Face's free GPU quota is exhausted. " +
            "Try again after the quota resets."
        });
      }

      if (isAuthError(error)) {
        return res.status(502).json({
          error:
            "Hugging Face rejected the server token. Check HF_TOKEN."
        });
      }

      console.error(
        "AI try-on provider error:",
        reason.slice(0, 300)
      );

      return res.status(502).json({
        error:
          /^Both lower-body AI services/.test(reason)
            ? reason
            : "The AI service could not generate this outfit. " +
              "Try again later or import a previous result."
      });
    }
  }
);

export default router;
