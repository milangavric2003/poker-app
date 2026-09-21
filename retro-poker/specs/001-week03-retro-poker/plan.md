# Implementation Plan: Week03 lokalna Retro Poker igra

**Branch**: postojeća Git grana `vedran` (nije menjana) | **Date**: 2026-09-21 |
**Spec**: [spec.md](spec.md)

**Input**: `specs/001-week03-retro-poker/spec.md`.
Spec Kit skripte prijavljuju feature oznaku `001-week03-retro-poker`; stvarna Git grana
proverena je komandom git branch --show-current. To nisu ista polja.

## Summary

Lokalna kontinuirana No-Limit igra za čoveka i1–5 botova. Backend čuva autoritativno
stanje u memoriji; frontend prikazuje javni snapshot i šalje samo ljudsku akciju.
Čist engine, poseban evaluator i deljeni ugovori omogućavaju podelu rada i TDD.
Scope i svi zahtevi iz spec/GAME_SPEC ostaju obavezni; plan ne uvodi Week04 funkcije.

Clarify je završen bez novih pitanja (0/0); nema kritičnih produktnih nejasnoća.
Pokriće kategorija i odluke sa alternativama nalaze se u [research.md](research.md).
Checklist specifikacije ponovo pregledan:16/16 →16/16, bez promene markera.

## Technical Context

**Language/Version**: TypeScript strict, ESM; Node24/npm11. Lokalno viđeni24.20.0/11.19.0.
TypeScript i patch verzije paketa zaključavaju se u setup tasku uz proveru peer dependencies.

**Primary Dependencies**: React19, Vite, Fastify5, Zod4; tsx za backend development.
Jedan npm package; bez workspaces, baze, ORM-a, WebSocket-a, rutera ili state-management framework-a.

**Storage**: Jedan Game objekat u procesu, trenutna i poslednja ruka; restart briše stanje.

**Testing**: Vitest, React Testing Library/jsdom, Fastify inject, Playwright Chromium.
Deterministički fixture-i i zasebni RNG izvori; ESLint/typescript-eslint, tsc.

**Target Platform**: Lokalni Windows development, desktop Chromium/Edge; E2E koristi
Playwright-ov zaključan Chromium. Viewport1280×720; fontovi i karte lokalno/CSS.

**Project Type**: Browser frontend i mali lokalni HTTP backend, jedan repozitorijum.

**Performance Goals**: Inženjerski cilj je da obrada poteza sa botovima traje <1s na
lokalnom demo računaru bez animacija; izmeriti i zapisati, ne tvrditi unapred.
Nema produkcionog SLA, concurrency benchmark-a ni distribuiranog skaliranja.

**Constraints**: Loopback5173/3001, offline posle instalacije, bez izlaganja skrivenih
karata, bez negativnih stackova ili dvostruke isplate, bez mutacije na grešku.

**Scale/Scope**: Jedna partija, do6 učesnika, virtualnih2000–6000 žetona; jedan coding
agent i dva čoveka.10–15 značajnih iteracija su operativni okvir, ne broj testova/taskova.

## Constitution Check

Pregled pre research-a: sve granice usklađene; nema izuzetka.
Pregled posle dizajna: sve stavke prolaze na nivou plana, ne kao dokaz implementacije.

| Princip | Pre / posle | Dokaz u dizajnu |
|---|---|---|
| I SDD | PASS / PASS | Spec FR/AC → fixtures i tasks; bez aplikacionog koda |
| II TDD | PASS / PASS | RED task prethodi GREEN; evidence po ciklusu |
| III Domen | PASS / PASS | Ručni oracle, AC15/21 tabele, invarijante posle prelaza |
| IV Autoritet | PASS / PASS | Engine i serializer na serveru, javni i bot pogled odvojeni |
| V Validacija | PASS / PASS | Strict Zod, domen, serijski commit, revizija i rollback |
| VI Scope | PASS / PASS | Memory-only, loopback, nema AI/DB/deploymenta |
| VII Dokazi | PASS / PASS | Baseline checkpoint, isti eval, holdout, iskreni statusi |

## Project Structure

### Documentation (this feature)

```text
specs/001-week03-retro-poker/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  fixtures.md
  contracts/http.md
  quickstart.md
  tasks.md
```

### Source Code (project root retro-poker; planirane putanje)

```text
package.json, package-lock.json
tsconfig.json, tsconfig.server.json
vite.config.ts, vitest.config.ts, playwright.config.ts, eslint.config.js
frontend/
  index.html
  src/main.tsx, App.tsx, api.ts, styles.css
  src/components/Table.tsx, ActionPanel.tsx, HandResult.tsx
backend/src/
  server.ts, app.ts, routes.ts, session.ts, view.ts
  engine/types.ts, cards.ts, positions.ts, betting.ts, hand.ts, pots.ts, history.ts
  evaluator/rank.ts
  bots/strategy.ts
shared/contracts.ts
tests/
  helpers/fixtures.ts, assertions.ts, server.ts
  unit/, contract/, integration/, ui/, e2e/
docs/
  BUILD_PROMPT_V1.md, CONTEXT_MANIFEST.md, EVALS.md, EVIDENCE_003.md, AI_USAGE_LOG.md
  evidence/
dist/  (generisano, ignorisano)
```

**Structure Decision**: Jedan package/lockfile, ali jasne import granice.
frontend sme uvoziti shared, nikad backend. Engine ne uvozi HTTP/UI/Zod šeme
transporta; koristi domenske tipove. Evaluator ne zna za session ili botove.
Bot prima BotObservation; view serializer je jedino mesto javne projekcije.
Backend build uključuje shared i zadržava ispravne ESM import putanje.

## Phase 0 — Istraživanje i odluke

Završeno u [research.md](research.md): stack i alternative, request/bot loop,
evaluacija, heuristika botova, blindovi i dokazi. Preostale patch verzije bira se
i zaključava tokom setup-a; to nije otvoreno produktno pitanje.
Zbog projektne zabrane paralelnih agenata research nije delegiran agentima.

## Phase 1 — Dizajn

- [data-model.md](data-model.md): polja, ograničenja, tranzicije i knjigovodstvo žetona.
- [contracts/http.md](contracts/http.md): četiri rute, strict ulazi, potpun GameView,
  legalActions, događaji, rezultat, greške, reset preconditions i konkurentnost.
- [fixtures.md](fixtures.md): AC15 karte/kickeri, AC21 pozicije/eliminacije i više ruku;
  AC11/12/13 obračun i AC23 kontrolisani špil sa numeričkim rezultatom.
- [quickstart.md](quickstart.md): buduće komande i scenariji za ponovljivu proveru.

Prihvaćen zahtev radi nad kandidat stanjem, uključujući RNG i istoriju; javni snapshot
se validira pre commit-a. Backend izvršava botove dok čovek ne dođe na red ili ruka
ne završi. UI prikazuje uređene događaje iz odgovora; ne rekonstruiše poker pravila
niti između događaja omogućava nove kontrole. Greška/izgubljen odgovor vodi GET oporavku.

## Strategija TDD i integracije

Svaki behavior slice: oracle i test → izvršen smislen RED → najmanji GREEN →
relevantna regresija → refactor ako je potreban. Setup može stvoriti minimalne potpise
da test padne na ponašanju; ne prikazivati import grešku kao RED.
Sačuvati komandu, izlaz i razlog u docs/evidence/Txxx-red/green.txt.

Prvi integrisani US1 demo može biti ograničen kontrolisanim scenarijima tokom razvoja.
Puna podrška proizvoljnoj legalnoj ruci i prihvatanje US1 zavise od US2 all-in/side-pot
rada; ne označavati kompletan Week03 kao MVP posle prve prolazne ruke.
US3/US4 završavaju lifecycle, oporavak i UI. Svi FR/AC su obavezni pre predaje.

Baseline checkpoint nastaje na prvom korisnom integrisanom stanju pre ciljane promene.
Snapshot + početni prompt + manifest + komande + screenshot ostaju sačuvani.
Ako stvarni nalaz dođe ranije, prvo sačuvati odgovarajući snapshot.
Ne odlagati beleženje dok se sve greške ne poprave; ne izmišljati E4.
Holdout bira reviewer iz drugih konkretnih slučajeva i ne koristi ga za doradu.

## Podela posla

| Član | Vodi | Review i integracija |
|---|---|---|
| A (ti) | Engine, session, botovi, rute, serializer | B proverava oracle i demo ponašanje |
| B (kolega) | Evaluator, frontend, UI/E2E i demo evidence | A proverava ugovore i integraciju |
| Zajedno | Shared ugovori, baseline/eval, završni dokaz | Zamena driver/reviewer uloga u većem bloku |

Ne rade dva agenta istovremeno. Moguća nezavisnost ljudskih modula ne znači paralelni
agent run. Shared/contracts.ts i package-lock imaju jednog aktivnog urednika.
Task navodi dozvoljene putanje i zavisnosti; drugi član ne menja tuđi modul bez handoff-a.

## Complexity Tracking

Nema izuzetaka od constitution. Odvojeni backend je izričit zahtev za podelu posla;
jedan package smanjuje setup. Nema dodatnih servisa ili apstrakcija bez aktivnog zahteva.
