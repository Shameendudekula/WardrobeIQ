import mongoose from "mongoose";

export const FORMALITY_LEVELS = ["casual", "smart-casual", "business", "formal"];
export const SEASONS = ["spring", "summer", "autumn", "winter"];

const wardrobeItemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  itemName: { type: String, required: true, maxlength: 80 }, // item name
  category: { type: String, required: true, maxlength: 40 }, // e.g. "jeans", "blazer"
  imageUrl: { type: String, required: true }, // /api/images/:id (or legacy /uploads/...)
  lastWornDate: { type: Date }, // for outfit repeat detection

  // Optional styling metadata used as AI context. Entered or confirmed by the user.
  colors: { type: [String], default: [] },
  pattern: { type: String, maxlength: 40 },
  material: { type: String, maxlength: 40 },
  formality: { type: String, enum: [...FORMALITY_LEVELS, null] },
  seasons: { type: [String], enum: SEASONS, default: [] },
  styleTags: { type: [String], default: [] },
  notes: { type: String, maxlength: 300 },

  createdAt: { type: Date, default: Date.now }
});

wardrobeItemSchema.index({ userId: 1, createdAt: -1 });
wardrobeItemSchema.index({ userId: 1, category: 1 });

export default mongoose.model("WardrobeItem", wardrobeItemSchema);
