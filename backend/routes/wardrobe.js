// backend/routes/wardrobe.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import fetch from "node-fetch";
import WardrobeItem from "../models/wardrobeItem.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import OutfitHistory from "../models/outfitHistory.js";
const router = express.Router();

// ensure uploads dir
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// storage + validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files allowed"), false);
    cb(null, true);
  }
});

// POST /api/wardrobe  (upload single file field name: "image")
router.post("/", authenticateToken, upload.single("image"), async (req, res) => {
  try {
    const { itemName, category } = req.body;
    if (!req.file) return res.status(400).json({ message: "Image file is required" });
    // Normalize the category here:
    // - Trim spaces
    // - Lowercase
    // - Optional: map synonyms to standard category (can skip if you want simple)
    const normalizedCategory = getCanonicalCategory(category || "");

const newItem = new WardrobeItem({
  userId: req.user.userId,
  itemName,
  category: normalizedCategory,
  imageUrl: `/uploads/${req.file.filename}`,
  lastWornDate: null
});


    const saved = await newItem.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("wardrobe POST error:", err);
    res.status(500).json({ message: err.message });
  }
});


// GET /api/wardrobe  (get all items for authenticated user)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const items = await WardrobeItem.find({ userId: req.user.userId }).sort({ createdAt: -1 });
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


// POST /api/wardrobe/:id/wear  (mark worn)
router.post("/suggestions", authenticateToken, async (req, res) => {
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

    // Weather-based categories
    if (temp < 15) ["jacket", "sweater", "hoodie", "jeans", "kurta set"].forEach(c => categories.add(getCanonicalCategory(c)));
    else if (temp >= 15 && temp <= 25) ["shirt", "long-sleeves", "light-jacket", "jeans", "kurta set"].forEach(c => categories.add(getCanonicalCategory(c)));
    else ["t-shirt", "short", "dress", "crop top", "short top", "jeans"].forEach(c => categories.add(getCanonicalCategory(c)));

    if (condition.includes("rain")) ["raincoat", "jacket"].forEach(c => categories.add(getCanonicalCategory(c)));
    if (condition.includes("snow")) ["coat", "boots"].forEach(c => categories.add(getCanonicalCategory(c)));

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

    // Ensure item belongs to the logged-in user
    const item = await WardrobeItem.findOneAndDelete({
      _id: id,
      userId: req.user.userId
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found or not authorized" });
    }

    // Optionally delete image file from uploads
    if (item.imageUrl) {
      const filePath = path.join(process.cwd(), item.imageUrl.replace(/^\//, ""));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ success: true, message: "Item deleted successfully" });
  } catch (err) {
    console.error("Error deleting wardrobe item:", err);
    res.status(500).json({ message: "Server error" });
  }
});
// GET /api/outfithistories
router.get("/api/wardrobe/outfithistories", authenticateToken, async (req, res) => {
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

    // Ensure the item belongs to the logged-in user
    const item = await WardrobeItem.findOne({
      _id: id,
      userId: req.user.userId
    });

    if (!item) return res.status(404).json({ error: "Item not found" });

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
    res.status(500).json({ error: "Server error" });
  }
});



export default router;