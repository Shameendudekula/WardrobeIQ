// Weather lookups (OpenWeather). Kept separate from styling logic: the stylist only receives
// the summary object returned here, or { available: false, reason } when it can't be fetched.
import axios from "axios";

const BASE = "https://api.openweathermap.org/data/2.5";
const FORECAST_DAYS = 5; // free-tier 5-day / 3-hour forecast

const round1 = (n) => (typeof n === "number" ? Math.round(n * 10) / 10 : null);

function locationParams({ lat, lon, city }) {
  if (lat !== undefined && lon !== undefined && lat !== "" && lon !== "") return { lat, lon };
  if (city) return { q: city };
  return null;
}

/** "YYYY-MM-DD" for today in UTC, or the given date string if valid */
export function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Summarise 3-hourly forecast entries for one calendar date (UTC). Exported for tests. */
export function summarizeForecast(list, date) {
  const entries = (list || []).filter((e) => typeof e.dt_txt === "string" && e.dt_txt.startsWith(date));
  if (!entries.length) return null;
  const temps = entries.map((e) => e.main?.temp).filter((t) => typeof t === "number");
  const descriptions = [...new Set(entries.map((e) => e.weather?.[0]?.description).filter(Boolean))];
  return {
    minTemperature: round1(Math.min(...temps)),
    maxTemperature: round1(Math.max(...temps)),
    description: descriptions.slice(0, 3).join(", "),
    precipitationProbability: Math.round(Math.max(...entries.map((e) => e.pop ?? 0)) * 100),
    rain: entries.some((e) => e.rain || /rain|drizzle|shower|thunder/i.test(e.weather?.[0]?.description || "")),
    snow: entries.some((e) => e.snow || /snow|sleet/i.test(e.weather?.[0]?.description || "")),
    maxWindSpeed: round1(Math.max(...entries.map((e) => e.wind?.speed ?? 0))),
    humidity: Math.round(entries.reduce((s, e) => s + (e.main?.humidity ?? 0), 0) / entries.length),
  };
}

/** Current conditions, shaped the way the dashboard already expects */
export async function getCurrentWeather(location) {
  const params = locationParams(location);
  if (!params) throw Object.assign(new Error("City or lat/lon is required"), { status: 400 });
  const { data } = await axios.get(`${BASE}/weather`, {
    params: { ...params, appid: process.env.OPENWEATHER_API_KEY, units: "metric" },
    timeout: 8000,
  });
  return {
    city: data.name,
    temperature: data.main.temp,
    feelsLike: data.main.feels_like,
    description: data.weather?.[0]?.description || "",
    humidity: data.main.humidity,
    windSpeed: data.wind?.speed,
  };
}

/**
 * Weather context for styling: current conditions for today, a forecast summary for a future date.
 * Never throws — returns { available: false, reason } so the stylist can tell the model and the user.
 */
export async function getWeatherContext({ lat, lon, city, date } = {}) {
  if (!process.env.OPENWEATHER_API_KEY) return { available: false, reason: "Weather service is not configured" };
  const params = locationParams({ lat, lon, city });
  if (!params) return { available: false, reason: "No location provided" };

  const today = isoDate();
  const target = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const daysAhead = Math.round((Date.parse(target) - Date.parse(today)) / 86400000);
  if (daysAhead < 0) return { available: false, reason: "Date is in the past" };
  if (daysAhead >= FORECAST_DAYS) return { available: false, reason: `Forecasts only cover the next ${FORECAST_DAYS} days` };

  try {
    if (daysAhead === 0) {
      const now = await getCurrentWeather({ lat, lon, city });
      return {
        available: true, kind: "current", date: target, city: now.city,
        temperature: round1(now.temperature), feelsLike: round1(now.feelsLike),
        description: now.description, humidity: now.humidity, windSpeed: round1(now.windSpeed),
      };
    }
    const { data } = await axios.get(`${BASE}/forecast`, {
      params: { ...params, appid: process.env.OPENWEATHER_API_KEY, units: "metric" },
      timeout: 8000,
    });
    const summary = summarizeForecast(data.list, target);
    if (!summary) return { available: false, reason: "No forecast data for that date" };
    return { available: true, kind: "forecast", date: target, city: data.city?.name, ...summary };
  } catch (err) {
    console.error("Weather lookup failed:", err.response?.status || err.code || err.message);
    return { available: false, reason: "Weather service did not respond" };
  }
}
