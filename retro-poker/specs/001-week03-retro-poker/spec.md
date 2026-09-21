# Feature Specification: Week03 lokalna Retro Poker igra

**Feature Branch**: Nije kreirana; feature direktorijum je `specs/001-week03-retro-poker`.

**Created**: 2026-09-21

**Status**: Draft — specifikacija pregledana; implementacija nije započeta.

**Input**: Kreirati jedan Week03 feature iz GAME_SPEC: kontinuirani lokalni No-Limit
Texas Hold'em, jedan čovek protiv 1–5 botova, sa proverljivim razvojem i bez Week04 AI analize.

Autoritativni izvori: [GAME_SPEC v1.0](../../docs/GAME_SPEC.md),
[constitution v1.0.0](../../.specify/memory/constitution.md) i
[AGENTS.md](../../AGENTS.md). R, BOT, ARCH i AC oznake upućuju na GAME_SPEC.
Prioritet označava redosled isporuke; svi navedeni zahtevi obavezni su za Week03.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Započni i odigraj ruku (Priority: P1)

Kao igrač želim da izaberem broj protivnika, vidim svoje karte i dozvoljene poteze,
odigram ruku protiv botova i razumem rezultat.

**Why this priority**: Ovo je osnovni korisnički tok i prvi upotrebljiv demo igre.

**Independent Test**: Pokrenuti novu partiju sa kontrolisanim kartama i odlukama botova,
odigrati jednu ruku i uporediti prikazane faze, akcije i rezultat sa očekivanjima.

**Acceptance Scenarios**:

1. **Given** početni ekran, **When** igrač pokrene podrazumevanu partiju,
   **Then** učestvuje šest igrača sa ukupno 6.000 žetona i po dve privatne karte (AC01).
2. **Given** izbor jednog bota, **When** počne ruka,
   **Then** button/SB igra prvi pre-flop, a BB prvi post-flop (AC02).
3. **Given** bilo koji dozvoljeni broj botova, **When** igrač odigra punu ruku,
   **Then** vidi ispravne faze, legalne kontrole i tačan rezultat (AC03, AC23).
4. **Given** više učesnika u ruci, **When** čovek fold-uje,
   **Then** botovi završavaju ruku bez čekanja njegovog poteza (AC17).
5. **Given** jedan preostali nefoldovani igrač, **When** poslednji protivnik fold-uje,
   **Then** pot se isplaćuje jednom, bez daljeg deljenja ili otkrivanja protivnika (AC16).

### User Story 2 - Dobij ispravan obračun složene ruke (Priority: P1)

Kao igrač želim da raise, all-in i podeljeni potovi prate ista pravila za sve učesnike,
da bih mogao da verujem iznosima i rezultatu čak i kada se stackovi razlikuju.

**Why this priority**: Finansijski neutralna igra i dalje zavisi od tačnog obračuna
virtuelnih žetona; all-in i side potovi su obavezni deo izabrane varijante.

**Independent Test**: Iz zadatog stanja ruke reprodukovati svaku situaciju AC05–AC15,
bez potrebe da se cela partija odigra do tog stanja.

**Acceptance Scenarios**:

1. **Given** važeće granice uloga, **When** igrač pošalje bet/raise/call,
   **Then** iznos i ponovno pravo na raise odgovaraju AC05–AC10.
2. **Given** različiti konačni doprinosi, **When** nastupi obračun,
   **Then** svaki pot i refund imaju zaseban ispravan iznos i primaoce (AC11, AC12).
3. **Given** jednake najbolje kombinacije, **When** se deli pot,
   **Then** nema prednosti boje i ostatak ide po redosledu mesta (AC13, AC14).
4. **Given** granične kombinacije karata, **When** se porede ruke,
   **Then** bira se najboljih pet karata sa ispravnim kickerima (AC15).

### User Story 3 - Nastavi partiju do pobede ili poraza (Priority: P2)

Kao igrač želim da prenesem osvojene žetone u narednu ruku i nastavim protiv
preostalih botova dok ne pobedim ili ispadnem.

**Why this priority**: Više ruku daje smisao stackovima i ostvaruje izabrani kontinuirani format.

**Independent Test**: Koristiti završno stanje ruke sa poznatim stackovima, pokrenuti
sledeću ruku ili proveriti završetak partije; posebno proveriti prelaz sa tri na dva igrača.

**Acceptance Scenarios**:

1. **Given** završena ruka i najmanje dva preživela uključujući čoveka,
   **When** igrač odabere sledeću ruku, **Then** stackovi se prenose i nova ruka počinje (AC23).
2. **Given** eliminacija učesnika, **When** se postave naredni blindovi,
   **Then** raspored i red poteza prate dead-button i heads-up pravila (AC21).
3. **Given** raspodeljeni svi potovi, **When** čovek ima nula ili je jedini preživeli,
   **Then** vidi poraz ili pobedu i može započeti novu partiju (AC20).

### User Story 4 - Igraj uz jasne informacije i kontrolisane greške (Priority: P2)

Kao igrač želim čitljiv sto, zaštitu od nelegalnih i duplih poteza i mogućnost da
osvežim prikaz bez gubitka aktivne partije.

**Why this priority**: Pouzdan prikaz i jasne greške omogućavaju samostalno korišćenje demo igre.

**Independent Test**: Prikazati zadato javno stanje, pokušati nevalidne i ponovljene
akcije, osvežiti stranicu i proveriti oporavak prikaza i vidljivost podataka.

**Acceptance Scenarios**:

1. **Given** dug od 20, **When** igrač pokuša check,
   **Then** dobija grešku bez promene igre (AC04).
2. **Given** isti potez poslat dvaput iz iste verzije stanja,
   **When** zahtevi budu obrađeni, **Then** prihvaćen je najviše jedan (AC18).
3. **Given** ruka pre showdown-a, **When** igrač ili bot dobije svoj pogled,
   **Then** tuđe skrivene karte i buduće karte nisu dostupne (AC19).
4. **Given** aktivna partija, **When** se stranica osveži,
   **Then** prikazuje se trenutno stanje; posle restarta igre nema lažnog nastavka (AC22).

### Edge Cases

- Nedostajući, pogrešno tipiziran ili van opsega broj botova: odbijanje bez zamene postojeće partije.
- Stack manji od blinda: ulaže se preostalo, uz nominalni BB kao osnovu minimuma.
- Jednaki ulozi uz BB koji još nije odlučio: runda se ne završava pre njegove opcije.
- Kratki i kumulativni all-in: pravo ponovnog raise-a proverava se za svakog igrača.
- Jedan igrač sa žetonima protiv all-in protivnika: samo odgovor na postojeći dug,
  zatim otkrivanje ostatka board-a; nema ulaganja u pot bez protivnika.
- Foldovani doprinos ostaje u potu, ali foldovani učesnik nema pravo na isplatu.
- Više potova, nerešen rezultat i neparni žeton: svaki pot se obračunava zasebno.
- Eliminisani button/SB/BB i više istovremenih eliminacija ne smeju blokirati sledeću ruku.
- All-in dugme ne zaobilazi zabranu raise-a; zastarela akcija ne menja stanje.
- Greška bota ima legalan rezervni potez; greška veze ne ponavlja automatski ljudski potez.

### Acceptance katalog i sledljivost

Sledeći scenariji preciziraju prethodne priče. Njihovi ID-jevi i očekivanja potiču
iz GAME_SPEC §9. Ovo su kriterijumi budućih provera, ne rezultati izvršenih testova.

| ID | Početno stanje i akcija | Očekivani ishod | Zahtev |
|---|---|---|---|
| AC01 | Nova partija sa pet botova | Šest učesnika, ukupno 6.000 žetona uključujući uloge, po dve jedinstvene karte | FR-001, FR-003, FR-010 |
| AC02 | Početak sa jednim botom | Button/SB prvi pre-flop, BB prvi post-flop | FR-004 |
| AC03 | Svaki broj botova 1–5 i nevalidni primeri iz GAME_SPEC §7 | Tačan broj učesnika ili odbijanje bez mutacije | FR-001, FR-014 |
| AC04 | Dug 20, pokušaj check-a | Odbijanje; stack, pot, red, revizija, špil i istorija nepromenjeni | FR-005, FR-014 |
| AC05 | Ulog 30, puni inkrement 20, pravo raise-a i dovoljan stack | Raise to 49 odbijen, to 50 prihvaćen | FR-006 |
| AC06 | Doprinos 10, stack 90, legalan raise to 60 | Doplata 50, stack 40, doprinos 60 | FR-006 |
| AC07 | Dug 100, stack 40, call | Ulog 40 i all-in, bez prerane eliminacije | FR-005, FR-011 |
| AC08 | A bet 100, B all-in to 140, povratak akcije A | Samo povećanje od 40 ne otvara A pravo na raise | FR-007 |
| AC09 | A bet 100, B all-in 140, C call 140, D all-in 200 | A može raise; ako A call 200, C ne može raise zbog doplate 60 | FR-007 |
| AC10 | BB 10; flop A check, B all-in 4, C nije igrao; A/C imaju dovoljno | C call 4 legalan, običan raise to 10 nije, to 14 jeste; posle call-a A nema raise, posle raise-a A minimum 24 | FR-007 |
| AC11 | Doprinosi A100/B250/C250, niko fold, A najbolji i B drugi | A glavni pot 300, B side pot 300, C nula | FR-008 |
| AC12 | A200, B all-in call80, bez drugih doprinosa | Refund A120, pot za nadmetanje 160 | FR-008 |
| AC13 | Pot15, A/B jednaki pobednici, C fold posle doprinosa5 | A/B dele 8/7 prema mestu levo od button-a, C nula | FR-008 |
| AC14 | Board A♠ K♠ Q♠ J♠ 10♠, više učesnika showdown-a | Dele pripadajući pot nezavisno od privatnih karata | FR-009 |
| AC15 | Pet-visoki naspram šest-visokog straight-a; kicker, dve trojke i tri para | Šest-visoki jači; izbor najboljih pet i kickera po konkretnim fixture tabelama iz plana | FR-009 |
| AC16 | Svi osim jednog fold-uju | Jedna isplata, bez daljeg board-a ili otkrivanja foldovanih karata | FR-005, FR-008, FR-012 |
| AC17 | Čovek fold, botovi ostaju | Botovi završavaju ruku; dostupan rezultat bez ljudskog poteza | FR-013 |
| AC18 | Dva ista zahteva sa istom očekivanom revizijom | Najviše jedna prihvaćena akcija; drugi je zastareo, omogućeno osveženje | FR-015 |
| AC19 | Potpuno interno stanje, pogled pre showdown-a | Nema tuđih skrivenih karata, seed-a, burn karata ili redosleda špila; isto ograničenje za botove | FR-012, FR-013 |
| AC20 | Posle isplate čovek0 / svi botovi0 | Poraz / pobeda, nema sledeće ruke; nova partija vraća početne stackove | FR-002, FR-011 |
| AC21 | Eliminacije sa šest na manje i sa tri na dva | Raspored iz GAME_SPEC §4.1, mrtva mesta ne blokiraju tok; fixture tabela u planu | FR-004, FR-011 |
| AC22 | Osveženje stranice / restart lokalne igre | Trenutna partija / ekran nove partije bez lažnog oporavka | FR-016 |
| AC23 | Puna ruka sa kontrolisanim kartama i botovima | Ispravne faze, kontrole, rezultat i sledeća ruka sa prenetim stackovima | FR-003–FR-013, FR-017 |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Igra MORA omogućiti jednog čoveka protiv 1–5 botova (podrazumevano pet),
  po 1.000 početnih žetona i fiksne blindove 5/10 bez ante-a. Samo broj botova je podesiv.
  Mesta su stabilna, čovek na mestu 0 i prvi button; nikad korišćena prazna mesta ne igraju (§1, AC01–AC03).
- **FR-002**: Nova partija MORA zameniti prethodnu i resetovati stackove. Ako partija
  još traje, igrač MORA potvrditi zamenu; odbijanje potvrde čuva partiju (§2, AC20).
- **FR-003**: Svaka ruka MORA koristiti nov promešan špil od 52 karte bez džokera,
  dve privatne karte po učesniku u dva kruga i zajedničke karte 3–1–1 sa burn kartom
  pre svake grupe, bez duplikata (R1, R2, R8).
- **FR-004**: Red poteza, dead-button, kratki blindovi i heads-up MORAJU pratiti
  GAME_SPEC §4.1. Pri prelasku na heads-up preživeli prethodni BB ne plaća uzastopni BB;
  heads-up deljenje počinje od BB. Fold/all-in i eliminisani ne čekaju potez (R3, AC02, AC21).
- **FR-005**: Igra MORA ponuditi fold/check/call/bet/raise/all-in samo kada su legalni.
  Check zahteva nulti dug, call najviše raspoloživ stack. Runda čeka sve potrebne odluke,
  uključujući BB opciju. Jedan nefoldovani učesnik završava ruku; nemogućnost daljeg
  ulaganja vodi otkrivanju ostatka board-a i obračunu (R3, R4, §3, §4.3).
- **FR-006**: Ulog MORA biti celobrojan, bet najmanje BB i raise najmanje poslednji puni
  inkrement, osim dozvoljenog kratkog all-in. Nema limita broja raise-ova. Unos je ukupan
  ulog u tekućoj rundi; prikaz MORA razjasniti doplatu i maksimum (R5, §7, AC05–AC07).
- **FR-007**: Kratak all-in ne menja puni inkrement. Ponovno pravo na raise MORA pratiti
  pojedinačni ukupni dug i kumulativna povećanja iz §4.2; all-in kontrola ne zaobilazi prava
  (R5, AC08–AC10).
- **FR-008**: Igra MORA zasebno obračunati svaki pot, prava prema doprinosima i fold-u,
  refund nepotvrđenog viška i podelu nerešenog pota. Nedeljivi žetoni idu pobednicima
  redom levo od button-a. Refund/isplata su jednokratni; rezultat prikazuje svaki pot,
  dobitnike, isplate, refund i neto promene (R6, R7, §4.3, AC11–AC13, AC16).
- **FR-009**: Poređenje MORA birati najboljih pet od sedam, sa 0–2 privatne karte,
  svim kategorijama i kickerima. A može biti nizak u A–2–3–4–5, bez wrap-around-a;
  royal flush je najviši straight flush; boja ne razrešava jednakost (R7, AC14, AC15).
- **FR-010**: Zbir stackova i neisplaćenih doprinosa MORA biti konstantan za celu partiju,
  bez negativnih ili razlomljenih žetona i dvostrukog brojanja prikazanih uloga (R6, §9).
- **FR-011**: Rezultat MORA ostati vidljiv do ručne sledeće ruke. Stackovi se prenose,
  eliminacija nastupa tek posle svih isplata. Čovek bez žetona gubi; jedini preživeli čovek
  pobeđuje. Posle toga nema nove ruke ni nastavka simulacije botova (R8, AC20, AC21, AC23).
- **FR-012**: Igrač i botovi MORAJU videti samo dozvoljene informacije. Svi nefoldovani
  učesnici showdown-a otkrivaju karte bez muck opcije; pobeda fold-om ne otkriva protivnike.
  Foldovane protivničke karte, burn karte i budući špil ostaju skriveni (§4.4, AC19).
- **FR-013**: Botovi MORAJU koristiti jednu jednostavnu dokumentovanu strategiju i ista
  pravila kao čovek. Testovi mogu kontrolisati odluke i slučajnost. Greška strategije vodi
  legalnom check-u, inače fold-u, uz dokaz da je fallback korišćen. Njihovi potezi se
  prikazuju redom, i posle ljudskog fold-a (BOT1, BOT2, BOT3, BOT4, BOT5, BOT6).
- **FR-014**: Nepotpuni, pogrešno tipizirani, nepoznati i semantički nelegalni ulazi MORAJU
  biti odbijeni razumljivom greškom bez promene igre, slučajnosti ili prihvaćene istorije.
  Obuhvat uključuje višak polja, iznose, fazu, identitet i red poteza (§7, AC03, AC04).
- **FR-015**: Ponavljanje ili zastareli potez ne sme dvaput promeniti igru. Tokom obrade
  i bot poteza nove ljudske kontrole su blokirane; nema roka za ljudski potez.
  Greška veze čuva potvrđeni prikaz i nudi osveženje, bez automatskog ponavljanja poteza
  (§2, ARCH7, ARCH8, AC18).
- **FR-016**: Igra MORA održavati jednu lokalnu partiju tokom rada, oporaviti prikaz posle
  osveženja stranice i izgubiti partiju posle restarta servisa koji je vodi. Posle instalacije
  radi bez interneta i pristupnih ključeva (ARCH3, ARCH4, ARCH5, ARCH6, AC22).
- **FR-017**: Retro sto MORA prikazati mesta, karte, stackove, uloge, potove, fazu,
  button/blindove, aktivnog igrača i kratku istoriju. Na 1280×720 nema preklapanja ni
  horizontalnog skrola. Kontrole imaju čitljive oznake i fokus i koriste se mišem/tastaturom;
  karte nisu razlikovane samo bojom. Jezik je srpska latinica uz standardne poker nazive (§8).
- **FR-018**: Uređena istorija MORA obuhvatiti aktuelnu i poslednju završenu ruku,
  informacije dostupne čoveku pri odluci, akcije, iznose i konačne činjenice. Gubi se
  restartom; u Week03 rezultat nema AI ili stratešku analizu (§12).

### Key Entities *(include if feature involves data)*

- **Partija**: Jedan čovek, odabrani botovi, stabilna mesta, ukupan broj žetona i status pobede/poraza.
- **Učesnik**: Čovek ili bot, mesto, stack, privatne karte, doprinosi i status u ruci/partiji.
- **Ruka**: Učesnici, raspored blindova, karte, faza, igrač na potezu i sled događaja.
- **Akcija**: Učesnik, vrsta poteza, iznos kada je potreban i stanje na koje se odluka odnosi.
- **Pot**: Doprinosi, iznos, učesnici sa pravom osvajanja, pobednici i njihove isplate.
- **Rezultat ruke**: Razlog završetka, potovi, refund-i, otkrivene karte i neto promene.
- **Pogled i istorija**: Informacije dozvoljene posmatraču i uređeni događaji sa tada dostupnim znanjem.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Za svih pet izbora broja botova igrač može započeti i završiti ruku
  i, ako nije eliminisan ili pobednik, preći u sledeću sa tačnim stackovima (US1, US3).
- **SC-002**: Svih 23 acceptance scenarija imaju dokaz očekivanog ishoda;
  pri svakom proverenom prelazu odstupanje ukupnog broja žetona je nula (US1–US4, FR-010).
- **SC-003**: U svim nevalidnim i ponovljenim primerima nijedan odbijen potez ne menja
  partiju i nijedan dupli potez ne proizvodi dve promene (US4, FR-014, FR-015).
- **SC-004**: U svim proverama pre dozvoljenog otkrivanja igrač i botovi dobijaju nula
  zabranjenih karata ili podataka o budućem deljenju (FR-012, FR-013).
- **SC-005**: Na 1280×720 sve obavezne informacije i kontrole mogu se pročitati i koristiti
  bez preklapanja i horizontalnog skrola; miš i tastatura omogućavaju glavni tok (FR-017).
- **SC-006**: Drugi član iz checkout-a ponavlja instalaciju i lokalni demo po uputstvu;
  nakon instalacije završava ruku bez interneta, naloga ili AI ključa (FR-016).
- **SC-007**: Week03 predaja sadrži ponovljiv baseline, najmanje četiri eval slučaja,
  stvarni raniji propust, jednu ciljanu promenu i isti eval pre/posle, nezavisan holdout,
  RED/GREEN dokaze i zabeležen doprinos oba člana (GAME_SPEC §10–11, constitution).

## Assumptions

- Potvrđeni izbori su kontinuirana No-Limit igra i fiksni parametri iz FR-001;
  ne predstavljaju nove pretpostavke o univerzalnim poker pravilima.
- Korisnik koristi lokalni desktop browser. Mobile, zvuk i složene animacije nisu uslov.
- Nema pravog novca, naloga, ljudskog multiplayera, baze, trajnog save/replay-a,
  leaderboarda, deploymenta, rebuy-a, rasta blindova, drugih varijanti ili nivoa težine.
- Week04 AI rezime, tool calling i provider integracije zahtevaju poseban feature.
- Nema zavisnosti od prethodnog aplikacionog feature-a. Ovaj feature zahteva setup
  i implementaciju u narednim koracima; checklist specifikacije ne dokazuje da igra postoji.
- ARCH1 i ARCH2 ostaju obavezna arhitektonska ograničenja iz GAME_SPEC i constitution;
  ARCH3–ARCH8 povezani su sa FR-015/FR-016. Izbor alata, ugovori i način realizacije
  razrađuju se u planu. Nijedno postojeće ograničenje nije ukinuto izostavljanjem detalja ovde.
- Plan mora pripremiti konkretne fixture tabele AC15/AC21 pre implementacije, kao i
  testove semantike i vidljivosti. Postojeća očekivanja se ne menjaju radi pogodnosti.
- Nisu pronađeni konflikti sa izvorima. Eventualni konflikt otkriven kasnije prijavljuje
  se pre zavisne implementacije; GAME_SPEC se ne menja automatski.
