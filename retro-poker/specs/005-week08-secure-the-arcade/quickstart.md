# Week08 — vodič za proveru

Pokretati iz `retro-poker/`, Node 24/npm 11. Na Windows-u koristiti `npm.cmd`.
Aktivna grana je `week08-init`; feature direktorijum ne zavisi od imena grane.
Za Spec Kit u novom checkout-u:

```powershell
$env:SPECIFY_FEATURE_DIRECTORY='specs/005-week08-secure-the-arcade'
powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks
```

## Postojeća osnova

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
npm.cmd run lint
npm.cmd run build
git diff --check
```

Za Chromium koji još nije instaliran: `npx.cmd --no-install playwright install chromium`.
Instalacija zavisnosti/browsera može zahtevati mrežu; to nisu AI pozivi. Ne pokretati
smoke/diagnose/live CLI. Testovi koriste constructor-injected fake i sintetičke podatke.
Za lokalni API koristiti test helper, ne `npm run dev:backend` koji može učitati `.env`.
Ne prekidati tuđ proces ako je test port zauzet; zabeležiti prepreku.

## Faza 2: postojeće security komande

T007 uvodi fake-only node selekciju postojećim Vitest runner-om:

```powershell
npm.cmd run test:security
npm.cmd run build
npm.cmd run test:e2e -- tests/e2e/security-production.spec.ts
```

`test:security` bira `tests/{unit,contract,integration}/security-*.test.ts`;
običan `npm test` ih i dalje uključuje. Nema passWithNoTests. Početni rezultat
je namerni exit 1 zbog T13 (šesti start prihvaćen). Browser komanda koristi
stvaran build/preview iz produkcione konfiguracije: početni T16 je exit 1
jer se script izvršava bez CSP-a. [Dokaz Faze 2](../../docs/evidence/005-phase2-handoff.md).
`test:security:e2e` ostaje planiran za T022 i još ne postoji.
Portovi 5173/3001 moraju biti slobodni; helper ne prekida tuđe procese.
Test reset kreira nov proces/gate/sink/fake sat;
posebni reset testovi dele isti proces da ne prikriju zaobilaženje limita.
Očekivanje: validan coaching dva model koraka/jedan stvarni alat; negativni
request nula poziva; tool odbijanje nula nedozvoljenih tool izvršenja; sentinel
odsutan; CSP kontrolisano blokira dostupan script; igra/novi frontend funkcionalni.

Audit: `npm.cmd audit --json`; zabeležiti exit code i relevantne runtime/dev nalaze
u EVIDENCE_W08. Ne tumačiti mrežni neuspeh kao čist audit i ne koristiti force fix.

## Demo i handoff

Osam minuta: normalna igra/coaching, pretnje/granice, direktan nevalidan HTTP,
zabranjen tool, rate/capacity/late rezultat, browser CSP/XSS, sentinel/event i
pre/posle dokazi. Obojica samostalno menjaju jedan sintetički ulaz i objašnjavaju
očekivanu granicu. Demo nije izvršen samim pisanjem vodiča.

Pre svake faze pročitati prethodni handoff, diff i fokusirane testove. Grešku
prethodne faze prvo zatvoriti, a zatim nastaviti od prvog otvorenog taska.
