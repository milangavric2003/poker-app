# Week08 — podela rada i odobrena isporuka

**Završno stanje:** PR #12 i #11 spojeni su, PR #9/#10 zatvoreni,
main `c5038bb` ima uspešan Windows/Linux CI. T031 dokumentacioni paket je
završen pre prezentacije po Milanovom zahtevu; T030 ostaje za izvođenje.
Korisnik je 27.10 potvrdio da su Vedran i Milan lokalni demo isprobali zasebno
i zajedno i da su spremni za formalnu prezentaciju 28.10. Ta potvrda ne
zamenjuje zapis pojedinačnih negativnih testova i formalne odbrane.
Milan dodatno potvrđuje da su obojica predložila i lokalno izvršila negativnu
proveru povećanja `maxSteps`. [Raniji konkretni zapis](005-milan-human-check.json)
čuva Milanov ishod uz Codexovo uputstvo; Vedranov zaseban izlaz nije sačuvan.
[Konačni paket i linkovi](005-week08-submission.md).
Odeljci ispod čuvaju prethodni checkpoint pre objave i tadašnji plan.

2026-10-27, Europe/Belgrade. Checkpoint pre objavljivanja:
`fix/week08-finalization`, tehnički commit `1d8124c`.
Milan je izričito odobrio push, potrebne PR-ove i spajanje u main.

## Potvrđen doprinos

Milan je u razgovoru potvrdio podelu rada i dodatno ručno odigrao/proverio
aplikaciju kroz `npm run dev`: prijavio je da radi kako treba. To je ljudski
smoke rezultat, bez izmišljenog broja partija, merenja ili provider poziva.

| Član | Git dokaz | Sadržaj i provera |
|---|---|---|
| Vedran (Veki u Git autorstvu) | Week08 commitovi `0d361f1`, `d08e06c`, `2b8ea4e`, `cc0d3fb`, `9d89726`, `e498a06`, `d508f13`, `07db76b` na `week08-init` | Feature/spec, fake harness, bezbednosne kontrole/testovi, audit i završni tehnički dokazi; konkretne komande i uloga Codexa ostaju u phase handoff-ovima. |
| Milan | `1d8124c` na `fix/week08-finalization`, uz Codex pomoć | Reprodukcija sporog polling-a i popravka, novi negativni/regresioni UI testovi, fake-only ručni profil, Zod/CSP startup popravka i browser test sa pozitivnom kontrolom. |

Milan je takođe stvarno izvršio vođeni maxSteps HTTP negativni primer i
normalan street coaching: [prijavljeni rezultati](005-milan-human-check.json).
Samostalno igranje kroz dev režim i potvrđena podela doprinosa dopunjuju taj
zapis. Commit autorstvo i korisnička potvrda pripisuju doprinos; ne predstavljaju
dokaz osam minuta demo-a ili individualne provere koja još nije izvedena.
Istorijske privatne frontend/summary dorade nisu dodatno pripisane W08 radu.

## Tehnički checkpoint

[1040/1040 testova](005-milan-final-tests.txt),
[build i 27/27 browser provera](005-milan-final-e2e.txt),
[typecheck](005-milan-final-typecheck.txt) i [lint](005-milan-final-lint.txt) PASS.
[CSP RED/GREEN i ograničenja](005-milan-csp-handoff.md).
Ovaj nastavak menja samo dokumentaciju. Ne ponavlja live pozive ili testove
bez nove runtime izmene. Lokalna dokumentaciona provera čuva linkove i task status.

## Odobreni Git tok

1. Objaviti završnu granu i PR ka `week08-init`; sačekati CI tačnog head SHA.
2. Sačuvati merge istoriju oba autora; ažurirati postojeći
   [PR #11](https://github.com/milangavric2003/poker-app/pull/11) na main.
3. Proveriti CI novog week08 head-a, spojiti #11, pa proveriti main CI.
4. Zatvoriti [PR #9](https://github.com/milangavric2003/poker-app/pull/9):
   izvršne test/CI promene su već prenete kroz T002. Njegove istorijske W05
   dokaze ne prepisivati preko W08; originalna grana ostaje sačuvana.
5. Zatvoriti [PR #10](https://github.com/milangavric2003/poker-app/pull/10),
   čiji je `add-modifications` već predak Week08 grane. Ostale stare PR-ove
   ne menjati u ovom nalogu. Završni merge/CI ishodi vidljivi su na tim PR-ovima
   i u GitHub Actions za konkretne SHA-ove.

Ovaj checkpoint ne tvrdi da su budući push/merge ili remote CI već izvršeni.
T030 ostaje otvoren za preostali stvarni demo/individualnu varijantu i potvrde;
T031 zavisi od tog završetka. Tehnički merge ne označava automatski nastavnu
predaju završenom. Nema dodatnog odobravanja potrebnog za ovde navedene Git radnje.
