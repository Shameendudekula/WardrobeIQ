// Load environment variables before any other module reads process.env
import "dotenv/config";
import mongoose from "mongoose";
import app from "./lib/app.js";
import { getAIStatus } from "./services/ai/index.js";

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) console.error("❌ MONGO_URI is not set");
if (!process.env.JWT_SECRET) console.error("❌ JWT_SECRET is not set");

const ai = getAIStatus();
console.log(ai.configured
  ? `🤖 AI stylist: ${ai.provider} (${ai.model})`
  : `⚠️  AI stylist not configured: ${ai.reason}`);

// MongoDB Connection (mongoose buffers queries until this resolves)
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// On Vercel the app is exported as a serverless function; elsewhere start a server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

export default app;
