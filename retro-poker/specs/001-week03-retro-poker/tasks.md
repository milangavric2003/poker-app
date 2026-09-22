# Tasks: Week03 lokalna Retro Poker igra

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [ugovor](contracts/http.md), [fixtures](fixtures.md),
[quickstart](quickstart.md). Status: T001–T015 izvršeni; ostali taskovi nisu završeni.

Zajednički artefakti pripremljeni su iz ugla člana A uz coding agenta;
kolegin doprinos i review nisu potvrđeni. Dokazi: [EVIDENCE_003](../../docs/EVIDENCE_003.md).
Osnovna podela je A: T001–T021, B: T022–T040, uz izričit izuzetak od 2026-09-22:
član B preuzima i završava samo T014–T015 na grani `vedran`.
Ostalo vlasništvo nije promenjeno. [Prompt bloka](../../docs/BUILD_PROMPT_T014_T015.md).

**Tests**: TDD obavezan. RED task prethodi GREEN tasku za isti behavior slice.
Svaki RED/GREEN task zapisuje stvarnu komandu, exit kod i smislen razlog u
docs/evidence/Txxx-red.txt odnosno Txxx-green.txt. Prazan runner/import error nije RED.
Dozvoljene putanje su navedene u tasku, uz taj evidence fajl i dopunu
docs/AI_USAGE_LOG.md / docs/CONTEXT_MANIFEST.md za stvarno izvršene značajne pozive.

A = prvi član; B = drugi član (korisnik ovog T014–T015 bloka).
Navedeni vlasnik vodi rad; drugi je reviewer. U većim blokovima menjajte driver/reviewer.
Zajednički ugovor i lockfile imaju jednog aktivnog urednika. Jedan coding agent;
nema [P] oznaka koje bi sugerisale paralelne agente. Putanje su iz retro-poker/.

## Phase 1: Setup (Shared Infrastructure)

Cilj: sačuvati polazni kontekst i uspostaviti alate bez implementacije poker ponašanja.

- [x] T001 A — Sačuvati docs/BUILD_PROMPT_V1.md pre koda i otvoriti docs/CONTEXT_MANIFEST.md, docs/AI_USAGE_LOG.md, docs/EVALS.md i docs/EVIDENCE_003.md sa stvarnim izvorima i statusom „nije pokrenuto”; deps: nema; dokaz: scope/DoD/prompt sačuvani, bez izmišljenih rezultata.
- [x] T002 A — Uvesti package.json, package-lock.json, tsconfig.json, tsconfig.server.json, vite.config.ts, vitest.config.ts, playwright.config.ts, eslint.config.js, frontend/index.html, README.md i projektni .gitignore; zaključati kompatibilne pakete iz research D1 i sve komande iz quickstart; deps: T001; dokaz: instalacija/runner/typecheck setup rade, oba server porta eksplicitna, generisani dist/dependencies ignorisani. Nema tvrdnje da poker testovi prolaze.

## Phase 2: Foundational (Blocking Prerequisites)

Cilj: zajednički ugovori i test infrastruktura pre obe P1 priče.

- [x] T003 A — RED u tests/contract/config.test.ts i tests/contract/messages.test.ts za kompletan contracts/http.md: botCount „ceo JSON broj 1–5”, Chips „Bezbedan ceo broj 0–6000”, UUID identitet, version „bezbedan ceo broj ≥ 0”, amountTo samo bet/raise, strict nepoznata polja i sve izlazne unije; deps: T002; dokaz: svaki negativni primer iz GAME_SPEC §7 i granice polja imaju unapred očekivanje.
- [x] T004 A — GREEN u shared/contracts.ts za T003; Card „rang iz 23456789TJQKA, suit iz cdhs”, Seat „Ceo broj 0–5”, cards null ili tačno2; board0/3/4/5, svi enum-i i nullable uslovi iz ugovora bez implicitne konverzije; deps: T003; dokaz: contract regresija, tipovi i schema output saglasni.
- [x] T005 A — Pripremiti backend/src/engine/types.ts, tests/helpers/fixtures.ts, tests/helpers/assertions.ts i tests/helpers/server.ts kao test interfejse i ručne podatke iz fixtures.md; deps: T004; dokaz: EV/BL primeri preneti bez promene oracle-a, ukupni stack u fixture-u konzistentan, odvojeni RNG izvori i bez produkcione test HTTP rute. Helper ne računa očekivanje funkcijom pod testom.

Checkpoint: osnovne šeme i harness spremni. Prvo se razrađuje US2, koji je takođe P1,
jer njegov evaluator/obračun omogućava nezavisno testiranje i završetak US1.

## Phase 3: User Story 2 — Ispravan obračun složene ruke (P1)

Cilj: deterministički domen za uloge, rank i potove.
Samostalna provera: zadati snapshot-i AC05–AC15, bez UI-ja ili cele partije.

- [x] T006 [US2] A — RED u tests/unit/evaluator.test.ts za EV01–EV10, sve kategorije/kickere i duple/nevalidne karte; deps: T005; dokaz: AC14/AC15 oracle pre implementacije, poređenje susednih kategorija. [Stvarni RED: 96 pada](../../docs/evidence/T006-red.txt).
- [x] T007 [US2] A — GREEN u backend/src/evaluator/rank.ts enumeracijom pet karata, category0–8 i kicker niz; validno5/6/7 dostupnih karata, showdown7, bez suit tiebreak-a; deps: T006; dokaz: evaluator testovi prolaze i ne koriste evaluator za očekivanje. [GREEN: 96 prolazi](../../docs/evidence/T007-green.txt); [završne provere](../../docs/evidence/T007-final-checks.txt).
- [x] T008 [US2] A — RED u tests/unit/betting.test.ts za AC04–AC10, BB opciju, kratki blind, dry side-pot, zabranu raise-a kroz all_in; deps: T005; dokaz: currentBet/lastFullRaise/pendingActors i individualni lastFacedBet imaju očekivanja.
- [x] T009 [US2] A — GREEN u backend/src/engine/betting.ts za legalActions i primenu uloga; „lastFullRaise ≥ 10”, iznosi safe integer, „Check beleži lastFacedBet=0”; deps: T008; dokaz: svi RED slučajevi i očuvanje stackova prolaze.
- [x] T010 [US2] A — RED u tests/unit/pots.test.ts za AC11/AC12/AC13, foldovane doprinose, više tied side potova i ponovljen settlement; deps: T007, T009; dokaz: [5 pada, 1 prolazi](../../docs/evidence/T010-red.txt), refund120/pot160 i 300/300 oracle iz fixtures.
- [x] T011 [US2] A — GREEN u backend/src/engine/pots.ts; svaki nivo doprinosa, eligibleIds, refund i split zasebno, neparni žeton levo od button-a; deps: T010; dokaz: [6 prolazi](../../docs/evidence/T011-green.txt), [regresija 123](../../docs/evidence/T011-regression.txt), nema duple isplate ni izgubljenih žetona.
- [x] T012 [US2] A — RED u tests/unit/hand.test.ts i tests/unit/invariants.test.ts za settlement iz river/all-in/fold snapshot-a, netChanges zbir0 i handContribution reset; deps: T011; dokaz: [9 pada, 2 prolaze](../../docs/evidence/T012-red.txt), AC16 i generisani legalni prelazi proveravaju invarijante.
- [x] T013 [US2] A — GREEN settlement deo backend/src/engine/hand.ts; reason showdown/uncontested, settled boolean, result i status tek nakon isplata; deps: T012; dokaz: [11 prolazi](../../docs/evidence/T013-green.txt), [regresija 134](../../docs/evidence/T013-regression.txt), nema negativnih/razlomljenih Chips.

Checkpoint: domen US2 prolazi. B može naknadno review-ovati domen pre svoje integracije,
ali nema istovremenih agent sesija niti menjanja istih fajlova.

## Phase 4: User Story 1 — Započni i odigraj ruku (P1)

Cilj: prvi pun UI–backend demo sa već proverenim obračunom.
Samostalna provera: AC23 kontrolisana heads-up ruka završava stackovima1010/990.

- [x] T014 [US1] B — RED u tests/unit/deal.test.ts za AC01/AC02/validni AC03, dva kruga deljenja, burn/board, fold/all-in preskakanje i jednoznačan tok; deps: T013; dokaz: svi botCount1–5, početni button0, heads-up prva karta BB; [33 stvarna RED pada](../../docs/evidence/T014-red.txt), [preduslovi 134/134](../../docs/evidence/T014-prerequisites.txt).
- [x] T015 [US1] B — GREEN u backend/src/engine/cards.ts, backend/src/engine/positions.ts i početak/runde backend/src/engine/hand.ts; 52 jedinstvene karte i board3–1–1, prvi button čovek; deps: T014; dokaz: new-hand do settlement toka iz fixture-a; [33/33 GREEN](../../docs/evidence/T015-green.txt), [267/267 regresija](../../docs/evidence/T014-T015-final-test.txt), typecheck/lint/build exit0. Pozicije su početne; rotacija i next-hand ostaju kasniji taskovi.
- [ ] T016 [US1] A — RED u tests/unit/bot.test.ts i tests/unit/history.test.ts za BOT1–BOT6, AC17 i FR-018: strategija D3, odvojen RNG, privatna ograničenja, detektovan fallback, samo trenutna/poslednja istorija; deps: T015; dokaz: isti seed/input isti potez, bez tuđih skrivenih podataka.
- [ ] T017 [US1] A — GREEN u backend/src/bots/strategy.ts i backend/src/engine/history.ts prema research D3; događaji imaju „seq (rastući broj u ruci)”, privatno observation ne izlazi u public event; deps: T016; dokaz: bot po istom validatoru završava ruku i posle ljudskog fold-a.
- [ ] T018 [US1] A — RED u tests/integration/actions.test.ts i tests/integration/hand-flow.test.ts za create/get/action, nevalidan config bez zamene, izgubljenu reviziju, serijski commit/rollback, bot loop, početnu privatnost i AC23; deps: T017; dokaz: Fastify inject fixture i RNG/history snapshot pre/posle greške.
- [ ] T019 [US1] A — GREEN u backend/src/app.ts, backend/src/server.ts, backend/src/routes.ts, backend/src/session.ts i backend/src/view.ts; memory-only127.0.0.1:3001, create/get/actions iz ugovora, UUID Game/Hand, version jednom po komandi, strict javna projekcija; deps: T018; dokaz: integracija radi bez produkcionog fixture endpoint-a, error ne curi stanje.
- [ ] T020 [US1] A — RED u tests/ui/table.test.tsx, tests/ui/actions.test.tsx i tests/ui/api.test.ts za početak, karte/stack/pot, legalne kontrole i amountTo/doplatu, loading blokadu, schema odgovora, potvrdu reseta; deps: T004, T019; dokaz: validni javni fixtures bez ručno dupliranih poker pravila.
- [ ] T021 [US1] A — GREEN u frontend/src/main.tsx, frontend/src/App.tsx, frontend/src/api.ts, frontend/src/components/Table.tsx, frontend/src/components/ActionPanel.tsx, frontend/src/components/HandResult.tsx i frontend/src/styles.css; deps: T020; dokaz: lokalni kompletan potez, događaji redom, rezultat ostaje vidljiv.
- [ ] T022 [US1] B — RED u tests/e2e/play-hand.spec.ts i po potrebi tests/helpers/server.ts za AC23 špil iz fixtures, čovek call5/check do kraja i AC16 fold; deps: T021; dokaz: pravi backend i frontend, bez mrežnog set-deck-a, rezultat1010/990 ili995/1005.
- [ ] T023 [US1] B — GREEN integracionih razlika samo u backend/src/session.ts, backend/src/routes.ts, backend/src/view.ts, frontend/src/App.tsx i frontend/src/api.ts; deps: T022; dokaz: E2E i postojeća regresija. Ako test odmah prođe, zabeležiti proveru postojećeg ponašanja bez izmišljanja RED-a ili promene koda.
- [ ] T024 [US1] B — Sačuvati prvi integrisani baseline u docs/EVIDENCE_003.md, docs/EVALS.md i docs/evidence/ sa ponovljivim Git snapshot-om, promptom, manifestom, stvarnim komandama/screenshot-om; deps: T023; dokaz: baseline se može ponoviti pre ciljane izmene. Ako je stvarni propust otkriven ranije, njegov snapshot sačuvati pre tadašnje popravke.

Checkpoint: prvi upotrebljiv demo. Nema još tvrdnje da su lifecycle/recovery/Week03
dokazi završeni. Ne ograničavati legalna poker pravila da bi demo izgledao završen.

## Phase 5: User Story 3 — Nastavi do pobede ili poraza (P2)

Cilj: stack carry-over, eliminacija, pomeranje blindova i završetak.
Samostalna provera: BL01–BL10 i AC20 iz gotovih snapshot-a, zatim dve povezane ruke.

- [ ] T025 [US3] B — RED u tests/unit/positions.test.ts za sve BL01–BL10 i rotacije, kratke blindove i neiskorišćena mesta; deps: T024; dokaz: AC21 konkretne pozicije, pre/post actor i izostanak uzastopnog BB u heads-up prelazu.
- [ ] T026 [US3] B — GREEN prelazi u backend/src/engine/positions.ts; Seat „Ceo broj 0–5”, stabilan configured ring, dead SB bez naplate i heads-up izuzetak; deps: T025; dokaz: sve BL tabele i početni AC02 prolaze.
- [ ] T027 [US3] B — RED u tests/integration/session.test.ts za next-hand, „status playing/won/lost”, AC20, stack carry-over, odbijen prerani/dupli nastavak, FR-018 rotaciju istorije i reset; deps: T026; dokaz: ljudska eliminacija zaustavlja session čak i kada čisti positions modul može računati botove.
- [ ] T028 [US3] B — GREEN u backend/src/session.ts, backend/src/routes.ts, backend/src/engine/hand.ts i backend/src/engine/history.ts za next-hand i ispadanje tek posle potova; deps: T027; dokaz: AC20/AC21 i gubitak memorije pri novom app procesu.
- [ ] T029 [US3] B — RED u tests/ui/results.test.tsx i proširenju tests/e2e/play-hand.spec.ts za result, next-hand, pobedu/poraz i reset confirmation cancel/confirm; deps: T028; dokaz: AC23 druga ruka počinje stackovima1000/985 plus blindovi10/5.
- [ ] T030 [US3] B — GREEN u frontend/src/App.tsx, frontend/src/components/HandResult.tsx i frontend/src/api.ts; deps: T029; dokaz: rezultat ne nestaje sam, terminalna partija nema next-hand, reset vraća početne stackove.

## Phase 6: User Story 4 — Jasne informacije i kontrolisane greške (P2)

Cilj: proveriti granice javnog pogleda, duple zahteve, recovery i desktop pristupačnost.
Samostalna provera: public snapshot, namerna greška veze i dupli zahtevi u fixture-u.

- [ ] T031 [US4] B — Proširiti RED tests/contract/view.test.ts i tests/integration/concurrency.test.ts: AC19 kroz sve faze/fold/showdown, svaki nested event/result bez tajni, AC18, create/reset preconditions, 400/404/409/413/415/428/500 i rollback RNG; deps: T030; dokaz: ulazi iz celog HTTP ugovora.
- [ ] T032 [US4] B — GREEN potrebnih granica u backend/src/view.ts, backend/src/session.ts, backend/src/routes.ts i backend/src/app.ts; deps: T031; dokaz: stale/double ne mutira, samo dozvoljeni Origin, bez debug endpoint-a. Već prolazne slučajeve beležiti kao regresiju, ne fabrikovati RED.
- [ ] T033 [US4] B — RED u tests/e2e/recovery.spec.ts i tests/ui/api.test.ts: AC22 refresh/restart, timeout/izgubljen uspešan odgovor, nevalidan odgovor i zabrana automatskog retry mutacije; deps: T032; dokaz: poslednji snapshot ostaje, GET usklađuje stanje bez ponovljenog poteza.
- [ ] T034 [US4] B — GREEN u frontend/src/api.ts i frontend/src/App.tsx; deps: T033; dokaz: razumljive srpske greške, game:null vodi novu partiju, loading/error ne izmišlja uspeh.
- [ ] T035 [US4] B — RED u tests/e2e/accessibility.spec.ts i tests/ui/table.test.tsx za1280×720, fokus/tastaturu, karte bez oslanjanja samo na boju, sva mesta/potove i istoriju; deps: T034; dokaz: kontrola skrola/preklapanja i semantičkih label-a, screenshot za ručni vizuelni review.
- [ ] T036 [US4] B — GREEN u frontend/src/styles.css, frontend/src/components/Table.tsx, frontend/src/components/ActionPanel.tsx i frontend/src/components/HandResult.tsx; deps: T035; dokaz: retro prikaz sa lokalnim assetima, svi obavezni UI elementi čitljivi, postojeći E2E prolazi.

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T037 B — U docs/EVALS.md i docs/EVIDENCE_003.md povezati baseline i stvarni E4 nalaz, unapred zapisati očekivanja E1/E2/E3/E4 i nezavisan holdout; deps: T036; dokaz: identičan eval pre/posle može da se ponovi. Ako E4 nije pronađen, proširiti stvarne provere i ostaviti kriterijum otvoren.
- [ ] T038 B — RED za stvarni izabrani propust u odgovarajućem tests/unit/, tests/contract/, tests/integration/, tests/ui/ ili tests/e2e/ fajlu; pre izmene upisati tačnu izabranu putanju i snapshot u docs/EVIDENCE_003.md; deps: T037 i stvarni nalaz; dokaz: test reprodukuje nalaz. Ako raniji sačuvani ciklus već zadovoljava E4, povezati dokaz bez ponovnog ubacivanja buga.
- [ ] T039 B — Najmanji GREEN samo u izabranoj putanji backend/src/, shared/contracts.ts ili frontend/src/ zabeleženoj u T038, uz isti eval i holdout; deps: T038; dokaz: docs/EVIDENCE_003.md ima pre/posle, ograničenje i ljudsku odluku. Postojeći validni raniji dokaz može se referencirati; ne izmišljati novu promenu.
- [ ] T040 B — Ponoviti quickstart, sve unit/contract/integration/UI/E2E, typecheck/lint/build, offline localhost proveru i drugi checkout; ažurirati README.md, docs/EVIDENCE_003.md i docs/AI_USAGE_LOG.md; deps: T039; dokaz: svi AC01–AC23/SC-001–SC-007 imaju stvarni rezultat, nema označenih uspeha za nepokrenute provere, bez deploymenta.

## Dependencies & Execution Order

Podrazumevano izvršavati redom; eksplicitne deps omogućavaju raniji nezavisan
ljudski rad, ali ne preskakanje RED-a ili faznih checkpoint-a.

Setup T001–T002 → Foundation T003–T005 → US2 T006–T013 →
US1 T014–T024 → US3 T025–T030 → US4 T031–T036 → dokazi T037–T040.

US2 i US1 imaju isti prioritet P1. US2 ide prvi jer US1 puna ruka zahteva rank/potove;
nema ciklične zavisnosti. US3 dodaje session nastavak, US4 proširuje već postojeću
osnovnu validaciju/privatnost; osnovne granice se ne odlažu do završnog poliranja.

Svaki GREEN zavisi od odgovarajućeg RED testa. Ako prošireni scenario već prolazi,
zabeležiti istinitu regresiju i tražiti nedostajuće ponašanje samo u stvarnom scope-u;
ne namerno kvariti kod radi obojenog loga.

## Handoff i ljudski review

- A vodi T001–T021, uz korisnički odobren handoff T014–T015 članu B; predaja punog unit/contract/integration/UI skupa tek sledi.
- Granica je posle T021: B počinje T022 pravim E2E testom nad A implementacijom.
- B izvršava T022–T040 i prijavljuje svaki nalaz koji zahteva promenu A koda.
- Drugi član može review-ovati završeni blok, ali vlasništvo taska ostaje po ovoj podeli.
- Shared ugovori, lockfile i logovi menjaju se serijski, uz proveru postojeće regresije.

Ovo su mogućnosti podele rada ljudi, ne instrukcije za više paralelnih coding agenata.
Review doprinos beleži se tek kada ga drugi član zaista uradi.

## Implementation Strategy

Prvi milestone je US2+US1 integrisani lokalni demo jedne ruke (T024),
zatim kontinuirana partija US3, potom oporavak i UI US4, pa dokaz predaje.
Week03 DoD zahteva sve priče; nijedna P2 funkcionalnost nije opciona.

Predlog10–15 značajnih iteracija: setup/ugovori; evaluator; wagering; pots/settlement;
dealing; bots/history; transport; UI/E2E/baseline; positions/session; result UI;
recovery/privacy; accessibility; kontrolisana promena/finalni dokaz.
Svaka može sadržati više malih TDD ciklusa. Broj taskova nije broj AI poziva.

## Pokriće

| Zahtevi | Taskovi |
|---|---|
| FR-001–FR-004, AC01–AC03 | T003–T005, T014–T015, T025–T026 |
| FR-005–FR-010, AC04–AC16 | T006–T013 |
| FR-011, AC20–AC21 | T025–T030 |
| FR-012, AC19 | T016–T019, T031–T032 |
| FR-013, AC17, BOT1–BOT6 | T016–T019 |
| FR-014–FR-016, AC18, AC22, ARCH1–ARCH8 | T002–T004, T018–T019, T027–T028, T031–T034 |
| FR-017, SC-005 | T020–T023, T035–T036 |
| FR-018 | T016–T017, T027–T028 |
| AC23 | T022–T023, T029–T030 |
| SC-001–SC-004, SC-006–SC-007 i dokazi | T001, T024, T037–T040 |

Ukupno40 taskova: setup2, foundation3, US2 8, US1 11, US3 6, US4 6, završni4.
Svi checkbox-i ostaju prazni dok se task stvarno ne izvrši.
