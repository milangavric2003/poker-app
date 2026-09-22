# Quickstart i validacioni demo

Status: budući postupak nakon implementacije. Danas ne postoje package.json,
aplikacija ili test runner; sledeće komande nisu tvrdnja da su već prošle.

## Preduslovi i setup

Radni direktorijum: D:\AIBootcamp\week3-4\retro-poker.
Node24/npm11; pri setup-u zabeležiti tačne verzije i zaključati zavisnosti.
Na ovom računaru tokom planiranja pročitani su Node24.20.0 i npm11.19.0.

Prvi autor setup-a u T002 kreira package.json i pokreće npm install za lockfile.
Drugi član i ponovljive provere koriste:

```powershell
cd D:\AIBootcamp\week3-4\retro-poker
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run dev
```

Instalacija paketa i browser-a zahteva internet samo tokom setup-a.
Igra posle toga radi offline. npm.cmd/npx.cmd izbegavaju PowerShell .ps1 execution-policy problem.
Otvoriti http://127.0.0.1:5173; backend je na127.0.0.1:3001.
Oba procesa moraju ostati na loopback-u i prijaviti zauzet port; bez tihog menjanja porta.
Ctrl+C prekida oba development procesa. Restart backend-a resetuje igru.

## Komande koje T002 mora obezbediti

| Komanda | Planirano značenje |
|---|---|
| npm run dev | Vite i tsx backend zajedno, gašenje oba procesa |
| npm test | Vitest run: unit, contract, integration i UI; bez watch-a |
| npm run test:e2e | Playwright Chromium, lokalni fixture harness |
| npm run typecheck | tsc --noEmit za frontend/shared i backend/shared odgovarajućim konfiguracijama |
| npm run lint | ESLint nad izvorima, testovima i konfiguracijom |
| npm run build | Vite frontend i tsc backend/shared u dist |
| npm run start | Lokalni izgrađeni backend; frontend se za proveru služi preview komandom |
| npm run preview | Vite preview127.0.0.1:5173 sa /api proxy-jem ka backend-u |

Za fokusiran test koristiti npm.cmd test -- tests/unit/betting.test.ts.
RED mora pasti zbog konkretnog nedostajućeg ponašanja, ne nepostojećeg runner-a/importa.

## Scenariji za proveru

1. Pokrenuti pet botova: šest mesta, dve sopstvene karte, ukupno6000 sa ulozima.
   Odigrati ruku, pročitati isplate i ručno pokrenuti sledeću.
2. Pokrenuti jednog bota: proveriti button/SB pre-flop, BB post-flop.
   Kontrolisani AC23 iz [fixtures.md](fixtures.md) daje završne stackove1010/990;
   to je E2E fixture, obična nasumična partija nema taj garantovan ishod.
3. Pregledati [contracts/http.md](contracts/http.md); poslati nevalidan botCount6
   uz odgovarajući uslovni header. Očekivati400, postojeća igra nepromenjena.
4. U kontrolisanom stanju pokušati check uz dug, kratak raise i duplu reviziju.
   Prikazati domensko odbijanje i očuvanje stanja.
5. Prikazati AC11 side pot i AC21 prelaz heads-up kroz test fixture rezultate.
6. Osvežiti stranicu: trenutna partija ostaje. Restartovati backend: prazna partija.
   Izgubljen odgovor ne sme dovesti do automatskog ponavljanja mutacije.
7. Na1280×720 proći kontrole tastaturom i mišem; screenshot i bez horizontalnog skrola.
8. Proveriti da nema mrežnih zahteva van loopback-a, tuđih skrivenih karata
   ili produkcionog set-deck endpoint-a.

## Dokazi predaje

Sačuvati stvarne RED/GREEN komande i exit kodove u docs/evidence/.
Pre ciljane popravke zamrznuti baseline snapshot, prompt, kontekst i screenshot.
E1 tipična ruka, E2 granični botCount1/5, E3 nevalidan ulaz, E4 stvarni nalaz;
isti uslovi i eval pre/posle, plus holdout koji nije korišćen za doradu.
Ako E4 nije pronađen, kriterijum ostaje otvoren; ne praviti bug radi predaje.
Drugi član ponavlja instalaciju i provere, sam beleži rezultat i svoj doprinos.

Pokrenuti sve provere iz tabele (osim serverskih dugotrajnih komandi koje služe demou),
sačuvati izlaze, verzije i poznata ograničenja u EVIDENCE_003 i AI_USAGE_LOG.
DoD ostaje [GAME_SPEC §11](../../docs/GAME_SPEC.md); ovaj vodič ga ne zamenjuje.

