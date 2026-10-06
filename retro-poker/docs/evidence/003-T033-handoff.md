# T033 — kanonski izbor dokaza u Gemini adapteru

Datum: 2026-10-06 Europe/Belgrade. Jedan coding agent; početni git status čist.
Korisnik opisuje više uzastopnih neuspeha, pa jedan uspeh. Odbijanje nevalidnog
saveta je ispravno; ova učestalost je problem pouzdanosti integracije.

## Potvrđena dijagnoza i granica dokaza

Poslati početni DTO imao je status created i nulte brojače. Završni DTO i lokalni
read-only GET `/api/game/coach/0ecf2080-64a7-4aaa-98ef-e5e15ed1831a` potvrđuju
failed/malformed_output/evidence_rejected, 2 model koraka/2attempts/1tool.
Alat je vratio validiran neprazan rezultat; oba provider odgovora prošla su neutralni
CoachModelStep oblik, a završna contextual provera odbila je final. Dodatni
CoachResult completion/oblik kriterijumi i membership mogu dati istu kategoriju.
Raw final nije sačuvan: tačno decisionRef/factCode/finding polje nije utvrđeno.
sampleLimited znači ograničen uzorak, ne uzrok odbijanja.

Dosadašnji adapter tražio je da model ponovo napiše originalne UUID reference i
JSON tekst činjenice. Offline primer `finding: 'flop'` umesto originalnog
`finding: '"flop"'` prolazi model shape, a biva odbijen u završnom validatoru.
To je stvarna reprodukcija mehanizma u postojećem kodu, ne rekonstrukcija starog
Gemini odgovora. Ne pripisujemo izmišljeni raw sadržaj korisnikovom run-u.

## Promena

Pre koda ažurirani spec/plan/tasks/GAME_SPEC/data-model. Gemini transport koraka2
dobija kopiju validiranog toolResult-a sa evidenceIndex oznakama svake činjenice.
Model bira do10 integer indeksa. Adapter proverava strict final/refusal oblik i
opseg indeksa, zatim prenosi originalne decisionRef/factCode/finding vrednosti.
Neutralni CoachModelStep proverava completion/evidence duplikate/granice, a postojeći
orchestrator i final validator ponovo proveravaju članstvo dokaza i lifecycle.
Ne bira se default dokaz, ne popravlja se modelom napisani finding, nema dodatnog
retry-ja/poziva. Nevalidni indeksi/duplikati/tipovi/raw polja se odbijaju.
Originalni i obogaćeni kontekst imaju32768-byte cap. Tool result ostaje20480-byte.
Nema izmene engine-a/UI-ja/javnog DTO-a/neutralnog provider ugovora/budžeta.

## Stvarne provere

Node v24.20.0, npm11.19.0. Sve komande iz retro-poker/.

| Provera | Stvarni rezultat | Dokaz |
|---|---|---|
| npm.cmd test -- tests/integration/gemini-agent.test.ts tests/integration/agent-run.test.ts | RED3FAIL/68PASS, exit1 | [RED](003-T033-red.txt) |
| Isti fokus + tests/unit/agent-final.test.ts | Prvi GREEN91/91, exit0 | [GREEN](003-T033-green.txt) |
| npm.cmd test | 852/852,58fajlova,exit0 | [Regresija](003-T033-regression.txt) |
| Fokus posle holdout-a i korekcije test zapisa | 98/98,exit0 | [Završni GREEN](003-T033-green-final.txt) |
| npm.cmd run typecheck | exit0 | [Typecheck](003-T033-typecheck.txt) |
| npm.cmd run lint | exit0 | [Lint](003-T033-lint.txt) |
| npm.cmd run build | exit0 | [Build](003-T033-build.txt) |

Početni [lint](003-T033-lint-initial.txt) i [typecheck](003-T033-typecheck-initial.txt)
nisu behavior RED: newline tagged-call stil, literal escaping i optional undefined
u novim testovima. Ispravljeni bez slabljenja oracle-a. Puna suite je pokrenuta pre
tih sintaktičkih/tip korekcija; završni98fokus/typecheck/lint/build proveravaju final.

Testovi uključuju izbor više činjenica iz različitih odluka, očuvanje navodnika,
složenog JSON-a/Unicode/newline, poslednji indeks49 iz50facts, empty completion,
insufficient/refusal, vanopsežne/duple/pogrešno tipizirane indekse i extra polja.
Real adapter sa stub SDK-om kroz orchestrator potvrđuje2steps/2calls/1tool,
jedan terminalni commit i nepromenjeno poker/facts stanje. Failure takođe nema
retry-ja/replay-a alata. Raniji foreign ref/factCode/finding validator testovi prolaze.

## Ograničenja i handoff

Novi live run-ovi0. Nema novog POST/retry zahteva ili čitanja ključa; korisnikov
GET bio je read-only. Live stopa uspeha posle promene još nije izmerena. Članstvo
dokaza ne dokazuje stratešku ispravnost slobodnog obrazovnog summary/recommendation.
Browser E2E nije ponavljan: UI se ne menja i korisnik koristi aktivne portove.
Nijedan dev server nije ručno zaustavljen/restartovan; backend watcher može sam
učitati izmene i pri tome izgubiti memorijsku partiju prema postojećem dizajnu.
Nema commit/push/deploy-a ili subagenata. requirements checklist12/12 read-only;
Spec Kit prerequisite exit0 posle process-local execution-policy i path korekcije.
extensions.yml/research.md/quickstart.md ne postoje. T033 implementacija završena;
T027 ljudski walkthrough/review i dalje odloženi, doprinos drugog člana unknown.
