# Provera

Iz retro-poker sa instaliranim zavisnostima: `npm.cmd test`,
`npm.cmd run test:e2e`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`.
Playwright startuje svoje offline/fake servere; ne koristi .env Gemini ključ.
`tests/e2e/table-polish.spec.ts` pokriva desktop/mobile sa 1/5 botova i snima slike
u evidence/. Pokretanje sa POKER_VISUAL_BASELINE=1 služi isključivo reprodukciji
baseline snapshot-a pre redizajna; aktuelni testovi snimaju after slike.
Očekivanje: nema scroll-a ili preklapanja, čitljive karte/iznosi, vidljiv fokus;
ai-offline/coach E2E dokazuju postojeće summary i usage tokove.
