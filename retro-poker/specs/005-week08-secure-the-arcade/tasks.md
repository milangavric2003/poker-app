# Tasks: Week08 — Secure the Arcade

**Branch**: `week08-init`. Dokumentacija i priprema osnove su urađene; hardening tek sledi.
**Input**: [spec](spec.md), [plan](plan.md), [data-model](data-model.md),
[ugovor](contracts/security.md), [dokazi](../../docs/EVIDENCE_W08.md).

## Pravila rada i vlasništvo

- T001–T031 su implementacioni zadaci; T00–T17 u zagradama su scenariji nastavnog zadatka.
- Vlasnik T001–T003: Codex u sesiji sa Vekijem. Ostali: **D**, trenutni driver
  (Veki ili Milan), upisuje se pri preuzimanju; drugi član je reviewer, tek kad
  stvarno pregleda. Nema fiksne podele, paralelnih agenata ili pretpostavljenog review-a.
- T004 završen 2026-10-26: Codex u sesiji sa Vekijem; ljudski peer review nije potvrđen.
- Svaki task dozvoljava svoje navedene putanje i dopunu `docs/evidence/005-*`,
  `docs/EVIDENCE_W08.md`, `docs/AI_USAGE_LOG.md`, `docs/CONTEXT_MANIFEST.md` i ovog
  tasks fajla. Ostale izmene zahtevaju obrazloženu dopunu plana pre koda.
- Pre **svake faze** pregledaj kod/diff i dokaze prethodne, pokreni relevantne
  fokusirane testove. Ako ne odgovaraju specifikaciji, prvo popravi osnovu, sačuvaj
  stvaran nalaz, pa nastavi. Checkbox nije zamena za proveru.
- Prvo očekivanje i test, zatim implementacija. Već bezbedan tok: PASS→PASS bez
  nepotrebne runtime izmene. Ne menjaj oracle ili timeout da sakriješ grešku.
- Handoff: driver, checkpoint, task, šta je stvarno izvršeno, komande/exit code,
  preostalo, sledeći task. Oba čoveka moraju doprineti kontroli i negativnom testu.

## Faza 1 — setup i osnova

- [x] T001 Kreirati ovaj feature i `docs/EVIDENCE_W08.md`; uskladiti `AGENTS.md`, `docs/GAME_SPEC.md`, manifest i AI log; deps: nema; dokaz: dokumentaciona provera i linkovi, bez tvrdnje o završenom hardening-u.
- [x] T002 Uporediti `week08-init`, `add-modifications`, `main` i review granu; preneti samo `vitest.config.ts`, `tests/integration/ai-failures.test.ts`, `tests/e2e/recovery.spec.ts`, `../.github/workflows/retro-poker-ci.yml` i projektni ignore; deps: nema; dokaz: `docs/evidence/005-baseline.md`, provenance i snapshot patch; bez main/PR merge-a.
- [x] T003 Zabeležiti početne i post-transfer provere u `docs/evidence/005-baseline-*`; deps: T002; dokaz: puni testovi, E2E, typecheck/lint/build i reproduktivan HEAD + patch. Ovo nije clean install/remote CI ili W08 T00–T17 dokaz.
- [x] T004 Proveriti T001–T003 u aktuelnom checkout-u i sačuvati `docs/BUILD_PROMPT_WEEK08_V1.md`; deps: T001–T003; dozvoljeno: taj prompt i evidence; dokaz: sačuvan cilj/scope/I1–I8/komande i potvrđena osnova pre prve security implementacije; [handoff i provere](../../docs/evidence/005-T004-handoff.md).

## Faza 2 — zajednički test harness i početni dokazi

Cilj: poznata sintetička partija i merljivi brojači pre promena politike.
Driver T005–T007: Codex u sesiji sa Vekijem, 2026-10-26.
[Handoff](../../docs/evidence/005-phase2-handoff.md): završeni taskovi uz
namerno otvorene T13/T16 RED nalaze; završna matrica ostaje otvorena.

- [x] T005 Pripremiti `tests/helpers/security-fixtures.ts`, `tests/helpers/security-server.ts` i `tests/integration/security-normal.test.ts`; deps: T004; reuse fake clock/provider i real tool; dokaz: T00 sa ≥2 model koraka, 1 stvarnim tool izvršenjem, validnim finalom i nepromenjenim kanonskim stanjem. Sačuvati tačan ulaz/expectation i actual.
- [x] T006 Pre hardening-a napisati i izvršiti iste početne scenarije T07/T13/T16 u `tests/integration/security-tools.test.ts`, `tests/integration/security-admission.test.ts`, `tests/e2e/security-production.spec.ts`; po potrebi build/preview helper u `tests/helpers/security-server.ts`; deps: T005; dokaz: ≥3 pre rezultata u `docs/EVIDENCE_W08.md` sa fixture hash/putanjom, checkpoint-om i brojačima. Pad setup-a nije security RED; već dobar T07 je PASS→PASS.
- [x] T007 Uvesti `test:security` u `package.json` za `tests/{unit,contract,integration}/security-*.test.ts`, sa testovima iz T005/T006; deps: T006; dozvoljeno i `quickstart.md`; dokaz: jedna ponovljiva fake-only komanda, običan `npm test` i dalje uključuje sve testove. Trenutno otvorene očekivane security padove zabeležiti.

## Faza 3 — US1: ulaz, scope i alati

Nezavisna provera: validan coaching prolazi, svaka nedozvoljena granica se odbija
pre odgovarajućeg rada. Sačuvati poker oracle-e ARCH1–8/AC19/AC23.

- [ ] T008 [US1] RED/regresija HTTP T01/T02/T03 u `tests/contract/security-http.test.ts`; deps: T007; nevalidan JSON/tip/null/missing, zasebno 1.024-byte body cap i privilegovana polja, nepoznat ID/stale verzija, pozitivna byte granica; dokaz: 0 provider/0 tool i nepromenjen state, ispravan status.
- [ ] T009 [US1] Minimalni GREEN samo za otkrivene rupe u `backend/src/app.ts`, `backend/src/routes.ts`, `backend/src/session.ts`, `shared/contracts.ts`; deps: T008; dokaz: T01–T03 + normalan T00, bez novih naloga ili opšteg refaktorisanja.
- [ ] T010 [US1] RED/regresija T06–T10 u `tests/integration/security-tools.test.ts` i `tests/unit/security-schemas.test.ts`; deps: T009; invalid/oversized model, constructor/toString, args null/extra/limit 0/11, inače validan focus van scope-a, malicious fake proposal, oversized/extra/tuđ tool rezultat; pozitivan limit 1/10; dokaz: tačni executor/model brojači i nema curenja ka sledećem modelu.
- [ ] T011 [US1] Minimalni GREEN u `backend/src/agent/{orchestrator,tools,validation}.ts` i `shared/contracts.ts`; deps: T010; očuvati 200 odluka, 10×5 facts, 20.480-byte tool/32.768-byte model limite, tekst/reference granice iz plana i tačno članstvo; dokaz: T06–T10/T00, read-only i bez neodobrenih efekata.
- [ ] T012 [US1] Testirati T15 i stvarni origin/credential model u `tests/contract/security-http.test.ts`, `tests/e2e/security-state.spec.ts`; deps: T011; browser tamper ne menja server, nepoznat/null origin odbijen pre rada, dozvoljen origin prolazi; minimalne popravke samo `app.ts`/`routes.ts` po RED-u; dokaz: eksplicitno CSRF/SQL N/A gde funkcija ne postoji, bez preskakanja API/scope provera.

## Faza 4 — US2: budžeti, kapacitet i zakašnjeli poslovi

Nezavisna provera: fake sat/provider pokazuju granice i legitiman oporavak.

- [ ] T013 [US2] RED/regresija T11/T12 u `tests/integration/security-budgets.test.ts`, mock SDK provera u `tests/integration/gemini-agent.test.ts`; deps: T012; ponavljanje zasebno od 2 koraka/1 tool/4 attempts, retry/fallback, 15 s call/45 s total/1 s tool i posebno zbir kratkih poziva; očekivati 4.096 output tokens; dokaz: nijedan dodatni poziv ili late success.
- [ ] T014 [US2] GREEN budget/adapter u `backend/src/agent/orchestrator.ts`, `backend/src/ai/providers/gemini.ts` i po potrebi `backend/src/agent/types.ts`; deps: T013; dokaz: T11/T12 i mock config za sve coaching pokušaje, SDK attempts=1, dokumentovano naknadno byte ograničenje ako SDK baferuje.
- [ ] T015 [US2] RED T13 u `tests/integration/security-admission.test.ts`, `tests/unit/security-capacity.test.ts`; deps: T014; globalno 2 stvarna provider posla, zajedno coach/analysis/bot; 5 novih coach/analysis startova u kliznih 60.000 ms; dedupe, odbijanje viška, race, recovery, usage/new-game reset; dokaz: active maximum, ne samo broj HTTP statusa.
- [ ] T016 [US2] GREEN u `backend/src/security/{admission,capacity}.ts`, `backend/src/{app,routes,session}.ts`, `backend/src/ai/coordinator.ts`, `backend/src/agent/orchestrator.ts`, `shared/contracts.ts` i `frontend/src/{App.tsx,api.ts}` po potrebi; deps: T015; atomski gate, lease do settle, nema neograničenog reda, 429 kodovi/Retry-After, eksplicitan retry i lokalni bot fallback pri punom kapacitetu; dokaz: T13/T00, summary regeneration i usage regresija.
- [ ] T017 [US2] RED dodatni T17 u `tests/integration/security-lifecycle.test.ts`; deps: T016; neotkaziv provider → nova partija + usage reset → novi start → stari resolve/reject; dokaz: 2-boundary lanac, kapacitet nije resetovan, nema stare mutacije/usage upisa ili unhandled rejection.
- [ ] T018 [US2] Minimalni GREEN lifecycle-a u `backend/src/security/capacity.ts`, `backend/src/session.ts`, `backend/src/agent/orchestrator.ts` i `backend/src/ai/coordinator.ts`; deps: T017; dokaz: T12/T13/T17 i postojeće lifecycle provere. Neoslobođen posao zadržava mesto do settle/restart-a; ne praviti lažni cleanup.

## Faza 5 — US3: bezbedan prikaz i produkcioni browser

Nezavisna provera: pravi browser vidi normalan tekst i igru, bez aktivnog payload-a.

- [ ] T019 [US3] RED/regresija T04/T05 u `tests/e2e/security-rendering.spec.ts`, fake final u `tests/helpers/security-fixtures.ts`; deps: T018; XSS execution marker + DOM, HTML/Markdown/javascript link/spoljna slika, pozitivan srpski tekst/apostrof/a<b; dokaz: stvarna final→UI putanja, bez oslanjanja samo na alert ili CSP.
- [ ] T020 [US3] Ako T019 otkrije rupu, minimalni GREEN u `frontend/src/components/{CoachPanel,AnalysisPanel}.tsx`; inače bez runtime promene; deps: T019; dokaz: T04/T05 plus postojeći panel/keyboard testovi, bez novog rich-text renderera.
- [ ] T021 [US3] Dopuniti početni T16 test u `tests/e2e/security-production.spec.ts` i helper; deps: T020; kontrolisani drugi origin script radi bez CSP-a (200 + marker), politika ga blokira uz violation direktivu; dokaz: stvaran preview build, bypassCSP=false, normalna igra i coaching.
- [ ] T022 [US3] GREEN u `vite.config.ts`, po potrebi zajednički `frontend/security-headers.ts`, i `package.json`/`quickstart.md`; deps: T021; policy iz plana, nosniff/no-referrer, `test:security:e2e` gradi i izvršava security browser testove; dokaz: T04/T05/T16, desktop/mobile i summary/usage očuvani. Nema slabljenja script-src zbog inline CSS-a.

## Faza 6 — US4: događaji, tajne i zavisnosti

Nezavisna provera: kontrolisani events i sentinel bez curenja, ponovljiva evidencija.

- [ ] T023 [US4] RED event/log injection u `tests/unit/security-events.test.ts`, `tests/integration/security-events.test.ts`; deps: T022; allowlist iz data-model-a, server correlation UUID, safe integer brojači, acceptance/rejection/terminal, newline forged event; max 200 i 30 min retention; dokaz: nema sirovog sadržaja ni duplog terminala.
- [ ] T024 [US4] GREEN `backend/src/security/events.ts` i integracija `app.ts`/`routes.ts`/`session.ts`/`agent/orchestrator.ts`; deps: T023; dokaz: sanitized sink i kontrolisana memorija, bez javnog log endpoint-a, raw prompt/stack-a ili reset-a kroz usage API.
- [ ] T025 [US4] RED/regresija T14/T16 sentinel u `tests/integration/security-secrets.test.ts`, `tests/e2e/security-production.spec.ts` i helper; deps: T024; server stvarno učitava sintetičku vrednost, adapter greška i extra tool polje, bundle/source maps/HTTP/model/events skeniranje; dokaz: nije test samo imena env promenljive niti opšti DLP claim.
- [ ] T026 [US4] Minimalni GREEN prema T025 u `backend/src/ai/providers/gemini.ts`, `backend/src/agent/validation.ts`, `backend/src/security/events.ts`, `backend/src/app.ts`, `vite.config.ts`; deps: T025; dokaz: T10/T14/T16 plus normalan tok. Ne čitati/stavljati pravi ključ u fixture/log.
- [ ] T027 [US4] Pokrenuti dependency audit i mapirati runtime/dev izloženost u `docs/EVIDENCE_W08.md`; deps: T026; po potrebi ciljano `package.json`/`package-lock.json` uz prethodni regression scenario; dokaz: verzija/advisory/uslov/odluka i relevantna regresija ili iskreno zabeležena prepreka, bez force upgrade-a.

## Faza 7 — završna provera i predaja

- [ ] T028 Izvršiti kompletnu T00–T17 matricu, ponoviti ista tri pre/posle ulaza i full test/E2E/typecheck/lint/build/diff-check; deps: T027; dozvoljeno: evidence i minimalna ispravka isključivo uz novi nalaz/test; dokaz: svi obavezni redovi imaju actual rezultat i brojače, bez sakrivanja prvog pada rerun-om.
- [ ] T029 Potvrditi clean `npm ci` i iste komande u izolovanom checkout-u/CI, dopuniti `../.github/workflows/retro-poker-ci.yml` za security komande po potrebi; deps: T028; dokaz: commit/okruženje i stvarni izlazi; remote CI ne označavati PASS dok run za konkretni SHA nije pregledan. Ne push/merge bez važećeg korisničkog zahteva.
- [ ] T030 Veki i Milan pregledaju promene, svaki doprinese kontroli i samostalno osmisli negativni test, odrade osam minuta demo-a i individualnu varijantu; deps: T029; dozvoljeno: evidence i sintetički testovi; dokaz: stvarna imena/commitovi/objašnjenja, bez Codex potvrde u njihovo ime.
- [ ] T031 Uskladiti `spec.md`, `plan.md`, `tasks.md`, `quickstart.md`, `docs/GAME_SPEC.md`, `docs/EVIDENCE_W08.md`, manifest/AI log i završni checkpoint; deps: T030; dokaz: I1–I8→kontrola→test→actual, nema preostalih obaveznih rupa; označiti samo stvarno zatvorene stavke.

## Zavisnosti, mapa i način isporuke

T001 i T002 vode u T003/T004; zatim T005→T006→…→T031. Svaka faza je checkpoint.
Nema paralelnih agenata; nezavisni browser/events poslovi mogu se pripremati kao
beleške od drugog čoveka, ali promene istih fajlova rade se naizmenično.
Prvi koristan inkrement je US1, ali sam US1 ne zatvara Week08.

| US / zahtevi | Zadaci | Scenariji |
|---|---|---|
| Osnova / FR-015 | T001–T007 | T00, početni T07/T13/T16 |
| US1 / FR-001–005, FR-013 | T008–T012 | T01–T03, T06–T10, T15, origin |
| US2 / FR-006–008 | T013–T018 | T11–T13, T17 |
| US3 / FR-009–010 | T019–T022 | T04–T05, T16 |
| US4 / FR-011–012, FR-014 | T023–T027 | T10, T14, T16, audit |
| FR-015 / svi SC | T028–T031 | Celokupna matrica, pre/posle, par |

Ukupno 31 task: setup 4, foundation 3, US1 5, US2 6, US3 4, US4 5, final 4.
