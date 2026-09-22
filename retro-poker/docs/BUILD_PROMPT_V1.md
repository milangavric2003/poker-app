# BUILD_PROMPT_V1 — član A

Sačuvano 2026-09-21 pre aplikacionog koda. Polazni Git HEAD:
a63699d77237f12e231b2b10ec1016fd447b20e1.

## Korisnički zahtev (doslovno)

> Odlicno. Sada odradi T001, setup i male RED - Green cikluse. Zapamti da radis ovo iz mog ugla, dakle ne radis stvari koje treba da radi kolega, samo koje trebam da radim ja.

## Operativni prompt izveden iz zahteva

Radi kao coding agent za člana A u retro-poker/. Koristi AGENTS.md, constitution1.0.0,
GAME_SPEC1.0 i usvojene feature spec/plan/tasks/ugovore. Pre izmene najavi cilj i
proveru. Završi T001, T002 i A deo zajedničkih T003–T005, zatim T008–T009 koji
ne zavise od koleginog evaluator-a. Ne implementiraj B zadatke T006–T007 ili frontend.
T010 čeka T007 po usvojenom planu. Ne fabrikuj kolegin review ili korisnikov ručni rad.

Dozvoljene putanje: setup konfiguracija, README, minimalni development scaffolding,
shared/contracts.ts, backend/src/engine/types.ts i betting.ts, contract/betting testovi,
tests/helpers/, dokazi i statusi taskova. Bez naloga/baze/LLM/deploymenta, bez izmene
poker pravila radi prolaska testa. Frontend index je samo setup, bez React igre.

Za svaki behavior slice prvo napiši oracle i test, izvrši smislen RED uz minimalan
importabilni stub, sačuvaj log i snapshot, implementiraj GREEN, ponovi relevantne
provere. Ne tretiraj nedostajuću biblioteku kao RED. Nemoj oslablјivati assertion-e.

DoD ovog ograničenog koraka: ponovljiv npm setup, dokumentovane komande,
runtime ugovori i proverena betting logika, stvarni RED/GREEN logovi, typecheck/lint/build,
jasan handoff kolegi i nezavršeni taskovi ostavljeni prazni. E2E cele igre, screenshot
demo-a i baseline E4 ostaju budući rad; nemoj tvrditi da su ostvareni.

Kontekst biraj po tasku. Rezultate, odstupanja i nepoznate troškove zabeleži.
Primeri i očekivanja moraju biti nezavisni od implementacije. Pre široke mutacije
proveri Git stanje i sačuvaj korisničke izmene.

