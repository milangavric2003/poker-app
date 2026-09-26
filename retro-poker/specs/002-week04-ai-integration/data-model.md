# Model podataka — Week04 AI integracija

Svi entiteti su in-memory. Javni DTO oblici su u [contracts/ai-http.md](contracts/ai-http.md).
Provider ne prima nijedan od internih objekata direktno; context builder pravi allowlist
projekciju. Ograničenja dopunjuju, ne zamenjuju Week03 modele.

## Konfiguracija

### AiRuntimeConfig

| Polje | Ograničenje |
|---|---|
| apiKey | backend-only string iz `GEMINI_API_KEY`; nikad u javnom DTO-u/logu; prazno znači unavailable |
| primaryModel | allowlisted stable Gemini text model; default `gemini-3.8-flash` |
| fallbackModel | drugi allowlisted stable Gemini text model ili null; default `gemini-3.5-flash-lite`; isti/prazan postaje null |
| maxAttempts | tačno 2 za ovaj feature |
| botTotalMs / analysisTotalMs | 12.000 / 30.000 |
| botAttemptMs / analysisAttemptMs | 5.000 / 12.000, dodatno ograničeno preostalim total budget-om |

### Game AI Configuration

`aiMode` je boolean u konfiguraciji nove partije, default `false`. Ne menja se usred
partije. Nedostajući ključ ne menja `aiMode`, već javnu availability postavlja na
`unavailable` i botove vodi lokalnim putem.

## Provider-neutral entiteti

### BotDecisionContext

Strict immutable snapshot:

- `gameId`, `handId`, `expectedVersion`, `actorId`, `decisionOrdinal`;
- `phase`, javni `board`, `pots`, javni player id/seat/kind/stack/contribution/status;
- tačno dve privatne karte samo actor bota;
- legal actions sa server-calculated granicama;
- najviše poslednja 64 javna događaja dostupna do odluke.

Nema drugih hole cards, burn/deck/seed/RNG, environment-a, ključa, source/logova ili
kasnijeg ishoda. `decisionOrdinal` monotono raste unutar ruke i nije game version.

### BotActionProposal

Strict diskriminisana unija:

- `{gameId, handId, expectedVersion, actorId, type}` za fold/check/call/all_in;
- ista polja + celobrojni `amountTo` 1–6000 za bet/raise;
- nema nepoznatih polja.

Schema-validan predlog je još uvek inertan. `semantic.ts` zahteva jednak fingerprint,
tačan actor i članstvo u aktuelnom `legalActions`; bet/raise iznos mora biti unutar
aktuelnog min/max. Zatim engine ponovo primenjuje standardna pravila nad clone-om.

### ProviderRequest / ProviderResult

Request: `purpose` bot/analysis, allowlisted `model`, bounded context, response schema,
attempt ordinal 1–2. Result: kandidat `unknown`, stvarni model/version kada postoji,
response ID samo volatilno, i opcion `ProviderUsage`. Raw response se ne čuva.

### ProviderUsage

Svako od `promptTokens`, `candidateTokens`, `thoughtTokens`, `cachedTokens`,
`totalTokens` je nenegativan safe integer ili `unknown` (interno `null`). Monetary
cost je `unknown` osim ako ga provider direktno i jednoznačno vrati; trenutni plan ne
pretpostavlja takvo polje.

## Interakcija i attempt lifecycle

### AIInteraction

| Polje | Ograničenje |
|---|---|
| interactionId | UUID, jedinstven po logičkom bot/analysis zahtevu |
| purpose | `bot` ili `analysis` |
| fingerprint | immutable identity opisan ispod |
| status | `waiting`, `retrying`, `model_fallback`, `completed`, `local_fallback`, `unavailable`, `failed`, `stale`, `cancelled` |
| startedAt/deadlineAt | monotoni clock ms za odluke; wall-clock nije autoritet |
| attempts | uređeni niz dužine 0–2 |
| terminalAt | null do terminalnog statusa; postavlja se jednom |

Bot fingerprint: interactionId + purpose + gameId + handId + expectedVersion + actorId
+ decisionOrdinal. Analysis fingerprint: interactionId + purpose + gameId +
terminalHandId + expectedVersion + factsRevision.

Dozvoljeni prelazi:

```text
waiting -> completed | retrying | model_fallback | local_fallback | unavailable |
           failed | stale | cancelled
retrying/model_fallback -> completed | local_fallback | failed | stale | cancelled
```

Terminalno stanje nema izlaz. Compare-and-set nad active interaction ID-em sprečava
dupli callback. Analysis manual retry stvara novi interaction ID; ne vraća stari u waiting.

### AIAttempt

`ordinal` je 1 ili 2; `model` je stvarno pozvani allowlisted ID; `relation` je
`initial`, `same_model_retry` ili `model_fallback`; `outcome` je jedan od `success`,
`timeout`, `rate_limited`, `server_error`, `network_error`, `malformed`,
`schema_rejected`, `semantic_rejected`, `safety_refusal`, `auth_config_error`,
`cancelled`, `stale`; `durationMs` je nenegativan; usage je parcijalan/unknown.

Attempt ne sadrži prompt, karte, raw response, ključ, stack trace ili provider error body.

## Match facts i analiza

### HumanDecisionFact

- identity: game/hand/version, hand number, decision ordinal;
- pre-action znanje: phase, board, čovekove dve karte, javni stackovi/potovi/statusi,
  legal actions i najviše 64 poslednja javna događaja;
- chosen action i amountTo samo kada postoji;
- outcome se dodaje tek po settlement-u kao odvojeno polje: reason, public result,
  human net change i game status.

Najviše 200 detaljnih ljudskih odluka po partiji. Starije se svode u čiste brojčane
hand aggregate (broj poteza po tipu, početni/krajnji stack, rezultat), bez LLM teksta.
Facts revision raste pri svakoj promeni i ulazi u analysis fingerprint.

### MatchAnalysis

Strict struktura:

- `summary`: 1–1200 karaktera;
- `goodDecisions`: 0–6 stavki, svaka `decisionRef` + `explanation` 1–600;
- `possibleMistakes`: 0–6 istog oblika;
- `nextSteps`: 1–6 stringova, svaki 1–300;
- fiksna javna disclaimer oznaka dodaje se lokalno, ne veruje se modelu.

Svaki `decisionRef` mora postojati u poslatim facts. Analiza ne sadrži game mutation,
ne menja `HandResult`, stack, version ili events. Uspešan rezultat pripada tačno jednom
analysis fingerprint-u.

## Usage store

### UsageDashboardState

Procesni singleton sa `revision` safe integer ≥0 i agregatima:

- logical interactions po purpose + initial model + final outcome;
- attempts po purpose + actual model + relation + outcome;
- retry/modelFallback/localFallback brojači;
- latency `count`, `sumMs`, `maxMs` (UI izračunava/validira avg iz count/sum);
- za svako usage polje `knownCount`, `missingCount`, `sum`.

Nema per-interaction prompt/raw zapisa. Reset zamenjuje aggregate praznim vrednostima i
povećava revision; ne dodiruje game, facts ili analysis. Reset partije ne menja store.

## Javni AI pogled

`GameView.ai` sadrži:

- `mode`: `off`/`on`, `availability`: `configured`/`unavailable`;
- `active`: null ili interactionId, purpose, status, attemptCount i bezbedan model ID;
- `lastBotOutcome`: null ili handId/actorId/decisionOrdinal, outcome
  `model`/`local_fallback`, attemptCount i finalModel nullable;
- `analysis`: `idle`/`generating`/`completed`/`failed`/`unavailable`, interactionId
  nullable, validirani MatchAnalysis samo za completed, bez raw sadržaja.

Reset/nova partija uklanja prethodni AI pogled sa igrom. Dashboard je poseban DTO.

