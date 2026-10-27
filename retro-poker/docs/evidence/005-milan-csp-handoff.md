# T034 — Zod startup bez eval probe

2026-10-27, Europe/Belgrade, `fix/week08-finalization`. Jedan coding agent u
Milanovoj sesiji. Korisnik je prijavio browser Issues screenshot i odobrio
lokalni commit. Vodi se nastavak postojećeg Spec Kit implement postupka:
checklist 9/9, nema extension hook-ova, T030/T031 ostaju ljudske zavisnosti.

## Problem i unapred postavljen kriterijum

Instalirani `zod` 4.6.7, `src/v4/core/util.ts` allowsEval i
`src/v4/core/schemas.ts` object inicijalizacija proveravaju `new Function`.
Biblioteka hvata EvalError i ima runtime fallback, ali CSP prekršaj se ipak
prijavljuje u browseru. To objašnjava screenshot i ne predstavlja neuspeh
Milanovog dodatnog maxSteps HTTP testa.

US3 scenario 5, plan i T034 su zapisani pre runtime izmene. Očekivanje:
normalan startup/igra/coaching bez violation-a; validacija radi; nedozvoljen
HTTP dodatak daje 400 i nula poziva; ista CSP i dalje blokira eksplicitan eval.

Prvi pokušaj testa imao je zauzet port 3001:
[setup prepreka](005-milan-csp-port-blocked.txt), nije security RED.
Milan je potvrdio da je ugasio svoj demo server. Sledeća provera sa listener-om
instaliranim pre učitavanja dokumenta daje tačan
[RED](005-milan-csp-red.txt): normalan tok 2 model koraka/1 alat radi, ali postoji
`script-src`, `blockedURI:eval`, `disposition:enforce`.

## Izmena i pouzdan browser oracle

Prvi import u `frontend/src/main.tsx` sada učitava `validation.ts` sa
`z.config({ jitless: true })`, pre konstrukcije shared ugovora.
Konfiguracija je browser-only; serverska pravila i limiti nisu promenjeni.
Nema unsafe-eval, uklanjanja šema, novih paketa ili promene CSP header-a.

Test u `tests/e2e/security-production.spec.ts` potvrđuje normalan tok bez
prekršaja i sa stvarnim alatom. Pozitivna kontrola iste poznate skripte bez
CSP-a izvrši Function i vrati 42; ista skripta iz dozvoljenog self izvora u
aplikaciji se učita, ali njeno dinamičko izvršenje ostaje blokirano konkretnom
eval/script-src CSP direktivom. [GREEN](005-milan-csp-green.txt), 1/1.

Prvi kontrolni probe pokušao je Function unutar `page.evaluate`; taj DevTools
poziv dopušta eval mimo politike stranice, pa je
[kontrolni assertion pao](005-milan-csp-probe-first.txt) iako je normalan startup
već bio bez prekršaja. Oracle je ispravljen na stvarno učitanu skriptu stranice,
bez promene CSP-a ili slabljenja očekivanja. Fajlovi prvih padova su sačuvani.

## Ljudski rezultat

Milan je poslao stvaran Console ishod 400/INVALID_INPUT,
gameUnchanged:true/usageUnchanged:true i UI završenog street coachinga sa
all_in dokazom. [Zapis](005-milan-human-check.json) čuva poreklo asistentskog
primera i granice: nije potvrđen samostalno osmišljen test ili ceo T030.
Sama Attempts tabela grupiše pokušaje po toku, modelu, koraku i ishodu;
Count 1 u jednom redu ne znači da ceo coaching ima jedan model korak.

## Provere i granice

Završni rezultati: [1040/1040](005-milan-final-tests.txt),
[typecheck exit 0](005-milan-final-typecheck.txt), [lint exit 0](005-milan-final-lint.txt),
[build + 27/27 E2E](005-milan-final-e2e.txt), uključuje 6 security browser testova.
Pratiti i [dokumentacionu proveru/hash-eve](005-milan-document-check.json).
Posle završnog E2E ponovo je vraćeno 14 generisanih istorijskih screenshotova;
svih 21 PNG/JPG provereno, nema slikovnog diff-a.
Remote CI 07db76b ostaje prethodni baseline dokaz; lokalni commit zahteva svoj
budući hosted run. Nema live poziva, novih dependency verzija, push-a ili merge-a.
Novi PowerShell tekstualni izlazi pre commita preneti su iz UTF-16 u UTF-8,
uz normalizovane završetke redova i krajnje razmake, radi čitljivog Git diff-a;
sadržaj opažanja i ishodi nisu menjani.
Lično uputstvo u ignorisanom `milan/` ostaje lokalno; korisnikov razgovor nije
prepisan kao transkript u repozitorijum. T030/T031 ostaju otvoreni.
