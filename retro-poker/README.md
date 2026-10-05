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

Za dijagnostiku iz `retro-poker/` pokrenuti `npm.cmd run diagnose:gemini -- --live`.
Ovo je eksplicitni live opt-in: najviše tri generation zahteva po pokretanju,
bez retry-ja, uz prekid na prvom neuspehu. Bez `--live` (ili
`RUN_GEMINI_DIAGNOSTIC=1`) nema mrežnog poziva. Skripta koristi konfigurisani
Flash-Lite iz primary/fallback podešavanja, lokalni `.env` i bezbedne kodove grešaka.
Exit 1 znači neuspešnu probu, exit 2 neispravnu pripremu; exit 0 sa `Not run` znači
da live provera nije izvršena. Uspeh proverava sadržaj A/B odgovora i šemu/semantiku
bot predloga u C, ali ne dokazuje engine commit ili uspeh analize cele partije.

U AI upotreba → Attempts kolona **Razlog** prikazuje HTTP status i dozvoljeni
provider kod. `503 / UNAVAILABLE / high_demand` znači da je API prijavio
preopterećenje; igra koristi lokalni fallback. `invalid_request` (npr. povučen model
sa HTTP 404) odvojen je od autentikacije. Detalji važe za nove pokušaje nakon
restarta backend-a. Nijedan od ovih ishoda nije uspešan Gemini odgovor.
Aktuelni nalaz: [Gemini recovery evidence](docs/evidence/002-gemini-recovery.md).

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
- `GEMINI_BOT_TOTAL_MS`: 12000–35000, podrazumevano 12000;
- `GEMINI_BOT_TIMEOUT_MS`: 250–min(30000, total − 1000), podrazumevano 5000;
- `GEMINI_ANALYSIS_TIMEOUT_MS`: 250–29000, podrazumevano 12000;
- `GEMINI_BACKOFF_MIN_MS`: 0–2000, podrazumevano 250;
- `GEMINI_BACKOFF_MAX_MS`: do 5000, podrazumevano 750.

Podrazumevani ukupan budžet je 12 s za bot odluku i 30 s za analizu. Eksplicitni
sporiji profil dopušta do 35 s za bot odluku. SDK retry je isključen
(`attempts: 1`); coordinator radi najviše jedan dodatni pokušaj. 429/408/timeout/network
ponavljaju isti model, 5xx prelazi na dozvoljeni fallback model, malformed/schema/
semantic rezultat dobija jedan corrective pokušaj bez pauze, a auth/config/safety
greške su terminalne. Svaki neuspeli bot tok završava lokalnom strategijom.

Opcioni live smoke nije deo automatizovanih provera. Zahteva da korisnik lokalno
postavi ključ i izričito odobri najviše jedan bot i jedan analysis poziv; ne sme
ispisati ključ, kontekst ili sirovi odgovor.

Za Lite profil sa dužim čekanjem postaviti sledeće vrednosti u lokalni `.env`,
pa restartovati backend:

```dotenv
GEMINI_PRIMARY_MODEL=gemini-3.5-flash-lite
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
GEMINI_MAX_ATTEMPTS=1
GEMINI_BOT_TIMEOUT_MS=30000
GEMINI_BOT_TOTAL_MS=35000
GEMINI_ANALYSIS_TIMEOUT_MS=29000
```

Ovaj profil čeka do 30 s po botu i ne ponavlja generation zahtev. Ne garantuje
dostupnost provajdera. `npm run smoke:gemini -- --live` proverava stvarni bot
commit i read-only analizu (najviše dva poziva); `--bot-only` ograničava na jedan.
Bez `--live` nema poziva. Offline testovi koriste presretnut HTTP i ne dokazuju
dostupnost modela. Rezultati oporavka su u
[evidence dokumentu](docs/evidence/002-gemini-lite-success.md).

## Week05 coaching završene partije

Posle završetka **partije** (Pobeda/Poraz), u panelu „Coaching partije” izabrati
Ulaganje, Odluke po fazama ili Showdown i „Pokreni coaching”. Backend mora imati
validnu server-side AI konfiguraciju. Bez nje coaching je nedostupan; offline igra
i bot fallback i dalje rade. Panel prikazuje bezbedan status, validirani savet i
reference, ili razlog zaustavljanja. Novi pokušaj je eksplicitan; nova partija
otkazuje prethodni run. Week04 analiza ostaje poseban tok.

Frontend ostaje `http://127.0.0.1:5173/`, backend `http://127.0.0.1:3001/`.
Week05 endpoint-i: `POST /api/game/coach` za start i
`GET /api/game/coach/:runId` za status. Agent je read-only i ne menja igru.
Jedan run ima najviše 2 modelska koraka, 1 tool execution i 4 provider attempts,
rok 45 s i timeout do 15 s po attempt-u.

Proverene fokusirane offline komande:

```powershell
npm.cmd test -- tests/integration/coach-lifecycle.test.ts tests/contract/coach-routes.test.ts tests/integration/agent-run.test.ts tests/unit/coach-usage.test.ts
npm.cmd run test:e2e -- tests/e2e/coach.spec.ts tests/e2e/ai-offline.spec.ts
node --require ./tests/helpers/process-user-shim.cjs --import tsx tests/helpers/coach-evidence.ts
```

Poslednja komanda daje osam bezbednih fake tragova bez UI-ja ili stvarnog ključa.
Shim rešava poznati Windows tsx `os.userInfo` setup problem. Coach E2E koristi pravi
lokalni Fastify/Vite sa constructor-only fixture/fake providerom; redovni testovi
su offline, bez live Gemini potrošnje.

Week05 predaja traži ograničen live dokaz prema assignment §31, uz eksplicitan
lokalni opt-in nakon zelenih offline provera. Smernice: najviše 15 razvojnih run-ova
i 3 demo run-a. Postojeći Week04 smoke/diagnose nije Week05 coaching dokaz.

Poseban runner koristi sintetičku terminalnu partiju, postojeće HTTP/session/
orchestrator gate-ove i pravi Gemini adapter. Jedno pokretanje: najviše jedan run,
dva generation poziva, jedan alat, bez retry-ja/fallback-a, 15 s/attempt i 45 s/run.
Koristi kompajlirani entrypoint radi ponovljivog pokretanja i bez tsx IPC setup-a:

```powershell
npm.cmd run build
npm.cmd run smoke:coach
# Samo uz odobren live budžet i lokalnu server-side .env konfiguraciju:
npm.cmd run smoke:coach -- --live
```

Bez `--live`: exit 0 i nula provider/tool poziva. Bez validne konfiguracije: exit 2
i nula poziva. Uspeh traži completed, 2 steps/2 attempts/1 tool, validan final i
nepromenjen javni poker pogled/tool snapshot. Neuspeh: exit 1, safe status/stopReason.
Izlaz sadrži samo brojače, trajanje, validacije i usage; nema model teksta, karata
ili sirovih promptova/odgovora.

T030, 2026-10-05: jedan odobren live run sa Gemini 3.5 Flash Lite imao je 2 koraka,
2 provider poziva i 1 tool execution, pa je završio `stopped/insufficient_evidence`.
Read-only provera je prošla, retry/fallback 0, ukupno 464 tokena; cena unknown.
Validirani live savet nije dobijen. Nema ponavljanja u ovoj sesiji; uspešan live
final ostaje T031. [Stvarni izlaz](docs/evidence/003-T030-live.txt).

Storage je samo memorijski: restart gubi partiju, facts, run i usage; nova partija
uklanja coach slot. MatchFacts zadržava do 200 detaljnih odluka, starije agregira.
Coaching koristi raspoloživi uzorak, ne arhivu više partija.
Rezultati i ograničenja: [EVIDENCE_W05](docs/EVIDENCE_W05.md).
T027 walkthrough i pojedinačni Week05 doprinos oba člana korisnik je ostavio za
kasnije; nisu potvrđeni. [T030 handoff](docs/evidence/003-T030-handoff.md).
