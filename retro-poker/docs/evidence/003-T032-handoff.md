# T032 — coaching poruka i objašnjenja ciljeva

Datum:2026-10-05 Europe/Belgrade; čist polazni HEAD2496770, week05/implementation.
Korisnik traži razlog screenshot greške, popravku i razliku tri coaching cilja.
Jedan agent, projektni speckit-implement; prerequisitefeature003exit0,
requirements12/12 read-only, extensions.yml absent. Nema novih live poziva.

Screenshot prikazuje malformed_output i dupli failure tekst. CoachPanel je isti
tekst prikazivao u status i alert paragraph-u. Sada postoji jedan live region,
alert za retry/failure i status inače, uz odgovarajući aria-live.
Safe failureCategory prevodi se u jasnu poruku: neispravna struktura/granice ili
reference/činjenice koje se ne poklapaju. Opis selekcije, povezan aria-describedby,
objašnjava postojeće tool filtere betting/street/showdown bez promene payload-a.

Read-only komanda (bez modela): Invoke-RestMethod http://127.0.0.1:3001/api/ai/usage.
Coach snapshot ima10run-a/20steps/20attempts/10tools,3completed/7malformed_output.
Step1:10success; step2:6malformed/4success; validationRejectedCount1.
Po kodu adapter/orchestrator-a:6strict parse/schema failure,1final evidence rejection.
Ovo je zbir tekućeg server procesa, ne identitet screenshot run-a ili novi agent
live budžet. Raw odgovori nisu dostupni i nisu čitani; tačno neispravno polje nije
dokazano. Korisniku zatražen samo runId/failureCategory/step/attempt iz već postojećeg
GET odgovora, bez retry-ja. Jedan T031 uspeh nije dokaz opšte live pouzdanosti.

Spec/plan/task/GAME_SPEC usklađeni pre koda.
[RED6FAIL/13PASS](003-T032-red.txt), [prviGREEN44/47](003-T032-green-initial.txt)
zbog lifecycle locator-a koji je tražio uklonjeni redundantni status.
Locator izmenjen prema novoj spec uz jači terminal text i očuvani stop-polling oracle.
[Završni47/47](003-T032-green-final.txt), [Chromium coach3/3](003-T032-e2e.txt),
[typecheck0](003-T032-typecheck.txt), [lint0](003-T032-lint.txt), [build0](003-T032-build.txt).
Ovaj UX slice ne popravlja model generation; validator/adapter/retry/engine ne menjaju se.
Puna827suite nije ponavljana; ciljane UI/API/lifecycle i browser provere jesu.
Nema raw prompta/odgovora/exception-a/.env sadržaja u dokazu, nema našeg
commit/push/deploy-a. T027 ostaje korisnički odložen. Checklist nije menjan.
Prvi dokumentacioni patch odbijen na netačnom kontekstu pre izmene; ispravljen.
RG PowerShell glob prosleđen kao argument nije validan; ponovljen sa -g coach*.
Provere novih lokalnih evidence linkova i diff-a: [audit](003-T032-audit.txt).

Port incident: korisnik prijavio da zbog naših testova ne može pregledati svoj GET.
Coach E2E helper koristi5173 strictPort i ephemeral backend (ne3001); testovi su
zatvoreni u finally. netstat potom pokazuje samoTIME_WAIT, bez LISTENING na5173/3001;
HTTP oba nedostupna. Nije ubijen nijedan proces. Pokrenut npm.cmd run dev,
session37878; frontendHTTP200, backendGETreachable=true/hasGame=false.
Backend sada nema staru memorijsku partiju/run; tačan screenshotfailure nije dostupan.
Izvinjenje korisniku i vraćena normalna aplikacija; ne ponavljati testove na5173 dok
korisnik radi u aplikaciji. Nisu izvršeni POST/game ili coaching/retry/live zahtevi.
