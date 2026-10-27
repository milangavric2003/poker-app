# Milan — završna tehnička dorada Week08

2026-10-27, Europe/Belgrade. Osnova `07db76bd2df44508d0d6ac626ba20a300c5d0470`,
grana `fix/week08-finalization`. Jedan coding agent, Codex u Milanovoj sesiji,
po njegovom zahtevu za nastavak, novu granu, pregled i ispravke.

T032/T033 tehnički završeni. **T030 i zavisni T031 ostaju otvoreni:**
uputstvo nije ljudski review, samostalni test ili izveden demo.
Ovaj T032/T033 checkpoint je nastao bez commit-a/push-a/merge-a, promene poker
pravila ili live poziva. Naknadni odobreni commit i T034 imaju
[zaseban nastavak](005-milan-csp-handoff.md).
Model sesije prema metapodacima: gpt-6.1-sol; tokeni i trošak nisu dostupni.

## Reprodukovan problem i popravka

Game polling je slao GET svakih 750 ms i svaki put povećavao snapshot token.
Za ispravne odgovore od 1200 ms sledeći tick poništava prethodni odgovor:
bot/analysis završetak ne stiže u UI iako backend ima terminalno stanje.
Ovo nije potvrda da je to jedini uzrok korisnikovog ranijeg opažanja,
niti je merena latencija pravog providera.

`frontend/src/App.tsx` sada preskače tick dok jedan GET traje. `finally`
oslobađa lokalnu zastavicu i pri grešci. Interval, request/identity/version
guard-ovi, serverski budžeti i provider konfiguracija ostaju isti.

[Očekivanja pre koda](005-milan-expectations.md).
Prvi test setup koristio je nescope-ovan `getByRole('status')` u UI-ju sa više
statusa; [prvi izlaz](005-milan-polling-first.txt) nije čist RED dokaz.
Posle ispravke query-ja, pre produkcione promene:
[2 FAIL / 1 PASS](005-milan-polling-red.txt), baš nedostajući bot/analysis završetak.
Isti testovi plus postojeći lifecycle holdout-i:
[53/53 PASS](005-milan-polling-green.txt), bez slabljenja očekivanja.

## Ručni profil

`npm.cmd run demo:security` pokreće `tests/helpers/security-demo.ts`.
Stvarni production preview/build/API/alat, sintetički podaci, constructor-only
fake za bot/analysis/coach, 150 ms kontrolisani fake poziv i stvarni sat.
Nema `.env` loader-a, model mreže, debug ruta ili izmena normalnog server ulaza.
[Ručni koraci](005-milan-manual.md). Lično objašnjenje postoji i u lokalnom,
Git-ignorisanom `milan/week08-maxSteps-uputstvo.md`; nije potrebno za npm/CI.

`maxSteps:999` je nedozvoljeno HTTP polje: 400 dokazuje strict konfiguracionu
granicu, ne samo po sebi izvršno brojanje koraka. Poseban budget suite čuva taj dokaz.
Tačan JavaScript iz ličnog uputstva izvršen je kroz Chromium:
400/INVALID_INPUT, gameUnchanged/usageUnchanged true; normalan UI coaching
zatim završava sa 2 steps/2 attempts/1 real tool i identičnim poker stanjem.
Nezavisan browser/API holdout odlaže GET za 1200 ms: terminalni fake bot rezultat
postaje vidljiv, max istovremenih browser GET-ova je 1. Prošli i regeneracija
analize, nova partija sa pet botova i mobile bez overflow-a.
[Stvarni rezultat](005-milan-demo-check.json).

Probe runner `.verification/week08-demo-check.mjs` je lokalna pomoć, nije deo
isporuke ili clean CI dokaz. Prvi pokušaj probe vratio je undefined zbog
nepozvanog async izraza u verifier-u; proba ispravljena bez izmene aplikacije.

## Stvarne provere

Node 24.20.0, npm 11.19.0, Chromium. Komande iz `retro-poker/`, exit 0:

| Provera | Rezultat |
|---|---|
| `npm.cmd run test:security` pre promene | [123/123](005-milan-security-baseline.txt) |
| Fokusirani polling + AI/analysis/coach UI lifecycle | [53/53](005-milan-polling-green.txt) |
| `npm.cmd test` posle promene | [1040/1040, 74 fajla](005-milan-full-tests.txt), uključuje security |
| `npm.cmd run typecheck` | [exit 0](005-milan-typecheck.txt) |
| `npm.cmd run lint` | [exit 0](005-milan-lint.txt), ponovljen posle finalnog helper-a |
| `npm.cmd run test:e2e -- --reporter=list` | [build + 26/26](005-milan-e2e.txt), uključuje svih 5 security browser scenarija |
| `npm.cmd run demo:security` | [build/start](005-milan-demo-start.txt), Chromium proba, zatim ugašeno |
| `git diff --check` i relativni linkovi | [provera](005-milan-document-check.json) |

Prvi typecheck: [pogrešan import systemClock](005-milan-typecheck-first.txt),
ispravljeno na `ai/coordinator.ts`, zatim PASS. Prvi demo start u Windows
sandbox-u pao je u tsx `os.userInfo`/`uv_os_get_passwd ENOMEM` pre koda.
Ista npm komanda van sandbox-a radi; nije menjana aplikacija radi ovog kvara.
Demo ugašen Ctrl+C i potvrdom npm batch-a; portovi su posle probe slobodni.

E2E je regenerisao 14 istorijskih screenshotova. Vraćeni iz prethodne lokalne
kopije; svih 21 praćenih PNG/JPG fajlova provereno hash-em, nema slikovnog diff-a.
Nije ponavljan clean npm ci/audit u ovoj sesiji: T029/T027 i remote baseline
ostaju prethodni dokazi. Nema novih verzija zavisnosti ili lockfile promene.

## GitHub i nastavak

REST API 2026-10-27 potvrđuje postojeći
[run 40409602714](https://github.com/milangavric2003/poker-app/actions/runs/40409602714)
za tačan baseline SHA `07db76b`: svi Windows/Linux koraci success.
[Sažetak poslova](005-milan-remote-ci.json). To nije CI lokalnih T032/T033 izmena.
PR #11 ostaje Week08 putanja ka main-u. Review grana nema novu produkcionu
popravku brzine; njene izvršne test/CI promene prenete su kroz T002.

Sledeće: Milan prati lično uputstvo i pošalje stvarne ishode. Oba člana dopune
kontrolne/negativne doprinose, review, demo i individualni deo. Zatim zatvoriti
T030/T031, sačuvati konačan commit, proveriti CI tog SHA i završiti PR #11.
