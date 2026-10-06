# T034 — dijagnoza i pripremljena detaljnija provera

Datum: 2026-10-06 Europe/Belgrade. Korisnik sačuvao terminalnu partiju i neuspešan
run a4096790-850f-4ab9-ba77-862ef0888c16 radi pregleda. Nema novih live poziva.

Read-only GET potvrđuje failed/malformed_output/invalid_structured_response,
2koraka/2attempts/1tool. Usage istog procesa ima4runs,3completed i1malformed;
svi step1attempts uspešni, jedan step2attempt ima outcome malformed. Nema odbijene
orchestrator validacije: ovo odbijanje potiče iz adaptera, ne završnog membership
validatora. Tačno polje nije poznato, jer raw output nije sačuvan. sampleLimited
je očekivana oznaka ograničenog uzorka, nije potvrđen uzrok greške. Ovaj mali uzorak
nije pouzdana procena stope uspeha niti dokaz da je T033 rešio svaki model failure.

## Pripremljena promena — NIJE PRIMENJENA

[Patch](003-T034-prepared.patch) je napravljen u .verification/coach-format kopiji.
Omogućava budući opcioni GET run outputIssue enum: missing_output/output_too_large/
invalid_json/transport_shape/invalid_evidence_index/duplicate_evidence/
missing_completion_evidence/summary_bounds/recommendation_bounds/final_shape.
Adapter bira samo enum na mestu odbijanja, orchestrator allowlist proverava vrednost,
session prenosi enum, javna šema ga dopušta samo uz failed/malformed_output/
invalid_structured_response. Nema raw vrednosti, Zod poruka/putanja, model teksta
ili key-a. Public DTO ostaje kompatibilan sa starim odgovorima bez outputIssue-a.
Runtime rejection politika/validator/budžeti ostaju isti, nema deduplikacije ili retry-ja.

Provider schema description sada objašnjava dužinu teksta i distinct indeks izbor.
Instalirani SDK @google/genai2.24.0 dokumentuje podržane JSON schema keywords;
uniqueItems/minLength/maxLength nisu u tom spisku, zato nisu uvedeni kao navodna
provider garancija. Description je smernica modelu, ne dokaz pouzdanosti.

Ovo ne rekonstruiše tačno polje trenutnog run-a niti ga retroaktivno dopunjava.
Ne tvrdi se da je generisanje ovog live problema popravljeno. Pre sledećeg
optimizovanja modela potreban je precizan safe signal narednog failure-a.

## Stvarno provereno u odvojenoj kopiji

- Expected-first plan: .verification/coach-format/T034-plan.md.
- Novi12testova: RED12FAIL, zatim GREEN119/119 sa adapter/orchestrator/route regresijom.
- Puna suite864/864 u59fajlova; typecheck/lint/build exit0.
- git apply --check -- .verification/coach-format.patch: exit0; patch spreman za primenu.
- Završni read-only GET potvrdio isti run i neuspeh, partija/run nisu izgubljeni.
- Browser E2E/live modeli nisu pokretani. Nijedan dev proces nije restartovan.

Logovi su [RED](003-T034-red.txt), [GREEN](003-T034-green.txt),
[regresija](003-T034-regression.txt), [typecheck](003-T034-typecheck.txt),
[lint](003-T034-lint.txt), [build](003-T034-build.txt).
Jedan coding agent, bez subagenata. Ljudski review/coding tokeni/cena unknown.
Staging kopija uključuje relevantni backend/shared/frontend/tests/scripts i config;
ne uključuje .env ili privatne run podatke. Nezavisan test route-a ne otvara portove.

Dva duža PowerShell patch-preparation pokušaja bez izlaza prekinuta su u sopstvenim
exec sesijama. Patch zatim generisan lokalnim Python difflib-om, bez mutacije
produkcije. Dodatna nepotrebna copy proba za root index.html nije uspela jer Vite
koristi frontend/index.html koji je već u kopiji; build prolazi. Setup greške nisu RED.

## Primena čeka korisnikov izbor

Aktivni backend ima node --watch backend/src/server.ts, a partija/run su u memoriji.
Primena ovih šest runtime fajlova može restartovati backend i ukloniti trenutnu
partiju. Zbog korisnikove želje da je sačuvamo, produkcioni backend/shared nisu
menjani. Potrebno je potvrditi da može završiti pregled pre primene. Posle potvrde:
proveriti da je patch i dalje primenljiv, primeniti ga i zabeležiti runtime T034
spec/plan/contracts/task/manifest; nije potreban novi live poziv bez odobrenja.
