# T038 — clean CI gate, 2026-10-07

## Naknadna hosted provera

Workflow je objavljen commitom `116bac6`. Provera GitHub run-ova 37573899485 i
37573899420 potvrđuje uspešan Windows job i uspešan E2E na oba OS-a, ali Ubuntu
Vitest korak pada. T038 lokalna isporuka ostaje završena; hosted full-suite uslov
još nije zatvoren. [Nastavak pregleda i preostali koraci](003-review-continuation-2026-10-07.md).
Tekst ispod opisuje stanje pre objavljivanja workflow-a.

Tačka 2 završena je commit-om `0a2f0d2420a6fe167cebf16964d3479f015d6c9d`
i push-ovana na `fix/week05-review-improvements` po korisnikovom odobrenju.
Tačka 3 dodaje [GitHub workflow](../../../.github/workflows/retro-poker-ci.yml).
Njena implementacija i lokalni dokazi čekaju korisnikov pregled pre commit/push-a.

## Šta gate proverava

Push, pull request ka main-u i ručno pokretanje dobijaju zasebne Windows 2025
i Ubuntu 24.04 job-ove. Node 24.20.0/npm 11.19.0 su eksplicitni; `npm ci`
koristi postojeći lockfile, bez cache-a node_modules. Slede typecheck, lint,
puna Vitest suite, build, Chromium instalacija i ceo E2E. Gemini je isključen,
ključ prazan, nema live opt-in komandi ili deployment-a.

Vitest zadržava postojeći cap do četiri worker-a; Playwright jedan worker.
`.only` obara proveru u oba runner-a. E2E ima `--retries=0` i
`--fail-on-flaky-tests`; Vitest retry ostaje podrazumevanih nula. Ne postoje
`continue-on-error` ili shell maskiranje exit statusa. Nezavisne provere rade
i posle pada druge provere ako je instalacija uspela; job i dalje ostaje crven.
Matrica ima `fail-fast: false`, noviji run iste grane otkazuje stariji.

Artefakti se uploaduju uz `always()`, sa rokom čuvanja 14 dana: runtime/commit/
lockfile metadata, Vitest JSON/JUnit, Playwright HTML/JUnit i trace pri padu.
Upload može sačuvati samo ono što je runner uspeo da napravi. Job ima rok 20 min
i `contents: read`; checkout ne zadržava Git credentials. Produkcioni kod,
oracle-i, test timeout-i i dependencies nisu menjani.

## Lokalna reprodukcija i granice

`git archive` iz commit-a `0a2f0d2` izvezen je u ignorisani
`.verification/T038-clean/retro-poker`. Nisu kopirani `.env` ili node_modules;
jedina preklopljena izmena u toj kopiji je novi `.gitignore` za `ci-results/`.
Privremeni lokalni runner čita tačne `run` komande i env iz novog workflow-a,
izvršava ih kroz Git Bash sa `set -euo pipefail` i beleži izlaz/exit status.
Komande su navedene i u svakom pojedinačnom logu.

Node/npm su već lokalno instalirani u traženim verzijama; setup-node i globalna
instalacija npm-a nisu lokalno izvršavani. Chromium 1243 je već u lokalnom
browser cache-u; uspešan install korak nije dokaz novog preuzimanja browsera.
Izveštaj koristi `runner: Windows-local` i `runId: local-T038`.
Git metadata u arhivi razrešava se preko roditeljskog repozitorijuma, istog
potvrđenog HEAD-a. Ovo je čista instalacija dependencies na postojećem Windows
računaru, **nije** svež GitHub runner ili dokaz prolaza na Linux-u.

Pripremni pokušaji nisu predstavljeni kao test RED: pogrešan archive pathspec
i pogrešna putanja za redirect ispravljeni su pre uspešnog izvoza/instalacije.
PowerShell pokušaj sa ErrorActionPreference Stop nije dao potvrđen npm exit;
njegov prazan log označen je kao nepotvrđen pokušaj. Ponovljen `npm ci` kroz
Bash završio je exit 0. Prvi sandbox Chromium korak se zaglavio i prekinut je
(tool session exit 1, bez installer izlaza); ponovljen van sandbox-a završava
exit 0. Nije potvrđen unutrašnji uzrok zadržavanja; lokalni cache je van workspace-a.

## Provere

| Provera | Rezultat | Dokaz |
|---|---|---|
| Runtime i commit | Node 24.20.0, npm 11.19.0, 0a2f0d2; exit 0 | [log](003-T038-environment.txt) |
| Clean `npm ci` | 304 paketa, exit 0 | [log](003-T038-clean-install-final.txt) |
| Typecheck | exit 0 | [log](003-T038-typecheck.txt) |
| Lint | exit 0 | [log](003-T038-lint.txt) |
| Puna Vitest provera | 888/888, 61 fajl, exit 0 | [log](003-T038-vitest.txt) |
| Build frontend/backend | exit 0 | [log](003-T038-build.txt) |
| Chromium install | exit 0, postojeći browser cache | [log](003-T038-chromium-install-final.txt) |
| Cela Chromium E2E suite | 14/14, retries 0, exit 0 | [log](003-T038-e2e.txt) |
| Workflow actionlint 1.7.12 | exit 0 | [log](003-T038-actionlint.txt) |

Parsiranje stvarnih JSON/JUnit izveštaja potvrđuje 888 Vitest i 14 E2E testova,
bez failure/error/skipped zapisa; HTML izveštaj postoji. Sačuvan je mali
[sažetak reporta i okruženja](003-T038-report-summary.json), uključujući hash
proverenog workflow-a. T038 tekstualni logovi normalizovani su u UTF-8 uz
uklanjanje završnih razmaka; sadržaj neuspešnih pokušaja nije prikazan kao PASS.

Actionlint je preuzet iz zvaničnog release-a i proveren prema objavljenom
SHA256: `6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9`.
ShellCheck/Pyflakes nisu lokalno dostupni i isključeni su u toj proveri;
Bash komande su proverene stvarnim lokalnim izvršavanjem.
Preuzeti alat i puni browser/machine reporti ostaju ignorisani.

## Šta ostaje posle odobrenog push-a

Otvoriti GitHub Actions run za commit koji sadrži T038; proveriti oba job-a,
tačan SHA, rezultate i preuzimanje artefakata. Sačuvati run URL/ishod kao hosted
dokaz. Workflow još nije objavljen: GitHub izvršavanje, Linux, artifact upload
i ponašanje otkazivanja nisu potvrđeni lokalnim testovima. CI gate još nije
podešen kao obavezan branch-protection check.

T038 ne proširuje live uzorak i ne potvrđuje produkcijsku dostupnost modela.
Novi live provider pozivi: 0. Jedan coding agent; korisnik odobrio prethodni
commit/push i novu tačku. Review tačke 3 i doprinos drugog člana ovoj izmeni
nisu još potvrđeni. Tačke 4 i 5 nisu započete.

## Korišćena zvanična dokumentacija

- [actions/checkout](https://github.com/actions/checkout),
  [actions/setup-node](https://github.com/actions/setup-node),
  [actions/upload-artifact](https://github.com/actions/upload-artifact): v7 interfejsi.
- [GitHub runner-i](https://docs.github.com/en/actions/reference/runners/github-hosted-runners): OS oznake matrice.
- [Playwright CI](https://playwright.dev/docs/ci-intro) i
  [CLI](https://playwright.dev/docs/test-cli): instalacija i gate opcije.
- [actionlint 1.7.12](https://github.com/rhysd/actionlint/releases/tag/v1.7.12): validator i checksum.
