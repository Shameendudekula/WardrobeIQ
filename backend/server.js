// Load environment variables before any other module reads process.env
import "dotenv/config";
import app from "./lib/app.js";
import { connectDb } from "./lib/db.js";
import { getAIStatus } from "./services/ai/index.js";

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;

if (!process.env.JWT_SECRET) console.error("❌ JWT_SECRET is not set");

const ai = getAIStatus();
console.log(ai.configured
  ? `🤖 AI stylist: ${ai.provider} (${ai.model})`
  : `⚠️  AI stylist not configured: ${ai.reason}`);

// MongoDB Connection (API requests wait for it via ensureDb)
connectDb(MONGO_URI);

// On Vercel the app is exported as a serverless function; elsewhere start a server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

export default app;
