# CreatorsHub

A personal collaboration manager for creators. It tracks brand deals, deliverables, follow-ups, tasks and payments, and opens on a dashboard that shows what needs your attention today.

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) · MongoDB (Mongoose) · Zod**. It runs on Vercel's serverless platform and doesn't need a separate backend server.

---

## Features

| Area | What it does |
| --- | --- |
| **Dashboard** | Today's Focus: a ranked list of replies owed, follow-ups due, deliverables due, payments to chase and invoices to send. Each item has a one-click action and shows why it is there. Also shows overview cards (active, new leads, due this week, pending/expected/received money), the next 14 days of deadlines and recent activity. |
| **Collaborations** | Quick add (only the brand is required) or paste an email/DM to have the details extracted. Each collaboration has a detail page with a one-click status stepper, deliverables with their own status and due date, key dates, contact info, links, a money panel with payment history, linked tasks and a timeline with notes and follow-ups. |
| **Paste-to-import** | **Rule-based, deterministic extraction (not AI)**. It runs in the browser and pulls out the brand, contact, email/phone, amount and currency (₹/Rs/INR/$/€/£, `25k`, `1.5 lakh`), deliverables (`2 Instagram Stories`), platforms, collaboration type, dates by context (reply by / submit / go live / payment) and payment terms (`within 30 days`). You review everything before saving. The original message is saved only if you opt in. |
| **Tasks** | Today / Overdue / Upcoming / No date / Completed views. A task can be linked to a collaboration or stand alone. |
| **Payments** | Record partial and multiple payments. Payment status (no fee / unpaid / partial / paid / overdue) is derived from the actual payment records. Filter by month, brand and status. Totals are kept per currency. |
| **Calendar** | Month and agenda views, colour-coded by event type, with type filters. Clicking an event opens the related collaboration or task. |
| **Brands** | Created automatically when you add a collaboration (names are normalised, so "Mamaearth Pvt Ltd" matches "Mamaearth"). Each brand shows its history, contracted value and amount received. |
| **Search** | `Ctrl/⌘ K` or `/` searches brands, campaigns, contacts, notes and tasks. Shortcuts: `N` new collaboration, `T` new task. |
| **Settings** | Timezone, default currency, follow-up interval, payment terms, theme, password change, JSON/CSV export, sample-data removal. |

### Automations

All automations are rule-based and tested. Each one writes an entry to the collaboration's timeline.

- **New collaboration:** status defaults to *New lead* and the inquiry date to today. The brand is found or created automatically. A follow-up date is scheduled when the status is a conversation stage. If an amount is set, the payment due date is set to the publish/submission date plus your payment terms.
- **Status changes:**
  - Moving to *Contacted*, *Negotiating* or *Awaiting approval* schedules a follow-up.
  - Confirming clears the follow-up and lists any key dates that are still missing.
- **Deliverables:**
  - Starting work moves a confirmed collaboration to *In progress*.
  - Submitting everything moves it to *Awaiting approval*.
  - Changes requested moves it back to *In progress*.
  - When every deliverable is approved or published, the app suggests marking the collaboration completed (it never closes it automatically).
- **Money:**
  - The received amount is always recalculated from the payment records.
  - A collaboration is *Paid* only once the full agreed amount has been received.
  - It becomes *Overdue* when the due date has passed and a balance remains.
  - Completed work with an outstanding balance and no invoice prompts *Send invoice*.
- **Duplicates:** a double-submitted form never creates two records. Saving a second open collaboration with the same brand and title triggers a warning.

### Reminders: what works and what doesn't

Reminders are **in-app**: the dashboard and the bell icon are recalculated every time you open the app. **No notification is sent while the app is closed.** That would need a scheduled job (for example Vercel Cron calling an API route) plus an email or web-push provider. See *Phase 3* below.

---

## Architecture

```
src/
  app/
    (auth)/login, signup          Sign-in pages
    (app)/                        Authenticated app (layout = shell + reminders)
      page.tsx                    Dashboard
      collaborations/[id]         List + detail
      tasks, calendar, payments, brands/[id], settings
    api/export                    JSON / CSV export (auth required)
    api/health                    DB health check (public, no data)
  components/                     UI (shadcn/ui in components/ui)
  lib/                            Pure, tested business logic
    money.ts  dates.ts  finance.ts  attention.ts  automation.ts  extract.ts  validation.ts
  server/                         Server-only code
    db.ts  models.ts  queries.ts  auth/  actions/  (Server Actions)
  proxy.ts                        Fast redirect for signed-out users (Next 16 "proxy" = middleware)
scripts/seed.mjs                  Optional sample data (flagged, removable)
scripts/local-db.mjs              Local MongoDB for development
```

### Data model (MongoDB)

Every document carries a `userId`, and every query filters by the signed-in user.

- **users**: email, name, bcrypt password hash, `sessionVersion`, settings (timezone, currency, followUpDays, paymentTermsDays)
- **brands**: name, `nameKey` (unique per user), contact details, notes
- **collaborations**: brand ref + name, title, contact, platforms, type, source, status, 7 key dates, embedded **deliverables[]**, currency, `amountMinor`, `receivedMinor` (recomputed), invoice fields, links, notes
- **payments**: collaborationId, `amountMinor`, currency (always the collaboration's), `receivedOn`, method, reference, notes
- **tasks**: optional collaborationId, title, dueDate, priority, done/completedAt, notes
- **activities**: timeline entries (status changes, notes, follow-ups, payments, deliverables)
- **loginattempts**: TTL collection used to rate-limit sign-in

**Money** is stored as integers in minor units (paise or cents), so there are no floating-point errors. **Calendar dates** are stored as `YYYY-MM-DD` strings. "Today" is computed in your configured timezone, so deadlines don't shift across midnight or DST.

**Why MongoDB?** You asked for it, it fits the document shape (embedded deliverables), and the Atlas free tier is enough for one creator. The tradeoff is that there are no multi-document transactions here: balances are recomputed from payment records after every change rather than incremented, so they self-correct.

### Security

- A custom email/password login: bcrypt (cost 12) with a signed, httpOnly, `SameSite=Lax` JWT cookie (30 days). `sessionVersion` signs out all devices after a password change.
- Every Server Action and Route Handler re-checks the session against the database. The proxy only provides a fast redirect.
- Sign-up is open only while no account exists, or if `ALLOW_SIGNUPS=true`. Sign-in is rate-limited (5 failed attempts locks the account for 15 minutes).
- All input is validated with Zod on the server. Links must be `http(s)` (no `javascript:` URLs). Search input is regex-escaped. CSV export guards against formula injection.
- The MongoDB URI and secrets are only read on the server. Logs never include request payloads or financial data. Security headers are set in `next.config.ts`.

---

## Local setup

**Requirements:** Node.js 20.9+ (24 recommended) and npm.

```bash
npm install
cp .env.example .env.local      # Windows PowerShell: Copy-Item .env.example .env.local
```

Fill in `.env.local`:

```bash
MONGODB_URI="mongodb+srv://..."           # Atlas (see below), or the local DB below
AUTH_SECRET="<48 random bytes>"           # node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Option A: Local MongoDB (no account needed)

```bash
npm run db:local        # keep running in its own terminal; data stored in .data/db
# MONGODB_URI="mongodb://127.0.0.1:27017/creatorshub"
```

### Option B: MongoDB Atlas (free M0)

1. Create an account at https://www.mongodb.com/cloud/atlas and a free **M0** cluster.
2. **Database Access** → add a user with a strong password and the *Read and write to any database* role.
3. **Network Access** → add your IP. For Vercel, add `0.0.0.0/0`: Vercel's outbound IPs change, so access is protected by the database user and password.
4. **Connect → Drivers** → copy the URI, insert the password and add the database name: `...mongodb.net/creatorshub?retryWrites=true&w=majority`.

### Run

```bash
npm run dev             # http://localhost:3000 → create your account
npm run seed            # optional: sample data, marked "Sample"
npm run seed:clear      # remove sample data (also available in Settings)
```

### Quality checks

```bash
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm test                # vitest: money, dates/timezones, payments, overdue, automations, extraction
npm run build           # production build
```

---

## Deploying (GitHub + Vercel)

1. Push to GitHub:
   ```bash
   git add . && git commit -m "CreatorsHub MVP" && git push origin main
   ```
   `.env.local` is git-ignored. Never commit it.
2. In https://vercel.com, go to **Add New → Project** and import the repository. The framework is detected as Next.js and no build settings are needed.
3. **Settings → Environment Variables** (Production and Preview): `MONGODB_URI`, `AUTH_SECRET`, and optionally `ALLOW_SIGNUPS`.
4. Deploy, open the URL and create your account (the first sign-up becomes the owner).
5. Check the deployment: `https://<your-app>.vercel.app/api/health` should return `{"ok":true,"db":"up"}`.

### Plan limits

- **Vercel Hobby** is free but limited to **personal, non-commercial use**. If CreatorsHub supports a business that earns money (yours, a team's or clients'), Vercel's terms require the **Pro** plan. Hobby also limits function duration, invocations and bandwidth. That is fine for one user, but check the current limits at https://vercel.com/pricing.
- **MongoDB Atlas M0** offers 512 MB of storage on shared resources, which is plenty for years of collaboration records. It has no automated backups, so use **Settings → Export** regularly or upgrade.
- **Cron:** Vercel Hobby cron jobs run at most once a day, which is enough for a daily reminder email if you add one later.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Missing required environment variable MONGODB_URI` | Set the variables in Vercel, then redeploy (changes apply only to new deployments). |
| `MongoServerSelectionError` / timeout | In Atlas Network Access, allow `0.0.0.0/0` (Vercel) or your IP (local). Check the user and password, and URL-encode special characters in the password. |
| `bad auth : authentication failed` | Wrong database user or password in the URI. |
| Stuck on the login page after deploying | `AUTH_SECRET` is missing or shorter than 32 characters, or it changed (old cookies become invalid). Sign in again. |
| "Sign-ups are closed" | An account already exists. Set `ALLOW_SIGNUPS=true` temporarily if you really need another one. |
| Build fails fetching Google Fonts | This is a transient network issue. Retry the build. |
| Dates look a day off | Set your timezone in **Settings**. |

---

## Roadmap

- **Phase 2 (partly done):** paste extraction ✓, brand directory ✓, calendar ✓, keyboard actions ✓, activity timeline ✓, export ✓. Next: reusable templates, bulk edit, kanban view.
- **Phase 3:** Gmail OAuth with selective import, which would reuse `extractCollaboration` and the `clientRequestId` dedupe. Optional AI extraction behind an API key. Daily digest email via Vercel Cron. Web push. Analytics.