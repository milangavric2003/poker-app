# Bezbednosni ugovor — implementirana W08 dopuna

## HTTP i korisničko ponašanje

Postojeći `POST /api/game/coach`, `GET /api/game/coach/:runId`, analysis/game/usage
ugovori ostaju. Nema novih auth header-a, slobodnog coaching prompta ni javnog
provider/debug/log endpoint-a. Sve mutacije prolaze postojeću proveru verzije.

| Situacija | Ishod | Obavezni efekat |
|---|---|---|
| Nevalidan JSON/tip/domain/extra privilegovano polje | Postojeći 400 i safe code | 0 provider / 0 tool, bez mutacije |
| Prevelik body | 413 pre parse-a, postojeći safe code | 0 provider / 0 tool |
| Pogrešan Content-Type | 415 | 0 provider / 0 tool |
| Nedozvoljen Origin (i `null`) | Postojeći 400 INVALID_INPUT | 0 provider / 0 tool, bez širokog CORS-a |
| Nepoznat game/run ili stale verzija | Postojeći 404/409 prema ruti | Bez curenja resursa i bez novog rada |
| Isti aktivni coach cilj | Postojeći run ID/status | Nema novog rate tokena, provider/tool rada |
| Drugi cilj dok coach traje | Postojeći 409 COACH_ALREADY_PENDING | Nema novog rada |
| Novi start preko 5/60 s | 429 AI_RATE_LIMITED i Retry-After | Bez novog rada, ne troši accepted token |
| Novi start bez provider kapaciteta | 429 AI_CAPACITY_EXCEEDED | Bez novog rada, ne troši accepted token |
| Normalan start | Postojeći 202; neposredan stop 200 | Fiksni server config, dalje validiran async rad |

Postojeći error schema/API mapa sadrže nove kodove; nije promenjen shape svih
odgovora radi ovog feature-a. Retry je eksplicitan korisnički potez. UI ne briše
potvrđenu partiju ili prethodni summary kada dobije 429. Usage GET/reset ponašanje
ostaje, reset nije način resetovanja sigurnosnih limita.

## Alat i model

Jedino `get_decision_evidence`. Argumenti samo `focus` i ceo `limit` 1–10.
Focus mora odgovarati run-u; snapshot/fingerprint bira server. `constructor` i
`toString` nisu alati. Validna schema nije dovoljan scope dokaz.
Tool output mora biti strict, ≤20.480 UTF-8 bajta, kanonski za isti snapshot.
Extra polje sa sentinel-om odbiti pre drugog modela; ne samo obrisati u UI-ju.
Model context/response ≤32.768 bajta, summary/recommendation/finding prema planu.
SDK config ima server-side 4.096 output tokens i jedan SDK pokušaj po eksplicitnom
aplikacionom pokušaju; retry/fallback ne povećavaju ukupni limit četiri.

Provider greška je nepoverljiva. Preneti samo postojeću klasifikaciju i stabilan
kod; nikad raw message/stack. Fake provider može namerno predložiti zabranjen alat
bez obzira na prompt; aplikacija ga mora odbiti. To nije dokaz live model ponašanja.

## Browser i operativni podaci

Plain text za summary/recommendation/evidence; bez aktivnog Markdown/HTML/link-a.
Production zaglavlja i tačna CSP su u planu. Nema remote fontova ili nove asset mreže.
Security događaji koriste samo [data-model](../data-model.md) allowlist; nepoznati
tool name i tekst sa novim redom nikada ne postaju event/reason polja.

Sentinel test mora dokazati učitavanje server vrednosti, odsustvo iz bundle-a i
source mapa ako postoje, HTTP-a, konteksta i događaja. Event buffer je interni;
nema raw export-a. Nema autentikacionih cookie-ja; credential CSRF N/A uz proveru
stvarne origin granice. SQL N/A jer nema baze; nije zahtev da je uvedemo.

Izvršna mapa ugovora: [T00–T17](../../../docs/evidence/005-phase7-matrix.md).
Lokalni profil nije deployed server, UUID nije credential; N/A ne pokriva origin
ili obavezni tool tok.
