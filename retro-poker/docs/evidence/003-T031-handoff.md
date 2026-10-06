# T031 — validirani live #2 uspešan, ljudski T027 otvoren

Datum: 2026-10-05 Europe/Belgrade; grana `week05/implementation`.
Polazni čist HEAD `bdf33c3f132b0d2003e9eddf26778fcb74db2f6a` sadrži T030 paket.
Jedan coding agent. Korisnik traži pitanje i redni broj pre SVAKOG live run-a;
T027 doprinos/walkthrough ostaju izričito odloženi.

[Runner](../../scripts/coach-smoke.ts) dobija `--scenario=street-review`:
call/check/check/all_in kroz produkcione action rute, četiri stvarne ljudske odluke
na preflop/flop/turn/river. Isti fixed deck/random, bez promene engine-a ili adaptera.
Dealing kreće nakon button seat0: bot AA, čovek KK; board ne menja prednost para.
Pre bilo kog provider poziva proverava se terminal lost, čovek0/bot2000.
Default `single-all-in` ostaje. Unknown/empty/duplicate scenario flag odbija se
pre konfiguracije. Model može legalnim limit-om izabrati manji uzorak.

Report dodaje scenario, fixtureVerified, available/tool decision count i projekciju
stroge CoachModelStepSchema: kind, samo refusal enum ili completed/evidenceCount.
Raw tekst, kandidat, karte i finding se ne čuvaju. Originalni kandidat se prosleđuje
orchestrator-u; metadata ne zamenjuje final membership proveru.
Najviše jedan run/dva provider poziva/jedan alat, retry0/fallback0, 15s/45s.

[Baseline106/106](003-T031-prerequisites.txt); [prvi RED](003-T031-red.txt),
[korigovana tabela i RED9FAIL/15PASS](003-T031-red-final.txt).
[Prvi GREEN pokušaj](003-T031-green.txt) otkrio pogrešno očekivanog pobednika.
Spec/plan/tasks i oracle ispravljeni prema dealing ugovoru; deck nije menjan.
[GREEN24/24](003-T031-green-final.txt), [puna827/827regresija](003-T031-tests.txt),
[ChromiumE2E4/4](003-T031-e2e.txt), [typecheck0](003-T031-typecheck.txt),
[lint0](003-T031-lint.txt), [build0](003-T031-build.txt),
[kompajlirani CLI opt-in gate0calls/exit0](003-T031-optin.txt).
Testovi su FakeAiProvider; broj testova nije broj live run-ova.

Postavljeno pitanje za Week05 run #2 ovog razgovora: street-review, najviše dva
Gemini poziva i jedan read-only alat. Odgovor je obavezan pre dispatch-a;
Korisnik odgovorio „Odobravam live run #2“ pre dispatch-a.
Raniji #1 je [T030 stop](003-T030-live.txt). T031 je zatvoren stvarnim
[completed dokazom](003-T031-live-02.txt): Gemini3.5FlashLite,
runId3c613f27-4d49-4bb1-90e2-f0bb92a0f795, 2steps/2calls/1tool,
4 dostupne/tool odluke, 4 evidence reference, finalValidated/readOnly=true,
validation5/rejected0, retry/fallback0, exit0.
Runner3254ms/run3182ms; step1 1169ms, step2 2007ms.
Prompt1010/candidate476/total1486tokena; thought/cached/cenaunknown.
Potvrđeni zbir ovog razgovora: 2run-a/4provider calls/2tools/1950total tokena,
jedan stop i jedan validirani final. Ukupni zbir drugih sesija i coding tokeni/cena unknown.
Nema #3; success ne dokazuje optimalnost preporuke ili dostupnost narednih poziva.

Izvršena komanda iz `retro-poker/`, posle zelenog build-a:

```powershell
node --env-file-if-exists=.env dist/server/scripts/gemini-coach-live-smoke.js --live --scenario=street-review
```

Zabeležiti stvarni rezultat bez raw sadržaja. Eventualni #3 zahteva novo pitanje;
ne ponavljati samo radi zelenog demo-a i ne slabiti validator. T027 ostaje otvoren.
Nisu ponavljeni npmci/puni13E2E/screen reader/axe/drugi browser/ljudski walkthrough;
nema našeg commit/push/deploy-a. Build/cache i screenshot baseline nisu menjani u diff-u.
[Audit](003-T031-audit.txt) proverava lokalne linkove, scope/status i whitespace.
