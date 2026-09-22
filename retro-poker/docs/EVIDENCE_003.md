# Evidence Week03 — blok člana A

Početno stanje2026-09-21: samo specifikacije, bez package.json i aplikacije.
Polazni HEAD a63699d77237f12e231b2b10ec1016fd447b20e1.
Korisnik je odobrio A deo implementacije; B evaluator/frontend ostaju kolegi.

T001: BUILD_PROMPT_V1 i početni manifest/log/eval sačuvani pre aplikacionog koda.
Rezultati dopunjeni 2026-09-22: setup, ugovori i betting modul implementirani.
Završeni tehnički artefakti T001–T005 i T008–T009; zajedničke pripreme
urađene su iz ugla A, bez tvrdnje o koleginom doprinosu ili review-u.

## Stvarni RED → GREEN ciklusi

Testovi koriste unapred zadate ulaze i očekivanja. Najmanje promene bile su
implementacija ulaznih šema, izlaznih šema, osnovnog betting-a, pa prava
ponovnog podizanja uloga. Importabilni početni stubovi sačuvani su uz logove.

| Ciklus | RED | GREEN |
|---|---|---|
| Ulazni ugovori | [21 pada, 34 prolaze](evidence/T003-input-red.txt) | [55 prolaze](evidence/T004-input-green.txt) |
| Izlazni ugovori | [24 pada, 76 prolaze](evidence/T003-output-red-full.txt) | [100 prolaze](evidence/T004-output-green.txt) |
| Osnovni betting | [14 pada](evidence/T008-basic-red.txt) | [14 prolaze](evidence/T009-basic-green.txt) |
| Reopening i granični slučajevi | [3 pada, 18 prolaze](evidence/T008-reopening-red.txt) | [21 prolazi](evidence/T009-reopening-green.txt) |

## Provere i ograničenja

- Node 24.20.0, npm 11.19.0; tačne zavisnosti u package-lock.json.
- `npm test`: [121 test prolazi u 3 fajla](evidence/A-final-tests.txt), exit 0.
- `npm run typecheck`: [exit 0](evidence/A-final-typecheck.txt).
- `npm run lint`: [exit 0](evidence/A-final-lint.txt).
- `npm run build`: [exit 0](evidence/A-final-build.txt); build setup-a, ne kompletne igre.
- Posle provere fixture-a korigovani su samo stackovi drugih igrača u četiri
  betting primera radi doslednog ukupnog broja žetona; AC očekivanja iznosa,
  prava poteza i ishoda nisu oslabljena. Testovi (121), typecheck i lint ponovljeni: exit 0.
- `npm run dev`: Vite na 127.0.0.1:5173 vraća 200 i setup stranicu;
  Fastify na 127.0.0.1:3001 vraća očekivani 404 za `/`, jer game rute još ne postoje.
  Oba procesa ugašena posle provere; portovi provereno zatvoreni.
- Ograničenja sandbox-a pri instalaciji i pokretanju procesa rešena su dozvoljenim
  ponovnim pokretanjem. To nisu RED dokazi ponašanja igre.
- E2E, kompletna igra i instalacija na koleginom računaru nisu provereni.

Sledeći A zadatak T010 zavisi od koleginog evaluatora T006–T007.
Backend API, botovi, tok ruke i session logika još nisu implementirani.
RED stubovi nisu stvarni raniji propust E4 niti integrisani baseline.

Integrisani baseline, screenshot, stvarni E4 propust, kontrolisana promena,
holdout i ponavljanje na koleginom računaru još ne postoje.
Nema tvrdnje o završenoj Week03 igri niti koleginom review-u.
