# AU1 — zajednička AI usage analitika, 2026-10-14

## Baseline i nalaz

Git grana `add-modifications`, HEAD `f900fa260bb777e9fb87d6d601601f1f35e12e74`
(`summary refresh modified`). Git koren: `D:/AIBootcamp/week3-4`, projektni koren:
`retro-poker`. Jedina početna necommitovana izmena: roditeljski `.gitignore`,
dodat ignorisan HTML fajl; ostala netaknuta. HEAD je ponovljiv baseline koda.
Prethodna SR1 faza proverena komandom:

```text
npm.cmd test -- tests/ui/analysis-lifecycle.test.tsx tests/ui/analysis.test.tsx tests/integration/ai-analysis.test.ts tests/ui/dashboard.test.tsx tests/unit/ai-usage.test.ts tests/unit/coach-usage.test.ts tests/integration/coach-lifecycle.test.ts
```

Rezultat: exit 0, 65/65 testova, 7 fajlova. Ponovno generisanje, dupli pending
zahtev, stari odgovor i unmount pokriveni. Konkretna SR1 regresija nije pronađena.
Spec Kit prerequisites pokrenut preko `powershell -ExecutionPolicy Bypass -File`
jer host blokira `.ps1`; npm koristi `npm.cmd` iz istog razloga. Skripta je rešila
postojeći lokalni feature context na 002; AU1 je eksplicitno dopunjen u 003 uz
pregled relevantnih 002 dokumenata. Checklists: 002 26/26; 003 12/12, nula otvorenih
stavki. `.specify/extensions.yml` ne postoji; nema pre/post hook-ova.

| UI tok | Backend | Postojeći usage |
|---|---|---|
| AI analiza partije / Sažetak („summary”) | POST /api/game/analysis | logical/attempts, purpose analysis |
| Coaching partije / Coaching sažetak | POST /api/game/coach | coach.runCount / stepCount / attempts / tools |
| AI bot odluke | postojeća session bot koordinacija | logical/attempts, purpose bot |

`session.runAnalysis` već poziva `recordUsageOnce`; svako eksplicitno ponovno
generisanje ima nov interaction ID. `session` već beleži terminalni coach preko
`UsageStore.recordCoach`, jednom po run ID/epohi. GET `/api/ai/usage` već vraća
oba skupa; `frontend/src/api.ts` ih runtime validira postojećom strict šemom.
Nisu nedostajali backend podaci ili API polja: dashboard je čitao samo Week04
logical/attempts i zato ignorisao coaching, uključujući coach-only empty state.

## Promena i semantika

Samo UI izvodi zajedničku projekciju disjunktnih postojećih agregata. Ukupno
pokretanja = Week04 logical count + coach.runCount; provider pokušaji, greške,
latencija i tokeni sabiraju Week04 attempts i coach.attempts jednom. Coach stop
razlozi daju completed i neuspešna/nepotpuna pokretanja. Lokalni bot fallback
prikazan je zasebno. Uspešno generisanje i uspešan provider pokušaj imaju odvojene
brojače. Coach modelski koraci, alati i ukupna run latencija ostaju zasebni.

Week04 istorijski `retryCount` broji interakcije sa >1 pokušajem, uključujući
model fallback; coach retryCount broji same-model retry pokušaje. UI ih zato
prikazuje odvojeno i objašnjava jedinice. Dodatno prikazuje stvarne provider
pokušaje po relation (`same_model_retry` / `model_fallback`), iz postojećih redova.
Nepoznati tokeni/cena ostaju „Nepoznato”, delimični tokeni „delimično”. Nema
procene cena, novog storage-a, backend brojača ili promene ugovora.

Postojeći polling od 1 s sada osvežava i coaching nakon terminalnog uspeha ili
neuspeha, bez page reload-a. Request token/reset epoha ostaju postojeći autoriteti.
GET/polling/reopening ne upisuju metrike. DTO bez coach polja ostaje podržan.
Prikazuju se samo sanitizovani agregati; raw model/tool sadržaj i tajne ne ulaze.

## TDD i provere

- RED: `004-AU1-red.txt`: exit 1, dva očekivana UI pada (coach-only prazan
  dashboard i mešani total 7 umesto 9), 12 testova prolazi. Reset test već prolazi
  kroz postojeću zaštitu; nije predstavljen kao nedostajuće ponašanje.
- GREEN: `004-AU1-green.txt` i `004-AU1-green-final.txt`: 14/14 dashboard testova,
  exit 0. Testovi pokrivaju 1 run/2 model koraka/2 attempts/1 tool; mešane bot,
  analysis i coach zbirne brojače, neuspeh, recovery, missing/partial usage,
  polling i kasni pre-reset odgovor.
- Fake session/API: 30/30 analysis/coach lifecycle testova, exit 0. Prošireni
  oracle-i potvrđuju summary+regeneration = 2 interakcije/2 pokušaja; coaching
  regeneration = 2 run-a/4 koraka/4 pokušaja/2 alata; neuspeh+ručni retry, više
  GET zahteva bez upisa; usage reset pre kasnog summary odgovora.
- `npm.cmd test`: 902/902 testova, 62 fajla, exit 0 (`004-AU1-regression.txt`
  i ponovljena završna provera `004-AU1-regression-final.txt`).
  Postojeći fake unit coach testovi pokrivaju 429 retry i 5xx fallback kao 1 run,
  2 koraka, 3 pokušaja i 1 alat; bot regresija ostaje zelena.
- `npm.cmd run test:e2e -- tests/e2e/ai-offline.spec.ts tests/e2e/coach.spec.ts`:
  4/4, exit 0 (`004-AU1-e2e-final.txt`). Browser coach-only panel je otvoren dok
  provider čeka; posle završetka vidi 1/2/2/1 bez reload-a. Summary test potvrđuje
  failure/retry/regeneration i samo jednu navigaciju.
- Typecheck, lint i build: exit 0, uključujući ponovljene završne provere;
  odgovarajući `004-AU1-*-final.txt` logovi. `git diff --check`: exit 0.
- Node v24.20.0, npm 11.19.0. Nijedan stvarni Gemini poziv nije pokrenut.

Codex je napisao dokumentaciju, testove i UI izmenu; ljudski review/doprinos u
ovoj sesiji nije potvrđen. Izmene ostavljene za pregled, bez commit/push/merge.
Cela E2E suite nije pokrenuta; pokrenuta su četiri relevantna fake scenarija.
Cena ostaje nepoznata; provider usage koji nije vraćen ne može se naknadno utvrditi.
