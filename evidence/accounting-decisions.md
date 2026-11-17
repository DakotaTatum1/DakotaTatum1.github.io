# Consequential decision record

Student review is required before submission. This record organizes the design choices made during the project and the evidence supporting them.

## 1. Treat corrections and duplicate documents as evidence-control events

**Alternative considered:** Post each incoming document as a new transaction, then correct totals at the end.

**Choice:** Retain each document in the evidence register, post only the supported current version, and identify duplicate evidence without creating another journal entry.

**Reason:** This preserves the audit trail while preventing double counting. The Scranton controller correction replaces the original sale values, and the Nashua forwarded counter-sale note remains duplicate evidence rather than a second sale.

## 2. Keep proposals, orders, and collections separate from sales

**Alternative considered:** Treat customer interest, a collection, or a supplier payment as current-period revenue or expense because cash or a stated amount appears in a report.

**Choice:** Apply accrual accounting based on the underlying event. Delivered goods create revenue and cost of goods sold; customer collections settle receivables; supplier payments settle payables; non-binding proposals and prospective orders do not post.

**Reason:** The accounting policy requires the financial effect to follow the substance and timing of the event. This prevents the Utica equipment proposal and Nashua prospective order from overstating reported results.

## 3. Use a controlled workbook plus portable custom dashboard

**Alternative considered:** Use a manually updated Excel dashboard or a Power BI dashboard.

**Choice:** Keep the workbook as the controlled, formula-driven accounting source and use a local HTML/CSS/JavaScript dashboard as a read-only management view.

**Reason:** The workbook preserves traceability, statements, controls, and source-level detail. The portable dashboard provides company and branch communication without a paid subscription, server, or hard-coded user file path.
