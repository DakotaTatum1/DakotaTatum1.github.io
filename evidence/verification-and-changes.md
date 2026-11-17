# Verification, change, and retest log

## Snapshot package results

| Company measure | Oct. 9 baseline | Oct. 16 update | Oct. 23 defense |
|---|---:|---:|---:|
| Revenue | $37,000 | $41,000 | $41,000 |
| Gross profit | $14,800 | $16,400 | $16,400 |
| Net income | $10,000 | $10,600 | $10,300 |
| Ending cash | $116,200 | $120,800 | $120,300 |
| Accounts receivable | $39,000 | $38,000 | $35,500 |
| Inventory | $37,800 | $37,900 | $37,900 |
| Accounts payable | $29,000 | $32,100 | $32,400 |

## What changed and why

### October 9 to October 16

- Revenue increased $4,000. Utica's $5,000 delivered credit sale was added; Scranton's controller correction reduced the earlier recognized sale by $1,000.
- Gross profit increased $1,600. The additional Utica sale created $2,000 gross profit, while the Scranton correction reduced gross profit by $400.
- Net income increased $600 after the additional sale, Scranton utility accrual, and Nashua delivery expense were included.
- Ending cash increased $4,600 because later supported customer receipts exceeded the later operating cash outflows.
- The confirmed amount for Utica's October 8 utility service was still unavailable at October 16, so it remained an unresolved unquantified item in that package.

### October 16 to October 23

- Revenue and gross profit did not change because no additional delivered sale was supported.
- Net income decreased $300 when Utica's utility service amount was confirmed and accrued.
- Ending cash decreased $500: Scranton's $3,000 equipment purchase was partly offset by Utica's $2,500 customer receipt.
- Receivables decreased $2,500 because the Utica receipt settled part of U-101.
- Accounts payable increased $300 from the confirmed Utica utility accrual.

## Control checks performed

- Balance-sheet equation difference equals $0 for every branch and company at all three cutoffs.
- Cash-flow ending cash less balance-sheet cash equals $0 for every branch and company at all three cutoffs.
- Company revenue, net income, and total assets equal the sum of Scranton, Utica, and Nashua.
- All recognized journal rows name both a debit and credit account.
- Current October 23 package passed a 40-relationship independent statement tie-out review.

## Investigated issue and retest

**Issue:** The first snapshot-generation pass retained late table rows and compared spreadsheet timestamps rather than business-calendar dates. That could have allowed post-cutoff activity into an earlier package.

**Check performed:** The snapshot ledger was inspected for row count, latest business date, the presence of U-UTIL, and the reported S-101 amounts.

**Fix:** The generator now deletes imported Excel tables before writing filtered rows and compares ISO business dates, not timestamps.

**Retest:** October 9 contains 24 recognized entries, has no U-UTIL entry, has no business date later than October 7, and uses the original S-101 amounts of $12,000 revenue and $7,200 cost. October 16 contains 30 recognized entries, has no U-UTIL entry, has no business date later than October 15, and uses the corrected S-101 amounts of $11,000 revenue and $6,600 cost. Both packages pass every financial control.

## Further-source handling demonstrated

- **New supported event:** U-102 was recognized in the October 16 package because delivered goods and a supported cost were available.
- **Repeated evidence:** N-CS1-FWD was retained as duplicate evidence and did not create a second sale, cash receipt, or inventory release.
- **Correction:** S-101 was originally reported at $12,000 revenue and $7,200 cost, then replaced by the supported $11,000 revenue and $6,600 cost correction.
