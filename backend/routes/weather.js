import express from "express";
import { getCurrentWeather } from "../services/weather.js";

const router = express.Router();

// GET /api/weather?lat=&lon=  or  ?city=   (current conditions for the dashboard)
router.get("/weather", async (req, res) => {
  const { city, lat, lon } = req.query;

  if (!city && (!lat || !lon)) {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "City or lat/lon is required" });
  }
  if (!process.env.OPENWEATHER_API_KEY) {
    return res.status(503).json({ code: "WEATHER_NOT_CONFIGURED", message: "Weather service is not configured" });
  }

  try {
    res.json(await getCurrentWeather({ city, lat, lon }));
  } catch (err) {
    console.error("Weather API error:", err.response?.status || err.message);
    res.status(502).json({ code: "WEATHER_UNAVAILABLE", message: "Failed to fetch weather" });
  }
});

export default router;
