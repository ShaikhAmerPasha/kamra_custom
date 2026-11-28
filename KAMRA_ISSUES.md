# Issues to raise with Kamra

Drafts for Kamra-PMS/kamra-pms (issue first, then a pull request to `develop`, as agreed). Nothing here has been posted.

Each draft follows Kamra's bug report form (version, what happened, steps, expected). File and line references are to a clone at v2.8.0 plus 19 commits (`6b3dea82b`, 24 Nov 2026). The behaviour was seen in the SR Continental site's browser on 27 Nov 2026. Before posting, re-check each one against current `develop`, because the demo site (v2.8.3) is newer than this clone.

Each issue says what we already did on our side, so a maintainer can see the cost of leaving it as it is and the shape of a fix. Our workarounds stay until a fix is released.

---

## 1. The tape chart does not show guests who are past their departure date, or arrivals with no room

**Version:** 2.8.0 (+19 commits). **Install:** self-hosted (bench).

**What happened.** A guest who is still checked in after their departure date has no bar on the tape chart. The room looks empty, so it can be sold again. A confirmed booking with no room assigned is not drawn at all, so the legend counts "Reserved" and "Arriving today" show 0 while the Today screen shows arrivals.

**Steps to reproduce.**
1. Check a guest in for one night.
2. Do not run the night audit, or leave them in the room past the departure date.
3. Open Front Desk, Tape Chart on a later day.
4. Their room has no bar. Also create a booking and leave its room empty: nothing appears for it.

**Expected.** An overdue stay is drawn on its room (marked as overdue). A booking with no room appears in a place that says it needs one.

**Cause.** `tape_chart` in `kamra/api.py` (line 5820) keeps bookings with `"room": ("is", "set")` and `check_out_date > start` (lines 5844 and 5846). A stay that ended before the first column, or has no room, is filtered out.

**Suggested fix.** Add to the response the checked-in stays whose check-out date is before today (flag `overdue`) and the room-less stays in the window (a separate list). The screen then draws the first on their room and the second as an "Unassigned" row.

**Our workaround.** A separate read plus a small screen patch that draws red "Overdue" bars and a "Waiting for a room" group.

---

## 2. Departures leave out guests who are overdue

**Version:** 2.8.0 (+19 commits). **Install:** self-hosted (bench).

**What happened.** The Departures count on Today, and the Departures tab of In House, show only stays whose check-out date is exactly the day on screen. A guest who has not left by midnight drops off the list, so the count reads 0 while the room is still taken. The Room Board's "Departing today" does count them, so two screens disagree (here 0 and 4).

**Steps to reproduce.**
1. Have a guest checked in with a check-out date of yesterday.
2. Open Today, then In House, Departures.
3. Count is 0. Open Room Board: "Departing today" is 1.

**Expected.** One rule on every screen. Overdue guests are in Departures (and can be told apart from those leaving today).

**Cause.** `front_desk_snapshot` (`kamra/api.py` line 4168) uses `check_out_date == date`; the dashboard counts at lines 281 and `dashboards.py` 289 do the same. `rooms.py` lines 130 and 213 use `getdate(check_out_date) <= today`.

**Suggested fix.** For today's snapshot, include checked-in stays with `check_out_date < date`, and show them first with an "overdue" flag. Use the same rule for the dashboard count.

**Our workaround.** The desk snapshot wrapper puts overdue stays first in `departures`.

---

## 3. "Security deposit is taken" is shown when nothing is held

**Version:** 2.8.0 (+19 commits). **Install:** self-hosted (bench).

**What happened.** On the check-in screen the deposit box says Required 5,000 and Held 0, and the line under it says the deposit is taken (and the till prompt is hidden).

**Cause.** `deposit_satisfied` (`kamra/deposit.py` line 418) first reads the property's policy amount. When that is 0 it returns true and never looks at the stay's own Security Deposit row. A row can exist with a required amount when the desk agreed one for a booking, or after the policy was changed. `checkin.py` line 293 feeds this value to the screen (`CheckInDialog.tsx` line 1020 shows the text).

**Expected.** If the stay has a deposit row that requires money and less is held, the deposit is not satisfied.

**Suggested fix.** In `deposit_satisfied`, read the row first. If a row exists and is not Waived, compare held with its `required_amount`. Fall back to the policy only when there is no row.

**Our workaround.** Our check-in screen reads the row's own required and held amounts.

---

## 4. A booking with no phone number always creates a new guest, even when the same name is on file

**Version:** 2.8.0 (+19 commits). **Install:** self-hosted (bench).

**What happened.** Guest History lists the same name twice, once with a phone and one without, with a booking on each.

**Cause.** `_find_or_create_guest` (`kamra/api.py` line 7003) looks a guest up only by phone (lines 7012 to 7015). With no phone it skips the lookup and inserts a new Guest (lines 7026 to 7028).

**Expected.** At least a prompt, or a rule that new guests need a phone (with an exception for walk-ins).

**Suggested fix.** When no guest is chosen and no phone is given, return a possible match by exact name so the screen can ask. Alternatively, add a guest merge (below).

**Related request.** There is no way to join two guest profiles afterwards. Frappe's merge (`rename_doc(..., merge=True)`) already repoints every link, so a small action on Guest History would do it; we built one with safeguards (reason required, different phone numbers refused, guests in house refused, blacklist kept).

**Our workaround.** A merge action on Guest History.

---

## 5. A room in the "Ready" state is treated as not cleaned and is left out of the counts

**Version:** 2.8.0 (+19 commits). **Install:** self-hosted (bench).

**What happened.** Kamra sets a room to "Ready" when an inspection passes (`turnover.py` `mark_room_ready`). Several screens only know Clean, Dirty, Inspected and Out of Order:
- The room transfer dialog and the new booking dialog warn "hasn't been cleaned yet" for a Ready room (`RoomChangeDialog.tsx` lines 129 and 348; `BookingDialog.tsx` lines 580 and 1487).
- The Today housekeeping tiles show Clean and Inspected only, so 3 Ready rooms in 30 are in no tile (`Today.tsx` line 905). The housekeeping totals on the dashboard do the same.
- The Room Board shows Ready rooms in white, unlike every other state.

**Expected.** Ready counts as cleaned and is counted and coloured like Inspected (they mean the same to the desk), or has its own tile.

**Suggested fix.** A single helper for "is cleaned" (Clean, Inspected, Ready) and one place that folds Ready into Inspected for counts.

**Our workaround.** The screen treats Ready as Inspected (label, count and warning).

---

## 6. Feature request: move a charge to another guest's room or account

**Version:** 2.8.0 (+19 commits). **Install:** self-hosted (bench).

**Need.** A hotel often moves a charge (a restaurant bill, a damage charge, a courtesy) to another in-house guest's room, or to a non-room account. This is routine in MyCloud and similar systems: pick the lines, search the room, move, with a reason.

**Today.** `transfer_charges` (`kamra/folio.py` line 811) only moves between folios of the same stay or the same group; `_assert_same_stay` (line 800) refuses anything else with "Folios belong to different stays." `pos.move_room_bill` can move a POS bill to a room, but not a folio charge.

**Suggested design.**
- A guarded call that allows a move between two open folios of the same property, for an approver (the existing PIN approval), with a required reason.
- The move is written on both stays (activity log), and refused when either folio is closed.
- The screen: select lines in the folio, "Move to", search by room number, guest or company, show both balances after the move.

**Our workaround.** None yet. The desk can change the company on the folio (city ledger) as a partial answer.

---

## Not raised

- The desk no-show action exists in later Kamra versions (the demo shows it). It is not in the version we build against, so we added a screen over Kamra's existing `no_show_preview` and `eod_mark_no_show`. Nothing to raise unless the later screen is dropped.
- The one-digit-hour time bug (`"8:00:"` instead of `"08:00"`) was in our own code, not Kamra's.
