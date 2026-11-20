# Delivery checklist · Trikosh client expense tracker

The supplied PDF defines a 116-feature, four-phase roadmap. This repository delivers a working local expense-management release, not every item in that roadmap. No Excel checklist was supplied. Status below references the PDF feature IDs and calls out partial acceptance explicitly.

## Current experience update

Personal and Household now share the same layout, features and privacy controls under **Personal & Household**. Business is the separate mode. Existing workspace IDs and records are preserved rather than merged.

Business now has a researched category library, invoice/receipt references, purpose, cost centers, included tax, operating/direct/capital classification, employee payer/reimbursement tracking and client-billable details. Search, filters, summary totals and CSV exports support these fields. See BUSINESS_EXPENSE_RESEARCH.md for linked sources and calculation boundaries.

## Workspace-dashboard follow-up

The earlier dashboard follow-up introduced workspace-specific coverage. The current update above supersedes its presentation: Personal and Household use one shared dashboard, while Business stays distinct. Existing synthetic workspaces are upgraded idempotently, preserving their existing financial records.

| Workspace | Delivered | Limits |
| --- | --- | --- |
| Personal | Income/spend/remaining/savings rate; explicit fixed/variable transaction field; calendar/salary-cycle summary; configurable salary day/opening balance/reserve; safe-to-spend arithmetic; editable planned bills, subscriptions, goals and source-backed local insights | Salary day 1?28; current-cycle balance/reserve are manual; no bank balance or external AI |
| Household | Shared/individual visible costs, contributions, dependent labels and costs, regular baseline, editable events with transaction links, upcoming school/insurance bills, family goals, creator-private and amount-only transaction visibility enforced in APIs | Dependents use assignment labels; contributions are a separate shared-funding ledger; amount-only retains amount/date/type |
| Business | Operating spend, monthly department budgets, posted/committed/run-rate forecast, vendor and software costs, pending-request queue with owner decisions, category-limit flags, project/client allocation, optional manual opportunity pipeline | Single-step owner workflow; no receipt attachment or automatic posting; advisory policies; manual CRM inputs and probabilities |

These additions implement the workspace-specific dashboard emphasis requested in the PDF. They do not imply that all advanced features in the 116-item roadmap are complete.

## Implemented scope

| PDF IDs | Status | Delivered behavior |
| --- | --- | --- |
| CORE-001 | Implemented | Sign-up, password sign-in, logout, scrypt hashes, protected sessions, login throttling and CSRF checks |
| CORE-002 / CORE-003 | Implemented | Create Personal/Household/Business workspaces and switch without signing in again |
| CORE-004 / CORE-010 | Implemented | Owner/member/viewer authorization and workspace/record isolation on the server; owner grants existing-account access |
| CORE-006 | Partial | Responsive light/dark theme saved per browser, not in user profile |
| CORE-007 | Implemented | Responsive desktop/tablet/mobile shell, scrollable tables, accessible forms/dialog focus management |
| CORE-011 | Implemented for local scope | No bundled secrets or API keys; no AI secrets required or exposed |
| CORE-012 | Implemented | Actor, timestamp, workspace, action and affected-record audit storage |
| EXP-001 / EXP-002 | Implemented | Add, edit and delete expenses or income; amount/date/merchant/category/payment/notes form |
| EXP-003 | Partial | Default/custom categories with rename propagation; nested subcategories deferred |
| EXP-005 | Partial | Standard payment methods and Other; named custom methods deferred |
| EXP-006 / EXP-007 | Implemented | Regular/exceptional and essential/discretionary classification with reconciled analysis |
| EXP-012 | Partial | Combined month/category/type/classification/text filters; API additionally supports owner/payment/date bounds; amount/event filters deferred |
| BUD-001 / BUD-002 / BUD-003 | Implemented | Overall and category monthly budgets, actual/remaining values and utilization status |
| SUB-001 / SUB-003 / SUB-006 | Implemented | Subscription registry, active/paused/cancelled states, dated renewal list and normalized costs |
| GOAL-001 / GOAL-002 | Implemented | Savings target/date/manual balance and estimated required monthly contribution |
| BI-001 / BI-002 / BI-003 | Partial | Reconciled period KPIs, category/daily charts, budget actuals, ownership and expense classifications; not all PDF dimensions/visualizations |
| BI-005 / BI-007 | Implemented for delivered visuals | Category drill-down, insight record drill-down and documented formulas |
| REP-001 | Implemented | Active-filter CSV export with stable fields and spreadsheet formula escaping |
| DEMO-001 / DEMO-005 | Implemented | Six-month personal synthetic demo; explicit labeling and owner-only reset restricted to demo data |

## Partial features and simplifications

| PDF IDs | What works | Remaining acceptance criteria |
| --- | --- | --- |
| CORE-005 | Workspace currency selected during creation | Per-user locale/date preferences, salary/fiscal cycle and notification settings |
| CORE-008 / CORE-009 | All-date transaction search and Ctrl/Cmd+K shortcuts | Search across every entity, complete command palette |
| PER-001 / PER-002 | Personal workspace creation, base budget, income/expense dashboard | Full income/rent/EMI/dependent onboarding; fixed/variable classifications, bills and salary planning are now implemented |
| HH-001 / HH-002 | Editable member labels and shared/member expense assignments | Structured adults/children/dependents/earners, separate paid-by dimension and dedicated member entities |
| BUS-001 / BUS-002 / BUS-003 | Business workspace, industry/department labels, base budget, receipt income and department spending | Fiscal-year model, structured department membership and configurable routing; commitments and single-step owner approvals are now implemented |
| AI-005 / AI-006 | Server-side grounded local questions, explanations and linked source records | Model-backed natural-language coverage and full change-driver explanation |
| BUD-005 / BUD-006 | Labeled daily-run-rate estimate and budget-risk insight | Business forecast now combines posted costs, dated bills/subscription commitments and variable run rate; configurable risk alerts remain deferred |
| DEMO-002 / DEMO-003 / DEMO-004 | Six-month household/business financial data with exceptional-spend and budget scenarios | Household events/school models, vendor/SaaS seats, approvals, comprehensive AI scenarios |

## Deferred PDF scope

The following features are not presented as complete:

- **Expenses:** tags, recurring rules, receipt/invoice attachments, CSV/Excel import, mapping, duplicate detection.
- **AI:** learned categorization, receipt extraction, robust anomaly detection, generated reports, insight inbox lifecycle, model-backed chat, scenario planning and subscription overlap detection.
- **Household:** separate paid-by/expense-owner dimensions, structured age/relationship data, year-over-year event comparisons and a full calendar UI. Transaction privacy, contributions, dependent cost labels and event budgets/links are now implemented.
- **Business:** receipt-backed submissions, configurable multi-step approvals, advanced policy routing, vendor contract registry, SaaS seats, profitability and headcount analytics. Basic request decisions, category-limit flags and project allocation are implemented.
- **Reporting:** XLSX/PDF exports, report library, saved BI views, full advanced visualization collection.
- **Planning:** full calendar UI, recurring bill generation, purchase scenarios and configurable alerts. Dated planned bills, salary-cycle summaries and a clearly labeled safe-to-spend estimate are implemented.
- **Integrations:** accounting imports, source batch metadata, banks, CRM/revenue pipeline/GTM and external provider connections.

## Architecture and operational dependencies

The PDF recommends React/TypeScript, FastAPI and PostgreSQL. This local release uses plain JavaScript plus Python's standard library and SQLite to run without package downloads. Python owns all financial calculations, authentication, validation and persistence. No frontend-only financial store substitutes for backend persistence.

For production, move serving to a maintained production framework/application server, add HTTPS/reverse proxy configuration, migrations, backup/restore, managed storage, deployment abuse prevention, account verification/recovery and monitoring. Add provider credentials only on the backend when implementing external AI. Household privacy is now enforced in the transaction query layer before detail filtering or aggregation.

## Verification

- Twenty-one Python HTTP integration tests cover sessions, CSRF, role restrictions, cross-workspace reads/writes, exact minor-unit calculations, filters/export parity, formula injection protection, validation, category history, subscriptions/goals, grounded evidence and demo reset isolation. Added cases cover unified Personal/Household capability parity, business expense metadata/validation/export reconciliation, salary arithmetic, overdue commitments, private/redacted isolation across surfaces, event/dependent/contribution reconciliation, approval authorization and immutable decisions, project/policy/pipeline calculations, allocation isolation and idempotent demo upgrades.
- JavaScript syntax checked with Node.
- Real-browser workflow checks passed in Microsoft Edge through Playwright: transaction creation/edit/persistence and filtered CSV downloads; budgets/subscriptions/goals; questions and evidence; settings; all three workspace types; theme toggle; mobile expense entry; fresh-account sign-up/onboarding/sign-in. No browser runtime errors were recorded.
- Responsive overflow checks passed at 1440px desktop and 768px, 390px and 360px widths. Screenshots are saved in `test-results/`, including desktop, mobile, Business, Analytics, sign-in and dark mode.

## Suggested next delivery batches

1. Finish Phase 1 onboarding/entity gaps: structured member/department models and complete workspace profile preferences.
2. Add secure attachments, import preview/deduplication, structured events, XLSX and the business approval workflow.
3. Add forecast commitments, an external AI provider behind the current evidence-scoped API, receipt review, anomaly explanation and PDF reports.
4. Add saved views, scenarios, advanced business/GTM integrations and production deployment hardening.
