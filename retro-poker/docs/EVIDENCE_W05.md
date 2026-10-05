# Week05 — bounded read-only coach

Datum:2026-10-05,Europe/Belgrade. Polazni HEAD:
`83cb2c2531934f2dd6fc5da1d0e4ab921b57309d`,čist worktree. Node24.20.0/npm11.19.0.
T024/T025/T026 završeni; [T026 handoff](evidence/003-T026-handoff.txt).
**T027 walkthrough oba člana nije
potvrđen; Week05 još nema pun ljudski gate za predaju.** Live ovog rada:0.

## Funkcija i korisnička vrednost

Po završetku partije igrač bira Ulaganje,Odluke po fazama ili Showdown i traži jednu
vežbu za sledeću partiju. Dobija validirani sažetak,jednu preporuku i proverljive
reference na raspoložive ljudske odluke. Aktivna partija nije coaching scope.
Savet je obrazovan; membership provera ne dokazuje optimalnu strategiju ili kvalitet
odluke iz samog ishoda. Week04 botovi,analiza i engine pravila ostaju osnova.

## Arhitektura,run state i provider granica

CoachPanel/App/api → POST `/api/game/coach` → strict preflight/session slot
→ BoundedAgentRun → model step1 → tool proposal validation → executor
→ tool-result validation → model step2 → final validation → safe DTO/GET polling.
GET `/api/game/coach/:runId` ne pokreće run. Start/commit je serijski;
provider/tool await je izvan session lock-a. Duplicate aktivni cilj vraća isti runId;
drugi cilj tokom run-a se odbija. Retry terminalnog run-a je nov eksplicitni POST/UUID.

Run state:`created → running → completed | stopped | failed`. Server vodi UUID,
gameId/handId/version/factsRevision,goal,step/attempt/tool brojače,monotoni deadline,
validirani tool result,stopReason/failureCategory i result. Strict CoachRunView
izostavlja context/proposal/raw attempts. T029 veže stabilni wall-clock početak za
session slot radi ISO DTO datuma; rokovi ostaju na monotonome satu. Terminalna
tranzicija i usage commit su idempotentni; nova partija abortuje/uklanja jedini slot.

Provider-neutral `generateAgent` prima step/attempt/runAttempt ordinale,model,
deadline/remainingMs,goal/context i AbortSignal. Gemini SDK,key i model konfiguracija
ostaju backend adapteru. Descriptor jedinog alata/faza su trusted instrukcije
adaptera. Model-visible JSON:goal,availableDecisionCount,sampleLimited; step2 dodaje
samo validirani tool result. Nema repository-ja,GameState-a,key-a ili protivničkih
skrivenih karata. Dokazi su FakeAiProvider/mocked Gemini; nisu live model dokaz.

## Tool contract i validacija

Allowlist:samo `get_decision_evidence`. Trusted kod vezuje executor za cloned/frozen
terminalni MatchFacts snapshot. Strict input:`{focus,limit}`; focus je betting/street/
showdown i odgovara cilju,limit integer1–10. Model ne bira gameId,executor,putanju,
shell,SQL,URL,filesystem ili network. Deterministički bira najnovije detaljne odluke
i vraća ih rastućim ordinalom; agregati ne postaju pojedinačni evidence.

Strict output:`{factsRevision,focus,sampleLimited,decisions}`;≤10odluka i20480JSON
UTF-8bajtova. Svaka odluka ima decisionRef i canonical factCode/finding:
action,phase,legal_options,known_cards,hand_outcome. Outcome je odvojen od znanja
u trenutku poteza; prekoračena činjenica se ne seče.

1. Preflight proverava strict HTTP,identity,terminal status/config. Nevažeći zahtev
   ili nedostajući detaljni dokazi daju0provider/0tool dispatch-a.
2. Proposal gate:strict union → allowlist → strict args/focus/scope → repeated key
   → cap → executor. Canonical key=name+stabilni parsed focus/limit+factsRevision.
3. Tool-result gate:strict oblik,UTF-8cap,fingerprint/count/order/sample i tačna
   re-projekcija činjenica iz snapshot-a pre model step2.
4. Final gate:strict summary≤1000/recommendation≤500Unicode code points,confidence,
   completed i≤10jedinstvenih evidence parova. Ref/code/finding mora tačno pripadati
   stvarnom validiranom tool result-u. Lažni evidence ne objavljuje savet.

## Stvarni bezbedni trag

[Trace runner](../tests/helpers/coach-evidence.ts) koristi sintetički fixture;
[stvarne safe projekcije i komande](evidence/003-T024-traces.txt) ne čuvaju prompt,
raw provider response,privatne karte ili reasoning. Uspešan izlaz:

```json
{
  "scenario": "success", "provider": "offline-fake",
  "status": "completed", "stopReason": "completed",
  "stepCount": 2, "providerAttemptCount": 2,
  "toolAttemptCount": 1, "toolCallCount": 1, "toolRejectionCount": 0,
  "validationCount": 5, "validationRejectedCount": 0,
  "terminalTransitionCount": 1,
  "attempts": [
    {"step": 1, "attempt": 1, "relation": "initial", "outcome": "success"},
    {"step": 2, "attempt": 1, "relation": "initial", "outcome": "success"}
  ],
  "result": {
    "summary": "Pregled dostupnih odluka.",
    "recommendation": "Proveri legalne opcije pre odluke.",
    "evidence": [{"decisionRef": "00000000-0000-4000-8000-000000000002:1",
      "factCode": "action", "finding": "{\"type\":\"call\"}"}],
    "confidence": "low", "completed": true
  },
  "readOnlySnapshotPreserved": true
}
```

| Trace scenario | Steps/attempts/tool proposals/executions | Stvarni stop/failure |
|---|---|---|
| Success | 2/2/1/1 | completed,5validacija |
| Unknown tool | 1/1/1/0 | stopped/unknown_tool,result=null |
| Invalid arguments | 1/1/1/0 | stopped/invalid_tool_arguments,result=null |
| Provider auth failure | 1/1/0/0 | failed/provider_failed,authentication_configuration |
| Repeated action | 2/2/2/1 | stopped/repeated_action,nema drugog executor poziva |
| Narrowed step limit1 | 1/1/1/1 | stopped/step_limit,nema step2 |
| Invalid final | 2/2/1/1 | failed/malformed_output,evidence_rejected |
| Empty details | 0/0/0/0 | stopped/insufficient_evidence |

Za unknown tool i invalid arguments:**model proposal rejected before executor**;
**toolCallCount = 0**,zaseban executor counter0. To je stvarni trace/integration
assertion,ne samo stopReason. Tool exception/timeout/corrupt output,shared deadline
kroz retry i step2,stale/new-game i duplicate commit dokazani su postojećim testovima
u [verbose fokusu](evidence/003-T024-focus.txt). Svih10 [unapred zadatih eval-a](evidence/003-evals.md)
ima dokaz; osam trace redova nisu predstavljeni kao ceo test skup.

## Budžeti,cancellation i usage

Max2logical steps,1tool execution,4provider attempts/run,2attempts/step,
15s/attempt,45sukupan deadline i1s/tool. Svaki poziv koristi min(timeout,remainingMs).
SDK retries isključeni (`attempts:1`). Transient timeout/429/network/5xx ima najviše
jedan bounded retry;5xx može preći na konfigurisani fallback. Auth/refusal/malformed/
final evidence failure se ne popravlja nekontrolisanom petljom. Step2 retry koristi
isti rezultat i ne ponavlja alat.

Async checkpoint proverava terminal/abort/fingerprint/deadline. Promise race odvaja
noncooperative provider; tool kooperativno proverava signal/rok u bounded iteraciji.
Late rezultat ne menja terminalno stanje. Session proverava slot/run/game/hand/version/
facts revision; App dodatno token/controller/runId,monotone response counters,
jedan GET u toku i cleanup na terminal/unmount/new-game intent-u. Nema nove cancel
rute; nova partija/server abort su postojeći tokovi.

Usage odvaja run,logical step,provider attempt,same-model retry,model fallback,
tool proposal/rejection/execution,validaciju i stopReason. Execution broji ulazak
u executor čak i kada baci grešku. Week04 retry nije step2. Epoch/runId dedup
sprečava late/duplicate upis; cancelled/stale/zamenjeni slot nema nove metrics.
Token/cost nepoznat ostaje unknown/null.
Trace runner:3uspešna pokretanja×8fake runs=24runs,30attempts,21proposals,
12executions,retry0/fallback0. Ukupan fake call zbir svih suite nije instrumentiran.

## T024/T025 tačne komande,rezultati i domet

Sve komande iz `retro-poker/`,2026-10-05. Exit kodovi su stvarno zabeleženi.

| Tačna komanda | Rezultat/evidence | Dokazuje / ne dokazuje |
|---|---|---|
| `npm.cmd test -- tests/unit/agent-schemas.test.ts tests/unit/agent-tool.test.ts tests/unit/agent-provider.test.ts tests/unit/agent-orchestrator.test.ts tests/unit/agent-final.test.ts tests/unit/coach-usage.test.ts tests/contract/coach-contract.test.ts tests/contract/coach-routes.test.ts tests/integration/gemini-agent.test.ts tests/integration/agent-run.test.ts tests/integration/coach-lifecycle.test.ts tests/ui/coach.test.tsx tests/ui/coach-api.test.ts tests/ui/coach-lifecycle.test.tsx --reporter=verbose` | [250/250,14fajlova,exit0](evidence/003-T024-focus.txt) | Week05unit/contract/integration/UI i10eval-a;ne live |
| `npm.cmd test` | [802/802,57,exit0](evidence/003-T024-regression.txt); posle T029[803/803,57,exit0](evidence/003-T025-regression.txt) | Week05,Week04AI,game/engine;ne browser/live |
| `npm.cmd run test:e2e` | [12/13,exit1](evidence/003-T024-e2e.txt)→T028card lokatori→[13/13,exit0](evidence/003-T024-e2e-rerun.txt) | Chromium game/coach/AI/accessibility/recovery;ne screen reader |
| `npm.cmd run typecheck` | [T024fixture exit2,završno0](evidence/003-T024-typecheck.txt);[T0250](evidence/003-T025-typecheck.txt) | Oba TS projekta;ne semantika |
| `npm.cmd run lint` | [T0240](evidence/003-T024-lint.txt);[T0250](evidence/003-T025-lint.txt) | ESLint;ne sve security mogućnosti |
| `npm.cmd run build` | [T0240](evidence/003-T024-build.txt);[T0250](evidence/003-T025-build.txt),121modul/serverTS | Lokalni build;ne deploy/live |
| `node --import tsx tests/helpers/coach-evidence.ts` | [exit1](evidence/003-T024-traces.txt),Windows ENOMEM | Setup neuspeh,bez dispatch-a |
| `node --require ./tests/helpers/process-user-shim.cjs --import tsx tests/helpers/coach-evidence.ts` | [3pokretanja,svako8projekcija,exit0](evidence/003-T024-traces.txt) | Safe fake trag/brojači;ne live |
| `npm.cmd test -- tests/integration/coach-lifecycle.test.ts` | [T029RED12PASS/1FAIL,exit1](evidence/003-T025-timestamp-red.txt) | Stvarni1970 ISO bug,Date.now oracle |
| `npm.cmd test -- tests/integration/coach-lifecycle.test.ts tests/contract/coach-routes.test.ts tests/integration/agent-run.test.ts tests/unit/coach-usage.test.ts` | [91/91,4fajla,exit0](evidence/003-T025-timestamp-green.txt) | ISO,lifecycle,HTTP,limits,usage;ne live |
| `npm.cmd run test:e2e -- tests/e2e/coach.spec.ts tests/e2e/ai-offline.spec.ts` | [4/4,exit0](evidence/003-T025-e2e.txt) | Relevantna browser regresija posle T029;puni13nisu ponovljeni posle T029 |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` uz `SPECIFY_FEATURE_DIRECTORY` za003 | [exit0,checklist12/12](evidence/003-T024-prerequisites.txt) | Feature/prerequisites;ne runtime completion |
| `node .verification/w05-doc-audit.cjs` | [64zatim67lokalnih linkova,0grešaka,exit0;source ulogu](evidence/003-T025-links.txt) | Destinations/headings;ne remote HTTP |
| Secret-pattern `rg -l --hidden ...` | [tačna komanda,nema matches,exit1](evidence/003-T025-secret-scan.txt) | Odabrani pattern-i;ne.env/svi Git objekti |

Priprema/read-only:`Get-Content`,`rg`,`rg --files`,`Test-Path`,`git status --short`,
`git diff --stat`,`git diff -- <relevantne putanje>`,`git rev-parse HEAD`,
`node --version`,`npm.cmd --version`. Kompozitni read output nije numerički exit
za svaku pojedinačnu operaciju. Jedno prerano čitanje još nenastalog E2E loga nije
uspelo; kasnije pročitan stvarni log. Fokus-log normalizovan UTF8/UTF16 bez rerun-a.
Završni diff/link/scope gate ima zaseban log. Dokumentacioni neuspeh apply_patch
zbog README context mismatch-a ispravljen pre pisanja; nije runtime RED.

## Security/privacy i traceability

[T025review](evidence/003-T025-review.txt) mapira25/25FR→US/acceptance→task→
konkretan test/scenario→evidence.21acceptance scenarija ima test ili označen manual
code proof (US2.5data/privilege granica;bez zasebnog live adversarial run-a).
Nema nađenog nerešenog security/privacy propusta u pregledanom Core toku.
Server-only key,fiksni executor,strict proposal/tool/final gates,immutable snapshot,
safe DTO/JSX/usage i kontrolisani marker leak testovi imaju stvarne dokaze.
Schema ne garantuje stratešku tačnost slobodnog sažetka/preporuke.

T028 menja8zastarelih E2Ecard lokatora; iste karte,stackovi i privacy oracle ostaju.
T029 minimalno ispravlja session ISO metadata,sa stvarnim RED/GREEN.
Allowed paths oba korektivna taska upisane pre korekcije. Nema nove funkcionalne
faze,engine pravila,dependency-ja,UI funkcije ili provider porodice.

## Ograničenja i nepokrenute provere

- Live Gemini coaching/smoke/diagnose/demo:NOT RUN,0run-ova ove sesije. Prethodni
  Week05live zbir nije nezavisno instrumentiran.≤15development/≤3demo su caps.
- `npm ci`/clean instalacija nije pokrenuta;korišćene postojeće dependencies.
- Screen reader,axe,drugi browser,ručni ljudski walkthrough/peer review:NOT RUN/
  nepotvrđeno. Keyboard/readability provereni offline Chromium testovima.
- Memory-only game/facts/run/usage ne preživljavaju restart.≤200detaljnih odluka;
  starije agregirane. Coach transparentno prikazuje ograničenje raspoloživog uzorka.
- Coding tokeni/cena:unknown. Fake suite broj poziva nije broj testova.
- Spoljni TDA rules link web alat nije mogao potvrditi(Internal Error);3ostala
  spoljna poker linka vratila sadržaj. Lokalni links imaju stvarni audit.
- Novi screenshot nije Week05 evidence; legacy E2E screenshot izlazi vraćeni na
  polazne HEAD bajtove. Generisani dist/test-results/cache ostaju ignorisani.
- Commit,push,deployment i nastavna live demo potvrda nisu izvršeni.

## Stvarni doprinos i handoff

| Učesnik | Potvrđeno | Nepotvrđeno |
|---|---|---|
| Korisnik ove sesije | Zadao Phase5 scope i tražio audit T002–T023;navodi raniji T021–T023 rad | Identitet A/B,pojedinačni raniji Week05coding/review doprinos |
| Drugi član | Planirano naizmenično vlasništvo;Week04istorija ima prijavljenu zajedničku proveru | Stvarni pojedinačni Week05doprinos,review,walkthrough;Week04potpis nije prenet |
| Codex,jedan coding agent | Audit,kod/test review,T024/T025komande,T028/T029male korekcije,ovaj paket | Ljudski doprinos/razumevanje,peer potpis ili live uspeh |

Owner A/B checkbox nije dokaz rada te osobe. Nedostaju stvarni Week05izveštaji oba
člana i nezavisno objašnjenje toka; to ostaje otvoreno T027. Source/test/evidence
putanje omogućavaju ponavljanje offline dokaza. Stvarna ljudska predaja/primanje
nisu potvrđeni; prepared handoff nije potpis.

[Pripremljen sedmominutni demo i handoff](evidence/003-T027-demo.md) omogućava
drugom članu isti offline dokaz. T027 i dalje zahteva stvarnu ljudsku potvrdu.

Završni [gate i potpuna lista 39 izmenjenih/novih fajlova](evidence/003-T027-final-gate.txt):
17 dokumenata, 216 lokalnih links/anchors, 0 grešaka; mapa 25/25 FR;
allowed-path i secret-pattern audit exit 0, jedini otvoreni task T027.
Posle dodavanja finalnih evidence linkova isti link audit ima 218 lokalnih linkova,
0 grešaka, exit 0; poslednji scope/status i `git diff --check` takođe exit 0.
Prvi `git diff --check` exit 2 zbog novog Markdown hard-break whitespace-a;
posle uklanjanja isti `git diff --check` exit 0. Baseline screenshot-i nepromenjeni,
nema generisanog build/cache sadržaja u Git diff-u. Pattern scan ne dokazuje
odsustvo svake moguće tajne; stvarni `.env` nije čitan.

Dodatni istorijski spoljni linkovi iz manifesta (Google models, Vitest, Zod,
Vite server options) otvoreni su web alatom 2026-10-05 i vratili sadržaj.
Ukupno 7 od 8 spoljnih dokumentacionih linkova ima sadržaj; TDA rules ostaje
unverified zbog Internal Error. Ovo nije API generation ili live model provera.
