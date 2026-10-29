// Builds the Express app without connecting to MongoDB or listening, so tests can import it
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";

import weatherRouter from "../routes/weather.js";
import authRoutes from "../routes/auth.js";
import wardrobeRoutes from "../routes/wardrobe.js";
import imageRoutes from "../routes/images.js";
import stylistRoutes from "../routes/stylist.js";
import { HttpError } from "./httpError.js";
import { AIError } from "../services/ai/errors.js";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // behind Vercel/Render proxies; needed for per-IP rate limits

// Frontend is served from the same origin; CORS_ORIGIN is only needed for a separately hosted frontend
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(","), credentials: true }));
}
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Static frontend (includes legacy /uploads images)
app.use(express.static(publicDir));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/wardrobe", wardrobeRoutes);
app.use("/api/stylist", stylistRoutes);
app.use("/api/images", imageRoutes);
app.use("/api", weatherRouter); // GET /api/weather

app.get("/api/health", (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

// Unknown API routes return JSON instead of the landing page
app.use("/api", (req, res) => res.status(404).json({ code: "NOT_FOUND", message: "Not found" }));

// Clean URLs for the pages (auth for private pages is checked client-side; their data APIs require a token)
["login", "signup", "dashboard", "stylist"].forEach((page) => {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(publicDir, `${page}.html`)));
});

// SPA fallback - always LAST
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Error handler: one JSON shape for every error ({ code, message, ...details })
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof AIError || err instanceof HttpError) {
    if (err.retryAfter) res.set("Retry-After", String(err.retryAfter));
    return res.status(err.status).json({ code: err.code, message: err.message, ...(err.details && { details: err.details }) });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: err.issues[0] ? `${err.issues[0].path.join(".") || "request"}: ${err.issues[0].message}` : "Invalid request",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    });
  }
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ code: "FILE_TOO_LARGE", message: "Image must be under 4MB" });
  if (err.type === "entity.too.large") return res.status(413).json({ code: "PAYLOAD_TOO_LARGE", message: "Request body too large" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ code: "INVALID_JSON", message: "Request body is not valid JSON" });
  if (err.name === "CastError") return res.status(404).json({ code: "NOT_FOUND", message: "Not found" });

  console.error(err);
  res.status(500).json({ code: "INTERNAL_ERROR", message: "Something went wrong" });
});

export default app;
