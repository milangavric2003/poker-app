# Gemini pozivi — dijagnostika (2026-09-28)

Naknadni nastavak je utvrdio bezbedan razlog 503 i popravio CLI exit kodove:
[Gemini recovery](002-gemini-recovery.md). Tekst ispod čuva istorijski Luna nalaz;
opis tadašnjeg runner-a i nepotvrđenog razloga nije poslednje stanje.

## Bezbednost i metod

- Stvarni radni direktorijum je `retro-poker/`; lokalni `.env` je pročitan bez ispisivanja sadržaja. Ključ nije upisan u izlaz, evidence ili argument komande.
- Opt-in runner je `scripts/gemini-diagnosis.ts`; izvršava se samo uz `RUN_GEMINI_DIAGNOSTIC=1`, van `npm test`/CI. Uobičajen primer: `node --env-file=.env --import tsx scripts/gemini-diagnosis.ts` (u ovom Windows okruženju `tsx` bootstrap je pao pre pokretanja; tokom ovog zadatka je zato runner kompajliran u `.verification/compiled` i pokrenut običnim Node-om).
- Maksimum je tri sekvencijalna zahteva, SDK retry `attempts: 1` (bez ponavljanja), 12 s timeout po zahtevu; nema model fallback-a ni pokretanja igre. Posle neuspeha prethodnog koraka sledeće probe se preskaču.
- Prva A iteracija vratila je status-less SDK grešku koja je prvobitno ostala `unknown` zbog nedovoljno širokog status/cause extractora; posle sanitizovane ekstrakcije isti A je dao `network_error` u sandboxu. Standardno eskalirani treći A dobio je HTTP 503. Sva tri su generation attempt-i i ulaze u broj.

## Efektivna konfiguracija i SDK

| Stavka | Vrednost / stanje |
|---|---|
| SDK | `@google/genai` 2.24.0 |
| `.env` ključ | prisutan; vrednost nije prikazana |
| Produkcioni primarni model | `gemini-3.8-flash` (default je isti ako env polje nedostaje) |
| Konfigurisani Flash-Lite | `gemini-3.5-flash-lite` |
| Konfiguracija fallback-a | produkcioni runtime koristi Flash-Lite samo kao fallback; dijagnostika namerno bira njega za sva tri koraka |
| Gemini endpoint/verzija | `https://generativelanguage.googleapis.com`, `v1beta` (SDK defaulti; dijagnostika ih je eksplicitno zaključala) |
| Timeout/retry | dijagnostika: 12.000 ms, bez SDK retry-a |
| Produkcioni adapter | `generateContent`; `responseMimeType: application/json`, `responseJsonSchema` iz bot/analysis zahteva, `httpOptions.retryOptions.attempts: 1`, AbortSignal; ne prosleđuje `apiVersion`/`baseUrl` pa koristi SDK default |
| Structured output | `responseJsonSchema`; nema function calling-a. Google docs navode structured outputs za `gemini-3.5-flash-lite` i podržan JSON Schema podskup |

Server se pokreće sa `node --env-file-if-exists=.env --import tsx --watch backend/src/server.ts`; `productionAiDependencies()` koristi `loadAiConfig(process.env)`. `loadAiConfig` dozvoljava samo stabilni allowlist, čita primary/fallback env i kreira provider samo kada je enabled + ključ prisutan + oba model ID-ja validna. `.env.example` postavlja primarni `gemini-3.8-flash`, fallback `gemini-3.5-flash-lite`. Stvarne `.env` vrednosti nisu kopirane u evidence.

## Live probe-ovi

| Korak | Status | Stvarni generation zahtevi | Ishod |
|---|---|---:|---|
| A — minimalni tekst, bez šeme | izvršen | 3 attempt-a (dva sandbox, jedan eskalisani) | prvi: status nepoznat, `unknown`, 54 ms (pre korekcije ekstrakcije); drugi: status nepoznat, `network_error`, 46 ms; treći eskalisani: HTTP 503, `server_error`, 661 ms. Probe neuspešna; zaustavljeno posle A. |
| B — jednostavna JSON šema | neizvršen | 0 | A nije uspeo, zato nije bilo smislenog nastavka. |
| C — produkcioni adapter + stvarna bot šema + sintetički kontekst | neizvršen | 0 | Zaustavljeno pravilom posle A. |
| **Ukupno** |  | **3 / 3** | Nema uspešnog generation odgovora. |

Prva dva transportna attempt-a završila su se bez HTTP odgovora; ne klasifikovati ih kao Google/Gemini server grešku. Treći je dokaz HTTP 503 sa servera za minimalni Flash-Lite tekstualni zahtev. Nema statusa za B/C, niti probe koja potvrđuje produkcionu bot šemu uživo.

## Potvrđene činjenice

1. UI/evidence ranije pokazuju neuspele produkcione pozive; postojeći adapter je do sada odbacivao numerički `error.status` pri pravljenju `ProviderError`.
2. Produkcioni adapter šalje JSON structured-output konfiguraciju (`application/json` + `responseJsonSchema`), bez SDK ponavljanja; `@google/genai` je verzije 2.24.0.
3. Aktuelni model katalog navodi `gemini-3.5-flash-lite` kao stabilni model, a model strana navodi Structured outputs podršku. To dokazuje dokumentovanu podršku, ne dostupnost za konkretan Google projekat.
4. Minimalni običan tekstualni zahtev ka tom modelu dobio je HTTP 503 nakon eskalacije. Pošto A nije uspeo, B i C nisu slati.
5. Dva ranija korisnička live pokušaja (iz `002-live-smoke.md`) nisu deo ove skripte; ovo dijagnostičko izvršavanje dodalo je tri zahteva, ukupno pet poznatih live zahteva kroz istorijske dokaze + ovaj rad. Limit ovog zadatka od tri stvarna zahteva nije prekoračen.

## Hipoteze i nedostajući dokaz

Potvrđen je pad na Gemini API serverskom HTTP sloju za minimalni tekstualni A zahtev (503). Nije utvrđen razlog 503. Moguće su privremena server-side ili project/model specifična dostupnost, ali nema response body-ja (namerno nije sačuvan), Google request ID-ja ni nezavisnog ponovljenog odgovora da se razdvoje. Ne zaključuje se da su uzrok krediti, model koji ne postoji ili opšti Google outage.

Nedostaju tačan bezbedan podtip/poruka server greške i korelacioni identifikator iz HTTP response headers/body, kao i ishodi B i C. Trenutna bezbedna dijagnostika namerno ne beleži body, headers, URL query ili SDK error tekst. Bez tih podataka uzrok 503 ostaje neutvrđen. Nije potreban dodatni poziv da se utvrdi sloj: 503 status to već dokazuje.

## Najmanja popravka i provere

- Popravka koda: `ProviderError` sada zadržava samo numerički HTTP status (ili `null`); postojeća allowlist klasifikacija ostaje. Nema logovanja celog error-a, headers, URL query, prompta, karata ili raw response-a. Runner štampa samo fazu, trajanje, model, status i allowlisted provider code.
- Dodata adapter test pokriva HTTP statuse, statusless network error i absence tajni/raw body teksta.
- `npm.cmd test -- tests/integration/gemini-adapter.test.ts`: exit 0, 1 suite, 12 testova.
- `npm.cmd run typecheck`: exit 0 (posle popravke testa).
- `scripts/gemini-diagnosis.ts` compile-only: prolazi; disabled provera ispisala je samo opt-in poruku i napravila nula poziva.
- `tsx` direktno: exit greške pre skripte (`uv_os_get_passwd ... ENOMEM`); kompajlirani obični Node runner je korišćen za realnu dijagnostiku.
- SDK test i typecheck nisu live pozivi. B/C i kompletan adapter live zahtev nisu izvršeni.

## Zvanični izvori

- [Google Gemini models](https://ai.google.dev/gemini-api/docs/models) — stabilni ID `gemini-3.5-flash-lite`.
- [Google model capability](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) — model i podržane sposobnosti.
- [Google structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) — JSON Schema structured outputs.
- [@google/genai HttpOptions](https://googleapis.github.io/js-genai/release_docs/interfaces/types.HttpOptions.html) — `apiVersion`, `baseUrl`, timeout i retry options.
- [@google/genai GenerateContentConfig](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html) — `abortSignal` i HTTP opcije.
