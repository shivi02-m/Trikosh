# Trikosh · Financial Intelligence Workspace

A working expense tracker presented as a **client project delivered by Trikosh**, based on the supplied `Ops_Mind_AI_Codex_Build_Specification.pdf`.

The app includes Personal, Household and Business workspaces, a responsive dashboard, secure local accounts, transactions, monthly/category budgets, subscriptions, savings goals, analytics, evidence-backed local explanations, CSV export and six-month synthetic demos.

## Run locally

Requires **Python 3.11 or newer**. No Python packages, API keys or frontend build are required.

```powershell
.\start.ps1
```

Or, with Python on your path:

```sh
python server.py
```

Open **http://127.0.0.1:8000**. Choose an account type (**Personal / Household** or **Business**) and select **Explore demo workspace**, or create an account.

On this Windows machine, the working Python interpreter is:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" server.py
```

`start.ps1` checks that location first because the default Windows Store Python alias is not usable in the current environment.

Use `python server.py --port 8080` or `./start.ps1 -Port 8080` for another port. Stop the server with Ctrl+C. Records persist in `data/opsmind.db`; restarting does not reset them.

## Deploy with Docker (VPS + your domain + automatic HTTPS)

On an Ubuntu server with Docker Engine and the Compose plugin, with your domain's `A` record pointing at the server:

```bash
cp .env.example .env        # then set DOMAIN=trikosh.com
sudo docker compose up -d --build
sudo docker compose ps      # app: healthy, caddy: running
```

Point the `trikosh.com` DNS A record to your VPS IP before starting, and preserve the existing mail DNS records for `admin@trikosh.com`. Caddy serves `https://trikosh.com`, obtains and renews the certificate, and redirects HTTP to HTTPS. Only ports 80/443 are public; the app and its SQLite database stay on the private Compose network. Records persist in the `opsmind_opsmind-data` volume. **`docker compose down -v` deletes that volume.** The full beginner guide covers GoDaddy VPS setup, SSH keys, DNS, backups/restore and updates: [DEPLOYMENT.md](DEPLOYMENT.md).

## Accounts, sign-in and workspaces

- **Sign-up** asks for an account type (**Personal / Household** or **Business**), name, a unique username (3-30 characters, case-insensitive), email and password.
- **Sign-in** is one page with an **Account type** dropdown and an email-or-username field. The server checks the selected type against the account's stored access (`account_access`). The dropdown does not grant access by itself. If the type is wrong, sign-in is refused with a message naming the correct type, and no session is created.
- **Personal / Household** accounts open **Personal** by default. The header switcher moves between **Personal** and **Household**. If the user has no household yet, a setup screen offers to create one, or shows their username so an owner can add them.
- **Personal** workspaces are owner-only and cannot be shared. **Household** owners add members by username or email (members or viewers) and can remove them. Shared household records are visible to members; private and amount-only records follow the creator's choice.
- **Business** accounts open the Business workspace. They cannot open Personal or Household workspaces, and those accounts cannot open Business workspaces.
- The **profile menu** (top right) shows username, email, account type and current workspace, plus **Log out**. Logout deletes the server session, expires the cookie, sends `Clear-Site-Data: "cache"`, clears in-browser state and returns to `/login`. Back/forward-cache restores are reloaded and re-checked.
- Accounts created before usernames existed are asked to choose one at their next sign-in. Their existing access is preserved: an older account that already owned both Personal/Household and Business workspaces keeps both.

Identity model: `users.id` is the internal key. `auth_identities(provider, subject)` maps the authentication provider's stable user ID to it. The built-in provider is `local`; an OpenID Connect provider would add rows keyed by issuer + `sub`. The username is a profile field. See [DEPLOYMENT.md](DEPLOYMENT.md#4-authentication-what-is-actually-integrated) for the GoDaddy SSO findings.

## Workspace experiences

Personal and Household use the same dashboard and capabilities; their records remain isolated. Business has its own dashboard.

- **Personal & Household:** income/spend/savings, fixed/variable costs, salary-cycle planning, bills, goals, members, contributions, dependents, events and transaction privacy in one common dashboard.
- **Business:** operating/direct/capital costs, broader expense categories, tax-inclusive tracking, vendor references, employee reimbursement, client-billable costs, departments, commitments, approvals, projects and optional pipeline.

Click **Expense categories** on the Business dashboard to browse the researched category library and start an entry. The **Business expense details** section on a transaction stores invoice reference, business purpose, cost center, included tax, payer, employee, reimbursement status and client-billable information. Business CSV exports contain these fields.

See [BUSINESS_EXPENSE_RESEARCH.md](BUSINESS_EXPENSE_RESEARCH.md) for sources, categories, field definitions and boundaries. Tax is entered manually, not calculated or classified for deductibility by the app.

## Technical design

- **Backend:** Python standard library HTTP API; SQLite with foreign keys, transactions, WAL and integer minor-unit amounts.
- **Frontend:** HTML, CSS and JavaScript, served from the Python process. No external fonts, scripts or CDN dependencies.
- **Authentication:** built-in accounts. scrypt password hashes; opaque, hashed-at-rest seven-day sessions bound to one account type; HttpOnly / SameSite cookies (Secure behind HTTPS); CSRF tokens on authenticated mutations; bounded login attempts.
- **Authorization:** every scoped endpoint checks membership, the session's account type and the workspace kind. Personal workspaces are owner-only. Owner/member/viewer roles, including server-side write restrictions. Owners can grant Household/Business access to an eligible account by username or email.
- **Analytics:** totals, category/daily charts, exports and insight evidence derive from the same transaction filters. Dates use the server's local calendar.
- **Intelligence:** deterministic server-side analysis, clearly identified in the interface. There is **no external LLM or receipt OCR integration** in this release.
- **Audit:** financial mutations include actor, workspace, action, record and UTC timestamp in the database.

The PDF's React/FastAPI/PostgreSQL stack is a recommendation. This first release uses a dependency-free stack for immediate local running while retaining workspace-aware API boundaries. The supplied PDF is product input, not an independent instruction to deploy, contact others or install integrations.

## Test

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" -m unittest discover -s tests -v
node --check static/app.js
node tests/auth-flows.cjs   # sign-up/login per account type, wrong type, switching, isolation, logout, restart
```

Optional browser verification uses Playwright and the installed Microsoft Edge browser:

```sh
npm ci
npm run test:ui
```

The browser script launches an isolated Python server and test database. Set `PYTHON_BIN` if your Python executable is elsewhere; set `BROWSER_PATH` if Edge is in another location. Browser screenshots are written to `test-results/`.

## Release boundaries

This is a **local portfolio/client-demo release**, not the entire 116-feature roadmap. See [DELIVERY.md](DELIVERY.md) for acceptance status and remaining dependencies.

The built-in HTTP server defaults to loopback. Never expose it directly to the internet. The Docker setup puts it behind Caddy (HTTPS, secure cookies, client-IP overwrite) with a persistent volume and health check. It's still Python's built-in server on a single host, with no account recovery or external monitoring; see [DEPLOYMENT.md](DEPLOYMENT.md#part-8--what-still-applies-in-production).

Household transactions support shared, private and amount-visible/details-private visibility. Private records are creator-only, including against workspace owners; amount-only records expose amount/date/type while masking merchant, category, member and notes. This is enforced across analytics, search, exports and insights. Subscriptions never charge automatically; recording a payment creates one linked expense and moves the renewal date forward. Savings balances are manually maintained and do not transfer funds. Business currently supports single-step owner decisions, category-limit advisory flags, department budgets, project allocation and manually entered opportunities. Receipt attachments, configurable multi-step approval routing, imports, XLSX/PDF reports, live bank/CRM integrations and model-backed AI remain future phases.

## Files

| File | Purpose |
| --- | --- |
| `server.py` | Python server, validation, auth, SQLite schema, demo generation and analytics |
| `accounts.py` | Account types, usernames, auth-provider identity mapping, access rules and the account migration |
| `backup_db.py` | Consistent online SQLite backup with rotation |
| `DEPLOYMENT.md` | GoDaddy hosting compatibility, database recommendation and VPS setup |
| `Dockerfile`, `compose.yaml`, `Caddyfile`, `.dockerignore`, `.env.example` | Docker deployment: app image, Caddy HTTPS proxy, volumes and settings |
| `tests/auth-flows.cjs` | Real-browser account, routing, isolation, logout and restart checks |
| `static/index.html` | Application entry point |
| `static/app.js` | Shared workspace UI and API interactions |
| `static/dashboards.js` | Shared Personal & Household dashboard, separate Business dashboard and planning forms |
| `business_expenses.py` | Researched business category library, metadata validation and tracking totals |
| `workspace_features.py` | Dashboard calculations, planning API, migrations and transaction privacy |
| `static/style.css` | Responsive light/dark design |
| `tests/test_api.py` | Isolated HTTP/database integration tests |
| `tests/browser.cjs` | Real-browser workflow and responsive checks |
| `start.ps1` | Windows startup helper |
| `DELIVERY.md` | Scope and acceptance checklist |
| `DATA_DICTIONARY.md` | Amount conventions, export fields and metrics |
| `requirements-source.txt` | Text extracted from the user-supplied PDF |

Configuration: `OPSMIND_DB` overrides the SQLite file path (default `data/opsmind.db`). `OPSMIND_SECURE_COOKIE=1` enables the Secure cookie attribute when running behind HTTPS. `OPSMIND_TRUST_PROXY=1` uses nginx's `X-Real-IP` for login throttling. Enable it only behind your own reverse proxy. Before a schema migration, the server writes a backup to `data/backups/`. Currency is fixed when creating a workspace so historical amounts are not silently relabeled.

### Simple everyday tracking

Personal and Household show a running available balance. Set salary day (1-31, clamped to month-end), a tracking start date, and the money available before transactions on that date. Available balance adds visible recorded income and deducts visible expenses from that date through today. It carries forward across salary periods. Earlier records remain in history but do not affect this balance. Old opening-balance and reserve settings are not imported into the new balance. Planned bills do not deduct money until an expense is recorded. Current salary-period income and spending are shown separately; actual salary dates do not change the configured salary day. Business remains separate.

Validate the simple flow with `node tests/running-balance.cjs`.
