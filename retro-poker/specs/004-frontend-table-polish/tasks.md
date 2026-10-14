# Tasks: Uglađen poker interfejs

Vlasnik svih taskova: Codex u ovoj sesiji; ljudski review tek sledi. Rad serijski.
Dozvoljene putanje: frontend/src/components, frontend/src/styles.css, frontend/src/App.tsx (markup), tests/ui,
tests/e2e, ovaj feature i minimalne dopune AGENTS/GAME_SPEC/manifest/AI log.

## Phase 1: Setup

- [x] T001 Zabeleži spec/plan/prompt, Git baseline i kontekst u ovom feature-u i docs/CONTEXT_MANIFEST.md.
- [x] T002 Pokreni baseline UI/AI regresiju i screenshotove u evidence/.

## Phase 2: US1

- [x] T003 [US1] Dodaj RED semantičke provere poleđine u tests/ui/table.test.tsx.
- [x] T004 [US1] Izdvoji PlayingCard.tsx i integriši javne karte/poleđine u Table.tsx; GREEN.

## Phase 3: US2

- [x] T005 [US2] Dodaj RED provere statusa, nule i bounded čipova u tests/ui/table.test.tsx.
- [x] T006 [US2] Dodaj ChipAmount.tsx i PlayerSeat.tsx, očuvaj tačne iznose/potove; GREEN.

## Phase 4: US3

- [x] T007 [US3] Oblikuj sto, karte, čipove i panele u frontend/src/styles.css.
- [x] T008 [US3] Proveri desktop/mobile, statuse, board i tastaturu u tests/e2e/table-polish.spec.ts; pregledaj screenshotove.

## Phase 5: Final verification

- [x] T009 Pokreni sve relevantne provere, sačuvaj rezultate u evidence/verification.md i osveži tasks.md.
- [x] T010 Proveri konvergenciju spec/plan/tasks/kod; zabeleži ograničenja i handoff u evidence/verification.md.

Zavisnosti: T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010.
Nema paralelnih agenata. MVP US1, zatim iznosi/statusi, zatim ceo responzivan raspored.
