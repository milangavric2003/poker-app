# Week08 — vodič za proveru

Aktuelni završni tehnički dokaz: [matrica](../../docs/evidence/005-phase7-matrix.md),
[handoff](../../docs/evidence/005-phase7-handoff.md). T030 i T031 ostaju otvoreni.

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

## Security komande (implementirane)

T007 uvodi fake-only node selekciju postojećim Vitest runner-om:

```powershell
npm.cmd run test:security
npm.cmd run test:security:e2e
npm.cmd run test:e2e
```

`test:security` bira `tests/{unit,contract,integration}/security-*.test.ts`;
običan `npm test` ih i dalje uključuje. Nema passWithNoTests.
`test:security:e2e` prvo izvršava `npm run build`, zatim Playwright security
rendering/state/production testove. `test:e2e` takođe prvo gradi aktuelne izvore
i uključuje sve security testove. Operator `&&` prenosi neuspeh build-a/testa;
prazna selekcija je greška. npm skripte rade na Windows/Linux bez shell env prefiksa.
Za fokusiran browser run: `npm.cmd run test:e2e -- tests/e2e/security-production.spec.ts`.
Direktan `npx playwright test` za production test ima obavezan prethodni svež
`npm run build`; preporučene npm komande to obezbeđuju automatski.
Browser komande pokretati serijski: dele portove i Playwright `test-results`.

Production helper poziva Vite `preview` sa stvarnim `vite.config.ts`, koji
postavlja aktivnu CSP, `nosniff` i `no-referrer` kroz `preview.headers`.
Dev/HMR nije dokaz te politike. Script/connect su samo self; inline stilovi
su posebno dozvoljeni, JavaScript inline/eval nije. Backend je constructor fake,
bez `.env` loader-a, živog Gemini-ja ili test/debug HTTP endpoint-a.
Svaka izolovana browser fixture ima nove procesne admission/capacity objekte;
zahtevi unutar scenarija i dalje dele stvarnih 5/60 s i kapacitet 2.

Početni T13/T16 RED rezultati su istorijski sačuvani u
[Fazi 2](../../docs/evidence/005-phase2-handoff.md). Faza 4 zatvara rate deo,
[Faza 5](../../docs/evidence/005-phase5-handoff.md) zatvara browser prikaz i
CSP/header deo T16. Faza 6 zatvara server-secret/bundle/sentinel deo; završni
run proverava oba dela u istom checkpoint-u.
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

Konkretan raspored, komande i obrazac ljudskih potvrda:
[demo priprema](../../docs/evidence/005-phase7-demo.md). Priprema nije izveden demo.
CI koristi `npm run test:security:e2e` sa build-om, zatim direktan puni Playwright
run bez ponovnog identičnog build-a. Lokalno obe dokumentovane npm E2E komande
rade sopstveni build; ne pokretati dodatni build između njih. Poseban finalni
`npm run build` daje traženi samostalni dokaz komande.

Pre svake faze pročitati prethodni handoff, diff i fokusirane testove. Grešku
prethodne faze prvo zatvoriti, a zatim nastaviti od prvog otvorenog taska.
