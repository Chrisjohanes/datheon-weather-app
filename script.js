/*
 * Atmos — Real-Time Weather Dashboard
 * Browser code contains NO OpenWeatherMap secret.
 *
 * Set WEATHER_API_BASE to your deployed Cloudflare Worker URL.
 * Example: https://datheon-weather-api.<your-subdomain>.workers.dev
 */
const WEATHER_API_BASE = "https://datheon-weather-api.johaneschristian154.workers.dev";

const searchForm = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const statusMessage = document.querySelector("#status-message");
const weatherContent = document.querySelector("#weather-content");
const forecastGrid = document.querySelector("#forecast-grid");

const weatherIcons = {
  clear: "☀️",
  clouds: "☁️",
  rain: "🌧️",
  drizzle: "🌦️",
  thunderstorm: "⛈️",
  snow: "❄️",
  mist: "🌫️",
  smoke: "🌫️",
  haze: "🌫️",
  dust: "🌪️",
  fog: "🌫️",
  sand: "🌪️",
  ash: "🌋",
  squall: "💨",
  tornado: "🌪️",
};

function iconFor(condition, iconCode = "") {
  const key = String(condition || "").toLowerCase();
  if (iconCode.endsWith("n") && key === "clear") return "🌙";
  return weatherIcons[key] || "🌡️";
}

function setStatus(message, type = "info") {
  statusMessage.className = `status-message ${type}`;
  const symbol = type === "error" ? "!" : type === "loading" ? "⟳" : "✦";
  statusMessage.replaceChildren();
  const icon = document.createElement("span");
  icon.className = "status-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = symbol;
  const text = document.createElement("span");
  text.textContent = message;
  statusMessage.append(icon, text);
}

function setLoading(isLoading) {
  searchButton.disabled = isLoading;
  searchButton.querySelector("span:first-child").textContent = isLoading
    ? "Loading..."
    : "Search";
  if (isLoading)
    setStatus("Fetching live weather data. Please wait...", "loading");
}

function getApiBase() {
  const value = WEATHER_API_BASE.trim().replace(/\/+$/, "");
  if (!value || value === "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE") {
    throw new Error(
      "Setup needed: configure WEATHER_API_BASE in script.js with your deployed weather API proxy URL.",
    );
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new Error("The weather API endpoint must use HTTPS.");
    }
    return value;
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error("The configured weather API URL is invalid.");
    throw error;
  }
}

async function fetchWeather(route, city) {
  const url = new URL(`${getApiBase()}/api/${route}`);
  url.searchParams.set("city", city);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages = {
        400: "Please enter a valid city name.",
        404: `We couldn't find “${city}”. Check the spelling or try another city.`,
        429: "Too many requests. Please wait a moment and try again.",
        502: "The weather provider is temporarily unavailable. Please try again.",
      };
      throw new Error(
        messages[response.status] ||
          data.error ||
          "Weather data could not be loaded.",
      );
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(
        "The request timed out. Please check your connection and try again.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Unable to connect to the weather service. Check your internet connection.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function setWeatherTheme(condition, iconCode) {
  document.body.classList.remove(
    "weather-sunny",
    "weather-rain",
    "weather-cloud",
    "weather-night",
  );
  if (iconCode?.endsWith("n"))
    return document.body.classList.add("weather-night");
  const group = String(condition || "").toLowerCase();
  if (group === "clear") document.body.classList.add("weather-sunny");
  else if (["rain", "drizzle", "thunderstorm"].includes(group))
    document.body.classList.add("weather-rain");
  else document.body.classList.add("weather-cloud");
}

function renderCurrentWeather(data) {
  const condition = data.weather?.[0]?.main || "Unknown";
  const description =
    data.weather?.[0]?.description || "Conditions unavailable";
  const iconCode = data.weather?.[0]?.icon || "";
  const temp = Math.round(data.main.temp);
  document.querySelector("#city-name").textContent =
    `${data.name}, ${data.sys?.country || ""}`.trim();
  document.querySelector("#local-date").textContent =
    `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  document.querySelector("#current-temp").textContent = temp;
  document.querySelector("#weather-description").textContent = description;
  document.querySelector("#feels-like").textContent =
    `${Math.round(data.main.feels_like)}°C`;
  document.querySelector("#humidity").textContent = data.main.humidity ?? "--";
  document.querySelector("#wind-speed").textContent = Number(
    data.wind?.speed ?? 0,
  ).toFixed(1);
  document.querySelector("#pressure").textContent = data.main.pressure ?? "--";
  document.querySelector("#visibility").textContent =
    data.visibility == null ? "--" : (data.visibility / 1000).toFixed(1);
  const art = document.querySelector("#weather-art");
  art.replaceChildren();
  const emoji = document.createElement("span");
  emoji.className = "weather-emoji";
  emoji.setAttribute("role", "img");
  emoji.setAttribute("aria-label", description);
  emoji.textContent = iconFor(condition, iconCode);
  art.append(emoji);
  document.querySelector("#outlook-text").textContent =
    `${description.charAt(0).toUpperCase()}${description.slice(1)} with a temperature of ${temp}°C.`;
  document.querySelector("#weather-code").textContent = condition.toUpperCase();
  setWeatherTheme(condition, iconCode);
}

function getDailyForecast(forecastData) {
  const grouped = new Map();
  forecastData.list.forEach((entry) => {
    const localDate = new Date((entry.dt + forecastData.city.timezone) * 1000)
      .toISOString()
      .slice(0, 10);
    if (!grouped.has(localDate)) grouped.set(localDate, []);
    grouped.get(localDate).push(entry);
  });
  return [...grouped.entries()]
    .map(([date, entries]) => {
      const midday =
        entries.find(
          (entry) =>
            new Date(
              (entry.dt + forecastData.city.timezone) * 1000,
            ).getUTCHours() === 12,
        ) || entries[Math.floor(entries.length / 2)];
      const temps = entries.map((entry) => entry.main.temp);
      return {
        date,
        timestamp: midday.dt,
        condition: midday.weather?.[0]?.main || "Clouds",
        description: midday.weather?.[0]?.description || "Forecast",
        icon: midday.weather?.[0]?.icon || "",
        min: Math.round(Math.min(...temps)),
        max: Math.round(Math.max(...temps)),
        rainChance: Math.round(
          Math.max(...entries.map((entry) => (entry.pop || 0) * 100)),
        ),
      };
    })
    .slice(0, 5);
}

function renderForecast(data) {
  const days = getDailyForecast(data);
  forecastGrid.replaceChildren();
  days.forEach((day, index) => {
    const card = document.createElement("article");
    card.className = "forecast-card";
    const dayLabel =
      index === 0
        ? "Today"
        : new Intl.DateTimeFormat(undefined, {
            weekday: "short",
            timeZone: "UTC",
          }).format(new Date(`${day.date}T12:00:00Z`));
    const dateLabel = new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${day.date}T12:00:00Z`));
    card.innerHTML = `
      <div class="forecast-day"></div>
      <div class="forecast-date"></div>
      <div class="forecast-icon"></div>
      <div class="forecast-description"></div>
      <div class="forecast-temps"><span class="high"></span><span class="low"></span></div>
      <div class="forecast-rain"></div>`;
    card.querySelector(".forecast-day").textContent = dayLabel;
    card.querySelector(".forecast-date").textContent = dateLabel;
    const icon = card.querySelector(".forecast-icon");
    icon.textContent = iconFor(day.condition, day.icon);
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", day.description);
    card.querySelector(".forecast-description").textContent = day.description;
    card.querySelector(".high").textContent = `${day.max}°`;
    card.querySelector(".low").textContent = `${day.min}°`;
    card.querySelector(".forecast-rain").textContent =
      `💧 ${day.rainChance}% chance`;
    forecastGrid.append(card);
  });
}

async function searchCity(city) {
  const cleanCity = city.trim();
  if (!cleanCity) {
    setStatus("Please enter a city name before searching.", "error");
    cityInput.focus();
    return;
  }
  setLoading(true);
  try {
    // The backend keeps the OpenWeatherMap key private and makes provider requests.
    const [current, forecast] = await Promise.all([
      fetchWeather("weather", cleanCity),
      fetchWeather("forecast", cleanCity),
    ]);
    renderCurrentWeather(current);
    renderForecast(forecast);
    weatherContent.hidden = false;
    setStatus(
      `Showing live weather for ${current.name}, ${current.sys?.country || ""}.`,
      "success",
    );
    cityInput.value = current.name;
  } catch (error) {
    setStatus(
      error.message || "Something went wrong. Please try again.",
      "error",
    );
  } finally {
    setLoading(false);
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchCity(cityInput.value);
});
document.querySelectorAll("[data-city]").forEach((button) => {
  button.addEventListener("click", () => {
    cityInput.value = button.dataset.city;
    searchCity(button.dataset.city);
  });
});
setStatus("Search for a city to see its latest weather.");
