# AI usage log

Ovaj log počinje sada; ne rekonstruiše izmišljenu istoriju prethodnih poziva.
Trošak i tokeni nisu dostupni u ovom interfejsu: nepoznato.

| Blok | Alat / svrha | Očekivanje | Korisnička odluka | Stvarni rezultat |
|---|---|---|---|---|
| A-01 | Codex; T001 i setup | Sačuvan početni prompt i ponovljiv setup | Korisnik odobrio samo svoj/A deo rada | Dokumenti sačuvani pre koda; instalacija, build i lokalni serveri provereni |
| A-02 | Codex; T003–T004 ugovori | Runtime i semantička validacija | Postojeći ugovor i scope A | Dva stvarna RED → GREEN ciklusa; 100 contract testova prolazi |
| A-03 | Codex; T005, T008–T009 | Ručni fixtures i betting pravila | B evaluator/frontend ostaju kolegi | Dva stvarna RED → GREEN ciklusa; 21 betting test prolazi; ukupno 121 |

Rezultati ažurirani 2026-09-22; logovi i ograničenja su u [EVIDENCE_003.md](EVIDENCE_003.md).
Ovo su tri značajna bloka sa četiri manja TDD ciklusa, ne broj svih tool poziva.

Kolegin doprinos i review nisu prijavljeni niti pretpostavljeni.
Model identifikator nije nezavisno potvrđen iz runtime telemetrije.
Značajne iteracije, rezultati i odluke dopunjavaju se posle izvršavanja; pojedinačni
pozivi shell-a nisu svaki zasebna coding iteracija. Nema privatnog chain-of-thought zapisa.

## A-04 — T006–T007, 2026-09-22

Alat: Codex, jedan coding agent; tačan model iz runtime telemetrije nije potvrđen.
Svrha/očekivanje: TDD evaluator za FR-009/AC14/AC15, nezavisni oracle-i i stvarni
RED/GREEN dokazi. Korisnička odluka: član A u ovom chatu radi isključivo T006–T007;
ranija rezervacija evaluatora za B ne važi za ovaj izričito odobreni blok.
Kontekst: pravila, constitution, feature dokumenti, types i postojeći helper-i;
detalji u [manifestu](CONTEXT_MANIFEST.md#t006t007--2026-09-22).
Rezultat: 96 RED padova → 96 GREEN; regresija 217/217; typecheck, lint i build exit 0.
Prvi lint pad ispravljen je isključivo formatiranjem testa, pa provere ponovljene.
Dokazi i sažetak značajnog prompta: [EVIDENCE_003](EVIDENCE_003.md#t006t007--evaluator-član-a-2026-09-22).
Jedan dodatni značajni coding blok, jedan TDD ciklus; ukupno četiri zabeležena bloka.
Potrošnja tokena i trošak: nepoznato. Kolegin doprinos/review i završni ljudski
pregled koda nisu prijavljeni. Nema paralelnih agenata ni implementacije T010+.

## A-05 — T010–T013, 2026-09-22

Alat: Codex, jedan coding agent; model i potrošnja nisu potvrđeni runtime telemetrijom.
Svrha: dva stvarna TDD ciklusa za FR-008/FR-010 i AC11–AC13/AC16. Korisnik je
izričito ograničio rad na T010–T013 i zahtevao proveru zavisnosti T006–T009.
Rezultat: baseline 117/117; T010 5 RED padova → T011 6 GREEN; T012 9 RED padova →
T013 11 GREEN; završno 234/234, typecheck/lint/build exit0. Sačuvani su i parser pad
prvog GREEN pokušaja i type narrowing pad prve završne provere. Test očekivanja nisu
oslabljena; T014+ nije implementiran. Detalji i ograničenja su u EVIDENCE_003.
