# Trikosh — Manual Test Cases
### Run these before submitting to the hackathon judges

> These are manual checks. Run them in order after deployment.
> Each test has: what to do → what should happen → pass/fail.

---

## How to Run

### Account types and workspace sign-in

1. Create an account with **Personal / Household** and a unique username. Confirm Personal opens first, and the header switcher shows Personal and Household.
2. Select **Household**. With no household yet, a setup screen appears. Create one, then switch back and forth. Records, budgets and goals stay separate.
3. Log out and create a **Business** account. Only the Business workspace is available, with no Personal/Household switcher.
4. On the sign-in page, choose the wrong account type for an account. Sign-in is refused with a message naming the correct type.
5. Open the profile menu (top right). It shows username, email, account type and current workspace. Select **Log out**, then press Back and open `/` again. The sign-in page appears; no dashboard data is shown.
6. Restart the server and sign in again. All records are still there.

Automated coverage: `tests/test_api.py`, `node tests/auth-flows.cjs` and `node tests/browser.cjs`.

1. Open `https://opsmindai.in` in your browser (or `http://localhost:8000` locally)
2. Go through each test case
3. Mark ✅ Pass or ❌ Fail
4. Fix any failures before the hackathon

---

## Judging Requirement Tests (Must Pass All 4)

---

### TEST 01 — Live App Loads on GoDaddy

**What to do:**
1. Open `https://opsmindai.in` in a browser you've never used before
2. Do NOT be logged in

**Expected result:**
- Page loads with the Trikosh login screen
- No browser security warnings (no "Not Secure" message)
- URL shows `https://` with a padlock icon
- Page loads in under 5 seconds

**Pass condition:** Login screen appears over HTTPS with no warnings ✅

---

### TEST 02 — Domain and HTTPS Certificate

**What to do:**
1. Click the padlock icon in your browser address bar
2. Click "Certificate" or "Connection is secure"
3. Check the certificate details

**Expected result:**
- Certificate issued to `opsmindai.in`
- Issued by: Let's Encrypt
- Valid (not expired)
- Try also opening `http://opsmindai.in` — it should redirect to `https://`

**Pass condition:** Valid SSL certificate, HTTP redirects to HTTPS ✅

---

### TEST 03 — Email on Domain Receives Mail

**What to do:**
1. From your personal Gmail or any other email
2. Send an email to `hello@opsmindai.in`
3. Subject: "Test email for hackathon"
4. Wait 2 minutes
5. Log in to Titan webmail at `mail.titan.email`
6. Check inbox with `hello@opsmindai.in`

**Expected result:**
- Email arrives in the Titan inbox within 2 minutes
- Subject and body match what you sent

**Pass condition:** Test email received at hello@opsmindai.in ✅

---

### TEST 04 — Contact Form Sends Email

**What to do:**
1. Open `https://opsmindai.in`
2. Find the Contact Us page (in navigation or footer)
3. Fill in:
   - Name: `Hackathon Judge`
   - Email: `judge@test.com`
   - Message: `Testing the contact form`
4. Click Send

**Expected result:**
- Page shows "✅ Message sent" confirmation
- Within 2 minutes, check `hello@opsmindai.in` in Titan webmail
- Email arrives with the name, email, and message you entered
- The SMTP password is NOT visible anywhere in the page source or URL

**Pass condition:** Form submits, email arrives, password not exposed ✅

---

## Core Feature Tests

---

### TEST 05 — Demo Mode Works Without Login

**What to do:**
1. Open `https://opsmindai.in`
2. Click "Explore Demo" button (should be on the login screen)
3. Do NOT create an account

**Expected result:**
- Dashboard loads immediately with sample data
- You can see income, expenses, and transactions
- Numbers are populated (not all zeros)
- Personal and Business workspaces are both accessible

**Pass condition:** Demo loads with data, no account needed ✅

---

### TEST 06 — Add and See a Transaction

**What to do:**
1. Enter demo mode (or sign up)
2. Click the "+" button or "Add expense"
3. Enter:
   - Amount: 500
   - What for: Lunch
   - Date: today
4. Click Save

**Expected result:**
- Transaction appears in the transactions list
- Dashboard numbers update (total expenses increases by ₹500)
- A success message briefly appears
- The transaction shows the correct amount, date, and description

**Pass condition:** Transaction saved and visible in dashboard ✅

---

### TEST 07 — Budget Progress Bar Works

**What to do:**
1. Go to the Budgets section
2. If no budget exists, add one: Category = Dining, Month = current month, Amount = ₹3,000
3. Add a Dining expense of ₹1,500
4. Go back to Budgets

**Expected result:**
- Progress bar shows 50% (₹1,500 of ₹3,000)
- Bar color is green (under 60% is green, 60-85% is yellow, over 85% is red)
- Remaining amount shows ₹1,500

**Pass condition:** Budget bar shows correct percentage and color ✅

---

### TEST 08 — Mobile Layout Works

**What to do:**
1. Open `https://opsmindai.in` on a smartphone
   OR in Chrome, press F12 → Toggle device toolbar → Select "iPhone 12" (390px wide)
2. Navigate through: Dashboard → Transactions → Budgets

**Expected result:**
- No horizontal scrolling required anywhere
- Text is readable (not too small)
- Buttons are large enough to tap (minimum 44px height)
- Navigation changes to bottom bar on mobile
- Tables scroll horizontally if needed (not cut off)

**Pass condition:** App is fully usable on a 390px mobile screen ✅

---

### TEST 09 — Business Workspace Expense with Extra Fields

**What to do:**
1. Switch to Business workspace
2. Click Add expense
3. Fill in basic fields (amount: 2000, merchant: AWS, category: Cloud Hosting)
4. Find the "Business Details" section and expand it
5. Set: Accounting type = Operating, Paid by = Company
6. Save

**Expected result:**
- Transaction is saved
- Business details are stored (not lost)
- If you edit the transaction, the Business Details fields are still filled in
- CSV export includes the business fields (invoice_reference, accounting_type etc.)

**Pass condition:** Business fields save and persist correctly ✅

---

### TEST 10 — CSV Export Downloads Correctly

**What to do:**
1. Go to Transactions page
2. Add at least 3 transactions if none exist
3. Find the Export or Download button
4. Click it
5. Open the downloaded CSV file in Excel or Google Sheets

**Expected result:**
- File downloads immediately (no error)
- File opens in Excel/Sheets correctly
- Columns include: date, merchant, category, amount, currency, payment, classification
- For Business workspace: also includes invoice_reference, accounting_type, paid_by
- Amounts are in rupees (not paise) — ₹500 shows as 500.00, not 50000
- No formula injection (cells starting with = or @ have an apostrophe prefix)

**Pass condition:** CSV downloads, opens cleanly, amounts are correct ✅

---

## Test Results Tracker

| Test | Description | Result | Notes |
|---|---|---|---|
| 01 | Live app loads on HTTPS | ⬜ | |
| 02 | Valid SSL certificate | ⬜ | |
| 03 | Email received at hello@opsmindai.in | ⬜ | |
| 04 | Contact form sends email | ⬜ | |
| 05 | Demo mode without login | ⬜ | |
| 06 | Add transaction and see it | ⬜ | |
| 07 | Budget progress bar | ⬜ | |
| 08 | Mobile layout | ⬜ | |
| 09 | Business expense extra fields | ⬜ | |
| 10 | CSV export | ⬜ | |

**Replace ⬜ with ✅ Pass or ❌ Fail as you test.**

---

## If a Test Fails

| Test | Common Fix |
|---|---|
| 01 | Check docker-compose is running: `docker-compose ps` |
| 02 | Certbot may not have run yet. Check: `docker-compose logs certbot` |
| 03 | DNS may not have propagated yet. Wait 10 minutes and retry |
| 04 | Check SMTP env vars in .env: SMTP_USER, SMTP_PASS must be set |
| 05 | Check server.py demo endpoint is working: try `curl http://localhost:8000/api/auth/demo -X POST` |
| 06 | Check browser console (F12) for red errors |
| 07 | Make sure the budget and transaction are in the SAME month |
| 08 | Add `overflow-x: auto` to any table that overflows |
| 09 | Check business_expenses.py validate() function is being called |
| 10 | Check Content-Disposition header in /export endpoint |

---

*Last updated: November 2026 · Tests written for GoDaddy × Claude Hackathon*
