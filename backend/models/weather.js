import mongoose from "mongoose";

const weatherSchema = new mongoose.Schema({
 
  city: String,
  temperature: Number,
  description: String,
  humidity: Number,
  windSpeed: Number,
  date: { type: Date, default: Date.now }
});

const Weather = mongoose.model("Weather", weatherSchema);
export default Weather;
