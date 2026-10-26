# Faza 7 — izvršna matrica, 2026-10-26

Testirani kod: `d508f13e4930972d1d64e9d196f69c07ed374027`, bez runtime/test promena.
Workflow patch i tačni hash-evi izolovane osnove: [manifest](005-phase7-install-snapshot.json),
[patch](005-phase7-tested.patch). Završni dokumentacioni snapshot je u handoff-u.
Svaki PASS ispod znači uspešno izvršene assertions, ne procenu po HTTP statusu.

Komanda **S**: `npm.cmd run test:security`, [123/123, exit 0](005-phase7-security-first.txt).
Komanda **B**: `npm.cmd run test:security:e2e`, [build + 5/5, exit 0](005-phase7-security-e2e-first.txt).
Komanda **F**: `npm.cmd test`, [1037/1037, exit 0](005-phase7-full-first.txt).
Komanda **E**: `npm.cmd run test:e2e`, [build + 26/26, exit 0](005-phase7-e2e-first.txt).
Svi testovi koriste fake/SDK mock; aplikacione kontrole i lokalni alat su stvarni.
Putanje u tabeli su relativne projektnom korenu. Test nazivi su navedeni kao
doslovni prefiksi ili parametarske grupe, da ih kolega može pronaći i pokrenuti.

| Scenario / pretnja | Zahtev → izvršna kontrola | Konkretan test / komanda | Stvarni rezultat i pozitivna kontrola |
|---|---|---|---|
| T00 normalan tok | FR-001, I4/I8 → session, orchestrator, tools/validation | `tests/integration/security-normal.test.ts`: `T00: terminal game, two model steps, real evidence executor and read-only poker`; S/F | PASS: terminal lost, stackovi [0,2000], 202, completed, 2 koraka/2 provider attempts/1 stvarni alat, evidence validan, poker/facts/RNG/verzija identični; usage run 1/tool 1. |
| T01 nevalidan ulaz | FR-002/013, I1 → buildApp parser/origin i routes strict schema | `tests/contract/security-http.test.ts`: `T01 malformed`, `T01 rejects`, `T01 missing`, `T012 forbidden Origin`; S/F | PASS: malformed/null/array/tip/domain/missing i origin/null odbijeni; 0 agent provider/0 analysis-bot provider/0 tool, poker isti. Validni origin i odsutan Origin prolaze 2/1, bez cookie/credential. |
| T02 privilegije/veličina | FR-002/006, I1/I2/I6 → Fastify bodyLimit 1024 pre parse-a, strict DTO | Isti fajl: `T02/T15 rejects privileged`, `T02 rejects 1025`, `T02 counts multibyte`, `T00/T02/T012 valid exact byte boundary`; S/F | PASS: privilegovana polja ispod limita nezavisno odbijena, 1025 bajta i multibyte overflow 413, svi 0/0; tačno 1024 bajta validnog JSON-a prolazi 2/1, poker isti. |
| T03 lokalni resursni scope | FR-003, I1/I2/I4 → session.assertIdentity, aktuelna partija/ruka/verzija | Isti fajl: `T03 unknown game`, `T03 unknown hand follows stale contract`, `T03 stale version`; S/F | PASS: 404/409/409, 0/0, stanje identično. T00 koristi važeću lokalnu partiju. UUID nije autentikacija; nema privatne multi-user arhive. |
| T04 XSS | FR-009, I5/I8 → React tekst u CoachPanel/AnalysisPanel | `tests/e2e/security-rendering.spec.ts`: `T04/T05 attack: validated coaching and analysis remain literal text`; B/E | PASS pravi Chromium, final preko realnog alata i backend validacije (2/1), marker ne postoji, script/img/a/iframe/object/embed/link/base/svg/math 0 i event atributi [], poker isti. Dev browser bez production CSP izoluje tekstualnu kontrolu. |
| T05 aktivni markup/URL | FR-009, I5 → isti tekstualni prikaz | Isti fajl, attack i normal test; B/E | PASS: HTML/Markdown/javascript ostaje tekst, navigacija ista/jedan tab; dostupan image probe 200, automatski zahtevi 0. Srpska slova, apostrof i `a < b` očuvani u oba panela. |
| T06 model shape/bytes/final | FR-005/006, I3/I6 → orchestrator.consume + strict shared/final schema | `tests/integration/security-tools.test.ts`: `T06 rejects invalid/oversized model step`, `T06 raw JSON response boundary`, `T06/T10 rejects`; S/F | PASS: nevalidan prvi output 1 provider/0 tool; 32768-byte JSON prolazi 2/1, 32769 odbijen 1/0; invalid/oversized/foreign final odbijen posle 2/1, nema uspešnog rezultata. |
| T07 nedozvoljen alat | FR-004, I3 → tačan name dispatch pre executor-a | Isti fajl: `T07: rejects %s with zero executor calls, then permits real evidence`; S/F + comparison | PASS shell/constructor/toString: po 1 provider/0 executor, unknown_tool, poker isti; legitiman retry daje ukupno 3 provider/1 alat. |
| T08 args i scope | FR-003/004, I2/I3 → strict args i focus jednak server-bound goal-u | Isti fajl: `T08 rejects malformed arguments`, `T08 schema-valid focus outside server-bound run scope never executes`, `T08/T10 valid limit`; S/F | PASS null/extra/type/0/11/decimal i odvojeno schema-valid betting/1 protiv street run-a: 1/0; validni 1 i 10: 2/1, drugom modelu tačno kanonski dokaz. |
| T09 malicious fake proposal | FR-004, I3/I4 → allowlist, bez write capability-ja | Isti fajl: `T09 malicious fake model cannot mutate poker or execute an administrative tool`; S/F | PASS set_player_stack/admin/ignore rules: unknown_tool, 1 provider/0 tool, poker isti. T00 pozitivna kontrola. Nema free-text/RAG kanala; ne dokazuje otpornost pravog modela. |
| T10 tool output poisoning | FR-005/011, I3/I7 → byte/strict/canonical validateDecisionEvidence pre modelStep 2 | Isti fajl: `T10 rejects %s tool result after real execution, before second model`, `T08/T10 valid limit`; S/F | PASS null/oversized/extra sentinel/foreign revision/foreign same revision: real executor 1, provider samo 1, validatedToolResult/result null, nema drugog modela. Pozitivni limit 1/10 prosleđuje tačno kanonski rezultat i final reference iz tog skupa. |
| T11 petlja/retry trošak | FR-006, I6 → CORE_AGENT_LIMITS, action key i jedan zbir attempts | `tests/integration/security-budgets.test.ts`: `T11 independently enforces`, `T11 retry and fallback share four total attempts`, `T11 never sends a third attempt`; S/F. SDK: `tests/integration/gemini-agent.test.ts`, F | PASS repeated_action i drugi različit tool poziv odbijeni uz 2 provider/1 tool; odvojeni step/tool/call budžeti. Retry/fallback normalno završi sa tačno 4 attempts/2 steps/1 tool, najviše 2 attempts/step; failure posle dva ne šalje treći. Mock transport potvrđuje 4096 tokens i SDK attempts 1. |
| T12 timeout/deadline/late | FR-007, I4/I6 → bounded child abort/timer i monotoni ukupni checkpoint | Isti budgets fajl: `T12 call timeout`, `T12 accepts provider success`, `T12 tool boundary`, `T12 total deadline`; admission `T12/T13 terminal timeouts`; S/F | PASS per-call 15000 odbija, 14999 prihvata; tool 999/1000 razdvojeni. Tri kratka poziva + backoff stižu na 45000 bez četvrtog; četiri attempts prihvataju final na 44999, odbijaju na 45000, jedan terminal. Late resolve/reject ne menja ishod. Neotkazivi pokušaji zauzimaju oba mesta do stvarnog settle-a, zatim active 0. |
| T13 kapacitet/rate | FR-008, I6 → procesni AdmissionWindow i ProviderCapacity lease | `tests/integration/security-admission.test.ts`: `T13 actual overlap`, `T13 mixed coach/analysis`, `T13 pending dedupe`, `T13 analysis and bot`, `T13 a running bot`, `T13 cancellation before dispatch`, `T13 initial`; `tests/unit/security-capacity.test.ts`; S/F | PASS max stvarno aktivnih 2, treći 429 pre poziva, cancel ga ne oslobađa, late settle omogućava prijem. Coach/analysis/bot dele kapacitet, legalan bot fallback bez provider poziva; rate samo korisnički startovi 5/60000. Failures troše token; dedupe/invalid/capacity reject ne troše. Reset/nova partija ne resetuju; 59999 odbija, 60000 prihvata, zatim opet odbija. Burst 5/10/5, poker isti. |
| T14 secret/error/log | FR-011/012, I7 → productionAiDependencies, safe adapter error, strict tool result i SecurityEvents | `tests/integration/security-secrets.test.ts`: `T14 loaded server sentinel stays out of %s HTTP/model/events/operational outputs`; `tests/{unit,integration}/security-events.test.ts`; S/F | PASS factory tačno jednom učita sentinel; adapter error/tool extra/success grane bez sentinel-a u response/model/events/console; extra tool nema drugi model. Forged newline ne pravi lažni event/reason/correlation; server UUID, closed 8 fields, safe integers, terminal jedan i stvarni brojači. Max 200, age <1800000ms, usage reset ne briše. |
| T15 browser tamper | FR-003, I2/I4 → backend autoritet, strict DTO i GET refresh | `tests/e2e/security-state.spec.ts`: `T15 browser display, storage and forged requests cannot become server poker state or limits`; B/E; HTTP extra testovi S/F | PASS DOM/storage forged win/stacks/admin/limits ne menja snapshot; reload vraća server tekst; forged POST 400 uz 0/0 i isti poker; normalan coaching zatim 2/1, pravi model config i isti poker, cookies []. |
| T16 production CSP/bundle | FR-010/011, I5/I7/I8 → vite preview.headers + env projekcija | `tests/e2e/security-production.spec.ts`: oba `T16 initial` i `T16 synthetic server secret`; B/E | PASS svež production build, isti dostupan script 200 i kontrolni marker true bez CSP-a; app marker false uz script-src-elem/enforce/tačan URL, HTTP ostaje 2→2. Tačna CSP/nosniff/no-referrer. JS/CSS asset-i, igra/coaching 2/1, poker isti i mobile bez overflow-a. Server factory učita sentinel, odsutan iz HTTP/model/events/HTML i svih JS/CSS/HTML artefakata; sourceMaps=[] (nema mapa). |
| T17 višestruki prelaz granica | FR-007/008, I4/I6/I7 → session lifecycle + usage epoch + fizički lease + rate gate | `tests/integration/security-lifecycle.test.ts`: `T17 noncooperative job -> new game + usage reset -> new start -> late %s`; S/F | PASS resolve/reject: stari abortovan ali active 1; novi start active/max 2; treći odbijen 0 poziva; kasni stari rezultat ne menja novu partiju/run/usage i ne izvršava alat. Novi završi 1 tool/1 usage commit/1 terminal; active 0; stari prihvaćen start i dalje troši rate token. Ovo prelazi resursnu, poker i usage granicu. |

## I1–I8 i granice zaključka

I1: HTTP S testovi T01–03; I2: T02/T08/T15; I3: T06–10; I4: T00/T12/T15/T17;
I5: B T04/T05/T16; I6: S T11–13/T17 + F SDK transport; I7: S T10/T14 + B T16;
I8: S T00, F 1037 i E 26. Svaka mapa vodi kroz kontrolu i stvarno izvršen test gore.
Nijedan obavezan scenario nije N/A, skip, test.fails ili očekivani RED.
SQL i credential CSRF su jedina uslovna N/A: nema baze ni automatskog credential-a.
Origin odbijanje i lokalni resource scope ipak su izvršeni. SDK može baferovati pre
byte provere; abort ne garantuje prekid udaljenog rada/naplate. Zaglavljen provider
zadržava lease do settle/restart-a. Jedan sentinel nije opšti DLP; memorijski sink
nije trajni audit. Fake nije live-model robustness ni deployment dokaz.

## T006 — ista tri ulaza

Originalni pre-checkpoint: `d08e06c95f8051e12e15a8e80e9d950de5b3333b` + Faza 2 patch;
prvi commit fixture-a `2b8ea4e`. Sačuvani [manifest](005-phase2-fixtures.json),
[očekivanja](005-phase2-expectations.md), [prvi stvarni node ishod](005-phase2-security-baseline.txt)
i [Faza 2 handoff](005-phase2-handoff.md) ostaju neizmenjeni.
[Automatsko poređenje](005-phase7-input-equivalence.json) potvrđuje da je ceo
`securityInputs` blok doslovno isti. Kasnije helper/test dopune nisu zamena input-a.
Serverski UUID-i i slobodan probe port se ponovo generišu kao ranije, nisu oracle.

| Scenario | Pre, isti ulaz | Relevantna promena | Posle na d508f13 | Šta nije dokazano |
|---|---|---|---|---|
| T07 | shell/constructor/toString, street/10: PASS, svaki 1 provider/0 tool; legitiman retry ukupno 3/1 | Postojeći tačan allowlist dispatch, bez nove runtime promene za taj slučaj | PASS→PASS, isti 1/0 i 3/1, poker isti; [38 izvršenih testova i brojači](005-phase7-comparison.txt) | Nisu sve moguće model generacije; nije live injection robustness. |
| T13 | [0,1000,2000,3000,4000,5000]ms: RED 6 accepted/12 provider/6 tool | Atomski procesni rate 5/60000 i kapacitet/lease | GREEN isti ulaz: statuses [202,202,202,202,202,429], accepted 5/provider 10/tool 5, AI_RATE_LIMITED, poker isti; [actual](005-phase7-comparison.txt) | Burst sam ne dokazuje concurrency; zasebni active/recovery testovi gore to pokrivaju. |
| T16 | `/security-probe.js`, `__w08ScriptExecuted`: RED dostupno 200/control true, app true/violations [], HTTP 2→3 | Stvarna Vite preview CSP zaglavlja | GREEN isti script/input: 200/control true, app false, script-src-elem enforce, HTTP 2→2; [browser actual](005-phase7-security-e2e-first.txt) | Lokalni preview profil; nije deployed server. Sentinel dopuna ima odvojen test u istom run-u. |
