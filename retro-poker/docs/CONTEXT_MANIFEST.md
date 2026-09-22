# Context manifest — implementacioni blok člana A

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
