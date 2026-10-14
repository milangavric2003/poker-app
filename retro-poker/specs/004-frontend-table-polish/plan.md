# Implementation Plan: Uglađen poker interfejs

Grana `add-modifications`; privatni razvoj posle Week05; 2026-10-14.

## Technical Context

Postojeći React/TypeScript, jedan lokalni CSS fajl, Vitest/Testing Library i Playwright.
Nema novih zavisnosti, font servisa, slika ili UI biblioteka. Karte/čipovi/filc kroz CSS.
Card dobija javni string ili null; null grana ne koristi podatke vidljive karte.
ChipAmount dobija tačan iznos i tekstualnu oznaku; najviše 5 reprezentativnih čipova,
apoeni 1/5/25/100/500/1000. Ne računa novu preciznu raspodelu niti menja stanje.

## Constitution Check

Spec pre koda; RED/GREEN za poleđine i status/iznos semantiku. Čisti CSS proverava
browser geometrija i vizuelni pregled, bez assertion-a naziva klasa. Backend, shared
ugovori, App lifecycle i AI orkestracija ostaju postojeći. Jedan coding agent.
Offline/fake provider; bez commit/push/merge. Nema konflikta principa.

## Structure and phases

1. Baseline: Git SHA, UI/analysis/coach/usage testovi i screenshotovi 1/5 botova.
2. `frontend/src/components/PlayingCard.tsx`, `ChipAmount.tsx`, `PlayerSeat.tsx`;
   integracija u `Table.tsx`, bez internog stanja ili novog poker obračuna.
3. `styles.css`: tamna pozadina, filc i drvena ivica; desktop raspored oko centralnog
   board-a, human dno. Mobilni grid sa board-om iznad mesta i human pri dnu.
   `App.tsx` dodaje samo wrapper oko Table/ActionPanel; mobilni CSS stavlja akcije
   pre istorije. Lifecycle/polling i poslovni kod nisu promenjeni.
4. `tests/ui/table.test.tsx` semantika; `tests/e2e/table-polish.spec.ts` geometrija,
   screenshotovi, tastatura i reduced-motion. Istorijski E2E screenshot preusmeriti
   u ovaj feature bez menjanja njegovih funkcionalnih assertion-a.
5. Sve provere i evidence u `specs/004-frontend-table-polish/evidence/`; konvergencija.

## Verification

`npm.cmd test`; `npm.cmd run test:e2e`; `npm.cmd run typecheck`;
`npm.cmd run lint`; `npm.cmd run build`; `git diff --check`.
Playwright koristi postojeće offline test servere; ne prekida korisnikov server.
Screenshot pre/posle na istim kontrolisanim špilovima; mobilni 390×844 i desktop
1280×720. Proveriti i status fixture sa punim board-om, 6000 potom, side potom i
refund događajem. AI regresija već pokriva summary regeneration i coach usage polling.
