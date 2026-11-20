# Business expense tracking: research and implementation

Researched on 27 September 2026. The app now has two product experiences: **Personal & Household** and **Business**. Existing Personal and Household workspace IDs remain separate for data isolation, but both use the same dashboard, features and controls. The sidebar workspace selector chooses the actual set of records.

## Research sources

1. [Xero — business expense software](https://www.xero.com/us/accounting-software/business-expenses/): examples of rent, utilities, payroll, marketing, professional services, travel, equipment and software; categorization, supporting records and department/project analysis.
2. [Zoho Expense — expense API](https://www.zoho.com/expense/api/v1/expenses/): expense date, merchant, currency/payment, reimbursement eligibility, customer/project allocation, billable status, tax-inclusive totals and configurable fields.
3. [IRS — Publication 334, Business Expenses](https://www.irs.gov/publications/p334): additional examples used to broaden the tracking library, including employee benefits, insurance, rent, travel, bank fees, education, licenses, repairs and supplies. This US reference is used only for category examples, not as tax guidance for the user's jurisdiction.

The app's categories and fields are an implementation synthesis, not a copy of any provider's complete schema. No tax rates or deduction eligibility rules are inferred from these sources.

## Included category library

| Group | Categories |
| --- | --- |
| People & professional services | Payroll; employee benefits; contractors; recruitment; training & development; professional services; legal & accounting |
| Premises & administration | Rent & lease; office; office supplies; utilities; internet & phone; repairs & maintenance; cleaning & security; insurance |
| Technology & equipment | Software; cloud hosting; IT support; equipment & hardware |
| Sales & customer delivery | Marketing; sales commissions; travel; accommodation; business meals; vehicle & fuel; shipping & delivery |
| Production & finance | Inventory & materials; packaging; bank & payment fees; interest & finance charges; licenses & permits; taxes & statutory fees; other |

Revenue is kept as an income category. Existing custom categories remain available. New defaults are added to existing Business workspaces once; subsequent restarts preserve renamed categories.

## Tracked fields

- Existing: date, gross amount/currency, vendor/merchant, category, payment method, department, project/client reference, notes and fixed/variable behavior.
- Added: invoice/receipt reference, business purpose, cost center, included tax amount, operating/direct-cost/capital classification, company/employee payer, employee name, reimbursement status, client-billable flag and client to bill.
- Search also covers invoice reference, purpose, cost center, employee and client. Business filters include cost classification, reimbursement status and client-billable status. CSV export carries the new fields and a calculated net amount.

## Amount rules and boundaries

The entered total is gross and already includes the entered tax. Tax cannot exceed the total. Net amount = total − included tax. Tax is never added a second time to expense totals. Tax amounts are recorded manually; there is no automatic GST/VAT calculation, eligibility decision or tax return.

Operating expenses, direct costs/materials and capital purchases partition the recorded outflow. Capital purchases are excluded from the extrapolated variable spending run rate, while the actual payment remains part of total recorded outflow. This is cash tracking; inventory valuation, depreciation, amortization and accounting profit are not calculated.

Reimbursement and billable totals are subsets of existing expense records. Marking an expense reimbursed does not create a second expense. Billable expenses do not generate invoices or revenue automatically. Invoice/receipt reference is a text identifier, not a receipt-file attachment. Mileage rates, line-item receipts, exchange rates and jurisdiction-specific tax rules remain outside this release.

## Verification

Automated API tests cover combined Personal/Household capabilities and privacy, category migration, business field validation/persistence, gross/net/tax math, operating/direct/capital reconciliation, reimbursement and billable filters, search and CSV parity. Browser tests exercise the category library, employee-paid billable expense entry, company-paid capital purchases, edit persistence, exports and mobile layouts.
