# Research — Week03 Retro Poker

Datum: 2026-09-21. Ovo su odluke za buduću implementaciju; zavisnosti nisu instalirane.

## Clarify pregled

Nisu pronađene kritične produktne nejasnoće koje zahtevaju novo korisničko pitanje.
Postavljeno/odgovoreno: 0/0. Specifikacija i checklist nisu menjani;
ponovni sadržajni pregled: 16/16 → 16/16, bez regresija.

| Oblast | Status | Obrazloženje |
|---|---|---|
| Funkcionalni scope i ponašanje | Clear | FR-001–FR-018, Week04 izričito odvojen |
| Domen i podaci | Clear | Entiteti i lifecycle definisani; detaljna struktura razrađena u data-model |
| Interakcija i UX | Clear | Ručni next-hand, potvrda reseta, čekanje i greške |
| Nefunkcionalni zahtevi | Clear | Jedna lokalna partija, offline, desktop; nema SLA ili skaliranja |
| Spoljne integracije | Clear | Nema live servisa u Week03 |
| Granični slučajevi | Clear | AC01–AC23 i dodatni Edge Cases |
| Ograničenja | Clear | Constitution i ARCH1–ARCH8 |
| Terminologija | Clear | Partija sadrži više ruku; amountTo je ukupan street ulog |
| Završetak | Clear | SC-001–SC-007 i GAME_SPEC DoD |
| Placeholder-i | Clear | Nema otvorenih produktnih odluka |

Metod implementacije, detalji ugovora i AC15/AC21 fixture tabele bili su odloženi
za plan; razrešeni su u pratećim dokumentima. Ovo nisu izmišljeni korisnički odgovori.

## D1 — Alati i organizacija

**Decision:** Jedan npm projekat, React + Vite za frontend, Node.js + Fastify za backend,
TypeScript strict, Zod 4 za deljene šeme. Vitest za unit/contract/integration i
React Testing Library sa jsdom za komponente; Playwright Chromium za E2E.
ESLint i typescript-eslint za lint, tsx za backend development, tsc za backend build.
Jedan package-lock; bez workspaces infrastrukture, rutera, Redux-a i CSS framework-a.

**Rationale:** Odvojeni procesi i direktorijumi daju jasnu podelu posla; zajednički
jezik i šeme smanjuju neslaganja. Fastify inject omogućava testiranje ruta bez porta.
React komponente pokrivaju sto, poteze i rezultat; Vite vodi lokalni development/build.

**Alternatives:** Vanilla DOM je manji, ali zahteva više ručne sinhronizacije kontrola.
Express je moguć, Fastify ima ugrađen injection za testove. Next.js/SSR i baza ne doprinose scope-u.

Lokalno provereno: Node v24.20.0 i npm 11.19.0. Plan cilja Node 24 i npm 11.
Tačne verzije svih paketa i peer kompatibilnost proveriti i zaključati u T002,
ne pretpostavljati da dokumentacija „latest” dokazuje instaliran paket.
React 19, Fastify 5 i Zod 4 su odabrane major linije; Vite/Vitest/Playwright
zaključati na kompatibilne stabilne verzije pri setup-u.

Primarni izvori: [React](https://react.dev/learn),
[Vite](https://vite.dev/guide/), [Fastify](https://fastify.dev/docs/latest/Guides/Getting-Started/),
[Fastify testiranje](https://fastify.dev/docs/latest/Guides/Testing/),
[Zod](https://zod.dev/), [Vitest](https://vitest.dev/guide/),
[Playwright](https://playwright.dev/docs/intro). Pregledani 2026-09-21.

## D2 — Komunikacija i konkurentnost

**Decision:** Četiri HTTP operacije iz [ugovora](contracts/http.md).
Frontend 127.0.0.1:5173, backend 127.0.0.1:3001. Vite proxy /api;
direktan browser origin dozvoljen samo za navedeni frontend. Mutacije se serijalizuju.
Jedna transakcija obrađuje ljudski potez i botove do sledećeg ljudskog poteza/rezultata.

**Rationale:** Nema potrebe za WebSocket-om ili polling servisom. Odgovor sadrži
uređene javne događaje; UI ih prikazuje redom uz završni potvrđeni snapshot.
RNG stanje je deo kopije transakcije; greška pre commit-a ne menja original.

**Alternatives:** Poseban zahtev za svaki bot potez uvodi nepotrebnu sinhronizaciju;
slanje celog internog stanja narušava pravila vidljivosti.

## D3 — Engine, evaluator i bot

**Decision:** Čiste tranzicije engine-a; evaluator enumeriše 21 kombinaciju pet
od sedam karata i poredi kategoriju/kickere. Bez poker biblioteke i solvera.
Mešanje koristi Fisher–Yates i ubrizgan izvor slučajnosti; bot ima zaseban izvor.
Produkcijski početni seed potiče iz lokalnog kriptografskog izvora; test koristi fixture.

Bot v1: pre-flop jaka ruka je par ili dve karte ranga najmanje J;
post-flop jaka ruka je najmanje jedan par iz dostupnih karata.
Za jaku ruku, ako je običan bet/raise legalan, sa verovatnoćom 1/4 bira minimum.
Inače check ako može; ako postoji dug, call za jaku ruku ili dug ≤ 20,
inače fold. All-in call nastaje samo kroz ograničenje stacka; bot ne mora koristiti
svaku legalnu akciju. Pri grešci legalan check, inače fold, uz dijagnostički signal.
Nema uvida u tuđe karte; jačina nije tvrdnja o optimalnoj poker strategiji.

**Rationale:** Mala, objašnjiva politika daje dovoljno različitih poteza i ponovljiv test.
**Alternatives:** Nasumičan izbor svih akcija daje previše all-in ruku; LLM/solver je van scope-a.

## D4 — Blindovi i oracle

**Decision:** Stabilna mesta i prethodne blind pozicije omogućavaju dead-button prelaz.
Za najmanje tri preživela: novi BB je sledeći preživeli posle starog BB;
SB pozicija je stari BB (mrtva ako je ispao), button je stara SB pozicija.
Mrtvo mesto ne plaća blind. Pozicije mogu ostati na praznom mestu samo radi
napredovanja; nema novih učesnika. Za dva preživela novi BB je sledeći preživeli
posle starog BB; drugi je button/SB. Početna ruka ima button na čoveku.
Tabela više uzastopnih prelaza i eliminacija je u [fixtures.md](fixtures.md).

Ovo je razrada GAME_SPEC §4.1 za zatvoren sto bez novih učesnika, uz
[TDA pravila 34–36](https://www.pokertda.com/view-poker-tda-rules/) kao referencu.
Nije promena nominalnih blindova ili mesta igrača. Varijacije fizičkog pomeranja
button-a kroz više praznih mesta bez promene redosleda aktivnih igrača nisu UI zahtev.

**Rationale:** Testovi moraju očekivati konkretne pozicije, ne samo „prati pravila”.
**Alternatives:** Pomeranje button-a samo do sledećeg živog mesta može preskočiti blind.

## D5 — Dokazi i redosled isporuke

**Decision:** Jedan coding agent, A vodi engine/backend/botove, B evaluator/frontend/demo.
Plan research izvršen lokalno jednim agentom, u skladu sa projektnom zabranom paralelnih agenata.
Dokazi nastaju tokom rada, ne retroaktivno. Baseline sačuvati na prvom korisnom integrisanom
demo-u i svaki kasniji stvarni nalaz povezati sa snapshot-om pre popravke.
Složenost pokera zahteva male RED/GREEN cikluse; 10–15 značajnih coding iteracija
grupiše više taskova, ne ograničava broj testova. Odstupanje se beleži.

