# Gemini live smoke evidence - 2026-09-28

## Granice i priprema

- Konfigurisani model: `gemini-3.8-flash` (`@google/genai` 2.24.0).
- Ukupno: **2 stvarna Gemini provider zahteva**; jedan bot, jedan analysis.
- Za oba smoke procesa runtime je forsirao `maxAttempts=1`, isti primarni i fallback
  model (efektivno bez model fallback-a); SDK retry je `attempts=1`.
- Nije pokrenuta nekontrolisana AI partija. Bot scenario je koristio jedan HU all-in
  potez koji zavrsava ruku posle jednog bot odgovora. Analysis scenario je zavrsenu
  partiju pripremio lokalno, deterministickim deck/RNG fixture-om i AI-off botovima.
- Smoke je pozivao stvarni backend Fastify app, rute, Gemini adapter, coordinator,
  semanticku/engine validaciju i usage store. Provider zahtevi nisu isli kroz mock.
- API kljuc je ucitan iz lokalnog, Git-ignored `.env`; vrednost nije ispisana.

## Ishodi

| Interakcija | Model | Provider zahtev | Aplikacioni ishod | Trajanje / usage |
|---|---|---:|---|---|
| Bot | `gemini-3.8-flash` | 1 | `local_fallback`, bot outcome attempt count 1; fallback potez je prosao kroz engine commit. Kategorija greske provajdera nije sacuvana u sanitizovanom runner izlazu. | Trajanje i usage metapodaci nepoznati. |
| Analiza | `gemini-3.8-flash` | 1 | `server_error`; analiza i UI state `failed`; nema validiranog rezultata. | Stari usage store zabeležio 0 ms zbog odbacivanja decimalne monotone latencije; stvarno trajanje nepoznato. `totalTokens` nedostaje; cena nepoznata. |

Druga partija je pre analize imala `status=won`, `phase=complete`; lokalna priprema nije
napravila provider poziv. Analysis ruta je prihvatila zahtev (`202`), a terminalni state
se zavrsio kao `failed`. Nijedan neuspesan zahtev nije ponovljen. Nijedna billing ili
Google project postavka nije menjana.

Bot smoke runner je zabelezio jedan usage attempt i zatim se ugasio pre nego sto je
otkrio detaljnu attempt klasifikaciju/latenciju/usage. Usage store i dashboard su
procesni i memorijski; zato bot red nije sacuvan u kasnijem analysis procesu. Za analysis
je sacuvana stvarna klasifikacija `server_error`, ali latencija je pogresno agregirana u
0 ms. Popravka normalizuje decimalne monotone milisekunde na zaokruzen ceo broj.
Ponovljeni live poziv nije izvrsen.

Usage dashboard offline provera: `tests/ui/dashboard.test.tsx` pokriva broj zahteva,
ishode, retry/fallback, latenciju, delimican/unknown token usage i unknown cenu;
`tests/ui/analysis.test.tsx` pokriva analysis failure prikaz i retry kontrolu. Testovi
proveravaju UI komponente, ne Playwright browser sesiju tokom live zahteva.

## Provere i privatnost

- `npm.cmd run typecheck` - exit 0.
- `npm.cmd test -- tests/integration/gemini-adapter.test.ts tests/integration/ai-bots.test.ts tests/integration/ai-analysis.test.ts tests/ui/analysis.test.tsx tests/ui/dashboard.test.tsx` - exit 0, 5 suite-ova, 28 testova.
- Latency regression RED: `npm.cmd test -- tests/unit/ai-usage.test.ts` - exit 1,
  fractional duration 125.7 ms was stored as 0 ms (1 failing, 1 passing).
- Latency regression GREEN plus relevant suites:
  `npm.cmd test -- tests/unit/ai-usage.test.ts tests/integration/gemini-adapter.test.ts tests/integration/ai-bots.test.ts tests/integration/ai-analysis.test.ts tests/ui/analysis.test.tsx tests/ui/dashboard.test.tsx`
  - exit 0, 6 suite-ova, 30 testova.
- Typecheck posle popravke - exit 0.
- Poziv kroz adapter potvrdio je JSON structured response konfiguraciju. Nijedan
  analysis rezultat nije prosao runtime validaciju jer je provider vratio 5xx.
- Kljucevi, promptovi, privatne karte i raw response nisu upisani u evidence ili log.
  Cost ostaje unknown; token metadata se ne dopunjava procenom.

## Zvanična dokumentacija

Provereno 2026-09-28: oba konfiguraciona model ID-ja su navedena kao stabilni modeli;
Google dokumentacija navodi structured outputs podrsku. Model pristup, aktivni rate
limits i tier zavise od konkretnog AI Studio projekta. Smoke nije proveravao nalog,
projekat, quota ekran ili billing tier, pa ne tvrdi besplatnu upotrebu ili dostupnost.

- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Billing](https://ai.google.dev/gemini-api/docs/billing)
