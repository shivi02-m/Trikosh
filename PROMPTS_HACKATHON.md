# Claude Prompts — Trikosh Hackathon
### Two Sets: Show Judges (A) + Build Features (B)
### No AI features. Total cost: ~$3 of $100 credits.

---

## How to Use These Prompts

**Set A** = Show judges during your presentation. Paste into Claude, show the output live.
**Set B** = Use to actually build the new features. Paste when coding.

> Use **Claude Sonnet** for all prompts. It gives better code quality.

---

# SET A — Show Judges How You Built This

*Say: "Let me show you the prompts I used to build this"*

---

## A1 — Architecture Prompt
*Show this first. Explains the whole system.*

```
I am building a financial tracker for Indian families and small businesses.
Help me design the system architecture.

Requirements:
- Python 3.11 standard library ONLY (no pip packages)
- Vanilla HTML/CSS/JavaScript (no React, no npm)
- Single command to run: python server.py
- Deploy on GoDaddy Docker VPS

Three workspace modes:
1. Personal — salary tracking, bills, savings goals, available balance
2. Household — shared expenses, member costs, dependent tracking, events
3. Business — 35+ expense categories, department budgets, employee 
   reimbursement, client billing, project tracking, approval workflow

Must include:
- Secure login (scrypt password hashing, session cookies, CSRF protection)
- SQLite database, amounts stored as integer minor units (paise)
- Mobile-responsive design with dark mode
- CSV export and analytics

India-specific:
- INR default currency, Indian number formatting (lakhs, thousands)
- UPI as payment method
- Indian GST tax slabs (5%, 12%, 18%, 28%)

Design:
1. Database tables with column names
2. API endpoints list
3. File structure
4. How login/session works step by step
```

---

## A2 — Business Expense Categories Prompt
*Show this to prove research-backed design*

```
Create a business expense category library for Indian MSMEs.

Based on research from:
- Xero business expense categories
- Zoho Expense API field structure
- IRS Publication 334 (for category examples, not Indian tax rules)

Provide:
1. Category groups (aim for 5 groups, 35+ total categories)
   Suitable for Indian businesses — payroll, rent, software, marketing, travel etc.

2. Extra fields needed per business expense beyond basic amount/merchant/date:
   - Invoice or receipt reference
   - Business purpose (what was it for?)
   - Cost center or department
   - GST amount (included in total, not added on top)
   - Who paid — company or employee?
   - If employee paid: employee name + reimbursement status
   - Is this billable to a client? Which client?
   - Type: Operating expense / Direct cost / Capital purchase

3. Validation rules:
   - If employee paid, employee name is required
   - If billable, client name is required
   - GST amount cannot exceed total amount
   - Capital purchases are excluded from monthly run-rate forecast

4. Formula for forecasting month-end spend:
   (Regular variable expenses so far ÷ days elapsed) × days in month
   + fixed expenses + exceptional/one-time expenses
```

---

## A3 — RD/FD Calculator Prompt
*Show this — it's the new feature you added*

```
Indian banks offer two savings instruments that no expense tracker supports:

RD (Recurring Deposit): Fixed monthly deposit for N months at X% annual rate.
FD (Fixed Deposit): One-time lump sum for N months at X% annual rate.

Indian banks use QUARTERLY COMPOUNDING.

Write Python functions:

1. rd_maturity(monthly_paise, annual_rate_pct, tenure_months) → dict
   
   How it works: each monthly installment grows separately.
   Month 1 deposit earns interest for (N-1) months.
   Month 2 deposit earns interest for (N-2) months. And so on.
   
   For each installment:
     quarters = months_remaining / 3
     value = installment × (1 + rate/400)^quarters
   
   Returns: maturity_value, total_deposited, interest_earned, return_pct

2. rd_current_value(monthly_paise, annual_rate_pct, tenure_months, months_paid) → dict
   Returns: current_value, deposited_so_far, interest_so_far, 
            months_remaining, completion_pct

3. fd_maturity(principal_paise, annual_rate_pct, tenure_months) → dict
   Formula: M = P × (1 + rate/400)^(tenure_months/3)
   Returns: maturity_value, interest_earned, return_pct

4. fd_current_value(principal_paise, annual_rate_pct, tenure_months, months_elapsed) → dict
   Returns: current_value, interest_so_far, months_remaining, completion_pct

Verify with example: ₹5,000/month, 6.5% annual rate, 24 months
Expected maturity ≈ ₹1,28,544

All amounts in paise (integer). Convert to rupees for display.
```

---

## A4 — Security Design Prompt
*Show this — proves you took security seriously*

```
Design authentication for a financial web application.
Python standard library only — no packages.

Implement:

1. PASSWORD HASHING
   Use hashlib.scrypt with n=16384, r=8, p=1
   Random salt: secrets.token_hex(16)
   Store as: "salt:hash" string in database

2. SESSIONS
   Token: secrets.token_hex(32)
   Store only SHA-256 hash of token in database
   Set as HttpOnly, SameSite=Lax cookie — 7 day expiry
   CSRF token: SHA-256(raw_token + "csrf") — returned in /api/auth/me response

3. CSRF PROTECTION
   All POST/PUT/DELETE require X-CSRF-Token header
   Server checks: SHA-256(session_token + "csrf") must match header

4. LOGIN THROTTLING
   Block after 5 failed attempts per hour per IP+email
   Store in login_attempts(key, attempts, expires) table

5. AUTHORIZATION
   Every workspace endpoint checks membership first
   Roles: owner, member, viewer — different write permissions
   Private transactions: only creator can see them, even workspace owner cannot

Write the Python implementation using only stdlib.
Explain which attack each measure prevents.
```

---

## A5 — Contact Form Prompt
*Show this — it's one of the 4 judging requirements*

```
Add a contact form to my Python web app that emails hello@opsmindai.in.

Requirements:
- Use Python smtplib (standard library, no packages needed)
- SMTP credentials stored ONLY in environment variables, never in code
- Works with Titan Business Email (smtp.titan.email, port 587, STARTTLS)

Add to server.py:

1. Read these env vars at startup:
   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_EMAIL

2. Function: send_contact_email(name, sender_email, message) → bool
   - Returns False silently if env vars not set (safe for local dev)
   - Sends plain text email via STARTTLS
   - Returns True on success, False on failure

3. Endpoint: POST /api/contact (no login required)
   - Validate: name required, email must have @, message required
   - Rate limit: 5 submissions per IP per hour (in-memory dict)
   - On success: return {"ok": true, "delivered": true/false}
   - On validation error: return 400 {"error": "message"}
   - On rate limit: return 429 {"error": "Too many submissions"}

The password must NEVER appear in code or git.
Show me the .env.example file (safe to commit) and the actual .env template.
```

---

# SET B — Actually Build the Features

*Use these when writing code. Paste into Claude outside the presentation.*

---

## B1 — Create Deployment Files

```
Create 4 files to deploy my Python expense tracker on GoDaddy Docker VPS.

My app: server.py (Python 3.11 stdlib), workspace_features.py, 
business_expenses.py, static/ folder (HTML/CSS/JS), data/ folder (SQLite)

Already working: python server.py --host 0.0.0.0 --port 8000

FILE 1 — Dockerfile:
FROM python:3.11-slim
WORKDIR /app
Copy these files only: server.py, workspace_features.py, business_expenses.py, 
and the static/ folder
Create /data directory for SQLite
Set env var OPSMIND_DB=/data/opsmind.db
EXPOSE 8000
CMD: python server.py --host 0.0.0.0 --port 8000

FILE 2 — docker-compose.yml:
Two services:
  app: build from Dockerfile, env from .env file, volume for /data
  nginx: nginx:alpine image, ports 80 and 443, 
         mount nginx.conf and Let's Encrypt certificate folders
         depends on app

FILE 3 — nginx.conf:
Port 80: redirect everything to HTTPS except /.well-known/acme-challenge/
Port 443: 
  SSL certificate from /etc/letsencrypt/live/opsmindai.in/
  Forward all requests to app:8000
  Add security headers (X-Frame-Options, HSTS, X-Content-Type-Options)
  Set proxy_read_timeout 30s

FILE 4 — .env.example (safe to put on GitHub):
SMTP_HOST=smtp.titan.email
SMTP_PORT=587
SMTP_USER=hello@opsmindai.in
SMTP_PASS=replace-with-your-titan-password
CONTACT_EMAIL=hello@opsmindai.in
OPSMIND_SECURE_COOKIE=1
OPSMIND_DB=/data/opsmind.db

Also add to .gitignore: .env, data/, *.db
```

---

## B2 — Add RD/FD Investment Tracker to workspace_features.py

```
Add investment tracking to my workspace_features.py file.
Here is my current file: [PASTE workspace_features.py HERE]

Add these things — do not rewrite existing code:

STEP 1 — New database table (add inside existing migrate() function):
CREATE TABLE IF NOT EXISTS investments(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('rd','fd')),
  name TEXT NOT NULL,
  bank TEXT NOT NULL DEFAULT '',
  principal INTEGER NOT NULL DEFAULT 0,
  monthly_amount INTEGER NOT NULL DEFAULT 0,
  annual_rate REAL NOT NULL,
  tenure_months INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
)

STEP 2 — Four calculation functions (add after migrate function):

def rd_maturity(monthly_paise, annual_rate, tenure_months):
  r = annual_rate / 400
  total = sum((monthly_paise/100) * ((1+r)**((tenure_months-m)/3)) 
              for m in range(tenure_months))
  deposited = (monthly_paise/100) * tenure_months
  return {
    'maturity_value': int(total * 100),
    'total_deposited': int(deposited * 100),
    'interest_earned': int((total - deposited) * 100),
    'return_pct': round((total - deposited) / deposited * 100, 2)
  }

def rd_current(monthly_paise, annual_rate, tenure_months, months_paid):
  months_paid = min(months_paid, tenure_months)
  r = annual_rate / 400
  current = sum((monthly_paise/100) * ((1+r)**((months_paid-m)/3))
                for m in range(months_paid))
  full = rd_maturity(monthly_paise, annual_rate, tenure_months)
  return {
    'current_value': int(current * 100),
    'deposited_so_far': monthly_paise * months_paid,
    'interest_so_far': int(current * 100) - (monthly_paise * months_paid),
    'months_remaining': tenure_months - months_paid,
    'completion_pct': round(months_paid / tenure_months * 100, 1),
    'maturity_value': full['maturity_value']
  }

def fd_maturity(principal_paise, annual_rate, tenure_months):
  P = principal_paise / 100
  r = annual_rate / 400
  M = P * ((1 + r) ** (tenure_months / 3))
  return {
    'maturity_value': int(M * 100),
    'interest_earned': int((M - P) * 100),
    'return_pct': round((M - P) / P * 100, 2)
  }

def fd_current(principal_paise, annual_rate, tenure_months, months_elapsed):
  months_elapsed = min(months_elapsed, tenure_months)
  P = principal_paise / 100
  r = annual_rate / 400
  current = P * ((1 + r) ** (months_elapsed / 3))
  full = fd_maturity(principal_paise, annual_rate, tenure_months)
  return {
    'current_value': int(current * 100),
    'interest_so_far': int((current - P) * 100),
    'months_remaining': tenure_months - months_elapsed,
    'completion_pct': round(months_elapsed / tenure_months * 100, 1),
    'maturity_value': full['maturity_value']
  }

def get_investments(workspace_id, db):
  from datetime import date
  today = date.today()
  rows = db.execute(
    'SELECT * FROM investments WHERE workspace_id=? AND status=? ORDER BY created_at',
    (workspace_id, 'active')
  ).fetchall()
  result = []
  for row in rows:
    r = dict(row)
    start = date.fromisoformat(r['start_date'])
    months_elapsed = max(0, (today.year - start.year)*12 + today.month - start.month)
    if r['type'] == 'rd':
      calc = rd_current(r['monthly_amount'], r['annual_rate'], r['tenure_months'], months_elapsed)
    else:
      calc = fd_current(r['principal'], r['annual_rate'], r['tenure_months'], months_elapsed)
    r['calculated'] = calc
    result.append(r)
  return result

STEP 3 — Add GET/POST/PUT/DELETE endpoints for investments to server.py:
  GET  /api/workspaces/{id}/investments → returns get_investments() result
  POST /api/workspaces/{id}/investments → adds new RD or FD
  PUT  /api/workspaces/{id}/investments/{inv_id} → update
  DELETE /api/workspaces/{id}/investments/{inv_id} → delete

Validation for POST/PUT:
- type must be 'rd' or 'fd'
- annual_rate must be between 1 and 20
- tenure_months must be between 1 and 120
- For rd: monthly_amount required and > 0
- For fd: principal required and > 0
- start_date must be valid date format
```

---

## B3 — Add Investment Panel to dashboards.js

```
In my dashboards.js, add an investment panel to the Personal and Household dashboards.

The API returns investments as JSON array with these fields:
  id, type (rd/fd), name, bank, monthly_amount (paise), principal (paise),
  annual_rate, tenure_months, start_date, status,
  calculated: { current_value, deposited_so_far, interest_so_far,
                months_remaining, completion_pct, maturity_value }

Add this function: investmentsPanel()

Display each investment as a card like this:
---
🏦 [name] — [bank]                              [Edit] [Delete]
[For RD]: ₹5,000/month · 6.5% · 24 months
[For FD]: ₹1,00,000 deposit · 7.0% · 36 months

Progress bar: ━━━━━━━━━━━━ 58%

[For RD]:
  Installments paid: 14 of 24
  Deposited so far:  ₹70,000
  Current value:     ₹73,240  (+₹3,240 interest)
  At maturity:       ₹1,28,544
  Months remaining:  10
  
[For FD]:
  Current value:     ₹1,03,553  (+₹3,553 interest)
  At maturity:       ₹1,23,144
  Months remaining:  30
---

Bottom of panel: [+ Add RD] [+ Add FD] buttons

Add openInvestmentModal(type, existing=null) function:
Fields for RD: name, bank, monthly amount (₹), interest rate (%), 
               tenure in months, start date
Fields for FD: name, bank, deposit amount (₹), interest rate (%), 
               tenure in months, start date
Common: notes (optional)

Show live preview as user types (update on every keystroke):
"At maturity: ₹1,28,544 · Interest earned: ₹8,544"

JavaScript maturity calculation (match Python formula):
function calcRD(monthly, rate, months) {
  const r = rate / 400;
  let total = 0;
  for (let m = 0; m < months; m++) {
    total += monthly * Math.pow(1 + r, (months - m) / 3);
  }
  return total;
}
function calcFD(principal, rate, months) {
  return principal * Math.pow(1 + rate/400, months/3);
}

Also add a "Phase 2 — Coming Soon" page that renders when user clicks Phase 2 nav item.
Show a simple card with 4 upcoming features:
- Claude AI Insights
- UPI SMS Parser  
- Bank Statement Import
- Smart Categorization
Each with a brief description and "In development" badge.
```

---

## B4 — Add Business Health Score to dashboards.js

```
In my businessDashboard() function in dashboards.js, 
add a Business Health Score card as the FIRST item on the page.

Score formula (0–100, calculate in JavaScript from existing dashboard data):

budget_discipline (0-100):
  utilization = operating_spend / budget_total (if budget set)
  score = 100 - Math.abs(utilization - 0.75) * 200
  clamp between 0 and 100

revenue_coverage (0-100):
  if income > 0: min(100, income / operating_spend * 50)
  else: 50 (neutral if no revenue recorded)

reimbursement_health (0-100):
  100 if no pending reimbursements
  subtract 20 for each pending reimbursement item

overall = average of all dimension scores that have data

Display as a card at the top of the business dashboard:
┌────────────────────────────────────┐
│  Business Health Score             │
│                                    │
│         78 / 100                   │
│         🟢 Good                    │
│                                    │
│  Budget     ████████░░  82         │
│  Revenue    █████████░  85         │
│  Reimburs.  ████████░░  78         │
│                                    │
│  💡 ₹X in pending reimbursements  │
└────────────────────────────────────┘

Color rules:
- 85+: 🟢 Excellent
- 70–84: 🟡 Good  
- 50–69: 🟠 Moderate
- under 50: 🔴 At Risk

The tip line shows the most urgent action based on lowest scoring dimension.
```

---

## Credit Usage

| Prompt | Purpose | Estimated Cost |
|---|---|---|
| A1–A5 (show judges) | Presentation only | ~$2.50 |
| B1 (Docker files) | Build deployment | ~$0.30 |
| B2 (RD/FD backend) | Build feature | ~$0.50 |
| B3 (Investment UI) | Build feature | ~$0.50 |
| B4 (Health Score) | Build feature | ~$0.20 |
| **Total used** | | **~$4.00** |
| **Remaining** | | **~$96** |

> **Save the remaining $96 for Phase 2** when you add real Claude AI features.
> Even then, 10,000 AI calls on Claude Haiku = ~$10. You have plenty.
