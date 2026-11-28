# Front desk audit: Kamra Custom vs MyCloud PMS

Date: 27 Nov 2026. Site: sr_pr (SR Continental), local build on port 8002.

**Method.** Walked the front desk as a MyCloud user: Today, quick reservation, check-in, In House, check-out, folio, tape chart, room board, cashiering, night audit, reservations, group desk, guest history, calendar, cancel/amend, management statistics, global search. Compared against the upstream Kamra demo (v2.8.3, demo.kamrapms.com) and the MyCloud screen recording of 20 Nov. Root causes were located in code; file references are in each item.

**Rules for every fix** (from our principles): change screens first; backend only as new additive reads, never overrides of Kamra functions; anything that is a Kamra bug goes upstream as an issue first, then a PR to Kamra-PMS/kamra-pms `develop`.

Severity: **P0** wrong or dangerous data at the desk, **P1** confusing or inconsistent, **P2** polish.

---

## A. Data visibility problems (fix first)

### A1 (P0). Tape chart hides overdue guests and unassigned arrivals
**What the user sees.** Room 201 shows a bar. Rooms 202, 301, 302, 402 (guests past check-out, still checked in) show as empty. The 3 arrivals today have no room, so they do not appear at all. The "Reserved 0 / Arriving today 0" counters read zero. The calendar also counts those rooms as available.
**Risk.** Staff sell an occupied room. Arrivals look like they do not exist.
**Cause.** `kamra/api.py:5820 tape_chart`: bookings must have a room (`5844`) and `check_out_date > start` (`5846`). Overrides wrapper (`kamra_custom/overrides.py:222`) only adds hover data.
**Fix.**
1. Add an additive read `kamra_custom.tape.extra_rows(start, end)` returning (a) checked-in stays whose check-out is before `start` and (b) confirmed bookings with no room.
2. In the tape patch, draw (a) as a red bar from the window start labelled "Overdue, out <date>" on its room row; add an "Unassigned" row at the top with (b) as draggable bars. Drag onto a room row opens the existing assign-room action.
3. Calendar availability: subtract overdue rooms. Same additive read.
4. Raise an upstream issue: tape chart should show overdue stays.

### A2 (P0). Departures count and tab ignore overdue guests; four screens disagree
Today card and In House "Departures" = 0. Room Board "Departing today" = 4. Management statistics "Departures today" = 5 (business date 25 Nov). House hub uses yet another query.
**Cause.** `api.py:4168` and `:281` use `check_out_date == date`; `rooms.py:130` uses `<= today`; `kamra_custom/house.py:64` uses `movement_counts` between date and date.
**Fix.**
1. Define one rule in a single TS helper (`departures.ts`): departures = checked-in with `check_out_date <= date`, split into "Due today" and "Overdue".
2. Additive read `kamra_custom.house.departures_with_overdue(date)`; use it in In House, Today card, House hub.
3. Show the overdue count as a red chip on the Departures tab ("0 today, 4 overdue"). Same words and numbers on Room Board and statistics.
4. Upstream issue for `front_desk_snapshot`.

### A3 (P0). Night audit is 2 days behind and Today does not say so
Business date is 25 Nov, calendar is 27 Nov. Nights 25 and 26 are not posted: guest zaffar (6 nights) shows 1 night on the folio, revenue is 0, "Revenue ₹0, no room charges posted". Only Management statistics and the House hub warn.
**Cause.** `Today.tsx:620` calls the snapshot with no date and has no banner. Banner code exists in `HouseHub.tsx:103`.
**Fix.** Reuse the HouseHub banner as a shared `AuditBehindBanner` component at the top of Today, In House, Cashiering, Tape chart ("Night audit is 2 days behind. Charges for 25 and 26 Nov are not posted. Open night audit"). Disable "Close & generate invoice" with a clear reason when unposted nights exist, or show the full-stay total (the checkout dialog already explains this, see B3).

### A4 (P0). Security deposit shows "taken" while ₹0 is held
Check-in screen: Required ₹5,000, Held ₹0, yet green text "Security deposit is taken." and the Checks box says "No advance or deposit paid".
**Cause.** `ExpressCheckIn.tsx:320` shows it when `deposit.satisfied`. `deposit.py:418` returns true when the row's `required_amount` is 0 while the status is still "Required".
**Fix.** In the screen, show the message only if `held >= required && required > 0`; otherwise show amber "₹5,000 still to collect". Check the policy row and data: if the booking carries a policy of ₹5,000, backend must not store `required_amount = 0`. Upstream issue with the repro.

### A5 (P1). Guest duplicates
Guest History has "ameer" twice, "ateeq" with and without phone. Cancel/Amend lists show three "ameer" bookings.
**Cause.** `api.py:7003 _find_or_create_guest`: no phone means no lookup, always inserts a new guest.
**Fix.**
1. Booking dialog: when the name matches an existing guest and no phone is typed, show "Same name exists: ameer +91 73… Use this guest?" with a one-tap choice. Frontend-only using the existing search in `guests.py:61`.
2. Make phone required for new guests in the quick reservation (already validated when typed; empty is allowed today). Keep walk-in exception with a reason.
3. Add a "Merge guests" action on Guest History (read duplicates by phone key; merge by Kamra's native merge call if present, otherwise upstream issue).

### A6 (P1). Stale confirmed bookings stay in the lists
RES-2026-00021 ("ameer", 25 to 26 Nov, Confirmed) is a missed arrival but sits first in Cancel and Amend lists, with no "No-show" flag, and Reservations status stays "Confirmed".
**Fix.** Add a "No-show due" badge (check-in date before business date, still Confirmed) in Reservations, Cancel, Amend, In House arrivals. One-click "Mark no-show" using the native `NoShowDialog`. The Today arrivals list should offer No-show beside Check in, as upstream does.

---

## B. UI and UX problems

| # | Sev | Screen | Problem | Fix |
|---|---|---|---|---|
| B1 | P1 | Dates everywhere | ISO dates (`2026-11-24`) mixed with `24 Nov 2026`. Seen in check-out dialog subtitle (`CheckOutDialog.tsx:747`), Cashiering list, Reservations IN/OUT, Cancel/Amend rows (`FindBooking.tsx:89`), Guest History last stay (`Guests.tsx:212`), tape tooltip (`TapeLegend.tsx:86`), folio header, Guest journey. | One `formatDate()` helper in `custom/`; replace in these places. Format `dd Mon yyyy`, with weekday where space allows. Patch upstream files only at the call site. |
| B2 | P1 | In House | Menu "In House" opens the Arrivals tab. Arrivals list shows "Unassigned" with Check in, but check-in then auto-picks a room. No phone, company, plan or search. "Until" date picker is clumsy. | Default tab = In house when any exist. Show phone, company, plan, balance. Add search box, print list, and "Assign room" inline. Replace "Until" with a "Next 3 / 7 days" toggle. |
| B3 | P1 | Check-out dialog | Six steps for one checkout (Bill, Late check-out, Payment, Guest moment, Process, Invoice). "Late check-out" appears when not needed. "Posts at check-out (2 nights)" for a 1-night stay. "Already on the folio ₹0" confusing: MyCloud staff expect nightly postings. | Keep native dialog (principle). Hide Late check-out step when check-out time not passed or no fee set (config, or a small patch). Fix wording on the bill step: "Room charges are posted by night audit. 2 nights will post now." Show the amount per night. |
| B4 | P1 | Folio | Top bar has 8 buttons in one row (Split folio, Bill each guest, Change company, Proforma, Advance bill, Print folio, Settle & continue stay, Close & generate invoice). "Advance bill" unclear. "Settled ₹0.00" in the banner is ambiguous. | Group: primary = Take payment, Close & generate invoice; "More" menu = Split, Bill each guest, Proforma, Advance bill, Print. Rename "Advance bill" to "Bill ahead (interim invoice)". Banner label "Balance due ₹0.00". |
| B5 | P1 | Room status words | Room Board and tape use both "READY" (white) and "CLEAN" (green). Staff cannot tell which is sellable. | One vocabulary: Dirty, Clean, Inspected, Out of order (as upstream legend). Show legend on Room Board and tape. |
| B6 | P2 | Today | 90-day occupancy strip is tiny and nearly empty. "Revenue ₹0" shown beside +occupancy. Arrival rows have tiny "Registration card / copy check-in link". No In-house table or housekeeping tiles (upstream has both). | Add in-house table (guest, room, balance, check-out with "Today / In 2 days"), housekeeping tiles, bigger registration card link. Upstream layout: reuse. |
| B7 | P2 | Quick reservation | Label "Group booking with a main room" floats beside "Add another room" with no control. Phone placeholder looks like real data. Quote note "Non-refundable from now…" is hard to read. Page shows through under the pop-up. | Make the label a link/checkbox or remove; placeholder "Mobile number"; move policy to a small info row. Pop-up height to fill below the nav. |
| B8 | P2 | Check-in | Room list shows only the room type's rooms; auto-filled 401 is "Ready" while other rooms are "Clean" (see B5). Checks box says "Balance due ₹7,875" without tax split. | Allow room type override with a visible "Upgrade" label. Standardise status words. |
| B9 | P2 | Cashiering | Menu name "Cashiering" opens night audit panel, till and bills in one page. | Rename to "Cashiering and bills" or split the audit card out; link to Night Audit. |
| B10 | P2 | Reservations list | No balance, company or room-type columns; sort not by date. | Add Balance, Company columns by default; default sort check-in date descending; status filter chips. |
| B11 | P2 | Global search | Guests without a phone appear as `Guest · 0-02908`. | Show last stay and booking count instead of the ID. |

---

## C. MyCloud features from the recording versus Kamra

Checked against Kamra native and kamra_custom code. Only gaps are listed as work.

| MyCloud flow in the video | Status in Kamra Custom | Action |
|---|---|---|
| Reservation form with rate plan, agreed rate, remarks, analysis codes | Present (dense booking form, agreed rate, internal remarks, codes) | none |
| Reservation confirmation print | Present (confirmation.py) | check print layout includes cancellation policy and GST number |
| Registration card, sign here | Present | none |
| Room transfer: move / free upgrade | Present natively (`RoomChangeDialog`, reasons incl. Upgrade) | none |
| Room transfer: **paid upgrade** (new rate, charge difference) | **Mostly present.** `RoomChangeDialog.tsx` has a rate choice: new room's rate, keep old rate (free upgrade), or typed nightly rate (custom, limited to Revenue Manager/admin). Verified in code 27 Nov. | **C1** (P2, was P1): wording only. Rename the three choices "Free upgrade (keep old rate)", "Paid upgrade (new room rate)", "Custom rate". Let the front-desk role use the first two without the Revenue Manager role. Show the price difference per night before confirming. |
| Transfer charges to another folio / in-house room account / non-room account | Verified: native `folio.transfer_charges` only moves charges between folios of the **same stay or same group** (`_assert_same_stay` throws "Folios belong to different stays"). Company/city-ledger folio is reachable through Change company. Move to an unrelated in-house room is not possible; POS bills can move to a room (`pos.move_room_bill`). | **C2** (P1): needs backend. Open an upstream issue and PR for a guarded cross-stay move (same property, both folios open, approver required, activity log on both stays). Until it merges, desk workaround: Change company to the city ledger. Screen: "Move charge" with room-number search as in the video. |
| Post charges: revenue, correction, payment, refund, settlement | Present in folio; "correction/refund" naming unconfirmed | **C3**: verify folio Post charge offers Revenue correction and Payment refund; add if missing. |
| Settlement modes as large buttons (cash, card types, cheque) + debtor account | Settlements and card network picker present; debtor via receivables | **C4**: show payment modes as tap buttons in take-payment; keep debtor picker. |
| Multiple folios with folio number on each posting | Present (Extra folio 1/2, Split folio) | none |
| Group by charges / group by dates on folio, filter by date | "In order / By mode" toggle only | **C5** (P2): add "Group by date" and date range filter. |
| Personal information: address, travel docs, visa, arrival from, purpose of visit (C-form data) | **Missing** for foreign guests | **C6** (P1 if hotel hosts foreigners): C-form fields on guest (visa, arrival from, port, purpose, next destination). Backend: new additive custom fields; screen: collapsible "Foreign guest" box in check-in. Ask upstream whether they want it. |
| Wake-up call | Native service item only; no desk list | **C7** (P2): wake-up list on House hub. |
| Lost and found, tasks, log information, reservation notes | Native partial (`lostFoundConfig`) | **C8** (P2): link "Notes, tasks, lost and found" on the stay page. |
| Guest class / market segment / business source | Market segment native; guest class custom | none (confirm shown on booking form) |
| In-room dining and POS charges on folio (with tax lines) | POS exists natively (`pos.py`) | verify posting to room folio shows CGST/SGST lines; no build planned. |
| Express check-out, night audit, cashier shift number on postings | Express check-out switched off by design; night audit present; shift on cashier sessions | **C9** (P2): show cashier/shift column on folio postings. |
| Delink guest from history | Not found | **C10** (P2): covered by guest merge/unmerge in A5. |
| Rate changes during stay: per-night grid (rate type, system rate, agreed rate, inclusions, meal plan, auto-post, per-pax) with "copy to all days" | Per-night price exists (`dayRates.ts`, "Price night by night" in check-in) | **C11** (P2): check it offers meal plan and "copy to all days"; add if missing. |
| Documents: send Confirmation / Amendment / Pre-arrival / "Fresh understanding" by email or print, list of communicated documents | Confirmation print exists; amendment, pre-arrival and communicated-documents list not found | **C12** (P1): "Documents" panel on the stay: choose document, print or email (prefilled subject and message), history of what was sent. Reuse `confirmation.py`; add amendment letter and pre-arrival mail. |
| Log information: dated list of who changed the reservation | Native Activity log exists; no per-stay "Log" link on our stay screen | **C13** (P2): link "Log" on the stay page that opens the Activity filtered to this booking. |
| Supervisor password before sensitive actions (seen before a folio edit) | `approvers.py` and `ApproverSelect.tsx` exist | **C14**: confirm approver prompt covers void, transfer, discount, back-dated edits; list the covered actions in the settings page. |
| Void selected charges with a reason box | Void exists natively | **C15**: confirm void needs a reason and approver; show voided lines struck through. |
| Folio top actions: Service charge allowance, Payment gateway transactions, Guest self services, Currency exchange, Print credit voucher, Invoice/credit voucher, Apply discounts, Split charges, Transfer charges, Check-out | Discounts, split, transfer, credit note present natively. Service charge allowance, currency exchange, guest self services not found | **C16** (P2): ask client which of these they use; build only those. Group all under the "More" menu from B4. |
| Folio card view: Direct folio, Folio #2, #3, Contract folio side by side with "summarise by days / by charges" | Folio tabs exist (Guest, Company, Extra 1/2) but one at a time | **C17** (P2): optional "Compare folios" view showing all folios with balances side by side. |
| Billing block on the stay: Pay by, Debtor account, Tax exempt, Cash only flag, Billing instructions, Folio instructions | Company billing, tax codes and folio routing present; "Cash only" flag and folio instructions not found | **C18** (P2): add "Cash only" and "Billing / folio instructions" text fields to the stay, shown as a banner on the folio. |
| Reservation chart ("stay view"): room-type groups, legend (Reserved, Confirmed, In-house, Today's departure, Unassigned, Group, Pre-arrival), hover card with full booking detail, drag to move | Tape chart has legend and hover; no unassigned row, no overdue (see A1) | Covered by A1. Add the same hover fields (phone, company, rate, balance) and a "Today's departure" colour. |
| Reservation search screen with many criteria (name, confirmation no, room, external reference, status, dates, source, room type) | Present (`ReservationSearch.tsx`, patch 160) | **C19** (P2): check the same criteria exist, including external reference (OTA booking id). |
| Process check-out and Link to history buttons on the reservation form | Check-out via In House and folio; "Link to history" not found | Covered by A5 (merge guests). |
| Upgrade from / Rate category fields on the reservation | Not found | **C20** (P2): show "Upgraded from <type>" on the stay after a room change with reason Upgrade. |

## D. Improvements already in upstream Kamra (demo v2.8.3) that we lack

- No-show button and "select all" bulk check-in on Today arrivals (native `bulk_stays`, `NoShowDialog`): add to our Today (A6, B6).
- Room number on arrival rows, "Today / In 2 days" next to check-out, balance chip "Due".
- Tape chart shows assigned arrivals in blue, in-house in green, room blocks hatched, star for returning guest. Our tape shows only in-house (A1).
- In-house table and housekeeping summary tiles on Today.
- Sidebar items we do not expose: Billing list, Room Blocks, Central Reservations, Recreation, Alerts and sound. **D1**: add Billing and Room Blocks to the top bar (client uses room blocks for maintenance); skip Recreation and Central Reservations until the client asks.
- Check our build is on the same Kamra version as the demo before copying layouts (our Kamra commit is 24 Nov; confirm version number).

---

## E. Implementation order

1. A1 tape chart plus calendar (shared additive read `extra_rows`).
2. A2 departures rule (one helper, three screens) and A3 audit-behind banner.
3. A4 deposit message, with data check.
4. B1 date helper, B5 status words (cheap, visible everywhere).
5. A5 guest duplicate prompt, A6 no-show badge and action.
6. B2 In House, B4 folio buttons, B3 check-out wording, B6 Today widgets.
7. C1 paid upgrade, C2 move charge, C3 to C5.
8. C6 C-form fields (confirm need with client first).
9. P2 items.

Each step: failing test in `ui/tests` or `kamra_custom/tests` first, patch in `ui/patches`, rebuild bundle, check in browser, then commit. Upstream issues to open before any PR: A1, A2, A4, A5 (tape overdue, departures overdue, deposit satisfied with zero requirement, guest dedupe without phone).

## F. Video coverage

The whole 36-minute MyCloud recording was sampled every 30 seconds (about 72 frames), plus the earlier 3-minute samples. The recording is one reservation-and-folio session on 20 Nov: reservation form, rate changes, documents, log, room transfer, folio postings, charge transfer, void, settlements, personal information, reservation chart and reservation search. It does not show night audit, housekeeping, reports or cash shift closing, so nothing about those can be compared from the video. Frames were small, so field labels were read at low resolution; items marked "confirm" in section C should be checked with the client before building.

Priority from the video, in order: C1 paid upgrade, C2 move charge to another room or non-room account, C12 documents (amendment, pre-arrival, email), C6 C-form, then the P2 rows.

## G. Not covered

- Mobile/tablet widths, keyboard shortcut pass, print layouts (invoice, registration card), Reports menu, and housekeeping screens beyond Room Board.
- No bookings or check-ins were changed during this audit.
- Cashiering and Reservations raw ISO dates were seen on screen but their source file was not located.
- Paid upgrade and lost-and-found backend not verified in code.

---

## H. Kamra-native design for each need (not a MyCloud copy)

MyCloud solves most things with many buttons on one big form and pop-up windows. Kamra already has a better base: a stay hub, drawers, an approver list, an activity log and a quote that explains a price. Each item below uses those, so the desk learns one pattern instead of twenty.

**Design rules**
1. One place per thing: everything about a guest's stay is reached from the stay hub (tabs: Details, Folio, Documents, Notes and tasks, Log). MyCloud's red side-button column becomes these tabs.
2. Act where the problem is: an overdue guest is fixed from the tape chart or the departures list, not by finding another screen.
3. Show the result before confirming: price difference, balances before and after, what will be sent.
4. One rule, one helper: counts, dates and status words come from shared code, so screens cannot disagree.
5. Approval by role and reason, with a log entry, instead of typing a shared password.
6. Backend: only additive reads, or an upstream PR when Kamra's own rule must change.

| Need | MyCloud way | Kamra-native design | Where it is built |
|---|---|---|---|
| Overdue and unassigned stays | Reservation chart with an Unassigned lane | Tape chart gets a red "Overdue" bar on the room and a top "Unassigned" lane. Drag an arrival onto a free room to assign it; click an overdue bar to extend, check out or move. Legend always visible. | Patch on tape plus one read `extra_rows`. Upstream issue. |
| Departures | Departure list | One "Due out" list with two groups, Today and Overdue, bulk "Check out" with the native dialog per guest. Same numbers on Today, In House, Room Board, statistics. | Shared `departures.ts` helper, one read. |
| Night audit behind | Business date in header | A sticky banner on every desk screen when behind: "Audit is 2 days behind. Nights 25 and 26 Nov are not posted." with the Open audit button. Folio and check-out show "will post at check-out". | Shared banner component. |
| Documents (confirmation, amendment, pre-arrival) | Pop-up with email only | One "Send" drawer on the stay: pick document, pick channel (WhatsApp, email, print), preview, send. Keep a history list with who sent what and when. WhatsApp first because Indian guests use it. Amendment letter is created automatically when dates, room or rate change after confirmation. | New Documents tab in the stay hub; reuse `confirmation.py`; channel through Kamra's existing messaging if present. |
| Rate change during stay | Per-night grid | The existing night-by-night price table gets "Apply to all remaining nights", a required reason and a before and after total. Past nights are locked unless an approver agrees. | Patch on night price table. |
| Paid or free upgrade | Room transfer form | In the room-change dialog, three clear choices with the per-night difference shown: free upgrade, paid upgrade, custom. The stay then shows "Upgraded from Deluxe". Front desk may choose the first two; custom needs the approver. | Wording and role check in the dialog; no backend change. |
| Move charge to another room | Transfer charges pop-up | Select lines in the folio, then "Move to": search by room, guest or company. Shows both balances after the move, asks a reason, needs an approver for another guest's stay. A mirrored log line appears on both stays. | Needs one guarded backend call. Upstream issue and PR; interim workaround is the company folio. |
| Void and correction | Void with reason | Void always asks a reason, keeps the line visible struck through, shows who voided. Correction posts a counter line instead of editing. | Check native; patch wording. |
| Sensitive actions | Password pop-up | A policy table in settings: action, role allowed, limit. When a lower role tries, the screen asks for an approver's PIN or sends a request, and the log records both people. | Extend `approvers.py` settings only. |
| Foreign guest C-form | Long personal-information form | The check-in screen shows a "Foreign guest" box only when nationality is not Indian: passport, visa, arrival from, port, purpose, next destination. Missing fields block check-in with a clear message. A daily "Form C ready" list can be exported for the FRRO filing. | Custom fields plus a new read; screen box in check-in. Confirm legal format with the client first. |
| Wake-up calls, lost and found, notes | Separate pages | One "Notes and tasks" tab per stay. Wake-up call is a task with a time; the House hub shows "Due in the next hour" so the desk or night auditor sees it. Tasks can be assigned to housekeeping or front desk and show as chips on Room Board. | Use Kamra's task and service-item model; one list on House hub. |
| Billing flags (cash only, instructions) | Fields on reservation | One "Billing notes" box on the stay shown as a yellow bar at the top of the folio and check-out ("Cash only. Company pays room only."). Routing rules stay as they are. | Small field plus a banner. |
| Guest duplicates and history link | Link to history | Prompt at entry: "Same name or phone exists. Use this guest?" Plus a Merge tool on Guest History that previews what will combine and can be undone for 24 hours. | Booking dialog patch; merge needs upstream if no native call. |
| Folio actions | 10+ buttons | Two primary buttons (Take payment, Close and invoice). Everything else in a "More" menu grouped as Move, Split, Print, Bill. Side-by-side folio chips with balances already exist; add a "Compare" view only if the client asks. | Folio patch. |
| Dates and statuses | Varied | One date formatter and one status vocabulary with colours, documented in `desk.css`. | Shared helper. |

**What is better than MyCloud, not just equal**
- The quote and "why this total" explanations on bills.
- Approval with reason and log instead of a shared password.
- Sending documents by WhatsApp with history.
- Fixing a problem from the chart, in place.
- Same counts everywhere.

**What to keep simple**
- Do not rebuild MyCloud's side-button column, its pop-up windows, or its ten folio buttons.
- Do not build service charge allowance, currency exchange or guest self services unless the client shows a daily need.

---

## I. Progress

**Phase 1 (A1) done, 27 Nov 2026.** Tape chart now shows overdue guests (red bar on their room, today and tomorrow, opens the stay with the real dates and "Process check-out") and a "Waiting for a room" group on top for arrivals with no room (drag a bar to a room, or use Move room). Better than the first plan: no change to Kamra's `tape_chart` or the override wrapper; one new read (`kamra_custom/tape.py`), a small patch (`ui/patches/168-tape-extra-stays.patch`) and overlay helpers (`tapeExtra.ts`, `TapeExtra.tsx`). If the read fails the chart draws as Kamra draws it. Hourly view does not show overdue guests (not covered). The calendar availability count was left alone: the room picker already treats overdue rooms as booked.
Tests: 7 backend, 10 front end; browser: bars, panel, drag to room, Move room dialog, legend filter, Hourly, next week.

**Phase 2 (A2, A3) done, 27 Nov 2026.**
- A2: both Today and In House read `front_desk_snapshot`, so one change fixed both. The existing wrapper now puts guests still checked in after their departure date at the top of today's `departures` (`kamra_custom/departures.py`). Departures reads 4 (was 0) on Today and In House, with the "Past check-out time" flag. No front-end patch. Statistics and House hub still count by business date (25 Nov), which is a different, labelled figure.
- A3: a strip under the top bar on every screen when the night audit is behind ("The night audit is 2 days behind ... Open night audit"). New read `attention.audit_status`; component `AuditStrip.tsx` inside our own `TopNav.tsx` (no Kamra patch). Hidden on the night audit screen. Popups still open below it.
Tests: 5 + 2 backend, 4 front end; browser: Today, In House departures, tape, night audit, quick reservation popup.

**Regression check.** Front-end suite 355 passed. Backend suite 415 ran: 10 errors, all in `test_desk_reports` (two tests, five inherited classes). They fail because the test picks room 202, which the site's own overdue guest occupies ("Room still occupied"). It depends on site data, not on these changes.

**Next: Phase 3**: B1 one date format, B5 one set of room status words.

**Phase 3 (B1, B5) done, 27 Nov 2026.**
- B1 dates: one helper (`showDate`, new `showMoment`). Raw ISO dates removed from Reservations, Guest History, Billing list, Cancel/Amend, Housekeeping tasks, the check-out dialog subtitle, the folio (invoice date, in/out, line date, payment times) and the tape hover card. One place fixed the generic lists: `ResourceScreen.cellValue` (patch `169-show-dates`). Sweep by script over 12 screens: 0 raw dates left, except a charge description Kamra writes itself ("Room 202 · DLX ... · 2026-11-24").
- B5 room status: the cause was not wording only. Kamra writes "Ready" when an inspection passes; several screens did not know it, so a Ready room showed white, dropped out of the counts (Today, House, statistics showed 27 + 0 of 30 rooms) and the transfer dialog warned "hasn't been cleaned yet". Now "Ready" is shown as "Inspected" everywhere, counted with Inspected, and counts as cleaned (`roomStatus.ts`, patch `170-ready-is-inspected`, `house.py`). The "Ready to sell" filter name stays (it means sellable). Upstream issue to raise: Ready is missing from Kamra's housekeeping counts and warnings.
Tests: front end 362 passed; backend `test_house` 10 passed incl. new Ready test; browser: Room Board, Today tiles, House, tape, Move room (no false warning), check-in room chip.

**Phase 4 (A4, A6) done, 27 Nov 2026. A5 changed.**
- A4 deposit: the cause is in Kamra, not the screen. `deposit_satisfied` reads the property policy (0 on this site) and ignores the stay's own deposit row (required 5,000, held 0), so it returns true. The check-in screen now reads the stay's deposit (`depositNotice.ts`): "₹5,000 security deposit still to collect…" in amber, the till prompt shows only when money is due, "taken" only when it is held. No Kamra patch (the check-in screen is ours). Upstream issue to raise: `deposit_satisfied` must also look at the row.
- A6 missed arrivals: Kamra v2.7.7 has no desk no-show (only inside the night audit wizard), though its backend has it with the full fee policy (`no_show_preview`, `eod_mark_no_show`). The desk snapshot now lists confirmed bookings whose arrival day has passed, first on today's arrivals, flagged "Arrival was 25 Nov 2026" (`arrivals.py`). A "No-show" button opens a Kamra slide-over that reads the policy fee and credit in words, takes an optional note and calls Kamra's own `eod_mark_no_show`. Disabled with the reason when the night audit has not reached that date (Kamra's own rule). Works on In House and on Today. The Arrivals count is now 4 (was 3). Not done in the browser: pressing "Mark no-show" (it changes a booking); the backend test marks a no-show and rolls back.
- A5 guest duplicates: not built as planned. The booking form already shows matching guests while typing (name or phone), and the backend already reuses a guest by phone. Duplicates come from bookings made with no phone and no picked profile (here an API or agent booking). A second prompt would repeat the first. Better use of effort: a guest merge tool for the duplicates that exist (Frappe's merge re-points every link), with a check that the phones do not conflict. Moved to a later phase.
Tests: front end 376 passed; backend arrivals 4 passed; browser: check-in deposit line, In House arrivals, no-show sheet, Today.

**Phase 5 (B2, B3, B4, B6) done, 27 Nov 2026. Two items turned out not to need work.**
- B4 folio header: nine buttons in a row became "More ▾", "Print folio" and "Close & generate invoice". The More menu (`FolioMore.tsx`, patch `172-folio-more`) holds Split folio, Bill each guest, Change company, Group folio, Proforma, Post charges ahead (was "Advance bill"), Credit note, Settle & continue stay and Cancel invoice. The buttons keep their own behaviour; the menu only gathers them and closes on a click, outside click or Escape. Checked: opens, Change company works and closes the menu. The "Settled ₹0.00" banner is clear as it is (it says Balance due when owing).
- B2 In House: a search box (guest, room, phone, company, booking number; phone matches by digits) and each row now shows the phone and company under the guest name. The list rows carry both through the snapshot wrapper. Patch `173-in-house-find`, `deskSearch.ts`, `DeskSearchBox.tsx`. Default tab left as Arrivals: the Arrivals, In house and Departures counts are always on screen, so one click reaches any of them.
- B3 check-out: the Late check-out step is already shown only when the guest leaves after check-out time (Kamra's own rule, not a bug). Wording fixed in the bill step: "The night audit posts each night's room charge. Nights not posted yet are added when you check out, so this total is for the whole stay." and "(2 lines)" in place of "(2 nights / charges)". Patch `174-checkout-wording`.
- B6 Today: Kamra v2.7.7 already has the In-house guests list and the Housekeeping tiles; the demo's extra widgets are from a newer Kamra. Nothing built. The No-show button on arrivals (Phase 4) was the missing piece.
Tests: front end 384 passed; backend 6 + 28 passed; browser: folio More menu, In House search by company, phone and no match, check-out dialog.

**Phase 6 (C12 documents) done, 27 Nov 2026.**
- Checked first: the reservation screen already sent a confirmation (download PDF, WhatsApp link, email). What was missing was the amended letter, a pre-arrival message, and any record of what was sent. A separate "Documents" tab as first planned would have duplicated that menu, so the existing Send menu was extended instead.
- Send menu: a **Document** choice (Confirmation, Amended confirmation, Pre-arrival message) above the same three ways to send. The pre-arrival message carries the guest's online check-in link (made once, the same link Kamra uses). It has no PDF.
- History: every send is kept as a note on the booking (a standard Frappe comment, so it also shows in the booking's own timeline) and the newest shows under Basic details: "Pre-arrival message sent by WhatsApp on 27 Nov 2026 14:29, by Administrator".
- Nudge: if a booking is still Confirmed and changed after the last confirmation went out, an amber line says the guest holds old details and offers "Send an amended confirmation", and the menu opens on that document.
- Bug found and fixed on the way: MariaDB gives "8:00:00" for 8 o'clock, and four places cut the first five characters ("8:00:"), which crashed the confirmation for any stay with an arrival before 10:00 and made the "past check-out time" comparison wrong for early check-outs (tape, snapshot rows, attention list). One helper (`timeutil.hhmm`) now reads every time.
- Backend: `confirmation.details/log_sent/download/send_email` take a `kind`; email also attaches the PDF for the first two. Email is not set up on this site (no outgoing account), so the email send was tested only for its refusal message.
Tests: front end 388 passed; backend confirmation 18, timeutil 4 passed; browser: Send menu, document choice (Download hidden for pre-arrival), WhatsApp send, history line. The send wrote one history note on RES-2026-00016 and gave it an online check-in token.

**Phase 7 (A5, guest duplicates) done, 27 Nov 2026.**
- Frappe's own merge (`rename_doc(..., merge=True)`) points every link to the removed profile (bookings, folios, payments, ID documents) at the kept one and deletes the removed one, so no hand-written re-pointing. `kamra_custom/guest_merge.py` wraps it with the safeguards: a reason is required; two profiles with different phone numbers are never offered (they may be different people); a guest in house is refused; the kept profile keeps its own values and only has blanks filled (email, ID, address, VIP); a blacklist is never lost (flag and reasons are joined); the merge is written as a note on the kept profile.
- Screen: Guest History shows an amber line "N guests may be on file twice" only when there are any. "Review" lists each group (profiles with phone, email, bookings, last stay) with the best one preselected (most bookings, then one with a phone, then the oldest). "Join into the kept profile" opens a slide-over that says in words who joins whom, how many bookings move and that it cannot be undone, and asks for the reason (`DuplicateGuests.tsx`, patch `175-duplicate-guests`).
- Allowed roles: Hotel Admin, Front Desk (and Administrator).
- Browser: made two throwaway profiles, saw the banner, reviewed, joined them with a reason. The list lost one row, the banner count fell, the kept profile took the email and has the merge note. Throwaway data deleted. The real "ameer" pair (G-02776, G-02908) was not touched: merging it is a decision for the desk.
Tests: front end 393 passed; backend `test_guest_merge` 8 passed.

**Phase 8 (C11 to C20 checks) done, 27 Nov 2026.** Each item was checked in code and on screen before building; most were already there.

| Item | Result |
|---|---|
| C11 per-night rate grid | Already there: a price per night with "different amount each night" and one night copied to all (`dayRates.ts`, `CustomReservation.tsx`), meal included. Nothing built. |
| C13 stay log | Already there: a History link on the stay opens the activity log narrowed to the booking. Nothing built. |
| C14 approval on sensitive actions | Already there, and wider than MyCloud's: Kamra asks for the manager PIN on advance bill, credit note, settle, close folio, cancel invoice, void, refund, allowance and payments. Nothing built. |
| C15 void with reason | Already there: a void asks for a reason. Nothing built. |
| C16 service charge allowance, currency exchange, guest self services | Not built, as planned: ask the client if they use them. |
| C17 folios side by side | Not built: the folio chips already show every folio with its balance. |
| C18 billing note | Built. The staff note on a booking ("company pays room only", "cash for extras") was only on the booking screen. It now shows as an amber "Staff note" bar on the bill and on the Bill step of check-out, and never prints (`BookingNote.tsx`, read `reservations.booking_note`, patch `176-booking-note`). Checked on zaffar's folio and check-out. |
| C19 find by channel reference | Built. Reservation search and quick find (Cancel/Amend) now match the id an OTA gave the booking as well as our number; the field is labelled "Reservation # or channel ref". |
| C20 "Upgraded from" | Not built: Kamra keeps the room change as a reason only, with no field to show. Low value. |

Tests: front end 393 passed; backend search and booking note 29 passed (4 new). The full backend suite shows the same 10 `test_desk_reports` errors.

**Phase 9 (upstream issues) done, 27 Nov 2026.** `KAMRA_ISSUES.md` holds six drafts in Kamra's bug-report form, each with cause (file and line in a v2.8.0+19 clone), expected behaviour, a suggested fix and what our workaround does: tape chart omits overdue and unassigned stays; departures omit overdue guests; deposit shown "taken" with nothing held; a booking with no phone always makes a new guest (and no merge exists); "Ready" rooms treated as not cleaned and left out of counts; request to move a charge to another guest's room. Nothing was posted. Each needs a re-check against current `develop` (the demo is v2.8.3) before posting.

**Phase 10 (small polish) done, 27 Nov 2026.**
- B10: the Reservations list has a Company column (it had no way to see who pays). Total and Advance stay; a Balance column is not possible in Kamra's generic list (it is not a stored field), so it was not faked.
- B7: the "Group booking with a main room" link in the quick reservation now reads "Booking a group? Open group booking", so it reads as a link to the group screen. The phone placeholder (a real-looking number from Kamra's own phone box) was left: it is Kamra's component, low risk.
- B11: global search shows "Guest · no phone on file" instead of the internal id (G-02908).
- B9 (rename of the Cashiering menu) left as is: the page is the list of bills with the till, and the label is the one the client's staff already use.
Patch `177-desk-polish`. Tests: front end 393 passed; backend suite unchanged (same 10 `test_desk_reports` errors from room 202 being occupied).

**Open after phase 10 (needs a decision or the client):** C2 move a charge to another room (Kamra change needed; issue 6 in `KAMRA_ISSUES.md`); C6 foreign-guest C-form (ask the client); C16 service charge allowance, currency exchange, guest self services (ask the client); C7 wake-up list on the House hub and C8 notes and tasks tab (ask if wanted); C3 revenue correction / payment refund names on the folio and C4 payment-mode buttons (check with desk staff); C5 folio group by date. Posting the six upstream issues is the user's call.

**Fix after phase 10: no security deposit for this client (27 Nov 2026).** The client takes advances only. The check-in screen still showed "Security deposit: Required ₹5,000" (and my phase 4 wording made it louder). Cause: the property's security deposit policy is 0 now, but 16 stays still have a deposit row asking for 5,000 with nothing collected, left from a time when the policy was 5,000 (rows made 25 to 27 Nov). Rule added (`depositNotice.ts`): a row that is Required, with policy 0 and nothing collected or held, is a leftover and is not shown: not in the deposit box, the "Deposits" lines of the stay, or the check-in line, and an empty "Deposit and advance" bar is no longer drawn. A deposit that was collected, or a property with a policy, still shows. No data was changed; the 16 rows stay in the database and block nothing (Kamra only blocks check-out for a deposit that is held).
Tests: front end 397 passed (5 new); browser: Maaz's check-in shows no security deposit and no empty bar.
