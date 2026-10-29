// AI stylist API: recommendations, regeneration, outfit history/feedback, style profile
import express from "express";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { asyncHandler, HttpError } from "../lib/httpError.js";
import { FEEDBACK_TAGS } from "../models/outfit.js";
import StyleProfile from "../models/styleProfile.js";
import { getAIStatus } from "../services/ai/index.js";
import {
  recommendOutfits, regenerateOutfit, listOutfits, getOutfit, updateOutfit, deleteOutfit,
} from "../services/stylist.js";

const router = express.Router();
router.use(authenticateToken);

// Per-user cap on AI calls to bound cost and abuse (read lazily so it can be configured at runtime)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: () => Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 30,
  keyGenerator: (req) => `user:${req.user.userId}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    code: "RATE_LIMITED",
    message: "You've reached the hourly limit for AI styling requests. Please try again later.",
  }),
});

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), "must be a valid id");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const shortList = z.array(z.string().trim().min(1).max(30)).max(10);

const RecommendSchema = z.object({
  prompt: z.string().trim().min(3, "Tell the stylist what you need").max(500),
  occasion: z.string().trim().max(40).optional(),
  date: isoDate.optional(),
  city: z.string().trim().max(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  count: z.number().int().min(1).max(5).optional(),
}).strict();

const RegenerateSchema = z.object({
  instruction: z.string().trim().min(2, "Describe what to change").max(300),
  keepItemIds: z.array(objectId).max(8).optional(),
  count: z.number().int().min(1).max(3).optional(),
}).strict();

const UpdateOutfitSchema = z.object({
  saved: z.boolean().optional(),
  feedback: z.object({
    rating: z.enum(["like", "dislike"]).nullable().optional(),
    tags: z.array(z.enum(FEEDBACK_TAGS)).max(FEEDBACK_TAGS.length).optional(),
    comment: z.string().trim().max(300).optional(),
  }).strict().optional(),
}).strict();

const ProfileSchema = z.object({
  preferredStyles: shortList.optional(),
  favoriteColors: shortList.optional(),
  dislikedColors: shortList.optional(),
  fit: z.string().trim().max(80).optional(),
  formality: z.string().trim().max(40).optional(),
  comfort: z.string().trim().max(120).optional(),
  preferredCategories: shortList.optional(),
  typicalOccasions: shortList.optional(),
  goals: z.string().trim().max(400).optional(),
}).strict();

const PROFILE_FIELDS = Object.keys(ProfileSchema.shape);
const toProfile = (p) => (p ? Object.fromEntries([...PROFILE_FIELDS, "updatedAt"].map((k) => [k, p[k] ?? null])) : null);

function requireObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "NOT_FOUND", "Outfit not found");
}

/* ---------- Status (no secrets) ---------- */
router.get("/status", (req, res) => {
  const { configured, provider, model, isMock } = getAIStatus();
  res.json({ configured, provider, model, isMock });
});

/* ---------- Recommendations ---------- */
router.post("/recommend", aiLimiter, asyncHandler(async (req, res) => {
  const body = RecommendSchema.parse(req.body);
  const result = await recommendOutfits({ userId: req.user.userId, ...body });
  res.status(result.aiUsed ? 201 : 200).json(result);
}));

router.post("/outfits/:id/regenerate", aiLimiter, asyncHandler(async (req, res) => {
  requireObjectId(req.params.id);
  const body = RegenerateSchema.parse(req.body);
  const result = await regenerateOutfit({ userId: req.user.userId, outfitId: req.params.id, ...body });
  res.status(201).json(result);
}));

/* ---------- Outfit history, saving and feedback (no AI calls) ---------- */
router.get("/outfits", asyncHandler(async (req, res) => {
  const outfits = await listOutfits(req.user.userId, {
    saved: req.query.saved === "true",
    limit: Number(req.query.limit) || 20,
    before: req.query.before,
  });
  res.json({ outfits });
}));

router.get("/outfits/:id", asyncHandler(async (req, res) => {
  requireObjectId(req.params.id);
  res.json(await getOutfit(req.user.userId, req.params.id));
}));

router.patch("/outfits/:id", asyncHandler(async (req, res) => {
  requireObjectId(req.params.id);
  const body = UpdateOutfitSchema.parse(req.body);
  res.json(await updateOutfit(req.user.userId, req.params.id, body));
}));

router.delete("/outfits/:id", asyncHandler(async (req, res) => {
  requireObjectId(req.params.id);
  await deleteOutfit(req.user.userId, req.params.id);
  res.status(204).end();
}));

/* ---------- Style profile ---------- */
router.get("/profile", asyncHandler(async (req, res) => {
  const profile = await StyleProfile.findOne({ userId: req.user.userId }).lean();
  res.json({ profile: toProfile(profile) });
}));

router.put("/profile", asyncHandler(async (req, res) => {
  const body = ProfileSchema.parse(req.body);
  const profile = await StyleProfile.findOneAndUpdate(
    { userId: req.user.userId },
    { $set: { ...body, updatedAt: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  res.json({ profile: toProfile(profile) });
}));

router.delete("/profile", asyncHandler(async (req, res) => {
  await StyleProfile.deleteOne({ userId: req.user.userId });
  res.status(204).end();
}));

export default router;
