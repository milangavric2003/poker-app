# Gemini adapter evidence — 2026-09-27

Scope: samo zvanični Gemini adapter, server-side konfiguracija, DI wiring, testovi i
dokumentacija. Live Gemini poziv nije pokrenut; svi provider testovi koriste mock SDK.

Izbor: `@google/genai` 2.24.0, Node 24 kompatibilan, `GoogleGenAI({ apiKey })` i
`models.generateContent`. Koriste se `application/json`, ručni `responseJsonSchema`,
`AbortSignal`, `usageMetadata` normalizacija i `retryOptions.attempts=1`.

Zvanični izvori provereni 2026-09-27:

- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/structured-output
- https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html
- https://googleapis.github.io/js-genai/release_docs/interfaces/types.HttpRetryOptions.html
- https://googleapis.github.io/js-genai/release_docs/classes/types.GenerateContentResponse.html

Dozvoljeni stable modeli: `gemini-3.8-flash` i `gemini-3.5-flash-lite`. Preview,
Live, image, TTS i nepoznati model ID-jevi čine konfiguraciju unavailable bez ključa
u aktivnom runtime objektu i bez startup pada.

RED:

- `npm.cmd test -- tests/integration/gemini-adapter.test.ts` — exit 1, import adaptera
  nije postojao; test setup je uspešno učitan do nedostajućeg produkcionog modula.
- `npm.cmd test -- tests/unit/ai-config.test.ts` — exit 1, 5 očekivanih padova za
  allowlist/enable/budžete/public config.

GREEN:

- `npm.cmd test -- tests/integration/gemini-adapter.test.ts tests/unit/ai-config.test.ts tests/unit/ai-retry.test.ts`
  — exit 0, 21/21.
- `npm.cmd run typecheck` — exit 0.
- AI/offline matrica (`gemini-adapter`, `ai-config`, `ai-context`, `ai-retry`,
  `ai-semantic`, `match-facts`, `ai-analysis`, `ai-bots`, `ai-concurrency`,
  `ai-failures`) — exit 0, 10 suite-ova i 33/33 testa.
- Week03 regresija (`betting`, `bot`, `deal`, `evaluator`, `hand`, `history`,
  `invariants`, `positions`, `pots`, `actions`, `concurrency`, `hand-flow`,
  `session`) — exit 0, 13 suite-ova i 217/217 testova.
- `npm.cmd run lint` — exit 0.
- završni `npm.cmd run typecheck` — exit 0.
- `npm.cmd run build` — exit 0; Vite 116 modula i server TypeScript build.

Baseline pre izmene: typecheck exit 0. Puna `npm.cmd test` regresija imala je 23
postojeća pada u 9 suite-ova (stari Week03 fixture-i bez novog `ai` polja i očekivanje
bez default `aiMode`); 348/371 testova prolazi. Ti van-scope padovi nisu menjani.

Bezbednosne granice: adapter ne uvozi session/engine, ne dobija mutation callback,
ne loguje key/prompt/raw response i vraća inertan provider-neutral rezultat. Session
zadržava fingerprint/revision/actor compare-and-set i lokalni deterministički fallback.

Preostale runtime neizvesnosti bez live provere: dostupnost modela konkretnom Google
projektu, quota/billing, realna latencija, stvarna safety metadata i potpunost usage
metadata. Cena se ne procenjuje iz tokena.

Ovaj status važi za adapter evidence od 2026-09-27. Kasniji ručni smoke je zasebno
zabeležen u [002-live-smoke.md](002-live-smoke.md).
