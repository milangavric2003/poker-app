# Faza 7 — završni handoff T028–T031

2026-10-26, Europe/Belgrade. Jedan coding agent, Codex po korisničkom zahtevu.
Git koren `D:/AIBootcamp/week3-4`, projekat `retro-poker/`, grana `week08-init`.
Početni i testirani kod/testovi: `d508f13e4930972d1d64e9d196f69c07ed374027`.
Početno stablo čisto. Nema promene grane/reset-a/commit-a/push-a/dispatch-a/merge-a.

## Status i granica predaje

T028: završna tehnička matrica i lokalne provere prolaze.
T029: **završen po lokalnim izolovanim kriterijumima**, uz pripremljen workflow;
remote CI nije izvršen/potvrđen. Nije prijavljen Linux ili remote PASS.
T030: **otvoren**; korisnik je na konkretan rani zahtev odgovorio „To jos nije
spremno.” Nema potvrđenog W08 samostalnog negativnog testa, razumevanja, review-a
i izvedenog demo-a/individualne varijante za oba člana.
T031: **otvoren zbog T030**; tehnička dokumentacija pripremljena i usklađena,
ali Week08 nije završen. [Demo raspored i ljudske potvrde](005-phase7-demo.md).

## Pregled prethodne faze i promene

AGENTS, constitution 1.1.0, početni prompt, GAME_SPEC, feature005 artefakti,
T006 originalni fixture-i/izlazi, Faza 6 handoff/audit i odgovarajući kod/testovi
pročitani. Primenjen lokalni speckit-implement; checklist 9/9. Prerequisites
prošao kroz zasebni PowerShell `-ExecutionPolicy Bypass`, jer direktan poziv
blokira execution policy. Nema `.specify/extensions.yml` ni pre/post hook-ova.
Speckit-converge pročitan radi procene; nije zasebno izvršavan niti dodati duplikati
već otvorenih T030/T031. Korisnički zahtev izričito odobrava dokumentaciono usklađivanje.

Prva završna security komanda ujedno proverava prethodnu fazu: **123 PASS**,
uključuje events/sentinel i normalan coaching. Pregled potvrđuje zatvorenih osam
event polja, serversku korelaciju i timestamp, safe integer brojače, jednu
terminalnu odluku, observer kopije/exception izolaciju, 200/30min retention i
odsustvo public log endpoint-a. Factory assertion dokazuje učitavanje sintetičke
tajne, a adapter/tool/success testovi proveravaju stvarne izlazne granice.
T027 audit odluke i kompatibilne zakrpe potvrđene istim lockfile-om, bez novog upgrade-a.
Nije otkriven novi runtime propust; nema promene runtime-a, testova, poker pravila,
frontenda, summary regeneration ili AI usage ponašanja.

Jedina promena izvršne konfiguracije: root `.github/workflows/retro-poker-ci.yml`.
Sačuvani Windows/Linux, pinovani Node/npm, fake-only env i artifact upload.
Dodati eksplicitni security node/browser koraci, lockfile guard, forbid-only i
zero retry; security browser skripta gradi izvore, puni Playwright zatim koristi
isti build. Zaseban security JUnit/output folder čuva neuspeh pre punog suite-a.
Nema continue-on-error ili passWithNoTests. [YAML i statička provera](005-phase7-workflow-review.json).
Ovo nije izvršenje GitHub runner-a niti dokaz Linux prolaza.

## Stvarne lokalne komande

Node `v24.20.0`, npm `11.19.0`, Playwright `1.63.0`, Chromium.
Svaka komanda ispod exit 0. `GEMINI_ENABLED=false`, `GEMINI_API_KEY=''`, isključivo
constructor fake ili SDK mock transport; **0 live provider poziva**.

| Komanda iz retro-poker/ | Rezultat / prvi izlaz |
|---|---|
| `npm.cmd run test:security` | [123 PASS / 11 fajlova](005-phase7-security-first.txt) |
| `npm.cmd run test:security:e2e` | [svež build + 5 PASS](005-phase7-security-e2e-first.txt) |
| `npm.cmd test` | [1037 PASS / 73 fajla](005-phase7-full-first.txt) |
| `npm.cmd run test:e2e` | [svež build + 26 PASS](005-phase7-e2e-first.txt) |
| `npm.cmd run typecheck` | [PASS](005-phase7-typecheck.txt) |
| `npm.cmd run lint` | [PASS](005-phase7-lint.txt) |
| `npm.cmd run build` | [samostalni build PASS](005-phase7-build.txt) |
| `git diff --check` | [prvi PASS](005-phase7-diff-check-first.txt); CRLF upozorenja nisu whitespace greške |
| `npm.cmd test -- tests/integration/security-normal.test.ts tests/integration/security-tools.test.ts tests/integration/security-admission.test.ts --disableConsoleIntercept --reporter=verbose` | [38 PASS i actual brojači](005-phase7-comparison.txt); dopunski dokaz istih input-a, bez prikrivanja suite pada |

Obe tražene npm E2E komande grade prema sopstvenom ugovoru. Nema dodatnog build-a
između njih; samostalni finalni build daje posebno traženi dokaz. Browser suite-i
su serijski. Lokalni E2E prepisuje istorijske feature004 PNG fajlove; pošto je
početno stablo bilo čisto, samo ti generisani PNG vraćeni su bajt-po-bajt iz HEAD-a
bez git reset/checkout-a. [Tačne putanje](005-phase7-generated-artifacts.json).

## Prvi neuspesi i korekcije okruženja

Nema neuspelog produkcionog ili regresionog testa u ovoj fazi, skip-a, test.fails,
test retry-ja ili oslabljenih assertions-a. Sačuvani su i problemi pre testiranja:

- Direktni Spec Kit script blokiran execution policy-jem; dokumentovani zasebni
  PowerShell Bypass daje prerequisites JSON, bez izmene globalne policy.
- Prvi pokušaj izolovanog npm ci nije ni startovao zbog pogrešne relativne
  putanje izlaznog loga (`.verification/docs/evidence` nije postojao). Ovo nije
  npm ci PASS uprkos nasleđenom `$LASTEXITCODE=0`. Putanja zamenjena apsolutnom.
- Prvi stvarni [clean npm ci](005-phase7-clean-ci-first.txt) exit 1: registry EACCES
  i cleanup EPERM u novoj kopiji. Mrežni [ponovljeni npm ci](005-phase7-clean-ci-retry.txt)
  exit 0, 302 instalirana/audit 303, 0 vulnerabilities; aktivni node_modules netaknut.
- Browser setup u sandbox-u čekao je bez izlaza; dva sopstvena setup procesa
  otkazana, exit 1, bez diranja aplikacionih servera. [Prazni prvi npx log](005-phase7-clean-browser-setup.txt),
  [direktni log](005-phase7-clean-browser-direct.txt). Isti instalirani CLI uz
  browser cache pristup [završio exit 0](005-phase7-clean-browser-escalated.txt).
  Potom je Chromium dodatno preuzet u potpuno nov izolovan direktorijum; vidi ispod.
- GitHub API prvi [socket WinError 10013](005-phase7-remote-ci-first.txt), pa
  [stvarni mrežni odgovor](005-phase7-remote-ci-retry.txt), exit 0, total_count 0.
- Dokumentacioni Python pokušaj sa PowerShell ASCII pipe-om oštetio je samo nove
  privremene rečenice i stao na substring-u. Ispravljeno UTF-8/apply_patch-om,
  bez runtime promene; završna dokumentaciona provera proverava aktuelne fajlove.

## Izolovana instalacija / T029

Verno kopirano 787 praćenih fajlova iz tačno definisanog HEAD + tadašnji workflow
patch u `.verification/phase7/`. Bez `.git`, node_modules, dist-a, npm cache-a,
lokalnog feature.json ili neversionisanog helper-a; svi `.env*` izostavljeni,
uključujući template. Nisu čitane lokalne tajne. Originalna kopija i hash-evi:
[install snapshot](005-phase7-install-snapshot.json), [tadašnji patch](005-phase7-tested.patch).
Taj snapshot sadrži baš jedinu izvršnu izmenu ove faze (workflow), a aplikacioni
kod/testovi su početni d508f13. Kasnije izmene su dokumentacija/evidence i imaju
poseban završni manifest; nije im pripisan neizvršeni novi test run.

Node/npm potvrđeni `v24.20.0`/`11.19.0`. `npm_config_cache` postavljen na novi
`.fresh-npm-cache` unutar kopije. Npm ci nije koristio aktivni dependency tree.
Pre/posle/aktuelni lock SHA256:
`3d3df617e2d713be18771a3ae04cbbdae2f13e462d701ccb54e48ee6e385b801`.
Install-scripts upozorenje za tri paketa ostalo je vidljivo, bez approve/ignore
zaobilaženja; real build i testovi potvrđuju upotrebljivost te clean instalacije.

| Komanda iz izolovanog retro-poker/ | Rezultat |
|---|---|
| `npm.cmd ci` | [exit 0, 302 paketa](005-phase7-clean-ci-retry.txt), lock nepromenjen |
| `npm.cmd run test:security` | [123 PASS](005-phase7-clean-security-first.txt) |
| `npm.cmd test` | [1037 PASS](005-phase7-clean-full-first.txt) |
| `npm.cmd run typecheck` | [exit 0](005-phase7-clean-typecheck-first.txt) |
| `npm.cmd run lint` | [exit 0](005-phase7-clean-lint-first.txt) |
| `npm.cmd run build` | [exit 0](005-phase7-clean-build-first.txt) |
| `npm.cmd run test:security:e2e` | [build + 5 PASS](005-phase7-clean-security-e2e-first.txt) |
| `npm.cmd run test:e2e` | [build + 26 PASS](005-phase7-clean-e2e-first.txt) |
| `npm.cmd audit --json` uz registry mrežu | [exit 0, svi severity brojači 0](005-phase7-clean-audit.json) |

[Mašinski node exit statusi](005-phase7-clean-node-results.json).
Prvi clean browser prolaz koristi ranije obezbeđen browser binary; da uklonimo
i tu zavisnost, sa `PLAYWRIGHT_BROWSERS_PATH=<kopija>/.fresh-browsers` izvršen je
`node node_modules/playwright/cli.js install chromium` uz mrežu, exit 0.
[Preuzimanje novih Chromium/ffmpeg/headless shell/winldd artefakata](005-phase7-clean-fresh-browser.txt).
Sa tim potpuno novim browser direktorijumom serijski su ponovljene obe tražene
browser komande: [security build + 5 PASS](005-phase7-clean-fresh-security-e2e.txt),
[full build + 26 PASS](005-phase7-clean-fresh-e2e.txt),
[oba exit 0 i tačan browser path](005-phase7-clean-fresh-browser-results.json).
Ovo dodatno ponavljanje uklanja zavisnost prvog clean browser prolaza od postojećeg
browser cache-a; ne prikriva pad testa.

## Matrica, pre/posle i ograničenja

[Kompletna matrica](005-phase7-matrix.md): svi T00–T17 imaju kontrolu, konkretan
izvršen test, positive control i actual; I1–I8 mapirani. T04/T05 pravi Chromium,
T16 stvaran preview sa sentinel build-om; nema source mapa. T07 PASS→PASS, T13 i
T16 stvarni RED→GREEN nad istim sačuvanim T006 input-ima; [equivalence](005-phase7-input-equivalence.json).
Originalni RED logovi nisu prepisani. Audit odluke ostaju u [T027 zapisu](005-phase6-audit.md).

Lokalni jedan proces/jedna partija; nema auth-a/baze, SQL i credential CSRF su
arhitektonski N/A, origin i resursni scope stvarno testirani. SDK buffering pre
byte provere, abort bez garancije udaljenog prekida, neotkazivi lease do settle/
restart-a, memorijski sink i ograničen sentinel nisu prikriveni. Nema live-model
robustness, opšteg DLP-a, trajnog audita ili deployment tvrdnje.

## Remote CI i tačne sledeće radnje

GitHub API za `d508f13e4930972d1d64e9d196f69c07ed374027` vraća **0 run-ova**.
Za necommitovan finalni snapshot SHA ne postoji. **Remote CI NOT RUN/NEPOTVRĐEN**,
lokalni Windows prolaz i workflow konfiguracija nisu Linux/remote dokaz.

1. Veki i Milan izvedu demo/individualne varijante, svaki potvrdi stvarni doprinos
   kontroli i samostalno osmišljen negativni test uz očekivanje/actual/objašnjenje.
   Koristiti [konkretan obrazac](005-phase7-demo.md), ne autorstvo commita kao zamenu.
2. Kada vlasnik odluči da objavi isporuku: ručno review/commit/push snapshot-a,
   zatim proveriti GitHub Actions run za **taj novi SHA**, oba OS posla i artefakte.
   Ovde nijedan od tih koraka nije automatski izvršen niti zahtevan kao dozvola.
3. Dopuniti samo stvarne ljudske/CI rezultate i checkpoint; T031 zatvoriti tek
   kada su T030 i svi kriterijumi zadovoljeni. Week08 do tada ostaje nezavršen.

## Precizna reprodukcija isporuke

[Finalni checkpoint](005-phase7-checkpoint.json) navodi početni HEAD, hash-eve,
stvarne statuse, [tracked patch](005-phase7-delivery.patch) i
[paket promenjenih/novih fajlova](005-phase7-delivery.zip).
Iz početnog HEAD-a u novom checkout-u raspakovati paket iz Git korena, proveriti
manifest hash-eve i izvršiti quickstart; paket sadrži nove evidence fajlove koje
sam `git diff` ne uključuje. Ne raspakivati preko tuđeg rada bez pregleda.
Manifest/ZIP izostavljaju sami sebe da izbegnu kružni hash; ZIP hash je u spoljašnjem
checkpoint JSON-u. Nema izmišljenog finalnog commit SHA-a. Aplikacioni fajlovi i
workflow hash-evi upoređeni su sa stvarno testiranom izolovanom osnovom; kasnije
izmene su samo dokumentacija i sačuvani rezultati. Izolovana kopija je ignorisana,
aktivni node_modules/dist i korisnički server nisu brisani ili prekidani.

[Izvršna identičnost 158 fajlova i okruženje](005-phase7-execution-snapshot.json),
[provera 14 Markdown fajlova / 102 lokalna linka](005-phase7-document-check.json).
Dodati interni linkovi iz ovog pasusa takođe su provereni pri pakovanju.
