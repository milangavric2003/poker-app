# Podaci i stanja — Week08

Postojeći poker/coach DTO se zadržava; ovo je dizajn dopuna, ne već implementiran kod.
Autoritativne granice su u [planu](plan.md), HTTP pravila u [ugovoru](contracts/security.md).

| Entitet | Polja i pravila | Životni vek |
|---|---|---|
| CoachRequest | Postojeći gameId/handId UUID, expectedVersion i goal.focus enum; strict, bez novih polja | Jedan zahtev; nije credential |
| Trusted snapshot | Serverski gameId/handId/version/factsRevision, terminalni status i bounded činjenice | Zamrznuta kopija za run; klijent/model ne biraju sadržaj |
| AdmissionWindow | Monotone timestamp vrednosti prihvaćenih novih coach/analysis startova; najviše 5 u poslednjih 60.000 ms | Proces; nova partija/usage reset ne briše |
| ProviderLease | Interni jedinstveni lease ID, purpose bot/analysis/coach, active/settled; najviše 2 active | Od atomske rezervacije do settle stvarnog poziva |
| Run | Postojeći fingerprint, step/tool/attempt brojači, deadline, status, rezultat | Terminalan najviše jednom; kasni posao ne vraća status na completed |
| SecurityEvent | Zatvoreni event/reason/outcome/purpose enum-i, server correlation UUID, ISO timestamp, nenegativni celobrojni brojači | Najviše 200 događaja / 30 minuta u memoriji |
| SecurityFixture | Sintetička partija, fake sat/provider, sentinel, očekivani brojači i snapshot | Samo testovi i evidence |

Security event dozvoljava samo `event`, `timestamp`, `correlationId`, `purpose`,
`reasonCode`, `outcome`, `providerAttempts`, `executedToolCalls`. Brojači su safe
integer ≥0. Correlation ID je generisan serverom, ne preuzet iz header-a; ne daje
pristup. Event enum: `ai.request.accepted`, `ai.request.rejected`,
`agent.tool.accepted`, `agent.tool.rejected`, `ai.run.finished`.
Outcome: `accepted`, `denied`, `completed`, `stopped`, `failed`.
Reason enum sadrži stabilne kodove iz ugovora i postojeće stop razloge kroz eksplicitnu
mapu; nikad message/name nepoverljivog objekta. Purpose: `coach`, `analysis`, `bot`.

State tokovi:
- Admission: validate → existing run/no evidence/reject ili atomically accept.
- Provider lease: reserved → running → settled; abort/timeout ne preskače settled.
- Run: created → running → completed/stopped/failed (postojeći ugovor).
- Security buffer: append sanitized → drop oldest over 200 → prune older than
  30 minuta; lokalni proces restart briše sve, nema novog javnog endpoint-a.

Ne vezivati kapacitet za dashboard epoch: usage reset utiče na prikaz/beleženje
analitike, ne na stvaran posao ili admission prozor. Read-only poređenje obuhvata
engine, facts, verziju i poker istoriju; očekivane run/usage/security metapodatke
proveravati odvojeno, bez tvrdnje da su svi serverski objekti nepromenljivi.
