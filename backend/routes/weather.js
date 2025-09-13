import express from "express";
import axios from "axios";
import Weather from "../models/weather.js";

const router = express.Router();

router.get("/weather", async (req, res) => {
  const { city, lat, lon } = req.query;

  if (!city && (!lat || !lon)) {
    return res.status(400).json({ error: "City or lat/lon is required" });
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    let url = '';

    if (city) {
      url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;
    } else {
      url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    }

    const response = await axios.get(url);
     
    // Prepare simplified weather data for DB and response
    const weatherData = {
      city: response.data.name,
      temperature: response.data.main.temp,
      description: response.data.weather[0].description,
      humidity: response.data.main.humidity,
      windSpeed: response.data.wind.speed,
    };

    // Save weather data to MongoDB
    const newWeather = new Weather(weatherData);
    await newWeather.save();

    // Respond with weather data
    res.json(weatherData);

  } catch (err) {
    console.error("Weather API error:", err.message);
    res.status(500).json({ error: "Failed to fetch weather" });
  }
});

export default router;
