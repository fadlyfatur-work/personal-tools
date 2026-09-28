# Nominatif

Route: `/nominatif`, linked from `/menu`. All calculations and XLSX generation
run locally in the browser. No database migration, authentication, or new package.
Inputs are not persisted; download before leaving the page.

## Rules and coverage

The built-in rule is PMK 32 Tahun 2025, SBM TA 2026:
https://jdih.kemenkeu.go.id/dok/pmk-32-tahun-2025

`lib/nominatif/pmk-32-2025.json` contains the tables transcribed from the supplied
110-page PDF: 38 province daily/hotel rates (pp. 15, 19), 34 transfer rates
(p. 85), and 316 printed domestic flight routes (pp. 86–90). Missing transfer
rates for the four newer Papua provinces remain null, never zero or inherited.
Flight references use the source's direction and city spelling; unmatched routes
require a user amount. Only economy flight references are currently used.

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

`excel.ts` isolates the provisional format: two sheets (Rincian and Parameter),
numeric money, textual NIP, quantity × rate formulas and a SUM total, cached
values, frozen headers, and an autofilter. User text is escaped and stored as
inline strings, never interpreted as Excel formulas. The existing PizZip package
packages the fixed OOXML structure. Editing Excel does not rerun app validation.
Replace the layout in this module when the final template is supplied.

## Verification

`npm run test:nominatif` compiles calculation/export modules to ignored `.next/`
and checks the Jakarta–Palembang case (Rp5,954,000), actual costs (Rp5,164,000),
multiple employees, missing inputs/rates, dates, hotel limits, meeting allowances,
manual rules, and XLSX formulas/string safety. It also writes a sample workbook
inside `.next/nominatif-check/` for independent inspection.

## Design assessment

UI/UX Pro Max matched accessible public-sector interfaces. Applied clear labels,
visible keyboard focus, native inputs, restrained motion, and contrast. Rejected
the marketing-style hero/CTA recommendation for this working calculator.
Design Taste assessment uses its public-sector preset (variance 3, motion 2,
density 5); its landing-page imagery and layout-repetition rules do not apply to
a form/data tool. Existing Geist/Phosphor dependencies are reused. CSS Modules
isolate a green/neutral theme, desktop form/result split, and mobile single column.
