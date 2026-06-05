# DraftCoach — AI Sports Coach

> Connect Strava once. After every activity, Coach GOAT analyzes your data and delivers personalized coaching — performance, recovery, nutrition, technique.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036)
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)

---

## Screenshots

<table>
  <tr>
    <td><img src="apps/web/public/screenshots/landing-light.png" alt="Landing — Light Mode" /></td>
    <td><img src="apps/web/public/screenshots/landing-dark.png" alt="Landing — Dark Mode" /></td>
  </tr>
  <tr>
    <td align="center"><em>Landing Page — Light Mode</em></td>
    <td align="center"><em>Landing Page — Dark Mode</em></td>
  </tr>
</table>

---

## What is DraftCoach?

DraftCoach is a full-stack AI sports coaching application that integrates with Strava via webhook. Every time you finish an activity — cycling, running, swimming, hiking, strength training — **Coach GOAT** automatically analyzes your data and generates personalized coaching cards with no manual action required.

No generic advice. No manual uploads. Real numbers, real insights, delivered automatically.

---

## How It Works

```
Strava Activity Finished
        │
        ▼
Strava Webhook  ──►  Next.js API Route
        │                    │
        │            Save to Neon DB
        │                    │
        │            Call Groq (Llama 3.3 70B)
        │                    │
        │            AI Coach generates cards
        │                    │
        ▼                    ▼
   Dashboard  ◄──  Coaching cards saved to DB
```

1. User connects Strava via OAuth
2. Strava sends a webhook event when a new activity is created
3. The Next.js webhook handler verifies the signature and fetches full activity data
4. Activity is saved to Neon PostgreSQL
5. Groq (Llama 3.3 70B) is called directly with sport-specific prompts
6. Personalized coaching cards are saved and displayed on the dashboard

---

## Features

- **Automatic Analysis** — No manual action needed; webhook triggers on every Strava activity
- **Multi-Sport Support** — Cycling, running, swimming, hiking, strength training and more — each with a tailored AI coach persona
- **Coach GOAT** — AI coach powered by Groq (Llama 3.3 70B) with sport-specific coaching
- **Coaching Cards** — Performance, recovery, nutrition, technique, next training plan
- **Bilingual Output** — Analyze in TR or EN; translate existing analyses without re-spending quota
- **Per-User Rate Limiting** — Daily analysis cap enforced at the database level
- **Dark / Light Mode** — Full theme support, persists across navigation and locale changes
- **TR / EN Language** — Complete Turkish and English UI with next-intl, URL-based routing (`/tr/`, `/en/`)
- **Session Security** — Auto logout after 15 min inactivity with staged warning banners
- **Neon PostgreSQL** — Serverless database, never pauses

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), TypeScript |
| Internationalisation | next-intl (URL prefix routing, TR/EN) |
| Authentication | NextAuth v5 + Strava OAuth 2.0 |
| AI | Groq API — Llama 3.3 70B (called directly from route handlers) |
| Database | Neon (serverless PostgreSQL) |
| Deployment | Vercel |

> The entire backend runs as Next.js route handlers — no separate server to deploy or keep warm.

---

## Project Structure

```
draftcoach/
└── apps/web/                          # Next.js full-stack app
    ├── app/
    │   ├── [locale]/                  # TR / EN routing
    │   │   ├── layout.tsx             # Root layout with providers
    │   │   ├── page.tsx               # Landing page
    │   │   ├── dashboard/page.tsx     # Paginated activity list
    │   │   └── activity/[id]/page.tsx # Activity detail + Coach GOAT
    │   ├── api/
    │   │   ├── activities/            # List, import, get, analyze, translate
    │   │   └── webhook/strava/        # Strava webhook handler
    │   └── components/
    │       ├── GlobalHeader.tsx       # Header + user menu
    │       ├── ThemeProvider.tsx      # Dark/light theme context
    │       └── InactivityGuard.tsx    # Auto-logout after inactivity
    ├── lib/
    │   ├── auth.ts                    # NextAuth + Strava config
    │   ├── db.ts                      # Neon SQL client
    │   ├── groq.ts                    # AI prompts, analyze, translate
    │   ├── strava.ts                  # Token refresh helper
    │   └── sports.ts                  # Sport emoji/color mapping
    ├── i18n/                          # next-intl routing + request config
    └── messages/                      # tr.json, en.json
└── schema.sql                         # users, activities, analyses tables
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Groq API Key](https://console.groq.com) — free
- [Neon](https://neon.tech) account — free, never pauses
- Strava API app ([developers.strava.com](https://developers.strava.com))

### 1. Database

Run `schema.sql` in your Neon project's SQL Editor to create the `users`, `activities`, and `analyses` tables.

### 2. Install & run

```bash
cd apps/web
npm install
npm run dev   # http://localhost:3000
```

### 3. Environment Variables (`apps/web/.env.local`)

```env
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000

STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_WEBHOOK_VERIFY_TOKEN=your_verify_token

DATABASE_URL=postgresql://...your_neon_connection_string...

GROQ_API_KEY=gsk_...
USER_DAILY_LIMIT=5
```

### 4. Strava Webhook (production)

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=YOUR_CLIENT_ID \
  -F client_secret=YOUR_CLIENT_SECRET \
  -F callback_url=https://YOUR_DOMAIN/api/webhook/strava \
  -F verify_token=YOUR_VERIFY_TOKEN
```

---

## License

Copyright (c) 2026 Ceren Gültekin. All rights reserved.

This repository is publicly visible for portfolio purposes only.
Using, copying, or distributing this code without explicit written permission from the author is prohibited.

---

## Author

**Ceren Gültekin**
[LinkedIn](https://www.linkedin.com/in/ceren-g%C3%BCltekin-2a70841b3/) · [GitHub](https://github.com/cerengultekin-coder/DraftCoach)

---

> *"Numbers everywhere. Insight nowhere. So I built DraftCoach."*
