# Evidence Week03 — blok člana A

Početno stanje2026-09-21: samo specifikacije, bez package.json i aplikacije.
Polazni HEAD a63699d77237f12e231b2b10ec1016fd447b20e1.
Tadašnji scope: korisnik je odobrio A deo implementacije; evaluator/frontend bili su ostavljeni kolegi. Aktuelni zahtev za T006–T007 zabeležen je ispod.

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

T010 zavisi od evaluatora T006–T007 (završen u narednom bloku ispod); T010 ostaje otvoren.
Backend API, botovi, tok ruke i session logika još nisu implementirani.
RED stubovi nisu stvarni raniji propust E4 niti integrisani baseline.

Integrisani baseline, screenshot, stvarni E4 propust, kontrolisana promena,
holdout i ponavljanje na koleginom računaru još ne postoje.
Nema tvrdnje o završenoj Week03 igri niti koleginom review-u.

## T006–T007 — evaluator, član A, 2026-09-22

Korisnik u ovom chatu izričito preuzima T006–T007 kao član A. Prompt ovog bloka:
raditi iz retro-poker, pročitati pravila/specifikacije/tipove/helpere, sačuvati postojeće
izmene, napisati EV01–EV10 i dodatne kategorične/granične/negativne testove pre
implementacije, zabeležiti stvarni RED, zatim enumerisati pet karata za GREEN;
pokrenuti fokusirane testove, npm test, typecheck, lint i build ako je pogođen;
ažurirati samo završene taskove i dokaze, bez T010+ i bez izmišljenog koleginog review-a.

Polazni Git HEAD: `ffc70ceae12962cf5cbd0487ab66044485e9ceaf`; worktree čist.
Git koren je `D:/AIBootcamp/week3-4`, projektni koren njegov `retro-poker` poddirektorijum.
Nisu menjani postojeći T001–T005/T008–T009 kod, helper-i, poker zahtevi ili zavisnosti.

Tvrdnja: FR-009, R7 i evaluatorski deo AC14/AC15 rade za 5/6/7 jedinstvenih karata.
Signal/hipoteza: evaluator ne postoji; importabilni stub treba da otkrije nedostajuću
evaluaciju, poređenje i runtime validaciju kroz unapred zadate oracle-e.
Najmanja promena: `rank` vraća `{ category, kickers }`, `compareRanks` poredi
leksikografski; `rank` enumeriše 1/6/21 kombinaciju pet karata, bez suit tiebreak-a.
Očekivanja potiču iz postojećih ručnih `evaluatorOracles` i eksplicitnih dodatnih
test podataka, nikada iz funkcije pod testom. Test ulaz ostaje nepromenjen.

| Provera | Stvarni rezultat / dokaz |
|---|---|
| `npm.cmd test -- tests/unit/evaluator.test.ts` — RED | [96 pada, exit 1](evidence/T006-red.txt); [importabilni stub](evidence/T006-rank-red-stub.txt), bez import/setup greške |
| Ista komanda — prvi GREEN | [96 prolazi, exit 0](evidence/T007-green.txt) |
| `npm.cmd test` | [217 prolazi u 4 fajla, exit 0](evidence/T007-test.txt) |
| `npm.cmd run typecheck` | [exit 0](evidence/T007-typecheck.txt) |
| `npm.cmd run lint` — prva provera | [exit 1](evidence/T007-lint.txt), prelom reda između dva poziva `it.each` |
| Fokusirani test, ceo skup, typecheck, lint posle korekcije formatiranja | [96/217 testova prolazi, sve exit 0](evidence/T007-final-checks.txt) |
| `npm.cmd run build` | [exit 0](evidence/T007-build.txt); novi evaluator ulazi u backend build |

RED je ponovljiv privremenim vraćanjem sadržaja sačuvanog stuba u `rank.ts`
i pokretanjem navedene fokusirane komande; testovi imaju iste oracle-e kao GREEN.
Jedina izmena nakon prvog GREEN-a jeste formatiranje `it.each` poziva za lint.
Nije bilo promene očekivanja niti funkcionalnog refaktorisanja.
Node `24.20.0`, npm `11.19.0`. Spec Kit prerequisite skripta prvobitno blokirana
PowerShell execution policy-jem; poziv sa procesnim `-ExecutionPolicy Bypass` uspešan.
Prvi sandbox pokušaj upisa evidence logova bio je odbijen; ponovljen je uz
odobrenu eskalaciju. Neuspeh okruženja nije prikazan kao RED dokaz.

Ograničenja: nije izvršeno iscrpno testiranje svih poker kombinacija, E2E niti
showdown/raspodela potova kroz igru. AC14 ovde dokazuje jednak rank, ne isplatu.
T010+ nisu implementirani. RED stub nije E4 propust. T006–T007 su završeni;
Week03 kao celina nije završena. Član A zadao je scope, Codex je napisao kod/testove
i izvršio navedene provere; kolegin doprinos i ljudski review nisu potvrđeni.

## T010–T013 — potovi i settlement, član A, 2026-09-22

Polazno stanje: čist worktree; T006–T009 potvrđeni fokusiranom regresijom 117/117.
Checklist je 16/16, a Spec Kit prerequisite je uspeo uz process-scoped
`-ExecutionPolicy Bypass`. Scope je bio isključivo T010–T013; T014+ nije menjan.

Prvi ciklus dokazuje AC11–AC13: slojevi 300/300, refund120 + pot160, foldovani
doprinos u potu, više tied side potova, neparni žeton od prvog mesta levo od button-a
i idempotentan settlement. Drugi ciklus povezuje ledger sa river/all-in/fold završetkom,
resetuje doprinose, računa neto promene zbira0 i tek posle isplate postavlja rezultat,
`complete`, eliminacije i status partije.

| Provera | Stvarni rezultat / dokaz |
|---|---|
| T010 RED — `npm.cmd test -- tests/unit/pots.test.ts` | [5 pada, 1 prolazi](evidence/T010-red.txt), exit1 zbog importabilnog `Not implemented` stuba |
| T011 GREEN / regresija | [6/6](evidence/T011-green.txt) i [123/123](evidence/T011-regression.txt), exit0 |
| T012 RED — hand + invariants | [9 pada, 2 prolaze](evidence/T012-red.txt), exit1 zbog importabilnog `Not implemented` stuba |
| T013 prvi pokušaj | [parser pad](evidence/T013-first-green-failed.txt); sačuvan, nije predstavljen kao GREEN |
| T013 GREEN / regresija | [11/11](evidence/T013-green.txt) i [134/134](evidence/T013-regression.txt), exit0 |
| `npm.cmd test` | [234/234 u 7 fajlova](evidence/T010-T013-final-test.txt), exit0 |
| `npm.cmd run typecheck` | [exit0](evidence/T010-T013-final-typecheck.txt) |
| `npm.cmd run lint` | [exit0](evidence/T010-T013-final-lint.txt) |
| `npm.cmd run build` | [exit0](evidence/T010-T013-final-build.txt) |

Prva završna provera imala je samo TypeScript suženje `reason` tipa i zato build pad;
[typecheck](evidence/T010-T013-first-final-typecheck-failed.txt) i
[build](evidence/T010-T013-first-final-build-failed.txt) logovi su sačuvani. Ispravka
je bila type-only anotacija union-a, bez promene ponašanja; kompletan set je ponovljen.
Nema tvrdnje o ljudskom review-u, E2E-u ili završenoj Week03 igri. T014 i kasniji
lifecycle/dealing/API taskovi ostaju otvoreni. Potrošnja i cena AI poziva nisu dostupne.
