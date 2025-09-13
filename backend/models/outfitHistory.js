// models/outfitHistory.js
import mongoose from "mongoose";

const outfitHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: "WardrobeItem", required: true },
  wornAt: { type: Date, default: Date.now }
});

const OutfitHistory = mongoose.model("OutfitHistory", outfitHistorySchema);
export default OutfitHistory;
