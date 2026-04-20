# Barber.uz CRM

## Overview

Professional Barber CRM Progressive Web App. Uzbek primary language, Russian secondary. Built for barbers to manage clients, bookings, services, and analytics.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/barber-uz) — served at `/`
- **API framework**: Express 5 (artifacts/api-server) — served at `/api`
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Charts**: Recharts
- **Animations**: Framer Motion

## Features

- **Registration & Login**: Full Uzbek/Russian localization, mode selection (Solo/Team)
- **Telegram Verification**: Bot link with polling for auto-redirect
- **Dashboard**: Stat cards (Skanerlar, Kliklar, Bugungi Bronlar, Bugungi Daromad)
- **Calendar**: Weekly/daily interactive schedule with booking slots
- **Clients CRM**: Filters (Hammasi, Doimiy 🔥, Yangi ✨, Qora ro'yxat 🧊)
- **Settings**: Profile, Page placeholder, Notifications, Analytics, Security
- **PWA**: manifest.json, installable on mobile
- **Light/Dark mode**: Full theme support
- **Timezone**: Asia/Tashkent (GMT+5)

## Auth System

- JWT stored in localStorage('barber_token')
- User stored in localStorage('barber_user')
- Password hashing via SHA-256 + salt
- Telegram verification via bot webhook

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── barber-uz/          # React frontend PWA
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── users.ts    # Barber accounts
│           ├── clients.ts  # Client records
│           ├── services.ts # Barber services/menu
│           └── bookings.ts # Appointment bookings
```

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `PASSWORD_SALT` — Optional salt for password hashing (default: barber_salt_2024)
- `TELEGRAM_BOT_SECRET` — Secret for Telegram bot webhook verification (default: barber_telegram_secret_2024)

## Telegram Bot Integration

To set up the actual Telegram bot:
1. Create a bot via @BotFather and get token
2. Set `TELEGRAM_BOT_TOKEN` env var
3. Bot should call `POST /api/auth/telegram-verify` with `{ userId, telegramId, telegramUsername, secret }`
4. The `userId` comes from `start=reg_{userId}_{lang}` parameter in the deep link

## Analytics API

New dedicated analytics endpoints at `/api/analytics/`:
- `GET /api/analytics/solo?period=today|week|month` — Solo barber analytics (real DB)
- `GET /api/analytics/team?period=today|week|month` — Team analytics (currently self-only)
- `GET /api/analytics/barber/:barberId?period=today|week|month` — Barber detail (self-only)

**Important**: Team analytics (`/team` and `/barber/:barberId`) are currently restricted to
the authenticated user's own data. Multi-barber aggregation requires a proper invite-based
team membership model — `brandName` (user-editable) cannot be used as a security boundary.
Once a `team_members` table or similar invite system is implemented, these endpoints can
be extended to aggregate across team members.

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/barber-uz run dev` — Start frontend
- `pnpm --filter @workspace/db run push` — Push DB schema
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client
