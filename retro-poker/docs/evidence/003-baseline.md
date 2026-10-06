# Week04 baseline pre Week05 implementacije — T006

Datum: 2026-10-04 (Europe/Belgrade). Jedan coding agent; bez aplikacionih izmena.
T005 preflight: pregledani spec/plan/tasks/GAME_SPEC, isti policy limiti i enumerisani
stop ugovor; T004 prompt i stvarni context manifest postoje. Kriterijumi dokumentacije
ne dokazuju runtime coach. Nijedan Week05 behavior task nije pokrenut.

## Ponovljivi snapshot

Git koren: `D:/AIBootcamp/week3-4`; projekat: `retro-poker/`.
HEAD: `b0b02cab1e4491d5cdf65638d051c13d213f4eff` (`card looks modification`).
Node v24.20.0, npm 11.19.0; package.json 0.1.0, Vitest 5.0.1.
`git diff -- backend frontend shared tests package.json package-lock.json` je prazan,
exit 0. Zatečeni untracked feature 003 i prompt su dokumenti, nema coach/agent koda.
Ovaj HEAD identifikuje testirani aplikacioni baseline, ne čisti radni direktorijum:
korisničke .gitignore/AGENTS/GAME_SPEC izmene i novi Week05 dokumenti sačuvani su.
Ne postoji novi commit/tag ovog rada. Ponoviti aplikacione provere na tom HEAD-u u
posebnom checkout-u uz Node/npm verzije i lockfile; ne resetovati korisnički worktree.
Instalacija iz čistog checkout-a nije ovde proverena, korišćene su postojeće zavisnosti.

Snapshot komande i stvarni izlazi: [snapshot log](003-baseline-snapshot.txt).
Git rev-parse/status/stat, application diff i node/npm verzije izvršeni su;
snapshot log beleži poslednji exit 0 i application diff exit 0, ne pojedinačne
numeričke exit statuse svakog ranijeg Git ispisa. LF/CRLF warning nije test neuspeh.

## Stvarno pokrenute provere

Očekivanje pre izvršenja: potvrditi aktuelno offline Week04 ponašanje i proveriti
ranije prijavljenu osetljivost smoke testa; ne proizvesti ili popravljati bug.

| Tačna komanda | Datum | Stvarni rezultat / exit | Šta dokazuje | Šta ne dokazuje |
|---|---|---|---|---|
| `npm.cmd test -- tests/integration/gemini-live-smoke.test.ts` | 2026-10-04 | 2/2, 1 fajl, 2.36 s ukupno; exit 0 | Postojeći HTTP 200/503 offline stub i runner ishodi prošli u zasebnom izvršenju | Nije live Gemini; ne dokazuje trajnu stabilnost |
| `npm.cmd test` | 2026-10-04 | 552/552, 43 fajla, 9.65 s ukupno; exit 0 | Postojeća unit/contract/integration/UI regresija, uključujući analysis i dashboard, prolazi na ovom baseline-u | Ne dokazuje browser E2E, live provider ili budući Week05 coach |
| `npm.cmd run typecheck` | 2026-10-04 | Oba TypeScript noEmit projekta bez grešaka; exit 0 | Aktuelni TS ugovori su tipovno konzistentni | Ne dokazuje runtime validaciju ili build |
| `git diff --check` | 2026-10-04 | exit 0; LF/CRLF upozorenja | Nema prijavljenih whitespace grešaka tracked diff-a | Sam ne proverava untracked Markdown, linkove ili behavior |
| PowerShell audit sačuvan u doc-check logu | 2026-10-04 | 41 lokalni link/anchor, 25/25 FR redova; ponovljeni audit exit 0 | Lokalne putanje i anchor-i u novim/izmenjenim dokumentima, prazan aplikacioni diff | Ne proverava spoljne web linkove niti sve istorijske odeljke manifesta |

Stvarni logovi: [samostalni smoke](003-baseline-smoke.txt),
[puna regresija](003-baseline-tests.txt), [typecheck](003-baseline-typecheck.txt).
Tačan dokumentacioni audit i rezultat su u [doc-check logu](003-baseline-doc-check.txt).
Prvi audit je izašao sa 1 jer je PowerShell Stop tretirao Git LF/CRLF stderr warning
kao exception; link/FR provere već su prošle. Sa normalnom obradom warning-a isti
sadržinski audit završio je exit 0. Taj neuspeh nije novi baseline bug niti RED.
PowerShell `>>` je napravio mešoviti UTF-8/UTF-16 log; tekstualni segmenti su dekodirani
odgovarajućim encoding-om i normalizovani u UTF-8, bez ponovnog testa ili promene
rezultata. Jedan pomoćni node -e pokušaj čitanja encoding-a pao je exit 1 zbog
PowerShell/native quote parsing-a; to nije test/proizvodni kvar. Korekcija čitanja
bajtova i normalizacija u PowerShell-u uspeli su.

Nisu pokrenuti: npm ci, lint, build, test:e2e, dev, diagnose:gemini, smoke:gemini,
Week05 testovi ili novi live provider zahtev. Nema novog screenshot-a/browser provere.
Neophodni dokumentacioni pregledi koristili su Get-Content, rg, Test-Path i Git diff/
status, uz proveru 25 FR redova i lokalnih Markdown linkova. Ne predstavljaju RED/GREEN.

## Poznate Week04 stavke i ograničenja

Pregledani relevantni [EVIDENCE_003](../EVIDENCE_003.md), [AI_USAGE_LOG](../AI_USAGE_LOG.md),
[post-merge](002-post-merge-verification.md), [status audit](002-task-status-audit.md)
i aktuelni [Week04 taskovi](../../specs/002-week04-ai-integration/tasks.md).

1. **Refresh/manje UX smetnje** iz 2026-09-29: nema konkretnih koraka, očekivanog i
   stvarnog prikaza ili browser-a. **Aktuelno baseline ograničenje nije nezavisno
   potvrđeno.** Precizniji dashboard refresh problem kasnije je popravljen UR1/UR2
   2026-10-02 sa 4 stvarna RED pada →11/11 GREEN; aktuelna puna regresija uključuje
   dashboard. Ne proglašavati opštu prijavu istim kvarom ili svim UX problemima rešenim.
2. **Smoke test stability**: ranije HTTP 200 scenario prekoračio 5000 ms u celoj
   matrici; naredni solo i puni prolaz prošli, do 4736 ms. Aktuelni test ima
   spawnSync timeout 10000 ms; taj podproces limit nije Vitest scenario timeout.
   U današnjem solo i punom prolazu pad nije reprodukovan; **aktuelna nestabilnost
   nije nezavisno potvrđena**, a dva prolaza ne isključuju povremeni kvar.
   Nema izmene timeout-a/assertion-a/koda da bi rezultat prošao.
3. **Eliminacija i obračun**: konkretan raniji Invalid chips or player propust ima
   zabeležen fake-provider RED/GREEN 2026-10-02; aktuelna regresija prolazi.
   To je popravljena istorijska stavka, ne novi Week05 baseline problem.
4. **T026/T044 istorijski RED gap**: stari audit odeljci ostavili su taskove otvorene;
   njegov kasniji reconciliation i aktuelni tasks imaju [x] uz izričito ograničenje
   da prvobitni puni RED nedostaje. Današnji zeleni test ga ne rekonstruiše.

Ne postoji dokaz novog aktuelnog UX/test-stability buga u ovom pripremnom razgovoru.
Nema promene aplikacije radi nalaza, nove hipoteze bez signala, niti lažnog eval-a.
Live rezultati iz istorijskih dokumenata zadržavaju svoje datume/poreklo.

## Handoff T006

Promenjeno: dokumenti T002–T005, ovaj baseline i stvarni lokalni logovi. Kod, testovi,
package/lock i poker pravila nisu menjani; korisnički diff očuvan. Ljudski doprinos
ovom bloku: korisnik je zadao obim; review/doprinos kolege nije potvrđen. Coding
trošak/tokeni nepoznati; novih live agent run-ova 0.

Sledeći član: pročitati T007 i dozvoljene putanje, requirements matricu, plan,
data-model/coach-http i ovaj snapshot. Najpre stvarni fake-first schema/contract RED
sa unapred zadatim očekivanjima; ne počinjati T008 pre dokaza T007. Zabeležiti svoj
driver/status i stvarne komande. UX dorada zahteva konkretnu reprodukciju; nije
automatski deo coach taska. T007–T027 ostaju otvoreni; runtime i peer review tek slede.
