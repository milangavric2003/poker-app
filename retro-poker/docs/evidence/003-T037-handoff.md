# T037 — recovery E2E sinhronizacija

Datum: 2026-10-07 (Europe/Belgrade). Scope: korisnikova tačka 2 na grani
`fix/week05-review-improvements`. Polazni commit `9bb6af2`; korisnik je tokom
rada ručno commitovao dotadašnje izmene kao `c6f2016`. Posle te potvrde nije
menjan test kod: dovršena je treća puna provera i završni dokazni paket.

## Nalaz i reprodukcija

Neizmenjeni puni E2E baseline prolazi 13/13. Bez izvornog neuspešnog trace-a
nezavisnog pregleda ne možemo dokazati da je njegov recovery pad imao isti uzrok.
Pronađen je i kontrolisano reprodukovan konkretan nedostatak postojećeg testa:
`page.clock.fastForward(11000)` se pozivao pre potvrde da je `route.fetch()`
prosledio i završio POST. Browser timeout i recovery GET mogli su preteći
backend mutaciju koju scenario pretpostavlja.

Novi `timeout-slow-forward` scenario dodaje 1 s kašnjenja samo u test route
handler-u pre prosleđivanja POST-a. To je simulacija sporog transporta ispod
produkcionog roka od 10 s, ne izmena aplikacije ili sleep za sinhronizaciju.
Sa starim redosledom isti oracle pada: očekuje se `2c3d7h`, dobija se
`Board čeka flop`. [RED log](003-T037-recovery-red.txt).

[Izvod iz RED trace-a](003-T037-red-trace-summary.txt) beleži recovery GET u
22:14:29.298Z, a prosleđeni POST tek u 22:14:30.258Z — 960 ms kasnije.
Vremena u trace-u su UTC; lokalni datum rada je 7. oktobar. Izvod sadrži samo
HTTP metodu, lokalnu putanju i vreme, bez tela zahteva/odgovora. Puni lokalni
trace-ovi ostaju pod ignorisanim `.verification/T037-*` direktorijumima.

## Promena i oracle

Jedina izmena izvršnog/test koda je `tests/e2e/recovery.spec.ts`:

- Browser clock se instalira pre navigacije i pauzira posle kreiranja partije.
  Tako realno čekanje backend-a ne troši simulirani rok browser zahteva.
- Test čeka HTTP 200 iz stvarnog `route.fetch()` i validira odgovor kroz
  `GameResponseSchema`; unapred zadat oracle je flop, board `2c/3d/7h`, pot 20.
- Tek zatim pomera browser vreme i zahteva poruku o isteklom vremenu.
- Stari UI pot 15 i blokirane akcije ostaju do eksplicitnog recovery GET-a.
  Posle njega moraju biti vidljivi flop i pot 20; dodatni GET potvrđuje da ceo
  javni backend snapshot odgovara potvrđenom POST odgovoru. Broj POST-ova je 1.
- Cleanup zatvara stranicu, čime oslobađa namerno neodgovorenu timeout rutu,
  pa zatvara servere u `finally` bloku.

Svi prethodni assertion-i ostaju. Novi scenario je šesti recovery test i
četrnaesti test pune E2E suite. Nema promene aplikacije, server helper-a, portova,
Origin zaštite, runner konfiguracije, timeout-a ili dependencies. Restart backend-a
je prošao u svih pet recovery ponavljanja i u sva tri završna puna run-a;
nije pronađen razlog za proširenje helper-a u ovom tasku.

## Stvarne provere

Windows x64, Node v24.20.0, npm 11.19.0, Playwright 1.63.0, Chromium, jedan worker.
Komande su pokretane iz `retro-poker/`, bez live providera. Svaki log beleži exit
status. E2E pokretanja nisu išla paralelno jedno s drugim, svi retries su 0.

| Provera | Rezultat | Dokaz |
|---|---|---|
| Puni baseline, `--retries=0 --trace=on` | 13/13, 31.7 s, exit 0 | [log](003-T037-e2e-baseline.txt) |
| Novi spori scenario pre sinhronizacije | 1 FAIL, pogrešan board, exit 1 | [RED](003-T037-recovery-red.txt) |
| Isti scenario posle popravke | 1/1, 5.4 s, exit 0 | [GREEN](003-T037-recovery-green.txt) |
| Recovery `--repeat-each=5 --retries=0` | 30/30, 52.4 s, exit 0 | [log](003-T037-recovery-repeat.txt) |
| Puni E2E run 1 | 14/14, 31.5 s, exit 0 | [log](003-T037-e2e-full-1.txt) |
| Puni E2E run 2 | 14/14, 31.7 s, exit 0 | [log](003-T037-e2e-full-2.txt) |
| Puni E2E run 3 | 14/14, 32.8 s, exit 0 | [log](003-T037-e2e-full-3.txt) |
| `npm.cmd test -- tests/ui/api.test.ts tests/ui/actions.test.tsx` | 12/12, exit 0 | [log](003-T037-ui-regression.txt) |
| `npm.cmd run typecheck` | exit 0 | [log](003-T037-typecheck.txt) |
| `npm.cmd run lint` | exit 0 | [log](003-T037-lint.txt) |

Dva neuspešna pokušaja između RED i konačnog GREEN su sačuvana:
[prvi](003-T037-recovery-green-initial.txt) je imao netačan novi assertion celog
alert teksta (App ponavlja instrukciju za učitavanje); sada se proverava specifična
timeout poruka. [Drugi](003-T037-recovery-cleanup-attempt.txt) prolazi assertion-e,
ali čeka na `unrouteAll({behavior:'wait'})` nad namerno pending rutom do timeout-a.
Zamenjen je zatvaranjem stranice. To su greške novog test setup-a, ne dodatni
pronađeni produkcioni bugovi. Izvornim assertion-ima nisu menjana očekivanja.

PowerShell je NO_COLOR/FORCE_COLOR upozorenje sa stderr-a prikazao kao
NativeCommandError zapis; stvarni exit status je naveden zasebno. Tekst logova je
očuvan uz uklanjanje završnih razmaka i normalizaciju encoding-a iz UTF-16 u
UTF-8 da bude čitljiv u Git diff-u.

## Ponovljivost, doprinos i ograničenja

Za ponavljanje: `npm.cmd run test:e2e -- tests/e2e/recovery.spec.ts --repeat-each=5 --retries=0`,
zatim `npm.cmd run test:e2e -- --retries=0`. Port 5173 mora biti slobodan.
Zatečeni portovi nisu bili zauzeti; nijedan korisnikov server nije ugašen.
Postojeći E2E testovi generišu dva istorijska screenshot fajla; korisnikov WIP
commit ih je uključio. Nisu predstavljeni kao novi cilj/screenshot dokaz T037.

Jedan coding agent napravio je reprodukciju, sinhronizaciju i izvršio navedene
provere. Korisnik je odredio scope i ručno commitovao WIP; to samo po sebi nije
tvrdnja o zasebnom ljudskom walkthrough-u ili review-u. Završni dokumenti i treći
log ostaju za korisnikov pregled; agent u ovom tasku nije radio commit/push.

Lokalni kriterijum tačke 2 je ispunjen. Nisu pokretani clean `npm ci`, CI, build,
nova puna Vitest suite ili live pozivi. Pošto se menja samo E2E test, relevantni
API/action UI testovi, typecheck/lint i puna browser regresija su obuhvat provere.
CI je naredna tačka 3; ponovljeni lokalni prolazi ne garantuju sva okruženja.
