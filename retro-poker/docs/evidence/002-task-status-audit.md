# Week04 task status audit — 2026-09-28

## T001–T010 korekcija u aktuelnom worktree-u

Naknadni dependency pregled je pronašao originalni Week04 prompt u
`specs/002-week04-ai-integration/prompt.md`, commit `e5a842b`, pa je njegova neizmenjena
kopija sa provenance napomenom sačuvana na obaveznoj T002 putanji
`docs/BUILD_PROMPT_WEEK04_V1.md`. T002 zato više nije otvoren zbog navodnog odsustva
izvora. T003/T005 su dobili nove smislene behavior RED zapise, a T004/T006–T008
fokusirane GREEN/regresione provere.

T009 sada ima task-specifičan privacy/immutability RED u
`docs/evidence/002-T009-red.txt`; T010 minimalni GREEN zatim prolazi 8/8 context testova
za preflop/flop/turn/river. Završni T001–T010 fokus je 40/40, puna Vitest regresija
434/434, a typecheck/lint/build imaju exit 0. Zato su T001–T010 čekirani u aktuelnom
`tasks.md`. Ova dopuna ne menja ni ne predstavlja ranije rezultate kao da su tada bili
izvršeni.

## Why the earlier task list looked incomplete

The original `tasks.md` left nearly every checkbox unchecked when it was generated.
Implementation commits were then added without reconciling those boxes to code and
evidence. Conversely, T030–T035 were checked as a block even though T030's cited RED
record was only a missing-module/import failure, which project instructions explicitly
do not accept as a meaningful TDD RED. The checkboxes therefore did not reliably
represent either implementation or evidence status. The previous chat summary also
treated all empty checkboxes as missing implementation; that was too broad.

The checkbox rule is now explicit in `tasks.md`: a task is checked only when its
completion evidence is present. A later green test does not retroactively prove a
missing RED. Some implementation tasks are checked while their separately tracked RED
test task remains open; this records the code accurately without hiding a TDD process
gap.

## Completed task records

The following tasks are checked in `tasks.md` based on the implementation and
the linked grouped evidence: T001–T025, T027–T029, T031–T035, T038, T040–T042.

Evidence sources include:

- `002-red-tests.txt` and `002-offline-green.txt` for the initial contract, route, bot,
  analysis eligibility and UI RED/GREEN subset plus offline backend checks;
- `002-gemini-adapter.md` for SDK/config, mocked provider integration and regressions;
- `002-T030-T035-final.txt` for usage/dashboard implementation, the recorded full
  offline suite (418 unit/contract/integration/UI tests; 10/10 E2E; typecheck/lint/build)
  and its explicit partial-E2E scope;
- `002-live-smoke.md` for the manual live outcomes and latest usage-latency correction;
- `002-T001-governance.txt` and `002-T042-docs.txt` for the completed governance and
  documentation review tasks.

## Open tasks and exact reason — snapshot before 2026-09-29 reconciliation

| Tasks | Reason at the time of this earlier audit |
|---|---|
| T026 | Analysis tests/implementation exist. The recorded analysis RED covered eligibility, not the full required success/failure/retry oracle; no valid full task RED is recorded. |
| T044 | T043 je sada završen, ali finalni 100% task/evidence gate ne može proći dok T026 nema smislen istorijski RED za puni analysis oracle. Runtime ID coverage postoji; dokaz procesa nije retroaktivno fabrikovan. |

## Implementation facts versus runtime proof

The codebase contains the offline AI backend, fake provider, Gemini adapter, UI and
dashboard. Latest recorded live smoke used two real Gemini requests: bot action ended
in local fallback; analysis ended in `server_error`, with no validated result. The live
smoke is optional and its failure path behaved safely, but successful live analysis is
not demonstrated. It must not be described as a passing model-success check.

The Gemini adapter commits (`2f00d54`, then UI/usage commits through `c8f6864`) landed
before the full T036/T037 browser acceptance gate was closed. This violated the planned
phase order at the time. T036/T037 su naknadno zatvoreni proverom od 2026-09-29; SDK
i adapter su pokriveni mock testovima, pa redosled ne implicira live pozive.

No application tests were run during this documentation reconciliation. Recorded test
results above retain their original dates and scope.

## T026–T030 ponovna implementacija — 2026-09-29

- `npm.cmd test -- tests/integration/ai-analysis.test.ts` — exit 0; 9/9 testova.
  Dopunjena matrica pokriva terminal-only 202, strict success, decisionRef, odvajanje
  tada poznatih činjenica od kasnijeg ishoda, timeout/malformed/5xx, duplicate i novi
  interaction pri ručnom retry-ju. Poker result/version/stack/events ostaju deep-equal.
  Prvi validni prošireni prolaz bio je zelen, pa `002-T026-red.txt` istinito beleži da
  nema novog RED-a; T026 ostaje otvoren samo zbog istorijskog TDD/evidence kriterijuma.
- T027 backend schema/coordinator/session/view i T029 frontend request/poll/retry tok
  ponovo su provereni kroz integracione i UI testove. T028 sada ima App-level oracle:
  nema automatskog analysis POST-a, retry nastaje tek klikom i `HandResult` ostaje.
- `npm.cmd test -- tests/unit/ai-usage.test.ts` je prvo pao sa exit 1 (1 failed,
  1 passed): analysis `failed` je pogrešno povećavao `localFallbackCount` na 2 umesto
  1. Posle minimalne ispravke T030 matrica je zelena; RED je u `002-T030-red.txt`.
- Fokusirano: `npm.cmd test -- tests/ui/analysis.test.tsx tests/unit/ai-usage.test.ts
  tests/integration/ai-analysis.test.ts` — exit 0; 17/17.
- Puna regresija: `npm.cmd test` — exit 0; 36 fajlova, 501/501 test.
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build` — exit 0;
  Vite je transformisao 119 modula. Sve provere su offline i bez stvarnog API ključa.

## T031–T035 ponovna implementacija — 2026-09-29

- Novi behavior RED je imao exit 1, sa 2 pala i 15 prošlih testova: usage latency/token
  zbirovi izlazili su iz safe-integer ugovora, a frontend je prihvatao attempt bez
  obaveznog usage agregata. Stvarni izlaz i korekcije su u `002-T030-T035-final.txt`.
- Store sada saturira javne count/sum vrednosti na `Number.MAX_SAFE_INTEGER`, a frontend
  koristi deljeni strict `UsageResponseSchema`, čime se uklanja schema drift.
- T032 oracle sada resetuje metrike uz stvarni nepromenjeni game snapshot, proverava
  revision +1 i odbija ponovljen isti `expectedRevision`. T034 matrica eksplicitno
  proverava known/partial/unknown usage i unknown cost.
- Fokusirani skup: 23/23; puna Vitest regresija: 504/504; Playwright: 10/10;
  typecheck/lint/build: exit 0. T031–T035 ostaju opravdano čekirani.

## T036–T040 ponovna implementacija — 2026-09-29

- T036 browser tok sada pokriva AI toggle, waiting→terminalni model outcome, analysis
  failure, eksplicitan retry kao novu uspešnu interakciju, strukturisan rezultat,
  dashboard agregate i nezavisna game/usage resetovanja. Fokusirani E2E: 1/1.
- Smisleni T037 RED otkrio je da UI nije poll-ovao bot turn pre objave `ai.active`, a
  zatim i kontradikciju terminalnog showdown DTO validatora za eliminisanog igrača.
  Minimalne korekcije čuvaju GET-only polling i parent hidden-card zaštitu.
- T038 manifest/lock ostaju tačno na `@google/genai` 2.24.0. Novi T039 behavior RED
  otkrio je nevalidan usageMetadata; T040 ga sada normalizuje na unknown/null bez raw
  persistence. Adapter ostaje bez session/engine importa i bez logovanja.
- Završno: Vitest 505/505, Playwright 10/10, typecheck/lint/build exit 0.
  T036–T040 su sada kompletni i čekirani; svi testovi su offline.

## T041–T044 završni pregled — pre-reconciliation snapshot, 2026-09-29

- T041 DI wiring je ponovo potvrđen mocked adapter testom: test app ne kreira live
  provider bez eksplicitne injekcije, missing/invalid config ostaje offline.
- T042 dokumentacija je usklađena sa stvarnim fixed-two-attempt ugovorom; uklonjen je
  nepostojeći `GEMINI_MAX_ATTEMPTS` env override iz README-a, `.env.example` i smoke
  uputstva.
- T043 quickstart fokus grupe prolaze 20/20, 48/48, 37/37, 12/12 i 35/35. Puna
  matrica je Vitest 505/505, Playwright 10/10, typecheck/lint/build exit 0. Dokaz je
  `002-T043-final.txt`; sve automatske provere su offline.
- T044 consistency inventar potvrđuje checklist 26/26 i prisustvo svih FR/AIAC/SC ID-jeva,
  ali ostaje nečekiran zbog otvorenog T026 TDD/evidence gap-a. Detalji su u
  `002-T044-traceability.txt`.

## T026/T044 dodatna provera — pre-reconciliation snapshot, 2026-09-29

- T026 sada ima 13 scenarija: stvarni terminalni showdown umesto ručno promenjenog
  statusa, konkretno tadašnje znanje/ishod, reference u obe liste, strict dodatna
  polja/disclaimer i zaista pending timeout kroz FakeClock. Produkcioni kod nije menjan.
- Nova regresija: 509/509 u 36 fajlova; typecheck i lint exit 0. Stvarni izlazi su
  u `002-T026-red.txt`. E2E/build nisu ponavljani; raniji rezultat ostaje istorijski.
- T044 sada sadrži konkretnu zahtev/task/test mapu (27 FR, 16 AIAC, 10 SC), kao i
  izvršenu strukturnu proveru svih 44 taska: owner/deps/paths/evidence, bez ciklusa;
  checklist 26/26. Prisustvo ID-ja samo po sebi nije dokaz funkcionalnosti.
- T026 i T044 ostaju otvoreni. Nedostajući istorijski puni RED ne može se nadomestiti
  naknadnim zelenim testom ni setup greškom. Čekirani zavisni taskovi označavaju
  funkcionalni rad, uz ovo eksplicitno procesno ograničenje; ne potvrđuju originalni
  test-first redosled. Izuzetak od tog kriterijuma nije automatski pretpostavljen.

## Konačna reconciliation odluka — 2026-09-29

Na korisnikov izričit zahtev kriterijum za već implementiran T026 je izmenjen:
potpuna aktuelna behavior matrica, relevantna zelena regresija i eksplicitna napomena
da istorijski RED nedostaje. To ne tvrdi savršen istorijski TDD. T026 je čekiran po
izmenjenom kriterijumu.

T044 je čekiran posle zahtevu/task/test mape (FR 27/27, AIAC 16/16, SC 10/10),
strukturne provere 44 taska i dependency DAG-a, checklist 26/26 i aktuelnih test,
typecheck, lint i build rezultata. Playwright E2E nije ponovljen; stariji 10/10 ostaje
u T043 evidence i ovde nije pripisan novom prolazu. Konačni status je u
`002-T026-red.txt` i `002-T044-traceability.txt`.
