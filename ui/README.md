# Customised Kamra screens

Kamra's own screens at `/kamra`, with our changes inside them. Kamra's files are
never edited. We keep small patches and a few new files, and build Kamra's front
end with them applied.

```
ui/
  build.mjs      copies Kamra's frontend, applies patches/, adds overlay/, builds
  patches/       one patch per concern, applied in file-name order
  overlay/       our own new files, copied over Kamra's src/ (src/custom/...)
  tests/         tests for the plain TypeScript we add
  mkpatch.sh     makes a patch from your edits
  check.sh       the check to run after a Kamra update
```

The result is built into `kamra_custom/public/kamra-ui` and served at `/kamra` by
`kamra_custom/render.py`. The setting **Use customised Kamra screens** (Kamra
Custom Settings) turns it off: Kamra's original screens serve again. They also
serve if the build is missing.

## What the patches do

| Patch | Where | What |
|---|---|---|
| 20-folio-tax-one-line-each | Folio / bill | CGST and SGST each on their own line |
| 30-top-nav | App shell | Horizontal menus instead of the left sidebar |
| 40-room-board-dirty-report | Room Board | Dirty rooms button, panel and CSV |
| 50-booking-dialog | New booking | Search by mobile number, children per added room, internal remarks, agreed rate per room |
| 60-reservation-detail | Reservation | Internal remarks and rate editing |

The backend half is in `kamra_custom/`: `overrides.py` wraps Kamra's
`create_booking` and `create_group_booking`; `negotiation.py` holds the rate rules;
`guests.py` the mobile-number search; `housekeeping.py` the dirty-room report.

## After a Kamra update

1. Update Kamra as usual (`bench update` or `git pull` in `apps/kamra`).
2. `SITE=<site> ui/check.sh`
3. If step 1 stops with `patch NN-name does not apply`, Kamra changed those lines.
   Fix it (below), run the check again. Until then the stock screens keep serving
   whenever there is no build, and the last good build keeps serving otherwise.
4. `bench --site <site> migrate`, restart, and use the app.

### Fixing a patch

```
rm ui/patches/NN-name.patch
node ui/build.mjs --check          # Kamra's source with the other patches
ui/mkpatch.sh begin                # snapshot
# edit ui/.build/src/... the way the old patch did
ui/mkpatch.sh NN-name path/relative/to/src.tsx
SITE=<site> ui/check.sh
```

Keep a patch to a few lines that call into `overlay/`. The smaller it is, the
less likely a Kamra release touches the same lines.

### Adding a change

Put new code in `overlay/src/custom/`, make a patch that calls it, add a test in
`ui/tests/` for any logic that does not need a browser, and a backend test for any
endpoint. Do not edit `apps/kamra`.

## Things we depend on in Kamra

Backend tests fail if Kamra renames any of these, before a user meets the problem:
`Reservation` fields `auto_price`, `night_rates`, `rate_lock_key`, `amount_*`,
`special_requests`, `ota_ref`; the methods `set_night_rates`, `quote_inputs`,
`rate_lock_key_for`, `_apply_commission`; `kamra.api._assert_within_guardrails`,
`create_booking`, `create_group_booking`, `record_advance`, `room_board`,
`folio_invoice`; `Housekeeping Task` fields `room`, `reservation`, `task_type`;
`kamra.pricing.quote`. Our tax maths is checked against Kamra's own `quote()`.
