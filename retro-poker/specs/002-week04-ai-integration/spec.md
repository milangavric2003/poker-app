# Feature Specification: Week04 AI integracija

**Feature Branch**: Git grana `ai-integ`; feature direktorijum `002-week04-ai-integration`  
**Created**: 2026-09-26  
**Status**: Draft — specify, clarify i odobreno usklađivanje izvora završeni; implementacija nije započeta
**Input**: Google Gemini predlaže poteze botova i analizira završenu partiju, uz strogu backend validaciju, bezbedan fallback i lokalni usage dashboard.

Autoritativni izvori za postojeću igru su [GAME_SPEC v1.0](../../docs/GAME_SPEC.md),
[constitution v1.0.0](../../.specify/memory/constitution.md), [AGENTS.md](../../AGENTS.md)
i ugovori feature-a [001-week03-retro-poker](../001-week03-retro-poker/spec.md).
Aktuelni korisnički zahtev od 2026-09-26 određuje prošireni Week04 smer tamo gde je
u eksplicitnom konfliktu sa starijim Week04 opisom. Taj konflikt je evidentiran ispod,
ali se `GAME_SPEC.md` ne menja u ovom koraku.

## Scope konflikt i governance gate *(obavezno)*

`GAME_SPEC.md` §12 i constitution princip VI trenutno ograničavaju Week04 na jednu
kontrolisanu read-only sposobnost za rezime završene ruke i izričito kažu da model
ne upravlja botovima niti menja stanje igre. Nastavni challenge takođe postavlja
read-only AI alat kao Core, a lokalnu telemetry kao Stretch.

Aktuelni zahtev vlasnika za feature 002 materijalno je proširio i promenio tu granicu.
Odobrenim amandmanom izvora od 2026-09-26 ta promena je sada eksplicitno preneta u
`GAME_SPEC.md` v1.1 i constitution v1.1.0:

- Gemini modeli predlažu poteze botova tokom aktivne ruke;
- validan predlog, tek posle backend validacije, može dovesti do standardne mutacije igre;
- analiza obuhvata završenu partiju, ne samo poslednju završenu ruku;
- lokalni AI usage dashboard ulazi u obavezni scope.

Model i dalje nije autoritet: ne izvršava potez, ne dobija direktan pristup engine-u i
ne zaobilazi postojeća pravila. Ipak, ovo nije ponašanje koje postojeći §12 već odobrava.
Feature specifikacija i budući planovi MORAJU ostati usklađeni sa tim novim izvorima;
ovo odobrenje ne proširuje scope izvan navedenih Week04 granica.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Igraj protiv model-driven botova (Priority: P1)

Kao igrač želim da pri pokretanju lokalne partije uključim AI režim za 1–5 botova,
da njihovi potezi koriste modelsku procenu, a da pravila igre i moje privatne
informacije ostanu zaštićeni.

**Why this priority**: Ovo je glavna nova Week04 sposobnost i najveća promena u odnosu
na lokalnu determinističku strategiju iz Week03.

**Independent Test**: Sa fake providerom pokrenuti partiju za svaki broj botova 1–5,
uhvatiti sanitizovani kontekst svakog bot poteza, vratiti legalan strukturisan predlog
i dokazati da je engine tačno jednom primenio istu akciju kao kroz postojeći put.

**Acceptance Scenarios**:

1. **Given** nova partija sa uključenim AI režimom i 1–5 botova, **When** bot dođe na
   potez i provider vrati validan legalan predlog, **Then** backend ga lokalno validira
   i primenjuje tačno jednom kroz postojeći poker engine.
2. **Given** bot na potezu pre showdown-a, **When** se formira modelski kontekst,
   **Then** sadrži samo javno stanje, tom botu dostupnu istoriju i njegove privatne
   karte, bez tuđih karata, burn karata, budućeg špila ili seed-a.
3. **Given** model vrati sintaksno validan predlog koji nije legalan u trenutnom stanju,
   **When** backend proveri predlog, **Then** predlog ne menja stanje i aktivira se
   ograničeni recovery/fallback tok sa vidljivom oznakom ishoda.
4. **Given** AI režim nije uključen ili AI nije konfigurisan, **When** bot dođe na potez,
   **Then** postojeća deterministička strategija ostaje bezbedan put i partija se ne zaglavljuje.

### User Story 2 - Dobij analizu završene partije (Priority: P1)

Kao igrač želim strukturisan rezime svojih odluka posle završetka partije, sa dobrim
odlukama, mogućim greškama i konkretnim savetima za sledeću partiju, kako bih učio
bez poistovećivanja rezultata sa kvalitetom odluke.

**Why this priority**: Analiza ostvaruje obrazovni cilj Week04 i zadržava raniji
read-only smer za završeni rezultat čak i kada je prošireni bot scope privremeno nedostupan.

**Independent Test**: Fake provideru poslati proverene činjenice završene partije,
vratiti strukturisanu analizu i proveriti prikaz, zatim ponoviti sa timeout-om i
nevalidnim odgovorom bez promene završenog rezultata.

**Acceptance Scenarios**:

1. **Given** završena partija sa zabeleženim ljudskim odlukama i tada dostupnim
   informacijama, **When** igrač zatraži analizu, **Then** dobija sažetak, dobre odluke,
   moguće greške i konkretne predloge u validiranom strukturisanom obliku.
2. **Given** odluka koja je imala loš ishod, **When** se prikaže analiza, **Then** ocena
   koristi znanje dostupno u trenutku odluke i ne proglašava potez lošim samo zbog poraza.
3. **Given** partija je završena, **When** provider zakaže ili vrati nevalidan sadržaj,
   **Then** rezultat partije ostaje nepromenjen, UI prikazuje bezbedan neuspeh i nudi
   eksplicitno ponovno traženje analize.
4. **Given** analiza je uspešna, **When** je korisnik čita, **Then** jasno je označena
   kao obrazovno objašnjenje, a ne garancija optimalne poker strategije.

### User Story 3 - Razumi AI tok i oporavak od greške (Priority: P2)

Kao igrač želim da vidim kada AI čeka odgovor, pokušava oporavak, koristi drugi model,
prelazi na lokalni fallback ili ne uspeva, da bih razumeo zašto se igra nastavlja.

**Why this priority**: Mrežni provider ne sme pretvoriti lokalnu igru u blokiran ili
nepredvidiv sistem, niti sakriti kada model nije doneo potez.

**Independent Test**: Fake providerom reprodukovati timeout, 429, 5xx, malformed JSON,
schema-validan ali ilegalan predlog, odsutan ključ i kasni odgovor; proveriti status,
broj pokušaja, krajnji ishod i nepromenjeno ili jednokratno promenjeno stanje.

**Acceptance Scenarios**:

1. **Given** prvi pokušaj dobije retryable 429, timeout ili 5xx, **When** postoji preostali
   budžet, **Then** UI pokazuje recovery stanje, a sistem radi samo dozvoljen ograničen
   retry istog modela ili zasebno označen fallback na drugi konfigurisani Gemini model.
2. **Given** svi dozvoljeni pokušaji ne uspeju, **When** je u pitanju bot potez,
   **Then** postojeća deterministička strategija bira legalan potez i UI označava AI fallback.
3. **Given** svi dozvoljeni pokušaji ne uspeju, **When** je u pitanju analiza,
   **Then** prikazuje se failure stanje sa retry kontrolom, bez izmišljene analize.
4. **Given** poziv je istekao ili je njegov rezultat već konačno obrađen, **When** stigne
   zakašnjeli ili dupli odgovor, **Then** on ne može da primeni potez ili promeni rezultat drugi put.

### User Story 4 - Pregledaj lokalnu AI upotrebu (Priority: P2)

Kao korisnik demo aplikacije želim lokalni dashboard sa agregiranim brojem i ishodom
AI poziva, kako bih mogao da procenim pouzdanost, fallback i približnu potrošnju bez
izlaganja sadržaja igre ili tajni.

**Why this priority**: Dashboard čini retry, latenciju i budžet proverljivim tokom demo-a.

**Independent Test**: Fake providerom proizvesti uspeh, retry, model fallback i grešku,
zatim proveriti agregate i reset dashboarda bez pregledanja prompta ili privatnih karata.

**Acceptance Scenarios**:

1. **Given** više bot i analysis interakcija, **When** korisnik otvori dashboard,
   **Then** vidi broj logičkih poziva i provider pokušaja po nameni i modelu, uspehe,
   greške, retry/fallback broj i približnu latenciju.
2. **Given** provider vrati usage ili troškovne podatke, **When** se ažurira dashboard,
   **Then** prikazuju se vraćene normalizovane vrednosti; kada podatak nije vraćen,
   prikazuje se „nepoznato”, bez procene predstavljene kao činjenica.
3. **Given** postoje dashboard metrike, **When** se resetuje partija, **Then** procesni
   agregati ostaju radi demo-a; **When** se eksplicitno resetuje dashboard, **Then**
   brišu se samo metrike, bez promene aktivne ili završene partije.
4. **Given** dashboard ili javni response, **When** se pregledaju sva polja, **Then**
   nema API ključa, punog prompta, privatnih karata, raw provider odgovora ili stack trace-a.

### Edge Cases

- AI režim je izabran, ali `GEMINI_API_KEY` nedostaje: nema mrežnog poziva; nova partija
  može da počne uz jasnu oznaku da botovi koriste lokalni fallback, a analiza je unavailable.
- Model vrati validan JSON sa nepoznatim poljem, pogrešnim identitetom bota, zastarelim
  hand/version podacima, nedozvoljenom akcijom ili iznosom van engine granica: odgovor
  se semantički odbija bez mutacije.
- Više botova čeka u istoj ruci: potezi se serijalizuju po engine redosledu; jedan spor
  poziv ne blokira server da odgovori na nezavisne read-only lokalne zahteve.
- Korisnik resetuje/zameni partiju dok je poziv u toku: poziv se otkazuje ili njegov
  rezultat postaje zastareo i ne utiče na novu partiju.
- Provider vrati odgovor tačno na timeout granici ili posle fallback poteza: samo jedan
  konačni ishod dobija pravo na commit.
- Provider odbije sadržaj zbog safety politike ili vrati auth/config grešku: nema
  automatskog zaobilaženja promenom modela; koristi se odgovarajući krajnji fallback.
- Rate limit traje duže od ukupnog budžeta: nema beskonačnog backoff-a; bot nastavlja
  lokalno, a analiza ostaje neuspešna i može se ručno ponoviti.
- Usage metadata je delimična: svaka nedostajuća vrednost ostaje „nepoznato”; nema
  izvođenja cene iz broja karaktera ili zastarele cenovne tabele.
- Backend restartuje proces: partija, sačuvani match facts i dashboard metrike nestaju,
  u skladu sa lokalnim in-memory scope-om.

## Acceptance katalog i sledljivost

Ovi scenariji su očekivanja za buduće testove, ne tvrdnja da je implementacija izvršena.

| ID | Scenario | Očekivani ishod | Zahtevi |
|---|---|---|---|
| AIAC01 | 1 i 5 botova, AI mode, validan fake odgovor | Ispravan bot predlog prolazi engine i primenjuje se jednom | FR-001–FR-007 |
| AIAC02 | Pregled payload-a za svakog bota | Samo javno stanje i njegove karte; nula tuđih/future podataka | FR-003, FR-004, FR-022 |
| AIAC03 | Malformed JSON ili schema mismatch | Nema mutacije; ograničen recovery pa lokalni fallback | FR-005, FR-009, FR-012 |
| AIAC04 | Schema-validna ilegalna akcija | Semantičko odbijanje; engine stanje, RNG i istorija nisu promenjeni pre fallback-a | FR-005–FR-007, FR-012 |
| AIAC05 | Timeout i kasni odgovor | Konačan timeout/abort; najviše jedan commit, kasni odgovor ignorisan | FR-008–FR-011 |
| AIAC06 | 429 na prvom pokušaju | Bounded retry ili jasno označen drugi model u okviru ukupnog budžeta | FR-009, FR-010, FR-018 |
| AIAC07 | Provider 5xx, pa drugi konfigurisani Gemini model uspe | Attempt chain razlikuje model fallback od retry-ja; potez jednom | FR-009–FR-011, FR-018 |
| AIAC08 | Svi pokušaji bota neuspešni | Postojeća deterministička strategija završava legalan potez; fallback vidljiv | FR-012, FR-015 |
| AIAC09 | Ključ odsutan | Tajna nije prikazana; nema mrežnog poziva; bot lokalno nastavlja, analiza unavailable | FR-013–FR-015 |
| AIAC10 | Uspešna analiza završene partije | Validiran rezime razdvaja tadašnje znanje od ishoda i daje konkretne savete | FR-016, FR-017 |
| AIAC11 | Neuspela analiza, zatim ručni retry | Rezultat partije ostaje isti; failure je jasan; novi zahtev je nova interakcija | FR-016–FR-019 |
| AIAC12 | Dashboard posle success/error/retry/fallback | Tačni lokalni agregati; nepostojeći usage/cost je „nepoznato”; nema raw sadržaja | FR-018, FR-020–FR-023 |
| AIAC13 | Reset partije i reset dashboarda | Reset partije čuva metrike; dashboard reset briše samo metrike | FR-020, FR-021 |
| AIAC14 | Reset/nova partija tokom bot poziva ili dupli callback | Stari rezultat ne mutira novu partiju; nema dvostruke akcije | FR-008, FR-011, FR-019 |
| AIAC15 | Sve automatske AI provere bez interneta/ključa | Fake provider deterministički pokriva success i sve navedene failure klase | FR-024, FR-025 |
| AIAC16 | Provider poziv ostaje namerno pending | Nezavisan lokalni read-only zahtev završava se pre provider odgovora; server nije globalno blokiran | FR-027 |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Nova konfiguracija partije MORA omogućiti izbor 1–5 botova i uključivanje
  AI režima. Bez AI režima postojeći Week03 botovi MORAJU zadržati lokalnu strategiju.
- **FR-002**: AI režim MORA koristiti Google AI Studio Gemini API kao prvi provider.
  Dozvoljen failover je samo na drugi server-side konfigurisani Gemini model; drugi
  provider-i nisu deo feature-a.
- **FR-003**: Svaki modelski bot zahtev MORA sadržati minimalan strukturisan kontekst:
  identitet i trenutno javno stanje relevantne ruke, fazu i actor-a, javni board, potove,
  javne stackove/doprinose/statuse, dozvoljene akcije sa granicama, botove sopstvene
  privatne karte i samo istoriju koja mu je bila dostupna do tog poteza.
- **FR-004**: Bot kontekst NE SME sadržati privatne karte drugih učesnika, burn karte,
  nepodeljeni špil, seed/RNG stanje, buduće događaje, API ključ, environment, source,
  raw interne logove ili kasniji ishod ruke.
- **FR-005**: Model MORA vratiti strukturisan predlog sa dozvoljenom vrstom poteza i
  iznosom kada ga potez zahteva. JSON/schema validnost nije dovoljna: backend MORA
  proveriti identitet, aktuelnu partiju/ruku/reviziju i legalnost kroz postojeći engine.
- **FR-006**: Model predlog je savet, ne komanda. Samo backend sme da primeni legalan
  potez kroz isti autoritativni put i invarijante koje važe za Week03 bot i čoveka.
- **FR-007**: Odbijen modelski predlog NE SME pre fallback odluke promeniti stanje,
  verziju, RNG, špil ili istoriju prihvaćenih poteza.
- **FR-008**: Svaka AI interakcija MORA imati jedinstven identitet vezan za svrhu,
  partiju, ruku i očekivanu reviziju. Obrada i commit MORAJU biti serijalizovani tako
  da otkazani, zastareli, kasni ili dupli odgovor ne može primeniti potez dvaput.
- **FR-009**: Svaki provider pokušaj MORA imati konačan timeout i mogućnost otkazivanja.
  429, timeout i privremeni 5xx mogu se ponoviti samo po ograničenoj policy; invalidan
  input, nedostajući ključ, auth/config greška i safety refusal ne retry-uju se naslepo.
- **FR-010**: Sistem MORA razlikovati retry istog modela od fallback-a na drugi
  konfigurisani Gemini model i prikazati/izmeriti svaki pokušaj unutar jedne logičke
  interakcije. Nema beskonačnog pokušavanja niti nevidljivih dodatnih pokušaja.
- **FR-011**: Retry ili failover NE SME ponoviti mutirajuću game akciju koja je možda
  već commitovana. Provider pozivi proizvode predloge; game commit je zaseban i jednokratan.
- **FR-012**: Posle iscrpljenog pokušaja bot MORA koristiti postojeću determinističku
  strategiju, a korisnik MORA videti da je lokalni fallback aktiviran. Partija ne sme
  ostati zaglavljena čekajući provider.
- **FR-013**: API ključ MORA postojati samo na backendu u environment variable-u
  `GEMINI_API_KEY` (ili planom dokumentovanom ekvivalentu). Ne sme se unositi u Codex
  chat, prompt, source, frontend, Git istoriju, issue, screenshot, dashboard ili log.
  Ako se kasnije doda `.env.example`, vrednost MORA biti prazna, a `.env` ignorisan.
- **FR-014**: Nedostajući ključ MORA proizvesti bezbedan status bez otkrivanja vrednosti
  ili environment detalja i bez mrežnog pokušaja. Server i lokalna igra ne smeju pasti.
- **FR-015**: UI MORA razlikovati najmanje: AI mode off, waiting, retrying, using model
  fallback, using local fallback, completed, unavailable i failed; ne sme prikazati
  raw provider poruku ili stack trace.
- **FR-016**: Posle završetka partije korisnik MORA moći da zatraži strukturisanu analizu
  svojih poteza: sažetak, dobre odluke, moguće greške i konkretne sledeće korake.
- **FR-017**: Analitički input MORA koristiti proverene, bounded činjenice i za svaku
  ljudsku odluku razlikovati informacije dostupne tada od kasnijeg ishoda. Analiza MORA
  biti označena kao pomoć za učenje, ne kao garancija optimalne strategije.
- **FR-018**: Neuspeh analize NE SME promeniti ili poništiti završenu partiju. UI MORA
  pokazati generating, completed ili failed/unavailable stanje i omogućiti ručni retry
  kao novu logičku interakciju.
- **FR-019**: Reset ili zamena partije MORA učiniti sve njene nezavršene AI rezultate
  zastarelim; kasniji callback ne sme promeniti novu partiju ili njen prikaz.
- **FR-020**: Dashboard MORA lokalno agregirati logičke pozive i pojedinačne pokušaje
  po nameni i stvarnom modelu, success/error kategorije, retry i fallback broj,
  približnu latenciju i provider usage/trošak samo kada su stvarno vraćeni.
- **FR-021**: Dashboard metrike se, po pretpostavci ovog specify koraka, čuvaju samo
  u memoriji do restarta backend-a. Reset partije ih ne briše; posebna reset kontrola
  briše samo dashboard metrike i ne menja igru.
- **FR-022**: Javni UI, dashboard i bezbedni logovi NE SMEJU sadržati ključ, pune
  promptove, privatne karte, hidden/future state ili raw provider response. Provideru
  se šalje samo najmanji skup iz FR-003 ili bounded analiza iz FR-017.
- **FR-023**: Kada provider ne vrati token ili troškovne podatke, odgovarajuća vrednost
  MORA biti „nepoznato”. Sistem ne sme izmišljati tokene, cenu ili free-tier status.
- **FR-024**: Provider granica MORA podržati deterministički fake/mock put bez interneta
  i API ključa. Automatski unit/integration testovi ne smeju zavisiti od live modela.
- **FR-025**: Budući testovi MORAJU odvojeno dokazati success, malformed response,
  semantic rejection, timeout, 429, 5xx, drugi model, krajnji bot fallback, odsutan
  ključ, neuspelu analizu i očuvanje game state-a. Live smoke je opciona ručna provera
  sa lokalno postavljenim ključem i nikada nije deo podrazumevanog test suite-a.
- **FR-026**: Za završnu analizu MORA postojati dovoljan, bounded in-memory zapis
  ljudskih odluka kroz celu tekuću partiju. On proširuje Week03 ugovor koji čuva samo
  aktuelnu i poslednju završenu ruku, gubi se resetom/restartom i ne uvodi bazu ili replay arhivu.
- **FR-027**: Čekanje na provider NE SME sinhrono blokirati ceo lokalni server.
  Nezavisni bezbedni read-only zahtevi MORAJU moći da se završe dok je AI interakcija
  pending, uz očuvanje serijalizacije i autoriteta nad mutacijama konkretne partije.

### Predloženi operativni pragovi *(potvrditi u planu)*

Sledeće vrednosti su merljivi predlozi, ne zaključane implementacione odluke:

- **PROP-001**: Najviše 2 provider pokušaja po logičkoj interakciji: početni pokušaj
  plus najviše jedan recovery pokušaj. Policy bira da li je drugi pokušaj retry istog
  modela ili fallback na drugi konfigurisan Gemini model; nije dozvoljeno oba.
- **PROP-002**: Bot interakcija završava providerskim rezultatom ili lokalnim fallback-om
  najkasnije 12 sekundi od početka bot poteza.
- **PROP-003**: Zahtev za analizom završava uspehom ili jasnim failure statusom najkasnije
  30 sekundi od korisničkog zahteva; ručni retry pokreće novi budžet.
- **PROP-004**: Svaki pojedinačni attempt ima kraći konačan timeout od ukupnog budžeta;
  raspodela timeout-a, backoff i cancellation mehanizam ostaju planu.

### Key Entities and Structured Data

- **AI Mode Configuration**: Da li je modelski režim uključen, redosled dozvoljenih
  Gemini modela i operativni budžeti; tajna nije deo ove konfiguracije niti javnog DTO-a.
- **Bot Decision Context**: Sanitizovani snapshot tačno jednog bot poteza sa javnim
  stanjem, sopstvenim kartama, legalnim akcijama i očekivanom revizijom.
- **Bot Action Proposal**: Strukturisana vrsta poteza i eventualni ukupan iznos;
  nema ovlašćenje za mutaciju dok ga schema i engine ne prihvate.
- **Match Analysis Facts**: Bounded, proverene činjenice svih ljudskih odluka u tekućoj
  partiji, sa tada dostupnim stanjem i odvojeno zabeleženim kasnijim ishodom.
- **Match Analysis**: Strukturisan sažetak, niz dobrih odluka, mogućih grešaka i
  konkretnih preporuka, uz ograničenje da nije dokaz optimalne igre.
- **AI Interaction**: Jedan bot-potez ili analysis zahtev sa identitetom, statusom,
  ukupnim budžetom i uređenim attempt chain-om.
- **AI Attempt**: Jedan poziv određenom modelu sa rednim brojem, trajanjem, bezbednom
  kategorijom ishoda i usage metadata kada postoji.
- **Usage Aggregate**: In-memory brojači i približne latencije grupisani po nameni,
  modelu i ishodu; ne sadrži prompt, karte, ključ ili raw odgovor.

## AI Call Lifecycle and UI States

```text
bot_turn / analysis_requested
  -> validate local eligibility and bounded context
  -> waiting (attempt 1)
     -> valid structured response -> semantic validation
        -> bot: single engine commit -> completed
        -> analysis: validated display -> completed
     -> retryable failure + budget -> retrying OR model_fallback (attempt 2)
     -> terminal/exhausted/stale/cancelled
        -> bot: local_fallback -> completed with fallback marker
        -> analysis: failed/unavailable -> explicit user retry available
```

Promena partije/ruke/revizije može prevesti interakciju u `stale`; reset ili odlazak
korisnika može je prevesti u `cancelled`. Nijedno terminalno stanje ne prihvata kasni
rezultat. Dashboard beleži bezbednu kategoriju prelaza, ne sadržaj poziva.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Za svih pet konfiguracija 1–5 botova fake-provider scenario sa legalnim
  odgovorom završava tačno jednim engine commit-om i bez regresije Week03 invarijanti.
- **SC-002**: U svim payload proverama broj otkrivenih tuđih privatnih karata, burn
  karata, budućih karata, seed vrednosti i tajni je nula.
- **SC-003**: Za malformed, semantički ilegalan, timeout, 429, 5xx, missing-key,
  stale i dupli odgovor nijedan model predlog ne proizvodi nevalidnu ili dvostruku mutaciju.
- **SC-004**: Po predloženim pragovima, svaki bot potez dobija modelski ili lokalni
  konačni ishod u najviše 12 sekundi i najviše 2 provider pokušaja; nijedna partija
  ne ostaje zaglavljena zbog AI poziva.
- **SC-005**: Po predloženim pragovima, svaki analysis zahtev dobija validiran rezultat
  ili jasan failure status u najviše 30 sekundi i najviše 2 provider pokušaja, bez
  promene završenog rezultata.
- **SC-006**: Svaki analysis fixture povezuje procenu poteza sa tada dostupnim podacima;
  nijedna ocena ne koristi samu pobedu/poraz kao jedini dokaz kvaliteta odluke.
- **SC-007**: Dashboard brojači odgovaraju stvarnom broju logičkih interakcija i
  attempts u determinističkoj test matrici; svaka nevraćena usage/cost vrednost je
  prikazana kao „nepoznato”.
- **SC-008**: Sve automatske AI unit/integration provere rade bez interneta i stvarnog
  ključa; live smoke ostaje zasebna, ručna i opciona provera.
- **SC-009**: Pre implementacije je eksplicitno odobreno i evidentirano usklađivanje
  `GAME_SPEC.md` §12 i constitution-a sa model-driven botovima, match analizom i
  obaveznim dashboardom; izvori su sada na verzijama v1.1 i v1.1.0.
- **SC-010**: U testu sa providerom koji ostaje pending, nezavisan lokalni read-only
  zahtev završava se pre provider odgovora, dok nijedna dodatna mutacija partije nije prihvaćena.

## Assumptions and Clarify Decisions

- Clarify je obavljen pregledom izvora i zahteva; nema preostale odluke bez koje bi
  korisničko ponašanje bilo neodređeno. Nije bilo potrebno prekidati korisnika pitanjem.
- AI mode se bira u konfiguraciji nove partije. Promena režima tokom aktivne partije
  nije obavezna; korisnik može potvrđeno zameniti partiju postojećim reset tokom.
- Nedostajući ključ ne sprečava lokalnu igru: botovi koriste postojeću strategiju,
  dok je analiza označena unavailable dok konfiguracija ne postane validna.
- Dashboard ostaje procesni in-memory agregat da bi više partija bilo vidljivo u istom
  demo-u; samo eksplicitni dashboard reset ili restart servisa briše metrike.
- Celokupna match analiza zahteva novo bounded memorijsko prikupljanje činjenica kroz
  partiju. Ne čuvaju se pune prompt poruke, raw odgovori ili trajni replay.
- Model ID-jevi, SDK/biblioteka, provider adapter arhitektura, endpoint-i, tačni
  timeout-i, backoff, rate-limit algoritam i vizuelni raspored dashboarda ostaju planu.
- PROP-001–PROP-004 su početni, proverljivi predlozi i moraju biti potvrđeni ili
  obrazloženo promenjeni pre implementacionih testova.

## Scope Boundaries

**U scope-u**: postojeća lokalna poker aplikacija; Google AI Studio Gemini API kao
prvi i jedini provider family; AI predlozi bot poteza; analiza završene partije;
bounded retry/model fallback; timeout/rate-limit ponašanje; lokalni usage dashboard;
Spec Kit/SDD/TDD, runtime i semantička validacija, fake provider i evidence.

**Van scope-a**: pravi novac, plaćanja, nalozi, autentifikacija, ljudski multiplayer,
udaljeni server, baza, trajne partije/replay, leaderboard, deployment/cloud infra,
javno hostovanje, ključ u Git-u/Codex-u/browseru, slanje tuđih skrivenih ili budućih
podataka modelu, direktno modelsko izvršavanje akcije, zaobilaženje validatora,
provider family van Gemini, solver/garancija optimalnosti i bilo koji drugi Week04 scope.

## Traceability and Context Evidence

| Izvor | Potvrđena obaveza ili ograničenje | Veza u feature-u |
|---|---|---|
| `GAME_SPEC.md` §12 | Uređena istorija, tada dostupno znanje, read-only rezime; zabrana model-driven botova u starom scope-u | FR-003–FR-006, FR-016–FR-017, FR-026; eksplicitni konflikt i SC-009 |
| `GAME_SPEC.md` AC18/AC19 i feature 001 FR-012–FR-015/FR-018 | Nema duple mutacije, nema hidden state-a, backend je autoritet, postojeća bot fallback strategija i istorija | FR-003–FR-012, FR-019, AIAC02–AIAC08/14 |
| Constitution I, IV, V, VI, VII | Sledljivost, granice podataka, runtime + semantička validacija, fazna granica i istiniti dokazi | Scope conflict, FR-004–FR-011, FR-022–FR-025, SC-009 |
| Week04 challenge, § „Sesija 004” i test matrix | Read-only ugovor, allowlist/validacija, fake-first, success/negative/failure i safe timeout | US2–US4, AIAC03–AIAC15, FR-024–FR-025 |
| Week04 API addendum §§3, 7, 9–11 | Gemini granica, bounded retry, offline fake, privacy-safe telemetry, unknown usage | FR-002, FR-008–FR-015, FR-020–FR-025 |
| Aktuelni korisnički zahtev 2026-09-26 | Model-driven botovi, match analysis, Gemini-first, dashboard i failure matrix | Ceo feature 002; nadjačava staru produktnu granicu uz SC-009 gate |

### Zvanični Google kontekst proveren 2026-09-26

Korišćeni su samo aktuelni zvanični Google AI for Developers izvori:

- [Gemini API libraries](https://ai.google.dev/gemini-api/docs/libraries): Google
  preporučuje Google GenAI SDK i navodi podršku za JavaScript/TypeScript; konkretan
  izbor i verzija biblioteke ostaju planu.
- [API keys](https://ai.google.dev/gemini-api/docs/api-key): dokumentovani su
  `GEMINI_API_KEY`/`GOOGLE_API_KEY` environment pristup i server-side čuvanje ključa;
  feature standardizuje `GEMINI_API_KEY` bez zapisivanja vrednosti.
- [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output):
  podržan je JSON Schema subset, ali aplikacija i dalje mora lokalno validirati
  semantiku; zato model output nikada nije neposredna game komanda.
- [Function calling](https://ai.google.dev/gemini-api/docs/function-calling): model
  predlaže funkciju i argumente, dok aplikacija izvršava i proverava operaciju. Feature
  ne zahteva da se bot predlog tehnički realizuje function calling-om; odluka ostaje planu.
- [Models](https://ai.google.dev/gemini-api/docs/models): dostupnost i životni ciklus
  modela se menjaju; zato spec ne zaključava model ID i zahteva server-side konfiguraciju.
- [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits): limiti zavise od
  modela i project tier-a, mere se po projektu i prekoračenje može dati 429; nijedna
  konkretna kvota se ovde ne obećava.
- [Billing](https://ai.google.dev/gemini-api/docs/billing) i
  [pricing](https://ai.google.dev/gemini-api/docs/pricing): free tier postoji samo za
  određene modele i njihove limite; billing, cena i dostupnost zavise od projekta,
  naloga i modela. Spec ne tvrdi da su svi modeli ili pozivi besplatni.

Zvanične stranice su vremenski promenljiv kontekst. Pre planiranja konkretnog modela
i pre opcionog live smoke testa MORAJU se ponovo proveriti model availability, capability,
quota i billing za stvarni projekat; nijedna vrednost ključa se ne unosi u dokumentaciju
ili razgovor.
