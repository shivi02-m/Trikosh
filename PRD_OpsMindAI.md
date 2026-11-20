# Trikosh — Product Requirements Document
### GoDaddy × Claude Hackathon · Simple Version

---

## What We Are Building

A financial tracker for Indian families and small businesses.
- Runs on **GoDaddy VPS**, accessed at **https://opsmindai.in**
- Three modes: **Personal**, **Household**, **Business**
- Built with Python + SQLite + HTML/CSS/JS — no external packages

---

## What Is Already Done ✅

| Feature | Status |
|---|---|
| Sign up / Sign in / Demo mode | ✅ Done |
| Personal dashboard (income, expenses, balance) | ✅ Done |
| Household dashboard (shared costs, members, dependents) | ✅ Done |
| Business dashboard (departments, approvals, projects) | ✅ Done |
| Add / Edit / Delete transactions | ✅ Done |
| Monthly budgets with progress bars | ✅ Done |
| Subscription registry | ✅ Done |
| Savings goals | ✅ Done |
| Analytics and CSV export | ✅ Done |
| "Ask Trikosh" (rule-based insights) | ✅ Done |
| Dark mode + mobile responsive | ✅ Done |
| Security (scrypt passwords, CSRF, audit log) | ✅ Done |

---

## What We Are Adding for the Hackathon

### 🔴 Must Do — Judging Checklist

These 4 things are what judges actually check. Without them, score = 0.

| # | What | How |
|---|---|---|
| 1 | **Live app on GoDaddy** | Deploy using Docker on GoDaddy VPS |
| 2 | **Your own domain with HTTPS** | Buy `opsmindai.in` via `gddy` CLI, point to VPS |
| 3 | **Email on domain** | Buy Titan Business Email → `hello@opsmindai.in` |
| 4 | **Working contact form** | Add form to website → email arrives at hello@opsmindai.in |

### 🟡 Enhancements — Make It Stand Out

These use **zero Claude credits** (pure math, no AI). Added to current website.

#### 1. RD / FD Investment Tracker *(India-specific, nobody has this)*
Under Savings Goals, add a new section:

```
🏦 RD — HDFC Bank
Monthly: ₹5,000 | Rate: 6.5% | 24 months
━━━━━━━━━━━━━━━━━━━━ 58% complete
Deposited so far:  ₹70,000
Current value:     ₹73,240
At maturity:       ₹1,28,544  (January 2028)
```

User enters: bank name, monthly amount or lump sum, interest rate, tenure, start date.
App calculates everything using standard Indian bank quarterly compounding formula.

#### 2. GST-Aware Business Expense Tracking
When adding a business expense, add a GST slab field (0% / 5% / 12% / 18% / 28%).
App auto-calculates: if you paid ₹118 at 18% → shows Taxable ₹100, GST ₹18.
Business dashboard shows total GST paid this month.

#### 3. Business Health Score
One number (0–100) on the Business dashboard. Calculated from:
- Budget discipline (are you near 75% utilization?)
- Revenue vs expense ratio
- Pending reimbursements
- Unbilled client expenses

Looks like:
```
Business Health Score: 78 / 100 🟢 Good
```

#### 4. Quick 3-Field Expense Entry *(Fixes the biggest UX problem)*
Right now the form has 10+ fields. Add a simple mode:
```
[ Amount ] [ What for ] [ Date ]  → Save
```
One tap to switch to detailed mode if needed.

---

## Phase 2 Tab (Placeholder — No Build Yet)

Add a **"Phase 2 — Coming Soon"** tab in the navigation.

It shows a simple page:
```
🚀 Phase 2 Features Coming Soon

These features are in development:

🤖 Claude AI-Powered Insights
   Ask questions in plain English about your finances

📱 UPI SMS Parser
   Paste any bank SMS → expense fills automatically

🔗 Bank Statement Import
   Upload PDF → transactions imported automatically

💡 Smart Expense Categorization
   AI suggests the right category as you type
```

**Why add this tab?** It shows judges you have a roadmap and future vision.
No code, no Claude credits — just a static HTML page rendered by JavaScript.

---

## GoDaddy Services Being Used

| Service | What It Does | Required for Judging? |
|---|---|---|
| **GoDaddy Docker VPS** | Hosts the entire app | ✅ Yes |
| **GoDaddy Domain** | opsmindai.in | ✅ Yes |
| **GoDaddy DNS** | Points domain to VPS | ✅ Yes |
| **Titan Business Email** | hello@opsmindai.in | ✅ Yes |
| **gddy CLI** | Manage all above from terminal | ✅ Yes (required by competition) |

---

## Technical Stack

```
User's browser
     ↓ HTTPS
  nginx (SSL)
     ↓
  Python 3.11 (server.py)   ← Your main app
     ↓
  SQLite (opsmind.db)       ← Your database

All running in Docker on GoDaddy VPS.
Domain bought on GoDaddy, DNS managed with gddy CLI.
Email on domain via Titan (GoDaddy product).
```

---

## Files to Create (New)

| File | What It Does |
|---|---|
| `Dockerfile` | Packages app into a container |
| `docker-compose.yml` | Runs app + nginx together |
| `nginx.conf` | Handles HTTPS and routes traffic |
| `.env.example` | Template for secret settings (safe to share) |
| `.env` | Real secrets — never committed to git |

## Files to Modify (Existing)

| File | What Changes |
|---|---|
| `server.py` | Add contact form email endpoint |
| `workspace_features.py` | Add RD/FD calculations, health score |
| `business_expenses.py` | Add GST slab support |
| `static/app.js` | Add quick entry, phase 2 tab, contact page |
| `static/dashboards.js` | Add investment panel, health score, GST panel |

---

## Winning Edge — What Judges Won't See Elsewhere

| What You Have | Why It Wins |
|---|---|
| **3 workspace modes** | Personal + Household + Business — no other hackathon entry will have all 3 |
| **RD/FD tracker** | No Indian financial app shows maturity value. Judges will say "I need this." |
| **Live on GoDaddy** | Judges open your URL on their phone. Most teams submit zip files. |
| **Indian-first design** | INR, UPI payments, GST, Indian merchant names in demo data |
| **Real security** | scrypt passwords, CSRF, audit log — most hackathon apps skip this |
| **Working tests** | 21 existing + 10 new test cases shows production mindset |
| **Phase 2 roadmap** | Shows you're building a product, not just a demo |

---

## Demo Flow (90 Seconds)

```
0:00  Open https://opsmindai.in on judge's phone
      "Live on GoDaddy — open it on your phone"

0:08  Click "Explore Demo" → dashboard loads
      "No signup needed"

0:15  Show Personal dashboard → Account balance, income, expenses, goals

0:28  Show RD/FD tracker
      "₹70,000 deposited, worth ₹1,28,544 at maturity — January 2028"
      "No app shows you this"

0:40  Switch to Business workspace
      Show Health Score: 78/100
      "One number tells you how your business is doing"

0:52  Click "Contact Us" → fill form → "Message sent ✅"
      "Email arrives at hello@opsmindai.in — Titan Business Email on GoDaddy"

1:05  Show Phase 2 tab
      "Here's our roadmap — Claude AI insights, UPI SMS parsing, bank imports"

1:20  "One Python file. Zero pip installs. Live on GoDaddy right now."
```

---

## Phase Roadmap

### Phase 1 — Hackathon (This Weekend)
- Deploy to GoDaddy Docker VPS
- Domain + HTTPS
- Titan email + contact form
- RD/FD tracker
- GST tracking
- Business Health Score
- Quick 3-field expense entry
- Phase 2 placeholder tab

### Phase 2 — After Hackathon (30 Days)
- Claude AI-powered insights (use Claude credits here)
- UPI SMS parser
- SIP (mutual fund) tracker
- EMI tracker (loans)
- Bank statement PDF import
- PWA — installable on Android

### Phase 3 — Real Product (90 Days)
- Cloud sync (multiple devices)
- GST filing report export
- Family plan (multiple users)
- Mobile app
- WhatsApp expense report sharing
