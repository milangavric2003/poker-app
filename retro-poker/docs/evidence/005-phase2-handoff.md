# Faza 2 — T005–T007 handoff

2026-10-26, Europe/Belgrade. Driver: Codex u sesiji sa Vekijem.
Checkpoint: `d08e06c95f8051e12e15a8e80e9d950de5b3333b`, `week08-init` +
necommitovane izmene ove faze. Početni status čist; bez commit/push/merge-a.
T005, T006 i T007 završeni. Ovo nije završeno bezbednosno ojačavanje.

## Prethodna faza

[Preflight](005-phase2-preflight.json) potvrđuje svih pet prenetih hash-eva i lockfile.
`git diff d08e06c 96fb971 -- backend frontend shared package.json package-lock.json`
pre novih izmena bio je prazan. T004 prompt i dokazi su prisutni; pregledani su
spec/plan/tasks/ugovori, checklist 9/9, bez extensions.yml i pre/post hook-ova.
Prvi prerequisites pokušaj blokirala je PowerShell execution policy; ponovljen
propisanim `powershell -NoProfile -ExecutionPolicy Bypass -File` pozivom, exit 0,
feature 005 pravilno razrešen. To nije aplikacioni niti security pad.

## Implementacija i sačuvani ulazi

[Očekivanja i prvi setup padovi](005-phase2-expectations.md) čuvaju konkretan
špil/akciju/goal, fake-time raspored, maliciozne nazive i browser marker.
Očekivanja su bila izražena u testovima pre pokretanja; ovaj zapis ih objedinjuje
i objašnjava ispravku pogrešnog početnog oracle-a i setup-a. Izvor je
`tests/helpers/security-fixtures.ts`; SHA256 i ostali ulazi su u
[fixture manifestu](005-phase2-fixtures.json). Ponoviti iste ulaze posle kontrola;
dinamični resource UUID/port se ponovo vežu, nisu promena napadačkog payload-a.

Zajednički fixture koristi postojeće FakeAiProvider, FakeClock, ac23Deck i
sequenceRandom. Stvarni getDecisionEvidence executor ima odvojenu instrumentaciju
ulaska, koja zatim poziva produkcioni executor; broj iz DTO-a nije oracle.
Node helper koristi produkcione registerRoutes/schema/session/orchestrator/
tool/final validatore, uz pristup kanonskom stanju u procesu. Ne tvrdi da testira
app onRequest/body/media/origin hook-ove; to je T008. Browser helper koristi
buildApp sa eksplicitnim fake konfiguracijama i stvarni Vite preview config.
Ne dodaje security zaglavlja. Nema kopije postojećeg velikog server harness-a.

## Izvršene provere

Sve komande iz retro-poker/, Windows Node 24/npm 11; nema .env ili pravih ključeva.

| Komanda | Actual / exit | Sačuvan izlaz |
|---|---|---|
| `npm.cmd test -- tests/integration/ai-failures.test.ts tests/integration/gemini-live-smoke.test.ts tests/integration/coach-lifecycle.test.ts tests/contract/coach-routes.test.ts` | PASS 57/57, 4 fajla; 0 | [preflight](005-phase2-preflight-tests.txt) |
| `npm.cmd run test:e2e -- tests/e2e/recovery.spec.ts` | PASS 6/6; 0 | [recovery](005-phase2-recovery.txt) |
| `npm.cmd test -- tests/integration/security-normal.test.ts tests/integration/security-tools.test.ts tests/integration/security-admission.test.ts` prvi | FAIL 5/5 zbog test setup-a; 1; nije security RED | [prvi](005-phase2-security-first.txt) |
| Ista node komanda posle popravke fixture-a | T00 + 3 T07 PASS, T13 RED; 1 | [baseline](005-phase2-security-baseline.txt) |
| `npm.cmd run test:security` | 4 PASS / 1 očekivan FAIL, sva 3 node fajla; 1 | [komanda](005-phase2-security-command.txt) |
| `npm.cmd run build` | PASS; 0 | [build](005-phase2-build.txt) |
| `npm.cmd run test:e2e -- tests/e2e/security-production.spec.ts` prvi | FAIL pogrešan UI locator; 1; nije security RED | [prvi browser](005-phase2-production-first.txt) |
| Ista browser komanda sa ispravnim locator-om | smislen T16 RED; 1 | [production baseline](005-phase2-production-baseline.txt) |
| `npm.cmd test` | 910 PASS / 1 očekivan T13 FAIL, 65 fajlova; 1 | [full](005-phase2-full-tests.txt) |
| `npm.cmd run typecheck` | prvi exit 2 zbog tipa špila; posle as const PASS exit 0, final ponovljen PASS | [prvi](005-phase2-typecheck-first.txt), [final](005-phase2-typecheck-final.txt) |
| `npm.cmd run lint` | prvi exit 1 zbog dve unused promenljive; eksplicitna poker projekcija zatim PASS exit 0 | [prvi](005-phase2-lint-first.txt), [final](005-phase2-lint.txt) |

Full node/UI suite je pokrenut jednom da proveri uključivanje novih security
testova kroz običan npm test i razlikuje otvoren T13 od regresije; svih 906
ranijih testova prolazi. Nije ponavljana puna browser suite.
Preflight `gemini-live-smoke.test.ts` je offline HTTP stub, bez živog servisa.
Dokumentaciona provera: 43 lokalna linka, nula nevažećih, `git diff --check`
exit 0; [validation JSON](005-phase2-validation.json). Ignorisani generisani
browser trace nije jedini dokaz: actual header/marker/request brojači sačuvani
su u versionisanom production-baseline tekstualnom izlazu.

## Početni security actual, pre hardening-a

| Scenario / invarijanta | Actual i brojači | Status i granica dokaza |
|---|---|---|
| T00 / I4,I8 | terminal lost, stack [0,2000], completed; model/provider 2, stvarni executor 1; validan evidence; poker projekcija identična; coach usage run 1/tool 1 | PASS; sintetički lokalni tok, ne kvalitet live saveta |
| T07 / I3,I4 | shell, constructor, toString: svaki provider 1/tool 0, unknown_tool/null final, poker identičan; dozvoljeni retry completed, ukupno provider 3/tool 1 po varijanti | PASS; početni dokaz postojeće kontrole, posle još NOT RUN |
| T13 / I6 | vremena [0,1000,2000,3000,4000,5000], svih šest 202 i različiti ID-i, svih šest completed; accepted 6/provider 12/tool 6, poker identičan | RED: nedostaje planirani 5/60 s limit. Očekivano 5/10/5 + šesti 429; bez overlap/reset/recovery/analysis matrice iz T015 |
| T16 / I5 | probe GET 200, kontrolni browser marker true; normalna app/igra radi; app marker true, violations [], nema CSP zaglavlja, script zahtevi 2→3 | RED: dostupni script izvršen bez CSP. Nije 404/server failure; bez bypassCSP, bez helper zaštite. Sentinel/coaching/desktop-mobile završna matrica ostaje T021/T025 |

Početni RED rezultati su namerno aktivni assertions bez skip/todo/test.fails.
T006/T007 isporučuju merljiv nalaz, ne popravku kontrole. Trenutno nema
neočekivanog preostalog setup/regression pada koji sprečava ovaj handoff.
Zaštita rate-a ostaje T015/T016, CSP T021/T022. Finalni T07/T13/T16 nisu zatvoreni.

## Sledeće i ograničenja

Prvi sledeći task: **T008**, HTTP negativni testovi. T008 i kasniji nisu započeti.
`test:security:e2e` nije uveden (T022); tačna početna browser komanda je u tabeli.
Nema runtime/frontend/lockfile promena, novih zavisnosti, live AI poziva, čitanja
.env, audita, clean npm ci, remote CI, nezavisnog ljudskog review-a ili demo-a.
Portovi su korišćeni samo dok su testovi radili i helper zatvara sopstvene servere.
Plan i stariji evidence pasusi ostaju istorija pripreme; novi T007 status i stvarne
komande su u quickstart-u i ovom zapisu. Potrošnja/model identitet nisu dostupni.
