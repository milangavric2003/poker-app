# T036 — Vitest provera i ograničenje worker-a

Datum: 2026-10-07 (Europe/Belgrade). Korisnik je odobrio samo tačku 1 plana
poboljšanja Week05 ocene. Grana `fix/week05-review-improvements` napravljena je
od lokalnog čistog `main` commita `c73ae8c`. Ista grana je namenjena svim pet
tačkama, ali sledeća tačka, commit i push čekaju korisnikov pregled/potvrdu.

## Signal i granice dijagnoze

Nezavisni pregled prijavljuje 877 prolaza uz worker-start grešku, uključujući
single-worker pokušaj. U ovom radu istorijski kvar nije reprodukovan: neizmenjeni
baseline prolazi 888/888, Node projekat 781/781, UI projekat 107/107. Iz dostavljenog
sažetka nije poznat tačan worker/fajl ni potpuni stderr neuspešne nezavisne provere.
Ne tvrdimo da je razlika 11 testova konkretan pronađen test fajl niti da je uzrok
istorijskog kvara potvrđen. Nema behavior RED-a: postojeći testovi prolaze pre izmene.

Okruženje: Windows x64, Node v24.20.0, npm 11.19.0, Vitest 5.0.1,
16 dostupnih CPU, oko 31.73 GiB ukupne RAM memorije (16.78 GiB slobodno pri očitavanju).
Korišćena je postojeća instalacija zavisnosti; `npm ci` nije ponovljen.

Pročitan lokalni instalirani Vitest kod:
`node_modules/vitest/dist/chunks/index.DzobfTyw.js`, `resolveMaxWorkers` i
`WORKER_START_TIMEOUT`. Bez konfiguracije run koristi najviše CPU-1 worker-a
(ovde 15); worker-start rok je poseban interni limit od 90 s. Povećavanje
`testTimeout` ne podešava taj rok. Fajlovi zavisnosti nisu menjani.

## Najmanja izmena

`vitest.config.ts` postavlja zajednički `maxWorkers: Math.min(4, availableParallelism())`
za oba projekta. CLI proba sa četiri worker-a prethodila je izmeni i prošla sve
testove. Cap smanjuje maksimalno istovremeno pokretanje procesa/jsdom okruženja,
a prilagođava se i računaru sa manje od četiri dostupna CPU.

Ovo je preventivna mera za resurse i potvrđena lokalna ponovljivost, ne dokaz da
je konkurentnost izazvala raniji kvar. Broj četiri je konzervativan izbor, nije
izmereni univerzalni optimum. Nisu menjani forks pool, izolacija, test/hook
timeout-i, retry, assertion-i, include putanje, aplikacioni kod ili dependencies.
Nema novih testova koji bi samo preslikavali konfiguraciju; postojeća puna suite
je pre/posle provera. README opisuje cap i komande za dalju dijagnostiku.

## Stvarni rezultati

Sve komande pokrenute su iz `retro-poker/`. Svaki log sadrži stvarni exit status.
Tri završna run-a su zasebna uzastopna pokretanja bez automatskog retry-ja,
bez paralelnog pokretanja drugih suite-a i bez izmene koda između njih.

| Provera | Rezultat | Trajanje | Dokaz |
|---|---|---|---|
| Baseline `npm.cmd test -- --reporter=verbose` | 61 fajl, 888/888, exit 0 | 13.69 s | [log](003-T036-vitest-baseline.txt) |
| `npm.cmd test -- --project=node` | 51 fajl, 781/781, exit 0 | 5.19 s | [log](003-T036-vitest-node.txt) |
| `npm.cmd test -- --project=ui` | 10 fajlova, 107/107, exit 0 | 4.77 s | [log](003-T036-vitest-ui.txt) |
| CLI proba `npm.cmd test -- --maxWorkers=4` | 61 fajl, 888/888, exit 0 | 13.69 s | [log](003-T036-vitest-cap-probe.txt) |
| Konačni `npm.cmd test`, run 1 | 61 fajl, 888/888, exit 0 | 13.31 s | [log](003-T036-vitest-full-1.txt) |
| Konačni `npm.cmd test`, run 2 | 61 fajl, 888/888, exit 0 | 13.41 s | [log](003-T036-vitest-full-2.txt) |
| Konačni `npm.cmd test`, run 3 | 61 fajl, 888/888, exit 0 | 13.86 s | [log](003-T036-vitest-full-3.txt) |
| `npm.cmd run typecheck` | exit 0 | — | [log](003-T036-typecheck.txt) |
| `npm.cmd run lint` | exit 0 | — | [log](003-T036-lint.txt) |

Nema prijavljenih worker/unhandled grešaka niti preskočenih testova u ovim run-ovima.
PowerShell tekstualni logovi su posle završetka konvertovani iz UTF-16 u UTF-8,
bez menjanja sadržaja. Nisu benchmark pod kontrolisanim identičnim opterećenjem;
trajanja ne dokazuju ubrzanje.

## Handoff

Lokalni kriterijum T036 (tri puna prolaza i statičke provere) je ispunjen.
Definitivno zatvaranje istorijskog worker-start nalaza zahteva ponavljanje u
okruženju koje ga je prijavilo ili njegov potpuni neuspešni log. Ako se ponovi,
sačuvati ceo stderr/exit status i verzije, zatim koristiti README dijagnostičke
komande. Izolovani prolaz ne zamenjuje neuspešan puni run.

E2E/recovery i CI nisu rađeni; clean install, build, live pozivi i ostale tačke
nisu pokrenuti u ovom tasku. Build nije relevantan za jedinu izvršnu izmenu u
Vitest konfiguraciji; TypeScript provera uključuje config fajlove. Nema tvrdnje
o produkcijskoj dostupnosti ili stabilnosti svih okruženja.

Jedan coding agent izvršio je dijagnostiku, izmenu i navedene provere. Korisnik
je odredio scope i Git tok; ljudski pregled ove izmene još nije potvrđen.
Nisu čitani ključevi niti pokretani live Gemini zahtevi. Commit/push nisu urađeni.
