import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import authRoutes from "./routes/authRoutes.js";
import clothingRoutes from "./routes/clothingRoutes.js";
import imageRoutes from "./routes/imageRoutes.js";
import outfitRoutes from "./routes/outfitRoutes.js";
import suggestionRoutes from "./routes/suggestionRoutes.js";
import fitCheckRoutes from "./routes/fitCheckRoutes.js";
import entryRoutes from "./routes/entryRoutes.js";

import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      const configured = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:5174")
        .split(",").map(s => s.trim());
      const allowed = configured.includes(origin) || (!origin) ||
        (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:517[3-9]$/.test(origin));
      callback(allowed ? null : new Error("CORS origin not allowed"), allowed);
    }
  })
);

app.use(express.json({ limit: "100kb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === "production" ? 100 : 1000,
    standardHeaders: "draft-8",
    legacyHeaders: false
  })
);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "StyleCircle API"
  });
});

// Existing features
app.use("/api/auth", authRoutes);
app.use("/api/clothing-items", clothingRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/outfits", outfitRoutes);
app.use("/api/suggestions", suggestionRoutes);

// New FitCheck social voting feature
app.use("/api/fitchecks", fitCheckRoutes);
app.use("/api/entries", entryRoutes);

// Unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

// Error handling
app.use(errorHandler);

export default app;
