# Feature Specification: Week08 — Secure the Arcade

**Feature Branch**: `week08-init`

**Created**: 2026-10-25

**Status**: Specifikovano; bezbednosna implementacija i dokazi još nisu završeni.

**Input**: Week08 zadatak od 23.10.2026, korisnički zahtev za planiranje i pripremu osnove.

## User Scenarios & Testing

### US1 — Legitimna analiza ostaje dostupna, nedozvoljena radnja se odbija (P1)

Igrač završava partiju i bira jedan od postojećih coaching ciljeva. Coaching daje
validirane dokaze bez promene rezultata partije. Klijent i model nemaju mogućnost
da prošire ovlašćenja ili izaberu drugi opseg podataka.

**Zašto P1**: to je postojeća vrednost proizvoda i obavezna W05 osnova.
**Nezavisna provera**: sintetička završena partija, fake model, stvarni dozvoljeni alat.

1. Za validan zahtev postoje dva modelska koraka, jedno stvarno izvršenje
   `get_decision_evidence`, validan final i identično kanonsko poker stanje pre/posle.
2. Neispravan početni zahtev, nepoznata partija ili zastarela revizija daju
   kontrolisano odbijanje, nula provider/tool poziva i nepromenjeno stanje.
3. Nepoznat alat, nasleđeno ime, loši argumenti ili inače validni argumenti van
   dozvoljenog opsega ne dovode do tool izvršenja. Pozitivna varijanta prolazi.
4. Nevalidan ili prevelik model/tool rezultat i dokaz iz druge partije ne ulaze
   u uspešan rezultat; nedozvoljeno tool polje ne ide u drugi modelski poziv.
5. Ručno izmenjen browser prikaz, zahtev ili storage ne postaje serverski rezultat.

### US2 — Potrošnja ostaje ograničena i posle više zahteva (P1)

Igrač dobija razumljivo odbijanje kada nema kapaciteta i kasnije može ponovo
pokrenuti coaching. Nova partija, retry ili reset analitike ne zaobilaze politiku.

**Zašto P1**: pojedinačni timeout ne ograničava zbir poslova ni ponovljene zahteve.
**Nezavisna provera**: fake sat i provider sa kontrolisanim, uključujući neotkazivim, poslovima.

1. Pozivi, retry i fallback dele isti ukupni budžet; prekoračenje ne šalje novi poziv.
2. Per-call timeout i ukupni deadline nezavisno zaustavljaju nastavak; zakašnjeli
   odgovor ne pretvara zaustavljen/zastareo run u uspešan.
3. Globalne granice aktivnog rada i učestalosti važe preko više zahteva. Višak se
   odbija pre novog provider/tool rada; dozvoljen zahtev prolazi po oporavku.
4. Posao koji ignoriše abort ostaje obračunat dok stvarno ne završi. Nova partija
   ili reset usage-a ne oslobađaju taj kapacitet i ne resetuju rate prozor.

### US3 — AI tekst ostaje tekst u browseru (P1)

Igrač može pročitati preporuku bez izvršavanja sadržaja koji je predložio model.
Produkcioni lokalni prikaz zadržava postojeće karte, čipove i mobilni raspored.

**Zašto P1**: završni odgovor je nepouzdan i kada ima validnu strukturu.
**Nezavisna provera**: pravi browser, normalan i maliciozan fake final iste dozvoljene forme.

1. XSS marker ne izvršava kod i ne proizvodi opasne DOM elemente/atribute.
2. HTML, Markdown i `javascript:`/spoljni linkovi ostaju neaktivni tekst; nema
   automatske navigacije ili učitavanja slike iz preporuke.
3. Srpska slova, apostrof i `a < b` ostaju čitljivi; validan coaching radi.
4. Lokalni production build šalje aktivnu CSP politiku i ostala tražena zaglavlja.
   Dostupan kontrolisan zabranjeni resurs blokira konkretna direktiva, bez
   zaobilaženja CSP-a u testu. Igra i AI prikaz ostaju funkcionalni.

### US4 — Tim može ponoviti i objasniti dokaz bez otkrivanja tajni (P2)

Oba člana mogu iz checkout-a ponoviti security provere i povezati svaku zaštitu
sa pretnjom, izvršnim kodom i opaženim rezultatom.

**Zašto P2**: bez ponovljivog dokaza implementacija ne zatvara zadatak; nije opciono.
**Nezavisna provera**: sintetička tajna, kontrolisane greške/log injection i novi checkout.

1. Server učita sentinel, ali ga nema u klijentskim artefaktima, response-u,
   model kontekstu ni security događajima, uključujući error i tool grane.
2. Prihvaćeni/odbijeni zahtevi i završetak imaju samo dozvoljene metapodatke;
   sirovi napadački tekst ne kreira lažni log događaj.
3. Matrica T00–T17, najmanje tri pre/posle poređenja, audit i ograničenja imaju
   stvarne rezultate. Svaki član doprinosi kontroli i negativnom testu i može ih objasniti.

### Edge Cases

- Jednaka/naredna UTF-8 byte granica, Unicode code point granice, null/missing/extra polja.
- Deduplikovan start nasuprot novom izvršavanju; istovremeni različiti ciljevi.
- `constructor`, `toString`, ponovljen alat, lažni ili tuđi evidence pri istoj facts reviziji.
- Zbir kratkih poziva/backoff-a prelazi deadline iako pojedinačni poziv ne prelazi timeout.
- Abort koji provider ignoriše, reset usage-a, nova partija i zakašneli rezultat.
- Aktivna CSP uz dinamične stilove; bezbedan DOM mora se proveriti i nezavisno od CSP blokade.
- Nema dokaza za izabrani cilj: kontrolisan `insufficient_evidence`, ne izmišljen uspeh.

## Requirements

### Functional Requirements

| ID | Zahtev | Invarijanta / scenario zadatka |
|---|---|---|
| FR-001 | Očuvati normalnu igru i uspešan read-only coaching sa ≥2 model koraka i ≥1 stvarnim alatom. | I4, I8; T00 |
| FR-002 | Runtime proveriti ulaz, nepoznata polja, domenske vrednosti i body pre punog parsiranja; privilegovana polja odbiti. | I1, I2; T01–T02 |
| FR-003 | Scope je aktuelna serverska partija/ruka/revizija; ID resursa nije identitet. Klijentsko stanje nije autoritet. | I1–I4; T03, T08, T15 |
| FR-004 | Izvršiti samo allowlist alat posle provere argumenata i scope-a; model nema shell/filesystem/URL fetch ni promenu pravila. | I3; T07–T09 |
| FR-005 | Proveriti oblik, veličinu, polja i kanonsko članstvo tool rezultata pre drugog modela; final evidence pripada istom run-u. | I3, I7; T06, T10 |
| FR-006 | Ograničiti korake, tool rad i sve pokušaje zajedno, veličine konteksta/izlaza i izlazne tokene adaptera; nema skrivenog retry proširenja. | I6; T02, T06, T10–T11 |
| FR-007 | Sprovoditi per-call timeout i ukupan deadline, propagirati abort i odbiti kasni rezultat; konačan lokalni rad ima sopstvenu granicu. | I4, I6; T12 |
| FR-008 | Sprovoditi procesne granice aktivnog rada i učestalosti; deduplikacija nije rate limit, timeout nije završetak neotkazivog posla. | I6; T13, T17 |
| FR-009 | Nepouzdan tekst prikazati bez izvršivog HTML-a, URL-a ili automatskog udaljenog sadržaja; očuvati normalan tekst. | I5; T04–T05 |
| FR-010 | Lokalni production profil ima aktivnu CSP bez proizvoljnog inline/eval JS-a, ograničene izvore, object/base/frame zaštitu, nosniff i Referrer-Policy. | I5, I8; T16 |
| FR-011 | Sintetička učitana serverska tajna ne stiže u browser/model/logove; minimizovati podatke i proveriti greške i extra tool polja. | I7; T10, T14, T16 |
| FR-012 | Beležiti minimalne acceptance/rejection/terminal događaje sa serverskim correlation ID-jem, bez raw sadržaja; definisati pristup i retention. | I7; T14 |
| FR-013 | Dokumentovati i proveriti loopback/origin politiku i credential model; CSRF test dodati ako postoji automatski credential. CORS nije autentikacija. | I1, I7; T01, CSRF |
| FR-014 | Pregledati lockfile i dependency audit, razlikovati runtime/dev izloženost i zabeležiti odluku po relevantnom nalazu. | I7; audit |
| FR-015 | Sačuvati početni snapshot, pre/posle za ≥3 ista scenarija, T00–T17 matricu, ponovljive komande i stvarni doprinos para. | I1–I8; svi |

### Obavezne invarijante

| ID | Pravilo |
|---|---|
| I1 | Odbijen početni HTTP zahtev ne pokreće provider niti poslovni alat. |
| I2 | Browser i model ne određuju identitet, ovlašćenja, provider konfiguraciju ni limite. |
| I3 | Izvršava se samo dozvoljen alat sa validnim argumentima u dozvoljenom scope-u. |
| I4 | Coaching ne menja kanonsko poker stanje. Run/usage/security metapodaci nisu poker rezultat. |
| I5 | Nepouzdan izlaz ne postaje izvršiv browser sadržaj. |
| I6 | Broj poziva, trajanje, veličine i stvarno aktivan rad imaju serverske granice. |
| I7 | Tajne ostaju na serveru; svaki izlaz dobija samo dozvoljene potrebne podatke. |
| I8 | Normalan W05 tok uspeva i posle ojačavanja. |

Sledljivost do GAME_SPEC: ARCH1–ARCH8, AC19, AC23, §13–14 read-only W05 ugovor
i novi W08-01–W08-08. Konkretne granice i enforcement lokacije određuje [plan](plan.md).

### Key Entities

Coaching zahtev; serverski snapshot/fingerprint; ograničeno agentsko izvršavanje;
dozvoljeni dokaz odluke; procesni kapacitet i prozor prihvatanja; minimalni security
događaj; sintetički fixture i opaženi test rezultat. Nema novih naloga niti privatne arhive.

## Success Criteria

- **SC-001**: T00 prolazi sa stvarnim alatom, tačnim poker rezultatom i validnim finalom.
- **SC-002**: T00–T15 i T17 automatizovani; T04/T05 u pravom browseru; T16 ima
  proverljiva stvarna zaglavlja, CSP blokadu i pozitivan normalan tok. Nema praznih obaveznih redova.
- **SC-003**: ≥3 ista ulaza imaju početni i završni rezultat; postojeća dobra kontrola
  može biti PASS→PASS. Ne uvodi se propust radi demonstracije.
- **SC-004**: Svaka I1–I8 ima kontrolu i test; ukupni i cross-request limiti važe
  uz retry, fallback, timeout, reset i legitimni oporavak.
- **SC-005**: Sentinel i log injection provere prolaze; zavisnosti i preostali rizici
  su pregledani, a neizvršene provere jasno označene.
- **SC-006**: Oba člana ponove provere i objasne svoj kontrolni i negativni test;
  pripremljen demo od osam minuta i individualna varijanta.

## Assumptions

- Week05 je završen. Privatne dorade na `add-modifications` nisu Week08 doprinos.
  `week08-init` ih nasleđuje i zadržava; otvoreni PR ne mora biti merged za lokalni rad.
- Jedan lokalni proces/jedna partija, loopback, bez auth/cookie sesije, baze,
  leaderboard-a, replay importa ili korisničkog slobodnog teksta ka coach modelu.
  Ovo se ponovo proverava testovima; ne dodaju se te mogućnosti radi zadatka.
- Prompt injection test dokazuje izvršnu kontrolu nad malicioznim fake predlogom,
  ne otpornost stvarnog modela. Nema živih API poziva, pravih ključeva ili privatnih podataka.
- Bez deployment-a, novog dizajna fronta, model migracije i obećanja produkcijske dostupnosti.
- Izvori su lokalni nastavni MD fajlovi; njihov neversionisani status ne sme sprečiti
  kolegu da radi iz ovih feature dokumenata i [evidence-a](../../docs/EVIDENCE_W08.md).
