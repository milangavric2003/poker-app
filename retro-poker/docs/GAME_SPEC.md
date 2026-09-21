# GAME_SPEC — Retro Poker

Verzija: 1.0 · Datum: 2026-09-21 · Faza: Week03

Status: početna specifikacija za Spec Kit razradu; implementacija još ne postoji.

## 1. Namera i potvrđene odluke

Retro Poker je lokalna browser igra No-Limit Texas Hold'em sa retro vizuelnim stilom. Jedan čovek igra protiv jednog do pet programskih botova za virtuelne žetone, za stolom sa najviše šest učesnika. Odvojeni backend vodi pravila i stanje partije u memoriji, a frontend prikazuje informacije dostupne čoveku i prima njegove poteze. Partija se nastavlja kroz više ruku, stackovi se prenose i igrači bez žetona ispadaju. Week03 isporuka pokazuje igru i proverljiv razvoj kroz Spec Kit, TDD, strukturisane ugovore, eval i evidence; AI analiza završene ruke pripada Week04.

Potvrđeno od vlasnika projekta:

- Predavač je prihvatio poker kao izbor igre.
- Koristi se Spec Kit; implementacija prati SDD i TDD.
- Pravi se mali backend radi podele posla, iako nije obavezan u izvornom zadatku.
- Varijanta je No-Limit, sa all-in i side potovima; raniji predlog fiksnih uloga je odbačen.
- Aplikacija se pokreće samo lokalno; nema pravog novca, naloga, ljudskog multiplayera, baze, leaderboarda ili deploymenta.
- Kontinuirana partija završava kada čovek ispadne ili ostane jedini igrač.

Projektni podrazumevani izbori za v1: pet botova, 1.000 žetona po učesniku, small/big blind 5/10 bez rasta i bez ante-a; jedan žeton je najmanja jedinica. To su parametri demo igre, ne univerzalni poker standard. Korisnik bira samo broj botova pri novoj partiji. Nema rebuy-a, dopune stacka ili menjanja parametara usred partije.

`6-max` znači najviše šest mesta, ne obavezno šest aktivnih igrača u svakoj ruci. Prilikom početka učesnici zauzimaju uzastopna mesta, čovek mesto 0; prazna mesta ne učestvuju. Prvi button je na čoveku. Odabrana mesta ostaju stabilna do kraja partije.

## 2. Cilj, kontrole i rezultat

Cilj igrača je da osvoji sve žetone protivnika. Pobeda u jednoj ruci može nastati osvajanjem pota bez showdown-a ili dobitkom jednog ili više potova na showdown-u. Dobitak ruke nije isto što i pobeda u partiji.

Kontrole su miš i tastatura kroz standardne fokusabilne UI elemente:

- Izbor 1–5 botova i `Nova partija`; podrazumevano pet.
- `Fold`, `Check`, `Call`, `Bet`, `Raise`, `All-in`, prema dozvoljenim akcijama.
- Numerički unos za bet/raise; UI jasno piše da li se unosi ukupan ulog u toj rundi i koliko se dodatno skida sa stacka. Naziv kontrole je `Bet/Raise to` odnosno `Ukupno u ovoj rundi`.
- `Sledeća ruka`, tek posle rezultata prethodne ruke i ako partija nije završena.
- `Nova partija` resetuje prethodnu, uz potvrdu samo ako je partija još u toku.

Nema vremenskog ograničenja za ljudski potez. Dok backend obrađuje akciju ili igra bot, ljudske kontrole ne mogu slati novi potez. Posle fold-a čoveka botovi završavaju ruku, a korisnik vidi poteze i rezultat. Posle eliminacije čoveka nema dodatne simulacije završetka partije između preostalih botova.

## 3. Osnovni game loop

```text
Konfiguracija → Nova partija → Button/blindovi → Deljenje
    → Pre-flop → Flop → Turn → River → Showdown
    → Obračun potova → Rezultat ruke → Provera eliminacije
    → Sledeća ruka ili Pobeda/Poraz
```

Ako ostane jedan igrač koji nije fold-ovao, ruka se završava odmah. Ako dalje ulaganje nije moguće, preostale zajedničke karte se podele automatski i sledi obračun. Svaka prihvaćena akcija i automatski prelaz imaju jednoznačan redosled u istoriji.

Backend ne sme da čeka potez igrača koji je fold-ovao, all-in ili eliminisan. Runda se završava tek kada su svi koji mogu da odlučuju odgovorili na poslednju relevantnu promenu uloga; jednakost iznosa sama nije dovoljna (npr. BB i dalje ima opciju posle limp-ova).

## 4. Osam ključnih pravila igre

| ID | Pravilo |
|---|---|
| R1 | Špil ima 52 jedinstvene karte, bez džokera; dva kruga deljenja daju po dve privatne karte učesniku. Nema dupliranja karata. |
| R2 | Zajedničke karte otkrivaju se 3–1–1. Pre svake grupe sagoreva se jedna karta, skrivena od UI-ja i botova. |
| R3 | Potezi idu u smeru kazaljke na satu; pre-flop počinje posle BB, kasnije posle button-a. Fold/all-in igrači se preskaču. |
| R4 | Check zahteva da nema doplate; call doplaćuje dug do granice stacka; fold odustaje od prava na pot. |
| R5 | Bet je najmanje BB, raise najmanje prethodni puni inkrement; maksimum je stack, bez ograničenja broja raise-ova. Kraći all-in je dozvoljen. |
| R6 | All-in igrač zadržava pravo na odgovarajuće potove; nepotvrđen višak uloga se vraća. Žetoni se ne stvaraju niti gube. |
| R7 | Na showdown-u se poredi najboljih pet od sedam karata, uz 0–2 privatne karte; jednake kombinacije dele pot, bez prednosti boje. |
| R8 | Stackovi se prenose; eliminacija se utvrđuje tek posle raspodele svih potova. Nova ruka koristi nov promešan špil. |

Osnovna pravila: [PokerStars — Texas Hold'em](https://www.pokerstars.com/poker/games/texas-holdem/). Sledeća preciziranja i acceptance primeri su obavezan deo specifikacije.

### 4.1. Button, blindovi i dva igrača

Koristi se dead-button pravilo pri eliminaciji: sledeći preživeli igrač posle prethodnog BB dobija BB; button/SB mogu biti na eliminisanom mestu radi pravilnog napredovanja blindova. Prazna mesta koja nikada nisu učestvovala ne stvaraju dodatne poteze ili blindove. Plan mora da priloži tabelu prelaza za eliminaciju button-a, SB, BB i više igrača odjednom.

Heads-up: button postavlja SB, igra prvi pre-flop i poslednji posle flop-a. Pri prelasku na dva igrača raspored se prilagođava da preživeli prethodni BB ne plaća BB uzastopno. Heads-up deljenje počinje od BB.

Ako stack ne pokriva blind, ulaže se preostali iznos i igrač je all-in; nominalni BB ostaje minimum pre-flop otvaranja. Postavljeni blind ulazi u lični doprinos te runde i cele ruke.

### 4.2. Raise i ponovno pravo na raise

Kraći all-in ne menja poslednji puni raise inkrement. Za igrača koji je već reagovao, ponovno pravo zavisi od ukupnog povećanja s kojim se sada suočava; više kratkih all-in povećanja može zajedno dostići puni raise. Evidentiraj pravo po igraču, ne jednim globalnim boolean-om. Nepuna početna all-in opklada ispod BB ne postaje novi puni minimum; acceptance testovi moraju obuhvatiti check pre takvog otvaranja.

Primer: BB je 10; na flop-u A check, B all-in 4, C još nije igrao i ima dovoljno žetona. C može fold, call 4 ili raise na najmanje 14; dopuna na 10 nije legalan običan raise. Ako C call-uje 4, A može fold/call, ali nema pravo na raise. Ako C raisuje na 14, A ponovo ima pravo na raise, najmanje na 24. Videti TDA objašnjenja [minimalnog raise-a posle kratkog otvaranja](https://www.pokertda.com/forum/index.php?topic=279.0) i [prava igrača koji je prethodno check-ovao](https://www.pokertda.com/forum/index.php?topic=746.0).

### 4.3. Potovi i završetak

Svaki pot računa se i deli zasebno. Pravo imaju samo nefoldovani učesnici odgovarajućeg nivoa doprinosa. Preostali nedeljivi žetoni dodeljuju se dobitnicima redom od prvog mesta levo od button-a.

Referenca za ova preciziranja: [Poker TDA, pravila 21, 23, 34–36 i 49](https://www.pokertda.com/view-poker-tda-rules/). Koristimo pravila relevantna za digitalnu igru; fizičke greške deljenja, usmene deklaracije i turnirske kazne nisu deo aplikacije.

Jedini preostali igrač sa žetonima ne može da ulaže protiv već all-in protivnika u pot bez protivnika: prvo dobija priliku da call/fold-uje eventualni dug, zatim sledi automatsko otkrivanje ostatka board-a. Ako najmanje dva nefoldovana igrača imaju žetone, mogu da nastave ulaganje za side pot.

Pri kraju ruke backend tačno jednom vraća nepotvrđen višak i tačno jednom isplaćuje svaki pot. Foldovani doprinosi ostaju u obračunu. `HandResult` prikazuje dobitnike po potu, isplate, vraćene iznose i neto promenu stacka; ne svodi side-pot rezultat na jednog globalnog pobednika.

### 4.4. Evaluator i otkrivanje karata

Poređenje obuhvata sve kategorije, kickere i izbor pet karata; A može biti najniža karta u A–2–3–4–5, ali nema wrap-around straight-a. Royal flush je najviši straight flush. Kada najbolju kombinaciju čini board, privatne karte ne menjaju nerešen ishod.

Za v1 svi učesnici showdown-a automatski otkrivaju karte; nema opcije muck. Foldovane karte ostaju skrivene. Pri pobedi fold-om svih protivnika nema automatskog otkrivanja protivničkih karata. Nepodeljeni špil, burn karte i RNG seed nikada se ne šalju klijentu.

## 5. Botovi

- BOT1: Jedna jednostavna dokumentovana strategija, bez izbora težine, LLM-a, solvera i spoljnog API-ja.
- BOT2: Bot prima sopstvene karte, javno stanje, javnu istoriju i legalne akcije. Nema pristup tuđim skrivenim kartama, redosledu špila ili budućem board-u.
- BOT3: Svaki potez prolazi isti domenski validator. Engine ne prihvata nelegalan potez ni od bota.
- BOT4: U testovima odluke i slučajnost mogu da se zamene determinističkim fixture-om. RNG bota je odvojen od mešanja špila.
- BOT5: Greška strategije ne blokira partiju: zabeleži dijagnostiku i odaberi legalan check, a ako check nije legalan, fold. Testovi moraju otkriti da je fallback korišćen.
- BOT6: UI redom prikazuje događaje botova. Eventualna animacija ne određuje pravila niti zahteva realno čekanje u engine testovima.

## 6. Arhitektura i lokalno pokretanje

| ID | Zahtev |
|---|---|
| ARCH1 | TypeScript frontend i backend, engine nezavisan od transporta i prikaza; konkretni framework-i se biraju u `plan.md`. |
| ARCH2 | Mali HTTP API za novu partiju, javno stanje, ljudsku akciju i sledeću ruku. Backend sam izvršava bot poteze; klijent ne šalje poteze u ime bota. |
| ARCH3 | Jedna aktivna lokalna partija u memoriji, bez trajnog snimanja. Nova partija zamenjuje staru. |
| ARCH4 | Oba servisa slušaju loopback, nikada podrazumevano `0.0.0.0`. Ako su različiti origin-i, dozvoli samo dokumentovani lokalni frontend origin. |
| ARCH5 | Posle instalacije zavisnosti igra i testovi rade bez interneta, AI ključeva, CDN fontova ili udaljenih asseta. |
| ARCH6 | Refresh UI-ja učitava aktuelno backend stanje. Restart backend-a gubi partiju i prikazuje ekran nove partije; ne simulirati uspešan nastavak. |
| ARCH7 | Obrada akcija je serijska i proverava `gameId`, `handId` i očekivanu reviziju. Dupli klik ili zastareo zahtev ne primenjuje potez dva puta. |
| ARCH8 | Greška mreže ostavlja poslednji potvrđeni prikaz i nudi ponovno učitavanje stanja. Ne ponavljaj automatski zahtev koji menja igru. |

Test fixture-i smeju da postave špil i stackove kroz test interfejs u procesu. Produkcioni HTTP API ne nudi debug/reset-stack/set-deck endpoint. Dijagnostika i development evidence nisu trajno čuvanje partija za igrača.

## 7. Strukturisani ugovori i runtime validacija

Ovo su zahtevi za ugovore; detaljne šeme i HTTP rute nastaju u Spec Kit planu pre implementacije oba dela. Jedan deljeni modul sadrži šeme i tipove.

| Ugovor | Obavezna semantika |
|---|---|
| `GameConfig` | Jedino polje `botCount`: obavezan ceo JSON broj od 1 do 5; nepoznata polja se odbijaju. Fiksni stack i blindovi su serverske konstante. |
| `PlayerAction` | Identifikatori partije/ruke, očekivana revizija, diskriminisana akcija. `bet`/`raise` zahtevaju `amountTo`, ostale akcije ga ne prihvataju. |
| `GameView` | Javna mesta, stackovi, doprinosi, statusi, button/blindovi, faza, otkrivene karte, čovekove karte, igrač na potezu, potovi, revizija, legalne akcije i rasponi. |
| `HandResult` | Identitet završene ruke, razlog završetka, potovi sa eligible/winner ID-jevima, isplate/refund-i, otkrivene karte, neto promene i status partije. |
| `GameError` | Stabilan kod i razumljiva poruka bez privatnog internog stanja; razlikuje invalidan format, nelegalan potez, zastarelo stanje i nepostojeću partiju. |

`amountTo` je ukupan doprinos igrača u tekućoj betting rundi nakon akcije, ne iznos doplate. Doplata je `amountTo - streetContribution`; maksimalno `streetContribution + stack`. `call` sam računa `min(toCall, stack)`, a `all_in` ulaže ceo preostali stack samo kada njegova klasifikacija kao call/bet/raise poštuje trenutna prava igrača. All-in dugme ne zaobilazi zabranu raise-a.

Validan primer konfiguracije:

```json
{ "botCount": 5 }
```

Nevalidni primeri: `{}`, `{"botCount":0}`, `{"botCount":6}`, `{"botCount":2.5}`, `{"botCount":"3"}`, `{"botCount":3,"startingStack":999999}`. Svi moraju biti odbijeni pre kreiranja ili zamene partije; postojeća partija ostaje netaknuta.

Za akcije odbij negativne iznose, razlomke, nepoznatu akciju, višak polja, pogrešnu fazu ili identifikator, potez van reda i zastarelu reviziju. Frontend koristi runtime proveru odgovora pre prikaza; backend proverava i oblik i domenska pravila pre promene stanja. Čak i validan JSON može biti semantički nelegalan.

## 8. Vizuelni minimum

- Originalan retro izgled: jednostavan zeleni sto, piksel/monospace stil, čitljive karte i žetoni, najviše šest jasno označenih mesta. Bez kopiranja brendova ili tuđih asseta.
- Čovek je vizuelno izdvojen; rang i znak karte čitljivi su bez oslanjanja isključivo na boju.
- Prikazuju se faza, button/SB/BB, aktivni igrač, stackovi, ulozi, ukupan pot i side potovi kada postoje, uz kratku istoriju događaja.
- Nedozvoljene akcije su onemogućene ili skrivene; prikazuju se call iznos i bet/raise granice iz `GameView`.
- Ekran rezultata ostaje vidljiv do `Sledeća ruka`. Prikazuje raspodelu i promenu žetona, bez strateških ili navodno AI zaključaka.
- Minimalni demo viewport: desktop 1280×720, bez preklapanja kontrola i horizontalnog skrolovanja. Fokus, label-e i poruke o greškama moraju biti čitljivi. Mobilni raspored, zvuk i složene animacije nisu DoD.
- Tekst interfejsa je srpski latinicom; standardne poker akcije mogu zadržati engleske nazive. Nema internog debug JSON-a ili Spec Kit detalja u korisničkom toku.

## 9. Acceptance scenariji i test oracle

Očekivanja se zapisuju pre implementacije. Primeri sa različitim stackovima su test snapshot-i kasnijeg toka partije, ne nove korisničke postavke.

| ID | Given / When | Then |
|---|---|---|
| AC01 | Nova partija, pet botova | Šest učesnika; početno ukupno 6.000 žetona; posle blindova zbir stackova i pota ostaje 6.000; svako ima dve jedinstvene karte. |
| AC02 | Početak sa jednim botom | Heads-up button/SB igra prvi pre-flop; BB igra prvi post-flop. |
| AC03 | Pozitivni testovi za svaki `botCount` 1–5; nevalidni primeri iz §7 | Validni počinju sa tačnim brojem učesnika; nevalidni vraćaju grešku bez mutacije postojeće partije. |
| AC04 | Igrač duguje 20, pošalje check | Odbijanje; stack, pot, red poteza, revizija, špil i istorija prihvaćenih akcija nepromenjeni. |
| AC05 | Trenutni ulog 30, poslednji puni raise inkrement 20; igrač ima dovoljno žetona i pravo da raisuje | Raise to 49 se odbija; raise to 50 se prihvata. |
| AC06 | Igrač ima doprinos 10, stack 90; raise to 60 je legalan | Skida se 50; ostaje stack 40, doprinos postaje 60. |
| AC07 | Dug 100, preostali stack 40, call | Ulaže 40, postaje all-in; nema negativnog stacka ni eliminacije pre obračuna. |
| AC08 | A bet 100; B all-in to 140; akcija se vrati A | A nema novo pravo na raise samo zbog povećanja od 40. |
| AC09 | A bet 100, B all-in 140, C call 140, D all-in 200 | A ponovo može da raisuje; ako A call-uje 200, C nema ponovno pravo na raise zbog doplate od 60. |
| AC10 | BB 10; na flop-u A check, B all-in 4, C još nije igrao; A/C imaju dovoljno žetona | C call 4 je legalan, običan raise to 10 nije, raise to 14 jeste. Posle C call-a A nema pravo na raise; posle C raise-a na 14 A može raise na najmanje 24. |
| AC11 | Završni doprinosi A=100, B=250, C=250; niko nije fold; A ima najbolju, B drugu kombinaciju | Glavni pot 300 dobija A, side pot 300 dobija B; C dobija 0. |
| AC12 | A ulaže 200, B all-in call ukupno 80; nema drugih doprinosa | A dobija refund 120; osporeni pot je 160 i deli se prema kartama. |
| AC13 | Pot 15: A i B imaju istu najbolju kombinaciju, C je foldovao posle svog doprinosa 5 | A/B dobijaju 8/7 po redosledu mesta levo od button-a; C ne dobija ništa. |
| AC14 | Board A♠ K♠ Q♠ J♠ 10♠, najmanje dva učesnika showdown-a | Dele pripadajući pot; privatne karte ne određuju pobednika. |
| AC15 | A–2–3–4–5 naspram 2–3–4–5–6; odvojeni primeri kickera, dve trojke i tri para | Šest-visoki straight je jači; evaluator bira ispravnih pet i kickere; dodatni fixture-i unapred navode konkretne karte i ishod. |
| AC16 | Svi osim jednog fold-uju | Tačno jedna isplata i rezultat bez nepotrebnog deljenja board-a ili otkrivanja foldovanih karata. |
| AC17 | Čovek fold, botovi ostanu u ruci | Botovi je završavaju; UI ne čeka potez čoveka; dostupan je rezultat. |
| AC18 | Dva identična zahteva sa istom očekivanom revizijom | Najviše jedna prihvaćena akcija; drugi zahtev se odbija kao zastareo i nudi se novo stanje. |
| AC19 | Backend snapshot sadrži sve privatne karte i špil | HTTP odgovor pre showdown-a nema tuđe karte, seed, burn karte ni redosled špila; bot input nema skrivene podatke protivnika. |
| AC20 | Posle raspodele čovek ima 0 / svi botovi imaju 0 | Prikaz poraza / pobede; nova ruka nije moguća; nova partija ponovo daje početne stackove. |
| AC21 | Eliminacija sa šest na manje igrača i sa tri na dva | Blindovi/button i red poteza slede §4.1; mrtva mesta ne blokiraju tok. |
| AC22 | Refresh UI-ja / restart backend-a | Učitava se postojeća partija / prikazuje kontrolisano odsustvo partije i nova igra. |
| AC23 | Puna ruka kroz UI sa kontrolisanim špilom i botovima | Ispravne faze, dozvoljene kontrole, tačan rezultat i nastavak sledeće ruke sa prenetim stackovima. |

AC15 i AC21 zahtevaju konkretne fixture tabele u planu pre RED testova, a ne samo test imena. Svaki fixture navodi početno stanje, poteze i unapred izračunat ishod.

Invarijante za svaki prihvaćeni prelaz: nema duplikata karata; nema negativnih/razlomljenih žetona; zbir stackova i još neisplaćenih doprinosa je konstantan; nema poteza van reda; refund i payout ne mogu se izvršiti dvaput. Doprinosi prikazani u UI-ju ne broje se drugi put ako su već uključeni u pot.

## 10. Week03 razvoj i dokazi

Sve naredne stavke su planirane isporuke, ne tvrdnja da već postoje:

| Artefakt | Potreban sadržaj |
|---|---|
| `AGENTS.md` | Kratke trajne instrukcije, scope i način provere. |
| `.specify/memory/constitution.md` | Popunjeni principi, obavezan TDD, mali scope i dokaz; bez placeholder-a. |
| `specs/<feature>/spec.md`, `plan.md`, `tasks.md` | Scenariji sa vezom na ID-jeve, tehnički plan, ugovori i mali zadaci oba člana. |
| `docs/BUILD_PROMPT_V1.md` | Sačuvan pre prve velike implementacije; uloga, cilj, kontekst, pravila, dozvoljene izmene, DoD i provere, plan i nejasnoće. |
| `docs/CONTEXT_MANIFEST.md` | Stvarno uključeni/izostavljeni izvori, verzije, prioritet, razlog i rizik za značajne pozive. |
| `docs/EVALS.md` | Očekivanja pre pokretanja; ista tabela baseline/posle, komande, fixture-i i statusi. |
| `docs/EVIDENCE_003.md` | Baseline referenca, problem, hipoteza, jedna promena, isti eval, stvarni logovi/screenshoti, ograničenje i doprinos oba člana. |
| `docs/AI_USAGE_LOG.md` | Značajni pozivi, svrha, očekivanje, kontekst, rezultat, odluka i dostupna potrošnja; nepoznate vrednosti jasno označene. |
| `README.md` | Instalacija, tačne verzije, lokalne komande/adrese, testovi, reset i poznata ograničenja. |

Minimalni eval: E1 puna tipična ruka; E2 granični broj botova (1 i 5); E3 nevalidan `GameConfig`; E4 stvarni propust prve verzije. E4 se bira tek iz zabeleženog baseline nalaza. Ne izmišljati grešku, ne izazivati je namerno i ne prepravljati rezultate. Ako propust nije pronađen, zabeležiti ograničenje i proširiti stvarne provere; ne tvrditi da je taj kriterijum završen.

Za kontrolisanu promenu zapiši: tvrdnju, signal, hipotezu, najmanju promenu, nepromenjene uslove, komandu, rezultat i ograničenje. Sačuvaj baseline pre popravke i ponovi isti skup posle nje; ne menjaj istovremeno prompt, kontekst, šemu i kriterijume. Dodaj holdout koji nije korišćen za doradu.

Za svaki implementacioni task čuvaj smislen RED, najmanji GREEN i relevantnu regresiju. Oba člana treba da mogu da ponove tuđi dokaz i objasne svoju promenu. Član A vodi engine/backend/botove; član B UI/evaluator/demo. Zajednički ugovori prethode nezavisnom radu, uz redovnu zamenu driver/reviewer uloga i jedan coding agent.

## 11. Definition of Done za Week03

- [ ] Popunjeni su Spec Kit constitution, feature specifikacija, plan i taskovi; AC15/AC21 imaju konkretne fixture tabele i očekivanja pre implementacije.
- [ ] Početni prompt i context manifest sačuvani su pre velike implementacije.
- [ ] Frontend i backend se pokreću lokalno po README-u; igra radi bez spoljne mreže nakon setup-a.
- [ ] Konfiguracije sa 1–5 botova su podržane; pet je podrazumevano.
- [ ] Kontinuirana No-Limit partija obuhvata all-in, legalne raise-ove, side potove, tie/refund, ispadanje i heads-up.
- [ ] AC01–AC23 imaju konkretne prolazne testove ili jasno navedenu ručnu proveru za vizuelne zahteve; nijedna nepokrivena obavezna stavka se ne prećutkuje.
- [ ] Prikaz i botovi poštuju ograničenja vidljivosti; backend odbija nelegalne i zastarele akcije bez mutacije.
- [ ] Prikazani su validan i nevalidan strukturisan primer, runtime odbijanje i semantička provera.
- [ ] Postoje stvarni RED/GREEN dokazi; fokusirani i regresioni testovi, E2E, typecheck, lint i build prolaze.
- [ ] Baseline je ponovljiv i očuvan; postoji stvaran propust, hipoteza i jedna kontrolisana promena proverena istim eval skupom, plus nezavisan holdout.
- [ ] `EVIDENCE_003.md` i `AI_USAGE_LOG.md` sadrže stvarne rezultate, potrošnju kada je dostupna, ograničenja i doprinos oba člana.
- [ ] Drugi član može iz checkout-a da instalira, pokrene igru i ponovi dokumentovane provere.

Za Week03 demo prikažite jednu ruku, spec/prompt/manifest, isti baseline scenario pre i posle promene, runtime odbijanje i evidence. Obojica objašnjavaju svoj doprinos. Week04 tool-calling deo zajedničkog demo plana još nije uslov.

## 12. Van scope-a i budući Week04

Van Week03: pravi novac i plaćanja; nalozi i autentifikacioni sistem; drugi ljudski igrači ili udaljeni server; baza i trajni save/replay; leaderboard; deployment; rast blindova/turnirski nivoi i više stolova; rebuy; više varijanti pokera; izbor težine; napredni solveri; mobilna optimizacija; zvuk; spoljne slike/fontovi; autonomni agenti u igri.

AI rezime, procena poteza, tool calling i provider SDK ne implementiraju se sada. Week03 beleži uređenu istoriju u memoriji za aktuelnu i poslednju završenu ruku, uključujući informacije dostupne čoveku u trenutku poteza, akciju, iznose i konačne činjenice. Stariji rezultati ne zahtevaju trajnu arhivu. Istorija se gubi restartom backend-a.

Week04 će kroz poseban spec dodati jednu kontrolisanu read-only sposobnost za rezime završene ruke: ugovor alata, dozvoljen poziv, input/output validaciju, fake/mock putanju, success/negative/failure dokaze i strukturisani odgovor. Model neće upravljati botovima ni menjati stanje. Procena poteza mora razlikovati znanje u trenutku odluke od kasnijeg ishoda; pobeda sama ne dokazuje dobru odluku. Način okidanja i live provider biraju se tada.

## 13. Izvori i upravljanje promenama

- [Retro AI Engineering Challenge](../../week-03-week-04-pdf-review/materijali-za-studente/week-03-week-04-retro-ai-engineering-challenge.md): Week03 artefakti, eval i granica Week04.
- [Week03 studentska skripta](../../week-03-week-04-pdf-review/materijali-za-studente/week-03-studentska-skripta.pdf): kontekst, strukturisani izlazi i TDD/SDD.
- [TDD/SDD addendum](../../week-03-week-04-pdf-review/materijali-za-studente/week-03-tdd-sdd-agentic-engineering-addendum.md): test-first i razrada u male taskove.
- Poker izvori su linkovani uz pravila; provereni 2026-09-21. Nisu zamena za sopstvene determinističke testove.

Lokalni nastavni materijali nisu nužno deo Git checkout-a; ovaj dokument i projektni artefakti moraju omogućiti kolegi rad bez njih. Stariji `suggestion.md` ostaje istorijski predlog, a ovaj dokument beleži aktuelni dogovor. Promena ponašanja zahteva usklađivanje verzije ovog dokumenta, Spec Kit artefakata, acceptance scenarija i testova pre prihvatanja implementacije.
