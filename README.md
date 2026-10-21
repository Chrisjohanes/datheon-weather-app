# Atmos — Real-Time Weather Dashboard

Atmos is a responsive weather dashboard built with HTML, CSS, vanilla JavaScript, and a small Cloudflare Worker proxy. It displays current conditions and a five-day forecast from OpenWeatherMap.

## Features

- Search cities worldwide
- Current temperature, feels-like temperature, weather conditions, humidity, wind speed, pressure, and visibility
- Five-day forecast cards derived from OpenWeatherMap's 3-hour forecast feed
- Weather icons and condition-based background themes
- Loading, timeout, invalid-city, and network error states
- Responsive desktop/mobile layout
- `fetch`, `async/await`, `Promise.all`, and `try/catch`
- API key stored as a server-side Cloudflare Worker secret, not in browser JavaScript

## Project structure

```text
datheon-weather-app/
├── index.html
├── style.css
├── script.js
├── worker/
│   └── worker.js
└── README.md
```

## Secure deployment overview

The static frontend can be hosted on GitHub Pages. The OpenWeatherMap key must be stored as a **Cloudflare Worker Secret**, and the frontend calls the Worker API instead of calling OpenWeatherMap directly.

### 1. Create a Cloudflare Worker

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Create a Worker and paste the contents of `worker/worker.js` into its editor.
3. In Worker settings, add a **Secret** named `OPENWEATHER_API_KEY` and paste your OpenWeatherMap key into the secret value.
4. Add a **Text variable** named `ALLOWED_ORIGIN` with your exact GitHub Pages origin, for example `https://YOUR_USERNAME.github.io` (no path or trailing slash).
5. Deploy the Worker and copy its HTTPS URL.

### 2. Configure the frontend

In `script.js`, replace:

```js
const WEATHER_API_BASE = "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE";
```

with your public Worker URL, for example:

```js
const WEATHER_API_BASE = "https://your-worker.your-subdomain.workers.dev";
```

This URL is public and is not a secret. Do not place the OpenWeatherMap API key in this file.

### 3. Test the Worker

After deploying the Worker and configuring its secret and origin, open:

`https://YOUR_WORKER_URL/api/weather?city=Jakarta`

A direct browser navigation may be rejected by the origin check because it has no matching `Origin` header. Test from the deployed frontend or use a request that supplies the allowed `Origin` header.

### 4. Deploy the frontend

Commit the frontend files (but never an API key) to a public GitHub repository and enable GitHub Pages from `main` / root. Set `ALLOWED_ORIGIN` to the exact Pages origin. If using a custom domain, update that variable to the custom origin.

## Security notes

- Never commit API keys, `.env` files, or secrets to a public repository.
- If a key was exposed, rotate it in the OpenWeatherMap account.
- The Worker validates the request origin and route and limits city input length. CORS is not authentication and can be spoofed by non-browser clients, so it does not prevent all abuse. For a public production service, add rate limiting/abuse controls and monitor provider usage.
- Do not use a frontend-only environment variable to store secrets; browser JavaScript is public.
