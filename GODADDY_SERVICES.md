# GoDaddy Services — What to Buy (Budget: $25)
### Trikosh Hackathon Setup Guide

---

## Competition gives you FREE ✅

The hackathon **adds this to your cart for $0** when you register:

| Service | Spec | Cost |
|---|---|---|
| **GoDaddy Docker VPS** | 4 vCPU / 8 GB RAM / 200 GB NVMe SSD | **FREE** (competition credit) |

> You do NOT need to buy a VPS. The competition provides it.
> Just check out when they add it to your cart.

---

## What YOU Buy (from your $25 credit)

| # | Service | What to Buy | Est. Cost |
|---|---|---|---|
| 1 | **Domain** | `trikosh.com` — 1 year | ~₹600–800 (~$7–10) |
| 2 | **Titan Business Email** | Pro Light plan — 1 month term | ~₹39–50/month (~$0.50–1) |
| **Total** | | | **~$8–11 of your $25** |

You will have **$14–17 left over** as backup.

---

## 5 Steps — In Order

### Step 1 — Set Up Developer Account
- Go to **developer.godaddy.com**
- Sign up / log in
- Install the **gddy CLI**:
  ```
  # On Windows (PowerShell):
  winget install GoDaddy.CLI
  
  # On Mac/Linux:
  curl -fsSL https://github.com/godaddy/cli/releases/latest/download/install.sh | bash
  ```
- Authenticate: `gddy auth login`
- Test it works: `gddy --version`
- **No payment card needed at this step**

---

### Step 2 — Get Your $25 Credit Applied
- Find your **Customer ID** on godaddy.com (click your name, top right)
- Fill the hackathon registration form with your Customer ID
- **Wait for their confirmation email before buying anything**
- After confirmation, buy everything on godaddy.com — credit is applied automatically
- Use gddy CLI to explore and manage

---

### Step 3 — Get Your VPS (FREE)
- Competition adds **4 vCPU / 8 GB RAM VPS** to your cart for $0
- Check out → your VPS appears in your GoDaddy account
- Generate an SSH key:
  ```
  ssh-keygen -t ed25519 -C "opsmindai"
  ```
- Add public key to VPS via GoDaddy dashboard
- SSH into server: `ssh root@YOUR_VPS_IP`
- Install Docker and deploy the app by following **DEPLOYMENT.md** in this project (Parts 1–4). Do not use the Ubuntu `docker.io` package or a separate nginx/certbot setup: the project's `compose.yaml` and `Caddyfile` already handle HTTPS.

---

### Step 4 — Buy Your Domain
Search first to confirm price:
```
gddy domain search trikosh.com
```

Then buy on godaddy.com (use your in-store credit):
- Domain: `trikosh.com`
- Term: **1 year** (not 3 year — you only need it for the hackathon)
- After buying, point it to your VPS. Use the commands in DEPLOYMENT.md (Part 5), which use `--type A --name @` for the root domain. Add `www` only after you've confirmed the root record works, and then set `DOMAIN=trikosh.com, www.trikosh.com` in `.env`:
  ```
  gddy dns list trikosh.com
  gddy dns set trikosh.com --type A --name @ --data YOUR_VPS_IP --dry-run
  gddy dns set trikosh.com --type A --name @ --data YOUR_VPS_IP
  ```
- Remove any AAAA record that does not point to your VPS, or visitors on IPv6 may hit the wrong server
- DNS takes 1–24 hours to work globally

---

### Step 5 — Verify the existing mailbox

`admin@trikosh.com` is already created. Test sending and receiving, and keep the mail provider's DNS records (MX, SPF, DKIM, DMARC) intact when you point the website's A records. The app does not send email or provide a contact form, so the mailbox is independent of the website.

---

## Which VPS Is Right for Trikosh?

| Spec | Competition gives you | Is it enough? |
|---|---|---|
| CPU | 4 vCPU | ✅ Way more than needed |
| RAM | 8 GB | ✅ Python + SQLite uses ~200 MB |
| Storage | 200 GB NVMe | ✅ SQLite DB will be < 1 GB |
| Traffic | Unmetered | ✅ |
| Root access | Yes | ✅ Needed for Docker |
| OS | Ubuntu 24.04 (choose this) | ✅ Matches DEPLOYMENT.md |

**Why Ubuntu 24.04?** It is the version DEPLOYMENT.md is written and tested for. When the VPS setup asks which OS to install, pick Ubuntu 24.04 LTS.

**Self-managed vs Managed?** Pick **Self-managed** — you don't need GoDaddy to manage the server for you, and it's cheaper/simpler.

---

## gddy CLI — Useful Commands

```bash
# Check domain availability and price
gddy domain search trikosh.com

# View your DNS records
gddy dns list trikosh.com

# Add/update A record (point domain to VPS); always dry-run first
gddy dns set trikosh.com --type A --name @ --data 123.45.67.89 --dry-run
gddy dns set trikosh.com --type A --name @ --data 123.45.67.89

# List your products
gddy account list

# View VPS details
gddy vps list
```

---

## Budget Summary

| Item | Cost | Paid by |
|---|---|---|
| Docker VPS (4vCPU/8GB) | FREE | Competition |
| Domain `trikosh.com` 1yr | ~$7–10 | Your $25 GoDaddy credit |
| Titan Business Email 1 month | ~$0.50–1 | Your $25 GoDaddy credit |
| SSL Certificate (Let's Encrypt) | FREE | Issued and renewed automatically by Caddy |
| **Total you spend** | **~$8–11** | Out of your $25 |
| **Leftover** | **~$14–17** | Buffer / backup |

---

## SSL Certificate (HTTPS) — Automatic via Caddy

You do NOT need to buy an SSL certificate, and you do NOT need certbot or nginx. The `caddy` service in `compose.yaml` gets a free Let's Encrypt certificate for `DOMAIN` automatically the first time the site is requested, renews it, and redirects HTTP to HTTPS.

Requirements (all handled by DEPLOYMENT.md):
- `.env` on the VPS contains `DOMAIN=trikosh.com`
- The A record for `trikosh.com` points to the VPS, and ports **80** and **443** are open
- Check with `docker compose logs caddy` after the first start; look for "certificate obtained"

---

## Checklist Before Competition Day

- [ ] gddy CLI installed and authenticated
- [ ] Customer ID shared with competition (wait for confirmation)
- [ ] VPS provisioned and SSH working
- [ ] Docker installed on VPS
- [ ] Domain bought and DNS set
- [ ] `.env` on the VPS has `DOMAIN=trikosh.com`
- [ ] App deployed: `docker compose up -d --build` (see DEPLOYMENT.md)
- [ ] Caddy obtained the certificate (`docker compose logs caddy`)
- [ ] Titan email created: admin@trikosh.com
- [ ] Test email received from outside account
- [ ] Site loads at https://trikosh.com and http:// redirects to https://
- [ ] Sign up, add a transaction, restart with `docker compose restart`, and confirm it's still there
- [ ] Confirm mail DNS records remain intact

**All 4 judging criteria met = maximum competition score.**
