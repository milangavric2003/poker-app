# Faza 5 — T019–T022

2026-10-26, Europe/Belgrade. Driver: Codex u sesiji sa Vekijem, jedan coding agent.
Git koren `D:/AIBootcamp/week3-4`, projektni koren `retro-poker/`, grana
`week08-init`, početni HEAD `9d89726158cf0af45d7ffc997b36915007cfbbd3`, čisto stablo.
Checkpoint je taj HEAD + radni diff/novi fajlovi; nema commit/push/merge-a.

## Prethodna faza i očekivanja

Primenjen projektni `speckit-implement` skill; prerequisites prolazi kroz
dokumentovani `powershell -NoProfile -ExecutionPolicy Bypass -File
.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks`.
Direktan poziv blokira lokalna execution policy. Checklist 9/9 PASS; nema
extensions.yml/pre/post hooks. Ignore/ESLint već pokrivaju generisane artefakte.
Korišćeni izvori i razlog uključivanja su u `docs/CONTEXT_MANIFEST.md`.

Pregledani admission/capacity/session: validacija/dedupe pre rezervacije,
lease do stvarnog settle-a, new-game/usage ne resetuju procesne limite.
Preflight node security 108 PASS; fokusirani budget/SDK/admission/capacity/
lifecycle/T00 68 PASS. Nema otkrivene regresije prethodne faze.
Očekivanja su prvo zapisana u novim test assertions, pa izvršena pre runtime
izmene: literalni tekst u oba panela, validan completed coaching, bez izvršivog
DOM-a/atributa/markera/linka/remote učitavanja/navigacije, poker nepromenjen.

## Taskovi i izvršna mesta

| Task | Status i dokaz |
|---|---|
| T019 | Završen: `tests/e2e/security-rendering.spec.ts` + `security-fixtures.ts`. Fake pending tool → stvarni get_decision_evidence → canonical evidence iz drugog model context-a → validan malicious final → real HTTP/UI. Payload je u summary/recommendation, ne u kanonskom finding-u. Dva model koraka, jedan alat, status completed. Analysis takođe ide kroz stvarni fake provider i produkcionu validaciju. |
| T020 | Završen uslovni GREEN: oba panela su već bezbedna, PASS→PASS. `CoachPanel.tsx`/`AnalysisPanel.tsx` nisu menjani. Nema rich-text renderer-a/sanitizer-a/dangerouslySetInnerHTML. Relevantni UI i keyboard/retry/usage tokovi prolaze. |
| T021 | Završen: originalni T16 scenario ostaje u `security-production.spec.ts`; dodate tačne header i functional assertions. Helper koristi pravi Vite preview config, constructor fake i kontrolisani drugi origin. Bez helper header-a/bypassCSP/route.fulfill. |
| T022 | Završen: `vite.config.ts` `preview.headers` postavlja tačnu politiku iz plana + nosniff/no-referrer. Script/connect self, object/base/frame zaštita; unsafe-inline isključivo za style. Loopback/proxy/origin sačuvani. Obe E2E npm komande prvo grade aktuelnu aplikaciju; security izbor nije prazan i ostaje uključen u redovan suite. Quickstart usklađen. |

T04/T05 u pravom browseru proveravaju i literalni tekst i scoped DOM (script,
img, a, iframe, object, embed, link, base, svg, math i svaki on* atribut), nezavisno
od markera. Dev fixture nema CSP koji bi prikrio nebezbedan DOM. Bez bypassCSP.
Oba panela dobijaju HTML sa kontrolisanim onerror markerom, script, Markdown
link i javascript URL; ne nastaje aktivan link. Pozitivni srpski tekst ima
č/ć/š/ž/đ, apostrof i `a < b`. Nema nove stranice/promene URL-a.
Kontrolisana slika je stvarno dostupna na drugom loopback origin-u: HTTP 200
pozitivna provera, zatim i browser request observer i serverski brojač potvrđuju
0 automatskih zahteva. Pojačanje dostupnim probe-om zamenilo je početni tekstualni
port-9 URL; oba prolaze, početni rezultati nisu prepisani.
Analiza sme menjati sopstvenu AI metadata projekciju; sva ostala javna game polja
ostaju ista. Coaching poredi ceo GET snapshot pre/posle; node testovi pokrivaju
i interno poker/RNG stanje.

## Isti T16 pre/posle

Originalni input ostaje `securityInputs.scriptPath=/security-probe.js`,
marker `__w08ScriptExecuted`, isti script body, drugo loopback poreklo, HTTP 200,
odvojena kontrolna stranica bez politike, nova partija sa jednim botom i Call 5,
listener registrovan pre append script pokušaja. Ephemeral port je očekivano nov.
Originalni `securityInputs` objekat nije menjan; fixture fajl samo dobija nove
rendering exports. Istorijski fixture snapshot i dokaz T006 nisu prepisani.

| Signal | T006 pre | Faza 5 posle |
|---|---|---|
| Kontrolni HTTP/script bez CSP-a | 200, marker true | 200, marker true |
| App marker | true | false |
| Browser violation | [] | script-src-elem, enforce, tačan probe URL |
| Probe HTTP broj pre/posle app pokušaja | 2→3 | 2→2 |
| HTML zaglavlja | nema CSP | aktivna CSP + nosniff + no-referrer |

Istorijski [T006 rezultat](005-phase2-production-baseline.txt) i
[ponovljen pre GREEN-a](005-phase5-production-red.txt) imaju stvaran RED.
[GREEN actual JSON](005-phase5-security-e2e-final.txt) sadrži konkretan blockedURI
`http://127.0.0.1:57234/security-probe.js` i directive `script-src-elem`.
Druga kontrolna stranica izvršava taj isti URL pre app pokušaja; nije 404/neaktivan
server/sleep. Originalne assertions su očuvane i dopunjene funkcionalnim tokom:
CSS stola primenjen, lokalni JS/CSS učitani, all-in završi partiju, validan
coaching 2/1, nepromenjen snapshot i mobile širina bez overflow-a.

## Komande i stvarni rezultati

Sve iz projektnog korena, Node 24/npm 11, fake-only.

| Komanda | Rezultat / exit | Dokaz |
|---|---|---|
| `npm.cmd run test:security` pre | 108 PASS / 0 | [preflight](005-phase5-preflight-security.txt) |
| `npm.cmd test -- tests/integration/security-budgets.test.ts tests/integration/security-admission.test.ts tests/integration/security-lifecycle.test.ts tests/integration/security-normal.test.ts tests/integration/gemini-agent.test.ts tests/unit/security-capacity.test.ts` | 68 PASS / 0 | [prethodna faza](005-phase5-previous-focused.txt) |
| `npx.cmd playwright test tests/e2e/security-rendering.spec.ts tests/e2e/security-production.spec.ts` pre GREEN | 2 rendering PASS, 1 očekivani CSP FAIL / 1 | [prvi browser](005-phase5-browser-before.txt) |
| `npx.cmd playwright test tests/e2e/security-production.spec.ts` dopunjeni test pre GREEN | 1 očekivani CSP FAIL / 1 | [RED](005-phase5-production-red.txt) |
| `npm.cmd run test:security:e2e` | build + 4 PASS / 0 | [prvi GREEN](005-phase5-security-e2e.txt) |
| `npm.cmd run test:security:e2e` sa dostupnim image probe-om | build + 4 PASS / 0 | [konačan GREEN](005-phase5-security-e2e-final.txt) |
| `npm.cmd test -- tests/ui tests/unit/security- tests/contract/security- tests/integration/security-` | 233 PASS u 19 fajlova / 0 | [security/UI](005-phase5-security-ui.txt) |
| `npm.cmd run test:e2e` prvi | 24 PASS, 1 harness teardown FAIL / 1 | [prvi full](005-phase5-full-e2e.txt) |
| `npm.cmd run test:e2e` serijski | build + 25 PASS / 0 | [full serijski](005-phase5-full-e2e-serial.txt) |
| `npm.cmd run typecheck` konačan | PASS / 0 | [typecheck](005-phase5-typecheck-final.txt) |
| `npm.cmd run lint` konačan | PASS / 0 | [lint](005-phase5-lint-final.txt) |
| `npm run build` kroz obe E2E komande | PASS / 0 | build izlaz u browser dokazima |
| `git diff --check` | PASS / 0 (samo LF/CRLF upozorenja) | [diff](005-phase5-diff-check.txt) |

[Validacija očuvanja originalnog ulaza/T16 tela i istorijskih screenshot-a](005-phase5-validation.json).

Prvi full pad: dodatna security komanda započeta pre završetka full runner-a;
oba koriste `test-results`, što je uklonilo trace fajl tokom browser teardown-a
za public status 1280px. ENOENT je harness/output collision, ne security RED ili
assertion regresija. Prvi log sačuvan; serijski full run sa finalnim testovima
prolazi svih 25. Quickstart sada zahteva serijske browser komande. Nije promenjena
produkcija/test očekivanje radi ovog pada. Istorijske feature004 PNG slike su
backup-ovane pre full suite-a i vraćene posle; nisu novi Week08 dokazi.

## Granice i sledeći korak

Browser rendering T04/T05 i CSP/header deo T16 su završeni. **Puni T16 ostaje
otvoren**: stvarno učitan server-secret/sentinel, bundle/source-map/model/events
odsustvo i greške pripadaju T025–T026. Security sink/audit/T023–T031 nisu započeti.
Nema novih paketa/provider-a, live Gemini poziva (0), .env loader-a ili pravih
ključeva, public test endpoint-a, CORS proširenja ili deployment-a.
Full npm test van tražene security/UI selekcije nije ponavljan; clean npm ci,
remote CI, audit, ljudski review/demo ostaju za kasnije taskove.
Veki je dao scope; Milanov review i samostalni doprinosi ljudi nisu potvrđeni.
Sledeći task **T023**.
