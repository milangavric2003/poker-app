# Context manifest — implementacioni blok člana A

## Week05 Phase 1 T007–T011 — 2026-10-04

Prioritet: aktuelni priloženi zahtev > AGENTS/constitution > GAME_SPEC 1.2 > feature
003. Početni HEAD `3c4a8f40368b119a3c3e6f9e687e15ff645bd317`; početni status čist.
Jedan agent; bez delegacije. Pročitani AGENTS, constitution 1.1.0, GAME_SPEC,
V1 prompt, relevantni uvod manifesta, kompletni 003 spec/plan/tasks/data-model/HTTP,
requirements checklist 12/12, baseline.md i spisak baseline logova. Prvi spojeni
ispisi bili su skraćeni; spec/plan i relevantni ugovori ponovo izdvojeni.
Korišćeni shared/contracts.ts, ai/match-facts.ts, match-facts test, Week04
fake-ai-provider i fixtures helper, package/ESLint/ignore i speckit-implement skill.
Prerequisite sa eksplicitnim feature 003: exit 0; extensions.yml ne postoji.
T009/T010/T011 evidence putanje dopunjene pre rada radi stvarnog RED/GREEN handoff-a.
Novi testovi/moduli/evals su kontekst nastao u ovom bloku. Nema novih biblioteka.
Izostavljeni .env, web, provider implementacija, UI i lifecycle: nisu potrebni za
ugovore/lokalni read-only alat. Nema live poziva, ljudski peer review nije potvrđen,
potrošnja coding sesije nije dostupna. Handoff i stvarni izlazi: 003-T007–T011 evidence.

## Week05 priprema T002–T006 — 2026-10-04

Aktuelni korisnički zahtev ima prioritet: jedan agent, redom T002→T006, proveriti
prethodni task i sačuvati diff; bez aplikacionog koda, bez izmišljenih rezultata.
Polazni HEAD b0b02cab1e4491d5cdf65638d051c13d213f4eff, Git koren roditeljski.
Zatečene korisničke izmene: roditeljski .gitignore, AGENTS.md i GAME_SPEC.md;
untracked Week05 V1 prompt i feature 003. AGENTS/.gitignore nisu menjani ovim radom.
Git status/diff proveravani na prelazima; nema ljudskog review potpisa.

| Stvarno korišćen izvor | Verzija / prioritet / razlog | Rizik i obim čitanja |
|---|---|---|
| Korisnikov Pasted text.txt | Zahtev ovog razgovora, najviši | T002–T006; ne pripisivati kolegi doprinos |
| AGENTS.md; GAME_SPEC.md | Radna verzija 2026-10-04; GAME_SPEC 1.2 | Pravila procesa, scope, §13–15; GAME_SPEC dodatno pročitan §6–12 nakon skraćenog prvog ispisa |
| constitution | 1.1.0, 2026-09-26 | Pročitani principi/governance; Week03 zabrana ne predstavlja zabranu odobrenog Week05 scope-a |
| Feature 003 spec/plan/tasks | Radna verzija 2026-10-04 | Celokupan spec/plan/tasks u zasebnim ispisima; requirements review i task granice |
| Week05 V1 prompt | Untracked zatečen V1; 2026-10-04 | Pročitan; dopuna pre koda čuva original; nema Git provenance dokaza starijeg snimanja |
| ../weekly-assignment.md | Lokalni W05 tekst 2026-10-04 | Relevantni §5–33, §34–41 i budžet/artefakt indeks; prvi veliki ispis skraćen, ne tvrdi se čitanje svakog reda |
| ../week-05-bounded-agentic-workflows-reliable-integration-addendum.md | Lokalni W05 addendum | Fokus §4–5, §7–15, §17–18; indeks ostalih odeljaka; bez tvrdnje punog čitanja skraćenog ispisa |
| speckit-checklist/SKILL.md; checklist-template | Projektne lokalne verzije | Kvalitet zahteva, ownership; primenjeno na korisnikov eksplicitni review, bez automatskog behavior rada |
| check-prerequisites.ps1; common.ps1 | Lokalni skript i feature override deo common-a | Prvi poziv execution-policy pad; drugi poseban proces Bypass i feature 003 uspeo; extensions.yml ne postoji |
| backend ai/types, coordinator, retry-policy, match-facts | Kod iz početnog HEAD-a; fokusirani izvodi | Week04 retry/attempt tipovi, 200 detaljnih odluka, read-only projekcija; ne tvrdi se review svakog reda backend-a |
| backend routes/session; fake-ai-provider | Početni HEAD; relevantni analysis/version/revision izvodi | HTTP obrazac, serijski commit i async fingerprint; stari coordinator nije Week05 run budžet |
| package.json; vitest.config.ts; gemini-live-smoke.test.ts | Manifest 0.1.0; lokalni runner | Tačne postojeće komande, offline stub i podproces timeout; bez novih zavisnosti |
| EVIDENCE_003; AI_USAGE_LOG; CONTEXT_MANIFEST | Istorija do 2026-10-02 | Relevantni merge/UX/elimination odeljci i reference; veliki ispisi skraćeni, kasniji relevantni delovi posebno čitani |
| 002-post-merge-verification; 002-task-status-audit; feature 002 tasks | Istorija i reconciliation 2026-09-29/10-02 | Opšti UX opis nema reprodukciju; kasniji task status ima prednost nad starim audit snapshot-om |
| Novi 003 requirements/data-model/coach-http i policy | Nastali u ovom bloku | Dokumentacioni dokaz; novi testovi u matrici su planirani, ne postojeći runtime dokaz |

Izostavljeni: .env/tajne, spoljni web/poker izvori, suggestion.md, nastavni PDF-ovi,
celi Week03/Week04 feature planovi i nepovezani engine/UI kod. Razlog: pripremni
scope ne menja igru/provider verzije; lokalni ugovori/evidence dovoljni. Rizik:
nema nove browser/live potvrde, niti nezavisne reprodukcije neprecizne UX prijave.
Baseline komande/rezultati biće u `docs/evidence/003-baseline.md`;
fajl nastaje tek u T006. Trošak/tokeni coding sesije
nisu dostupni; nema live agent run-ova. Handoff svakog taska je u njegovom dokumentu.

## Merge recovery u ai-integ — 2026-09-29

Prioritet ima aktuelno korisničko odobrenje sa izborom ponašanja iz obe grane,
zatim AGENTS.md i relevantni delovi 002 specifikacije, plana, tasks, data-model,
HTTP ugovora i quickstart-a. Pročitani su diff-ovi roditelja `c6f6bb3`/`757faed`,
konfliktni fajlovi, Gemini/config/coordinator/schema/usage kod, zajednički ugovori,
UI API/status, smoke/diagnosis skripte i relevantni testovi/runner konfiguracije.
Speckit-implement je pročitan kao procesni kontekst; zadatak je ograničen na merge
postojećih implementacija. Nisu ponavljani svi feature taskovi.

Evidence oba roditelja služi kao istorijski dokaz, a nove komande i ishodi su u
`docs/evidence/002-merge-recovery.md`. Nisu čitani ključevi iz `.env`, nije korišćena
mreža za Gemini i nije pretpostavljen live uspeh spojenog koda. Rizici integracije
decisionOrdinal i diagnostic ugovora provereni su offline regresijom i browserom.

## Week04 T001–T010 korekcija — 2026-09-28

Za T002 je pronađen originalni prompt u
`specs/002-week04-ai-integration/prompt.md`, uveden commitom `e5a842b` (`T002`). Njegov
sadržaj je neizmenjeno kopiran u obavezni `docs/BUILD_PROMPT_WEEK04_V1.md`; nije
rekonstruisan iz kasnije implementacije. Za nastavak T003–T010 učitani su AGENTS.md,
constitution v1.1.0, feature 002 spec/plan/tasks/research/data-model/quickstart/AI HTTP
ugovor, requirements checklist 26/26, aktuelni shared ugovori, AI config/tipovi/fake,
route/context kod, povezani testovi i postojeći 002 evidence. Nije korišćen live
provider, mreža ili stvarni environment ključ.

Prioritet je dependency redosled T001→T010, smisleni behavior RED pre svake nove GREEN
izmene, strict provider-neutral ugovori i privacy-safe immutable context. Postojeće
korisničke izmene u T009 testu/evidence-u čuvaju se i dovršavaju, ne prepisuju.

## Week04 status reconciliation — 2026-09-28

Za usklađivanje task statusa pregledani su `AGENTS.md`, constitution v1.1.0,
`GAME_SPEC.md` v1.1, feature 002 `spec.md`/`plan.md`/`tasks.md`/requirements checklist,
commit istorija do `c8f6864`, aktuelni backend AI/provider/session/rute, frontend AI
komponente, odgovarajući testovi i `docs/evidence/002-*` logovi. Zatim su provereni
README, `.env.example`, postojeći Gemini evidence i live smoke zapis. Zvanična
Google [Gemini models dokumentacija](https://ai.google.dev/gemini-api/docs/models)
ponovo je proverena 2026-09-28 radi potvrde stabilnih model ID-jeva; to ne potvrđuje
pristup konkretnog projekta, kvotu, naplatu ili uspešan runtime odgovor.

Prioritet: razlikovati implementirani kod od dokazano zatvorenih Spec Kit taskova;
sačuvati obavezni TDD standard, ne fabricirati nedostajuće RED rezultate i popraviti
zastarele tvrdnje o statusu. `speckit-converge` nije primenjen kao writer jer njegov
append-only izlaz ne odgovara korisničkom zahtevu da se postojeći statusi i zastareli
opisi usklade.

Nalaz: offline backend, Gemini adapter, UI i dashboard postoje. Otvoreni browser
analysis acceptance, nedostajuća task-specifična RED evidencija i nezavršena finalna
provera su sažeti u `docs/evidence/002-task-status-audit.md`. Nisu pokretani testovi,
nisu pozivani Gemini endpoint-i i nijedan API ključ nije čitan.

## Gemini recovery — 2026-09-28

Prioritet: aktuelni zahtev korisnika da preuzmemo dijagnostiku i popravku, AGENTS.md,
relevantni Week04 plan/tasks/HTTP ugovor i constitution 1.1.0. Pročitani su
speckit-implement, requirements checklist (26/26), Luna skripta/evidence, stari live
smoke evidence, SDK adapter/config/coordinator/types/usage, frontend parser/dashboard,
šeme i semantic validator, povezani adapter/usage/UI testovi. Pregledani su instalirani
SDK 2.24.0 error parser, endpoint izbor, README/types i zvanični model capability,
Interactions i troubleshooting dokumenti. Stvarni HTTP odgovori imaju prioritet
nad pretpostavkom da katalog modela garantuje dostupnost. `.env` je učitan samo u
procesima za probe; ključ nije izlazio u chat/evidence. Spec Kit prerequisite je
prema grani izabrao 001; eksplicitni bugfix odnosi se na 002. Extensions nema.
Nisu učitani svi istorijski tasks/spec dokumenti niti pokrenuti preostali feature
taskovi. Rizik: uspešan live bot/analysis nije potvrđen zbog provider grešaka.

## T035–T036 — član B, 2026-09-23

Pročitani su aktuelni zahtev; AGENTS.md; constitution1.0.0; GAME_SPEC1.0; kompletni
spec/plan/tasks/quickstart; postojeći EVIDENCE_003, AI_USAGE_LOG i CONTEXT_MANIFEST;
svi frontend/src fajlovi i svi relevantni E2E/UI testovi. `speckit-implement` je vodio
prerequisite/checklist/TDD; prerequisite je uspeo uz ExecutionPolicy Bypass, checklist
je 16/16, a extensions.yml ne postoji.

Prioritet: T035/T036, FR-017/SC-005, očuvanje GameView/DOM ugovora i stvarni 1280×720
nalaz. Korišćeni su lokalni Chromium, Testing Library, Playwright i postojeći test server.
Nisu korišćeni web, spoljni asseti/CDN, suggestion.md, nastavni PDF, Week04 izvori ili
backend domen. T037–T040 i docs/EVALS.md namerno nisu menjani.

Novi kontekst: accessibility E2E, proširen table UI test, četiri frontend T036 fajla,
RED/GREEN logovi i pre/posle screenshotovi. Privremeni čisti HEAD snapshot korišćen za
baseline screenshot uklonjen je; originalni node_modules je ostao prisutan. Playwright
server/browser procesi zatvoreni su kroz finally blokove.

## T031–T034 — član B, 2026-09-23

Učitani su aktuelni zahtev, AGENTS.md, tasks, HTTP ugovor, T031–T034 testovi,
frontend API/App, backend app/routes/session/view, test server/process helperi i postojeći
RED/GREEN evidence. Za finalizaciju su korišćeni samo izvori potrebni za privatnost,
preconditions i recovery. T035 accessibility/style izvori nisu učitani niti menjani.
Finalne komande i stvarni rezultati su u evidence/T031-T034-final-regression.txt.

## T022–T030 — član B, 2026-09-23

Učitani: AGENTS.md, GAME_SPEC, constitution, spec, plan, tasks, fixtures,
data-model, HTTP ugovor, research, quickstart, evidence/evals/AI log i relevantni
frontend/backend/test helperi. Prioritet: GAME_SPEC/constitution, zatim feature
artefakti i ugovor. Week04 i istorijski suggestion nisu korišćeni jer su van scope-a.
Completion je dodatno učitao aktuelne positions/session/results testove i T025–T030
evidence; T031+ izvori i implementacija nisu uključeni.

Finalni audit 2026-09-23: polazni commit 3cddfdb1f18e1b198596d0aeb1d7e269f96f2e3c.
Ponovo pregledani session.ts, engine/hand.ts, test helper server.ts,
positions.test.ts, session.test.ts, tasks i aktuelni evidence/AI log/evals.
Prioritet: T028/FR-018 veza između automatskog all-in settlement-a i javne istorije.
Stvarni novi nalaz pokriven je RED→GREEN testom. Komande i izlazi su sačuvani u
docs/evidence/T022-T030-final-regression.txt; T031 implementacija nije započeta.

## T020–T021 — član A, 2026-09-23

Učitani su aktuelni zahtev, AGENTS.md, constitution1.0.0, GAME_SPEC1.0, kompletni
spec/plan/tasks, data-model, HTTP ugovor, frontend delovi research/quickstart,
shared/contracts.ts, public-fixtures, backend rute/view i konfiguracija. Korišćen je
`speckit-implement`; checklist16/16, prerequisite uspešan uz process-scoped bypass,
bez extensions.yml. Prioritet su GameView/legalActions, amountTo/doplata, blokada,
runtime validacija i reset precondition. Suggestion, PDF, spoljni izvori, E2E i T022+
nisu korišćeni. Novi izvori su tri UI testa i T021 frontend fajlovi; stvarni logovi
su evidence/T020-red.txt i evidence/T021-green.txt.

Datum2026-09-21; polazni HEAD a63699d77237f12e231b2b10ec1016fd447b20e1.
Manifest opisuje kontekst ovog bloka, ne tvrdi istoriju svih ranijih poziva.

| Izvor | Prioritet / verzija | Upotreba | Rizik |
|---|---|---|---|
| Aktuelni zahtev korisnika | Najviši | Samo A zadaci i A deo zajedničkih priprema | Ne pripisivati rad kolegi |
| AGENTS.md | Operativne instrukcije iz HEAD | TDD, scope, dokazi | Komande u početku još ne postoje |
| .specify/memory/constitution.md | 1.0.0 | Obavezni principi | PASS plana nije PASS koda |
| docs/GAME_SPEC.md | 1.0; ranije pročitan u razgovoru, fokus ponovo pri testovima | AC04–AC10 i pravila | Ne reinterpretirati poker varijantu |
| specs/001-week03-retro-poker/spec.md | Iz HEAD, sadržaj iz razgovora | FR i acceptance sledljivost | Svi FR još nisu implementirani |
| plan.md, tasks.md | Iz HEAD, učitani u ovom bloku | Vlasnici i zavisnosti | T010 zavisi od kolege |
| data-model.md, contracts/http.md | Iz HEAD, učitani | Granice i runtime šeme | Tip ne zamenjuje runtime proveru |
| research.md, quickstart.md, fixtures.md | Iz HEAD, učitani | Alati, oracle, buduće komande | Budući scenario nije dokaz izvršenja |
| checklists/requirements.md | 16/16, učitan | Read-only gate | Ne menjati markere tokom implementacije |
| .agents/skills/speckit-implement/SKILL.md | Instalirana verzija | Workflow uz korisničko suženje na A | Ne izvršavati B zadatke |
| suggestion.md | Izostavljen | Zastareo | Fiksni ulozi i stari scope ne važe |
| Nastavni PDF i Week04 izvori | Nisu ponovo učitani | Projektni dokumenti prenose zahteve | Ne tvrditi novo čitanje PDF-a |

Aktuelni test i kod svakog ciklusa učitava/kreira agent neposredno pre izmene.
Tokom setup-a konsultovani su [Vitest konfiguracija](https://vitest.dev/config/),
[Zod API](https://zod.dev/api) i [Vite server options](https://vite.dev/config/server-options.html).
Podaci npm registra o verzijama, engines i peer zavisnostima provereni su pre instalacije.
Tačne instalirane verzije čuva package-lock.json; Node 24.20.0 i npm 11.19.0.
GAME_SPEC §4.1–4.4 ponovo je fokusirano pročitan pri proveri betting pravila.
Stvarni rezultati i ograničenja zabeleženi su u [EVIDENCE_003.md](EVIDENCE_003.md).

## T006–T007 — 2026-09-22

Polazna verzija za donje izvore: HEAD `ffc70ceae12962cf5cbd0487ab66044485e9ceaf`,
čist worktree. Sadržaj je učitan u ovom bloku pre implementacije.

| Izvor | Prioritet / upotreba | Rizik i granica |
|---|---|---|
| Aktuelni korisnički zahtev | Najviši; samo T006–T007, član A, test-first i stvarni logovi | Ranije beleške o B evaluatoru nisu aktuelno vlasništvo ovog bloka |
| AGENTS.md; constitution 1.0.0 | Operativna pravila, TDD i nezavisni oracle-i | Jedan agent; nema tvrdnje o ljudskom review-u |
| GAME_SPEC 1.0 | R7, §4.4, AC14/AC15, arhitektonske granice | Jednak rank ne dokazuje raspodelu potova |
| spec.md; plan.md; tasks.md | FR-009, čist evaluator, enumeracija pet karata, dozvoljene putanje i deps | T010+ van obima; ne ponavljati završene taskove |
| fixtures.md; tests/helpers/fixtures.ts | EV01–EV10 i postojeći ručno zadati rank nizovi | Očekivanja ne računati evaluatorom |
| data-model.md; contracts/http.md; backend/src/engine/types.ts | ASCII Card i domenski tip; bez promene HTTP ugovora | Runtime validacija i dalje potrebna |
| tests/helpers/assertions.ts, server.ts, public-fixtures.ts | Postojeći test interfejsi i granice harness-a | Nema odgovarajućeg rank helper-a; bez proširenja scope-a |
| research.md D3; quickstart.md | 21 kombinacija od sedam; lokalne npm.cmd komande | Budući scenariji nisu izvršeni testovi |
| .agents/skills/speckit-implement/SKILL.md; checklists/requirements.md | Skill uz suženje na T006–T007; read-only checklist 16/16 | Nema extension hook konfiguracije, nema promene markera |
| package.json, tsconfig.json, .gitignore, eslint.config.js | Provere, strict tipovi, ignorisani build izlazi | Bez promene konfiguracije i zavisnosti |
| EVIDENCE_003, AI_USAGE_LOG, CONTEXT_MANIFEST | Očuvanje ranijih dokaza uz novi blok | Istorijski rezultat ne prepisivati novim |
| suggestion.md, nastavni PDF, spoljni poker izvori | Nisu korišćeni; dovoljne su projektne specifikacije | Bez tvrdnje da su ponovo provereni |

Novi testovi i `backend/src/evaluator/rank.ts` nastali su tokom ovog ciklusa.
RED stub i svi stvarni izlazi čuvaju se u docs/evidence/T006-* i T007-*.

## T010–T013 — 2026-09-22

Polazna verzija: worktree čist; T006–T009 fokusirana regresija 117/117. Učitani su
aktuelni korisnički zahtev, AGENTS.md, constitution1.0.0, GAME_SPEC, kompletni feature
spec/plan/tasks/fixtures, relevantni data-model i HTTP ugovor, research/quickstart,
evaluator, betting, tipovi, helper-i i postojeći evidence dokumenti. Korišćen je
`speckit-implement` workflow; checklist 16/16 i prerequisite uspešan. Nema extensions.yml.

Najviši prioritet imali su AC11–AC13/AC16, FR-008/FR-010, eksplicitni oracle-i iz
fixtures.md, celobrojni žetoni i jednokratna isplata. `suggestion.md`, nastavni PDF,
spoljni poker izvori, UI/transport i T014+ nisu učitani niti korišćeni jer nisu potrebni
za ovaj ograničeni blok. Novi direktni artefakti su pots/hand testovi, invariants test,
`pots.ts`, settlement deo `hand.ts` i prošireni domenski tipovi/helper. Stvarni RED,
GREEN, regresioni i završni izlazi nalaze se u `docs/evidence/T010-*` do `T013-*` i
`T010-T013-*`; neuspešni međukoraci su zadržani, ne predstavljeni kao uspeh.

## T014–T015 — član B, 2026-09-22

Polazna verzija: HEAD `29c3d04a5f324c3508eb8e304d94478d81bb8e4a`, grana vedran,
čist worktree. Korisnikov novi zahtev ima prioritet nad starom podelom A/B:
B preuzima samo T014–T015. Git mutacije nisu odobrene.

| Stvarno korišćen izvor | Prioritet i razlog | Rizik / granica |
|---|---|---|
| Aktuelni zahtev; BUILD_PROMPT_T014_T015 | Najviši; obim, RED/GREEN, bez T016–T019 | Bez samovoljnog nastavka ostalih taskova |
| AGENTS.md; constitution1.0.0 | Ponovo učitani; SDD/TDD, granice domena, istiniti dokazi | Jedan agent, sačuvati postojeći settlement |
| GAME_SPEC1.0; feature spec | Učitani tokom pripreme u ovom razgovoru; GAME_SPEC ponovo fokusirano §1–9 | AC01/02/validni03, R1–R3; AC23 samo domen |
| plan; tasks; fixtures; data-model; contracts/http | Učitani; relevantni dokumenti ponovo pročitani za ovaj blok | Vlasništvo taska ne menja pravila ili javni ugovor |
| research D3; quickstart | Učitani; Fisher–Yates, odvojeni RNG, npm.cmd komande | Instalacija je potrebna u novom checkout-u |
| speckit-implement SKILL.md; checklists/requirements.md | Učitani; prerequisite/checklist/implement/provere, uz scope T014–T015 | Checklist16/16 nije dokaz završene igre; nema extensions.yml |
| speckit-converge SKILL.md | Pročitan radi procene završnog workflow-a | Pun feature converge nije pokrenut; korisnik ograničava izmene na dva taska |
Novi kontekst čine bot/history unit testovi, Fastify inject integration testovi i
test helper-i. RED/GREEN/final izlazi su u docs/evidence/T016-* do T019-*.

## T037–T040 — završni audit, 2026-09-23

Učitani su AGENTS.md, GAME_SPEC.md, constitution, kompletan feature skup, README,
EVALS, EVIDENCE_003, AI_USAGE_LOG, raniji evidence, git status/istorija, package
skripte, session/positions/actions/deal testovi i relevantni backend/frontend
konfiguracioni fajlovi. Korišćeni su lokalni Vitest, Playwright, TypeScript,
ESLint, Vite i loopback HTTP smoke; nisu korišćeni web, CDN, Week04 izvori ili
spoljni AI/API servisi.

Prioriteti su bili istinit E4 snapshot par, identičan E1–E4/H1 skup, puna regresija,
clean install, drugi izolovani worktree-i i gašenje procesa. Pre-fix/fix worktree-i
su uklonjeni nakon provere; `.verification/**` ostaje generisani i ignorisani
lokalni materijal. Poznati rizici su da istorijski snapshot-i nemaju lockfile,
H1 nije slepi ljudski holdout, a T040 nije pravio novi ručni screenshot.
| package.json; tsconfig/tsconfig.server; vitest.config; eslint.config; .gitignore | Pročitani; komande, strict tipovi i granice build-a | Bez konfiguracionih izmena ili novih zavisnosti |
| EVIDENCE_003; AI_USAGE_LOG; CONTEXT_MANIFEST | Pročitani tokom pripreme, dopunjeni novim blokom | Prethodni rezultati ostaju istorijski; ne izmišljati review |

Suggestion je u ranijem skeniranju prepoznat kao istorijski predlog i nije korišćen
za ovaj blok. Nastavni PDF, spoljni poker izvori i web dokumentacija nisu učitavani
za implementaciju; projektni oracle-i i ugovori su dovoljni. Nema novih produktnih odluka.
Novonastali izvori: deal.test.ts, cards.ts, positions.ts, tok u hand.ts i stvarni
RED/GREEN/final logovi. Kratak prefiks špila dopunjen je prema fixtures.md;
seed/RNG transakcija, bot strategija i transport ostaju za kasnije taskove.

## T016–T019 — član A, 2026-09-22/23

Učitani su aktuelni korisnički zahtev, AGENTS.md, constitution1.0.0, GAME_SPEC1.0,
kompletni spec/plan/tasks/research (posebno D3), data-model, HTTP ugovor, fixtures,
quickstart, shared ugovori, postojeći engine/evaluator, svi relevantni unit testovi i
test helper-i. `speckit-implement` je vodio prerequisite/checklist/TDD tok; checklist
je 16/16, extensions.yml ne postoji. `speckit-converge` je korišćen samo kao završna
provera zadanog T016–T019 opsega: nije pokrenut full-feature append jer T020–T040
namerno ostaju postojeći otvoreni taskovi i korisnik je zabranio frontend T020–T021.

Najviši prioritet: BOT1–BOT6, AC17/AC23, FR-018, D2/D3 transakcija i privatnost,
contracts/http create/get/action pravila. Suggestion, nastavni PDF, spoljni izvori,
frontend i Week04 materijali nisu korišćeni. Nisu dodate zavisnosti. Novi kontekst
čine bot/history unit testovi, Fastify inject integration testovi i backend moduli
app/routes/session/view. RED/GREEN/final izlazi su u docs/evidence/T016-* do T019-*.

## 2026-09-29 — nastavak Gemini Lite popravke

Prioritet: korisnikov odobren nastavak > AGENTS / aktivna 002 specifikacija.
Korišćeni izvori: speckit-implement skill (već započet tok); 002 spec/plan/tasks,
data-model i ai-http ugovor; config/types/schemas/Gemini adapter; live smoke runner;
adapter/HTTP/schema/slow-profile/terminal-view testovi; README i .env.example.
Lokalni .env učitan je samo u procesu za live poziv, bez ispisa ključa.
Prethodni nalazi i RED rezultati preuzeti iz sačuvanog konteksta nastavka;
novi GREEN i live bot rezultat direktno zabeleženi. Nisu korišćeni novi spoljni
izvori ni subagenti. Rizik: promenljivo vreme/dostupnost API-ja i ograničen live uzorak.
Dokaz: evidence/002-gemini-lite-success.md.

## 2026-09-29 — evidencija korisničke provere nakon merge-a

Prioritet: korisnikov zahtev za dokumentovanje i njegove eksplicitne potvrde >
priloženi izlazi za brojeve i rezultate > postojeći istorijski evidence.
Pročitani su AGENTS.md, završni odeljci EVIDENCE_003.md, AI_USAGE_LOG.md i ovog
manifesta, T043 evidence i uvodni odeljci 002-gemini-lite-success.md; Git status,
grana i HEAD provereni su samo čitanjem. HEAD pri radu: `07f9b1f`.
Izvori rezultata: korisničke poruke o ručnoj igri i samostalnom smoke testu, kao i
prilozi `75cf4265-6b7a-40e7-8ab6-1a730edbbad5/Pasted text.txt` i
`4b4c6b2d-5638-4032-b225-9868c8cb629a/Pasted text.txt`. Kopije izlaza čuvaju se u
docs/evidence/002-post-merge-first-run.txt i 002-post-merge-rerun.txt.
Izostavljeni su .env, implementacioni moduli i spoljni izvori: dokumentacioni scope
ne zahteva čitanje tajni, promenu koda ili dijagnostiku. Rizik: ljudska potvrda nema
screenshot/telemetriju, logovi nemaju SHA ni numeričke exit kodove; ograničenja su
izričito preneta u evidence/002-post-merge-verification.md.

## 2026-10-02 — Pad obračuna posle eliminacije

Prioritet: korisnički log/zahtev > AGENTS.md i constitution 1.1.0 > GAME_SPEC 1.1
(R6/R8/AC21) > feature 001 plan/tasks/model > postojeći kod i testovi. Baseline
HEAD 0dfafad, bez početnih lokalnih izmena. Pročitani: priloženi Pasted text.txt
(1c17a97b-a0a0-42c0-bc3c-6a7cb0c89eeb), AGENTS.md, speckit-implement/SKILL.md,
check-prerequisites.ps1, constitution, GAME_SPEC, feature 001 plan/tasks/checklist,
data-model/contracts/research/quickstart i relevantni FR-011/AC20/AC21 delovi spec-a;
engine pots/hand/cards, session/app, testovi pots/hand/hand-flow/session/ai-bots,
fixtures/fake-ai-provider, package.json, vitest.config.ts, ESLint i .gitignore.
Veliki spojeni ispisi nekih dokumenata bili su skraćeni; ne tvrdi se pun pregled
svih njihovih redova. Relevantne činjenice o eliminaciji proverene su u modelu,
kodu i reprodukciji. Postojeći kraj manifesta korišćen je radi formata evidencije.
.env i spoljna dokumentacija nisu čitani: uzrok se reprodukuje offline; tajne,
kvote i promena modela nisu potrebni. Rizik: nema browser/live testa niti nezavisnog
ljudskog review-a. Rezultati i ograničenja su u EVIDENCE_003, T041/T042.

## 2026-10-02 — Automatsko osvežavanje AI upotrebe

Prioritet: aktuelni korisnički zahtev > AGENTS/constitution 1.1.0 > GAME_SPEC 1.1
§12 i feature 002 US4/FR-020–FR-023 > postojeći kod. Baseline HEAD `6101a64`,
bez lokalnih izmena. Pročitani: AGENTS, speckit-implement skill, constitution
(principi I–V), package.json, Vitest/ESLint/.gitignore, App/api/UsageDashboard,
dashboard UI testovi i backend usage store; relevantni delovi GAME_SPEC, 002
spec/plan/tasks/checklist, model/research/quickstart i ai-http ugovor. Veliki
spojeni ispisi bili su skraćeni; ne tvrdi se pregled svakog reda dokumenata.
Krajevi postojećih evidence/manifest/AI log fajlova korišćeni su radi kontinuiteta.
Izostavljeni .env, spoljni izvori i live provider: lokalna UI reprodukcija ne
zahteva tajne ili mrežu. Rizik: polling ima interval 1 s plus HTTP latenciju;
nema browser/live provere. Dokaz: EVIDENCE_003, UR1/UR2.
