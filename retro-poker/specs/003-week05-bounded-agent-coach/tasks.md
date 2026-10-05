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

- [x] T018 A — Route contract RED for preflight, start/status, strict body/response,
  no-store, duplicate POST, invalid game, nonterminal, stale/new game and safe errors;
  deps T008,T016; allowed: `tests/contract/coach-routes.test.ts`;
  evidence: invalid preflight has zero provider/tool calls.
- [x] T019 A — Wire session run lifecycle, in-memory ownership, GET status and
  abort/stale fingerprint checks; deps T017,T018; allowed: `backend/src/session.ts`,
  `backend/src/routes.ts`, `backend/src/app.ts`, shared DTO/tests;
  evidence: route tests pass and Week04 bot/analysis flows remain stable.
- [x] T020 B — Usage/evidence aggregation distinguishes logical run, model step,
  provider attempts, tools, latency, usage and stop reason; deps T019;
  allowed: `backend/src/ai/usage.ts`, `shared/contracts.ts`, usage tests;
  evidence: step 2 is not retry; one tool is not provider call; unknown cost remains
  unknown; reset epoch ignores stale run records.

## Phase 4 — UI i end-to-end

- [x] T021 B — UI component tests for bounded coaching goal, running, completed,
  insufficient evidence, stopped/failed and explicit retry; deps T019;
  allowed: `frontend/src/components/AnalysisPanel.tsx` or new coach component,
  `tests/ui/coach.test.tsx`; evidence: result shows only validated summary/recommendation
  and bounded evidence refs.
- [x] T022 A — API client/App polling, duplicate-submit guard, race and status cleanup;
  deps T019,T021; allowed: `frontend/src/api.ts`, `frontend/src/App.tsx`, UI tests;
  evidence: late responses ignored, new game takes precedence, retry creates new runId.
- [x] T023 oba (prvi driver B) — Accessibility and E2E success + rejected-tool/provider
  failure; deps T020–T022; allowed: `tests/e2e/coach.spec.ts`, component/UI fixes;
  evidence: keyboard/readable status, game snapshot preserved, rejected action shows
  safe reason, no provider prompt/reasoning leak.

## Phase 5 — converge, evidence i demo

- [x] T024 A/B naizmenično — Run eval group and existing AI regressions, typecheck,
  lint/build, E2E; deps T023; allowed: relevant tests/scripts/log evidence only;
  evidence: exact commands/version/exit status, no claim for checks not run.
- [x] T025 oba — Security/privacy/read-only/governance traceability review; deps T024;
  allowed: feature artifacts, code/test, `docs/GAME_SPEC.md`, `AGENTS.md`;
  evidence: tool allowlist, strict validators, provider boundary, cancellation/deadline,
  no mutation, all FR link to tests.
- [x] T026 B/A — Add and reconcile `docs/EVIDENCE_W05.md`, `docs/AI_USAGE_LOG.md`,
  `docs/CONTEXT_MANIFEST.md`, README only where necessary; deps T024,T025;
  allowed: named docs/evidence files; evidence: real success/rejected/failure traces,
  stop reason, actual live/fake counts and real member contributions; unknown remains
  explicitly unknown.
- [ ] T027 oba — Final handoff/demo walkthrough; deps T026; allowed: evidence and
  feature task list; evidence: each member independently explains goal, tool contract,
  proposal validation, budgets, stop condition and zero tool execution on rejection;
  live dokaz je zaseban T030 prema assignment §31 i korisnikovom odobrenju;
  runner ne potvrđuje ljudski walkthrough ni prihvatanje handoff-a.

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

Phase 3 allowed dopuna: T018/T019 evidence i lifecycle integration test; T020 minimalni session wiring i agent counter tipovi/orchestrator radi brojanja odbijenih tool proposals. HTTP ugovor usklađen na /:runId po korisničkom zahtevu. T018 RED 21 assertion failure, 003-T018-red.txt; handoff T019: rute nedostaju, prethodni fokus 133/133 exit0.


T019 handoff T020: 64/64 route/lifecycle/Week04 fokus exit0, typecheck exit0. Prvi GREEN 62/64: insufficient HTTP status behavior i pogrešan fake helper naziv; helper/setup neuspeh nije RED. Allowed orchestrator dopuna: synchroni no-evidence preflight za HTTP 200 bez dispatch-a. Network await van serial; jedan bounded slot, UUID/current fingerprint/abort/terminal guard.


Phase 3 završeno: T018–T020 dokaz je docs/evidence/003-phase3-handoff.txt. Finalno758/758 testova (54 fajla), typecheck/lint/build exit0; svi RED/početni neuspehi sačuvani. T019 lock holdout popravljen queued reservation barijerom; provider/tool await van lock-a. T020 odvojeni coach brojači/validation/stop/epoch, Week04 semantika očuvana. T021–T023 ostaju otvoreni; UI/E2E/live nisu pokrenuti niti implementirani. Phase3 dokumentacija/evidence/manifest/usage-log su dozvoljene prateće putanje.

Phase4 T021 handoff: 16 assertion RED (prazan tipizirani panel, bez import/setup greške)
→ 56/56 GREEN sa Week04 analysis/AiStatus/dashboard regresijom, exit0.
Dokazi: docs/evidence/003-T021-red.txt i 003-T021-green.txt.
Panel runtime-validira CoachRunView i game/hand/version, bez raw polja;
status/alert, bounded tri cilja, manual retry. API/polling još nisu povezani.
Phase4 allowed dopuna pre T022: api/component/App, tests/ui/coach-api.test.ts,
tests/ui/coach-lifecycle.test.tsx i eventualni UI helper; task evidence/handoff
logovi i ovaj tasks.md. T023 sme dodati deterministički fake coach server helper
u tests/helpers i minimalni CSS za keyboard/readability acceptance.

T022 handoff T023: strict CoachResponse parse i bezbedna HTTP greška; App poseban
read-only request token uz postojeći snapshotSequence obrazac. Sinhroni POST lock,
jedan recursive 1s GET, AbortController i token cleanup na unmount/new-game intent
ili game/hand/version commit. Goal/fingerprint/runId i monotoni counters guard;
terminalni response zaustavlja timer, eksplicitni retry traži novi runId.
Dokazi 003-T022-red.txt (26 assertion failure; timeout assertion rejection warning
je sačuvan i test handler kasnije popravljen), 003-T022-green.txt,
003-T022-typecheck.txt (prvi TS optional-signal neuspeh i korekcija).
T023 sledeće: pravi lokalni Fastify/Vite + fake agent, keyboard/1280x720,
success i unknown-tool/provider-timeout; bez live poziva.

Phase4 prateće dozvoljene putanje: docs/CONTEXT_MANIFEST.md samo novi stvarno
korišćeni kontekst ovog bloka i docs/evidence/003-phase4-handoff.txt. Ovo nije
T026 finalni evidence paket; EVIDENCE_W05/AI_USAGE_LOG/README nisu menjani.

Phase4 završeno: T021–T023 imaju stvarne RED/GREEN/accessibility/regresione dokaze
u [handoff-u](../../docs/evidence/003-phase4-handoff.txt). Završni fokus146/146,
coach E2E3/3, Week04 fake E2E1/1 i typecheck/lint/build exit0. Setup greške i prvi
TS neuspeh sačuvani odvojeno od smislenog RED-a. T024–T027 ostaju otvoreni;
nema finalnog security/evidence paketa ili live demo-a.

## T024 korektivni podtask — 2026-10-05

- [x] T028 (trenutni coding agent; ljudski owner nije potvrđen) — Uskladiti stare
  AC23/AC16 card lokatore sa već postojećim pristupačnim nazivima karata;
  deps: T023, prvi T024 E2E rezultat; allowed: `tests/e2e/play-hand.spec.ts`,
  `docs/evidence/003-T024-*.txt`, ova statusna evidencija. Dokaz:
  `003-T024-e2e.txt`, 12/13, exit 1, `getByText('As')` ne nalazi `A♠`.
  Poker oracle (iste karte, skriveni protivnici, 1010/990 i 1015/985) ostaje isti.
  Ovo je korekcija zastarelog test harness-a, nije novi behavior RED/GREEN.
  Produkcioni kod se ne menja; T024 ostaje otvoren do ponovljene regresije.

T024/T028 handoff, 2026-10-05: [zapis](../../docs/evidence/003-T024-handoff.txt),
[expected-first eval-i](../../docs/evidence/003-evals.md).
250/250 fokus (14 fajlova), 802/802 puna regresija (57), E2E prvo12/13 exit1
zbog starog card lokatora, posle T02813/13 exit0. Typecheck/lint/build završnoexit0;
trace runner8 kontrolisanih fake run-ova, bez privatnih podataka. Setup ENOMEM i
dva TS fixture neuspeha ostaju u logovima, nisu behavior RED. Live0.
Sledeće T025: nezavisni read-only pregled granica, lokalnih linkova i FR mape;
ljudski peer review i oba člana nisu ovim tehničkim dokazom potvrđeni.

## T025 korektivni podtask — ISO vreme

- [x] T029 (coding agent; ljudski owner nije potvrđen) — Razdvojiti monotoni run
  sat od kalendarskog ISO vremena javnog DTO-a prema FR-002/data-model ugovoru;
  deps: T019,T024; allowed: `backend/src/session.ts`,
  `tests/integration/coach-lifecycle.test.ts`, `docs/evidence/003-T025-*.txt`,
  status u tasks.md. Nalaz: `new Date(performance.now())` daje1970, ne datum run-a.
  Očekivanje pre testa: startedAt je između Date.now pre/posle start-a,
  deadlineAt-startedAt=45000 i identični timestamp-i na kasnijem GET-u.
  Monotoni deadline/retry semantika se ne menja. Test-first RED→minimalni GREEN.

T025/T029 handoff 2026-10-05: [review i25FR mapa](../../docs/evidence/003-T025-review.txt).
Stvarni ISO RED12/13 exit1→GREEN91/91 exit0; završno803/803(57fajlova),
coach+Week04 E2E4/4,typecheck/lint/build0.67 lokalnih linkova/0grešaka;
tri spoljna linka čitljiva, TDA rules URL unverified zbog web Internal Error.
Secret-pattern scan nema matches(exit1), uz opisano ograničenje. Nema nerešenog
security/privacy nalaza u pregledanom Core toku; review je coding-agent, ne ljudski.
T026 sledeće: stvarni bezbedni tragovi, rezultati/ograničenja i nepoznat ljudski doprinos.

T026 handoff 2026-10-05: [paket](../../docs/EVIDENCE_W05.md),
[stvarni doc-check/handoff](../../docs/evidence/003-T026-handoff.txt).
16dokumenata/185lokalnih links/anchors,exit0;usage i manifest odvajaju stvarno od
unknown. READMEdopunjen jer Week05uputstva nisu postojala. Ljudski doprinos/potvrda
oba člana nije izmišljena;paket beleži nepoznato,T027ostaje otvoren.

T027 priprema 2026-10-05: [7min offline demo i handoff](../../docs/evidence/003-T027-demo.md).
Redosled,source/test/evidence mapa i proverene reprodukcione komande postoje.
**T027 checkbox ostaje otvoren:** nije dostavljena stvarna potvrda da oba člana
samostalno objašnjavaju tok,ni individualni Week05doprinos/primanje handoff-a.
Nema live demo-a,peer potpisa ili izmišljenih screenshot-ova.

Finalni gate: [stvarni izlaz i lista fajlova](../../docs/evidence/003-T027-final-gate.txt),
17 dokumenata/216 lokalnih linkova,25/25FR,allowed-path/secret-pattern audit0;
git diff --check prvi2 zbog novog Markdown hard-break-a,zatim0 po uklanjanju.
Legacy screenshot-i vraćeni na polazne HEAD bajtove;nema generated build/cache
u diff-u. T027 i ljudski GAME_SPEC DoD ostaju otvoreni do stvarnih potvrda.

## Phase 6 — live dokaz i završetak predaje, 2026-10-05

- [x] T030 (jedan coding agent; korisnik odobrio scope, ljudski owner nije izveden)
  — Uskladiti limited live demo zahtev i napraviti bounded Week05 smoke runner;
  deps: T024–T026; allowed: `docs/GAME_SPEC.md`, feature `spec.md`/`plan.md`/`tasks.md`,
  `scripts/coach-smoke.ts`, `scripts/gemini-coach-live-smoke.ts`,
  `tests/integration/coach-smoke.test.ts`, `package.json`, `README.md`,
  `docs/EVIDENCE_W05.md`, `docs/AI_USAGE_LOG.md`, `docs/CONTEXT_MANIFEST.md`,
  `docs/evidence/003-T030-*`, `docs/evidence/003-T027-demo.md`;
  evidence: novi offline prerequisite i trace, smisleni RED→GREEN za CLI opt-in,
  config preflight, success 2/2/1, read-only i safe failure bez retry/fallback-a;
  typecheck/lint/build i relevantna regresija; najviše jedan stvarni live run sa
  sanitizovanim rezultatom. Live neuspeh nije success. T027 ostaje otvoren do oba
  ljudska walkthrough-a, stvarnog individualnog doprinosa i prihvatanja handoff-a.

Odobrenje: korisnikov „moze kreni” prihvata predloženi paket i najviše jedan live
Gemini coach run na grani `week05/implementation`. Početni HEAD:
`57198a70cc179e3b7e6f1e36cc0fae6099a3234d`, radno stablo čisto pre novog evidence-a.
Checklist kvaliteta zahteva je read-only (12/12); istorijski T002/T005 zapis razlike
live kriterijuma se ne prepisuje. Ova dopuna razrešava tu razliku unapred.

T030 završeno kao runner + stvarno zabeležen ishod, ne kao live success:
[handoff](../../docs/evidence/003-T030-handoff.md),
[live stop](../../docs/evidence/003-T030-live.txt). RED13FAIL/1PASS→GREEN14/14;
naknadni insufficient holdout pokriven završnom regresijom818/818(58fajlova).
Fokus105/105 pre holdout-a; coach/Week04 E2E4/4; typecheck/lint/build0.
1live run/2provider calls/1tool,insufficient_evidence,464tokena,cenaunknown.
T027 ostaje otvoren: korisnik je izričito odložio doprinos/walkthrough podatke.

- [x] T031 (oba člana; sledeći driver po dogovoru) — Dopuniti dokaz uspešnog live
  Week05 finala; deps T030; allowed: `scripts/coach-smoke.ts`,
  `tests/integration/coach-smoke.test.ts`, feature `plan.md`/`tasks.md`/`spec.md`,
  `docs/GAME_SPEC.md`, `README.md`, `docs/EVIDENCE_W05.md`, `docs/AI_USAGE_LOG.md`,
  `docs/CONTEXT_MANIFEST.md`, `docs/evidence/003-T031-*`,
  `docs/evidence/003-T027-demo.md`. Pre live-a dogovoriti mali
  informativniji sintetički scenario i njegovo očekivanje, pa proveriti offline.
  Zatim tražiti novi mali live budžet: T030 jedno odobrenje je potrošeno i ne prenosi
  se na ovaj task. Evidence: stvarni completed sa validiranim finalom, dva model
  koraka/jedan alat/read-only; ili iskreno otvoren gate sa failure razlogom.
  Ne popunjavati lažan savet i ne slabiti final/insufficient validaciju radi demo-a.

T031 početak, 2026-10-05: HEAD `bdf33c3f132b0d2003e9eddf26778fcb74db2f6a`,
grana `week05/implementation`, čist worktree. Korisnik odobrio nastavak i više
malih live run-ova, uz izričito pitanje i redni broj pre SVAKOG novog run-a.
Brojimo potvrđene Week05 run-ove ovog razgovora: T030=#1, sledeći=#2.
Istorijski ukupni Week05 zbir drugih sesija ostaje unknown. Nema automatskog retry-ja.
Prvi cilj je samo jedan novi run posle offline pripreme; dodatni tek ako je potreban
i zasebno odobren. Nastavne smernice ≤15development/≤3demo ostaju.

Slice: zadržati T030 default single-all-in radi reprodukcije i dodati eksplicitni
`--scenario=street-review`: jedna terminalna ruka sa ljudskim call/check/check/all_in
na preflop/flop/turn/river, bot random0.9, isti sintetički AA-vs-KK deck. Oracle:
4detaljne odluke, čovek0/bot2000, lost; provider0 dok fixture ne bude terminalan.
Sačuvati count-e dostupnih/tool odluka i validirani kind/refusal enum po modelskom
koraku, bez raw teksta/karata/finding-a. Zelen offline scenario prethodi pitanju
za live#2; fixture uzorak nije dokazan uzrok ranijeg insufficient stop-a.

T031 završeno: korisnik izričito odobrio live #2; [stvarni completed dokaz](../../docs/evidence/003-T031-live-02.txt)
ima 2steps/2provider calls/1tool, 4 dostupne/tool odluke, finalValidated=true,
4 evidence reference, readOnly=true, retry0/fallback0, validation5/rejected0.
Model Gemini3.5FlashLite; runId3c613f27-4d49-4bb1-90e2-f0bb92a0f795;
runner3254ms/run3182ms, prompt1010/candidate476/total1486tokena, cenaunknown.
Offline24/24 runner, puna827/827, E2E4/4, typecheck/lint/build0.
Nema #3. [Handoff](../../docs/evidence/003-T031-handoff.md). T027 ostaje otvoren.
