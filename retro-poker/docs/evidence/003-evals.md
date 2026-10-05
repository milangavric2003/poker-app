# T024 — očekivanja pre izvršenja

Datum: 2026-10-05 (Europe/Belgrade). Snapshot HEAD:
`83cb2c2531934f2dd6fc5da1d0e4ab921b57309d`; početni worktree čist.
Nema promene produkcionog koda ili test oracle-a. Default je offline fake/mock.

| Scenario | Unapred očekivani ishod | Postojeći test/scenario |
|---|---|---|
| Normalan uspeh | completed, 2 steps, 2 provider attempts, 1 tool execution; poker/facts isti | integration/agent-run.test.ts: completes two accepted steps |
| Unknown tool | stopped/unknown_tool, toolCallCount === 0, executor nije pozvan | integration/agent-run.test.ts: rejects unknown_tool before executor |
| Invalid arguments | stopped/invalid_tool_arguments, toolCallCount === 0 | integration/agent-run.test.ts: rejects invalid_arguments before executor |
| Provider/tool failure | failed/provider_failed ili tool_failed, result=null; bez sirovih grešaka, nema replay-a | integration/agent-run.test.ts: safe failure matrix; tool exception |
| Repeated action | stopped/repeated_action, samo jedno izvršenje | integration/agent-run.test.ts: same canonical proposal |
| Step limit/deadline | stopped/step_limit ili deadline; nema dodatnog poziva; late odgovor ignorisan | integration/agent-run.test.ts: narrowed guard; shares deadline |
| Invalid final evidence | failed/malformed_output, evidence_rejected, result=null | integration/agent-run.test.ts: invalid_final; unit/agent-final.test.ts |
| Insufficient evidence | stopped/insufficient_evidence; aggregate-only preflight 0 provider/0 tool | integration/agent-run.test.ts: aggregate-only preflight |
| Stale/new game | stale_state/cancelled; novi snapshot nepromenjen, stari rezultat se ne objavljuje | integration/agent-run.test.ts; integration/coach-lifecycle.test.ts: releases serial lock |
| Duplicate start/commit | jedan aktivan run i jedan terminalni commit; duplicate POST isti runId | integration/agent-run.test.ts: duplicate starts; contract/coach-routes.test.ts; integration/coach-lifecycle.test.ts |

Fokus: provereni nazivi postojećih unit/contract/integration/UI testova, zatim
puni `npm.cmd test` za Week04 AI i game/engine regresiju, puni E2E, typecheck,
lint i build iz package.json. Očekivanje svih skupova: exit 0, bez preskakanja.
Rezultat će biti dodat posle izvršenja; ovaj zapis nije PASS.

Granice: fake/mock uspeh ne dokazuje dostupnost Gemini-ja, kvalitet saveta,
stvarni screen reader ili ljudski peer review. Live nije autorizovan niti pokrenut.

Rezultat 2026-10-05: svih10 scenarija prošlo u
[250/250 fokusiranih testova](003-T024-focus.txt),14 fajlova,exit0;
[puna regresija](003-T024-regression.txt)802/802,57 fajlova,exit0.
Osam dodatnih safe trace projekcija ima stvarne assertion-e i
[zabeležen izlaz](003-T024-traces.txt); deadline/stale/duplicate provereni su
postojećim integration testovima, ne dodati među osam trace redova.
[Handoff](003-T024-handoff.txt) razlikuje prvi12/13 E2E neuspeh zbog starog card
lokatora od ponovljenog13/13,exit0. Typecheck/lint/build završnoexit0; prethodni
setup/fixture neuspehi ostaju zapisani. T025/T029 naknadna mala ISO korekcija daje
[803/803 regresiju](003-T025-regression.txt),91/91 fokus i4/4 relevantni E2E,
typecheck/lint/build0, bez promene zaključanih očekivanja ovih eval-a.
