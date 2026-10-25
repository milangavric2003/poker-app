# Week08 — priprema osnove, 2026-10-25

Status: lokalna priprema osnove završena; ovo nije završen Week08 security dokaz.

## Očekivanja pre izvršavanja

Početna grana `week08-init` ima isti HEAD kao `add-modifications`: `96fb971`.
Privatne summary/usage/frontend dorade ostaju deo osnove, ne Week08 doprinos.
Korisnik odobrava poređenje i prenos potrebnih review popravki. Ne spajamo PR,
ne menjamo main, ne pushujemo i ne prepisujemo istorijske Week05 dokaze.
Korisnička nezavršena izmena root `.gitignore` (`/Nedelja-08`) ostaje očuvana.

Pregledani review commitovi: `9bb6af2`, `c6f2016`, `0a2f0d2`, `116bac6`,
`aa63599`, `2574a0a`. Prenos je ograničen na Vitest worker limit, recovery E2E
sinhronizaciju, fake clock AI failure test i CI workflow sa ignore pravilom.
Nijedan od tih runtime-neutralnih popravki nije nova Week08 security kontrola.

Pre prenosa očekujemo funkcionalan postojeći fake coaching i očuvano poker
stanje; proveravamo sve testove, typecheck/lint/build. Poznati rizik su worker
startup i recovery timing; neuspeh se zapisuje, bez proglašavanja uspeha iz rerun-a.
Posle prenosa očekujemo iste poslovne rezultate, bez worker/timing grešaka.
CI konfiguracija u radnom stablu nije dokaz izvršenog GitHub CI-ja.

Za testove nema live providera niti čitanja `.env`. Browser helper-i koriste
fake providere i loopback. Postojeće screenshot evidence fajlove testovi mogu
ponovo generisati; originali se čuvaju i vraćaju, novi W08 dokaz su tekstualni
logovi i tačan patch osnove. To ne menja rezultate testova.

## Stvarni rezultati

Početna instalacija `npm ci` nije pokrenuta; postojeći `node_modules` nije dokaz
čistog checkout-a. Raw HEAD pre prenosa ima test/recovery rezultate; typecheck,
lint i build izvršeni su na post-transfer osnovi, pre Week08 security implementacije.

| Komanda | Opaženi ishod |
|---|---|
| `npm.cmd test` pre | 1 FAIL / 905 PASS, 62 fajla; `gemini-live-smoke.test.ts` offline HTTP200 child-process test prešao 5 s |
| `npm.cmd run test:e2e -- tests/e2e/recovery.spec.ts` pre | 5/5 PASS |
| `npm.cmd test` posle | 906/906 PASS, 62 fajla, exit 0 |
| `npm.cmd run test:e2e` posle | 20/20 PASS, exit 0; uključuje novu slow-forward recovery varijantu |
| `npm.cmd run typecheck` | exit 0 |
| `npm.cmd run lint` | exit 0 |
| `npm.cmd run build` | exit 0 |
| `node --import tsx tests/helpers/coach-evidence.ts` | Prvi pokušaj: tsx/OS `uv_os_get_passwd ENOMEM` pre fixture rada; odobren run van sandbox-a: exit 0, 8 scenarija |

Prvi timeout nije worker-start greška niti live API problem: test koristi lokalni
HTTP stub. Posle prenosa worker limita cela suite prolazi; jedan prolaz nije
garancija trajne stabilnosti. Prvi pad i tsx setup prepreka nisu obrisani.
Izlazi su `005-baseline-tests-before.txt`, `005-baseline-recovery-before.txt`,
`005-baseline-tests-after.txt`, `005-baseline-e2e-after.txt`, typecheck/lint/build
fajlovi i `005-baseline-coach.txt`/`005-baseline-coach-retry.txt` u ovom direktorijumu.

## Provenance prenosa i očuvanje rada

Posle uspešnog `git fetch origin`, main je ostao `c73ae8c`, add-modifications i
week08-init `96fb971`, review tip `2574a0a`. Lokalni prenos, bez cherry-pick/merge
commit-a, kopira krajnje verzije sledećih fajlova sa review tipa:

- `retro-poker/vitest.config.ts`: maxWorkers ≤4 (poreklo `9bb6af2`).
- `retro-poker/tests/e2e/recovery.spec.ts`: backend commit pre fake-clock skoka,
  dodatni slow-forward scenario, cleanup (poreklo `c6f2016`, završno `2574a0a`).
- `retro-poker/tests/integration/ai-failures.test.ts`: fake clock umesto kratkog
  wall-clock polling-a (poreklo `aa63599`).
- `.github/workflows/retro-poker-ci.yml`: clean Windows/Linux gate (poreklo `116bac6`).
- `retro-poker/.gitignore`: samo dodato `ci-results/`.

Istorijski W05 spec/tasks/evidence i screenshotovi sa review grane nisu preneti.
Frontend i backend poslovni kod ostali su identični HEAD-u. Novi frontend E2E
tokovi prolaze. Originalni feature004 screenshotovi vraćeni su byte-for-byte iz
lokalne kopije nakon testova, da ponovno generisanje ne prepiše istorijski dokaz.
Root `.gitignore` izmena `/Nedelja-08` pripada korisniku i nije menjana.

## Reprodukcija snapshot-a

[Manifest](005-baseline-snapshot.json) daje puni HEAD, review SHA, lockfile hash,
hash svakog prenetog fajla i [patch](005-baseline-transfer.patch). U zasebnom
checkout-u na navedenom HEAD-u, iz Git korena primeniti patch komandom
`git apply <putanja-do-005-baseline-transfer.patch>`, zatim pokrenuti provere iz
`retro-poker/`. Patch obuhvata samo test/config/CI/ignore promene potrebne za ovu
testiranu osnovu. Dokumentacija i korisnički root ignore ne utiču na runtime snapshot.
To je ponovljiv checkpoint bez izmišljanja novog commit-a; pre narednog rada
preporučeno je sačuvati koherentan stvarni commit uz korisnikov Git tok.

CI YAML je prenet, ali remote run nije pokrenut/pregledan. Clean install, novi CI,
Week08 security suite i ljudski pregled ostaju otvoreni u T004–T031.

## Završna dokumentaciona provera

[Provera](005-document-check.json): 10 Markdown fajlova, 40 relativnih linkova,
31 uzastopan task (samo T001–T003 zatvoreni), svih 18 scenario redova; nema
nevažećih linkova ili nerešenih placeholder-a. Hash-evi testirane osnove odgovaraju
manifestu, četiri kopirana fajla su byte-for-byte sa review tipa, frontend/backend/
shared i feature004 nemaju promene. Spec Kit prerequisites uspešno razrešava 005.
[Git provere](005-final-check.txt): reverse apply --check potvrđuje patch prema
radnom stablu, `git diff --check` exit 0. CRLF upozorenja nisu whitespace greške.
