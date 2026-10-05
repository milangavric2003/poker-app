# Coach HTTP ugovor v1

Datum: 2026-10-04, T003 ugovor; T018–T020 backend implementiran i offline proveren.
Provider, alat i run state: [data model](../data-model.md).

## Start

POST `/api/game/coach`, JSON body ≤1024 UTF-8 bajta, strict:
`{ gameId: UUID, handId: UUID, expectedVersion: safe integer >=0, goal: { focus } }`.
Klijentski identitet je precondition, ne bira izvor facts-a; server uzima tekuću
terminalnu partiju. factsRevision i runId generiše/uzima server. Content-Type JSON.
Nepoznata polja, format ili oversize: 400/INVALID_INPUT (oversize 413/INVALID_INPUT).
Nepostojeća partija: 404/GAME_NOT_FOUND; stale: 409/STALE_STATE; aktivna partija:
409/GAME_NOT_TERMINAL; nevažeća AI konfiguracija: 409/AI_UNAVAILABLE.
Sve preflight greške: 0 provider poziva, 0 tool izvršenja, bez promene poker stanja.

202 `{ run: CoachRunView }` posle uspešnog preflight-a. Bez detaljnih odluka za focus:
200 sa terminalnim stopped/insufficient_evidence run-om i brojačima nula.
Aktivni isti fingerprint+goal: 202 sa istim runId, bez dodatnog rada.
Aktivni drugačiji goal: 409/COACH_ALREADY_PENDING; ne poništava postojeći run.
Posle terminalnog ishoda eksplicitni POST/retry pravi novi runId. Serial lock pokriva
preflight/start; asinhroni provider/tool tok počinje posle njegovog oslobađanja.

## Status i vlasništvo

GET `/api/game/coach/:runId`: UUID path parametar, strict prazni query; 200
`{ run: CoachRunView }` samo za zadržani run tekuće partije; malformed query 400,
nepoznat/zamenjen/uklonjen run 404/RUN_NOT_FOUND. Nema implicitnog start-a ili poziva.
CoachRunView: runId, gameId, handId, expectedVersion, factsRevision, goal, status,
startedAt, deadlineAt, stepCount, toolCallCount, providerAttemptCount, stopReason,
result (null osim completed), sampleLimited i failureCategory (null osim kategorisane greške).
Status, stopReason i failureCategory su enum-i iz plana; strict schema
ne dozvoljava provider prompt/candidate/exception/tool arguments ili interno stanje.
Svaki odgovor/greška ima Cache-Control: no-store; server i UI runtime-validiraju DTO.
Preflight error body prati postojeći `{ error: { code, message } }` obrazac.

GameSession poseduje slot i abort controller; orchestrator predlaže promene run-a;
session jedini serijski commit-uje uz runId/gameId/handId/version/factsRevision.
Reset/nova partija abortuje i uklanja slot; ne čeka provider. Stari GET/POST rezultat
UI ignoriše poređenjem game identity i lokalnog request token-a/runId. UI poll-uje
GET na 1 s samo dok je running, najviše jedan GET u toku, cleanup na unmount/reset.
Ne menja Week04 GameView, analysis POST niti postojeći poker API.
UI bira focus, blokira dupli submit, prikazuje stanje, provereni rezultat i uzorak;
retry samo eksplicitnim klikom. Nema nove cancel rute: reset/nova partija i serverski
AbortSignal su Core cancellation tok. Provider/tool await nikad ne blokira GET.

Dokazi: T018 strict/preflight/no-store/idempotency, T019 async ownership,
T021/T022 UI retry/poll/race i T023 E2E su provereni; T024 finalna offline matrica
je u [handoff-u](../../../docs/evidence/003-T024-handoff.txt). T029 razdvaja
kalendarske startedAt/deadlineAt ISO datume od internog monotonog deadline-a;
jedan stabilan wall-clock početak vezan je za session slot. Ljudski T027 ostaje otvoren.

T018 odluka: korisnikov Phase 3 zahtev bira path parametar; nema druge GET forme.
