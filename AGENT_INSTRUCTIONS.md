# Agent Instructions — AI Money Manager
> Pass this file along with `money-manager-plan.md` to Claude Code.

---

## Your Role

You are building a self-hosted personal finance assistant based on the project plan in `money-manager-plan.md`. Read that file fully before writing any code.

The app is hosted fully on Vercel + Supabase. No homelab, no Discord bot, no notifications.

---

## What Needs to Be Set Up

- Supabase project (operator creates at supabase.com, provides URL + anon key + service key)
- React PWA frontend (deployed to Vercel)
- Python Serverless Functions on Vercel (backend + PDF parsing)

---

## Build Order

Follow the phases in `money-manager-plan.md` strictly. Do not skip phases or build ahead.

Start with **Phase 1** only:
1. Scaffold the project folder structure
2. Set up Supabase schema (provide SQL to operator to run in Supabase dashboard)
3. Set up Google OAuth in Supabase (provide step-by-step instructions to operator)
4. React PWA skeleton with Gmail login
5. Manual transaction entry form
6. Basic summary view
7. Deploy to Vercel

Only proceed to Phase 2 after operator confirms Phase 1 is working.

---

## Project Structure to Create

```
money-manager/
├── vercel.json
├── .env.local
├── frontend/                        # React + Vite + Tailwind + shadcn/ui
│   ├── vite.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── lib/
│       │   └── supabase.ts
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Transactions.tsx
│       │   ├── Budget.tsx
│       │   └── Goals.tsx
│       └── components/
│           ├── ui/                  # shadcn/ui components
│           ├── BottomNav.tsx
│           ├── TransactionRow.tsx
│           ├── StatCard.tsx
│           └── EmptyState.tsx
├── api/                             # Vercel Serverless Functions (Python)
│   ├── parse_pdf.py
│   ├── transactions.py
│   ├── budgets.py
│   └── goals.py
└── parsers/                         # PDF parser classes
    ├── base.py
    └── public_bank.py
```

---

## Tech Constraints

- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui only. No other UI libraries.
- **Charts**: Recharts only. No Chart.js, no D3.
- **Animations**: Framer Motion only, used sparingly for page transitions and button feedback.
- **Auth**: Supabase Auth with Google OAuth only. No custom auth.
- **Database**: Supabase (PostgreSQL). No local DB.
- **PDF parsing**: pdfplumber only.
- **Python version**: 3.11+
- **Node version**: 18+
- **No Grafana** — dashboards are built with Recharts inside the PWA.
- **PWA**: must use vite-plugin-pwa.

---

## Design Rules (Non-Negotiable)

These rules must be followed on every screen, every component. Do not deviate.

### Typography
- Font: **Inter** only (import from Google Fonts)
- Size scale: **12 / 14 / 16 / 20 / 24 / 32px only** — no other sizes
- All numbers must use **tabular figures**: `font-variant-numeric: tabular-nums`
- Clear weight difference between labels (regular) and values (medium/semibold)

### Color
- **Background**: `zinc-950` (dark default)
- **Surface/cards**: `zinc-900`
- **Border**: `zinc-800`
- **Primary text**: `zinc-50`
- **Muted/label text**: `zinc-400` — use `text-muted-foreground` in shadcn
- **Accent**: `indigo-500` (#6366F1)
- **Positive amounts**: `emerald-400` — used ONLY for positive/credit values
- **Negative amounts**: `red-400` — used ONLY for negative/debit values
- **No gradients. No shadows. No other colors.**

### Spacing
- Base unit: **8px**
- Only use multiples: 8, 16, 24, 32, 48, 64
- Never eyeball spacing — always use Tailwind scale
- Generous whitespace — cramped = cheap, breathing room = expensive

### Number Formatting
Always format currency like this:
```
✅  RM 1,234.56
✅  -RM 12.50
❌  RM1234.56
❌  RM 1234.5600
❌  1234.56 RM
```
- Currency symbol + space + comma-separated thousands + 2 decimal places
- Negative amounts prefixed with `-` and shown in red
- All amount columns right-aligned

### Components
- **shadcn/ui only** — never write custom component CSS from scratch
- **Bottom navigation bar** on all authenticated screens (Home, Transactions, Budget, Goals)
- Minimum **44px tap target height** for all buttons and interactive elements
- Design for **375px width first**, then scale up

### Loading States
- **Never show a blank screen** during data fetch
- Use **skeleton loaders** that mirror the actual layout — not spinners
- shadcn/ui has Skeleton built in — use it

### Empty States
- Every screen must handle the empty/no-data case explicitly
- Show a meaningful message + a clear action button
- Examples:
  - Transactions: "No transactions yet — upload your first statement" + Upload button
  - Budget: "No budgets set — add your first budget" + Add button
  - Goals: "No goals yet — create your first savings goal" + Add button

### Micro-interactions
- Page transitions: subtle fade via Framer Motion (`initial opacity 0 → 1`, 150ms)
- Button press: scale feedback (`whileTap={{ scale: 0.97 }}`)
- Form validation: inline, real-time — never show errors only on submit
- No flashy animations — every animation should be under 200ms

### What NOT to do
- No gradients
- No box shadows (except `zinc-800` border for card separation)
- No colorful category badges — use muted text labels only
- No emojis in the UI
- No decorative elements that don't convey information
- Do not add colors to "make things pop" — whitespace does that

---

## Reference Apps (Study Before Building Each Screen)

- **Copilot Money** — best mobile finance UI, study transaction list and dashboard
- **Actual Budget** — open source, great data density patterns
- **Linear** — best-in-class dark UI, study spacing and typography

---

## Environment Variables

Ask the operator for these before starting:

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Claude API (Phase 5)
ANTHROPIC_API_KEY=

# Frontend (Vite)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Store in `.env.local`. Never hardcode credentials.

---

## Supabase Schema

Run this SQL in the Supabase SQL editor to set up the database:

```sql
-- Users (mirrors Supabase auth.users)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text,
  created_at timestamp with time zone default now()
);

-- Accounts
create table public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users on delete cascade,
  bank_name text not null,
  account_type text default 'savings',
  current_balance numeric(12,2) default 0,
  currency text default 'MYR',
  created_at timestamp with time zone default now()
);

-- Categories
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  name text unique not null
);

insert into public.categories (name) values
  ('food'), ('transport'), ('bills'), ('entertainment'),
  ('shopping'), ('health'), ('education'), ('others');

-- Transactions
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts on delete cascade,
  date date not null,
  description text,
  amount numeric(12,2) not null,
  type text check (type in ('debit','credit')),
  category text references public.categories(name),
  source text check (source in ('pdf','manual')),
  raw_text text,
  created_at timestamp with time zone default now()
);

-- Budgets
create table public.budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users on delete cascade,
  category text references public.categories(name),
  monthly_limit numeric(12,2) not null,
  month text not null,
  unique(user_id, category, month)
);

-- Savings Goals
create table public.savings_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null,
  current_amount numeric(12,2) default 0,
  deadline date,
  created_at timestamp with time zone default now()
);

-- RLS
alter table public.users enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;

create policy "users_own" on public.users for all using (auth.uid() = id);
create policy "accounts_own" on public.accounts for all using (auth.uid() = user_id);
create policy "budgets_own" on public.budgets for all using (auth.uid() = user_id);
create policy "savings_goals_own" on public.savings_goals for all using (auth.uid() = user_id);
create policy "transactions_own" on public.transactions for all
  using (account_id in (select id from public.accounts where user_id = auth.uid()));
```

---

## How to Ask the Operator for Input

When you need something from the operator, stop and ask clearly:

```
ACTION NEEDED:
- Go to supabase.com and create a new project
- Copy the Project URL and paste it here as SUPABASE_URL
- Copy the anon public key and paste it here as SUPABASE_ANON_KEY
```

Do not proceed past a blocker. Wait for the operator to provide what is needed.

---

## Definition of Done per Phase

Before marking a phase complete, verify all checkboxes:

**Phase 1**
- [ ] Gmail login works end-to-end
- [ ] User can manually add a transaction
- [ ] User can view a transaction summary
- [ ] PWA install prompt appears on mobile browser
- [ ] Deployed and accessible on Vercel URL
- [ ] All design rules applied — typography, colors, spacing, number formatting

Only then say: "Phase 1 complete. Ready for Phase 2."
