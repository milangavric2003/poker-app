# Week04 — ručna i automatska provera nakon merge-a, 2026-09-29

## Poreklo i verzija

Ovaj zapis prenosi korisnikovu potvrdu zajedničke ručne provere sa kolegom i izlaze
komandi koje je korisnik pokrenuo u `D:\AIBootcamp\week3-4\retro-poker`.
Coding agent je pročitao priloge i dokumentovao nalaze; u ovom radu nije ponavljao
testove, igrao partiju niti pravio nove Gemini pozive.

Pri beleženju, grana je `ai-integ`, a HEAD je
`07f9b1f401d15e9253cbf0d38767f4aa37cee524` —
`Merge fix-timeout-error into ai-integ preserving AI waiting and analysis`.
Korisnik navodi da je proveravao spojeni kod. Prilozi ne sadrže Git SHA, pa ovaj
HEAD označava stanje pri dokumentovanju, a nije nezavisni dokaz tačnog SHA svih proba.

## Ručna potvrda korisnika i kolege

- Spojene izmene su zajednički proverili i igra radi kako očekuju.
- Dobili su uspešne Gemini poteze i završnu analizu.
- Korisnik potvrđuje da se može igrati partija od nekoliko desetina minuta.
  Tačno trajanje, broj partija, broj botova i konkretne odigrane ruke nisu navedeni.
- Preostale greške korisnik opisuje kao refresh i manje UX probleme koji, prema
  njihovom opažanju, ne utiču na ponašanje igre. Korisnička odluka je dorada u Week05.

To je prijavljena ljudska potvrda uspešnog live toka. Za ovu sesiju nisu dostavljeni
screenshot, model ID, broj API poziva, tokeni, latencije ni cena; nisu preuzeti iz
drugog smoke-a. Uloge A/B i pojedinačni doprinosi ručnoj proveri nisu precizirani.
Odvojeni raniji tehnički dokaz je [Gemini Lite uspeh](002-gemini-lite-success.md);
raniji neuspeh u [live smoke zapisu](002-live-smoke.md) ostaje istorijski rezultat.

## Automatske provere koje je korisnik dostavio

| Komanda | Dokazani rezultat |
|---|---|
| `npm.cmd test`, prvi prolaz, 17:44:16 | 535 prošlo, 1 pao; 41/42 fajla prošla; 15.90 s. HTTP 200 scenario u `gemini-live-smoke.test.ts` prekoračio je 5000 ms. |
| `npm.cmd test -- tests/integration/gemini-live-smoke.test.ts`, 17:49:11 | 2/2, 1 fajl; ukupno 3.59 s. HTTP 200: 1622 ms; HTTP 503: 1569 ms. Izlaz dostavljen u poruci. |
| `npm.cmd test`, ponovljeni puni prolaz, 17:49:39 | 536/536, 42/42 fajla; 17.09 s. HTTP 200: 4736 ms; HTTP 503: 4504 ms. |
| `npm.cmd run test:e2e` | 10/10, jedan worker, 25.4 s. |
| `npm.cmd run typecheck` | Komanda se završila i vratila PowerShell prompt bez prikazanih grešaka. |
| `npm.cmd run lint` | Komanda se završila i vratila PowerShell prompt bez prikazanih grešaka. |
| `npm.cmd run build` | Vite: 120 modula, built in 525 ms; nema prikazanih grešaka. Skripta navodi i serverski TypeScript build. |

Korisnik nije dostavio `$LASTEXITCODE` vrednosti; numerički exit kodovi se ne
pretpostavljaju. Izlazi potvrđuju uspešan ponovljeni test prolaz i prethodno navedene
provere. Ovo nije novi TDD RED/GREEN ciklus: između pokušaja nije prijavljena
popravka implementacije. Naziv smoke testa ne znači da je to live Gemini poziv;
test navodi simulirani offline HTTP.

Izvorni prilozi su sačuvani sa neizmenjenim sadržajem redova (CRLF normalizovan u LF,
dodat završni newline):

- [Prvi prolaz i ostale komande](002-post-merge-first-run.txt), prilog
  `75cf4265-6b7a-40e7-8ab6-1a730edbbad5/Pasted text.txt`.
- [Ponovljeni puni prolaz](002-post-merge-rerun.txt), prilog
  `4b4c6b2d-5638-4032-b225-9868c8cb629a/Pasted text.txt`.

## Stavke za Week05

1. **Refresh i manje UX smetnje** — prijavljeno od korisnika; prema ručnoj proveri
   nema uticaja na ponašanje igre. Konkretni koraci reprodukcije, očekivani i stvarni
   prikaz, učestalost i browser nisu dostavljeni. Pri doradi prvo zabeležiti te
   podatke i dodati odgovarajući test za konkretan kvar.
2. **Povremeni timeout smoke testa** — dokumentovan pad na 5000 ms, zatim zaseban i
   puni prolaz. Poslednjih 4736 ms je blizu limita. Sporiji rad cele matrice podržava
   sumnju na osetljivost na opterećenje, ali uzrok nije potvrđen i problem nije
   označen popravljenim. Proveriti podprocese/setup i opravdan timeout testa.

Week04 ima prijavljen uspešan ručni live tok i uspešan ponovljeni automatski test
prolaz nakon merge-a. Navedene UX i test-stabilnost stavke ostaju za praćenje;
istorijski T026 RED nedostatak ostaje prema ranijem reconciliation zapisu.
