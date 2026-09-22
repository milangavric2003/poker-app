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
