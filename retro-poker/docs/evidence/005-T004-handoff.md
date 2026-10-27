# T004 — provera osnove i početni prompt

Datum: 2026-10-26 (Europe/Belgrade). Status: završeno.
Driver: Codex u sesiji sa Vekijem; Milanov review nije potvrđen.
Početni commit: `0d361f1ce4429dbf9cd64f1adcf9dbd78c9f8874`, grana `week08-init`,
početno radno stablo čisto. Korisnik je commitovao raniju pripremu;
istorijski zapis o tada necommitovanoj osnovi ostaje sačuvan.

## Očekivanje i pregled T001–T003

Pre novih security izmena očekujemo iste runtime fajlove i lockfile kao u
proverenoj osnovi, prisutne review popravke i funkcionalan fake coaching.
Nema potrebe za novim RED testom: T004 dodaje dokumentaciju, ne ponašanje.

- T001: pročitani AGENTS, constitution v1.1.0, GAME_SPEC W08 granice, feature
  spec/plan/tasks/data-model/contracts/research/quickstart i evidence osnove.
  Spec Kit prerequisites razrešava feature 005; requirements checklist 9/9,
  nula otvorenih stavki (read-only pregled, bez menjanja checkliste).
  `extensions.yml` ne postoji; nema pre/post hook-ova. Ignore/ESLint pravila
  pokrivaju postojeće dependency/build/test artefakte; izmene nisu potrebne.
- T002: svih pet hash-eva prenetih fajlova odgovara snapshot-u. Pregledan
  maxWorkers ≤4, fake-clock polling i backend-commit→browser-time recovery redosled.
  Workflow je prisutan kao isti fajl; nije izvršen novi GitHub CI.
- T003: pregledani prethodni logovi/results, 906 testova/20 E2E i typecheck/lint/build
  ostaju istorijski rezultat od 25.10.2026. Lockfile hash se poklapa; Git diff od
  originalnog `96fb971` do aktuelnog HEAD-a za backend/frontend/shared/package/lock
  je prazan. Ponovljene su samo relevantne provere navedene ispod.

Dokaz identiteta osnove: [preflight JSON](005-T004-preflight.json).

## Stvarne komande i rezultati

Sve npm komande pokrenute iz `retro-poker/`.

| Provera | Rezultat | Izlaz |
|---|---|---|
| `check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` sa feature 005 env-om | exit 0, feature pravilno razrešen | Zabeleženo u sesiji |
| `npm.cmd test -- tests/integration/ai-failures.test.ts tests/integration/gemini-live-smoke.test.ts tests/integration/coach-lifecycle.test.ts tests/contract/coach-routes.test.ts` | 4 fajla, 57/57 PASS, exit 0 | [testovi](005-T004-tests.txt) |
| `npm.cmd run test:e2e -- tests/e2e/recovery.spec.ts` | 6/6 PASS, exit 0 | [recovery](005-T004-recovery.txt) |

`gemini-live-smoke.test.ts` koristi offline HTTP stub; naziv ne znači da je
pokrenut live runner prema pravom servisu. Coach lifecycle provera potvrđuje
2 koraka/2 pokušaja/1 stvarni alat, validan final i nepromenjen poker snapshot.
E2E obuhvata i slow-forward varijantu, bez ponavljanja akcijskog POST-a.

Dokumentaciona završna provera: [validation JSON](005-T004-validation.json),
linkovi, I1–I8, task status i diff/whitespace. Nisu ponavljani puna suite,
typecheck/lint/build: runtime, testovi i konfiguracija nisu menjani u T004.
Clean npm ci, audit, remote CI i ljudski demo/review nisu izvršeni.

## Isporuka i sledeći korak

Sačuvan [BUILD_PROMPT_WEEK08_V1.md](../BUILD_PROMPT_WEEK08_V1.md): uloga/cilj,
scope, izvori, I1–I8, test-first i pre-phase gate, dozvoljene putanje, komande,
DoD, ownership/handoff i postupanje sa nejasnoćama. Prompt jasno razlikuje
fokusirani task blok od kompletnog Week08 cilja; ne pokreće budući rad samim čuvanjem.
T004 čekiran, evidence/manifest/AI log ažurirani. Nema novog commit/push/merge-a.
Novi live Gemini pozivi: 0. Bez izmena app/test/config fajlova ili ranijih dokaza.

Sledeći task je **T005**, pa T006–T007. Pre hardening-a treba sačuvati tri početna
security scenarija; trenutni PASS rezultati ne zatvaraju W08 matricu T00–T17.
Nezavisni ljudski doprinosi i finalni CI ostaju otvoreni.
