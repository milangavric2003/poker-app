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
