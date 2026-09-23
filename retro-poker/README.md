# Retro Poker

Lokalna Week03 Retro Poker igra: jedan čovek protiv 1–5 programskih botova,
memorijsko stanje i loopback frontend/backend. Week04 LLM/API integracija nije deo
projekta. Status, dokazi i ograničenja: [EVIDENCE_003](docs/EVIDENCE_003.md).

## Pokretanje

Node 24 i npm 11. Iz `retro-poker/`:
```powershell
npm.cmd ci
npm.cmd run dev
```

Frontend: http://127.0.0.1:5173/
Backend: http://127.0.0.1:3001/

Za demo otvoriti frontend, izabrati 1 ili 5 botova, odigrati legalne poteze do
rezultata, zatim probati `next-hand` i reset. Dev serveri se gase sa Ctrl+C.
Portovi su fiksni i bind samo na loopback.

## Provere

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Fokusirane provere:
```powershell
npm.cmd test -- tests/integration/session.test.ts
npm.cmd run test:e2e -- tests/e2e/play-hand.spec.ts --grep "AC23" --workers=1
```

Build izlazi su `dist/frontend` i `dist/server`. `npm.cmd run start` pokreće
izgrađeni backend, a `npm.cmd run preview` služi izgrađeni frontend. Ako Chromium
nije instaliran, pokrenuti `npx.cmd playwright install chromium`.

Tačne verzije čuva `package-lock.json`; clean checkout koristi `npm.cmd ci`.
Plan i vlasnici: [tasks](specs/001-week03-retro-poker/tasks.md).
