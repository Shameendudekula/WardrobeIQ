# 👗 WardrobeIQ — AI-Powered Personal Stylist

![GitHub issues](https://img.shields.io/github/issues/Shameendudekula/WardrobeIQ)
![GitHub stars](https://img.shields.io/github/stars/Shameendudekula/WardrobeIQ)
![License](https://img.shields.io/github/license/Shameendudekula/WardrobeIQ)

WardrobeIQ is a full-stack web app that digitises your wardrobe and uses a large language model to style outfits **only from the clothes you actually own**. You describe the moment in plain language, for example *"something for a university presentation tomorrow"*. The stylist then combines your wardrobe, the weather forecast, your style profile and your past feedback into several outfits and explains each one.

---

## 1. Features

| Feature | Status | Uses AI? |
| --- | --- | --- |
| Account signup/login (JWT, bcrypt) | ✅ | – |
| Wardrobe: upload photos, categories, colours, formality, seasons, pattern, material, notes; edit and delete | ✅ | – |
| Search, category filters, wear tracking ("worn today"), outfit history timeline | ✅ | – |
| **AI stylist**: natural-language requests → 1–5 distinct outfits built from your real items | ✅ | ✅ |
| Explanations per outfit: why it works, colours, weather, which preferences shaped it, tips | ✅ | ✅ |
| "Missing from your wardrobe" guidance when your clothes can't satisfy a request (no fabricated outfits or products) | ✅ | ✅ |
| Modify / regenerate an outfit ("use different shoes") while keeping chosen items | ✅ | ✅ |
| Save outfits, 👍/👎, feedback tags and comments; recent feedback is fed into future prompts | ✅ | ✅ (as context) |
| Style profile (favourite/disliked colours, styles, fit, formality, goals); editable and deletable | ✅ | ✅ (as context) |
| Weather: current conditions, plus a 5-day forecast for future dates | ✅ | context only |
| Voice commands, 32-language UI on the dashboard | ✅ | – (browser speech API) |
| AI image tagging on upload, natural-language wardrobe search, insights, packing assistant, outfit calendar | ❌ Not yet. See [Roadmap](#16-known-limitations--roadmap) | – |

> **Honesty note:** the model is **not** fine-tuned or trained on your data. "Learning from feedback" means your recent ratings and tags are included as context in the next request.

---

## 2. Architecture

```
backend/
├── server.js              Entry point: connects MongoDB, starts the server (or is exported for Vercel)
├── routes/                auth, wardrobe, stylist, weather, images
├── services/
│   ├── stylist.js         Recommendation pipeline: context → AI → validation → persistence
│   ├── weather.js         OpenWeather current + forecast (separate from styling logic)
│   └── ai/                Provider abstraction
│       ├── index.js           picks provider from env (anthropic | openai | mock)
│       ├── anthropicProvider.js   official @anthropic-ai/sdk, structured outputs
│       ├── openaiProvider.js      official openai SDK, json_schema response format
│       ├── mockProvider.js        deterministic, tests/dev only, output labelled "not AI-generated"
│       └── errors.js              provider-independent error codes
├── models/                User, WardrobeItem, Image, OutfitHistory, Outfit, StyleProfile
├── lib/                   app.js (Express app, imported by server.js and tests), HttpError, image type detection
├── public/                Static frontend (HTML/CSS/vanilla JS, no build step)
└── tests/                 node:test suites (unit, provider, API, frontend)
```

### AI recommendation flow

```mermaid
flowchart LR
    U[User request<br/>"dinner date tomorrow"] --> API[POST /api/stylist/recommend<br/>auth + validation + rate limit]
    API --> W[(User's wardrobe<br/>MongoDB)]
    API --> WX[Weather service<br/>forecast for date]
    API --> P[(Style profile +<br/>recent feedback)]
    W --> C[Build context<br/>items get per-request refs i1, i2…<br/>no database IDs]
    WX --> C
    P --> C
    C --> AI[AI provider<br/>structured JSON output]
    AI --> V{Validate<br/>schema + every ref<br/>belongs to this user}
    V -- invalid outfit --> X[Discarded]
    V -- valid --> DB[(Save Outfit docs<br/>with real item IDs)]
    DB --> R[Response: outfits with<br/>real images + explanations]
```

**Key design decisions**

- **The model never sees database IDs.** Each request labels items `i1…iN`, and the server maps refs back to the user's own records. A hallucinated or forged ID (including another user's) can't resolve to anything, and any outfit containing one is discarded whole rather than patched.
- **Double validation.** The provider's structured-output mode constrains the format, then the backend re-validates with Zod, normalises enum values, clamps text lengths and removes duplicate or repeated combinations.
- **No silent fallback.** If no AI provider is configured, the API returns `503 AI_NOT_CONFIGURED`. The old rule-based filter is never presented as AI. The mock provider must be selected explicitly, and its output is labelled in both the API (`source.isMock`) and the UI.
- **Prompt-injection hygiene.** Item names, notes, user requests and feedback are sent as delimited JSON data. The system prompt tells the model to treat them as untrusted, and the model has no tools: it can only return JSON, which the server validates.
- **Saved outfits never re-call the AI.** History, saved outfits and feedback updates are plain database reads and writes.

---

## 3. Technology stack

- **Backend:** Node.js 18+, Express 4 (ESM), Mongoose 7 / MongoDB
- **AI:** `@anthropic-ai/sdk` (default provider, Claude), `openai` (any OpenAI-compatible endpoint), `zod` for schemas and validation
- **Security:** bcryptjs, jsonwebtoken, express-rate-limit, magic-byte upload checks
- **Frontend:** HTML, CSS, vanilla JavaScript (no framework or build step)
- **Tests:** `node:test`, supertest, mongodb-memory-server

---

## 4. Prerequisites

- Node.js 18 or newer
- A MongoDB database (a free [MongoDB Atlas](https://www.mongodb.com/atlas) M0 cluster works)
- An AI provider API key (for example from the [Anthropic Console](https://console.anthropic.com/settings/keys)), required for the stylist
- An [OpenWeather](https://home.openweathermap.org/api_keys) API key (optional, enables weather-aware styling)

## 5. Installation

```bash
git clone https://github.com/Shameendudekula/WardrobeIQ.git
cd WardrobeIQ/backend
npm install
cp .env.example .env    # then fill in the values
```

## 6. Environment configuration

All configuration lives in `backend/.env` (never commit it). See [`backend/.env.example`](backend/.env.example) for the full annotated list.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Long random secret (`openssl rand -hex 32`) |
| `AI_PROVIDER` | – | `anthropic` (default), `openai`, or `mock` |
| `ANTHROPIC_API_KEY` | for `anthropic` | Server-side only; never sent to the browser |
| `AI_MODEL` | for `openai` | Model ID. Anthropic defaults to `claude-opus-5-5`; `claude-sonnet-5-5` or `claude-haiku-5-5` are cheaper |
| `OPENAI_API_KEY`, `AI_BASE_URL` | for `openai` | Key and optional base URL of an OpenAI-compatible API |
| `AI_EFFORT`, `AI_TIMEOUT_MS`, `AI_MAX_RETRIES` | – | Tuning (effort level, 60s timeout, 2 retries by default) |
| `AI_REFUSAL_FALLBACK` | – | `true` by default: on supported Claude models, a refused request is retried server-side on a fallback model |
| `AI_RATE_LIMIT_PER_HOUR` | – | AI requests per user per hour (default 30) |
| `OPENWEATHER_API_KEY` | – | Enables weather and forecasts |
| `CORS_ORIGIN` | – | Only if the frontend is hosted on another domain |

## 7. Database setup

No migrations are needed: Mongoose creates collections and indexes on first use. The new item metadata fields are optional, so existing wardrobe items keep working. For Atlas, add a database user with read/write access and allow your host's IPs under **Network Access** (`0.0.0.0/0` for Vercel or Render).

## 8. AI provider setup

**Anthropic (default)**
```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
# AI_MODEL=claude-haiku-5-5   # optional: cheaper and faster
```

**OpenAI-compatible**
```env
AI_PROVIDER=openai
OPENAI_API_KEY=...
AI_MODEL=<model id your endpoint serves>
# AI_BASE_URL=https://your-endpoint/v1
```

**Mock (offline UI development only)**: `AI_PROVIDER=mock`. Responses are deterministic placeholders, clearly labelled as not AI-generated.

Check the configuration on startup: the server logs `🤖 AI stylist: anthropic (claude-opus-5-5)`, or the reason it isn't configured.

## 9. Weather provider setup

Set `OPENWEATHER_API_KEY`. Requests for today use current conditions. Dates in the next five days use the free 5-day/3-hour forecast, summarised as min/max temperature, precipitation probability, rain/snow, wind and humidity. Further-out dates, a missing key or an outage are reported to both the model and the user as "weather not used".

## 10. Local development

```bash
cd backend
npm run dev      # nodemon, http://localhost:5001
npm start        # production mode
```

Pages: `/` (landing), `/signup`, `/login`, `/dashboard` (wardrobe), `/stylist` (AI stylist).

## 11. Testing

```bash
cd backend
npm test
```

All tests run offline against an in-memory MongoDB and need no API keys. AI calls use the mock provider, or a local fake HTTP server for SDK-level provider tests.

| Suite | Covers |
| --- | --- |
| `tests/unit.test.js` | AI response validation, ref resolution, forged/unknown IDs, duplicates, must-keep constraints, malformed output, forecast summarising, image sniffing, provider configuration |
| `tests/providers.test.js` | Real Anthropic and OpenAI SDKs against a fake server: structured-output request shape, refusal fallback header, images, 429/401/5xx/timeout mapping, bounded retries, refusals, truncation |
| `tests/api.test.js` | Auth, wardrobe CRUD and ownership, upload validation, stylist success, empty wardrobe, missing credentials, timeouts, rate limits, cross-user access, regeneration, feedback, profile |
| `tests/frontend.test.js` | Stylist rendering: real item images, XSS escaping, blocked external image URLs, loading and error states, accessible controls, mock labelling |

## 12. API documentation

All responses are JSON. Errors use `{ "code": "...", "message": "..." }`. Endpoints marked 🔒 require `Authorization: Bearer <token>`.

**Auth**: `POST /api/auth/signup` · `POST /api/auth/login` → `{ token }` · `POST /api/auth/logout`

**Wardrobe** 🔒
| Method | Route | Notes |
| --- | --- | --- |
| GET | `/api/wardrobe?category=` | List items |
| POST | `/api/wardrobe` | Multipart: `image` (JPEG/PNG/WEBP/GIF ≤ 4MB, verified by content), `itemName`, `category`, optional `colors`, `formality`, `seasons`, `pattern`, `material`, `styleTags`, `notes` |
| PATCH | `/api/wardrobe/:id` | Edit name, category or metadata (empty value clears a field) |
| DELETE | `/api/wardrobe/:id` | Deletes the item, its image and wear history |
| POST | `/api/wardrobe/:id/wear` | Log as worn today |
| GET | `/api/wardrobe/history` | Wear history |
| POST | `/api/wardrobe/suggestions` | **Deprecated** rule-based filter, kept for compatibility. Not AI |

**AI stylist** 🔒
| Method | Route | Notes |
| --- | --- | --- |
| GET | `/api/stylist/status` | `{ configured, provider, model, isMock }` (no secrets) |
| POST | `/api/stylist/recommend` | `{ prompt, occasion?, date?: "YYYY-MM-DD", city? \| lat?+lon?, count?: 1-5 }` → `{ outfits, message, missingItems, weather, source, rejected }`. Rate limited |
| POST | `/api/stylist/outfits/:id/regenerate` | `{ instruction, keepItemIds?, count?: 1-3 }`. Rate limited |
| GET | `/api/stylist/outfits?saved=true&limit=&before=` | History or saved outfits (no AI call) |
| GET / PATCH / DELETE | `/api/stylist/outfits/:id` | PATCH `{ saved?, feedback?: { rating: like\|dislike\|null, tags[], comment } }` |
| GET / PUT / DELETE | `/api/stylist/profile` | Style profile |

Error codes include `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `RATE_LIMITED` (429), `AI_NOT_CONFIGURED` (503), `AI_RATE_LIMITED` (503, with `Retry-After`), `AI_TIMEOUT` (504), `AI_UNAVAILABLE` / `AI_BAD_OUTPUT` (502) and `AI_REFUSED` (422).

**Other**: `GET /api/weather?lat=&lon=|city=` · `GET /api/images/:id` · `GET /api/health`

## 13. Deployment

**Vercel**
1. Import the repo and set **Root Directory** to `backend`.
2. Add the environment variables from section 6.
3. Deploy, then check `/api/health` and the startup log line for AI status.
- `public/` is served from the CDN, and `server.js` runs as a serverless function.
- Uploads are limited to 4MB by Vercel's request size cap.
- AI requests can take 10–40s with larger models. Make sure the project's function duration limit is above `AI_TIMEOUT_MS` (60s default), or use a faster model.

**Render / Railway / any Node host**: root directory `backend`, build `npm install`, start `npm start`, same environment variables.

Images are stored in MongoDB, so no persistent disk is needed. The frontend is served from the same origin, so `CORS_ORIGIN` is not needed unless you host it separately.

## 14. Security considerations

- Every wardrobe, outfit and profile query is scoped to the authenticated user's ID, and tests verify cross-user access returns 404.
- AI output can't reference items outside the requesting user's wardrobe, because refs are resolved server-side and anything unknown is discarded.
- Secrets are read from environment variables only. `/api/stylist/status` exposes no configuration details, and prompts and keys are not logged.
- Rate limits: AI endpoints are limited per user per hour, login and signup per IP. JSON bodies are capped at 100kb and inputs are validated with Zod.
- Uploads: the file type comes from the file's magic bytes (not its name or MIME header), only image formats are allowed, size is capped and storage IDs are generated.
- Item photos are **not** sent to the AI provider, only text metadata. The stylist page shows a privacy notice explaining what is sent.
- The frontend escapes all rendered text and only displays image URLs the app itself serves.

## 15. Cost management

- One AI call per recommendation or regeneration. Opening saved outfits or history never calls the model.
- Bounded context: up to 150 most recent items, notes truncated, and the last 15 feedback entries only.
- SDK timeouts (`AI_TIMEOUT_MS`), bounded retries (`AI_MAX_RETRIES`) and a per-user hourly cap.
- The model is configurable, and Claude Haiku/Sonnet are cheaper than the Opus default.

## 16. Known limitations & roadmap

- **No live AI verification here:** the provider integrations are tested against a fake server that mimics the APIs, not against the paid APIs. Run one real request after adding your key.
- **Single-turn requests:** each request is independent (plus modify/regenerate); there is no multi-turn chat memory yet.
- **Not yet built:** AI image tagging on upload, natural-language wardrobe search, wardrobe insights page, packing assistant, outfit calendar, shopping-gap suggestions beyond "missing items".
- **Rate limits are in-memory:** they reset on restart and aren't shared across serverless instances. Use a shared store such as Redis for strict limits at scale.
- **Images are public by ID** so `<img>` tags work without auth headers. MongoDB ObjectIds are hard to guess but not secret tokens; signed URLs would be the next step for private photos.
- **Translations:** the dashboard has 32 languages; the new AI Stylist page is English-only so far.
- **Legacy categories:** items created before this change may carry the old normalised categories (for example "formal shirt" for "shirt"); edit them to correct.
