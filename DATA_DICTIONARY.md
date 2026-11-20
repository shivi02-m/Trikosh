# Data dictionary

## Business expense details

Business transactions contain a `business` object. Write APIs accept `tax_amount` in major currency units; reads return integer minor units, consistent with the transaction's `amount`. Other fields: `invoice_reference`, `business_purpose`, `cost_center`, `employee`, `paid_by` (`company`/`employee`), `reimbursement` (`none`/`pending`/`reimbursed`), `billable` (boolean), `billable_client` and `accounting_type` (`operating`/`direct_cost`/`capital`). Employee-paid entries require an employee name; company-paid entries cannot have pending/reimbursed claims. Billable entries require a client.

Business CSV exports flatten these fields and add `net_amount` and `project_id`. Exported gross, tax and net are major-unit decimal values; gross includes tax. Reimbursement and billable totals are subsets, not additional expenses. These fields do not create reimbursement payments, invoices, revenue or tax credits.

The Business dashboard groups spend by the researched category families and by operating/direct/capital classification. All three classifications sum to total posted outflow. Forecast includes posted capital purchases but does not extrapolate them as recurring variable costs. New filter keys: `accounting_type`, `paid_by`, `reimbursement`, `billable=true|false`. Search also checks the added text fields.

Personal and Household retain separate workspace IDs but have identical planning capabilities, transaction privacy and dashboard schema.

All financial tables include `workspace_id`, referencing an authorized workspace. IDs are opaque random hexadecimal strings. Dates are ISO `YYYY-MM-DD`; audit timestamps are UTC ISO timestamps. The API stores and returns all money as **integer minor units** (100 paise per INR / 100 cents per USD, EUR / 100 pence per GBP). Forms accept amounts in major units with at most two decimals.

## CSV export

CSV values use **major currency units**, with exactly two decimal places and a separate currency code. Export includes the active month and all active transaction filters. UTF-8 BOM supports common spreadsheet readers. Text beginning with spreadsheet formula characters is prefixed with an apostrophe.

| Field | Definition |
| --- | --- |
| `id` | Stable transaction ID |
| `date` | Posted transaction date |
| `kind` | `expense` or `income`; all amounts are positive |
| `merchant` | Merchant or description |
| `category` | Workspace category name |
| `amount` | Positive major currency units, two decimal places |
| `currency` | Workspace ISO currency code |
| `payment` | Cash, UPI, debit/credit card, bank transfer, wallet or other |
| `classification` | Regular, one-time, event, emergency, gift, travel or major purchase |
| `essential` | 1 = essential; 0 = discretionary |
| `owner` | Assignment label, e.g. a household member or department; not an authorization boundary |
| `notes` | Optional transaction context |

The transaction API additionally includes `cost_type` (`fixed`/`variable`), `visibility` (`shared`/`private`/`amount-only`), `created_by`, `event_id` and `project_id`. Event/project references are validated within the current workspace. Private transactions are creator-only. Amount-only rows retain ID, date, amount and income/expense type but hide descriptive fields for other users. Filters run after redaction to avoid inferring hidden values through search. Redacted amounts are reported separately from essential/discretionary and regular/exceptional classifications when the underlying classification is hidden.

## Workspace planning and dashboard metrics

`GET /api/workspaces/{id}/dashboard?month=YYYY-MM&period=calendar|salary` provides type-specific metrics. The salary selection affects the Personal income/spend/remaining/savings-rate and fixed/variable summary; the separately labeled calendar detail section remains tied to the reporting month. Salary cycles start on a configured day from 1–28 in the selected month and end the day before that day in the next month.

`planning` supports GET/POST and PUT/DELETE by ID. Stored `workspace_items` types are constrained by workspace:

- Personal: `bill`.
- Household: `bill`, `contribution`, `dependent`, `event`.
- Business: `bill`, `department-budget`, `approval`, `policy`, `project`, `opportunity`.

Each item has workspace, type, name, minor-unit amount, ISO date, owner label, category, status, creator and timestamp. Validated extra fields store project/client, probability and approval decision metadata. Viewers cannot write. Only owners manage policy/department limits and decide pending requests. Approval decisions preserve submitted values and become immutable. Approval does not post a transaction.

- **Safe-to-spend estimate:** manually configured current-cycle opening balance + current-cycle recorded net cash flow − active bills/subscription renewals before next salary (including overdue commitments) − manually configured savings reserve. Does not include future income. Users update opening balance each cycle and mark settled bills paid; subscriptions require maintaining renewal dates.
- **Household totals:** shared owner label vs visible individual assignments, with redacted amounts separate. Contributions are separately recorded shared-pool funding and never added automatically to income. Dependent totals use assigned labels. Event totals use linked visible expenses in the selected month, compared with the event's overall budget.
- **Business commitments:** active bills/subscription renewals due in the selected month. Already-paid bills must be marked paid; subscription renewal dates must be advanced after posting. Pending approvals are excluded.
- **Business forecast estimate:** posted expenses + selected-month commitments + regular variable expense daily run rate × remaining calendar days. Fixed and exceptional actuals are not extrapolated. Business insights use the same formula for an unfiltered period.
- **Vendor costs:** aggregate posted expenses by merchant. **SaaS costs:** expenses categorized Software. Subscription registry price equivalents are separate.
- **Department budgets:** one budget per department label/month, actuals from matching expense ownership.
- **Policy flags:** posted expenses or pending requests above a configured category's per-transaction limit. Advisory; does not block or automatically approve payments.
- **Project costs:** selected-month linked expenses; project amount is a budget, not revenue. Unallocated costs are shown separately.
- **Pipeline:** open opportunities whose expected close date is in the selected month. Weighted estimate is sum(amount × manually entered probability / 100). Won opportunities do not create income transactions. No causal relationship with spend is asserted.

## Metrics

- **Expenses:** sum of filtered expense transaction amounts.
- **Income / recorded revenue:** sum of filtered income transactions. Business revenue here is cash receipts; it is not an opportunity/pipeline model.
- **Net cash flow:** income minus expenses for the filtered period. Not bank balance or accounting profit.
- **Savings rate:** `(income - expenses) / income × 100`; unavailable when income is zero.
- **Regular:** expense amount where classification equals `regular`.
- **Exceptional:** expenses minus regular expenses.
- **Essential:** expense amount where `essential` is 1. This is independent of regular/exceptional classification.
- **Budget remaining:** overall monthly budget minus expenses. No overall budget returns unavailable rather than a fabricated zero budget.
- **Category utilization:** category expenses divided by that category's monthly limit. Overall and category budgets are independent; they are not added together.
- **Forecast estimate:** regular expenses divided by elapsed days, multiplied by calendar days in the month, plus posted exceptional expenses. Past months use all calendar days. Future months have no forecast. This does not model future bills, subscriptions or events.
- **Period comparison:** current expenses vs previous-month expenses through the same elapsed day. It is not a causal explanation.
- **Subscription monthly equivalent:** active monthly prices + quarterly prices / 3 + yearly prices / 12. Annual equivalent is 12 times the rounded monthly equivalent. These are price-normalization estimates, not posted spend.
- **Goal monthly contribution:** positive unsaved balance / estimated months remaining (30.44-day months, minimum one month). Manual savings balances; no interest or investment returns assumed.

## API map

`POST /api/auth/signup`, `/login`, `/demo`; `GET /api/auth/me`; `POST /api/auth/logout`.

`POST /api/workspaces` creates a workspace owned by the current user. Workspace currency is immutable in this release.

Within `/api/workspaces/{workspace_id}/`:

| Resource | Methods | Purpose |
| --- | --- | --- |
| `overview` | GET | Reconciled period metrics, charts, budgets and transactions |
| `transactions` | GET, POST; PUT/DELETE with ID | Posted ledger CRUD |
| `categories` | GET, POST; PUT with ID | Categories and history-preserving rename |
| `budgets` | GET, POST; PUT/DELETE with ID | Unique budget per month/category |
| `subscriptions` | GET, POST; PUT/DELETE with ID | Recurring plan registry |
| `goals` | GET, POST; PUT/DELETE with ID | Personal/Household savings goals |
| `insights` | GET, POST | Rules-based explanations; POST accepts `question` |
| `export` | GET | Filtered CSV |
| `settings` | PUT | Owner-only workspace settings |
| `members` | GET, POST | Owner-only access list and granting membership |
| `audit` | GET | Recent workspace audit actions |
| `reset` | POST | Owner-only reset, restricted to demo workspaces |

Transaction/overview/export/insight filters: `month`, `category`, `kind`, `classification`, `payment`, `owner`, `q`, `from`, `to`. The interface exposes month, category, kind, classification and text search; API consumers can combine the additional filters. All criteria combine with AND. Chart drill-down preserves active filters.

Authenticated writes require `X-CSRF-Token` from `/api/auth/me` and the session cookie. The API uses 400 for validation, 401 for no session, 403 for insufficient permissions/CSRF, 404 for inaccessible or absent workspaces/records, 409 for conflicting unique data and 429 for exhausted login attempts.
