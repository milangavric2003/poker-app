# Faza 4 — T013–T018

2026-10-26, Europe/Belgrade. Driver: Codex u sesiji sa Vekijem. Git koren
`D:/AIBootcamp/week3-4`, grana `week08-init`, početni HEAD
`cc0d3fb2390ad7e8ae7daf2f56c425bec556d946`, početno radno stablo čisto.
Checkpoint: taj HEAD + radni diff i novi fajlovi, bez commit/push/merge-a.
Sledeći task **T019**; Faza 5 nije implementirana.

## Prethodna faza i postupak

Pročitani projektni AGENTS/constitution, BUILD_PROMPT_WEEK08_V1, relevantni
GAME_SPEC ARCH/AC19/AC23/W05/W08 ugovori, feature005 spec/plan/tasks/research/
data-model/contracts/quickstart, EVIDENCE_W08, phase2/phase3 handoff i prvi dokazi,
security fixture/server/fake provider/sat i relevantni runtime/testovi.
Primenjen `.agents/skills/speckit-implement/SKILL.md`; prerequisite direktno
blokira PowerShell execution policy, dokumentovani poziv kroz
`powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`
sa `SPECIFY_FEATURE_DIRECTORY=specs/005-week08-secure-the-arcade` prolazi.
Checklist 9/9, nema extensions.yml ni pre/post hook-ova. Ignore/ESLint pokrivaju
artefakte. Plan unapred proširen samo za test setup, UI i postojeći coach E2E.

[Preflight](005-phase4-preflight.txt): 80 PASS, jedan poznati T13 FAIL, exit 1.
Provereni stvarni HTTP schema/body/media/origin/resource guard-ovi i
model/tool/canonical evidence/read-only putanja, bez otkrivenog propusta Faze 3.
T00 i pozitivne granice ostaju u završnim security/full proverama. CSP nije deo
node `test:security`; proverava se zasebnom production browser komandom.

## Taskovi i izvršna mesta

| Task | Actual / dokaz |
|---|---|
| T013 | Završen. Novi `security-budgets.test.ts`: ponavljanje odvojeno od promenjenog drugog tool zahteva, step/tool/total/per-step attempts, retry i fallback sa tačnim ordinalima 1–4; nijedan dodatni poziv. Fake sat: 14999/15000 call, 999/1000 tool, zbir 3 kratka poziva + backoff do 45000 bez sledećeg pokušaja, kompletan tok uspešan na 44999 i odbijen na 45000. Kasni resolve/reject i abort bez ponovnog terminala. Četiri mock SDK pokušaja oba coaching koraka zahtevaju 4096 tokena/SDK attempts=1. |
| T014 | Završen. Budžeti već ispravni, PASS→PASS bez izmene orchestrator/types. Adapter dobio jednu serversku `maxOutputTokens: 4096` konfiguraciju; četiri početna RED testa postaju GREEN. Nema novog modela/providera. |
| T015 | Završen. Stvarni [admission RED](005-phase4-admission-red.txt) pre implementacije: 4 neuspešna testa, uključujući originalni T13. Naknadne pozitivne/regresione provere obuhvataju globalne konkurentne session startove, aktivan bot, coach+analysis, bot fallback, timeout sa dva neotkaziva pokušaja, dedupe/conflict, invalid zahtev, neuspele prihvaćene startove, capacity/rate odbijanja, klizni prozor 59999/60000, new-game/usage reset i oporavak. Unit lease testovi proveravaju rezervaciju, sync throw, reject, dvostruko release i zabranu reuse-a. |
| T016 | Završen. `security/admission.ts` + `capacity.ts`, session, rute, shared error ugovor, API/App prikaz. Gate je procesni, atomski i bez waiting queue-a: 5 novih coach/analysis startova/60000 ms i najviše 2 rezervisana ili stvarno aktivna provider posla. Dedupe/validacija prethode admission-u. HTTP 429 sa stabilnim kodovima; samo rate ima stvarni Retry-After. Bot bez mesta koristi postojeći legalni lokalni fallback. Provider/alat se ne čeka pod game mutation lock-om. UI 4 RED→GREEN testa, očuvan summary/game i ručni retry; stvaran browser potvrđuje rate putanju. |
| T017 | Završen. Novi `security-lifecycle.test.ts`, obe late resolve/reject varijante prolaze kroz stvarni create + legalni all-in do terminalne nove partije, usage reset i novi coaching. Stari posao i dalje aktivan, maksimum overlap=2; treći start odbijen. Stari rezultat ne izvršava alat/ne menja novi poker/run/usage epoch; novi run ima jedan terminalni commit i jednu usage stavku. Posle settle lease se oporavlja, a otkazani stari start i dalje troši rate token. |
| T018 | Završen uslovni GREEN/regresija: nakon T016 nema potrebne dodatne runtime izmene. T17 i ranije lifecycle/usage/concurrency provere prolaze. Orchestrator i coordinator ostaju nepromenjeni; postojeći stale/epoch/terminal guard-ovi su dovoljni uz novi session-owned provider wrapper. |

Pojedinačni timeout i stale-state testovi sami ne prelaze istovremeno fizički
resursni i game/usage epoch prag. T17 spaja te granice i proverava maksimalni
overlap kroz ulazak i **stvarni izlazak** provider operacija, a ne DTO status.

## Vlasništvo i fizički rad

Session posle validacije/dedupe/no-evidence provere sinhrono rezerviše lease i
tek tada upisuje accepted timestamp. Nema await između odluke i rezervacije.
Session-owned wrapper prenosi prvu rezervaciju u prvi stvarni provider pokušaj;
svaki sledeći retry/korak neposredno rezerviše svoje mesto, bez drugog gate-a.
Nedostupan kapacitet na kasnijem pokušaju daje kontrolisan neuspeh bez dispatch-a.

Lease ima reserved→running→settled životni vek. `releaseUnused` oslobađa samo
reserved i idempotentan je. Wrapper `lease.run` drži originalni promise i oslobađa
running mesto u svom finally tek na njegov resolve/reject/sync throw.
Run timeout, abort i nova partija zato ne oslobađaju aktivan posao. Kasni settle
je obrađen kroz postojeći race i wrapper, bez unhandled rejection-a ili kasnog
commit-a. Neiskorišćena rezervacija se oslobađa i kada je dispatch otkazan;
poseban test ima 0 provider poziva i završni active=0.

Singleton-i su zajednički svim session-ima u procesu. Vitest beforeEach i coach
Playwright beforeEach kreiraju sveže testne procesne objekte; nijedna produkciona
game/reset ruta to ne radi. Stari lease u testu zatvara sopstveni raniji objekat.
Usage epoch je potpuno odvojen od admission prozora i kapaciteta.

## Sačuvani prvi rezultati

- [Budžeti/adapter prvi](005-phase4-budgets-first.txt): 4 stvarna FAIL za odsutan token cap; ostali budget slučajevi PASS.
- [Capacity setup](005-phase4-capacity-setup.txt): modul još ne postoji, nije security RED; stvarni prethodni admission RED je odvojen.
- [Admission prvi](005-phase4-admission-red.txt): 4 stvarna policy FAIL, nema gate-a.
- [UI prvi](005-phase4-ui-red.txt): 4 stvarna FAIL, nema razumljivog admission prikaza/očuvanja pri retry-u.
- [T17 prvi](005-phase4-lifecycle-first.txt): pogrešno ime usage assertion polja `runs`, nije security RED. Ispravljeno na postojeći `runCount`; [provera](005-phase4-lifecycle-verified.txt) 17 PASS. Očekivanje ostaje tačno jedna nova usage stavka.
- [Lint prvi](005-phase4-lint-first.txt): dve unused test promenljive, ispravljeno eksplicitnom identity projekcijom.
- [Browser prvi](005-phase4-browser-first.txt): novi rate test prolazi, sledeći test nasleđuje iscrpljen testni singleton. [Drugi](005-phase4-browser.txt): gate izolovan, usage baseline još nasleđen. Oba setup nalaza rešena testnim fresh-process beforeEach; produkcioni reset nije dodat. [Konačan](005-phase4-browser-verified.txt) 11 PASS.

Nijedan prvi izlaz niti Faza 2 ulaz nije prepisan. Početni budget test ukupnog
roka je dodatno preciziran da koristi pravi treći `retryAfterMs` argument i
proveri 44999 pre 45000; završne granice proverene su i zasebnim četvoropozivnim
pozitivnim/negativnim scenarijem.

## Komande i stvarni rezultati

Sve npm komande iz `retro-poker/`, Node 24/npm 11, fake-only. Tačne duže selekcije
nalaze se na početku odgovarajućeg izlaza.

| Komanda | Actual / exit | Izlaz |
|---|---|---|
| `npm.cmd run test:security` pre koda | 80 PASS / 1 T13 FAIL; 1 | [preflight](005-phase4-preflight.txt) |
| `npm.cmd test -- tests/integration/security-budgets.test.ts tests/integration/gemini-agent.test.ts tests/integration/security-normal.test.ts` | 53 PASS; 0 | [budget GREEN](005-phase4-budgets-green.txt) |
| Fokusirana budget/admission/capacity/lifecycle/adapter/T00/HTTP/tools/coach/analysis/failures/usage/UI selekcija | 212 PASS u 14 fajlova; 0 | [focused](005-phase4-focused.txt) |
| `npm.cmd test -- tests/integration/security-admission.test.ts` sa dodatnim aktivnim bot scenarijem | 8 PASS; 0 | [bot capacity](005-phase4-bot-capacity.txt) |
| `npm.cmd test -- tests/integration/security-admission.test.ts -t 'T13 initial' --reporter verbose` | 1 PASS; 0 (7 drugih neselektovano ovim filterom, svi prolaze u suite-u) | [isti ulaz](005-phase4-T13-same-input.txt) |
| `npm.cmd run test:security` konačan | 108 PASS u 8 fajlova; 0 | [security](005-phase4-security-verified.txt) |
| `npm.cmd test` konačan | 1022 PASS u 70 fajlova; 0 | [full](005-phase4-full-verified.txt) |
| `npm.cmd run test:e2e -- tests/e2e/coach.spec.ts tests/e2e/recovery.spec.ts tests/e2e/security-state.spec.ts` | 11 PASS; 0 | [browser](005-phase4-browser-verified.txt) |
| `npm.cmd run typecheck` | PASS; 0 | [typecheck](005-phase4-typecheck-verified.txt) |
| `npm.cmd run lint` | PASS; 0 | [lint](005-phase4-lint-verified.txt) |
| `npm.cmd run build` | PASS; 0 | [build](005-phase4-build-verified.txt) |
| `npm.cmd run test:e2e -- tests/e2e/security-production.spec.ts` | 1 očekivani T16 FAIL; 1 | [CSP](005-phase4-production.txt) |
| `git diff --check` | PASS; 0 (samo Git LF/CRLF upozorenja) | [diff](005-phase4-diff-check.txt) |

## Isto-ulazni T13 i ograničenja

Sačuvani `security-fixtures.ts` SHA256
`2e20777d443a9233633733ce55fd872ee42689bb0c183871efdb5a408087898b`
i `security-server.ts` SHA256
`fd5f917dd2c9f23bd8e6600208de8752906298645eae2be3b61dc7e202217537`
ostaju isti kao u [Fazi 2](005-phase2-fixtures.json).
Originalni T13 test ostao je neizmenjen, samo su ispred dodati novi testovi.
[Dokumentaciona provera](005-phase4-validation.json) poredi celo telo originalnog
testa sa HEAD-om, hash-eve fixture-a i lokalne handoff linkove. Postojeći coach
E2E je regenerisao dva istorijska feature004 screenshot-a; vraćeni su na početni
HEAD jer ne pripadaju ovom obuhvatu. Nije vraćen nijedan korisnički rad.
Git restore nije mogao da otvori read-only `.git/index.lock`; binarni sadržaj
ta dva generisana fajla vraćen je kroz read-only `git show HEAD:<path>` i lokalni
upis, bez izmene index-a. Završni diff za te slike je prazan.
Isti burst `[0,1000,2000,3000,4000,5000]` ms: pre 6 prihvaćenih/12 provider/6 tool,
posle statusi `[202,202,202,202,202,429]`, 5 prihvaćenih/10 provider/5 tool,
nepromenjena poker projekcija. [Actual JSON u izlazu](005-phase4-T13-same-input.txt).

T16 ostaje stvaran RED: kontrolni script dostupan, app marker executed=true bez
CSP-a. `test:security` zato sada prolazi, ali širi skup uključujući production
browser nije zelen. Nema skip-a/oslabljenog assertion-a; T019–T031 ostaju otvoreni.
Faze 5–7, events/sentinel/bundle/audit/clean install/remote CI/demo nisu izvršeni.

SDK baferuje odgovor pre aplikacione 32768-byte provere; 4096 tokena nije streaming
memory cap. Neotkaziv provider koji nikada ne settle-uje može zauzeti kapacitet
do restarta procesa. Abort ne garantuje prekid udaljenog rada ili naplate.
Fake testovi ne dokazuju live injection otpornost ili produkcijsku dostupnost.
Živi Gemini pozivi: 0; bez čitanja .env/pravih ključeva, novih zavisnosti/modela,
servisa ili debug endpoint-a. Ljudski peer review i Milanov doprinos nisu potvrđeni.
