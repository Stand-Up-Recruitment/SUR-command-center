# Retention labelling in JobAdder

For: Rachel (logging), Trung (build). Agreed format for the Command Centre Retention tab, 6 Oct 2026.

The tab reads JobAdder only. It looks for **`Key: value` lines** in the note types below. Put each label on its own line at the top of the note. Write the detail underneath in normal text. Spelling of the values doesn't need to be exact (for example "cold feet" works), but the key must be exactly as shown, followed by a colon.

## Statuses

| Status | Set by | Meaning |
|---|---|---|
| Permanent placement | Recruiter | Contract signed |
| Flight Confirmed | Rachel | Flights booked |
| Contract Live | 11am automation, on the start date | **Only if the placement is at Flight Confirmed.** A placement still at Permanent placement on its start date is left alone. |
| Guarantee Complete (5176) | Automation | Unchanged for now. The tab works out the 16-week guarantee itself (start date + 112 days). |
| Placement drop off | Rachel | Set it as soon as the placement falls over. The tab works out pre-start or post-start from the history. You never pick it. |

## Note: Dropoff Reason (existing type)

One primary reason per drop-off. Add the label lines to the top of the existing note, or add a new Dropoff Reason note. Either works.

```
Reason: Cold feet / buy-in
<what happened: required, specific>
```

`Reason:` must be one of the 7 categories:

| Reason | Stage | Owner |
|---|---|---|
| Cold feet / buy-in | Pre | Recruiter |
| Client pulled role | Pre | Sales (Les) |
| Skills | Post | Recruiter |
| Attitude | Post | Recruiter |
| Settling in | Post | Rachel |
| Client quality | Post | Sales (Les) |
| Family / personal | Either | None |

- "Personal circumstances" with no detail isn't accepted. The tab flags Family / personal once it goes over 20% of drop-offs.
- Add `Stage: Pre-start` **only** when JobAdder shows Contract Live but the candidate never actually started. This was the old calendar automation, for example 1012096. The tab then counts it as pre-start.

## Note: At Risk (new type, admin to create)

Log it **the same day** a client or candidate says they want out.

```
Signalled by: Client
Signal date: 2026-09-14
<the issue in one or two lines>
```

- `Signalled by:` is either Client or Candidate.
- `Signal date:` is only needed when you log it later (backfill). Otherwise the note date is used.
- The tab works out the result. You don't log one:
  - **Live rescue:** still live and inside the 16 weeks.
  - **Saved:** reached 16 weeks with no drop-off and no reduced, refunded or replacement fee outcome.
  - **Lost:** dropped after the flag.

## Note: Fee Outcome (new type, on the placement that fell over)

```
Outcome: Replacement owed
Amount lost: 0
```

- `Outcome:` is one of: Paid in full, Reduced, Refunded, Replacement owed.
- `Amount lost:` is only for Reduced or Refunded. It's the dollar amount, which adds up to "Fee lost" on the tab.

## Note: Replacement (new type, on the NEW placement)

```
Replaces: 991402
```

This is the placement ID of the drop-off it replaces. Once this note exists, that drop-off stops showing as "Replacement owed".
