# Week03 eval skup — T037

Status: očekivanja ispod zaključana su 2026-09-23 pre T037 izvršavanja i pre bilo
kakve nove promene aplikacionog ponašanja. Prvi integrisani baseline je commit
`7aacb0464fea3e2efb5938d67d14731aab27be58` (291/291, E2E 2/2) i screenshot
`docs/evidence/T024-first-hand.png`. Ciljana promena za E4 već postoji kao stvarni,
sačuvani T028 ciklus: pre-fix snapshot `3cddfdb1f18e1b198596d0aeb1d7e269f96f2e3c`,
minimalni fix commit `2b34c687448d3848590a311883d461d0ad4a6eb3`. T037 ponavlja isti skup na
pre-fix snapshot-u i aktuelnom kodu; rezultati se upisuju tek posle izvršenja.

## Unapred definisani slučajevi

| ID | Početno stanje | Koraci | Očekivani rezultat | Komanda | Nezavisan oracle | Kriterijum prolaza |
|---|---|---|---|---|---|---|
| E1 — tipičan tok | Čist lokalni fixture server; nova heads-up partija sa kontrolisanim `ac23Deck` i determinističkim botom | Browser bira jednog bota, šalje call 5 i legalne check poteze do showdown-a | Ruka se završava showdown-om; stackovi su tačno 1010/990; rezultat je vidljiv | `npm.cmd run test:e2e -- tests/e2e/play-hand.spec.ts --grep "AC23" --workers=1` | Ručno zadat AC23 špil i aritmetika 2000 ukupnih žetona iz `fixtures.md`, ne izlaz engine-a | Exit 0, tačno jedan E2E scenario prolazi i prikazani stackovi odgovaraju 1010/990 |
| E2 — granični poker/config scenario | Nov engine bez postojeće partije; kontrolisan špil/RNG; zasebno botCount 1 i 5 | Kreirati obe konfiguracije i proveriti početno deljenje, pozicije, blindove i zbir stackova+doprinosa | 2/6 učesnika, dve jedinstvene karte po učesniku, zbir 2000/6000; heads-up button/SB je prvi pre-flop, BB prvi post-flop | `npm.cmd test -- tests/unit/deal.test.ts` | AC01/AC02 tabele i eksplicitni očekivani brojevi iz spec/fixtures; test ne koristi produkcijsku funkciju za očekivanje | Exit 0 i ceo `deal.test.ts` prolazi bez preskočenih testova |
| E3 — nevalidan zahtev/kontrolisana greška | Aktivna kontrolisana partija i snapshot pre zahteva | Poslati nevalidan botCount/pogrešan reset uslov, zatim nelegalan check ili stale duplikat; uporediti stanje, istoriju i RNG | HTTP 400/409 sa stabilnim kodom; nema zamene ili druge mutacije; dupli zahtev ima najviše jedan commit | `npm.cmd test -- tests/integration/actions.test.ts` | Snapshot pre zahteva i eksplicitni HTTP ugovor; oracle su identitet/version/history/RNG poređenja | Exit 0; actions suite prolazi i assertion-i potvrđuju odsustvo mutacije/curenja |
| E4 — stvarni raniji propust | Snapshot `3cddfdb…`; završena prva heads-up ruka, zatim stackovi 7/3 pre `nextHand`, pa oba blinda odmah all-in | Pokrenuti sledeću ruku i pročitati tipove javnih događaja | `hand_started`, dva `blind_posted`, tri `board_dealt`, `refund`, `settled`; blind iznosi 3 i 7 | `npm.cmd test -- tests/integration/session.test.ts` | Unapred zadat niz događaja izveden iz FR-018/AC23 i poznatih stackova/blindova, ne iz `recordInitial` | Pre-fix: exit 1 samo na E4, primljeno samo `hand_started`; posle: exit 0 i svih osam session testova prolazi |
| H1 — nezavisan holdout | Kontrolisana AC21 stanja pozicija; nije korišćen za izbor niti implementaciju E4 popravke | Pokrenuti celu tabelu dead-button/heads-up/kratkih blind prelaza | BL01–BL10, heads-up izuzetak, kratki blindovi, dead SB i prenos stackova ostaju tačni | `npm.cmd test -- tests/unit/positions.test.ts` | Fiksna BL01–BL10 tabela iz `fixtures.md` | Exit 0 i ceo holdout suite prolazi pre i posle promene |

## Pravila izvršenja

- Iste komande i ista očekivanja koriste se na oba snapshot-a; jedini test dodat
  pre-fix checkout-u jeste identičan E4 reprodukcioni test iz `2b34c68…`, bez fix-a.
- E1/E2/E3/H1 moraju ostati zeleni pre i posle. E4 mora dati očekivani RED na
  pre-fix snapshot-u i GREEN posle minimalne promene.
- Nepokrenut slučaj ostaje `NOT RUN`; rezultat se ne izvodi iz postojanja test fajla.
- T038/T039 koriste istorijski stvarni propust, ne ubacuju kvar u aplikaciju.

## Rezultati

| ID | Pre-fix `3cddfdb…` | Posle fix-a | Dokaz |
|---|---|---|---|
| E1 | PASS, E2E 1/1 | PASS, E2E 1/1 | [T037-evals](evidence/T037-evals.txt) |
| E2 | PASS, 33/33 deal testova | PASS, 33/33 deal testova | [T037-evals](evidence/T037-evals.txt) |
| E3 | PASS, actions suite | PASS, actions suite | [T037-evals](evidence/T037-evals.txt) |
| E4 | RED 7/8 pre-fix sa privremeno dodatim testom | PASS, 8/8 | [T038-red](evidence/T038-red.txt), [T039-green](evidence/T039-green.txt) |
| H1 | PASS, 16/16 positions | PASS, 16/16 positions | [T037-evals](evidence/T037-evals.txt) |


## Ispravka plana pre prvog izvršenja (nastavak 2026-09-23)

`concurrency.test.ts` nije postojao na pre-fix snapshot-u i proverava kasnije T031
popravke. E3 zato koristi postojeći `actions.test.ts` (pet istih testova), koji
pokriva opisane config/reset/check/stale/rollback slučajeve. T031 matrica ostaje
u finalnoj regresiji. Nije menjano očekivanje na osnovu rezultata eval-a.
Poređenje se izvršava na neposrednom pre/fix paru 3cddfdb/2b34c68, pa zasebno na
aktuelnom HEAD-u; time se E4 promena odvaja od kasnijeg UI/privacy/recovery rada.
Svi eval testovi zamrznuti su iz 2b34c68 i identični na oba istorijska snapshot-a.
H1 je zaseban domenski regresioni holdout, odabran u prethodnoj pripremi agenta;
nema dokaza da ga je nezavisno odabrao ljudski reviewer, niti da ranije nije pokretan.
Ne predstavlja se kao slepi, ranije neviđen test. Za strogi reviewer holdout kriterijum
potrebna je ljudska potvrda ili novi reviewer scenario pre nove ciljane promene.
E4 fixture sa 7/3 žetona je interni reproduktor redukovanog stanja, ne dokaz
celokupne partije sa početnih 2000 žetona; chip conservation proverava ostatak skupa.

## Izvršenje 2026-09-23

E1–E3 i H1 su pokrenuti identičnim komandom na pre-fix i fix snapshot-u i na
aktuelnom HEAD-u. Pre-fix commit `3cddfdb` nije sadržao E4 test, pa je test
privremeno dodat samo u izolovani worktree; tada je dobijen stvarni RED 7/8 sa
primljenim samo `hand_started`. Fix commit `2b34c68` daje 8/8. Aktuelni HEAD daje
337/337 ukupno i E4 8/8. H1 nije slepi ljudski holdout, već unapred izabrani
domenski regresioni skup; ljudska nezavisna potvrda nije dostupna.