# Faza 6 — T023–T027

2026-10-26, Europe/Belgrade. Codex po korisničkom zahtevu; jedan coding agent.
Git koren `D:/AIBootcamp/week3-4`, projekat `retro-poker/`, grana `week08-init`,
HEAD `e498a06b11a8e8eb0c8c2e310b39608630547757` + radni diff/novi fajlovi.
Početno stablo nije bilo čisto: dokumentacija/quickstart/tasks i novi phase5-recheck
dokazi već su postojali i sačuvani su. Nema promene grane, reset/commit/push/merge-a.
Node `v24.20.0`, npm `11.19.0`. [Checkpoint hash-evi](005-phase6-checkpoint.json).

## Prethodna faza i redosled

Pročitani AGENTS, constitution 1.1.0, lokalni speckit-implement skill, feature005
spec/plan/tasks/data-model/contracts/research/quickstart, BUILD_PROMPT_WEEK08_V1,
GAME_SPEC W08 granice, EVIDENCE_W08, phase5 handoff/recheck i relevantni runtime/testovi.
Requirements checklist 9/9; nema extensions.yml ni pre/post hook-ova. Ignore/ESLint
već isključuju build/cache/evidence temp. Prerequisites prošao kroz dokumentovani
zaseban PowerShell `-ExecutionPolicy Bypass`; direktni poziv blokira lokalna policy.

Preflight: [security 108 PASS](005-phase6-preflight-security.txt),
[svež build + browser 4 PASS](005-phase6-preflight-browser.txt), oba exit 0.
Pregled potvrđuje React plain-text prikaz i pozitivni srpski tekst, odsustvo aktivnog
DOM-a/izvršenja, real preview CSP/nosniff/no-referrer, dostupan probe HTTP 200 koji
radi bez CSP-a i biva blokiran uz script-src-elem violation u aplikaciji.
Igra/coaching/mobile rade. Nije pronađen propust prethodne faze; nedostajući events
i sentinel dokaz pripadaju ovoj fazi, nisu regresija Faze 5.

Očekivanja su prvo zapisana u testovima: zatvorena šema, sanitizovana projekcija,
stvarni brojači, jedno terminalno beleženje, bounded retention, negativne secret
putanje i uspešna kontrola. Prvi [events rezultat](005-phase6-events-first.txt)
ima nedostajući modul i nijedan izvršen test: **nije security RED**.
Nakon implementacije: [7 PASS](005-phase6-events-green-first.txt).
Prvi prošireni test imao je pogrešan poziv test setup admission helper-a bez
capacity argumenta ([izlaz](005-phase6-events-expanded-first.txt)); ispravljen
setup, bez promene runtime očekivanja ([11 PASS](005-phase6-events-expanded-green.txt)).
Zaseban smislen [analysis RED](005-phase6-analysis-red.txt): 8 PASS/1 FAIL,
očekivana 2 događaja, opaženo 0. Posle minimalne integracije svi prolaze.
Ad hoc pokušaj izvoza primera kroz `node --import tsx --input-type module` nije
startovao zbog sandbox `uv_os_get_passwd ENOMEM`; nije security nalaz. Primeri
su umesto toga uzeti iz uspešnog realnog test run-a sa isključenim console intercept-om.

## Taskovi i izvršna mesta

| Task | Status i dokaz |
|---|---|
| T023 | Završen: unit/integration security-events testovi; eksplicitna 8-field šema, enums/UUID/time/safe integers, nepoznata polja, log injection, retention, HTTP parser/admission, tool odluke, dedupe, failure/cancel/late settle i analysis. |
| T024 | Završen: `backend/src/security/events.ts`, `routes.ts`, `session.ts`, `agent/orchestrator.ts`. Postojeći `buildApp` već prosleđuje constructor dependencies; dodatna app.ts izmena nije potrebna. |
| T025 | Završen: 3 integration sentinel scenarija + production artefakti/HTTP/model/events u realnom browser helper-u. Prvi sentinel run 3 PASS. |
| T026 | Završen uslovni **PASS→PASS**: adapter klasifikacija, strict canonical tool validacija i postojeće frontend env granice već sprečavaju testirana curenja. Nema nepotrebne izmene adaptera/validatora/Vite politike niti sentinel string replace-a. |
| T027 | Završen: registry prepreka pa stvarni audit sa 10 pogođenih paketa, ciljane kompatibilne zakrpe i final audit 0; [odluka po paketu/advisory-ju](005-phase6-audit.md). |

## Događaji, korelacija i retention

`SecurityEvents.emit` projektuje samo `event`, `timestamp`, `correlationId`,
`purpose`, `reasonCode`, `outcome`, `providerAttempts`, `executedToolCalls`.
Vreme pravi sink; UUID pravi server. Reason vocabulary je eksplicitna zatvorena
lista operativnih HTTP kodova, `accepted` i postojećih stop razloga; nepoznat
operativni kod mapira se u INTERNAL_ERROR. Raw tool name/exception.message ne
postaju reason/event. Nepoznata dodatna polja kontrolisano se izostavljaju pre
strict validacije; nevalidne privilegovane vrednosti odbacuju ceo događaj.
Produkcioni buffer i injected observer dobijaju istu validiranu projekciju.
Observer dobija kopiju; mutation/exception ne menjaju buffer ili game tok.

Za novi prihvaćen coaching ili korisnički analysis start server pravi zaseban
correlation UUID. Isti UUID prati tool odluke i terminal; nije game/hand/run ID,
credential ni klijentski header. Dedupe pending coaching ne pravi novo prihvatanje,
rad ili završetak. Svako HTTP odbijanje dobija nov serverski correlation UUID,
uključujući parser/origin/media/admission odbijanje, sa 0/0 novog rada.
Terminal beleži stvarne application provider attempts i tool executions do tog
trenutka. Tool accepted znači dozvola **pre** izvršenja, pa tada execution count
još može biti 0. Tool rejection je odluka pre nedozvoljenog izvršenja. Bot purpose
je dozvoljen u šemi; novi request događaji u ovoj fazi prate korisnički coach/analysis
tok, bez promene automatskog bot lifecycle-a ili zajedničkog kapaciteta.

Terminal događaj nastaje na jedinom guard-ovanom coaching terminal prelazu, pre
usage commit-a i nezavisno od kasnijeg stale slot-a. Cancel + nova partija + usage
reset + late resolve/reject ne prave drugi završetak. Analysis ima jedan terminal
na povratku koordinatora, sa stvarnim attempts.length. Nema I/O ni await-a za log
pod mutation lock-om. Rate prozor, capacity lease, budžeti i usage epoch ostaju isti.

Produkcioni sink je procesni singleton; lokalni operator može ga pregledati kroz
interni import/debugger, test kroz constructor-injected sink/read. **Nema HTTP
read/export/reset endpoint-a, trajnog log fajla ili automatskog stdout dump-a.**
Najviše 200 događaja, najstariji se izbacuju; događaj star tačno 1.800.000 ms više
se ne zadržava. Pruning radi na upisu i čitanju, uz kontrolisani sat u testovima.
Usage reset ne briše evidenciju; nova instanca/restart počinje prazna. Izgubljena
procesna memorija nije trajni audit trag; više procesa bi imalo odvojene buffere.

Log injection provere ispituju strukturu i konkretne vrednosti: newline + forged
JSON u tool name-u, raw provider message, privilegovana polja u HTTP body-ju i
nepoznata sink polja. Ne oslanjaju se samo na broj redova. Nema dodatnog događaja
sa podmetnutim event/reason/correlation vrednostima niti raw markera u zapisima.
[Stvarni bezbedni accepted/rejected/tool/terminal primeri](005-phase6-event-examples.json)
izvučeni su iz [izvršenog testa](005-phase6-event-observed.txt), nisu izmišljeni.

## Sentinel i puni T16 u ovom checkpoint-u

Isključivo `W08_SERVER_SECRET_DO_NOT_EXPOSE`. Test poziva stvarni
`productionAiDependencies` sa sintetičkom env mapom i spy provider factory-jem;
assertion proverava tačnu učitanu vrednost, poziv factory-ja i enabled server
config. Adapter scenario koristi stvarni `createGeminiProvider` sa mock SDK
client-om koji vraća internu 401 grešku sa sentinel-om. Nema živog provider-a čak
ni kada config izgleda kao stvaran ključ. Tool scenario dodaje extra secret polje
stvarnom kanonskom rezultatu: strict validator prekida nastavak, 1 provider poziv,
nema drugog model context-a. Uspešan control: 2 provider/1 tool, completed.

Svaki scenario skenira stvarnu vrednost u start/poll/terminal/failure HTTP odgovorima,
game/usage izlazu, model arguments/context-u, security događajima i uhvaćenim
console log/warn/error/info/debug operativnim izlazima. Raw error/tool objekat se
ne ispisuju radi dokaza. [Prvi sentinel rezultat](005-phase6-secrets-first.txt)
je 3 PASS; bez leak runtime popravke. [Kombinovane provere](005-phase6-focused.txt)
15 PASS; posle dependency update-a uključene su u full/security GREEN.

Production spec pre testova poziva Vite build iz aktuelnog izvora sa
`envDir:false` i privremenim sintetičkim GEMINI_API_KEY; prethodni process env
se vraća bez ispisivanja. Preview takođe ima envDir:false. Factory assertion u
browser testu potvrđuje da server stvarno učita sentinel, uz fake provider.
Build skenira sve frontend fajlove, uključujući JS/CSS/HTML i sve mape ako postoje.
**Source maps ne postoje (0 .map fajlova)**; nije tvrdnja da su nepostojeće mape
pregledane. [Final browser actual](005-phase6-security-e2e-final.txt) navodi konkretne
artefakte i sourceMaps:[], kao i CSP dostupni script/control/violation i normalan tok.

T16 CSP/header + aktuelni sentinel/bundle deo imaju dokaz u istom završnom
lokalnom checkpoint-u: **T16 PASS za testirani lokalni profil**. Ovo nije opšti
DLP, prepoznavanje proizvoljne tajne u dozvoljenom slobodnom tekstu, live model
robustness, deploy ili završna T00–T17/CI matrica.

## Komande i rezultati

Sve iz projektnog korena, fake provider/mock transport. Izlazi čuvaju prve i
završne rezultate odvojeno. Sve sledeće komande završile su sa exit 0:

| Komanda | Opažen rezultat / dokaz |
|---|---|
| `npm.cmd test -- tests/unit/security-events.test.ts tests/integration/security-events.test.ts tests/integration/security-secrets.test.ts` | 15 PASS; [focused](005-phase6-focused.txt) |
| `npm.cmd test -- tests/integration/security-normal.test.ts tests/integration/security-lifecycle.test.ts tests/integration/security-admission.test.ts tests/integration/security-budgets.test.ts tests/integration/gemini-agent.test.ts tests/integration/ai-failures.test.ts tests/integration/ai-usage.test.ts tests/unit/agent- tests/unit/security-` | 194 PASS; [regression](005-phase6-regression.txt) |
| `npm.cmd test` posle dependency update-a | 1037 PASS / 73 fajla, uključuje UI/summary/usage/admission/lifecycle/adapter; [full](005-phase6-full-tests.txt) |
| `npm.cmd run test:security` posle update-a | 123 PASS; [security](005-phase6-security-final.txt) |
| `npm.cmd test -- tests/integration/security-events.test.ts --disableConsoleIntercept` | 9 PASS + stvarni sanitizovani primeri; [observed](005-phase6-event-observed.txt) |
| Ista events komanda uz dodatnu proveru validnog podmetnutog UUID header-a | 9 PASS; [final header](005-phase6-event-header-final.txt); runtime nepromenjen |
| `npm.cmd run test:security:e2e` posle update-a | svež build + 5 PASS; [browser](005-phase6-security-e2e-final.txt) |
| `npm.cmd run typecheck` | [PASS](005-phase6-typecheck-final.txt) |
| `npm.cmd run lint` | [PASS](005-phase6-lint-final.txt) |
| `npm.cmd run build` | [PASS](005-phase6-build-final.txt) |
| `npm.cmd audit --json` sa mrežom posle update-a | 0 nalaza; [audit](005-phase6-audit-final.json) |
| `git diff --check` | završni [izlaz](005-phase6-diff-check.txt) |

## Handoff i ograničenja

T023–T027 završeni; sledeći **T028**. T028–T031 nisu započeti kao finalna faza.
Nisu potvrđeni clean checkout/npm ci, remote CI, finalni demo ili ljudski peer
review/samostalni negativni testovi Vekija i Milana. Nema pripisanog ljudskog rada.
Puni browser suite van security selekcije nije ponavljan; full node/UI i production
security regresija pokrivaju promene i ciljane dependency zakrpe. Istorijski
screenshot-i nisu menjani. SDK buffering i neotkaziv provider do settle/restart-a
ostaju ranije dokumentovana ograničenja. Audit 0 i jedan sentinel nisu opšta
potvrda bezbednosti aplikacije.
