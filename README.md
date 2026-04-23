# Peptide Dose Calculator & Scheduler

A prototype web app for peptide reconstitution math, dose scheduling, multi-channel reminders, and client progress tracking.

## Features

- **Mandatory legal disclaimer** on first use and after registration
- **Reconstitution calculator** with animated syringe visual (guest-accessible), Basic and Advanced tabs
- **Smart dosing guide** based on height/weight/age/goal
- **Add to Stack** directly from either calculator tab — quick-add dialog with all 7 schedule types
- **Guest stacks** — save stacks without an account; a persistent banner invites sign-up and all guest stacks auto-migrate to the new account on signup
- **Schedule builder** with 7 schedule types:
  - Daily, Every N days, Specific weekdays, N times per week,
    Cycle (X on / Y off), Single dose, Custom dates
- **Multi-channel reminders** — desktop push (Web Push / VAPID), email (Resend), and SMS (Twilio) — configurable per user with per-stack toggle and lead-time (0/5/15/30/60 min)
- **.ics calendar export** (Apple/Google Calendar compatible) with the full expanded schedule
- **Email/password auth** with guest mode
- **Pro tier** with client management and progress tracking (Recharts line graphs)
- 15 seeded peptides (Semaglutide, Tirzepatide, BPC-157, etc.)

## Tech Stack

- Express + React + TypeScript
- Tailwind CSS + shadcn/ui
- Drizzle ORM + SQLite (better-sqlite3)
- TanStack Query + wouter (hash routing)
- Recharts for data visualization
- `web-push` (VAPID), `resend` (email), `twilio` (SMS)

## Run Locally

```bash
npm install
npm run dev
```

Opens on http://localhost:5000

## Deploy to Render / Railway

1. Push this folder to a new GitHub repo
2. Create a new Web Service from the repo — auto-detects Node
3. Add a persistent disk/volume mounted at `/data` and set env var `DATA_DIR=/data` so the SQLite database persists across deploys
4. Set the environment variables below (see Environment Variables)
5. Generate a public domain in the service settings

## Environment Variables

### Core

| Variable   | Purpose                                                 | Default |
| ---------- | ------------------------------------------------------- | ------- |
| `PORT`     | Server port (host platforms usually set this for you)   | `5000`  |
| `DATA_DIR` | Folder for SQLite database and VAPID key file           | `.`     |

### Web Push (desktop browser reminders)

| Variable            | Purpose                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`  | VAPID public key (base64url). If unset, the server auto-generates a keypair to `data/vapid.json`.    |
| `VAPID_PRIVATE_KEY` | VAPID private key. Auto-generated with the public key on first run if not provided.                  |
| `VAPID_SUBJECT`     | A contact URL — `mailto:you@example.com` or `https://your-site.com`. Required by the Web Push spec.  |

For production, generate a persistent keypair once and put it in environment variables so keys don't change across deploys. Example:

```bash
npx web-push generate-vapid-keys
```

### Email reminders (Resend)

| Variable         | Purpose                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| `RESEND_API_KEY` | API key from https://resend.com (starts with `re_`).                          |
| `FROM_EMAIL`     | Verified sender, e.g. `Peptide App <reminders@yourdomain.com>`.               |

Setup: sign up at resend.com → verify a sending domain (or use `onboarding@resend.dev` for testing) → create an API key.

### SMS reminders (Twilio)

| Variable             | Purpose                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| `TWILIO_ACCOUNT_SID` | Account SID from https://console.twilio.com (starts with `AC`).          |
| `TWILIO_AUTH_TOKEN`  | Auth token from the same console page.                                   |
| `TWILIO_FROM_NUMBER` | A Twilio phone number in E.164 format, e.g. `+15555550123`.              |

Setup: sign up at twilio.com → buy or verify a phone number → copy the SID / auth token from the console dashboard.

### Graceful degradation

Each channel is independent. If Resend is unconfigured, email reminders are silently skipped and the Account page shows a yellow warning under the Email toggle. Same for SMS. Web Push is available out of the box because the server auto-generates VAPID keys, but desktop notifications still require the user to grant browser permission on the Account page.

## Legal

This app is a mathematical calculation tool only. Not medical advice. Users must accept the disclaimer before use; acceptances are logged.
