# Nominatif

Route: `/nominatif`, linked from `/menu`. All calculations and XLSX generation
run locally in the browser. No database migration, authentication, or new package.
Reusable document masters are saved in this browser. DATA for each trip is not
persisted; download before leaving the page.

## DATA and reusable template

Daily work uses a single DATA form. Assignment, destination, dates, SPT/SPD,
employees and costs populate every output sheet automatically. There is no
four-step wizard and no separate form for each output document. Rare tariff,
facility, special-cost and tax options remain available in collapsed sections.

Use **Atur template** once, then **Ubah template** when master data changes.
The template contains satker, output, file type, PPK/treasurer names and NIPs,
bank details, address and NPWP. MAK and issuing city belong to each trip DATA. Save validates the
required fields; cancel discards edits without changing the current DATA or
saved template. The saved template is applied automatically to subsequent trips
and exports, including after reload. The example button never overwrites it.

`lib/nominatif/template.ts` limits persistence to those ten master fields.
The key is `nominatif-template-v1` in localStorage; numbers/dates of SPT/SPD,
travel dates, purpose, MAK, issuing city, employee records and claim-specific
taxes are excluded. Existing stored masters remain compatible; legacy MAK and
issuing-city values are ignored.
useSyncExternalStore reads browser storage without a hydration mismatch and
updates the current form when the saved template changes. Invalid storage shows
a recovery message; a failed write never claims a successful save. Storage is
specific to this browser and origin; it does not require an account or database.

## Rules and coverage

The built-in rule is PMK 32 Tahun 2025, SBM TA 2026:
https://jdih.kemenkeu.go.id/dok/pmk-32-tahun-2025

`lib/nominatif/pmk-32-2025.json` contains the tables transcribed from the supplied
110-page PDF: 38 province daily/hotel rates (pp. 15, 19), 34 transfer rates
(p. 85), and 316 printed domestic flight routes (pp. 86–90). Missing transfer
rates for the four newer Papua provinces remain null, never zero or inherited.
Flight references use the source's direction and city spelling; unmatched routes
require a user amount. Only economy flight references are currently used.

Within-city duty of less than 8 hours uses only main transport, defaulting to
Rp170,000 per employee when blank. The amount and individual employee override
are editable. Start and return must be the same day and city/province must match.
Daily allowances, hotel, transfers, representation, local actual costs and meal/
snack deductions are excluded, including stale values from another activity.
This configurable amount follows the requested workflow, not a new legal claim.

Domestic ordinary duty, within-city >8 hours, in-person training, and meeting
daily allowances are supported. Fullboard activity days use Rp130,000; halfday
and fullday activity days use zero (pp. 22, 56). Up to one additional day before
and after is explicit, not automatic. Meeting package costs are not claimed
again as employee costs. Fullboard hotel nights only cover these extra days.
Training assumes outside-city or within-city >8 hours, in-person attendance.
Users select province and city explicitly and must ensure they agree.

Hotel ceilings follow position/grade; actual costs exceeding the ceiling are
blocked (special exceptions are not implemented). Transfer overrides show a
reminder of actual-cost conditions (p. 107); they are not independently approved
by the calculator. Local actual transport is separate from airport transfers and
reduces ordinary daily allowance to 60% (p. 53). Representation requires both an
eligible position and an explicit duty confirmation. Unsupported special cases
need separate review, not an invented default.

The manual option is a named rule and budget year with explicit rates for this
trip. It does not inherit PMK rate values or special monetary rules. It is an
arithmetic mode, not a regulation engine. Manual rates and shared transport
amounts apply to each employee; use separate calculations for differing tariffs.
Future fully supported regulations can be added alongside the built-in dataset
and mapped explicitly in `calculate.ts`. No future official regulation is assumed.

## Excel

The export follows the supplied BP2JK workbook through Lamp-Transport:
DATA, nominatif-LS, nominatif-KPN, SPPD-Form, Kwitansi, Kartu Kendali TA.2018,
Amplop, and Lamp-Transport. The two empty veryHidden sheets are retained; later
reference sheets are omitted. For additional employees the two nominatives expand, and
SPPD-Form, Kwitansi, Amplop and Lamp-Transport repeat with numeric suffixes.
There are 4 + 4 × employee count sheets.

`template-original.json` stores a sanitized ZIP of the supplied template, not a
reconstruction of its geometry. `scripts/import-nominatif-template.py` imports
the first ten original sheets through Lamp-Transport (two are veryHidden).
It removes source personnel, bank/identity values, obsolete formulas, external
links and comments while retaining original cell formats, row heights, column
widths/visibility, merges, images, drawings, controls, printer settings, margins,
print areas and paper sizes. Original sheet names, including the leading space
in ` DATA` and `Kartu Kendali TA.2018`, are preserved. The latter is a sheet name;
the document's actual budget year comes from DATA. SPPD retains the original
front-page print area; the reverse form remains in the worksheet.

`excel.ts` uses existing PizZip to patch values and formulas in those original
parts, including cached numeric totals and exact text NIP. Multiple employees
repeat the original nominative row and clone each individual document, including
its drawing/control dependencies. No formatting library rewrites the template.
The same totals feed both nominatives, receipts, control card and envelopes.
User text is escaped and never interpreted as a formula. Terbilang is generated
in Indonesian at export time. Edit in the app and export again to refresh all
metadata, validation, document text and terbilang; editing Excel does not rerun
app validation or regenerate prose.

SPT/SPD numbers and dates, budget, satker, issuer, PPK and treasurer identities
are required for export. Job title and an 18-digit NIP are required for every
employee document. Output, bank details, address, NPWP, cash voucher and SPD
cost level are optional. No real identities from the reference are defaults.

Each employee may override the shared main transport amount, record meal/snack
deductions, enter an advance, and list up to four transport expenses without
receipts. Those expenses itemize the main transport amount, never add a second
claim, and cannot exceed it. Deductions cannot exceed daily allowances. Advances
affect only the remaining amount on the receipt. Optional aggregate PPN/PPh
affect the control card net amount, not the employee entitlement calculation.

The Excel example uses manual rates: 1 day × Rp210,000 plus Rp170,000 transport
= Rp380,000. These amounts reproduce the supplied example, not a new regulatory
rule. All sample identities are explicitly labeled as examples.

## Verification

`npm run test:nominatif` compiles calculation/export modules to ignored `.next/`
and checks the Jakarta–Palembang case (Rp5,954,000), actual costs (Rp5,164,000),
multiple employees, missing inputs/rates, dates, hotel limits, meeting allowances,
manual rules, template parity (Rp380,000), deductions, advances, taxes,
individual transport, repeated documents, short-trip defaults/overrides/stale
cost exclusion, original layout/asset/style preservation and string safety.
It writes sample workbooks inside ignored `.next/nominatif-check/`.
On Windows with Excel installed, `powershell -File scripts/test-nominatif-excel.ps1`
opens the generated sample read-only, checks native recalculation and displayed
NIP, and exports seven document PDFs into the same scratch directory.

The 2026-10-22 verification also used an independent formula engine and Excel
desktop: opening without repair, recalculation, transport driver changes,
verbatim 18-digit displayed NIP and PDF printouts of all seven document sheets.
Browser checks covered empty/error states, adding/removing employees and
expenses, facilities, deductions, document validation, a real download, keyboard
focus, and both DATA/template views at 320/390/768/1440px in light and dark themes.
The follow-up checks covered save/reload/reuse/edit/cancel, DATA preservation,
examples retaining saved masters, corrupted/blocked storage, and downloaded
XLSX values proving the stored PPK, satker, treasurer and address reach the
linked document sheets. The default DATA view shows 19 inputs, with master and
less common fields outside the routine view.

## Design assessment

The user requested the root portfolio theme: Outfit, warm neutral canvas,
square content frames, 3px controls, blue accent and dark/light system themes.
Design read: Indonesian travel administration workspace for staff preparing
financial documents. Variance 3 / motion 2 / density 5; energy 2 / rhythm 2 /
motion 1. A single DATA form and reusable template keep routine entry focused; the desktop summary
stays visible and becomes an ordinary section on mobile. Numbered bars mirror
the portfolio, borders separate actual form groups, and Phosphor icons identify
file/download, add/remove and navigation actions. Existing Next/font and CSS
Modules are reused without additional runtime dependencies.

No horizontal page overflow was found in the 16 view/theme/width combinations.
Light paper text contrast: ink 16.08:1, muted 6.57:1, accent 5.56:1. Native form
controls have associated labels and hint descriptions, visible focus and 44px+
targets. Focus moves to the form heading when opening, saving or cancelling
template settings.
