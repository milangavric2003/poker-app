# Implementation Plan: Week08 — Secure the Arcade

**Branch**: `week08-init` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

## Summary

Ojačati postojeći read-only coaching bez novih produktnih funkcija. Spec definiše
invarijante, ovaj plan granice i izvršna mesta, [tasks](tasks.md) red rada, a
[EVIDENCE_W08](../../docs/EVIDENCE_W08.md) opažene rezultate.
Priprema osnove prenosi tri test/config popravke i CI sa review grane; provenance
i rezultati su u [baseline zapisu](../../docs/evidence/005-baseline.md).
Ne merge-ovati cele istorijske W05 dokumente preko privatnih SR1/AU1/004 dopuna.
Prenos ne predstavlja implementaciju W08 bezbednosnih kontrola.

## Technical Context

- TypeScript 6.0.3, Node 24/npm 11; lokalno Node 24.20.0/npm 11.19.0.
- React 19.3.0, Vite 8.3.0, Fastify 5.12.5, Zod 4.6.5, Gemini SDK 2.24.0.
- Vitest 5.0.1, Playwright 1.63.0 Chromium, fake provider i monotoni fake sat.
- Jedan proces/jedna lokalna partija u memoriji; bez baze, auth-a i novih paketa.
- Frontend `127.0.0.1:5173`, API `127.0.0.1:3001`, frontend proxy `/api`.
- Production smoke: Vite preview sa istom konfiguracijom zaglavlja kao lokalni
  preview; backend ima constructor-injected fake provider. Nema javnog test API-ja.
- Performance cilj su granice rada, ne throughput benchmark ili SLA.

## Constitution Check

I–V: spec i acceptance pre koda, RED→GREEN za nedostajuće ponašanje, nezavisni
poker oracle-i, read-only snapshot, server autoritet i strict šeme.
VI: korisnik odobrava W08 hardening W05 toka i očuvanje privatnih dorada;
loopback/memory/bez novih servisa ostaju. VII: ponovljiv snapshot i iskreni dokazi.
W08 zahteva PASS→PASS za već dobru kontrolu; istorijski W03 eval zahtev za
stvarni propust nije obaveza izmišljanja W08 propusta. Jedan agent i naizmenični
ljudski rad. Nema blokirajućeg odstupanja ili neodređene produktne odluke.

## Project Structure

```text
specs/005-week08-secure-the-arcade/
  spec.md, plan.md, tasks.md, research.md, data-model.md, quickstart.md
  contracts/security.md, checklists/requirements.md
docs/EVIDENCE_W08.md, docs/evidence/005-*
backend/src/security/               # planirani admission/capacity/events moduli
backend/src/{app,routes,session}.ts  # HTTP i lifecycle integracija
backend/src/agent/                  # postojeći orchestrator/tools/validation
backend/src/ai/{coordinator.ts,providers/gemini.ts}
shared/contracts.ts
frontend/src/components/{CoachPanel,AnalysisPanel}.tsx
vite.config.ts
tests/{unit,contract,integration}/security-*.test.ts
tests/e2e/security-*.spec.ts, tests/helpers/security-*.ts
```

## Granice i ugovori

Ovo su izabrane lokalne granice, ne industrijski standard. Promena zahteva
obrazloženje i usklađen spec/plan/test pre implementacije.

| Resurs | Granica i brojanje | Enforcement / razlog |
|---|---|---|
| HTTP body | Coach 1.024 UTF-8 bajta; ostale rute 16.384 | Fastify pre parse-a; zadržati W05 |
| Goal | `betting`, `street`, `showdown`; bez free text-a | Strict shared schema |
| Tool args | `focus` odgovara run-u, `limit` ceo 1–10, bez extra polja | Schema + scope pre executor-a |
| Snapshot | Do 200 odluka; tool do 10 odluka × do 5 činjenica | Konačan lokalni evaluator |
| Tekst | Summary 1–1.000, recommendation 1–500 Unicode code points posle trim-a; finding 1–500 bez trim-a; reference 1–128 ASCII | Postojeći ugovor; evidence do 10 jedinstvenih stavki |
| Tool rezultat | 20.480 UTF-8 bajta JSON-a | Pre prihvatanja i drugog modela |
| Model context / odgovor | Po 32.768 UTF-8 bajta | Orchestrator i adapter; što ranije, pre parse-a za string |
| Izlazni tokeni | 4.096 za svaki coaching pokušaj | Server-only adapter config, uključujući retry/fallback |
| Koraci / tools / attempts | 2 / 1 / 4 ukupno; do 2 attempts po koraku | Postojeći CORE_AGENT_LIMITS |
| Poziv / run / tool | 15.000 / 45.000 / 1.000 ms | Monotoni sat; retry/backoff troši rok |
| Stvarno aktivni provider poslovi | Globalno najviše 2 po procesu, zajedno coach/analysis/bot | Lease do settle originalnog provider promise-a |
| Aktivni coaching run | Postojeći najviše 1 trenutni; dedupe istog cilja | Otkazani prethodnici i dalje troše fizički kapacitet |
| Novi korisnički AI startovi | Najviše 5 u kliznih 60.000 ms, zajedno coach i analysis | Procesni gate nezavisan od nove partije/usage reset-a |
| Security evidencija | Najviše 200 događaja, najduže 30 minuta u memoriji | Ring buffer, age pruning pri upisu/čitanju |

Automatski bot potezi ne troše prozor korisničkih analysis/coach startova, ali
dele fizički kapacitet. Bez mesta bot koristi postojeći lokalni fallback bez
provider poziva; poker pravila ostaju ista. Ovo nije opšti rate limiter za sve
rute. Izabrani coaching i zajednički provider kapacitet su obuhvat zadatka.

## Arhitektonske odluke

### HTTP, admission i stvarni rad

Validacija sadržaja/origin-a/partije prethodi rezervaciji. Deduplikovan pending
coaching vraća isti run bez novog rate tokena/posla; drugi cilj zadržava conflict.
Prihvaćen novi start troši rate token i ako kasnije ne uspe. Nevalidan ili
capacity/rate odbijen start ga ne troši. No-evidence odgovor ne rezerviše provider mesto.
Admission i rezervacija su atomski; provider se ne čeka pod game mutation lock-om;
nema neograničenog reda. Za odbijanje koristiti `429` i `AI_RATE_LIMITED` ili
`AI_CAPACITY_EXCEEDED`; rate ima `Retry-After` u sekundama, capacity nema izmišljen rok.
Frontend čuva rezultat i nudi eksplicitan retry, bez automatskog POST ponavljanja.
Shared error ugovor proširiti gde je potrebno.

Razdvojiti terminalno stanje run-a od stvarnog provider posla. Race/abort može
završiti run, ali lease traje do settle originalnog promise-a. Abort proslediti
adapteru; late resolve/reject ne commit-uje rezultat i nema unhandled rejection.
Zaglavljen provider može zauzeti kapacitet do restarta: dokumentovano ograničenje,
ne lažan oporavak. Retry/međukorak ne duplira lease; nema ranog oslobađanja.

### Scope i model politika

Nema auth-a: aktuelni serverski snapshot i goal određuju scope, UUID nije credential.
T08 koristi validan `focus/limit` za nedozvoljeni run focus ili zamenjen serverski
snapshot; samo extra `gameId` schema greška nije dovoljan scope dokaz.
T09 dokumentuje odsutan slobodan nepouzdan input i testira malicious fake proposal.
Ne dodavati RAG/import/chat radi injection scenarija.
Tool output mora proći allowlist projekciju i kanonsko članstvo; invalid/extra/oversized
rezultat ne sme u drugi model. Final reference/finding su iz tog validiranog skupa.
SDK može baferovati odgovor pre aplikacione byte provere: navesti ograničenje.

### Browser i CSP

Ostaje plain text prikaz. Production preview HTML policy:
`default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none';
base-uri 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:;
font-src 'self'; style-src 'self' 'unsafe-inline'`.
Inline stilovi služe postojećem rasporedu; dopuštenje nikad ne proširiti na script/eval.
Dodati `X-Content-Type-Options: nosniff` i `Referrer-Policy: no-referrer`.
Testirati stvaran build, ne HMR. Kontrolisani drugi loopback script bez CSP-a
vraća 200 i postavlja marker; sa politikom marker izostaje i `securitypolicyviolation`
navodi script direktivu. Nema `bypassCSP`. DOM proveriti zasebno od izvršenja.

### Security događaji, privatnost i origin

Interni bounded sink bez javnog read/reset endpoint-a; čita ga lokalni operator
kroz proces/debugger i constructor-injected test sink. Nema trajnog fajla ni
automatskog raw stdout dump-a. Restart prazni buffer, usage reset ga ne menja.
Test sink dobija istu sanitizovanu šemu. Accepted/rejected/terminal i tool odluke
beleže stabilne kodove, brojače i serverski correlation ID; bez UUID partije/ruke,
prompt-a, karata, arguments, arbitrary tool name-a, response-a, exception-a ili tajni.

Loopback i frontend origin ostaju `http://127.0.0.1:5173`, isti origin kroz proxy,
bez širokog CORS-a/credentials. Nepoznat Origin i literal `null` odbiti pre rada.
Nedostajući Origin za lokalni ne-browser klijent može proći ostale kontrole;
to nije autentikacija. Cookie CSRF trenutno N/A; cross-origin pokušaj troška
ipak proveriti serverskim brojačima.

## Faze, testovi i dokazi

1. Priprema osnove/dokumentacije; baseline nije finalni security PASS.
2. Pre hardening-a fixture/harness i početni T07 (unknown tool), T13 (rate burst),
   T16 (CSP), sa istim sačuvanim ulazima za završno poređenje.
3. US1 scope/ugovori; US2 kapacitet/lifecycle; US3 browser; US4 events/sentinel/audit.
4. Full regresija, clean install/CI, matrica i ljudski demo.

T00 real tool count i kompletno kanonsko stanje. T12 više individualno kratkih
poziva/backoff-a prelazi ukupan deadline, zasebno od per-call timeout-a.
T13 zasebni overlap i rate-window testovi uz oporavak. T17: neotkaziv provider →
nova partija + usage reset → novi start → stari late rezultat; rad ostaje obračunat,
nova partija i usage epoch zaštićeni. Svaka glavna kontrola ima pozitivan control.

Planirane komande: `npm run test:security` (node), `npm run test:security:e2e`
(build + browser). **Još ne postoje**; uvode ih taskovi, bez isključivanja testova iz
običnog full suite-a. Završne postojeće provere: `npm ci`, `npm test`,
`npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build`,
`git diff --check`. `npm audit --json`: runtime/dev nalaz i odluka, ne slepi
`audit fix --force`. Svi AI testovi fake/offline, bez live API poziva.

## Complexity Tracking

### Faza 4 — odobreni tehnički obuhvat (2026-10-26)

Za procesni singleton test izolacija zahteva i `vitest.config.ts` +
`tests/helpers/security-reset.ts`: beforeEach zamenjuje testne procesne gate objekte,
bez produkcionog reset endpoint-a. U samom testu nova partija/usage reset nikada
ne zamenjuju gate. Dozvoljena dopuna postojećih `tests/ui/{coach-lifecycle,analysis-lifecycle}.test.tsx`
i `tests/e2e/coach.spec.ts` dokazuje očuvanje summary-ja i eksplicitan retry.
Ovo proširenje test putanja prethodi implementaciji; nema novog produktnog scope-a.
Session je jedini vlasnik admission rezervacije i provider wrapper-a; wrapper
uzima lease za svaki stvarni pokušaj. Ne postoji drugi gate u adapteru/orchestrator-u.

Nema novih servisa/auth-a/baze/sanitizer biblioteke ili multi-agent rada.
SDK config se proverava mock transportom. Pre svake faze pregledati prethodnu
implementaciju i fokusirane testove. Vlasnik je trenutni driver, ne fiksna podela;
oba člana moraju doprineti kontroli i negativnom testu.
