# 🚀 VPS Setup Guide — Trikosh
### Step by step. No skipping steps.

> **Good news:** Your codebase already has ALL Docker files ready.  
> `Dockerfile`, `compose.yaml`, `Caddyfile`, `.env.example` — all done.  
> You just need to upload and run them.

---

## What You Need Before Starting

- [ ] Your **VPS IP address** (find it in GoDaddy → My Products → VPS)
- [ ] Your **VPS username** (usually `root` on first login)
- [ ] Your **domain name** (e.g. `trikosh.com`)
- [ ] PowerShell open on your Windows laptop

---

## PHASE 1 — Connect to Your VPS

### Step 1 — Generate SSH Key (do once)

In **PowerShell on your laptop**:

```powershell
ssh-keygen -t ed25519 -C "opsmind-vps"
# Press Enter for default file location
# Set a passphrase (or just press Enter twice for no passphrase)

# Show your PUBLIC key (copy this):
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

> ⚠️ The file WITHOUT `.pub` is your private key — never share it.

### Step 2 — Add Key to VPS

If GoDaddy asks for an SSH key during VPS setup → paste the `.pub` content there.

If GoDaddy gave you a **password** to login first:

```powershell
# Replace 123.45.67.89 with your actual VPS IP
ssh root@123.45.67.89
```

Enter the password, then run this on the VPS:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
# Paste your PUBLIC key → Ctrl+X → Y → Enter to save
chmod 600 ~/.ssh/authorized_keys
```

### Step 3 — Test SSH Login

```powershell
# From your laptop PowerShell:
ssh root@123.45.67.89
# Should log in WITHOUT asking for password now
```

---

## PHASE 2 — Prepare the VPS

Run these one by one **inside the VPS SSH session**:

### Step 4 — Update Ubuntu & Set Up Firewall

```bash
sudo apt update && sudo apt full-upgrade -y

# Firewall — MUST do in this order (or you'll lock yourself out!)
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
# Type "y" when asked

sudo ufw status
# Should show: 22, 80, 443 all ALLOW
```

### Step 5 — Install Docker

```bash
# Remove old versions if any
sudo apt-get remove -y docker.io docker-compose

# Install Docker (official method)
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Test Docker works:
sudo docker run hello-world
# Should print: "Hello from Docker!"

docker compose version
# Should show: Docker Compose version v2.x.x
```

---

## PHASE 3 — Upload Your App

Run these on your **laptop PowerShell**:

### Step 6 — Upload Files

```powershell
# Replace 123.45.67.89 with your VPS IP
# Replace "Expense tracker" path if yours is different

cd "C:\Users\ipart\OneDrive\Desktop\Expense tracker"

# Create folder on VPS
ssh root@123.45.67.89 "mkdir -p ~/opsmind"

# Upload all app files
scp Dockerfile .dockerignore compose.yaml Caddyfile .env.example server.py accounts.py workspace_features.py business_expenses.py backup_db.py root@123.45.67.89:~/opsmind/

# Upload the static folder (HTML, CSS, JS)
scp -r static root@123.45.67.89:~/opsmind/
```

> Do NOT upload: `data\`, `node_modules\`, `.npm-cache\`, any `.db` file

---

## PHASE 4 — Configure Domain + DNS

### Step 7 — Set DNS (GoDaddy Dashboard)

1. Go to **godaddy.com → My Products → Domains → trikosh.com → DNS**
2. Find the `A` record named `@`
3. Change its value to your **VPS IP address** (e.g. `123.45.67.89`)
4. Delete any `AAAA` record (IPv6) unless it's your VPS's IPv6
5. For `www`: set A record `www → 123.45.67.89` as well
6. Save changes

**Wait for DNS to work** (usually 5–30 minutes). Check from your laptop:

```powershell
Resolve-DnsName trikosh.com -Type A
# Must show your VPS IP before moving to next step
```

---

## PHASE 5 — Set Up & Launch the App

### Step 8 — Create .env File (on VPS)

SSH into your VPS, then:

```bash
cd ~/opsmind
cp .env.example .env
nano .env
```

Change this line:
```
DOMAIN=trikosh.com
```
to:
```
DOMAIN=trikosh.com
```

Press `Ctrl+X` → `Y` → Enter to save.

Secure the file:
```bash
chmod 600 .env
```

### Step 9 — Build and Start the App 🚀

```bash
cd ~/opsmind

# Check everything looks right
sudo docker compose config --quiet && echo "Config OK ✅"

# Build and start (first time takes 2-3 minutes)
sudo docker compose up -d --build
```

### Step 10 — Check It's Running

```bash
# Check container status
sudo docker compose ps
# "app" should say: healthy
# "caddy" should say: running

# Check app responds
sudo docker compose exec app python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/health').read().decode())"
# Should print: {"status": "ok", "database": "ok"}

# Check logs
sudo docker compose logs app --tail 20
# Should show: Trikosh is running at http://0.0.0.0:8000

sudo docker compose logs caddy --tail 30
# Look for: "certificate obtained successfully" (may take 1-2 min)
```

### Step 11 — Test in Browser

Open **https://trikosh.com** in your browser.

- 🔒 Padlock should be visible (HTTPS works)
- Login page of Trikosh should appear
- Create an account and test it!

---

## PHASE 6 ? Verify your email

The mailbox `admin@trikosh.com` already exists. Send a test message and reply to confirm it works. Preserve the mail provider?s MX, SPF, DKIM and DMARC records when changing website DNS.

The app does not send email, provide a contact form, or support password resets or email invitations. Creating a mailbox does not enable these features; do not add SMTP credentials until an integration is implemented.

---

## Quick Reference — Useful Commands

```bash
# Start the app
sudo docker compose up -d

# Stop the app
sudo docker compose down

# Restart after code changes
sudo docker compose up -d --build

# View live logs
sudo docker compose logs -f

# Check container status
sudo docker compose ps

# Take a database backup
sudo docker compose exec -T app python backup_db.py --keep 14
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ssh: connection refused` | VPS not ready yet, wait 2 min and retry |
| `Permission denied (publickey)` | SSH key not added, use password login first |
| `docker: command not found` | Redo Step 5 |
| App stays `unhealthy` | Run `sudo docker compose logs app` to see error |
| Caddy logs show `NXDOMAIN` | DNS not updated yet, wait and retry |
| `bind: address already in use` | Run `sudo systemctl stop apache2 nginx` |
| Browser shows "Not Secure" | Wait 2 min for Caddy to get certificate |
| Site not loading | Check `sudo ufw status` — ports 80/443 must be ALLOW |

---

## Final Checklist for Judges

- [ ] `https://trikosh.com` loads with green padlock ✅
- [ ] Can sign up and log in ✅
- [ ] `admin@trikosh.com` receives test emails ✅
- [ ] Contact form on site sends email to that mailbox ✅
- [ ] gddy CLI installed and authenticated (`gddy --version`) ✅
