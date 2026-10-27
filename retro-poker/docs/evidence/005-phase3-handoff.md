# Faza 3 — T008–T012

2026-10-26, Europe/Belgrade. Driver: Codex u sesiji sa Vekijem.
Početni HEAD `2b8ea4e7bddf1383b2118decee7bb848caf7ba86`, grana `week08-init`,
Git koren `D:/AIBootcamp/week3-4`, početno radno stablo čisto.
Završni checkpoint je isti HEAD + radni diff; bez commit/push/merge-a.

## Očekivanje, prethodna faza i postupak

Pre prvog izvršavanja očekivanja su zapisana kao assertions u novim testovima:
odbijen HTTP 0 provider/0 tool i identična poker projekcija; odbijen proposal
1 provider/0 executor; odbijen tool output 1 provider/1 stvarni executor, bez
drugog modelskog poziva; normalan tok 2 provider/1 executor i validan final.
Postojeća dobra zaštita daje PASS→PASS; runtime menjati samo posle dokazanog propusta.

Pregledani T005–T007 kod, handoff, originalni prvi padovi, ulazi i rezultati.
[Nova preflight komanda](005-phase3-preflight.txt) potvrđuje T00 i tri T07 PASS,
samo poznati T13 FAIL. Nije pronađen nov harness problem. Sačuvani Faza 2
fixture-i i početni T07/T13/T16 dokazi nisu menjani. Produkcioni T16 je ponovljen
posle build-a sa istim ulazima: opet RED, script 200/kontrolni marker radi,
app executed=true, violations=[], requests 2→3, bez CSP-a.

Spec Kit prerequisites razrešava feature 005; prvi direktni poziv blokira lokalna
PowerShell execution policy, ponovljen dokumentovanim `powershell -ExecutionPolicy
Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks
-IncludeTasks`, exit 0. Checklist 9/9, bez extensions.yml/pre/post hook-ova.
Ignore i ESLint konfiguracija pokrivaju dependency/build/test artefakte.

## Taskovi, izvršna mesta i nalazi

| Task | Status / dokaz |
|---|---|
| T008 | Završen. `tests/contract/security-http.test.ts`: stvarni buildApp/parser/rute; malformed JSON, tip/domain/null/missing, media, odvojena privileged polja i byte cap, unknown game 404/GAME_NOT_FOUND, unknown hand i stale version 409/STALE_STATE. Pozitivan schema-valid JSON sa whitespace do tačno 1024 bajta; 1025 odbijen. Multibyte telo ima <1024 znakova i >1024 bajta, dobija 413. Svako početno odbijanje proverava provider/poslovni executor 0/0 i kompletnu poker projekciju sa facts, RNG, verzijom i istorijom. |
| T009 | Završen uslovni task: nije potrebna runtime popravka. Prvi HTTP/T00 run 38/38 PASS; postojeći strict schemas/body/origin/session guard-ovi ispravni za ove slučajeve. |
| T010 | Završen. `tests/integration/security-tools.test.ts` + `tests/unit/security-schemas.test.ts`: invalid/oversized model i final, shell/constructor/toString, null/type/extra/limit 0/11, validni 1/10, zasebno schema-valid betting/1 protiv street run-a, malicious set_player_stack fake proposal, null/oversized/extra-sentinel/foreign tool output. Drugi snapshot testiran i sa istom facts revizijom. Stvarni executor radi pre transformacije nepoverljivog rezultata; odbijen output nema drugog modela. Pozitivni test poredi snimljeni drugi provider request sa kanonskim rezultatom i proverava svaku final evidence stavku. |
| T011 | Završen uslovni task: nije dokazana runtime rupa, nema runtime izmene. T06–T10/T00 i prethodni agent/tool/final testovi prolaze. Očuvane postojeće granice 200 odluka, 10×5, tool 20480 i model 32768 UTF-8 bajta. Novi schema testovi proveravaju tačno 20480/20481 i model 32768/32769; run test takođe proverava raw JSON model odgovor na 32768/32769. Tekst/reference ostaju u postojećim Unicode/ASCII granicama. |
| T012 | Završen. HTTP allowed Origin i absent Origin prihvaćeni; unknown i literal null daju 400/INVALID_INPUT pre rada. Browser menja prikaz i localStorage, šalje forged privileged zahtev, poredi stvarni GET /api/game pre/posle i posle reload-a; normalan UI coaching potom 2 koraka/1 real tool, bez forged modela. Cookies prazni; nema allow-credentials ili set-cookie u HTTP odgovoru. |

HTTP test observer samo posmatra stvarni GameSession.create da dobije pristup
kanonskom stanju; validacija nije zamenjena. Browser poredi autoritativni javni
serverski rezultat kroz pravi backend, dok node testovi porede internu poker
projekciju. Aplikacija ne čita poker stanje iz localStorage-a; test ne uvodi takvu
funkciju. Loopback, UUID i CORS nisu autentikacija. Odsutan Origin je dozvoljen
lokalnom ne-browser klijentu uz sve ostale provere. Nema automatskog auth
cookie/credential modela: taj credential CSRF scenario N/A. SQL N/A: nema baze.

## Stvarne komande i rezultati

Sve npm komande iz `retro-poker/`; fake provider, sintetički podaci, lokalni serveri.

| Komanda | Actual | Izlaz |
|---|---|---|
| `npm.cmd run test:security` pre novih testova | 4 PASS / 1 poznati T13 FAIL, exit 1 | [preflight](005-phase3-preflight.txt) |
| `npm.cmd test -- tests/contract/security-http.test.ts tests/integration/security-normal.test.ts` prvi | 38 PASS, exit 0 | [HTTP first](005-phase3-http-first.txt) |
| `npm.cmd test -- tests/integration/security-tools.test.ts` prvi | 27 PASS, exit 0 | [tools first](005-phase3-tools-first.txt) |
| `npm.cmd test -- tests/unit/security-schemas.test.ts` prvi | 13 PASS, exit 0 | [schemas first](005-phase3-schemas-first.txt) |
| `npm.cmd run test:e2e -- tests/e2e/security-state.spec.ts` prvi | FAIL, innerText/textContent assertion mismatch; nije security RED | [first browser](005-phase3-state-first.txt) |
| Fokusirani `npm.cmd test -- ...` za 10 pogođenih security/agent/tool/final/route fajlova (tačna komanda u logu) | 236 PASS, exit 0 | [focused](005-phase3-focused.txt) |
| `npm.cmd run test:e2e -- tests/e2e/security-state.spec.ts tests/e2e/recovery.spec.ts` | 7 PASS, exit 0 | [browser](005-phase3-browser.txt) |
| `npm.cmd run test:security` final | 80 PASS / 1 očekivani T13 FAIL, exit 1; svih 5 node security fajlova odabrano | [security](005-phase3-security.txt) |
| `npm.cmd test` | 986 PASS / 1 očekivani T13 FAIL, 67 fajlova, exit 1 | [full](005-phase3-full-tests.txt) |
| `npm.cmd run typecheck` prvi | exit 2: spy mock.contexts tip je {}, test instrumentacija | [first typecheck](005-phase3-typecheck.txt) |
| `npm.cmd run typecheck` posle typed-this observer-a | PASS exit 0; potom uklonjen wrapper zbog lint pravila | [intermediate typecheck](005-phase3-typecheck-final.txt) |
| `npm.cmd run lint` prvi | PASS exit 0; pre typed-this dorade | [lint](005-phase3-lint.txt) |
| `npm.cmd run lint` sa typed-this wrapper-om | FAIL exit 1, no-this-alias u test instrumentaciji | [intermediate lint](005-phase3-lint-final.txt) |
| `npm.cmd run lint` konačan | PASS exit 0 | [verified lint](005-phase3-lint-verified.txt) |
| `npm.cmd run typecheck` konačan | PASS exit 0 | [verified typecheck](005-phase3-typecheck-verified.txt) |
| `npm.cmd test -- tests/contract/security-http.test.ts` konačan | 37 PASS exit 0 | [verified HTTP](005-phase3-http-verified.txt) |
| `npm.cmd run build` | PASS exit 0 | [build](005-phase3-build.txt) |
| `npm.cmd run test:e2e -- tests/e2e/security-production.spec.ts` | 1 očekivani T16 FAIL, exit 1 | [production](005-phase3-production.txt) |

Prvi padovi ostaju. Browser assertion sada koristi `useInnerText: true` da poredi
istu DOM reprezentaciju; ne menja očekivani rezultat. Konačni test koristi stvarni
spy receiver uz `toBeInstanceOf(GameSession)` i type assertion jer Vitest briše tip
receiver-a; to nije validacija nepoverljivog ulaza. Privremeni typed-this wrapper
prošao je typecheck ali pao lint i uklonjen je. Nije menjana aplikaciona kontrola
niti oslabljen poker oracle. [Diff check](005-phase3-diff-check.txt): exit 0;
Git CRLF upozorenja nisu whitespace greške.

## Promene i granice

Tri nova test fajla: HTTP, schemas i browser state; proširen security-tools.
Dokumentacija: ovaj handoff/izlazi, EVIDENCE_W08, CONTEXT_MANIFEST, AI_USAGE_LOG i
tasks status. Backend/frontend/shared/package/lockfile i stari dokazi nisu menjani.
T008–T012 su regresioni PASS→PASS, bez pronađene nove runtime rupe.

T13 ostaje RED: šest startova/12 provider/6 tool umesto 5/10/5; budući rate gate.
T16 ostaje RED: nedostaju produkciona zaglavlja/CSP. Nisu uklonjeni budući testovi.
Sentinel ovde dokazuje samo odbijanje extra tool polja pre drugog modela;
ne dokazuje server-secret/env, bundle/source maps, greške ili logging (T025/T026).
Malicious fake proposal dokazuje izvršnu politiku, ne live model injection otpornost.
SDK buffering, output token cap, novi gate i events ostaju budući taskovi.

Nema .env/pravih ključeva, novih servisa ili zavisnosti, živih Gemini poziva (0),
clean npm ci/audita/remote CI/demo-a. Puna browser suite nije pokrenuta; izvršeni
su novi state, recovery i postojeći production RED test. Ljudski review/doprinos
Milana nisu potvrđeni. Sledeći task **T013**, zatim T014; T013–T031 ostaju otvoreni.
