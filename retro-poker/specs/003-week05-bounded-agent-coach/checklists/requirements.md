# Requirements checklist — Week05 bounded agent coach

Datum: 2026-10-04. Svrha: sadržinski review [specifikacije](../spec.md), pre koda.
Vlasnik pregleda: jedan coding agent po izričitom zahtevu korisnika; ljudski review
drugog člana nije potvrđen. `[x]` ovde znači samo zadovoljen kvalitet zahteva.
Implementacija nije završena, Week05 testovi nisu pokrenuti i runtime evidence ne postoji.
Predložene putanje testova u matrici nisu tvrdnja da ti fajlovi već postoje.

## Kvalitet zahteva

- [x] CHK001 Da li su cilj, terminalna partija i raspoloživi uzorak jasno definisani? [Potpunost, Spec §2–4, FR-001/025]
- [x] CHK002 Da li svaki FR ima scenario, acceptance oracle, planiran test i izvor? [Sledljivost, matrica ispod]
- [x] CHK003 Da li su granice modela, alata i podataka eksplicitne? [Jasnoća, Spec §5, FR-004–010/020]
- [x] CHK004 Da li su finalna forma i članstvo dokaza odvojeni kriterijumi? [Merljivost, Spec §7, FR-011/012]
- [x] CHK005 Da li su uspeh, odbijanje, kvar, retry i stale/cancellation opisani? [Pokrivenost, US1–US4]
- [x] CHK006 Da li su otvorene odluke plana odvojene od gotovog ponašanja? [Jasnoća, odluke ispod]
- [x] CHK007 Da li su read-only i privatnost usklađeni sa GAME_SPEC §13–14 i constitution IV–VII? [Konzistentnost, FR-020–024]

## Matrica FR → scenario / acceptance → planirani dokaz → nastavni izvor

`USn.m` označava numerisani acceptance scenario u Spec §4. `A §n` je
[assignment](../../../../weekly-assignment.md); `R §n` je
[reliability addendum](../../../../week-05-bounded-agentic-workflows-reliable-integration-addendum.md).
Svi testovi/evidence u ovoj tabeli imaju status **planirano, nije pokrenuto/ne postoji**.

| FR | Scenario / acceptance | Planirani test ili dokaz (task) | Izvor |
|---|---|---|---|
| FR-001 | US1.1/5/6; terminal-only, nula poziva za loš preflight | coach-routes.test.ts (T018), agent-run.test.ts (T016) | A §5/6; R §8.1 |
| FR-002 | US1.1; US3.6; identitet i jedno terminalno stanje | agent-orchestrator.test.ts (T014), coach-contract.test.ts (T007) | A §27; R §4 |
| FR-003 | US1.2/3; 2 koraka, 1 alat, isti snapshot | agent-run.test.ts (T016) | A §3/14/23; R §2/18 |
| FR-004 | US2.1; unknown tool, 0 izvršenja | agent-run.test.ts (T016) | A §8/11; R §6/7 |
| FR-005 | US1.2; US3.4; strict discriminant, odbijen rani final | agent-schemas.test.ts (T007), agent-run.test.ts (T016) | A §12/32; R §8.2 |
| FR-006 | US2.2; unknown fields, enum, 0/1/10/11 i decimalni limit | agent-schemas.test.ts (T007), agent-tool.test.ts (T009) | A §10/12; R §7.1 |
| FR-007 | US2.3; zabrana tuđeg game scope-a | agent-tool.test.ts (T009), coach-routes.test.ts (T018) | A §8/12; R §8.2/12 |
| FR-008 | US1.2; US3.3; bez mutacije, mreže i prekoračenja roka | agent-tool.test.ts (T009), review importa (T025) | A §9/10; R §7 |
| FR-009 | US1.3; US3.4; corrupted/oversize/foreign refs odbijeni pre koraka 2 | agent-tool.test.ts (T011) | A §13; R §8.3 |
| FR-010 | US2.5; facts instrukcije su podaci, bounded context | captured provider request (T012/017), review (T025) | A §21; R §12 |
| FR-011 | US1.3; US3.4; strict bounded final | agent-schemas.test.ts (T007), validation tests (T015) | A §19; R §9 |
| FR-012 | US1.4/5; izmišljeni ref/fact/finding nije uspeh | final membership tests (T015) | A §20; R §8.4 |
| FR-013 | US3.1; nula poziva posle potrošenog limita | agent-orchestrator.test.ts (T014), agent-run.test.ts (T017) | A §15/16/24/25; R §10 |
| FR-014 | US3.3; preostali rok, abort i kasni odgovor | fake clock/transport tests (T013/017) | A §16/24; R §10/11 |
| FR-015 | US3.2; isti canonical key ne izvršava alat ponovo | agent-run.test.ts (T017) | A §17; R §10 |
| FR-016 | US3.1/4; enumerisani status i razlog za svaki izlaz | coach-contract.test.ts (T007), failure matrix (T016/017) | A §18/28/29; R §4/11 |
| FR-017 | US3.1/4; retry istog koraka, bez replay-a alata | agent-run.test.ts (T016/017), captured attempts | A §23/24; R §11 |
| FR-018 | US3.5/6; stale commit i dupli terminalni commit odbijeni | agent-run.test.ts (T017), coach-routes.test.ts (T018) | A §27/32; R §4/14 |
| FR-019 | US2.3/4; US3.6; strict POST/GET/no-store | coach-routes.test.ts (T018) | A §7/12; R §8.1 |
| FR-020 | US1.2/3; US2.5; pre/posle deep-equal state/facts/RNG/history | agent-run.test.ts (T016/017), review (T025) | A §8/10; R §7/12 |
| FR-021 | US4.1/2/3; samo bezbedan rezultat i retry | coach.test.tsx (T021), coach.spec.ts (T023) | A §29; R §3.1/12 |
| FR-022 | US4.4; odvojeni brojači, bez tajni | usage aggregation tests (T020), EVIDENCE_W05 (T026) | A §26/40; R §13 |
| FR-023 | US3.4; US4.4; offline fake scenario i ručni bounded live status | agent-run.test.ts (T016/017), završni dokaz (T024/026) | A §33/44; R §14/15 |
| FR-024 | US3.5; novi game ima prednost nad starim odgovorom | agent-run.test.ts (T017), UI races (T022) | A §16/32; R §14 |
| FR-025 | US1.5; US4.1; nema referenci na agregirane detalje | agent-tool.test.ts (T009), coach.test.tsx (T021) | A §20/21; R §8.4/12 |

## T002 handoff

T001 provereno sadržinski: postojeći diff AGENTS/GAME_SPEC dodaje lokalni read-only
Week05, čuva poker pravila, jedan agent i naizmenični handoff; §13–15 odgovaraju
assignment/addendum Core toku. Constitution VI ograničava Week03 i opisuje Week04;
ne zabranjuje odobreni read-only Week05 amandman. Nema konflikta tih granica.
Assignment §34 dozvoljava SpecKit artefakte umesto duplih dokumenata.
GAME_SPEC bira offline DoD uz opcioni live demo; assignment §31 navodi limited live
demo. To ostaje razlika nastavnog kriterijuma: offline dokaz ne dokazuje live demo.

Pregledani spec i svih 25 FR: matrica iznad je dokumentacioni dokaz T002.
Komande: Get-Content/rg za spec, plan, tasks, GAME_SPEC, constitution i relevantne
assignment/addendum odeljke; git status --short, git diff --stat, git diff --
AGENTS.md docs/GAME_SPEC.md. Prvi SpecKit prerequisite blokiran execution policy-jem;
ponovljen u posebnom PowerShell procesu sa -ExecutionPolicy Bypass i eksplicitnim
SPECIFY_FEATURE_DIRECTORY: exit 0, izabran feature 003, template učitan; extensions
ne postoji. Nema RED/GREEN, runtime testova ni potvrde doprinosa drugog člana.

Za T003: razrešiti HTTP ownership, retention, tačne veličine/string bounds, timeout
alata, značenje koraka/pokušaja i prioritet stop razloga; za T005 potvrditi vrednosti.

## T005 policy gate i handoff

- [x] CHK008 Da li spec/plan/GAME_SPEC navode iste 2/1/4, 15 s/45 s, 1–10 i 20 KiB limite? [Konzistentnost, Spec §6, plan policy, GAME_SPEC §13]
- [x] CHK009 Da li su brojači, retry/fallback, preostali rok i SDK retry semantike eksplicitni? [Merljivost, FR-013/014/017, plan policy]
- [x] CHK010 Da li su tool-output/final evidence granice i retention brojčano ograničeni? [Jasnoća, FR-009/011/012/022, data-model]
- [x] CHK011 Da li status, stopReason i failureCategory razlikuju nepotpun ishod, timeout, kvar, stale i cancellation? [Pokrivenost, FR-016/018/024, plan policy]
- [x] CHK012 Da li repeated action ima definisan prioritet nad potrošenim tool cap-om bez novog poziva? [Jasnoća, FR-015, US3.2, plan policy]

T004 provereno: originalni V1 tekst očuvan i dopunjen pre coach koda, manifest
navodi stvarno korišćene izvore i ograničenja čitanja; T002/T003 imaju sadržinski dokaz.
T005 potvrđuje početne brojke bez promene i usklađuje spec/plan/GAME_SPEC.
Data-model i HTTP ugovor dopunjeni samo za sampleLimited/failureCategory, da javni
DTO može ispuniti već opisane FR-016/025; to je neophodna T003 ugovorna korekcija.
Status tasks dokumenta osvežava se tek po proveri. Komande: Get-Content/rg za
budžete/stop ugovor, git diff --check i pregled git status/diff-a. Nema novih
biblioteka, aplikacionog koda, Week05 testova niti live poziva. Checklist kvalitet
zahteva je zadovoljen; runtime dokaz za svih 25 FR ostaje planiran/ne postoji.
Sledeće T006: aktuelni HEAD i stvarni offline Week04 baseline, ne stvarati bug.
