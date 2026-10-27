# Retro Poker — instrukcije za coding agenta

## Namena i obim

Week05 je završen. Naknadne summary/usage/frontend dorade su privatni razvoj,
nisu doprinos nijednoj nastavnoj nedelji; feature 004 čuva frontend i mobilni raspored.
Od 2026-10-25 feature `005-week08-secure-the-arcade` na grani `week08-init`
planira Week08 hardening postojećeg coaching toka. Zadržava privatne dorade i ne
otvara ponovo Week05 taskove. SpecKit feature putanja i Git grana imaju nezavisna imena.

Radi na Week03–Week05 projektu Retro Poker: lokalnoj retro browser igri No-Limit Texas Hold'em. Jedan čovek igra protiv 1–5 programskih botova, najviše šest učesnika ukupno. Postoje frontend i mali backend sa stanjem u memoriji. Poker je odobren od predavača; Spec Kit i TDD su dogovoreni način rada. Week04 dodaje AI botove i analizu; Week05 dodaje ograničen, read-only agentski tok za analizu završene partije.

Projektni koren je direktorijum u kome je ovaj fajl (`retro-poker/`). Git koren može biti njegov roditelj; proveri ga pre Git operacija. Sve putanje ispod odnose se na projektni koren. Dokumentaciju i objašnjenja piši na srpskom latinicom, identifikatore u kodu na engleskom.

## Izvori i kontekst

- Aktuelni korisnički zahtevi određuju promene scope-a; trajne odluke prenesi u dokumente.
- `docs/GAME_SPEC.md` je autoritativan za ponašanje igre, Week03–Week05 granice i Definition of Done.
- Ovaj fajl određuje način rada. `.specify/memory/constitution.md` određuje usvojene inženjerske principe tek kada bude popunjen; postojeći placeholder-i nisu donete odluke.
- Aktivni `specs/<feature>/spec.md`, `plan.md`, `tasks.md` razrađuju zahteve; ne smeju tiho menjati `GAME_SPEC.md`. Konflikt prijavi i uskladi pre zavisne implementacije.
- Za Week08 izvor je `../milan/weekly-assignment week08.md` (verzija 23.10.2026),
  identičan `../Nedelja-08/02-Nedeljni-zadatak-Secure-the-Arcade.md`, i
  `../Nedelja-08/` MD materijali/šablon. Roditeljski `weekly-assignment.md` u
  Milanovom checkout-u sadrži istorijski Week05 i nije Week08 izvor.
  Materijali nisu garantovani u drugom checkout-u; feature 005 i `docs/EVIDENCE_W08.md`
  sadrže potrebne zahteve. PDF/PPTX ne dodaju zaseban scope samo zato što postoje.
- `../suggestion.md` je istorijski predlog. Fiksna ulaganja, izostavljanje all-in/side potova, opcioni Spec Kit i čekanje odobrenja za poker više ne važe. Ne uključuj ceo taj fajl u implementacione promptove.
- Izvor zadatka je `../week-03-week-04-pdf-review/materijali-za-studente/week-03-week-04-retro-ai-engineering-challenge.md`; TDD/SDD smernice su u susednom `week-03-tdd-sdd-agentic-engineering-addendum.md`. Ti materijali mogu nedostajati u koleginom checkout-u jer nisu verzionisani. Zahtevi potrebni za rad moraju biti u projektnim dokumentima.
- Učitaj samo relevantan scenario, ugovor, test i kod. U `docs/CONTEXT_MANIFEST.md` beleži stvarno korišćene izvore, verzije, prioritet, razlog uključivanja/izostavljanja i rizik. Dostupan fajl nije dokaz da je učitan.

## Spec Kit i rad u malim koracima

1. Pre implementacije sažmi cilj, napiši kratak plan, pretpostavke i kriterijum provere.
2. Koristi projektne Spec Kit skills iz `.agents/skills/`; pre pozivanja pročitaj odgovarajući `SKILL.md` i njegove potrebne reference.
3. Tok: constitution → specify → clarify po potrebi → plan → tasks → implement → converge. Korisnički zahtev za samo dokumentaciju ne pokreće automatski implementaciju.
4. U feature specifikaciju prenesi relevantne zahteve sa ID-jevima iz `GAME_SPEC.md`. U planu dogovori frameworke, ugovore, strukturu i komande. U taskovima navedi vlasnika, zavisnosti, dozvoljene putanje i dokaz završetka.
5. Sačuvaj `docs/BUILD_PROMPT_V1.md` pre prve velike implementacije: uloga, cilj, scope, pravila, kontekst, dozvoljene izmene, DoD, provere, plan i nejasnoće. Za Week04 je sačuvan `docs/BUILD_PROMPT_WEEK04_V1.md`. Za novu veliku Week05 implementaciju sačuvaj `docs/BUILD_PROMPT_WEEK05_V1.md` pre koda; to je projektni zahtev, ne zaseban obavezni nastavni artefakt. Značajne kasnije promptove sačuvaj odvojeno; ne prepisuj prethodne promptove.
6. Radi jedan mali behavior slice. Rutinske odluke unutar dogovorenog plana donosi samostalno. Pitaj samo kada konflikt ili nedostajuća produktna odluka menja pravila, ugovor ili scope.
   Za Week08 pre svake faze proveri implementaciju/diff i fokusirane testove prethodne
   faze; prvo zatvori stvaran propust, zatim nastavi. Pre prvog security koda sačuvaj
   `docs/BUILD_PROMPT_WEEK08_V1.md` prema T004; trenutna priprema ga ne označava gotovim.
7. Ako se isti problem ponavlja oko 20 minuta, zabeleži cilj, očekivanje, stvarni rezultat, pokušaje i dokaz; ne širi zadatak nasumičnim izmenama.

## TDD i proverljivost

- Za promenu ponašanja prvo napiši test iz acceptance scenarija, pokreni ga i sačuvaj RED rezultat sa očekivanim razlogom pada. Greška u test setup-u nije dokaz nedostajućeg ponašanja.
- Zatim implementiraj najmanju promenu za GREEN. Refaktoriši tek posle zelenog testa i ponovi relevantne provere.
- Ne oslabljuj assertion-e, ne preskači testove i ne menjaj očekivanje da bi pogrešan kod prošao. Promena poslovnog očekivanja zahteva obrazloženu izmenu specifikacije.
- Poker oracle mora imati unapred izračunat ishod; ne koristi testiranu funkciju za računanje očekivanja. Koristi kontrolisan špil i zaseban kontrolisan generator slučajnosti za botove. Seed i špil ne smeju biti izloženi kroz produkcioni API.
- Pokrij semantiku, granice, negativne slučajeve, hand evaluator, čuvanje žetona, skrivanje karata i ceo tok UI–API–engine. TypeScript tip ili `as` cast nisu runtime validacija.
- Za izmene same dokumentacije proveri konzistentnost i linkove; ne izmišljaj RED/GREEN ciklus.
- Ne navodi PASS, pokrenute komande, rezultate, screenshotove, trošak ili doprinos čoveka ako nisu stvarno zabeleženi. Testove koji nisu pokrenuti označi kao takve.

## Arhitektonske granice

- Koristi TypeScript za frontend, backend i zajedničke ugovore. Konkretne frameworke i test alate biraj u Spec Kit planu prema postojećem stanju, bez nepotrebnih zavisnosti.
- Poker engine i evaluator moraju biti nezavisni od UI-ja, HTTP-a i budućeg AI provajdera.
- Backend je jedini autoritet nad špilom, potezima, potovima i stackovima. Bot prolazi iste provere kao čovek, uz pristup samo sopstvenim i javnim informacijama.
- Frontend i backend slušaju samo na loopback adresama. Jedna lokalna partija, memorijsko stanje, bez trajnog čuvanja partija, baze ili mrežnog multiplayera.
- Šeme proveravaju tipove, granice i nepoznata polja; domen proverava red poteza, fazu, iznose i prava. Nevalidan zahtev ne menja stanje, RNG ni istoriju prihvaćenih poteza.
- Klijentu šalji samo `GameView`, ne interno stanje. Žetoni su celobrojni, bez realnog novca.
- Week03 nema LLM/API poziva u igri; Week04 AI pozivi su ograničeni na odobrene bot odluke i analizu; Week05 agent služi samo analizi završene partije, preko eksplicitnog read-only alata. Agent ne menja igru.
- Ne dodaj naloge, bazu, leaderboard, deployment, cloud servise, Docker infrastrukturu, plaćanja ili dodatne game modove.
- Week08: fake provider/sintetički podaci, bez live poziva ili pravih ključeva.
  Dokaži I1–I8, T00–T17, normalan W05 tok i najmanje tri ista scenarija pre/posle;
  postojeća dobra kontrola daje PASS→PASS, ne izmišljeni RED. Cross-request kapacitet
  meri stvarno aktivan rad, ne samo stanje run-a. Produkciona zaglavlja proveri na
  lokalnom build-u; dev HMR, UI disable i CORS nisu zamena za izvršne kontrole.

## Komande i stanje projekta

Inicijalni scaffold je istorija: aplikacija, package.json i test runner-i postoje.
Aktuelne komande proveri u package.json. Week08 `test:security` i
`test:security:e2e` uvedene su kroz T007/T022. `demo:security` je zaseban lokalni
fake-only profil za ljudski pregled; constructor fixture-i nisu produkcioni API.

Tokom inicijalnog setup taska uvedi i dokumentuj sledeći npm interfejs u projektni `README.md` i `package.json`:

| Komanda | Namena posle setup-a |
|---|---|
| `npm ci` | Ponovljiva instalacija iz commitovanog lockfile-a |
| `npm run dev` | Lokalni frontend i backend; dokumentovane adrese |
| `npm test` | Jednokratno pokretanje determinističkih unit/contract/integration testova |
| `npm run test:e2e` | Lokalna provera korisničkog toka |
| `npm run typecheck` | Provera TypeScript tipova |
| `npm run lint` | Provera koda |
| `npm run build` | Lokalna izgradnja oba dela |

Prvu instalaciju i nastanak lockfile-a objasni u README-u. Posle koherentne izmene pokreni fokusirani test i relevantnu regresiju; pre Week03 predaje pokreni sve navedene provere koje se odnose na aplikaciju. Zabeleži stvarne komande, verzije i exit status.

## Dokazi, par i Git

- Sačuvaj baseline kroz prepoznatljiv commit/tag ili drugi ponovljiv snapshot, početni prompt, manifest, komande, rezultate i screenshot. Ne zameni ga popravljenom verzijom.
- `docs/EVALS.md`: najmanje četiri slučaja (tipičan, granični, nevalidan, stvarni raniji propust), očekivanja pre pokretanja, isti skup pre/posle jedne ciljane promene. Ne ubacuj bug namerno da bi dobio dokaz. Dodaj nezavisan holdout.
- `docs/EVIDENCE_003.md`: tvrdnja, signal, hipoteza, najmanja promena, provera, stvarni rezultat, ograničenje i doprinos oba člana.
- `docs/AI_USAGE_LOG.md`: svrha značajnog poziva, očekivanje, model/alat kada je poznat, kontekst, ishod, ljudska odluka i dostupna potrošnja. Nepoznat trošak označi kao nepoznat; ne čuvaj privatni chain-of-thought.
- Za Core radi jedan coding agent odjednom. Dva ljudska člana mogu raditi naizmenično, uključujući nastavak iste stavke; task owner označava ko trenutno vodi, a ne zabranu drugom članu da nastavi. Ne pretpostavljaj istovremene izmene istih fajlova. Pre handoff-a zabeleži stvarni status, komande, rezultate i sledeći korak; ne pripisuj drugom članu rad ili review koji nije potvrđen.
- Za W03/W04 važe njihovi zabeleženi razvojni i demo budžeti. Za W05 ciljaj do 15 live agent run-ova tokom razvoja i do 3 u finalnom demo-u; fake-provider testovi su podrazumevani. Ne žrtvuj ispravnost radi broja; odstupanje zabeleži.
- Istorijska W05 live odobrenja nisu Week08 odobrenja. W08 dokaz je fake-only;
  novi glavni zapis je `docs/EVIDENCE_W08.md`, sa lokalnim/CI/ljudskim ishodima
  odvojeno. Svaki član doprinosi kontroli i negativnom testu; vlasnik taska se menja
  pri handoff-u, bez pretpostavke o Milanovom review-u ili merge-u otvorenog PR-a.
- Uloge A/B iz starijih feature-a su istorijske smernice, ne fiksna podela za Week05. Obojica pišu/proveravaju testove, pregledaju ugovore i doprinose dokazima; stvarnu naizmeničnu vožnju zabeleži bez izmišljanja potvrde.
- Verzioniši `.agents/`, deljenu `.specify/` infrastrukturu, specifikacije, promptove, evidence i lockfile. Poštuj postojeći `.specify/.gitignore` za lokalno stanje. Ne commituj tajne, `.env`, dependency foldere i generisani build/cache.
- Sačuvaj postojeće korisničke izmene. Menjaj samo fajlove potrebne za trenutni task; ne preuređuj materijale iz roditeljskog direktorijuma.

## Handoff

Navedi šta je promenjeno, zahtev/task koji je pokriven, provere i stvarne rezultate, provere koje nisu pokrenute i poznata ograničenja. Funkcionalnost je gotova kada se specifikacija, taskovi, kod, testovi i dokaz slažu.
