import mongoose from "mongoose";

const wardrobeItemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  itemName: { type: String, required: true }, // item name
  category: { type: String, required: true }, // e.g. "Shirt", "Pants"
  imageUrl: { type: String, required: true }, // uploaded file path
  lastWornDate: { type: Date }, // for outfit repeat detection
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("WardrobeItem", wardrobeItemSchema);
