<!--
Sync Impact Report — privremena beleška za pregled; ukloniti pre commit-a.
Version: nepopunjen scaffold → 1.0.0 (prvo usvajanje).
Principles: pet placeholder principa zamenjeno je sa sedam projektnih principa:
I. Specifikacija pre implementacije; II. Obavezan TDD;
III. Ispravnost domena i deterministički dokazi; IV. Autoritet i granice podataka;
V. Strukturisani ugovori i validacija; VI. Lokalni scope i granica faza;
VII. Ponovljivost i istinitost dokaza.
Added sections: Projektna ograničenja; Tok rada i uslovi prihvatanja;
popunjena Governance pravila izmene, verzionisanja i pregleda.
Removed sections: nema usvojenih odeljaka; uklonjeni su primeri i placeholder-i.
Conflicts: nisu pronađeni u odnosu na AGENTS.md i docs/GAME_SPEC.md v1.0.
Deferred placeholders: nema. AC15/AC21 fixture tabele ostaju obaveza budućeg plana.
Dependent templates/commands: nisu menjani; constitution čitaju tokom izvršavanja.
-->

# Retro Poker Constitution

## Core Principles

### I. Specifikacija pre implementacije

Svaka promena ponašanja MORA da ima opisan zahtev, acceptance scenario i očekivani
ishod pre pisanja implementacije. [GAME_SPEC.md](../../docs/GAME_SPEC.md) određuje
ponašanje igre i granice isporuke. Feature `spec.md`, `plan.md` i `tasks.md` MORAJU
čuvati sledljivost do relevantnih R, BOT, ARCH i AC oznaka iz tog dokumenta.
Plan MORA definisati ugovore i provere pre zavisnih implementacionih taskova.
Konflikt se MORA prijaviti i uskladiti pre rada koji od njega zavisi; nije dozvoljeno
tiho menjati pravila ili acceptance očekivanja radi lakše implementacije.

### II. Obavezan TDD

Za svaku promenu ponašanja redosled MORA biti RED → GREEN → refactor:
prvo test sa unapred određenim očekivanjem i zabeleženim padom zbog nedostajućeg
ponašanja, zatim najmanja implementacija koja prolazi, pa eventualno refaktorisanje
uz ponovljene relevantne provere. Neispravan test setup ne predstavlja smislen RED.
Zabranjeno je slabljenje assertion-a, preskakanje testova ili prilagođavanje
očekivanja pogrešnom kodu. Ispravka pogrešnog očekivanja MORA imati obrazloženje
u specifikaciji i dokazima. Za promene same dokumentacije proveravaju se sadržaj,
konzistentnost i linkovi; ne izmišlja se RED/GREEN ciklus.

### III. Ispravnost domena i deterministički dokazi

Engine i evaluator MORAJU poštovati pravila i acceptance scenarije iz GAME_SPEC,
uključujući granične situacije, bez prepisivanja svih poker pravila u ovaj dokument.
Svaki prihvaćeni prelaz MORA očuvati ukupan broj žetona, jedinstvenost karata,
legalan red poteza i nenegativne celobrojne stackove. Refund i isplata pota MORAJU
se izvršiti najviše jednom za isti obračun.
Testovi MORAJU imati nezavisno izračunate očekivane rezultate; testirana funkcija
ne sme biti sopstveni oracle. Kontrolisani špil, početno stanje i odvojena slučajnost
botova MORAJU omogućiti ponavljanje testa. Konkretne fixture tabele za AC15 i AC21
MORAJU biti pripremljene u planu pre njihovih RED testova.

### IV. Autoritet i granice podataka

Backend MORA biti jedini autoritet nad špilom, akcijama, stackovima i potovima.
Engine i evaluator MORAJU biti nezavisni od UI-ja, HTTP transporta i AI provajdera.
Ljudske i bot akcije MORAJU prolaziti ista domenska pravila. Bot sme dobiti samo
sopstvene i javno dostupne informacije. Klijent MORA dobiti javni pogled umesto
internog stanja; otkrivanje karata prati GAME_SPEC. Nepodeljeni špil, burn karte,
seed i tuđe skrivene karte ne smeju procureti kroz odgovore, greške ili UI istoriju.
Test pristup internom stanju ne sme postati produkcioni debug endpoint.

### V. Strukturisani ugovori i validacija

Granice sistema MORAJU imati eksplicitne deljene šeme i tipove. Backend MORA pre
mutacije proveriti oblik ulaza, tipove, granice, nepoznata polja i domensku legalnost.
Frontend MORA runtime proveriti primljene ugovore pre prikaza; TypeScript tip ili
cast nije runtime provera. Validan JSON sam po sebi ne znači legalan potez.
Nevalidni i zastareli zahtevi ne smeju menjati stanje, RNG, reviziju ili istoriju
prihvaćenih akcija. Obrada MORA biti serijska i sprečiti dvostruku primenu iste
akcije proverom identiteta partije/ruke i očekivane revizije. Greške MORAJU imati
stabilan kod i razumljivu poruku bez skrivenih podataka.

### VI. Lokalni scope i granica faza

Week03 MORA isporučiti lokalnu igru sa jednim čovekom i 1–5 programskih botova,
malim backend-om i stanjem u memoriji, prema GAME_SPEC. Oba servisa MORAJU slušati
samo loopback; posle instalacije zavisnosti igra i testovi MORAJU raditi bez interneta.
Pravi novac, nalozi, ljudski multiplayer, baza, leaderboard i deployment su van scope-a.
LLM pozivi, AI rezime, tool calling i provider SDK ne smeju biti deo Week03 aplikacije.
Week04 analiza zahteva poseban spec i ostaje read-only u odnosu na stanje igre.
Do tada se čuva samo dogovorena memorijska istorija aktuelne i poslednje završene ruke.
Nova zavisnost ili infrastruktura MORA imati neposredno opravdanje u aktivnom zahtevu.

### VII. Ponovljivost i istinitost dokaza

Baseline MORA biti sačuvan kao ponovljiv snapshot sa promptom, kontekstom i rezultatima.
Eval očekivanja MORAJU prethoditi izvršavanju. Jedna ciljana promena proverava se istim
skupom pre/posle, uz nezavisan holdout. Stvarni propust se ne sme izmišljati ili namerno
ubacivati radi demonstracije; ako nije pronađen, kriterijum se prijavljuje kao nezavršen.
Dokazi MORAJU navoditi stvarne komande, rezultate, ograničenja i doprinos oba člana.
AI log MORA razlikovati predlog modela, ljudsku odluku i potvrđen rezultat; nepoznata
potrošnja se označava kao nepoznata. Zabranjeno je tvrditi da test, review, screenshot
ili ljudski doprinos postoji bez dokaza. Tajne i privatni chain-of-thought se ne čuvaju.

## Projektna ograničenja

- Projektni koren je `retro-poker/`; Git koren može biti roditeljski direktorijum.
  Operacije MORAJU poštovati tu razliku i sačuvati postojeće korisničke izmene.
- Koriste se TypeScript frontend, backend i deljeni ugovori. Framework-i, test alati
  i detaljna struktura biraju se u planu, u okviru arhitektonskih zahteva GAME_SPEC.
- Dokumentacija i objašnjenja pišu se srpskom latinicom; identifikatori su na engleskom.
- [AGENTS.md](../../AGENTS.md) daje operativne instrukcije. `suggestion.md` je istorijski
  predlog i ne može nadjačati aktuelnu specifikaciju i usvojene principe.
- Za Core se koristi jedan coding agent, bez paralelnih agenata. Podela između dva
  člana, zamena driver/reviewer uloga i operativni budžet prate AGENTS.md.

## Tok rada i uslovi prihvatanja

1. Spec Kit tok je constitution → specify → clarify po potrebi → plan → tasks →
   implement → converge. Svaki implementacioni task MORA navesti vlasnika, zavisnosti,
   dozvoljene putanje i proverljiv kriterijum završetka.
2. Pre velike implementacije MORAJU biti sačuvani `docs/BUILD_PROMPT_V1.md` i
   `docs/CONTEXT_MANIFEST.md`. Manifest navodi stvarno korišćen kontekst, verzije,
   prioritete i razloge izbora; dostupnost fajla ne dokazuje da je pročitan.
3. Posle izmene MORAJU se izvršiti fokusirane i relevantne regresione provere.
   Pre Week03 predaje MORAJU proći unit/contract/integration i E2E provere, typecheck,
   lint i build kroz dokumentovane komande. Komande se ne smatraju postojećim dok
   ih setup ne uvede; provera koja nije izvršena MORA biti tako označena.
4. `docs/EVALS.md` MORA obuhvatiti tipičan, granični, nevalidan i stvarni ranije
   neuspešan slučaj. `docs/EVIDENCE_003.md` i `docs/AI_USAGE_LOG.md` MORAJU zajedno
   povezati tvrdnju, signal, hipotezu, promenu, proveru, rezultat i ograničenje.
5. Pregled svakog plana i završene promene MORA proveriti usklađenost sa ovim
   principima, sledljivost zahteva i dokaze. Nepokriven obavezan zahtev sprečava
   proglašavanje odgovarajućeg taska ili Week03 isporuke završenim.
6. Drugi član MORA moći iz checkout-a da ponovi instalaciju, lokalno pokretanje
   i dokumentovane provere. Konačni kriterijumi su u GAME_SPEC §11.

## Governance

Ovo je prvo usvajanje principa projekta, verzija 1.0.0, na izričit zahtev vlasnika.
Constitution uređuje inženjerske principe, GAME_SPEC ponašanje proizvoda, a AGENTS
rad agenta. Feature artefakti MORAJU biti usklađeni sa sva tri dokumenta; konflikt
se prijavljuje i rešava pre zavisne implementacije, bez tihog prepisivanja izvora.

Izmena principa MORA navesti razlog, promenjene odredbe, uticaj na postojeće
specifikacije, planove, testove i dokaze, kao i potrebne korake usklađivanja.
Usvojena korisnička odluka predstavlja autorizaciju u svom obimu; agent ne sme sam
uvoditi izuzetke radi prolaska testova ili pogodnosti implementacije. Promena scope-a
MORA se preneti u GAME_SPEC i zavisne artefakte pre prihvatanja implementacije.

Verzija se menja po pravilima MAJOR.MINOR.PATCH: MAJOR za uklanjanje ili nespojivu
promenu principa; MINOR za novi princip ili materijalno proširenu obavezu; PATCH za
pojašnjenje bez promene obaveza. Datum prvog usvajanja ostaje isti, a datum poslednje
izmene prati stvarnu izmenu. Sync Impact Report prati amandman tokom pregleda;
privremeni komentar se uklanja pre commit-a. Dependent šabloni se ne menjaju ovim
korakom; potrebna usklađivanja evidentiraju se i proveravaju u odgovarajućem tasku.

**Version**: 1.0.0 | **Ratified**: 2026-09-21 | **Last Amended**: 2026-09-21
