# 🚴 DraftCoach — AI-Powered Cycling Analytics

> Upload your GPX file. Get instant route visualization, performance metrics, and personalized AI coaching — all in one place.

![DraftCoach](https://img.shields.io/badge/DraftCoach-v0.3.0-blue) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green) ![License](https://img.shields.io/badge/license-MIT-orange)

---

## ✨ What is DraftCoach?

DraftCoach is a full-stack cycling analytics application that turns raw GPX data into actionable insights. It combines route mapping, performance metrics, interactive charts, and an AI coach (Coach GOAT) that analyzes your ride and gives you real, personalized feedback — not just generic advice.

---

## 🎯 Features

- **GPX Upload & Parsing** — Smart parsing with GPS spike filtering, elevation smoothing, and gap detection
- **Route Map** — Interactive Leaflet map with direction arrows, start/finish markers, and auto-fit bounds
- **Performance Metrics** — Distance, elapsed time, moving time, avg/max speed, elevation gain/loss, heart rate stats
- **Interactive Charts** — Elevation, heart rate, and speed profiles with smart contextual notes (Chart.js)
- **Coach GOAT** — AI coach powered by Groq (llama-3.3-70b) that streams personalized coaching cards in real time
- **Rule-based Coach Cards** — Instant insights without AI, based on your actual ride data
- **Dark / Light Mode** — Full theme support
- **TR / EN Language Support** — Full Turkish and English UI, AI responses in selected language
- **Daily Usage Limits** — Per-user limit (5 AI analyses/day) + backend Groq usage counter with email alerts via Resend

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (Turbopack), TypeScript, Tailwind CSS |
| Backend | FastAPI (Python), gpxpy |
| Maps | Leaflet (imperative, SSR-safe) |
| Charts | Chart.js |
| AI Coach | Groq API — llama-3.3-70b-versatile |
| Email Alerts | Resend |
| Fonts | Oswald, Lexend, Fira Code |

---

## 📁 Project Structure

```
draftcoach/
├── apps/
│   ├── api/                  # FastAPI backend
│   │   ├── main.py           # All endpoints, GPX parsing, AI coach
│   │   └── requirements.txt
│   └── web/                  # Next.js frontend
│       ├── app/
│       │   ├── [locale]/
│       │   │   └── page.tsx  # Main page
│       │   └── components/
│       │       ├── RouteMap.tsx
│       │       └── ActivityCharts.tsx
│       ├── messages/
│       │   ├── tr.json
│       │   └── en.json
│       └── globals.css
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Groq API Key](https://console.groq.com) (free)
- [Resend API Key](https://resend.com) (free, for email alerts)

### Backend Setup

```bash
cd apps/api
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Set environment variables:

```powershell
# Windows (PowerShell)
$env:GROQ_API_KEY = "gsk_..."
$env:RESEND_API_KEY = "re_..."
$env:ALERT_EMAIL_TO = "your@email.com"
```

```bash
# macOS/Linux
export GROQ_API_KEY="gsk_..."
export RESEND_API_KEY="re_..."
export ALERT_EMAIL_TO="your@email.com"
```

Start the backend:

```bash
uvicorn main:app --reload
```

API will be available at `http://localhost:8000`

### Frontend Setup

```bash
cd apps/web
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

App will be available at `http://localhost:3000`

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq API key for AI coach |
| `RESEND_API_KEY` | ⚠️ Optional | Resend key for usage alert emails |
| `ALERT_EMAIL_TO` | ⚠️ Optional | Email address to receive alerts |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/v1/activities:upload` | Upload & parse GPX file |
| `POST` | `/v1/activities:ai-coach` | Get AI coaching cards (streaming SSE) |
| `GET` | `/v1/usage` | Current Groq API usage stats |

### Upload Response includes:
- `summary` — duration, point count, timestamps
- `metrics` — distance, speed, elevation
- `route` — map segments and bounds
- `timeseries` — per-point data (elevation, HR, speed, cadence)
- `coach_cards` — rule-based coaching insights

---

## 🤖 Coach GOAT

Coach GOAT is the AI coach powered by Groq's llama-3.3-70b model. It:

- Reads your actual ride data (bpm, km/h, elevation, time)
- Streams personalized coaching cards in real time
- Responds in Turkish or English based on your language selection
- Covers: performance, recovery, nutrition, technique, and next training plan
- Limited to **5 analyses per user per day** (resets at midnight)

---

## 📧 Usage Monitoring

The backend tracks daily Groq API usage and sends email alerts via Resend when:
- **70%** of daily limit is reached
- **90%** of daily limit is reached

Configure `RESEND_API_KEY` and `ALERT_EMAIL_TO` to enable this feature.

---

## 🌍 Deployment

### Local + ngrok (zero cost)

```bash
# Start backend
uvicorn main:app --host 0.0.0.0 --port 8000

# Expose backend
ngrok http 8000

# Update NEXT_PUBLIC_API_BASE_URL in Vercel with ngrok URL
```

### Frontend → Vercel
### Backend → Render / Railway / Fly.io

---

## 📄 License

MIT — feel free to use, modify and distribute.

---

## 👤 Author

**Ceren Gültekin**
[LinkedIn](https://www.linkedin.com/in/ceren-gultekin-2a70841b3/)

---

> *"Numbers everywhere. Insight nowhere. So I built DraftCoach."*
