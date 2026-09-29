# Quickstart — planirana Week04 validacija

Ovo je vodič za buduću implementaciju, ne tvrdnja da AI funkcije ili dependency već
postoje. Automatske provere moraju raditi bez interneta i bez `GEMINI_API_KEY`.

## Preduslovi

- radni direktorijum `retro-poker/`, Node 24 i npm 11 prema postojećem manifestu;
- `npm.cmd ci` posle implementacionog taska koji doda i zaključa `@google/genai` 2.24.0;
- kopirati `.env.example` u lokalni `.env`; backend dev komanda ga automatski učitava;
- bez `.env` u Git-u; ključ se ne kopira u chat, log, screenshot ili evidence.

## Offline acceptance matrica

Fake provider mora skriptovati i dokazati:

1. legalan bot predlog za botCount 1–5 → tačno jedan engine commit;
2. payload inspection → nula tuđih/burn/future/seed/secret polja;
3. malformed i schema mismatch → jedan bounded corrective attempt, zatim local fallback;
4. schema-validna ilegalna akcija → bez pre-fallback mutacije/RNG/history promene;
5. timeout + late resolve → terminalni fallback, late callback nema commit;
6. 429 → jedan same-model retry sa bounded backoff;
7. 5xx → drugi konfigurisani Gemini model, pa success tačno jednom;
8. svi attempts fail → postojeća lokalna strategija bira legalan potez i UI ga označava;
9. missing key → provider call count nula, igra radi, analysis unavailable;
10. reset ili nova partija tokom pending → abort/stale, nova partija netaknuta;
11. dupli callback → jedan terminalni transition i najviše jedan mutation;
12. pending provider + paralelni GET → GET završi pre resolve-a;
13. analysis success/failure/manual retry → HandResult, stackovi i poker version nepromenjeni;
14. dashboard success/error/retry/model/local fallback → tačni logical/attempt agregati;
15. game reset čuva usage; usage reset briše samo usage; missing metadata je unknown.

## Planirane komande

```powershell
npm.cmd test -- tests/contract/ai-contracts.test.ts tests/contract/ai-routes.test.ts
npm.cmd test -- tests/unit/ai-context.test.ts tests/unit/ai-semantic.test.ts tests/unit/ai-retry.test.ts tests/unit/ai-usage.test.ts tests/unit/match-facts.test.ts
npm.cmd test -- tests/integration/ai-bots.test.ts tests/integration/ai-failures.test.ts tests/integration/ai-concurrency.test.ts tests/integration/ai-analysis.test.ts
npm.cmd test -- tests/integration/gemini-adapter.test.ts
npm.cmd test -- tests/ui/ai-status.test.tsx tests/ui/analysis.test.tsx tests/ui/dashboard.test.tsx
npm.cmd run test:e2e -- tests/e2e/ai-offline.spec.ts
npm.cmd test
npm.cmd run test:e2e
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Sačuvati stvarne RED/GREEN komande i rezultate tek tokom implementacije. Setup/import
greška nije smislen RED. Postojeći Week03 testovi ostaju regresioni gate.

## Ručni lokalni UI scenario bez ključa

1. Pokrenuti `npm.cmd run dev`, otvoriti `http://127.0.0.1:5173`.
2. Bez ključa uključiti AI botove i kreirati partiju.
3. Očekivati jasnu unavailable/local-fallback oznaku, funkcionalnu igru i nula mrežnih
   provider poziva; dashboard ne sadrži prompt, karte ili environment detalje.
4. Završena partija prikazuje analysis unavailable; game rezultat ostaje vidljiv.
5. Reset partije čuva dashboard; eksplicitni dashboard reset ne menja partiju.

## Opcioni live smoke — nije completion gate

Live smoke se radi samo ručno ako vlasnik lokalno postavi `GEMINI_API_KEY`. Pre toga
ponovo proveriti zvanične model stranice, capability, quota i billing za konkretan
projekat. Ne ispisivati vrednost environment promenljive.

- najviše jedan AI bot potez i jedna analysis interakcija;
- aplikacija ima zaključana najviše dva attempt-a; za strogo ograničenje na jedan
  provider poziv koristiti zaseban ručni adapter smoke, ne menjati produkcioni retry
  ugovor niti predstavljati nepostojeći `GEMINI_MAX_ATTEMPTS` env override;
- potvrditi structured parse, model ID, attempt count i usage samo ako je vraćen;
- ne snimati prompt/raw response/privatne karte;
- failure zbog dostupnosti, quota ili billing-a dokumentovati kao runtime ograničenje,
  ne menjati offline očekivanja i ne tvrditi da je besplatno.

Zvanične reference: [SDK](https://ai.google.dev/gemini-api/docs/libraries),
[models](https://ai.google.dev/gemini-api/docs/models),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output),
[rate limits](https://ai.google.dev/gemini-api/docs/rate-limits),
[API keys](https://ai.google.dev/gemini-api/docs/api-key).
