import mongoose from "mongoose";

// Style preferences the user chooses to share with the AI stylist. All fields optional.
const styleProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  preferredStyles: { type: [String], default: [] },
  favoriteColors: { type: [String], default: [] },
  dislikedColors: { type: [String], default: [] },
  fit: { type: String, maxlength: 80 },
  formality: { type: String, maxlength: 40 },
  comfort: { type: String, maxlength: 120 },
  preferredCategories: { type: [String], default: [] },
  typicalOccasions: { type: [String], default: [] },
  goals: { type: String, maxlength: 400 },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("StyleProfile", styleProfileSchema);
