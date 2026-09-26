# Research — Week04 AI integracija

**Datum provere**: 2026-09-26. Izvori su zvanična Google AI for Developers
dokumentacija i zvanični `googleapis/js-genai` repozitorijum. Ovo su planske odluke;
zavisnost nije dodata i live API nije pozvan.

## D1 — SDK i verzija

**Decision**: koristiti zvanični Google GenAI JavaScript/TypeScript SDK
`@google/genai` tačno verzije `2.24.0`, server-side u Node 24 backendu.

**Rationale**: Google navodi Google GenAI SDK kao preporučenu GA biblioteku, dok je
legacy `@google/generativeai` neodržavan. Zvanični release 2.24.0 objavljen je
2026-09-22 i aktuelan je na datum provere. Postojeći projekat je TypeScript/ESM i Node
24, pa nema potrebe za REST wrapper-om ili drugom bibliotekom.

**Alternatives considered**: direktan `fetch` bi smanjio dependency count, ali bi
duplirao auth/response tipove i otežao praćenje zvaničnog API-ja. Legacy SDK je
odbačen. SDK se ne dodaje tokom planiranja; budući task menja samo manifest/lockfile.

Izvori: [Gemini API libraries](https://ai.google.dev/gemini-api/docs/libraries),
[js-genai releases](https://github.com/googleapis/js-genai/releases),
[@google/genai API docs](https://googleapis.github.io/js-genai/release_docs/).

## D2 — Modeli i konfiguracija

**Decision**: defaults su `gemini-3.8-flash` kao primary i
`gemini-3.5-flash-lite` kao fallback. Oba su na datum provere stable tekst modeli sa
structured-output podrškom. Server može dobiti zamene kroz `GEMINI_PRIMARY_MODEL` i
`GEMINI_FALLBACK_MODEL`, ali startup config prihvata samo eksplicitnu allowlist-u
stable Gemini text modela čija je podrška ponovo proverena. Prazan/isti fallback ga
isključuje. Preview, Live, image, TTS i provider-i van Gemini family se odbijaju.

**Rationale**: primary daje aktuelni Flash kvalitet, fallback je druga stable linija i
omogućava testirani model-fallback scenario. Server-side konfiguracija sprečava model
ID iz browsera i omogućava zamenu kada lifecycle modela promeni stanje.

**Alternatives considered**: zaključavanje samo jednog modela ne pokriva AIAC07;
arbitraran environment string bio bi preširok; preview model nije primeren stabilnom
default-u. Modeli nisu odabrani na osnovu obećane cene ili free tier-a.

Izvori: [model katalog](https://ai.google.dev/gemini-api/docs/models),
[Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash),
[Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).

**Promenljiva činjenica**: dostupnost za konkretan projekat, quota, billing i cena nisu
garantovani dokumentacijom. Ponovo ih proveriti pre opcionog live smoke-a.

## D3 — Structured output, ne function calling

**Decision**: koristiti `generateContent` sa `application/json` response formatom i
malom JSON Schema šemom za `BotActionProposal` ili `MatchAnalysis`. Rezultat se zatim
parsira postojećim strict Zod 4 šemama. Ne koristi se function calling niti automatic
tool execution.

**Rationale**: Google razlikuje structured output za finalni schema-bound odgovor od
function calling-a za povezivanje sa alatima. Ovde model ne sme imati izvršnu alatku;
on samo vraća inertan predlog. Google izričito upozorava da schema-validnost ne
garantuje semantičku ispravnost, pa identity/revision/legalnost ostaju lokalne.

**Alternatives considered**: function declaration `play_action` bi pogrešno sugerisala
modelsko izvršenje i dodala tool loop bez potrebe. Slobodan JSON tekst je slabiji za
contract test. Dodatni schema-converter paket nije potreban za dve male šeme.

Izvori: [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output),
[Function calling](https://ai.google.dev/gemini-api/docs/function-calling),
[Tools: structured output vs function calling](https://ai.google.dev/gemini-api/docs/tools).

## D4 — Adapter i validacione granice

**Decision**: `AiProvider` zna samo provider request/response; Gemini adapter zna SDK,
auth i normalizaciju grešaka; Zod parser zna oblik; semantic validator zna fingerprint
i legalne akcije; session jedini zna transakcioni commit; postojeći
`chooseBotAction` ostaje provider-independent lokalna strategija.

**Rationale**: fake može deterministički reprodukovati celu matricu bez mreže, a
provider nikada ne dobija engine objekat ili callback. Razdvajanje sprečava da validan
JSON preskoči poker engine i čuva constitution principe IV/V/VI.

**Alternatives considered**: SDK poziv direktno u `session.ts` spaja mrežu, retry i
mutaciju i blokira GET; provider-specific tip u engine-u krši postojeću granicu.

## D5 — Retry, timeout, cancellation i rate limit

**Decision**: tačno dva attempts maksimum; SDK-level retry se isključuje da ne stvori
skrivene pokušaje. Bot: 12 s total, 5 s attempt, 250 ms + 0–100 ms jitter, 500 ms
rezerva. Analysis: 30 s total, 12 s attempt, 500 ms + 0–250 ms jitter, 1 s rezerva.
`Retry-After` se poštuje samo ako staje u preostali budžet.

SDK `HttpRetryOptions.attempts` postavlja se na 1 (originalni pokušaj bez SDK retry-ja);
zvanična referenca navodi da 0 ili 1 znače bez ponavljanja.

- 429, 408, network i timeout: jedan retry istog modela.
- privremeni 5xx: drugi konfigurisani model; ako ga nema, retry istog modela.
- malformed/schema/semantic: jedan isti-model corrective attempt bez backoff-a.
- missing key, invalid request, auth/config i safety refusal: terminalno, bez retry-ja
  ili promene modela.

**Rationale**: Google preporučuje exponential backoff sa jitter-om za transient 429 i
5xx, ali provider limiti zavise od modela i project tier-a i nisu garantovani. Sa samo
jednim recovery pokušajem „exponential” niz ima jednu bounded pauzu. App-level policy
čini attempt count proverljivim i ostaje unutar PROP pragova.

**Alternatives considered**: SDK default retries mogu premašiti feature limit;
neograničen backoff blokira partiju; fallback na drugi model kod auth/safety greške bi
bio zaobilaženje terminalne politike.

Izvori: [Troubleshooting/retry](https://ai.google.dev/gemini-api/docs/troubleshooting),
[API errors](https://ai.google.dev/gemini-api/docs/api-errors),
[Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits),
[SDK timeout options](https://googleapis.github.io/js-genai/release_docs/interfaces/types.HttpOptions.html),
[SDK retry options](https://googleapis.github.io/js-genai/release_docs/interfaces/types.HttpRetryOptions.html).

## D6 — Concurrency, fingerprint i cancellation

**Decision**: provider await se izvršava van postojećeg `GameSession.serial` lock-a.
Session pod kratkim lock-om registruje snapshot/fingerprint, zatim pod drugim kratkim
lock-om proverava isti identity/revision/actor i radi najviše jedan commit. Reset
abortuje signal i terminalno označava interakciju; kasni callback se odbacuje.

**Rationale**: postojeći queue serijalizuje sve operacije. Držanje lock-a tokom mreže
bi prekršilo FR-027/AIAC16. Sam AbortSignal nije dovoljan: zvanična SDK dokumentacija
navodi da client cancellation ne garantuje prekid serverske obrade, zato fingerprint
i terminal-state compare-and-set ostaju obavezni.

**Alternatives considered**: globalni unlock bez rezervacije dopušta duple bot pozive;
čekanje provider-a u ruti blokira read-only recovery i komplikuje reset.

Izvor: [SDK AbortSignal napomena](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html).

## D7 — HTTP i UI tok

**Decision**: postojeći mutation endpoint odmah vraća potvrđen snapshot, čak i kada je
bot interaction `waiting`; backend background coordinator nastavlja botove. Frontend
radi bounded read-only polling `GET /api/game` dok AI status nije terminalan/na ljudskom
potezu. Analysis `POST` vraća 202 generating i isti GET prenosi rezultat/status.
Dashboard ima posebne GET/reset rute.

**Rationale**: nema WebSocket dependency-ja, postojeći refresh obrazac se ponovo
koristi, mutacija se nikad automatski ne ponavlja, a waiting/retry/fallback ostaju
vidljivi i posle refresh-a.

**Alternatives considered**: 30 s blocking POST ne odgovara postojećem frontend
timeout-u; SSE/WebSocket uvode nepotrebnu infrastrukturu; browser provider poziv bi
otkrio ključ.

## D8 — Usage i cost

**Decision**: adapter normalizuje samo dokumentovana `usageMetadata` token polja koja
su stvarno prisutna (`promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`,
`cachedContentTokenCount`, `totalTokenCount`). Svaki agregat vodi `knownCount`,
`missingCount` i zbir za svako polje. Cena ostaje unknown jer GenerateContent usage
metadata ne daje garantovano novčano polje; ne računa se iz javne cenovne tabele.

**Rationale**: delimična metadata se ne sme predstaviti kao potpuna. Broj tokena nije
sam po sebi potvrđen trošak zbog modela, tier-a, caching-a i promene cena.

**Alternatives considered**: procena `tokens × price` krši FR-023; čuvanje raw
response-a krši privatnost; samo jedan total skriva missing vrednosti.

Izvori: [GenerateContent usageMetadata](https://ai.google.dev/api/generate-content),
[Token counting](https://ai.google.dev/gemini-api/docs/tokens),
[Billing](https://ai.google.dev/gemini-api/docs/billing),
[Pricing](https://ai.google.dev/gemini-api/docs/pricing).

## D9 — Ključ i otvorene runtime neizvesnosti

**Decision**: aplikacija čita samo `GEMINI_API_KEY`; ne oslanja se na prioritet između
dva naziva. Prazan ključ znači `unavailable`, nula provider poziva i lokalni bot
fallback. Model config se proverava bez mrežnog discovery poziva pri startup-u.

**Rationale**: eksplicitno jedno ime iz feature ugovora je proverljivije i sprečava
slučajno korišćenje drugog environment ključa. Google dokumentuje oba imena i navodi
da key ostaje server-side.

Izvor: [Using Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key).

**Preostale neizvesnosti**: stvarna dostupnost modela, project quota, billing status,
provider latency i eventualna usage metadata zavise od lokalnog Google projekta i
vremena izvršenja. One ne menjaju korisnički ugovor: failure ostaje bounded i bezbedan.
