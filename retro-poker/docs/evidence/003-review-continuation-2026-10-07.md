# Nastavak mentorovog review-a — 2026-10-07

Pregledani HEAD: `116bac65e51536dd8c21fe282301d1a14a1db7e2`, grana
`fix/week05-review-improvements`. Početni radni direktorijum je čist.
Nastavak traži Veki; raniji commitovi predstavljaju preuzet rad kolege i Codexa.

## Šta je već urađeno

| Commit | Promena | Domet dokaza |
| --- | --- | --- |
| `9bb6af2` | Vitest zajednički limit do četiri worker-a | Tri lokalna puna prolaza 888/888; istorijski worker-start kvar nije reprodukovan, pa uzrok nije dokazan |
| `c6f2016` | Recovery test čeka potvrđenu backend mutaciju pre pomeranja browser sata | Novi slow-forward scenario reprodukuje trku; oracle i produkcioni timeout nisu oslabljeni |
| `0a2f0d2` | Završni recovery dokazi | Recovery 30/30, puna E2E suite 14/14 tri puta; rezultat je iz ranijih logova |
| `116bac6` | Windows/Linux clean CI workflow | Clean lokalni npm ci + 888/888 + 14/14; hosted rezultati provereni u nastavku ispod |

## Stvarni hosted CI rezultat

GitHub REST API je pročitan 2026-10-07. Oba run-a odnose se na HEAD `116bac6`:

- [Run 37573899485](https://github.com/milangavric2003/poker-app/actions/runs/37573899485)
- [Run 37573899420](https://github.com/milangavric2003/poker-app/actions/runs/37573899420)

Oba ukupna ishoda su `failure`. Windows job-ovi su `success`. U Ubuntu job-ovima
neuspešan je korak `Unit, contract, integration and UI tests`; `npm ci`, typecheck,
lint, build, cela Chromium E2E provera i upload reporta su uspešni.
Ovo potvrđuje hosted E2E prolaz na oba OS-a, ali ne zatvara punu Linux proveru.

Javna anotacija Ubuntu job-a `112638388779` daje samo `Process completed with exit
code 1`. Neautentifikovano preuzimanje detaljnog loga vraća HTTP 403. Uzrok pada
još nije utvrđen; iz samog exit koda ne može se zaključiti da je worker timeout.
Tražen je izlaz neuspešnog koraka od korisnika. Bez detaljnog loga nema opravdanja
za promenu timeout-a, preskakanje testa ili proizvoljnu Linux korekciju.

## Nova lokalna provera

Iz `retro-poker/` pokrenuto `npm.cmd test -- --reporter=verbose`:
61 fajl, 888/888 testova, exit 0, trajanje 26.35 s. Ovaj run nije clean instalacija
niti Linux reprodukcija. Nema novih E2E ili live run-ova u ovom nastavku.

## Retry/fallback i live dokaz

Postojeća `tests/integration/agent-run.test.ts` provera pokriva:

- 429 → ponavljanje na istom modelu, zatim 5xx → konfigurisan fallback;
- uspeh sa dva koraka, jednim alatom i ukupno četiri pokušaja;
- odbijanje petog pokušaja i prekid pri iscrpljenom budžetu;
- zajednički deadline kroz timeout, retry, alat i drugi modelski korak;
- backoff koji potroši preostali rok i ignorisanje kasnog odgovora.

Ti testovi prošli su u navedenoj novoj punoj lokalnoj proveri. Koriste fake
provider/sat: potvrđuju kontrolni tok aplikacije, ne dostupnost stvarnog servisa.
T035 ostaje zaseban live uzorak: 24 run-a, 48 zahteva, završni retest 9/9,
bez retry/fallback događaja. Ne predstavlja dokaz produkcijske dostupnosti.

Korisnik je zatim odobrio najviše dva pojedinačna API zahteva. Izvršen je jedan
uspešan live run opisan ispod i budžet je potrošen. Eventualna injekcija greške uz pravi model mora biti
označena kao kontrolisana simulacija, a ne kao prirodno opažen ispad provajdera.

### Odobreni live run — 2/2 zahteva

Posle uspešnog `npm.cmd run build` (exit 0) iz `retro-poker/` pokrenuto:

```powershell
node --env-file-if-exists=.env dist/server/scripts/gemini-coach-live-smoke.js --live --scenario=long-match --focus=street
```

Exit 0; model `gemini-3.5-flash-lite`; runId
`4f7377b4-191e-488d-8abe-1a82bfb773ac`. `passed=true`, status/stopReason
`completed`, finalValidated=true. Sintetički long-match fixture potvrđen;
12 dostupnih odluka, alat izabrao 5, final sadrži 5 dokaza. Dva modelska koraka,
tačno dva provider zahteva, jedan alat, 5 validacija i 0 odbijanja.
Read-only snapshot očuvan. Trajanje runner-a 2554 ms, run-a 2457 ms;
pojedinačni pozivi 1096 ms i 1351 ms. Prompt tokeni 76+1384=1460,
candidate 25+147=172, total 101+1531=1632. Cena, thought/cache usage nepoznati.
Retry 0, fallback 0. Runner ima nezavisan dispatch cap 2, jedan pokušaj po koraku,
bez fallback-a; SDK retry je isključen. Budžet ne dopušta dodatno pokretanje.

Ovo je dodatni uspešan live primer, ne live dokaz ponašanja pri retry/fallback-u
ili produkcijske dostupnosti. Nisu menjani produkcioni kod niti aktivna partija.

## Preostalo

### T039 — dostavljeni Linux log i lokalna popravka

Korisnik je dostavio ceo Vitest izlaz: 884 prolaza i četiri pada, bez worker-start
greške. Sva četiri su u `ai-failures.test.ts` (timeout/429/5xx/network): helper
`settled` iscrpljuje 100 GET/pauza od 1 ms za 161–207 ms, dok retry backoff
podrazumevano čeka 250 ms. Broj realnih timer iteracija nije pouzdan rok čekanja.

U test se ubrizgava postojeći FakeClock po Fastify instanci. Kontrolisana
reprodukcija sa tim satom i neizmenjenim helper-om daje četiri ista pada:
`npm.cmd test -- tests/integration/ai-failures.test.ts -t 'failure has the expected bounded chain'`,
exit 1, 4 failed/5 passed/4 neizabrana testa. Ovo je deterministički dokaz
zavisnosti helper-a od prolaska vremena, ne nova native Linux reprodukcija.
Helper zatim pomera samo AI sat u koracima od 10 ms uz yield kroz setImmediate.
Ista promena uklanja realne pauze iz dve provere retrying/model_fallback statusa;
dodat je eksplicitan assertion da su stigla tačno dva poziva.

`npm.cmd test -- tests/integration/ai-failures.test.ts`: 13/13, exit 0, 1.14 s.
`npm.cmd test`: 888/888 u 61 fajlu, exit 0, 25.01 s.
`npm.cmd run typecheck` i `npm.cmd run lint`: exit 0.
Nema promena produkcionog ponašanja, test timeout-a, preskakanja ili retry maskiranja.
Browser E2E nije lokalno ponavljan za ovu izmenu Node testa; novi CI proverava ceo paket.

1. Linux log je primljen; lokalna T039 popravka i provere završene.
2. Posle provere popravke potvrditi novi hosted Windows/Linux full-suite run za
   tačan commit; lokalni zeleni rezultat ne zamenjuje taj uslov.
3. Dodatni live uzorak je izvršen u odobrenom budžetu. Zadržati eksplicitno
   ograničenje da produkcijska dostupnost i live retry/fallback nisu dokazani.

Podeljeni ChatGPT link nije bio dostupan (`Cache miss`). Korisnik je naknadno
dostavio lokalni HTML izvoz razgovora „Predloži poboljšanja za week05“, koji je
pročitan 2026-10-07. On potvrđuje pet dogovorenih prioriteta: Vitest, recovery E2E,
clean CI, usklađivanje dokumentacije i mali eval kvaliteta saveta (6–9 scenarija).
Kolega je izričito odobrio commit/push T038; rad je prekinut pri pokušaju čitanja
neuspešnog Linux loga. Izvoz ne sadrži konkretan FAIL/stack trace tog pada.
Poslednja poruka beleži lokalni pomoćni `.verification/read-ci-log.mjs`, koji nije
prisutan u ovom checkout-u. Tačke 4 i 5 nisu završene tim razgovorom.
HTML i prateći web resursi su korisnički ulaz; nisu dodati u projektne commitove.
