# 💰 AI Money Manager — Full Project Plan
> Personal Finance Assistant · Vercel + Supabase Edition

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React + Vite + Tailwind | Fast, PWA-ready |
| UI Components | shadcn/ui | Clean, dark-mode native, mobile-friendly |
| Backend | Vercel Serverless Functions (Python) | No server to manage |
| Auth | Supabase Auth (Google OAuth) | Gmail login, zero extra setup |
| Storage | Supabase (PostgreSQL) | Free tier, built-in auth, easy querying |
| PDF Parsing | pdfplumber (Python) | Best for table extraction |
| AI Insights | Claude API | Natural language summaries |
| Hosting | Vercel | Free tier, HTTPS out of the box, auto-deploy |
| PWA | vite-plugin-pwa | Installable on phone, offline cache |

---

## Database Schema

```sql
users
  id, google_id, email, created_at

accounts
  id, user_id, bank_name, account_type, current_balance, currency

transactions
  id, account_id, date, description, amount, type (debit/credit)
  category, source (pdf/manual), raw_text, created_at

budgets
  id, user_id, category, monthly_limit, month

savings_goals
  id, user_id, name, target_amount, current_amount, deadline

categories
  id, name (food, transport, bills, entertainment, shopping, health, etc.)
```

---

## Features

### 1. Authentication
- Gmail login via Google OAuth (Supabase Auth)
- Auto-create user profile on first login
- Session persists on PWA (no re-login every time)

### 2. Data Ingestion

**PDF Parser (primary for statements)**
```
PDF Upload (web UI)
    ↓
Bank Detector (identify bank by header/keywords)
    ↓
Bank-Specific Parser
    ↓
Normalizer → Unified Transaction Schema
    ↓
Duplicate Checker
    ↓
Supabase Insert
```

Supported banks (in build order):
| Bank | Priority |
|------|---------|
| Public Bank | Phase 2 |
| TNG eWallet | Phase 4 |
| AEON Bank | Phase 4 |
| Maybank | Phase 4 |
| CIMB | Phase 4 |

Each bank = one parser class extending `BaseBankParser`. Adding a new bank = add one class, no touching existing code.

**Manual Entry (fallback)**
- Quick-add form in the PWA

### 3. Categorization
- Rule-based first (keyword matching — fast, free)
- Claude API fallback for unknown merchants
- User can correct category → saved as override rule

### 4. Budgeting
- Set monthly budget per category
- Visual indicator at 80% and 100% usage
- View remaining budget per category

### 5. Savings Goals
- Create goal with name, target amount, and deadline
- Auto-calculate required monthly contribution
- Progress bar tracking

### 6. AI Insights (Claude API)
- Chat widget in the app
- Example queries:
  - "Summarize my spending this month"
  - "Where can I cut back?"
  - "Am I on track for my savings goal?"
  - "How does this month compare to last month?"
- Claude queries Supabase data, responds in natural language

### 7. Dashboard
- Monthly income vs expense (bar chart)
- Spending by category (donut chart)
- Daily spending trend (line chart)
- Savings goal progress bars
- Built with Recharts (no Grafana needed)

---

## Mobile PWA

- **Install prompt** — user can add to home screen on Android/iOS
- **Mobile-first design** — built for 375px width, scales up
- **Dark mode** — default, finance dashboards look better dark
- **Design tokens** — Inter font, zinc/slate palette, indigo accent
- **Bottom nav bar** — Home, Transactions, Budget, Goals
- **Large tap targets** — min 44px for all interactive elements
- **Offline support** — cached data viewable without internet

---

## UI Design Rules

- Use **shadcn/ui** only — no mixing component libraries
- Numbers always **right-aligned**
- **Red/green** reserved strictly for negative/positive amounts only
- No decoration that doesn't help understand money faster
- Each screen answers one question (e.g. "How much did I spend this month?")

---

## Build Phases

### Phase 1 — Foundation
- [ ] Supabase project + schema setup
- [ ] Google OAuth (Gmail login)
- [ ] React PWA skeleton (Vite + shadcn/ui + Tailwind)
- [ ] Manual transaction entry form
- [ ] Basic summary view
- [ ] Deploy to Vercel

### Phase 2 — PDF Parsing (Public Bank)
- [ ] `BaseBankParser` abstract class
- [ ] Public Bank parser
- [ ] PDF upload via web UI
- [ ] Duplicate detection
- [ ] Auto-categorization (rule-based)

### Phase 3 — Budgeting & Goals
- [ ] Budget CRUD in web UI
- [ ] Savings goal tracking
- [ ] Visual progress indicators

### Phase 4 — More Banks
- [ ] TNG eWallet parser
- [ ] AEON Bank parser

### Phase 5 — AI Layer
- [ ] Claude API integration
- [ ] AI chat widget in app
- [ ] Smart categorization fallback

### Phase 6 — Dashboard
- [ ] Recharts dashboard
- [ ] Monthly, category, and trend charts

---

## Hosting Architecture

```
Vercel
├── React PWA (frontend)
└── Serverless Functions (Python backend + PDF parsing)

Supabase (cloud, free tier)
├── PostgreSQL database
└── Google OAuth auth
```

No servers to manage. Deploy via git push.

---

## Unified Transaction Schema

```json
{
  "date": "2025-01-15",
  "description": "McDonald's Sunway",
  "amount": -12.50,
  "type": "debit",
  "category": "food",
  "bank": "public_bank",
  "account": "savings",
  "source": "pdf"
}
```

---

## Notes

- **Open Banking in MY** — BNM Open Finance framework targets 2027 for large banks, 2029 for TNG. Plan PDF parsing now, add API layer later without rearchitecting.
- **Email parsing** — most MY banks no longer send per-transaction emails. Not viable.
- **TNG has no personal data API** — only merchant-facing payment APIs exist.
- **PDF formats can change** — parsers should be versioned and easy to update per bank.
- **Vercel PDF timeout** — free tier has 10s function timeout. Normal bank statements are fine. Upgrade to Pro (60s) if needed.
