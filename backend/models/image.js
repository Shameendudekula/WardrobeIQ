import mongoose from "mongoose";

// Uploaded images are stored in MongoDB so they survive redeploys on hosts without a persistent disk
const imageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Image", imageSchema);
