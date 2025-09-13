import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import weatherRouter from './routes/weather.js';

import authRoutes from "./routes/auth.js";
import { authenticateToken } from "./middlewares/authMiddleware.js";
import wardrobeRoutes from "./routes/wardrobe.js";

import cookieParser from "cookie-parser";
import axios from "axios";
import Weather from "./models/weather.js";
import OutfitHistory from "./models/outfitHistory.js";



// Load environment variables early
dotenv.config();

const app = express();

// Use PORT and MONGO_URI from environment variables
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
// Mount your weather routes under /api
app.use('/api', weatherRouter);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

// MongoDB Connection
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("PORT:", process.env.PORT);
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "set" : "not set");

// Serve static files from backend/public folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/wardrobe", wardrobeRoutes);
app.use("/api/weather", weatherRouter); // Weather route mounted
 // Weather route mounted
app.get("/weather/:city", async (req, res) => {
  const { city } = req.params;
console.log("Weather key:", process.env.OPENWEATHER_API_KEY);

  try {
    // Fetch from OpenWeather API
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`
    );

    const weatherData = {
      city: response.data.name,
      temperature: response.data.main.temp,
      description: response.data.weather[0].description,
      humidity: response.data.main.humidity,
      windSpeed: response.data.wind.speed
    };

    // Save to MongoDB
    const savedWeather = new Weather(weatherData);
    await savedWeather.save();

    res.json({
      message: "Weather data saved successfully",
      data: savedWeather
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Example protected route with JWT auth middleware
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({ message: `Welcome ${req.user.name}, this is protected data.` });
});
app.get("/dashboard", authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ✅ Outfit Histories Route (must be BEFORE wildcard *)
app.get("/api/outfithistories", authenticateToken, async (req, res) => {
  try {
    const histories = await OutfitHistory.find({ userId: req.user.userId })
      .populate("itemId")
      .sort({ wornAt: -1 });

    res.json(histories);
  } catch (err) {
    console.error("Error fetching outfit histories:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// SPA fallback - always LAST
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});   