/*
 * Cloudflare Worker API proxy for Atmos.
 *
 * Required Worker secrets/variables:
 *   OPENWEATHER_API_KEY (Secret)
 *   ALLOWED_ORIGIN (Variable, e.g. https://YOUR_USERNAME.github.io)
 *
 * Routes:
 *   GET /api/weather?city=Jakarta
 *   GET /api/forecast?city=Jakarta
 */
const OWM_BASE = "https://api.openweathermap.org/data/2.5";
const ALLOWED_ROUTES = new Set(["weather", "forecast"]);

function corsHeaders(origin, allowedOrigin) {
  return {
    "Access-Control-Allow-Origin": origin === allowedOrigin ? allowedOrigin : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = (env.ALLOWED_ORIGIN || "").replace(/\/+$/, "");
    const headers = corsHeaders(origin, allowedOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "GET") {
      return json({ error: "Method not allowed." }, 405, headers);
    }
    if (!allowedOrigin || origin !== allowedOrigin) {
      return json({ error: "Origin not allowed." }, 403, headers);
    }

    const route = url.pathname.replace(/^\/+|\/+$/g, "").replace(/^api\//, "");
    if (!ALLOWED_ROUTES.has(route)) {
      return json({ error: "Endpoint not found." }, 404, headers);
    }
    const city = (url.searchParams.get("city") || "").trim();
    if (!city || city.length > 80 || /[\u0000-\u001F\u007F]/.test(city)) {
      return json({ error: "Please provide a valid city name (1–80 characters)." }, 400, headers);
    }
    if (!env.OPENWEATHER_API_KEY) {
      return json({ error: "Weather API is not configured on the server." }, 500, headers);
    }

    const providerUrl = new URL(`${OWM_BASE}/${route}`);
    providerUrl.searchParams.set("q", city);
    providerUrl.searchParams.set("appid", env.OPENWEATHER_API_KEY);
    providerUrl.searchParams.set("units", "metric");

    try {
      const providerResponse = await fetch(providerUrl.toString(), {
        headers: { Accept: "application/json" },
        cf: { cacheTtl: 60, cacheEverything: true }
      });
      const payload = await providerResponse.json().catch(() => ({}));

      if (providerResponse.status === 404) {
        return json({ error: "City not found. Check the spelling and try again." }, 404, headers);
      }
      if (providerResponse.status === 401) {
        return json({ error: "Weather provider rejected the API key. Check the server secret." }, 502, headers);
      }
      if (providerResponse.status === 429) {
        return json({ error: "Weather provider request limit reached. Please try again later." }, 429, headers);
      }
      if (!providerResponse.ok) {
        return json({ error: "Weather provider is temporarily unavailable." }, 502, headers);
      }
      return json(payload, 200, headers);
    } catch {
      return json({ error: "Unable to reach the weather provider." }, 502, headers);
    }
  }
};
