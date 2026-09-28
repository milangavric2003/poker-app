# Retro Poker

Lokalna Retro Poker igra: jedan čovek protiv 1–5 botova, memorijsko stanje i
loopback frontend/backend. Week04 AI režim može server-side koristiti Gemini, dok
offline deterministički bot ostaje podrazumevani fallback. Status, dokazi i
ograničenja: [EVIDENCE_003](docs/EVIDENCE_003.md).

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

## Gemini konfiguracija (opciono)

Kopirati `.env.example` u `.env` i lokalno upisati `GEMINI_API_KEY`. Fajl `.env` je
ignorisan u Git-u. Backend dev komanda automatski učitava taj fajl; frontend nema
pristup ključu. Za produkcioni start proslediti promenljive okruženja backend procesu.

Zvanični `@google/genai` 2.24.0 koristi se samo u backend procesu. Bez
`GEMINI_API_KEY` nema mrežnog poziva: AI bot koristi lokalni fallback, a analiza je
nedostupna. Ključ se ne šalje browseru, ne ulazi u javni snapshot, metrike ili greške.

Podržane promenljive:

- `GEMINI_ENABLED=false` eksplicitno isključuje Gemini (podrazumevano je uključen
  samo kada postoji ključ i validna konfiguracija);
- `GEMINI_PRIMARY_MODEL`: `gemini-3.8-flash` (default) ili `gemini-3.5-flash-lite`;
- `GEMINI_FALLBACK_MODEL`: drugi od ta dva modela; isti model isključuje model fallback;
- `GEMINI_MAX_ATTEMPTS`: 1–2, podrazumevano 2;
- `GEMINI_BOT_TIMEOUT_MS`: 250–11000, podrazumevano 5000;
- `GEMINI_ANALYSIS_TIMEOUT_MS`: 250–29000, podrazumevano 12000;
- `GEMINI_BACKOFF_MIN_MS`: 0–2000, podrazumevano 250;
- `GEMINI_BACKOFF_MAX_MS`: do 5000, podrazumevano 750.

Ukupan budžet ostaje 12 s za bot odluku i 30 s za analizu. SDK retry je isključen
(`attempts: 1`); coordinator radi najviše jedan dodatni pokušaj. 429/408/timeout/network
ponavljaju isti model, 5xx prelazi na dozvoljeni fallback model, malformed/schema/
semantic rezultat dobija jedan corrective pokušaj bez pauze, a auth/config/safety
greške su terminalne. Svaki neuspeli bot tok završava lokalnom strategijom.

Opcioni live smoke nije deo automatizovanih provera. Zahteva da korisnik lokalno
postavi ključ i izričito odobri najviše jedan bot i jedan analysis poziv; ne sme
ispisati ključ, kontekst ili sirovi odgovor.
