# Implementation Plan: Week04 AI integracija

**Branch**: `ai-integ` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-week04-ai-integration/spec.md`.
Spec Kit skripta prepoznaje feature direktorijum kao `002-week04-ai-integration`, dok je
stvarna Git grana proverena kao `ai-integ`; plan ne menja granu.

## Summary

Postojeća lokalna poker aplikacija dobija opcion AI režim za botove, strukturisanu
analizu završene partije i procesni usage dashboard. Backend ostaje jedini autoritet:
provider dobija sanitizovan snapshot, vraća nepoverljiv strukturisan predlog, a zasebna
lokalna schema i semantička/engine validacija prethode jedinom mogućem commit-u.
Provider pozivi teku van session mutation lock-a; kratke rezervacije i završni commit
su serijalizovani i vezani fingerprint-om za partiju, ruku, actor-a i reviziju.

Plan potvrđuje PROP-001–PROP-004: najviše dva provider pokušaja, podrazumevano 12 s za bot
ishod i 30 s za analysis ishod, sa konačnim per-attempt timeout-om, bounded backoff-om
i otkazivanjem. Bot posle terminalnog neuspeha koristi neizmenjenu Week03 lokalnu
strategiju; analysis ostaje read-only i dobija samo eksplicitni ručni retry.

Autoritativne verzije su [GAME_SPEC v1.1](../../docs/GAME_SPEC.md) i
[constitution v1.1.0](../../.specify/memory/constitution.md). Uvodni istorijski link
tekst u `spec.md` još navodi v1.0, ali scope/gate odeljci i CHK026 navode odobrene
verzije; to nije dozvola da se koristi stari scope. Formalna ponovna provera CHK026 je
prvi implementacioni gate u `tasks.md`.

## Technical Context

**Language/Version**: postojeći TypeScript 6.0.3 strict/ESM, Node.js `>=24 <25`, npm
`>=11 <12`.

**Primary Dependencies**: postojeći React 19.3.0, Vite 8.3.0, Fastify 5.12.5 i Zod
4.6.5; planirana jedina runtime zavisnost je zvanični Google GenAI SDK
`@google/genai` **2.24.0**, tačno zaključan u implementacionom setup tasku. Ne koristi
se legacy `@google/generativeai`, dodatni provider SDK, agent framework, function
calling biblioteka ni JSON-schema converter.

**Storage**: jedna partija, bounded match facts, AI interaction state i usage agregati
isključivo u memoriji backend procesa. Restart briše sve; reset partije briše game i
njene facts/interactions, ali ne usage agregate; poseban dashboard reset briše samo
agregate. Nema baze, fajl-save-a ni trajnog replay-a.

**Testing**: postojeći Vitest 5, Fastify inject, React Testing Library/jsdom i
Playwright. Automatske AI provere koriste provider-neutral fake, lažni sat, ubrizgan
jitter i AbortSignal; nijedan default test ne koristi mrežu ili ključ.

**Target Platform**: lokalni Windows development, Node backend na `127.0.0.1:3001`
i desktop browser preko `127.0.0.1:5173`; postojeći 1280×720 minimum ostaje.

**Project Type**: browser frontend + mali lokalni HTTP backend u jednom npm projektu.

**Performance Goals**: najviše 2 provider pokušaja po interakciji; bot dobija model
ili lokalni ishod za ≤12.000 ms u default profilu (do 35.000 ms uz eksplicitni sporiji
profil), analysis validan rezultat ili failure za ≤30.000 ms.
Pending provider ne sprečava nezavisan `GET /api/game` ili `GET /api/ai/usage`.

**Constraints**: ključ samo u backend `GEMINI_API_KEY`; nema live poziva u testovima;
model nije autoritet; nula skrivenih podataka u provider/public payload-u; nema duple
mutacije; nema automatskog retry-ja mutirajućeg HTTP zahteva; usage/cost je nepoznat
kada ga provider nije vratio.

**Scale/Scope**: jedna lokalna partija, 1–5 botova, jedan aktivni provider attempt po
partiji i najviše jedan aktivni analysis zahtev; bounded facts do 200 ljudskih odluka
po partiji, najviše 64 javna događaja po decision snapshot-u i najviše 6 preporuka u
analizi. Ovi cap-ovi sprečavaju neograničen memorijski/prompt rast, ne menjaju poker.

## Constitution Check

*GATE: proveren pre research-a i ponovo posle dizajna; oba pregleda prolaze na nivou
plana, ne predstavljaju dokaz implementacije.*

| Princip | Pre / posle | Dokaz u dizajnu |
|---|---|---|
| I Specifikacija pre implementacije | PASS / PASS | FR/AIAC/SC mapa, HTTP ugovor i TDD taskovi prethode kodu |
| II Obavezan TDD | PASS / PASS | Za svaki behavior slice postoji smislen RED pre GREEN; docs-only provere nemaju izmišljeni RED |
| III Domen i deterministički dokazi | PASS / PASS | Provider je van engine-a; fake/sat/jitter su kontrolisani; Week03 oracle i invarijante ostaju |
| IV Autoritet i granice podataka | PASS / PASS | Poseban context builder, allowlist projekcija i engine commit; model ne vidi/menja interno stanje |
| V Strukturisani ugovori i validacija | PASS / PASS | Zod strict output + zasebna identity/revision/legal-action validacija; fingerprint i single commit |
| VI Lokalni scope i granica faza | PASS / PASS | Samo Gemini family, memory-only, lokalni fallback, bez DB/auth/deploymenta |
| VII Ponovljivost i istinitost dokaza | PASS / PASS | Offline failure matrix je obavezna; live smoke je ručan/opcion i ne može zameniti testove |

Nema constitution izuzetaka. CHK026 mora biti formalno ponovo pregledan pre dodavanja
zavisnosti ili aplikacionog koda; pogrešan marker/zbir blokira zavisne taskove.

## Project Structure

### Documentation (this feature)

```text
specs/002-week04-ai-integration/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/ai-http.md
├── quickstart.md
└── tasks.md
```

### Source Code (planirane putanje u postojećoj strukturi)

```text
shared/contracts.ts
backend/src/
├── app.ts, routes.ts, server.ts, session.ts, view.ts
├── ai/
│   ├── config.ts, types.ts, schemas.ts, context.ts, semantic.ts
│   ├── coordinator.ts, retry-policy.ts, usage.ts, analysis.ts
│   └── providers/gemini.ts
├── bots/strategy.ts
└── engine/history.ts
frontend/src/
├── App.tsx, api.ts, styles.css
└── components/AiStatus.tsx, MatchAnalysis.tsx, UsageDashboard.tsx
tests/
├── helpers/fake-ai-provider.ts, fake-clock.ts
├── contract/ai-contracts.test.ts, ai-routes.test.ts
├── unit/ai-context.test.ts, ai-semantic.test.ts, ai-retry.test.ts,
│   ai-usage.test.ts, match-facts.test.ts
├── integration/ai-bots.test.ts, ai-failures.test.ts, ai-analysis.test.ts,
│   ai-concurrency.test.ts, gemini-adapter.test.ts
├── ui/ai-status.test.tsx, analysis.test.tsx, dashboard.test.tsx
└── e2e/ai-offline.spec.ts
```

**Structure Decision**: AI orchestration je backend modul, ne deo engine-a. `AiProvider`
je mala async granica koju implementiraju fake i Gemini adapter. `context.ts` pravi
allowlist payload; `schemas.ts` radi runtime oblik; `semantic.ts` proverava fingerprint
i legalnost preko postojećeg engine-a; `strategy.ts` ostaje lokalna strategija bez
provider import-a. `coordinator.ts` jedini bira attempt/retry/fallback i nikada sam ne
primenjuje poker potez. `session.ts` rezerviše i commit-uje pod svojim serijskim lock-om.

## Phase 0 — Research Decisions

Detaljna obrazloženja i alternative su u [research.md](research.md). Sažetak odluka:

1. **SDK**: `@google/genai` 2.24.0, zvanični GA JavaScript/TypeScript SDK; verzija je
   proverena 2026-09-26 i zaključava se tek u implementacionom tasku.
2. **Modeli**: server-side defaults `gemini-3.8-flash` (primary) i
   `gemini-3.5-flash-lite` (fallback). `GEMINI_PRIMARY_MODEL` i
   `GEMINI_FALLBACK_MODEL` smeju zameniti defaults samo eksplicitnim stable Gemini
   text model ID-jevima čija je structured-output podrška ponovo proverena. Prazan ili
   isti fallback znači „nema model fallback-a”. Preview, Live, image/TTS i drugi
   provider family nisu prihvatljivi za ovaj feature.
3. **Output**: običan `generateContent` sa `application/json` structured output-om i
   malom ručno definisanom JSON Schema podskup šemom. Function calling se ne koristi:
   nema alata koji model treba da izvrši, a modelski predlog mora ostati inertan.
4. **Validacija**: provider adapter normalizuje transport/SDK rezultat i grešku;
   strict Zod parser proverava oblik; semantic validator zasebno proverava identitet,
   fingerprint i legalnu akciju; engine je poslednji autoritet. Lokalna strategija je
   zaseban krajnji fallback.
5. **Retry**: aplikacija, ne skriveni SDK default, poseduje attempt budget. SDK retry se
   eksplicitno postavlja na nula. 429/408/network/timeout retry-uju isti model jednom;
   privremeni 5xx koriste drugi model kada je različit i konfigurisan, inače isti;
   malformed/schema/semantic odgovor dobija jedan isti-model corrective attempt bez
   backoff-a. Missing-key, 400/401/403/config i safety refusal su terminalni.

Zvanični izvori i datum provere nalaze se u research dokumentu. Model ID, capability,
quota, billing i cena su promenljivi; plan ne garantuje dostupnost, besplatnu upotrebu,
kapacitet ili trošak za konkretan Google projekat.

## Phase 1 — Design and Contracts

### Provider i orchestration granica

`AiProvider.generate(request, signal)` prima `purpose`, model ID, bounded JSON context
i response schema; vraća kandidat kao `unknown`, stvarni model/version kada je poznat,
bezbednu usage metadata i provider response ID samo u volatilnom attempt objektu.
Ne prima `GameState`, engine callback ni funkciju za mutaciju. Fake implementira isti
interfejs skriptovanim ishodima bez mreže.

Coordinator formira `AIInteraction`, bira najviše dva `AIAttempt`-a, meri monotono
trajanje i završava jednim terminalnim ishodom. Raw odgovor postoji samo kao lokalna
promenljiva do parse-a; ne ulazi u log, dashboard ili javni DTO.

### Timeout, backoff i rate limit

| Namena | Total deadline | Attempt timeout | Backoff pre attempt 2 | Rezerva |
|---|---:|---:|---:|---:|
| bot | 12.000 ms | min(5.000 ms, preostali budžet) | 250 ms + ubrizgan jitter 0–100 ms; `Retry-After` samo ako staje | najmanje 500 ms za lokalnu validaciju/fallback/commit |
| analysis | 30.000 ms | min(12.000 ms, preostali budžet) | 500 ms + jitter 0–250 ms; `Retry-After` samo ako staje | najmanje 1.000 ms za parse i terminalno stanje |

Deadline se proverava pre i posle backoff-a; attempt se ne započinje ako ne ostaje
rezerva. Timeout koristi `AbortController`; reset/nova partija abortuje povezane
attempt-e. Pošto abort klijenta ne garantuje prekid serverske obrade kod providera,
fingerprint i terminal-state check ostaju obavezni, a naplata/usage otkazanog poziva
ne može se pretpostaviti kao nula.

Nema lokalnog globalnog quota algoritma ni obećane RPM/TPM vrednosti. 429 se meri kao
`rate_limited` i ulazi u isti bounded budžet; nema beskonačnog reda ili sleep-a.

### Fingerprint, cancellation i idempotency

Bot fingerprint je `(interactionId, purpose=bot, gameId, handId, expectedVersion,
actorId, decisionOrdinal)`. Analysis fingerprint je `(interactionId,
purpose=analysis, gameId, terminalHandId, expectedVersion, factsRevision)`.

Tok je dvostepeni:

```text
kratak session lock: proveri eligibility → snapshot/fingerprint → registruj pending
van lock-a: provider attempt(s), GET rute ostaju dostupne
kratak session lock: proveri active interaction + isti fingerprint → parse/semantic
  → bot: clone + standardni engine apply + jedan version commit
  → analysis: postavi validated read-only rezultat, bez game-result mutacije
```

Po fingerprint-u može postojati samo jedna aktivna interakcija. Dupli callback,
terminalna/stale/cancelled interakcija ili promenjen game/hand/version/actor/factsRevision
ne može commit-ovati. Nova partija prvo označi stare interakcije cancelled i abortuje
signal, zatim zameni game. Provider poziv se nikad ne drži unutar globalnog queue lock-a.

### HTTP i deljeni ugovori

Detaljan ugovor je [contracts/ai-http.md](contracts/ai-http.md). Postojeće četiri rute
ostaju i dobijaju additive polja:

- `POST /api/game`: strict `GameConfig` dobija opciono `aiMode: boolean` sa default
  `false`, čime stari Week03 klijent zadržava lokalne botove.
- `GET /api/game` i mutacije vraćaju `GameView.ai`: mode/availability, bezbedan aktivni
  status, poslednji bot AI ishod i analysis state/result. Mutacija može vratiti stanje
  `waiting`; frontend tada radi samo read-only polling.
- `POST /api/game/analysis`: strict identity/revision zahtev; samo terminalna partija;
  vraća `202` sa `generating` stanjem ili stabilnu grešku. Ručni retry je nov zahtev i
  nov interaction ID.
- `GET /api/ai/usage`: javni in-memory `UsageDashboardView`.
- `POST /api/ai/usage/reset`: strict `{expectedRevision}`; atomarno briše samo metrike
  i vraća prazan snapshot sa većom revizijom.

Greške dodaju bezbedne kodove `AI_UNAVAILABLE`, `AI_ALREADY_PENDING` i
`ANALYSIS_NOT_ALLOWED`; provider tekst/status body i environment se nikad ne prosleđuju.

### UI i dashboard

Nova partija dobija checkbox „AI botovi (Gemini)”, podrazumevano isključen radi
Week03 kompatibilnosti. `AiStatus` je `aria-live` tekstualni status: off, waiting,
retrying, drugi Gemini model, lokalni fallback, completed, unavailable ili failed.
Dok je bot AI pending, potezi čoveka su onemogućeni; frontend periodično radi samo
`GET /api/game`, nikad ne ponavlja mutaciju.

Na terminalnoj partiji prikazuje se „Analiziraj partiju”. `MatchAnalysis` prikazuje
sažetak, dobre odluke, moguće greške i sledeće korake, uz stalnu oznaku da je sadržaj
obrazovna pomoć, ne optimalna strategija. Failed/unavailable ne prikazuje placeholder
analizu; retry je eksplicitan. Analiza zavisi od terminalne partije i validne backend
konfiguracije, ali ne od izbora AI bot režima: korisnik može analizirati i partiju
odigranu samo protiv lokalnih Week03 botova.

`UsageDashboard` je sklopiva lokalna sekcija ispod igre na istom 1280×720 page flow-u,
ne modal i ne nova ruta. Prikazuje summary po purpose-u, attempt tabelu po stvarnom
modelu/outcome-u, retry/model/local fallback brojeve, count/avg/max latenciju i usage
polja sa known/missing brojem. Cena je „nepoznato” osim ako je provider direktno vrati;
tokeni se ne pretvaraju u cenu. Reset zahteva potvrdu i menja samo usage revision.

### Bounded match facts

Week03 javna istorija ostaje za prikaz. Zaseban `MatchFacts` vodi najviše 200 ljudskih
odluka: pre-action javni snapshot, ljudske karte, legal actions, izabranu akciju i
posle završetka ruke provereni outcome/refund/net change. Svaki snapshot ima najviše
64 poslednja javna događaja. Kada bi cap bio prekoračen, najstarije odluke se sažimaju
u brojčane hand aggregate bez modelske interpretacije; poslednjih 200 detalja ostaje.
Reset/restart briše facts. Provider nikad ne dobija raw `GameState` ili deck.

## TDD, Evidence and Commands

Redosled implementacije je ugovor/RED → minimalni shared oblik → fake provider i
offline success/failure matrica → UI/analysis/dashboard → Gemini adapter. Svaki RED
mora pasti zbog nedostajućeg ponašanja, ne import/setup greške; zatim GREEN i relevantna
Week03 regresija. Ne menjati očekivanje radi modelske varijabilnosti.

Planirane fokusirane komande (nisu pokrenute u ovom dokumentacionom koraku):

```powershell
npm.cmd test -- tests/contract/ai-contracts.test.ts tests/contract/ai-routes.test.ts
npm.cmd test -- tests/unit/ai-context.test.ts tests/unit/ai-semantic.test.ts tests/unit/ai-retry.test.ts
npm.cmd test -- tests/integration/ai-bots.test.ts tests/integration/ai-failures.test.ts tests/integration/ai-concurrency.test.ts
npm.cmd test -- tests/integration/ai-analysis.test.ts tests/unit/ai-usage.test.ts
npm.cmd test -- tests/ui/ai-status.test.tsx tests/ui/analysis.test.tsx tests/ui/dashboard.test.tsx
npm.cmd run test:e2e -- tests/e2e/ai-offline.spec.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Opcioni live smoke nije deo completion-a automatskih taskova: lokalno postavljen ključ,
jedan bot potez i jedna analiza, bez čuvanja prompta/raw response-a. Pre njega ponovo
proveriti modele, capability, quota i billing. Nikada ne tražiti ili ispisati ključ.

## Traceability

| Feature zahtevi | Dizajn / budući test sloj |
|---|---|
| FR-001–FR-007; AIAC01–04; SC-001–003 | additive config, context allowlist, strict output, semantic/engine validator, fake bot integration |
| FR-008–FR-012, FR-019, FR-027; AIAC05–08/14/16; SC-003/004/010 | fingerprint, abort, two-stage lock, retry policy, late/duplicate tests, local strategy fallback |
| FR-013–FR-015; AIAC09 | backend env config, zero-call fake assertion, safe public state |
| FR-016–FR-018, FR-026; AIAC10/11; SC-005/006 | bounded MatchFacts, structured analysis, terminal-only endpoint, read-only assertions |
| FR-020–FR-023; AIAC12/13; SC-007 | process usage store, safe aggregates, independent reset, unknown metadata |
| FR-024–FR-025; AIAC15; SC-008 | provider interface/fake, offline matrix, optional live smoke only |
| SC-009 / CHK026 | T001 governance re-check against GAME_SPEC v1.1 and constitution v1.1.0 |

## Complexity Tracking

Nema constitution odstupanja. Provider adapter, coordinator i usage store su najmanje
granice potrebne za fake-first TDD, cancellation/idempotency i javnu privatnost.
Ne uvode se dodatni provider-i, baza, auth, multiplayer, deployment ili trajno čuvanje.

### Eksplicitni sporiji profil — 2026-09-29

Gornja tabela vremena opisuje default profil. GEMINI_BOT_TOTAL_MS dopušta
12.000–35.000 ms; GEMINI_BOT_TIMEOUT_MS do min(30.000, total − 1.000).
Lokalni Lite profil ima jedan pokušaj, 30.000 ms attempt i 35.000 ms total.
Analysis total ostaje 30.000 ms, sa lokalnim attempt 29.000 ms. Provider koristi
ravnu nullable transport šemu za bot, uz nepromenjenu strogu domensku validaciju.
