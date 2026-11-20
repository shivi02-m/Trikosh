# Deploying Trikosh on a GoDaddy VPS with Docker

This guide puts Trikosh on a **GoDaddy VPS running Ubuntu 24.04**, using **Docker**. Your own domain gets **automatic HTTPS** from Caddy.

Every step says where it happens:

| Label | Where you type it |
| --- | --- |
| **[Laptop · PowerShell]** | Windows PowerShell on your own computer |
| **[VPS · SSH]** | The Ubuntu terminal you reach with `ssh` |
| **[GoDaddy dashboard]** | The godaddy.com website, signed in to your account |

Throughout, replace these placeholders with your own values:

| Placeholder | Meaning |
| --- | --- |
| `example.com` | Your domain |
| `203.0.113.10` | Your VPS's public IPv4 address |
| `deploy` | The non-root Linux user you log in as on the VPS |

**What runs where:**

```
Internet ──80/443──▶ caddy (HTTPS, certificates) ──private Docker network──▶ app:8000 (Trikosh + SQLite)
```

- Only Caddy's ports **80** and **443** are public. Port 8000 is never published.
- The database lives in the Docker volume `opsmind_opsmind-data`, mounted at `/data`.
- Certificates live in `opsmind_caddy-data`.
- Restarting or rebuilding containers keeps both volumes.

The files that make this work are already in the project:

| File | Purpose |
| --- | --- |
| `Dockerfile` | Builds the app image: Python 3.13, a non-root user (UID 10001) and a writable `/data` folder. No financial data goes into the image. |
| `.dockerignore` | Allow-list, so only the app code and `static/` are sent to the build. Databases, `.env`, tests and `node_modules` are always excluded. |
| `compose.yaml` | Defines the `app` and `caddy` services, the named volumes, restart policy and health check. |
| `Caddyfile` | Serves `{$DOMAIN}` with automatic HTTPS, proxies to `app:8000`, and overwrites `X-Real-IP`. |
| `.env.example` | Template for your `.env`. The only setting is `DOMAIN`. |

---

## Part 1 — Get the VPS

### 1.1 Claim the event VPS offer [GoDaddy dashboard]

1. Open the VPS offer link or code provided by the event, and sign in to godaddy.com.
2. Choose a **VPS** plan with **Ubuntu 24.04**. Self-managed is fine; this guide does the setup.
3. **Before paying, read the cart carefully.** Check the price charged today, the term length, the **renewal price**, and whether **auto-renew** is on. Also check that any event credit has actually been applied. This guide doesn't quote prices because they vary by offer, region and date; trust the checkout page.
4. To avoid a surprise charge, note when the term ends and decide whether to turn auto-renew off under **My Products** after purchase.

### 1.2 Set up the server [GoDaddy dashboard]

1. Go to **My Products → VPS → Set up** (wording may differ slightly).
2. Choose **Ubuntu 24.04** as the operating system.
3. Create an admin username (this guide calls it `deploy`) and a strong password. Store the password in a password manager.
4. If the setup screen offers an **SSH key** field, paste your public key from step 2.1. If it doesn't, you'll add the key after first login (step 2.2).
5. When provisioning finishes, note the server's **public IPv4 address**. Also note any IPv6 address; it matters in Part 5.

---

## Part 2 — Log in securely with an SSH key

### 2.1 Create a key pair [Laptop · PowerShell]

```powershell
ssh-keygen -t ed25519 -C "opsmind-vps"
# Press Enter to accept the default file (C:\Users\<you>\.ssh\id_ed25519), then choose a passphrase.
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub     # this PUBLIC key is the one you share
```

Never copy `id_ed25519` (without `.pub`) anywhere. That is your private key.

### 2.2 Install only the public key on the VPS [Laptop · PowerShell]

Skip this if you pasted the key during server setup. Otherwise run this, entering the VPS password once:

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | ssh deploy@203.0.113.10 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
ssh deploy@203.0.113.10        # should now log in using the key (it asks for the key passphrase, not the server password)
```

If GoDaddy only gave you `root`, log in as root once and create the user:

```bash
adduser deploy && usermod -aG sudo deploy
```

Then repeat 2.2 with `deploy`.

### 2.3 Optional: turn off password logins [VPS · SSH]

Only do this after key login works. **Keep your current SSH window open** while you test from a second window.

```bash
sudo nano /etc/ssh/sshd_config.d/99-hardening.conf
#   PasswordAuthentication no
#   PermitRootLogin no
sudo sshd -t && sudo systemctl reload ssh
```

Now open a **new** PowerShell window and run `ssh deploy@203.0.113.10`. Close the old window only once this works.

---

## Part 3 — Prepare Ubuntu

### 3.1 Updates and the firewall [VPS · SSH]

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y ufw unattended-upgrades
sudo ufw allow OpenSSH          # FIRST, so you can't lock yourself out
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp          # HTTP/3 (optional)
sudo ufw enable
sudo ufw status verbose
sudo reboot                      # if the upgrade asked for it; reconnect with ssh afterwards
```

Two things to know about the firewall:
- Docker's documentation warns that **ports published by Docker bypass ufw rules**. That's why `compose.yaml` publishes only 80 and 443, and keeps 8000 internal. Never add `ports: - "8000:8000"`.
- If your GoDaddy VPS dashboard has its own firewall or network rules, allow TCP **22**, **80** and **443** there too.

### 3.2 Install Docker Engine and the Compose plugin [VPS · SSH]

These are Docker's official apt-repository steps for Ubuntu (https://docs.docker.com/engine/install/ubuntu/). Check that page for changes before running them.

```bash
# Remove conflicting unofficial packages (it is fine if none are installed)
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove -y $pkg; done

sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo docker run hello-world          # should print "Hello from Docker!"
docker compose version               # confirms the Compose plugin
```

This guide runs every Docker command with `sudo`. Adding your user to the `docker` group would give it root-equivalent power.

---

## Part 4 — Upload the project and configure it

### 4.1 Upload only the files the server needs [Laptop · PowerShell]

```powershell
cd "C:\Users\<you>\OneDrive\Desktop\Expense tracker"
ssh deploy@203.0.113.10 "mkdir -p ~/opsmind"
scp Dockerfile .dockerignore compose.yaml Caddyfile .env.example server.py accounts.py workspace_features.py business_expenses.py backup_db.py deploy@203.0.113.10:~/opsmind/
scp -r static deploy@203.0.113.10:~/opsmind/
```

Don't upload `data\`, `node_modules\`, `.npm-cache\`, `test-results\` or any `.db` file. Your local records only move if you choose to migrate them (Part 9).

### 4.2 Create `.env` [VPS · SSH]

```bash
cd ~/opsmind
cp .env.example .env
nano .env            # set: DOMAIN=trikosh.com
chmod 600 .env
```

How the domain reaches Caddy:
1. `docker compose` automatically reads `.env` from the folder that contains `compose.yaml`.
2. `compose.yaml` passes `DOMAIN: ${DOMAIN}` into the Caddy container. If `DOMAIN` is missing, Compose stops with an error instead of starting with a blank site.
3. Caddy replaces `{$DOMAIN}` in the `Caddyfile` with that value when it starts.

The other settings are fixed in `compose.yaml`, because they are always right for this setup:

| Variable | Value | Effect in the code |
| --- | --- | --- |
| `OPSMIND_DB` | `/data/opsmind.db` | The SQLite file inside the persistent volume |
| `OPSMIND_SECURE_COOKIE` | `1` | Adds `Secure` to the session cookie, so browsers send it only over HTTPS |
| `OPSMIND_TRUST_PROXY` | `1` | The app uses the `X-Real-IP` header as the client address for login rate limiting |

**Why trusting the proxy is safe here:** the app port is not published, so the only thing that can reach it is Caddy on the private Compose network. Caddy **overwrites** `X-Real-IP` with the real connecting client's address on every request (`header_up X-Real-IP {remote_host}`), so a visitor can't fake it. Don't enable `OPSMIND_TRUST_PROXY` in any setup where the app port is reachable directly.

---

## Part 5 — Domain and DNS

### 5.1 Search and quote domains with `gddy` [Laptop · PowerShell]

`gddy` is GoDaddy's command-line tool. Quoting is free and changes nothing.

```powershell
gddy auth login                                  # opens a browser to sign in
gddy domain available example.com                # is it free, and at what listed price?
gddy domain suggest "expense tracker" --limit 10 # ideas
gddy domain quote example.com                    # price, required agreements; quote token valid ~10 minutes
```

Quoted prices **exclude taxes and fees** (such as the ICANN fee). The final total appears only at checkout.

### 5.2 Buy the domain [GoDaddy dashboard]

Buy on **godaddy.com**, not with `gddy domain purchase`, so the **event credit** can be applied:
1. Search for the domain and add it to the cart.
2. Apply the event credit or code.
3. Check the total, the term and the renewal price before paying.

Privacy protection and auto-renew are your choice.

### 5.3 Point the domain at the VPS

You can do this either in the dashboard or with `gddy`.

**[GoDaddy dashboard]** Go to **My Products → Domains → example.com → DNS**. Then:
- Edit the `A` record named `@` so its value is `203.0.113.10`. Replace GoDaddy's "Parked" value; don't add a second A record.
- Delete any `AAAA` record for `@` (and for `www` if you'll use it), **unless** it is your VPS's own IPv6 address. A stray AAAA record makes some visitors, and Let's Encrypt, try the wrong server.
- For `www`, either keep a `CNAME` `www → @`, or set an `A` record `www → 203.0.113.10`.

**[Laptop · PowerShell]** Or the same with `gddy`. Preview each change with `--dry-run` first; `set` and `delete` overwrite records.

```powershell
gddy dns list example.com                                          # review everything first
gddy dns set example.com --type A --name @ --data 203.0.113.10 --dry-run
gddy dns set example.com --type A --name @ --data 203.0.113.10
gddy dns list example.com --type AAAA
gddy dns delete example.com --type AAAA --name @ --dry-run          # only if an AAAA is NOT your VPS
gddy dns delete example.com --type AAAA --name @
```

**Check that DNS has updated [Laptop · PowerShell]:**

```powershell
Resolve-DnsName example.com -Type A      # must show 203.0.113.10 only
Resolve-DnsName example.com -Type AAAA   # should show nothing (or only your VPS's IPv6)
```

DNS changes usually appear within minutes, but can take up to the record's TTL (often 1 hour). **Wait until this shows the right IP before starting Caddy**, or the first certificate request fails.

---

## Part 6 — Start the stack

### 6.1 Build and start [VPS · SSH]

```bash
cd ~/opsmind
sudo docker compose config --quiet && echo "compose file OK"
sudo docker compose up -d --build
sudo docker compose ps                 # app should become "healthy"; caddy "running"
```

### 6.2 Check health and logs [VPS · SSH]

```bash
sudo docker compose exec app python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/api/health').read().decode())"
#   {"status": "ok", "database": "ok"}
sudo docker compose logs app --tail 50       # "Trikosh is running at http://0.0.0.0:8000"
sudo docker compose logs caddy --tail 100    # look for "certificate obtained successfully"
curl -I http://example.com                    # 308 redirect to https://
curl -I https://example.com                   # HTTP/2 200
```

Then open `https://example.com` in a browser, create an account and add a transaction.

### 6.3 HTTPS requirements and troubleshooting

Caddy gets a Let's Encrypt certificate automatically when **all** of these are true:
- The domain's `A` record points to this VPS, and there is no wrong `AAAA` record.
- Ports **80 and 443** are reachable from the internet: ufw, any GoDaddy network firewall, and no other web server already using them.
- `DOMAIN` in `.env` is exactly the hostname, without `https://`.
- Any `CAA` DNS record allows `letsencrypt.org`. Most domains have none, which is fine.

| Symptom (`docker compose logs caddy`) | Fix |
| --- | --- |
| `NXDOMAIN` / `no valid A records` | DNS not updated yet, or a typo in `DOMAIN`. Check with `Resolve-DnsName`. |
| `Timeout during connect` / `connection refused` | Port 80 or 443 blocked. Check `sudo ufw status` and the GoDaddy firewall. Run `sudo ss -tlnp` to see what's on 80/443. |
| `bind: address already in use` | Another web server (Apache or nginx) is running. Stop and disable it: `sudo systemctl disable --now apache2 nginx`. |
| `too many certificates` / `rateLimited` | Let's Encrypt rate limit. Fix the cause, then wait. Never delete the `caddy-data` volume, because it holds issued certificates. |
| Browser shows a "Not secure" warning | Look at which certificate is served, and wait for Caddy to finish. Check that you're on `https://` and the right domain. |
| `app` stays `unhealthy` | Run `sudo docker compose logs app`. Check volume permissions (Part 9.3). |

After fixing the cause, run `sudo docker compose restart caddy`.

---

## Part 7 — Your data: persistence, updates, backups

### 7.1 Where records live, and the one dangerous command

All records are in the SQLite file `/data/opsmind.db`, inside the named volume **`opsmind_opsmind-data`**. Rebuilding the image, `docker compose restart`, `up -d --build` and `down` (without `-v`) all keep it.

> **`docker compose down -v` deletes the volumes, which means all Trikosh records and your certificates.** Don't use `-v` unless you really intend to wipe everything and you have a backup.

### 7.2 Check that data survives restarts [VPS · SSH]

1. In the browser, add a test transaction.
2. Run:
   ```bash
   sudo docker compose restart app
   sudo docker compose up -d --build --force-recreate   # rebuilds and recreates containers
   ```
3. Reload the site and sign in. The transaction is still there.

### 7.3 Deploy updates without losing records

1. **[VPS · SSH]** Take a backup first (7.4).
2. **[Laptop · PowerShell]** Upload the changed files, using the same `scp` commands as 4.1.
3. **[VPS · SSH]**
   ```bash
   cd ~/opsmind
   sudo docker compose up -d --build
   sudo docker compose ps && sudo docker compose logs app --tail 30
   ```

On start, the app upgrades its own database schema without deleting anything. Before a schema change, it also writes a safety copy to `/data/backups/`.

### 7.4 Back up [VPS · SSH]

`backup_db.py` uses SQLite's online backup API and runs an integrity check, so it's safe while the app is running. **Don't just copy `opsmind.db`** while the app runs: recent changes may still be in the `-wal` file.

```bash
cd ~/opsmind
sudo docker compose exec -T app python backup_db.py --keep 14
sudo docker compose exec -T app ls -l /data/backups
mkdir -p ~/opsmind-backups
sudo docker compose cp app:/data/backups/. ~/opsmind-backups/
sudo chown -R "$USER": ~/opsmind-backups
```

To run this nightly at 02:15, open **root's** crontab with `sudo crontab -e` and add this line:

```cron
15 2 * * * cd /home/deploy/opsmind && /usr/bin/docker compose exec -T app python backup_db.py --keep 14 >> /var/log/opsmind-backup.log 2>&1
```

**Keep a copy off the server [Laptop · PowerShell]:**

```powershell
mkdir "$env:USERPROFILE\opsmind-backups" -Force
scp "deploy@203.0.113.10:~/opsmind-backups/*.db" "$env:USERPROFILE\opsmind-backups\"
```

Backups contain financial records. Keep them private, and don't email or upload them anywhere public.

### 7.5 Restore a backup [VPS · SSH]

Use a file made by `backup_db.py`. Put it at `~/opsmind/restore/opsmind.db`, then:

```bash
cd ~/opsmind
sudo docker compose exec -T app python backup_db.py --keep 14        # safety copy of the current state
sudo docker compose stop app caddy
sudo docker compose run --rm --no-deps --user root -v "$PWD/restore:/restore:ro" app sh -c '
  cp /restore/opsmind.db /data/opsmind.db &&
  rm -f /data/opsmind.db-wal /data/opsmind.db-shm &&
  chown 10001:10001 /data/opsmind.db && chmod 600 /data/opsmind.db'
sudo docker compose up -d
sudo docker compose ps
```

Removing the old `-wal` and `-shm` files is required. Leftovers from the previous database must not be applied to the restored one.

---

## Part 8 — What still applies in production

- **Server software:** the app uses Python's built-in threaded HTTP server behind Caddy. That's fine for a demo or competition, but it isn't a hardened production application server. There is no multi-process scaling.
- **Single server:** SQLite on one VPS means one machine. Backups are only as good as the copies you keep **off** the server.
- **Accounts:** there's no password reset and no email verification.
- **Invitations:** household invitations are **not** sent. No email or SMS service is configured, so contact details are only saved.
- **Monitoring:** there's no uptime monitoring or alerting beyond Docker's health check and restart policy. Consider an external uptime monitor.
- **Updates:** you're responsible for Ubuntu updates (`unattended-upgrades` helps), Docker updates, and occasionally pulling newer base images (`sudo docker compose build --pull && sudo docker compose up -d`).

---

## Part 9 — Optional: move your existing local data to the VPS

Do this once, before or shortly after first launch. The VPS copy **replaces** whatever is on the server.

### 9.1 Make a consistent copy on the laptop [Laptop · PowerShell]

1. Stop the local server with **Ctrl+C** in its window.
2. Run:
   ```powershell
   cd "C:\Users\<you>\OneDrive\Desktop\Expense tracker"
   & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" backup_db.py
   #   Backup written: ...\data\backups\opsmind-scheduled-YYYYMMDD-HHMMSS.db
   ```
3. Upload it as `restore/opsmind.db`:
   ```powershell
   ssh deploy@203.0.113.10 "mkdir -p ~/opsmind/restore"
   scp ".\data\backups\opsmind-scheduled-YYYYMMDD-HHMMSS.db" deploy@203.0.113.10:~/opsmind/restore/opsmind.db
   ```

### 9.2 Load it into the volume [VPS · SSH]

Follow **7.5 Restore a backup**. If the stack has never been started on this VPS, skip the first two commands (the safety backup and `stop`), because there is nothing to back up or stop yet. `docker compose run` creates the data volume. On first start, the app upgrades the schema if needed, keeping a pre-upgrade copy in `/data/backups/`.

### 9.3 Ownership and permissions

The app runs as UID/GID **10001**. The database must be owned by it and must not be readable by others:

```bash
sudo docker compose run --rm --no-deps --user root app sh -c 'chown -R 10001:10001 /data && chmod 700 /data && chmod 600 /data/*.db'
```

Then delete the uploaded copy so it doesn't sit around in your home folder: `rm -rf ~/opsmind/restore`.

---

## Part 10 — Hosting notes (why a VPS)

| GoDaddy product | Runs this app? | Notes |
| --- | --- | --- |
| **VPS Hosting (Ubuntu 24.04)** | **Yes. Recommended.** | Root access, Docker, persistent disk. This guide. |
| Web Hosting (cPanel), shared | Not as is | Python only via cPanel's Python Selector as a Passenger/WSGI app. This app is a long-running server, not WSGI, and Docker isn't available. |
| Managed WordPress, Websites + Marketing, Airo | No | These can't run custom Python backends. |

**Database:** keep SQLite for the competition. It needs no extra service, persists in the Docker volume, and is backed up with `backup_db.py`. Consider PostgreSQL only if you later need multiple servers or heavy concurrent writes.

---

## Appendix A — Alternative: deploy without Docker (systemd + nginx)

This was the original method. It still works, but **use the Docker method above unless you have a reason not to.** Don't run both on the same server, because both need ports 80 and 443.

Replace `example.com` with your domain.

```sh
# As root on the VPS
apt update && apt install -y python3 nginx certbot python3-certbot-nginx ufw
python3 --version                 # must be 3.11+
adduser --system --group --home /opt/opsmind opsmind
mkdir -p /var/lib/opsmind && chown opsmind:opsmind /var/lib/opsmind
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

Copy the project to `/opt/opsmind/app`. Copy `server.py`, `accounts.py`, `workspace_features.py`, `business_expenses.py`, `backup_db.py` and the `static/` folder. You don't need `node_modules`, `.npm-cache` or `test-results`.

**Move your existing data:** stop the local server, then copy `data/opsmind.db` to `/var/lib/opsmind/opsmind.db`. If you also see `opsmind.db-wal` and `opsmind.db-shm` files, stop the server first so they are folded into the main file. Copy only `opsmind.db`.

```sh
chown -R opsmind:opsmind /opt/opsmind /var/lib/opsmind
```

`/etc/systemd/system/opsmind.service`:

```ini
[Unit]
Description=Trikosh
After=network.target

[Service]
User=opsmind
WorkingDirectory=/opt/opsmind/app
Environment=OPSMIND_DB=/var/lib/opsmind/opsmind.db
Environment=OPSMIND_SECURE_COOKIE=1
Environment=OPSMIND_TRUST_PROXY=1
ExecStart=/usr/bin/python3 server.py --host 127.0.0.1 --port 8000
Restart=always
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/opsmind

[Install]
WantedBy=multi-user.target
```

```sh
systemctl daemon-reload && systemctl enable --now opsmind
journalctl -u opsmind -n 20      # expect "Trikosh is running" (+ a backup line on first migration)
```

`/etc/nginx/sites-available/opsmind`:

```nginx
limit_req_zone $binary_remote_addr zone=opsmind_auth:10m rate=10r/m;
server {
    listen 80;
    server_name example.com www.example.com;
    client_max_body_size 100k;
    location /api/auth/ {
        limit_req zone=opsmind_auth burst=10 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```sh
ln -s /etc/nginx/sites-available/opsmind /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

**DNS:** in GoDaddy **Domain → DNS**, point the `A` record for `@` (and `www`) to the VPS IP address. After DNS updates:

```sh
certbot --nginx -d example.com -d www.example.com --redirect
```

**Nightly backup** (`crontab -u opsmind -e`):

```cron
15 2 * * * OPSMIND_DB=/var/lib/opsmind/opsmind.db /usr/bin/python3 /opt/opsmind/app/backup_db.py --keep 14
```

Copy `/var/lib/opsmind/backups/` off the server from time to time, or enable GoDaddy VPS backups.

**Check:** open `https://example.com`, sign up, then run `systemctl restart opsmind` and sign in again. Your records should still be there.

---

## Appendix B — Authentication: what is actually integrated

**Built-in Trikosh accounts:** passwords are hashed with scrypt, sessions use HttpOnly, SameSite=Lax cookies (Secure behind HTTPS), mutations require a CSRF token, and login attempts are throttled. Every account has a provider identity row (`auth_identities`, provider `local`), so an external OpenID Connect provider can be added later without changing financial tables.

**GoDaddy SSO was not integrated.** GoDaddy's developer platform documents API credentials (Personal Access Tokens and keys) and OAuth only for authorizing a third-party app to call the Commerce API on a merchant's store. It doesn't document a "Sign in with GoDaddy" or OpenID Connect service for customer sign-up and login on an independently hosted application. GoDaddy account login, hosting control-panel access and Microsoft 365 from GoDaddy don't provide this either. If GoDaddy confirms a customer-identity product in writing, it can be added as another `auth_identities` provider.

**If you want hosted login later:** Auth0, Microsoft Entra External ID or Google Identity work with any HTTPS host, including a GoDaddy VPS. You would need the provider's client ID and secret on the server (environment variables, never in `static/`), a callback URL such as `https://example.com/api/auth/callback`, and an ID-token signature-verification library. This is not implemented or tested in this release.
