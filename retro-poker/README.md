# Retro Poker

Lokalni Week03 projekat. Implementirani su setup, ugovori i betting modul člana A.
Frontend igra i evaluator pripadaju kolegi i još nisu implementirani.

Ovo još nije igriva aplikacija niti završen A deo Week03. Prolazi 121 unit/contract
test; typecheck, lint i build su provereni. Sledeći A zadatak T010 (potovi)
zavisi od B evaluatora T006–T007. Status i ograničenja: [dokazi](docs/EVIDENCE_003.md).

## Pokretanje

Node24/npm11. Iz retro-poker/:
```powershell
npm.cmd ci
npm.cmd run dev
```

Frontend http://127.0.0.1:5173 trenutno prikazuje samo setup poruku.
Backend127.0.0.1:3001 je transport skeleton bez game ruta. Ctrl+C gasi dev procese.
Portovi su fiksni, bind samo loopback. Ovo još nije demo poker igre.

## Provere

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Fokus: npm.cmd test -- tests/unit/betting.test.ts.
Build izlazi su dist/frontend i dist/server.
npm.cmd run start pokreće izgrađeni backend; npm.cmd run preview služi frontend na5173.
Za buduće E2E: npx.cmd playwright install chromium, pa npm.cmd run test:e2e.
E2E testovi cele igre i fixture harness biće dodati u odgovarajućim taskovima;
odsustvo testova nije PASS. Instalacija paketa/browser-a zahteva mrežu, lokalni rad ne.

Tačne verzije čuva package-lock.json; prvi setup koristi npm install, drugi checkout npm ci.
Dokazi i ograničenja: [EVIDENCE_003](docs/EVIDENCE_003.md).
Plan i vlasnici: [tasks](specs/001-week03-retro-poker/tasks.md).
