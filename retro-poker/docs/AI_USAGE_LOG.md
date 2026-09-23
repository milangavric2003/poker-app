# AI usage log

## B-02 — završetak T031–T034, 2026-09-23

Codex, jedan coding agent, bez paralelnih agenata. Nastavak je proverio postojeću
privacy/recovery implementaciju, reprodukovao nestabilan restart test i utvrdio da
Windows `os.userInfo()` vraća ENOMEM pri novom tsx procesu. Dodat je test-only preload,
a jedan contract fixture je sužen na validan PokerAction oblik. Produkciona pravila i
assertion-i nisu oslabljeni. Rezultat: 336/336, E2E 7/7, typecheck/lint/build exit0.
T031–T034 su završeni; T035 nije započet. Model, tokeni i cena: nepoznati.

## B-01 — T022–T030, 2026-09-23

Svrha: audit T022–T024 i implementacija kontinuirane partije. Korišćeni su
autoritativni projektni dokumenti, postojeći kod/testovi i lokalne Spec Kit veštine.
Ishod: T022–T024 potvrđeni; T025–T030 completion pokriva pozicije, kratke/all-in
blindove, terminalni session, rollback, AC23 nastavak i rezultat UI-ja. Regresija
320/320, E2E2/2, typecheck/lint/build exit0. Originalni validni RED dokazi
T025/T027/T029 nisu uhvaćeni i ne mogu se retroaktivno proizvesti; novi completion
RED nalazi za rollback i Pobeda/Poraz su stvarno zabeleženi. Ljudski review nije
tvrđen. Model i potrošnja: nepoznati.

Finalni nastavak posle prekida računara: sačuvana ispravka i test potvrđeni su
ponovljenom punom regresijom. Novi stvarni RED za izostalu all-in istoriju u T028
dao je 7 passed/1 failed; GREEN beleži blindove, board, refund i settlement.
Polazni commit je 3cddfdb1f18e1b198596d0aeb1d7e269f96f2e3c; dodatak ostaje u worktree-u.

## A-07 — T020–T021, 2026-09-23

Codex, jedan coding agent, bez paralelnih agenata. Stvarni RED→GREEN za osnovni
React UI i runtime-validiran HTTP klijent. Korisnik je dodelio članu A T020–T021 i
rezervisao T022+ kolegi. Rezultat: baseline284/284; RED tri suite-a zbog odsutnih
modula; GREEN UI7/7, regresija291/291 i typecheck/lint/build exit0. Lokalni smoke je
izvršio create i legalni potez, pa su procesi ugašeni. E2E, kontinuirana partija i
završno poliranje nisu rađeni. Model, tokeni, cena i ljudski review nisu potvrđeni.

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

## B-01 — T014–T015, 2026-09-22

Alat: Codex, jedan coding agent; bez paralelnih agenata. Svrha: početni špil,
pozicije i tok runde do postojećeg settlement-a. Korisnička odluka: član B
preuzima isključivo T014–T015 na grani vedran, bez commit/push/promene grane.
[Prompt i očekivanja](BUILD_PROMPT_T014_T015.md), [kontekst](CONTEXT_MANIFEST.md).

Rezultat: preduslovi134/134; stvarni RED33/33 padova → GREEN33/33;
puna regresija267/267 i typecheck/lint/build exit0. Testovi posle RED-a nisu menjani.
Nedostajuće zavisnosti instalirane pomoću npm ci uz odobrenje posle sandbox EACCES.
Neuspeh okruženja nije RED. Nema dodatnih biblioteka ili promene lockfile-a.
Korisnik određuje obim i preuzima Git rad; Codex izvršava kod/testove/evidenciju.
Nema potvrde ljudskog review-a ili A review-a. Tačan runtime model, tokeni i cena
nisu potvrđeni telemetrijom: nepoznato. Jedan značajan coding blok i jedan TDD ciklus.
Ograničenja i svi logovi su u EVIDENCE_003; T016+ nisu rađeni.

## A-06 — T016–T019, 2026-09-22/23

Alat: Codex, jedan coding agent, bez paralelnih agenata. Svrha: dva odvojena TDD
ciklusa za bot/istoriju i backend integraciju. Korisnik je izričito dodelio članu A
T016–T019 i zabranio frontend T020–T021 i širenje produkcionog scope-a.

Rezultat: baseline267/267; T016 smisleni import RED u 2 suite-a → T017 GREEN9/9;
T018 smisleni import RED u 2 suite-a → T019 GREEN8/8. Završno284/284,
typecheck/lint/build exit0. Prvi lint pokušaj imao je tri nekorišćena lokalna imena;
ispravljen je bez promene test očekivanja, a ceo završni skup ponovljen. `npm run dev`
nije pokrenut; Fastify inject nije otvorio port. Potrošnja/tokeni/cena i ljudski review
nisu dostupni ili potvrđeni. Detalji su u EVIDENCE_003 i docs/evidence/T016-*–T019-*.
