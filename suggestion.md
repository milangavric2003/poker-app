# Predlog podele rada za Retro AI Engineering Challenge

Predlog je da ti vodiš logiku igre i backend, a kolega frontend, korisnički tok i demonstraciju. Obojica treba da radite specifikaciju, TDD i pregled rezultata. Tako svako ima svoj deo, a obojica možete da pokažete znanje koje zadatak traži.

Predlog je zasnovan na studentskoj skripti `week-03-week-04-pdf-review/materijali-za-studente/week-03-studentska-skripta.pdf` i opisu izazova `week-03-week-04-pdf-review/materijali-za-studente/week-03-week-04-retro-ai-engineering-challenge.md`.

## Važne napomene iz zadatka

- SDD i TDD su deo očekivanog načina rada: specifikacija i kriterijumi prethode implementaciji, a za izabrano ponašanje prvo pišete i pokrećete test koji pada.
- Spec Kit je opisan kao alat za taj postupak. U dostavljenim dokumentima nema izričitog zahteva da mora biti instaliran. Ako je predavač to dodatno zadao, treba ga uključiti.
- Zaseban backend nije obavezan zahtev izazova. Preporučena je mala browser aplikacija. Ako želite frontend i backend, backend treba ograničiti na stanje igre, pravila i mali API, bez baze, naloga i deploymenta.
- AI analiza ruke pripada Week04. Za Week03 dovoljno je da igra funkcioniše, ima strukturisane ugovore, runtime validaciju i ponovljiv dokaz.
- Zadatak traži zamenu uloga vozača i posmatrača tokom većih blokova rada. Podela ispod označava ko vodi oblast; drugi član proverava očekivanja, prompt, diff i rezultat.
- Poker nije među navedenim primerima retro igara. Pošto zadatak traži odobrenje predavača za neobičan domen, preporuka je da mu pre veće implementacije predstavite kratak scope retro poker igre.

## Granica između Week03 i Week04

| Week03 | Week04 |
|---|---|
| Jedan čovek protiv 1–5 programskih botova | AI rezime završene ruke |
| Deljenje, potezi, ulaganje i određivanje pobednika | Jedan read-only alat za čitanje istorije ruke |
| Jednostavna pravila ponašanja botova | Provera predloženog alata i argumenata |
| Prikaz rezultata i istorije poteza | Strukturisana analiza uz validaciju |
| Testovi, eval skup, baseline i kontrolisana popravka | Mock AI, negativni slučajevi i kontrolisana greška |

Jedan igrač i pet botova čine sto sa šest mesta, što je uobičajen *6-max* format. Postoje i stolovi sa devet ili deset igrača; šest nije univerzalni maksimum.

Referenca: [PokerStars — Full Ring, 6-Max and Heads-Up](https://www.pokerstars.com/poker/learn/strategies/how-many-people-in-a-game-of-poker-full-ring-6-max-and-heads-up/)

## Preporučeni scope pokera

Najvažnija odluka o obimu je varijanta pokera. Potpun No-Limit Texas Hold’em uključuje all-in, side potove, minimalno podizanje uloga i druga granična pravila. To znatno povećava posao.

Za ovaj zadatak preporučena je pojednostavljena trening varijanta:

- igra se jedna ruka po partiji;
- koriste se fiksna ulaganja;
- broj podizanja uloga je ograničen;
- svaki igrač ima početni stack dovoljan da pokrije maksimalno ulaganje u jednoj ruci;
- all-in i side potovi su van scope-a za Week03;
- nema pravog novca, naloga, multiplayera, baze, leaderboarda i deploymenta.

Ovu verziju treba jasno nazvati pojednostavljenom varijantom Texas Hold’em pokera. Ako izaberete pun No-Limit Texas Hold’em, all-in, side potovi i sva pravila minimalnog raise-a postaju obavezna implementacija i zahtevaju dodatne testove.

## Predlog podele posla

| Oblast | Ti vodiš | Kolega vodi |
|---|---|---|
| Specifikacija | Pravila, faze ruke, dozvoljene akcije, pobeda i nerešen ishod | Ekrani, kontrole, poruke i korisnički scenariji |
| Logika | Špil, deljenje, redosled poteza, ulaganja, pot i prelazak između faza | Poređenje poker kombinacija kao izdvojen i testiran modul |
| Botovi | Jednostavna strategija koja bira samo dozvoljene poteze | Prikaz njihovih poteza i prelaza između igrača |
| Backend | Stanje u memoriji, validacija akcija i mali API | API klijent i obrada odgovora i grešaka |
| Frontend | Pregled da UI pravilno koristi stanje igre | Retro sto, karte, žetoni, izbor broja botova, dugmad i rezultat |
| Testovi | Pravila igre, validacija i očuvanje ukupnog broja žetona | Kombinacije, UI ponašanje i prolazak kroz jednu celu ruku |
| Dokazi | Test rezultati, runtime validacija i tehničko ograničenje | Demo scenario, screenshotovi i tabela eval rezultata |
| Dokumentacija | Vodiš `GAME_SPEC.md` i tehnički plan | Vodi `EVALS.md`, `README.md` i sastavljanje `EVIDENCE_003.md` |

Svako piše testove i beleži AI upotrebu za svoj deo. Dokumentaciju koju jedan sastavlja drugi proverava i dopunjava svojim stvarnim rezultatima.

## Zajednički ugovori pre odvajanja rada

Pre rada na odvojenim delovima zajedno treba da dogovorite četiri ugovora:

- `GameConfig`: broj botova i dozvoljena podešavanja;
- `PlayerAction`: potez i eventualni iznos;
- `GameView`: stanje koje frontend sme da vidi, uključujući dozvoljene akcije;
- `HandResult`: pobednik ili pobednici, raspodela pota i istorija poteza.

Frontend zatim može da se razvija uz unapred pripremljene primere ovih objekata. Backend mora da proverava akcije čak i kada ih UI onemogućava. Skrivene karte protivnika ne treba slati u `GameView`, a bot treba da odlučuje na osnovu svojih karata i javnih informacija.

## Predloženi redosled rada

1. Zajedno zaključajte scope i Definition of Done. Napišite `GAME_SPEC.md`, početni build prompt i context manifest.
2. Postavite instrukcije i Spec Kit. Napravite plan i male zadatke sa vlasnikom, zavisnostima i kriterijumom završetka.
3. Napravite jednu celu ruku protiv jednog bota. Povežite UI i logiku rano, pa zatim proširite podršku na 1–5 botova.
4. Sačuvajte baseline. Koristite Git commit ili tag i zabeležite tačan prompt, kontekst, komande, rezultate i screenshot.
5. Izaberite stvaran propust i jednu kontrolisanu promenu. Ponovite isti eval skup pre i posle promene.
6. Zamenite se u proveri. Kolega ponavlja tvoje testove, a ti njegov demo, koristeći zapisane komande.

## Predlog obaveznog eval skupa

| Slučaj | Očekivanje |
|---|---|
| Tipičan: čovek protiv dva bota | Ruka se završava, rezultat i žetoni su konzistentni |
| Granični: jedan i pet botova | Tačan broj mesta, karata i ispravan redosled poteza |
| Nevalidan: `botCount: 0`, `6` ili `"3"` | Runtime validator odbija konfiguraciju uz jasnu poruku |
| Raniji propust iz baseline-a | Isti scenario posle ciljane popravke daje očekivan rezultat |

Poslednji slučaj treba popuniti stvarno pronađenom greškom. Ne treba unapred izmišljati neuspeh radi demonstracije. Dodajte i jedan nezavisan primer koji niste koristili za doradu.

## Spec Kit i SDD tok

Spec Kit organizuje specifikaciju, plan i zadatke; tim i dalje mora da pregleda i proveri rezultate.

Početni setup za novi projekat:

```powershell
uv tool install specify-cli
specify init retro-poker --integration codex
```

Python i `uv` su dostupni u trenutnom okruženju, dok komanda `specify` trenutno nije pronađena u PATH-u.

U Codex integraciji koraci se pozivaju u razgovoru kao:

```text
$speckit-constitution
$speckit-specify
$speckit-plan
$speckit-tasks
$speckit-implement
$speckit-converge
```

TDD treba izričito zadati u projektnim principima i u pojedinačnim zadacima.

Reference:

- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Spec Kit — Codex integracija](https://github.github.io/spec-kit/reference/integrations.html)

## Instruction fajlovi

Počnite jednim kratkim `AGENTS.md` fajlom u korenu repozitorijuma. U njemu treba navesti:

- relevantne putanje i strukturu projekta;
- komande za pokretanje, testiranje, lint i typecheck;
- granice Week03 funkcionalnosti;
- obavezni TDD tok: RED → GREEN → REFACTOR;
- zahtev da se ne menja scope bez eksplicitnog razloga;
- zahtev da se čuvaju stvarni rezultati testova i evala;
- zabranjene oblasti i putanje;
- kriterijume koji određuju kada je zadatak završen.

Codex podržava projektne instrukcije i specifičnije instrukcije po direktorijumima.

Referenca: [OpenAI — Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

## Primer task prompta za Codex

```text
Implementiraj samo zadatak odbijanja nedozvoljenog check poteza.

Kontekst:
- AGENTS.md
- GAME_SPEC.md: pravila ulaganja
- ugovor PlayerAction
- postojeći testovi akcija

Pre implementacije sažmi razumevanje, plan i pretpostavke.

Očekivanje:
Kada igrač mora da doplati ulog, check se odbija.
Stanje igre i broj žetona ostaju nepromenjeni.

Prvo napiši i pokreni test koji pada iz očekivanog razloga.
Zatim implementiraj najmanju potrebnu promenu.
Menjaj samo validator akcija i odgovarajuće testove.

Vrati diff, komande, stvarne rezultate i preostala ograničenja.
```

## Priprema za Week04

Za Week04 rezime može prirodno da koristi read-only alat `get_completed_hand`:

- ti vodiš alat, ugovor, allowlist i runtime validaciju;
- kolega vodi prikaz strukturisane analize u interfejsu;
- testovi koriste fake ili mock AI pre bilo kakvog live provider poziva;
- aplikacija proverava predloženi tool call i njegove argumente pre izvršenja;
- alat samo čita završenu ruku i ne menja stanje igre.

Već u Week03 treba čuvati istoriju poteza. Kasnija procena dobrih i loših odluka treba da koristi informacije dostupne igraču u trenutku odluke, uz jasno navedenu neizvesnost. Sam dobitak ili gubitak ruke nije dokaz kvaliteta poteza.

## Week03 Definition of Done

Week03 verzija može da se smatra završenom kada imate:

- `GAME_SPEC.md` sa malim scope-om i proverljivim Definition of Done;
- `BUILD_PROMPT_V1.md` sa ciljem, granicama, relevantnim kontekstom i proverama;
- `CONTEXT_MANIFEST.md` sa uključenim i izostavljenim izvorima, prioritetima i rizicima;
- sačuvanu baseline verziju koja nije prepisana finalnom verzijom;
- jednu završivu ruku Texas Hold’em pokera protiv najmanje jednog bota;
- podršku za izbor od 1 do 5 botova, ako osnovna verzija ostane stabilna;
- strukturisane ugovore i runtime validaciju;
- testove napisane i pokrenute kroz RED → GREEN → REFACTOR tok;
- najmanje četiri eval slučaja sa očekivanjima zapisanim pre pokretanja;
- najmanje jedan stvarni baseline propust;
- jednu hipotezu, jednu ciljanu promenu i ponovljen isti eval skup;
- `EVIDENCE_003.md` sa stvarnim komandama, rezultatima, ograničenjem i doprinosom oba člana;
- početni `AI_USAGE_LOG.md` bez privatnog chain-of-thought sadržaja;
- mogućnost da svaki član para objasni svoj doprinos, test, dokaz i preostalo ograničenje.
