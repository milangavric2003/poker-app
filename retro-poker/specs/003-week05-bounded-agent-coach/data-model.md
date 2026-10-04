# Week05 — tehnički ugovor v1

Datum: 2026-10-04; dokumentaciona odluka T003. Runtime šeme tek T007/T008.
Politika limita i terminalnih razloga je u [planu](plan.md#zaključana-politika-t005).

## Run i provider granica

`created → running → completed | stopped | failed`; terminalno stanje je nepromenljivo.
Session ima jedan aktivni ili poslednji terminalni run; nema arhive/map-e run-ova.
Novi run zamenjuje terminalni, nova partija/reset uklanja run i abortuje aktivni.
Run sadrži serverski UUID runId, gameId, terminalni handId, expectedVersion,
factsRevision, goal, status, startedAt/deadlineAt (ISO vreme za prikaz), monotoni
početak/deadline interno, stepCount, providerAttemptCount, toolCallCount,
recentActions (najviše jedan ključ), validirani rezultat alata, sampleLimited,
failureCategory, stopReason i result.
Provider/tool čekanje nikada ne drži session serial lock; samo start i commit ga drže.

Novi interni provider metod/ugovor za coach korak prima purpose=coach, runId,
stepOrdinal 1/2, attemptOrdinal 1/2, runAttemptOrdinal 1–4, serverski model iz postojeće
konfiguracije, ograničen goal/context, allowlist descriptor, responseSchema,
remainingMs i AbortSignal. Vraća candidate: unknown, normalizovani model/usage i
bezbednu kategoriju greške; candidate se validira u aplikaciji. SDK retry je isključen.
Nema Gemini importa u orchestrator-u, nema raw SDK odgovora u DTO-u. Week04 AiPurpose,
AIAttempt ordinal 1|2 i coordinator nisu ugovor za ceo Week05 run: novi ugovor se
dodaje bez promene Week04 semantike. Fake mora hvatati svaki zahtev/signal i davati
scripted unknown proposal/final/grešku bez mreže.

## Modelski i finalni ugovor

Goal je strict `{ focus: 'betting' | 'street' | 'showdown' }`, bez slobodnog teksta.
Korak 1: strict `{ kind: 'tool_request', name: string, arguments: unknown }` ili
`{ kind: 'refusal', reason: 'insufficient_context' | 'cannot_complete' }`.
Prvo oblik, zatim name allowlist, pa strict argumenti; nepoznato ime zato dobija
unknown_tool umesto generičkog schema error-a. Korak 2 prima strict final ili refusal;
tool_request se zasebno prepoznaje samo radi bezbednog repeated/limit stop-a.

Final: strict `{ kind: 'final', summary, recommendation, evidence, confidence,
completed }`; confidence je low|medium|high, completed boolean. Summary 1–1000,
recommendation 1–500 Unicode code point-a posle trim-a. Evidence 0–10 jedinstvenih
parova decisionRef/factCode; decisionRef 1–128 ASCII znakova, finding 1–500 code
point-a. `completed=true` traži najmanje jedan validan dokaz. `completed=false` ili
insufficient_context daju stopped/insufficient_evidence bez javnog final rezultata;
cannot_complete daje stopped/invalid_model_proposal. Final pre alata je
invalid_model_proposal. Nevalidan final je failed/malformed_output.

Model ne sme izmisliti finding: za svaku evidence stavku finding mora tačno odgovarati
kanonskom tekstu činjenice datom u tool result-u, uz isti decisionRef/factCode.
Summary/preporuka su obrazovni tekst; membership provera ne dokazuje njihovu stratešku
ispravnost. UI prikazuje obrazovno ograničenje i ograničen uzorak, bez tvrdnje optimalnosti.

## Ugovor jedinog alata

Ime: get_decision_evidence. Svrha: izbor proverljivih poteza za cilj, read-only.
Pozivalac: isključivo orchestrator posle svih provera. Input strict `{ focus, limit }`;
focus isti enum kao goal i mora odgovarati goal.focus; limit safe integer 1–10.
Nema gameId/putanje/URL-a iz modela. Snapshot je serverski vezan za run fingerprint.

Izbor: betting uključuje bet/raise/call/all_in odluke; street sve detaljne odluke;
showdown odluke čiji outcome.reason=showdown. Uzeti najnovije po decisionOrdinal,
pa vratiti rastućim ordinalom; nikada pojedinačne detalje iz aggregates.
Preflight traži najmanje jednu takvu odluku, inače nula provider/tool poziva.

Output strict `{ factsRevision, focus, sampleLimited, decisions }`; sampleLimited=true
kada postoje agregirane odluke ili je izbor skraćen limitom/byte cap-om.
decisions 0–limit sadrži strict `{ decisionRef, facts }`, facts najviše pet strict
`{ factCode, finding }` stavki, jedinstvenih po factCode. FactCode enum:
action, phase, legal_options, known_cards, hand_outcome.
Kanonski finding je deterministički JSON iz allowlist projekcije izvora: chosenAction;
knowledge.phase; knowledge.legalActions; knowledge.board i ljudske holeCards;
outcome (samo ako postoji, odvojeno od tadašnjeg znanja). Svaki finding ≤500 code
point-a; nema proizvoljnog model teksta, protivničkih skrivenih karata, events ili špila.
Ne seći string/činjenicu: prevelika činjenica se izostavlja, prazna odluka izostavlja;
ako JSON prelazi 20480 UTF-8 bajtova, uklanjati najstariju izabranu odluku do granice.

Validator proverava strict oblik, UTF-8 cap, focus/revision, count ≤limit ≤10,
jedinstvenost, članstvo ref-a i tačnu projekciju factCode/finding iz fiksnog snapshot-a.
Korak 2 dobija samo validirani rezultat, nikada interno MatchFacts/GameState.
Prazan validan rezultat završava insufficient_evidence bez koraka 2.
Tool failure/timeout/nevalidan output završava failed/tool_failed, bez recovery
izvršenja. Lokalni alat ima 1000 ms ili preostali deadline, šta je manje; proverava
signal i sat tokom bounded iteracije (najviše 200 odluka). Promise race sam ne
prekida sinhroni rad, pa kooperativne provere moraju biti testirane.

## Kontekst i dokaz

Korak 1 dobija goal, bezbedne run brojače/status, tool descriptor i broj raspoloživih
detaljnih odluka/sampleLimited. Korak 2 dodatno samo poslednji validirani tool result.
Context JSON ≤32768 UTF-8 bajtova, bez promptova drugih koraka, repo-a ili raw logova.
Model output candidate ≤32768 UTF-8 bajtova pre parsiranja. Nevalidan/oversize context
zaustavlja invalid_input, output malformed_output. Kontekst tretirati kao podatke,
ne sistemske instrukcije. Bezbedna run evidencija ima najviše 2 step zapisa, 4 attempt
zapisa i 1 tool zapis; kategorija, model, brojač, trajanje i poznati usage ili unknown.
Ne čuvati candidate, raw exception, tajne ili chain-of-thought. Reset usage-a menja
epoch; kasni run ne sme dopisati stare metrike u novu epoch-u.

## T003 handoff

Provereno: T002 matrica 25/25; postojeći provider types/coordinator/retry policy,
MatchFacts cap 200, routes i session async fingerprint obrazac. Plan i ovaj ugovor
razrešavaju prethodne otvorene izbore; HTTP je u [coach-http](contracts/coach-http.md).
Komande: Get-Content relevantnih izvora, rg za analysis/version/revision, git status
--short i git diff -- plan.md. Dokumenti su pregledani; novi testovi nisu pokrenuti.
Sledeće T004: prompt dopuniti samo nedostajućim obimom/proverama/nejasnoćama i manifestom.
