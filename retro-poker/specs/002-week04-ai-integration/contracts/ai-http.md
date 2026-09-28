# Lokalni AI HTTP ugovor v2

Ovaj dokument proširuje, ne prepisuje, Week03 [HTTP ugovor](../../001-week03-retro-poker/contracts/http.md).
Transport, loopback/CORS, `Cache-Control: no-store`, body limit, conditional reset i
postojeći error oblici ostaju. Svi novi objekti su strict i odbijaju nepoznata polja.

## Postojeće rute — additive promene

### POST /api/game

`GameConfig` postaje:

```json
{ "botCount": 5, "aiMode": true }
```

`botCount` ostaje ceo JSON broj 1–5. `aiMode` je opcion boolean sa server default-om
`false`; string/number/null se odbijaju. Stari `{ "botCount": 5 }` zato ostaje validan
i koristi Week03 lokalne botove. Browser ne šalje model ID ni ključ.

Kreiranje/zamena najpre commit-uje novu partiju pod postojećim precondition lock-om.
Ako je AI bot prvi na potezu, odgovor može sadržati `game.ai.active.status=waiting`, a
background coordinator nastavlja. Nova zamena cancellation-om zatvara stare interactions.

### GET /api/game i odgovori mutacija

`GameView` dobija obavezno `ai` polje:

```json
{
  "mode": "on",
  "availability": "configured",
  "active": {
    "interactionId": "uuid",
    "purpose": "bot",
    "status": "retrying",
    "attemptCount": 1,
    "model": "gemini-3.8-flash"
  },
  "lastBotOutcome": null,
  "analysis": {
    "status": "idle",
    "interactionId": null,
    "result": null
  }
}
```

`active` je null kada ništa nije pending. Dozvoljeni statusi su `waiting`, `retrying`,
`model_fallback`; terminalni ishod se čuva u `lastBotOutcome` ili `analysis`.
`lastBotOutcome.outcome` je `model` ili `local_fallback`; sadrži handId, actorId,
decisionOrdinal, attemptCount i nullable finalModel, bez predloga/prompta.

`analysis.result` postoji samo kada je status `completed` i odgovara strict obliku iz
data-model-a. Za idle/generating/failed/unavailable je null.

Frontend sme read-only da poll-uje GET dok je active; ne sme automatski ponavljati
POST game/action/next-hand/analysis.

## Nova ruta: POST /api/game/analysis

Strict body:

```json
{
  "gameId": "11111111-1111-4111-8111-111111111111",
  "handId": "22222222-2222-4222-8222-222222222222",
  "expectedVersion": 18
}
```

Dozvoljeno samo kada je `GameView.status` `won` ili `lost`, hand je complete, facts
pripadaju istoj partiji i nema aktivnog analysis-a. Success je `202` sa standardnim
`{game: GameView}` i `analysis.status=generating`. Ako je provider lokalno unavailable,
ruta vraća `409 AI_UNAVAILABLE` i game ostaje sa analysis `unavailable`.
Eligibility ne zahteva `ai.mode=on`: analysis je dostupna i posle partije u kojoj su
botovi koristili samo Week03 lokalnu strategiju, ako je backend provider konfigurisan.

Uspeh background obrade pojavljuje se kroz GET kao completed; provider failure kao
failed. Ručni retry ponavlja isti POST tek posle terminalnog failed/unavailable stanja,
stvara novi interaction ID i ne menja završni result/version poker partije.

## Usage dashboard

### GET /api/ai/usage

`200 { "usage": UsageDashboardView }`. Snapshot je process-wide i postoji i bez igre.

```json
{
  "usage": {
    "revision": 4,
    "logical": [{
      "purpose": "bot",
      "initialModel": "gemini-3.8-flash",
      "finalOutcome": "model_success",
      "count": 3
    }],
    "attempts": [{
      "purpose": "bot",
      "model": "gemini-3.8-flash",
      "relation": "initial",
      "outcome": "success",
      "count": 3,
      "latency": { "count": 3, "sumMs": 420, "maxMs": 180 },
      "usage": {
        "promptTokens": { "knownCount": 2, "missingCount": 1, "sum": 900 },
        "candidateTokens": { "knownCount": 2, "missingCount": 1, "sum": 80 },
        "thoughtTokens": { "knownCount": 0, "missingCount": 3, "sum": 0 },
        "cachedTokens": { "knownCount": 0, "missingCount": 3, "sum": 0 },
        "totalTokens": { "knownCount": 2, "missingCount": 1, "sum": 980 },
        "cost": { "knownCount": 0, "missingCount": 3, "sum": null, "currency": null }
      }
    }],
    "retryCount": 0,
    "modelFallbackCount": 0,
    "localFallbackCount": 0
  }
}
```

Svi count/sum/max su nenegativni safe integer-i; `cost.sum/currency` su oba null kada
nema direktno vraćene novčane metadata. UI prikazuje „nepoznato” ako je missingCount>0,
a poznati parcijalni zbir jasno označava kao parcijalan.

### POST /api/ai/usage/reset

Strict body `{ "expectedRevision": 4 }`. Uspeh: `200` sa praznim usage snapshot-om i
revision 5. Pogrešna revizija: `409 STALE_STATE`. Operacija je serijska samo nad usage
store-om i ne menja game/version/facts/analysis. Dupli reset sa istom starom revizijom
zato drugi put ne prolazi.

## Greške i privatnost

Postojeći `GameError` code enum se proširuje:

| HTTP | code | Uslov |
|---|---|---|
| 409 | AI_UNAVAILABLE | ključ/model config nije lokalno dostupan za analysis |
| 409 | AI_ALREADY_PENDING | analysis za partiju već traje |
| 409 | ANALYSIS_NOT_ALLOWED | partija nije terminalna ili facts/identity nisu aktuelni |

Bot provider failure nije HTTP greška korisničke mutacije: završava se bezbednim
lokalnim potezom i vidljivim `lastBotOutcome`. Provider status body, raw poruka, prompt,
karte, ključ i stack trace se ne mapiraju u `message`.

## Dopuna dijagnostike (2026-09-28)

Usage attempt može sadržati opciono `diagnostic` polje: `httpStatus` (400–599 ili
null), `providerCode` (zatvoreni enum iz `shared/ai-diagnostic.ts`, ili null),
`reason` (`high_demand` ili `unknown`). Bez raw poruka, headers, request/response
body-ja ili proizvoljnih strings. `high_demand` se izvodi samo iz prepoznate 503
poruke; sam status 503 nije dovoljan za tu tvrdnju. Neprepoznati kod ostaje null.
Attempt `outcome` dodatno razlikuje `invalid_request` od `auth_config_error`.
Agregacija razdvaja statuse/razloge da kasniji 500 ne nasledi opis prethodnog 503.

## Idempotency i read-only dostupnost

- Jedan active bot fingerprint; drugi schedule za isti fingerprint vraća postojeći status.
- Provider callback nema HTTP mutation privilegiju; session ga prihvata samo ako active
  interaction ID i ceo fingerprint još odgovaraju.
- Bot engine commit povećava game version jednom. Analysis completion i usage update ne
  menjaju poker game version ili HandResult.
- `GET /api/game` i `GET /api/ai/usage` ne ulaze u provider await i moraju završiti dok
  fake provider ostaje pending.
- Reset/nova partija abortuje stare game interactions; usage reset ih ne abortuje.
