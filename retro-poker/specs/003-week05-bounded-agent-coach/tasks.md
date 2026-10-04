# Tasks: Week05 bounded agent coach

**Input**: [spec.md](spec.md), [plan.md](plan.md), eventual [data model](data-model.md),
HTTP contract and eval checklist.  
**Feature**: `003-week05-bounded-agent-coach`  
**Path convention**: all paths relative to `retro-poker/`.

## Rad i evidence pravila

- Behavior task: acceptance test prvo, stvarni smisleni RED, najmanji GREEN, relevantna
  regresija. Sačuvati stvarne komande/izlaze u `docs/evidence/003-Txxx-*.txt`; ne
  prepisivati tuđi rezultat kao svoj.
- `[x]` znači da je implementacija/provera za taj task stvarno zabeležena. Spec/planning
  taskovi mogu biti čekirani tek po sadržinskoj/link proveri; nisu behavior RED/ GREEN.
- A/B oznaka je predloženi prvi driver. Članovi rade naizmenično i oboje mogu nastaviti
  task; pri handoff-u napiši šta je gotovo, šta je ostalo i stvarni sledeći korak.
  Jedan aktivni urednik po deljenom fajlu; nema paralelnih agent-runova za Core.
- Dozvoljene putanje su granica taska. Ako behavior zahteva dodatnu putanju, prvo
  dopuni task i navedi razlog; ne preuređuj nepovezane fajlove.
- Fiksni poker state, RNG, istorija i facts moraju ostati nepromenjeni kroz agent run.
- Core politika potvrđena T005: 2 modelska koraka, 1 tool execution, 4 provider
  attempts/run, do 15 s po attempt-u i 45 s ukupno; retry nije novi korak.
  Najviše 2 attempt-a po koraku, tool limit 1–10 i JSON UTF-8 cap 20480 bajtova.
  Semantika brojača/stop razloga/retention-a je u planu i data-model ugovoru.

## Phase 0 — scope i baseline

- [x] T001 (oba; prvi driver A) — Uskladiti W05 scope u `docs/GAME_SPEC.md` i
  operativne Week05 instrukcije u `AGENTS.md`; deps: nema; allowed: `docs/GAME_SPEC.md`,
  `AGENTS.md`; evidence: diff review, §13–15 i granice/ownership se slažu sa assignment
  i addendum-om. *(Dokumentaciona promena; bez RED/GREEN.)*
- [x] T002 (B; može se predati A) — SpecKit requirement review: izgraditi matricu
  FR-001–FR-025 ↔ US/acceptance ↔ predloženi testovi; deps T001; allowed: `specs/003.../spec.md`,
  `checklists/requirements.md`; evidence: svaka stavka je proverljiva, neodređenosti
  označene za odluku plana, checklist semantics razjašnjena.
- [x] T003 (A; može se predati B) — Plan, budžeti, HTTP/async ownership i testni tok;
  deps T002; allowed: `specs/003.../plan.md`, po potrebi `research.md`, `data-model.md`,
  `contracts/coach-http.md`; evidence: provider retry erasure, cap semantics, stale
  policy i handoff odgovornosti su eksplicitni.
- [x] T004 (oba; prvi driver B) — Sačuvati originalni W05 implementacioni prompt pre
  velikog koda i manifest stvarno pročitanog konteksta; deps T001–T003; allowed:
  `docs/BUILD_PROMPT_WEEK05_V1.md`, `docs/CONTEXT_MANIFEST.md`;
  evidence: prompt navodi ulogu, cilj, scope, pravila, relevantne fajlove, task limit,
  DoD, offline provere i nejasnoće; nema tajni. *(Dokumentacioni task.)*
- [x] T005 (oba) — Zaključati limit/policy odluke i feature checklist; deps T002–T004;
  allowed: spec, plan, requirements checklist, `docs/GAME_SPEC.md`; evidence: max
  steps/tool/attempt, per-call/total timeout, error taxonomy, retention i evidence
  ugovor bez kontradikcija. *(Brojke potvrđene 2026-10-04; runtime testovi tek slede.)*
- [x] T006 (A; može se predati B) — Zabeležiti tačan Week04 baseline i reprodukciju
  poznatih Week04 UX/test issue-a samo ako je konkretna; deps T004,T005; allowed:
  `docs/evidence/003-baseline.md`, log fajlovi; evidence: snapshot/HEAD, komande i
  exit status koji su stvarno izvršeni; ne klasifikovati bez reprodukcije.

**Gate:** shared spec/HTTP/schema/budget ugovor je stabilan; T004 prompt i context
manifest su sačuvani pre prve velike implementacije.

## Phase 1 — ugovori i read-only alat

- [x] T007 B — Napisati strict schema unit-testove za goal, model step discriminant,
  tool arguments/output, run DTO/status/stop reason i final evidence; deps T005;
  allowed: `tests/unit/agent-schemas.test.ts`, `tests/contract/coach-contract.test.ts`,
  `docs/evidence/003-T007-red.txt`; evidence: smisleni RED na nedostajućem ugovoru;
  unknown fields, granice i nepoznata ref rejection su oracle-i.
- [x] T008 A — Definisati deljene strict coach request/result/run-state ugovore;
  deps T007; allowed: `shared/contracts.ts`, tests T007, evidence; evidence: schema
  testovi zeleni, Week03/Week04 contracts nepromenjeni.
- [x] T009 B — Napisati tool input/output/schema projection tests za
  `get_decision_evidence`; deps T008; allowed: `tests/unit/agent-tool.test.ts`;
  dodatno allowed: `docs/evidence/003-T009-red.txt` (stvarni RED i handoff);
  evidence: enum/range/limit, prazni/agregirani facts, deterministički max bytes,
  izvorne facts ne mutiraju.
- [x] T010 A — Implementirati `get_decision_evidence` kao lokalni deterministic read-only
  tool nad eksplicitnim terminal `MatchFacts` snapshot-om; deps T009; allowed:
  `backend/src/agent/tools.ts`, eventualni facts projection helper;
  dodatno allowed: `docs/evidence/003-T010-green.txt` (GREEN/regresija i handoff);
  evidence: T009 green; nema import-a za provider, route, filesystem, network ili poker
  mutation; svaki ref iz izvora.
- [x] T011 B — Validirati tool-result semantiku/veličinu i fixture/eval skup;
  deps T010; allowed: agent validation module, `tests/unit/agent-tool.test.ts`,
  `specs/003.../evals.md`, `docs/evidence/003-T011-*.txt`; evidence: corrupted/too large/foreign refs rejected before
  model context; bar pet expected-first eval case-ova kreirano.

## Phase 2 — model adapter i bounded orchestrator

Phase 1 handoff (2026-10-04): [detaljni zapis](../../docs/evidence/003-T011-handoff.txt).
T007 [26 RED](../../docs/evidence/003-T007-red.txt) → T008
[151 GREEN/contract](../../docs/evidence/003-T008-green.txt);
T009 [23 RED](../../docs/evidence/003-T009-red.txt) → T010
[53 fokus/317 unit GREEN](../../docs/evidence/003-T010-green.txt);
T011 [8 RED + dodatni holdout](../../docs/evidence/003-T011-red.txt) →
[65 fokus GREEN](../../docs/evidence/003-T011-green.txt), [E1–E5](evals.md),
[610/610 regresija](../../docs/evidence/003-T011-regression.txt),
[typecheck](../../docs/evidence/003-T011-typecheck.txt),
[lint](../../docs/evidence/003-T011-lint.txt), [build](../../docs/evidence/003-T011-build.txt).
Svi završni exit statusi 0; prvi lint neuspeh i holdout RED očuvani.
T012+ ostaju otvoreni; nema lifecycle/provider/UI/E2E/live dokaza u ovom bloku.

- [x] T012 A — Dodati provider-neutral agent request/result ugovor i fake-response
  scripts; deps T008; allowed: `backend/src/ai/types.ts`, `tests/helpers/fake-ai-provider.ts`,
  unit tests; evidence: fake vraća tool request/refusal/final, hvata deadline/signal,
  ostali bot/analysis tests unchanged.
- [x] T013 B — Napisati Gemini adapter testove i mapiranje strukturisanih agent koraka;
  deps T012; allowed: `backend/src/ai/providers/gemini.ts`, provider tests;
  evidence: mocked HTTP only, provider details ostaju adapteru, SDK retries disabled
  or accounted; nema live poziva.
- [x] T014 A — Implementirati step orchestration, explicit run states, budgets/deadline,
  cancellation, repeat-action key i stop reasons; deps T010–T012; allowed:
  `backend/src/agent/orchestrator.ts`, `backend/src/agent/types.ts`,
  `tests/unit/agent-orchestrator.test.ts`; evidence: scripted fake + fake clock proves
  2 separate steps/1 tool, no extra call after every limit, bounded run-wide retries.
- [x] T015 B — Dodati final output schema, evidence membership validator i insufficient
  evidence policy; deps T011,T014; allowed: `backend/src/agent/validation.ts`, schemas,
  tests; dodatno allowed: `backend/src/agent/orchestrator.ts` samo za povezivanje novog final validatora (bez toga runtime ne koristi T015); evidence: fake refs/fact codes/inadequate context cannot complete successfully.
- [x] T016 A — Integration RED/GREEN: success, unknown tool/invalid args (0 tool calls),
  tool failure, malformed output, provider auth/timeout/429/5xx; deps T013–T015;
  allowed: `tests/integration/agent-run.test.ts`, fake helper, evidence; dodatno allowed: `backend/src/agent/orchestrator.ts` za preflight reviziju (T016 RED pokazuje provider/tool pozive za negativnu reviziju);
  evidence: normal success has two accepted model steps and one execution; all failures
  end with correct safe status/reason and no false final result.
- [x] T017 B — Integration RED/GREEN: repeat, attempt/tool/step limit, total deadline
  across retry + second step, cancel, stale revision, reset/new-game, concurrency;
  deps T016; allowed: integration tests; dodatno allowed: `backend/src/agent/orchestrator.ts` za terminal attempt finalizaciju i dispatch guard (T017 RED: cancellation menja attempts ili dispatch-uje poziv posle terminalnog prelaza), kao i preflight sampleLimited holdout; `GameSession` nije potreban jer signal/fingerprint/owner fixture izoluje stale/reset/concurrency;
  evidence: tool never called twice for same key; late result never commits; terminal
  state changes once.

## Phase 3 — backend lifecycle and API

Phase 2 handoff (2026-10-04): [status, komande, scope i ograničenja](../../docs/evidence/003-phase2-handoff.txt).
T012–T017 imaju stvarne RED/GREEN zapise `docs/evidence/003-T012-*.txt` do `003-T017-*.txt`.
Finalna offline regresija: 708/708 u 51 fajlu; typecheck/lint/build exit 0.
T017 ownership je injected fixture; produkcioni session slot/start/commit ostaje T019.
Nema novih HTTP/session/UI/live implementacija ili live dokaza u Phase 2.

- [ ] T018 A — Route contract RED for preflight, start/status, strict body/response,
  no-store, duplicate POST, invalid game, nonterminal, stale/new game and safe errors;
  deps T008,T016; allowed: `tests/contract/coach-routes.test.ts`;
  evidence: invalid preflight has zero provider/tool calls.
- [ ] T019 A — Wire session run lifecycle, in-memory ownership, GET status and
  abort/stale fingerprint checks; deps T017,T018; allowed: `backend/src/session.ts`,
  `backend/src/routes.ts`, `backend/src/app.ts`, shared DTO/tests;
  evidence: route tests pass and Week04 bot/analysis flows remain stable.
- [ ] T020 B — Usage/evidence aggregation distinguishes logical run, model step,
  provider attempts, tools, latency, usage and stop reason; deps T019;
  allowed: `backend/src/ai/usage.ts`, `shared/contracts.ts`, usage tests;
  evidence: step 2 is not retry; one tool is not provider call; unknown cost remains
  unknown; reset epoch ignores stale run records.

## Phase 4 — UI i end-to-end

- [ ] T021 B — UI component tests for bounded coaching goal, running, completed,
  insufficient evidence, stopped/failed and explicit retry; deps T019;
  allowed: `frontend/src/components/AnalysisPanel.tsx` or new coach component,
  `tests/ui/coach.test.tsx`; evidence: result shows only validated summary/recommendation
  and bounded evidence refs.
- [ ] T022 A — API client/App polling, duplicate-submit guard, race and status cleanup;
  deps T019,T021; allowed: `frontend/src/api.ts`, `frontend/src/App.tsx`, UI tests;
  evidence: late responses ignored, new game takes precedence, retry creates new runId.
- [ ] T023 oba (prvi driver B) — Accessibility and E2E success + rejected-tool/provider
  failure; deps T020–T022; allowed: `tests/e2e/coach.spec.ts`, component/UI fixes;
  evidence: keyboard/readable status, game snapshot preserved, rejected action shows
  safe reason, no provider prompt/reasoning leak.

## Phase 5 — converge, evidence i demo

- [ ] T024 A/B naizmenično — Run eval group and existing AI regressions, typecheck,
  lint/build, E2E; deps T023; allowed: relevant tests/scripts/log evidence only;
  evidence: exact commands/version/exit status, no claim for checks not run.
- [ ] T025 oba — Security/privacy/read-only/governance traceability review; deps T024;
  allowed: feature artifacts, code/test, `docs/GAME_SPEC.md`, `AGENTS.md`;
  evidence: tool allowlist, strict validators, provider boundary, cancellation/deadline,
  no mutation, all FR link to tests.
- [ ] T026 B/A — Add and reconcile `docs/EVIDENCE_W05.md`, `docs/AI_USAGE_LOG.md`,
  `docs/CONTEXT_MANIFEST.md`, README only where necessary; deps T024,T025;
  allowed: named docs/evidence files; evidence: real success/rejected/failure traces,
  stop reason, actual live/fake counts and real member contributions; unknown remains
  explicitly unknown.
- [ ] T027 oba — Final handoff/demo walkthrough; deps T026; allowed: evidence and
  feature task list; evidence: each member independently explains goal, tool contract,
  proposal validation, budgets, stop condition and zero tool execution on rejection;
  optional live demo stays within approved local budget and records actual outcome.

## Coverage index

| Requirement group | Tasks/tests |
|---|---|
| Spec / goal / context | T001–T006, US1 |
| Schemas, allowlist, tool and output validation | T007–T011, T015 |
| Two-step flow, provider boundary, run budget | T012–T017 |
| Endpoint/session/status/stale protection | T018–T020 |
| User-facing states and accessibility | T021–T023 |
| Evals, security, evidence and partner understanding | T024–T027 |

Dokumentacioni taskovi T001–T006 imaju sadržinski dokaz; to ne zatvara Week05
implementaciju. Handoff T002/T005 je u requirements checklist-u, T003 u planu i
data-model-u, T004 u promptu/manifestu. T006 dokaz je `docs/evidence/003-baseline.md`
sa HEAD-om, logovima i ograničenjima. Sledeći član nastavlja T007 posle provere dokaza,
bez pripisivanja ranijeg rada sebi ili drugom članu.

## Dokaz pripreme — 2026-10-04

| Task | Dokumentacioni dokaz | Stvarni status |
|---|---|---|
| T002 | [Requirements matrica](checklists/requirements.md) | 25/25 FR, kvalitet zahteva; runtime testovi nisu pokrenuti |
| T003 | [Plan](plan.md), [data model](data-model.md), [HTTP](contracts/coach-http.md) | Ugovori i async ownership zapisani; kod nije implementiran |
| T004 | [V1 prompt](../../docs/BUILD_PROMPT_WEEK05_V1.md), [manifest](../../docs/CONTEXT_MANIFEST.md) | Original očuvan, dopuna i stvarni izvori pre koda |
| T005 | [Policy](plan.md#zaključana-politika-t005), [gate](checklists/requirements.md) | Limiti 2/1/4, 15 s/45 s, 1–10, 20480 B usklađeni |
| T006 | [Baseline](../../docs/evidence/003-baseline.md) | HEAD, smoke 2/2, 552/552 regresija, typecheck exit 0; poznati kvarovi nisu aktuelno reprodukovani |

Dokaz link/FR/putanja provere i stvarni setup neuspehi su u baseline logovima;
nema izmišljenog dokumentacionog RED/GREEN ili review-a drugog člana.
