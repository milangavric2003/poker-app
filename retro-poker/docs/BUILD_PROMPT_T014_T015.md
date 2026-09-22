# T014–T015 — član B, 2026-09-22

Korisnik preuzima isključivo T014–T015 na postojećoj grani `vedran`.
Commit, push i promena grane nisu odobreni; korisnik ih radi sam.
Polazni HEAD: `29c3d04a5f324c3508eb8e304d94478d81bb8e4a`; worktree je bio čist.

Zahtev: prvo potvrditi T006–T013, zatim stvarni RED u `tests/unit/deal.test.ts`
za AC01, AC02, validne AC03, 1–5 botova, početni button na čoveku, dva kruga
deljenja (heads-up prvo BB), 52 jedinstvene karte, burn/board 3–1–1,
preskakanje folded/all-in učesnika i kontrolisan tok do settlement-a.
Sačuvati RED pre GREEN implementacije u `cards.ts`, `positions.ts`, `hand.ts`.
Engine ostaje bez HTTP-a, UI-ja i bot strategije, sa ubrizganom slučajnošću.
Bez T016–T019, produkcionog test endpoint-a, istorije i rotacije narednih ruku.

Plan:
1. Proveriti pravila, checklist i regresiju zavisnosti.
2. Napisati testove sa unapred zadatim ishodima i minimalne importabilne stubove;
   pokrenuti i sačuvati RED i stubove radi ponovljivosti.
3. Implementirati Fisher–Yates, početne pozicije, blindove/deljenje i čiste
   tranzicije kroz postojeći betting i settlement. Interni kontrolisani prefiks
   dopuniti do 52 karte, prema fixtures.md; ne menjati javni ugovor.
4. Fokusirani GREEN, ceo npm test, typecheck, lint i build; upisati stvarne dokaze,
   završene taskove i ograničenja. Ne izmišljati ljudski review.

Oracle: AC23 `Kc As Kd Ah / 6c / 2c 3d 7h / 8c / 9s / Tc / Jc`;
čovek call5, zatim check do kraja daje 1010/990. Početni fold daje 995/1005,
refund BB5, pot10 i prazan board. Heads-up all-in/call daje 2000/0.
Četiri učesnika: `Kc Qc Jc As Kd Qd Jd Ah / 6c / 2c 3d 7h / 8c / 9s / Tc / 4c`;
p0 AA, p1 KK, p2 QQ, p3 JJ. Snapshot stackova 1990/1000/1000/10 čuva ukupno4000.
p3 all-in10, p0 call10, p1 fold5, p2 check; na flop-u igraju samo p2 pa p0.
Posle p2 bet20/p0 call20 i check-ova, doprinosi30/5/30/10 daju potove20/15/40;
p0 dobija75, stackovi2035/995/970/0 (zbir4000).

Pretpostavke: postojeće specifikacije su dovoljne; korisnikov zahtev menja vlasnika
samo T014–T015. Početak je domenska funkcija, identitet ruke prima od pozivaoca;
produkcijski seed i session/bot orkestracija pripadaju kasnijoj integraciji.
