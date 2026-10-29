// backend/routes/wardrobe.js
import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import { z } from "zod";
import WardrobeItem, { FORMALITY_LEVELS, SEASONS } from "../models/wardrobeItem.js";
import Image from "../models/image.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import OutfitHistory from "../models/outfitHistory.js";
import { sniffImageType } from "../lib/imageType.js";
const router = express.Router();

// Keep uploads in memory and store them in MongoDB (serverless hosts have no persistent disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 }, // 4MB (Vercel caps request bodies at 4.5MB)
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(Object.assign(new Error("Only image files allowed"), { status: 400 }), false);
    cb(null, true);
  }
});

// Optional styling metadata. Multipart fields arrive as strings, so lists accept "a, b" or a JSON array.
const list = (max, itemMax = 30) => z.preprocess((v) => {
  if (v === undefined || v === null) return undefined;
  if (v === "") return []; // empty string clears the list when editing
  if (Array.isArray(v)) return v;
  const s = String(v).trim();
  if (s.startsWith("[")) { try { return JSON.parse(s); } catch { return s; } }
  return s.split(",");
}, z.array(z.string().trim().toLowerCase().max(itemMax)).max(max).transform((a) => [...new Set(a.filter(Boolean))]).optional());
// Empty string or null clears the field when editing
const optionalText = (max) => z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(max).nullable().optional());

const MetadataSchema = z.object({
  colors: list(5),
  pattern: optionalText(40),
  material: optionalText(40),
  formality: z.preprocess((v) => (v === "" ? null : v), z.enum(FORMALITY_LEVELS).nullable().optional()),
  seasons: list(4).refine((a) => !a || a.every((x) => SEASONS.includes(x)), "seasons must be spring, summer, autumn or winter"),
  styleTags: list(8),
  notes: optionalText(300),
});
const CreateItemSchema = MetadataSchema.extend({
  itemName: z.string().trim().min(1, "Item name is required").max(80),
  category: z.string().trim().min(1, "Category is required").max(40),
});
const UpdateItemSchema = MetadataSchema.extend({
  itemName: z.string().trim().min(1).max(80).optional(),
  category: z.string().trim().min(1).max(40).optional(),
}).strict();

const validId = (id) => mongoose.isValidObjectId(id);
// Categories keep the user's wording; the AI stylist reads them directly
const normalizeCategory = (c) => c.trim().toLowerCase().replace(/\s+/g, " ");

// POST /api/wardrobe  (multipart: image + itemName, category, optional metadata)
router.post("/", authenticateToken, upload.single("image"), async (req, res, next) => {
  try {
    const parsed = CreateItemSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    if (!req.file) return res.status(400).json({ code: "VALIDATION_ERROR", message: "Image file is required" });

    // Trust the file's bytes, not the client-supplied MIME type or extension
    const contentType = sniffImageType(req.file.buffer);
    if (!contentType) {
      return res.status(400).json({ code: "UNSUPPORTED_IMAGE", message: "Upload a JPEG, PNG, WEBP or GIF image" });
    }

    const { itemName, category, ...metadata } = parsed.data;
    const normalizedCategory = normalizeCategory(category);

    const image = await Image.create({ userId: req.user.userId, data: req.file.buffer, contentType });

    const saved = await WardrobeItem.create({
      userId: req.user.userId,
      itemName,
      category: normalizedCategory,
      imageUrl: `/api/images/${image._id}`,
      lastWornDate: null,
      ...metadata
    });
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/wardrobe/:id  (edit name, category or metadata)
router.patch("/:id", authenticateToken, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ code: "NOT_FOUND", message: "Item not found" });
    const parsed = UpdateItemSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    const update = { ...parsed.data };
    if (update.category) update.category = normalizeCategory(update.category);

    const item = await WardrobeItem.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ code: "NOT_FOUND", message: "Item not found" });
    res.json(item);
  } catch (err) {
    next(err);
  }
});


// GET /api/wardrobe  (get all items for authenticated user, optional ?category= filter)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const filter = { userId: req.user.userId };
    if (req.query.category) filter.category = normalizeCategory(String(req.query.category));
    const items = await WardrobeItem.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("wardrobe GET error:", err);
    res.status(500).json({ message: err.message });
  }
});
// Map synonyms to canonical categories (all lowercase)
const categorySynonyms = {
  "formal shirt": ["formal shirt", "dress shirt", "shirt"],
  "kurta set": ["kurta set", "kurta", "dress"],
  "half saree": ["lehanga", "lehanga choli", "langa voni", "pattu half saree", "grand lehanga"],
  "tank top": ["tank top", "sleeveless top"],
  "swimwear": ["brief","jammer","square-cut trunk","swim dress","mini-dress","shirred top"],
  "t-shirt": ["t-shirt", "tee", "shirt"],
  "sneakers": ["sneakers", "trainers", "shoes"],
  "saree": ["saree", "gadwal saree", "venkatagiri sarees", "cotton saree"],
  "wedding saree": ["banarasi saree", "kanjeevaram saree", "pattu saree", "mysore silk pattu saree", "kanchipuram pattu saree"],
  "trousers": ["trousers", "pants"],
  "blazer": ["blazer", "jacket"],
  "loafers": ["loafers", "shoes"],
  "dress": ["dress", "gown", "frock"],
  "heels": ["heels", "pumps", "stilettos", "high heels", "shoes"],
  "accessories": ["accessories","ring","ties","belt","hat","sunglasses","bag","wallet", "jewelry", "jewellery", "bracelet","watch", "necklace", "earrings"],
  "suit": ["suit", "three-piece suit"],
  "tie": ["tie", "necktie"],
  "dress shoes": ["dress shoes", "oxfords", "derbies", "formal shoes"],
  "jeans": ["jeans", "denim"],
  "sherwani": ["sherwani"],
  "formal shoes": ["formal shoes", "oxfords", "loafers"],
  "sportswear": ["sportswear", "gym wear", "activewear"],
  "running shoes": ["running shoes", "trainers", "jogging shoes"],
  "comfortable pants": ["comfortable pants", "pants", "shorts", "track pants", "joggers"],
  "boots": ["boots", "ankle boots", "chelsea boots"],
  "raincoat": ["raincoat", "waterproof jacket"],
  "coat": ["coat", "overcoat"],
  "flip-flops": ["flip-flops", "slippers", "sandals"],
  "sunglasses": ["sunglasses", "shades", "goggles"],
  "loungewear": ["loungewear", "pajamas", "pyjamas", "nightwear"],
  "slippers": ["slippers", "indoor sandals"],
};

// routes/wardrobe.js (for example)


// Function to get canonical category for saving
function getCanonicalCategory(inputCategory) {
  if (!inputCategory) return ""; // handle null/undefined/empty input
  
  const cat = inputCategory.trim().toLowerCase();

  for (const [canonical, synonyms] of Object.entries(categorySynonyms)) {
    if (Array.isArray(synonyms)) {
      // Normalize all synonyms once for comparison
      const normalized = synonyms.map(s => s.toLowerCase());
      if (normalized.includes(cat)) return canonical;
    } else if (typeof synonyms === "string") {
      if (synonyms.toLowerCase() === cat) return canonical;
    } else {
      console.warn("⚠️ Invalid synonyms entry for category:", canonical, synonyms);
    }
  }

  return cat; // fallback to normalized input if no match
}


// POST /api/wardrobe/suggestions  — DEPRECATED rule-based category filter kept for API compatibility.
// It is not AI. The app uses POST /api/stylist/recommend instead.
router.post("/suggestions", authenticateToken, async (req, res) => {
  res.set("Deprecation", "true");
  res.set("Link", '</api/stylist/recommend>; rel="successor-version"');
  try {
    const {
      temp,
      condition,
      location = "",
      occasion = "",
      purpose = ""
    } = req.body;
   console.log("Suggestion inputs:", { temp, condition, location, occasion, purpose });

    const allowedLocations = ["office", "beach", "home"];
    const allowedOccasions = ["party", "formal", "casual", "wedding"];
    const allowedPurposes = ["workout", "travel", "date"];

    const locationNorm = (location || "").trim().toLowerCase();
    const occasionNorm = (occasion || "").trim().toLowerCase();
    const purposeNorm = (purpose || "").trim().toLowerCase();

    if (locationNorm && !allowedLocations.includes(locationNorm)) {
      return res.status(400).json({ message: "Invalid location" });
    }
    if (occasionNorm && !allowedOccasions.includes(occasionNorm)) {
      return res.status(400).json({ message: "Invalid occasion" });
    }
    if (purposeNorm && !allowedPurposes.includes(purposeNorm)) {
      return res.status(400).json({ message: "Invalid purpose" });
    }

    const categories = new Set();

    // Weather-based categories (skipped when weather is unavailable)
    const hasTemp = typeof temp === "number" && Number.isFinite(temp);
    const conditionNorm = String(condition || "").toLowerCase();
    if (!hasTemp) {
      // no weather data
    } else if (temp < 15) ["jacket", "sweater", "hoodie", "jeans", "kurta set"].forEach(c => categories.add(getCanonicalCategory(c)));
    else if (temp >= 15 && temp <= 25) ["shirt", "long-sleeves", "light-jacket", "jeans", "kurta set"].forEach(c => categories.add(getCanonicalCategory(c)));
    else ["t-shirt", "short", "dress", "crop top", "short top", "jeans"].forEach(c => categories.add(getCanonicalCategory(c)));

    // No weather and no filters: fall back to everyday basics
    if (!hasTemp && !locationNorm && !occasionNorm && !purposeNorm) {
      ["t-shirt", "shirt", "jeans", "kurta set", "dress", "sneakers"].forEach(c => categories.add(getCanonicalCategory(c)));
    }

    if (conditionNorm.includes("rain")) ["raincoat", "jacket"].forEach(c => categories.add(getCanonicalCategory(c)));
    if (conditionNorm.includes("snow")) ["coat", "boots"].forEach(c => categories.add(getCanonicalCategory(c)));

    // Location-based
    if (locationNorm === "office") {
      ["formal shirt", "trousers", "blazer", "loafers"].forEach(c => categories.add(getCanonicalCategory(c)));
    } else if (locationNorm === "beach") {
      ["swimwear", "flip-flops", "sunglasses", "shorts"].forEach(c => categories.add(getCanonicalCategory(c)));
    } else if (locationNorm === "home") {
      ["loungewear", "slippers", "t-shirt","comfortable pants"].forEach(c => categories.add(getCanonicalCategory(c)));
    }

    // Occasion-based
    if (occasionNorm === "party") {
      ["dress", "heels", "accessories"].forEach(c => categories.add(getCanonicalCategory(c)));
    } else if (occasionNorm === "formal") {
      ["suit", "tie", "dress shirt", "dress shoes"].forEach(c => categories.add(getCanonicalCategory(c)));
    } else if (occasionNorm === "casual") {
      ["jeans", "t-shirt","saree", "sneakers"].forEach(c => categories.add(getCanonicalCategory(c)));
    } else if (occasionNorm === "wedding") {
      ["sherwani", "kurta set","Wedding Saree","half saree", "formal shoes"].forEach(c => categories.add(getCanonicalCategory(c)));
    }

    // Purpose-based
    if (purposeNorm === "workout") {
      ["sportswear", "running shoes", "tank top"].forEach(c => categories.add(getCanonicalCategory(c)));
    } else if (purposeNorm === "travel") {
      ["comfortable pants", "sneakers", "jacket"].forEach(c => categories.add(getCanonicalCategory(c)));
    } else if (purposeNorm === "date") {
      ["stylish shirt", "jeans", "boots"].forEach(c => categories.add(getCanonicalCategory(c)));
    }

    console.log("Suggestion categories:", Array.from(categories));

    const catArray = Array.from(categories).map(c => c.toLowerCase());

    const match = {
      userId: new mongoose.Types.ObjectId(req.user.userId),
      category: { $in: catArray }
    };

    const items = await WardrobeItem.aggregate([
      { $match: match },
      { $sample: { size: 1000 } }
    ]);

    res.json({ weather: { temp, condition }, suggestions: items });

  } catch (err) {
    console.error("suggestions error:", err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/wardrobe/:id (delete an item)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return res.status(404).json({ code: "NOT_FOUND", message: "Item not found" });

    // Ensure item belongs to the logged-in user
    const item = await WardrobeItem.findOneAndDelete({
      _id: id,
      userId: req.user.userId
    });

    if (!item) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Item not found" });
    }

    // Remove the stored image and this item's wear history
    const imageMatch = item.imageUrl && item.imageUrl.match(/^\/api\/images\/([a-f0-9]{24})$/);
    if (imageMatch) await Image.deleteOne({ _id: imageMatch[1], userId: req.user.userId });
    await OutfitHistory.deleteMany({ itemId: item._id, userId: req.user.userId });

    res.json({ success: true, message: "Item deleted successfully" });
  } catch (err) {
    console.error("Error deleting wardrobe item:", err);
    res.status(500).json({ message: "Server error" });
  }
});
// GET /api/wardrobe/history
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const histories = await OutfitHistory.find({ userId: req.user.userId })
      .populate("itemId") // pulls wardrobe item details
      .sort({ wornAt: -1 });

    res.json(histories);
  } catch (err) {
    console.error("Error fetching outfit histories:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/wardrobe/:id/wear
router.post("/:id/wear", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return res.status(404).json({ code: "NOT_FOUND", message: "Item not found" });

    // Ensure the item belongs to the logged-in user
    const item = await WardrobeItem.findOne({
      _id: id,
      userId: req.user.userId
    });

    if (!item) return res.status(404).json({ code: "NOT_FOUND", message: "Item not found" });

    // Update last worn date
    item.lastWornDate = new Date();
    await item.save();

    // Add history record
    const history = new OutfitHistory({
      userId: req.user.userId,
      itemId: item._id,
      wornAt: new Date()
    });
    await history.save();

    res.status(200).json({
      message: "Marked as worn",
      item,
      history
    });
  } catch (err) {
    console.error("Error marking as worn:", err);
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Server error" });
  }
});



export default router;