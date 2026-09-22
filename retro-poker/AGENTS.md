# Retro Poker — instrukcije za coding agenta

## Namena i obim

Radi na Week03 delu Retro AI Engineering Challenge zadatka: lokalnoj retro browser igri No-Limit Texas Hold'em. Jedan čovek igra protiv 1–5 programskih botova, najviše šest učesnika ukupno. Postoje frontend i mali backend sa stanjem u memoriji. Poker je odobren od predavača; Spec Kit i TDD su dogovoreni način rada.

Projektni koren je direktorijum u kome je ovaj fajl (`retro-poker/`). Git koren može biti njegov roditelj; proveri ga pre Git operacija. Sve putanje ispod odnose se na projektni koren. Dokumentaciju i objašnjenja piši na srpskom latinicom, identifikatore u kodu na engleskom.

## Izvori i kontekst

- Aktuelni korisnički zahtevi određuju promene scope-a; trajne odluke prenesi u dokumente.
- `docs/GAME_SPEC.md` je autoritativan za ponašanje igre, granicu Week03/Week04 i Definition of Done.
- Ovaj fajl određuje način rada. `.specify/memory/constitution.md` određuje usvojene inženjerske principe tek kada bude popunjen; postojeći placeholder-i nisu donete odluke.
- Aktivni `specs/<feature>/spec.md`, `plan.md`, `tasks.md` razrađuju zahteve; ne smeju tiho menjati `GAME_SPEC.md`. Konflikt prijavi i uskladi pre zavisne implementacije.
- `../suggestion.md` je istorijski predlog. Fiksna ulaganja, izostavljanje all-in/side potova, opcioni Spec Kit i čekanje odobrenja za poker više ne važe. Ne uključuj ceo taj fajl u implementacione promptove.
- Izvor zadatka je `../week-03-week-04-pdf-review/materijali-za-studente/week-03-week-04-retro-ai-engineering-challenge.md`; TDD/SDD smernice su u susednom `week-03-tdd-sdd-agentic-engineering-addendum.md`. Ti materijali mogu nedostajati u koleginom checkout-u jer nisu verzionisani. Zahtevi potrebni za rad moraju biti u projektnim dokumentima.
- Učitaj samo relevantan scenario, ugovor, test i kod. U `docs/CONTEXT_MANIFEST.md` beleži stvarno korišćene izvore, verzije, prioritet, razlog uključivanja/izostavljanja i rizik. Dostupan fajl nije dokaz da je učitan.

## Spec Kit i rad u malim koracima

1. Pre implementacije sažmi cilj, napiši kratak plan, pretpostavke i kriterijum provere.
2. Koristi projektne Spec Kit skills iz `.agents/skills/`; pre pozivanja pročitaj odgovarajući `SKILL.md` i njegove potrebne reference.
3. Tok: constitution → specify → clarify po potrebi → plan → tasks → implement → converge. Korisnički zahtev za samo dokumentaciju ne pokreće automatski implementaciju.
4. U feature specifikaciju prenesi relevantne zahteve sa ID-jevima iz `GAME_SPEC.md`. U planu dogovori frameworke, ugovore, strukturu i komande. U taskovima navedi vlasnika, zavisnosti, dozvoljene putanje i dokaz završetka.
5. Sačuvaj `docs/BUILD_PROMPT_V1.md` pre prve velike implementacije: uloga, cilj, scope, pravila, kontekst, dozvoljene izmene, DoD, provere, plan i nejasnoće. Značajne kasnije promptove sačuvaj odvojeno; ne prepisuj V1.
6. Radi jedan mali behavior slice. Rutinske odluke unutar dogovorenog plana donosi samostalno. Pitaj samo kada konflikt ili nedostajuća produktna odluka menja pravila, ugovor ili scope.
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
- U Week03 nema LLM/API poziva u igri, AI rezimea, tool calling-a niti lažno označenih AI odgovora. Coding agent služi razvoju; botovi su programska logika.
- Ne dodaj naloge, bazu, leaderboard, deployment, cloud servise, Docker infrastrukturu, plaćanja ili dodatne game modove.

## Komande i stanje projekta

Pri kreiranju ovog dokumenta postoji Spec Kit scaffold, ali nema `package.json`, aplikacije ni test runner-a. Ne predstavljaj buduće komande kao postojeće ili uspešno izvršene.

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
- Radite sa jednim coding agentom; nema paralelnih agenata za Core. Operativni budžet celog zadatka: 10–15 značajnih coding iteracija; Week04 do 20–30 live AI razvojnih poziva i do 5 demo poziva. Ne žrtvuj ispravnost radi broja; odstupanje zabeleži.
- Član A vodi engine, botove i backend; član B vodi frontend, evaluator i demo. Obojica pišu testove i dokaze; menjaju uloge vozača/posmatrača u sredini većeg bloka. Ne izmišljaj njihove review potvrde.
- Verzioniši `.agents/`, deljenu `.specify/` infrastrukturu, specifikacije, promptove, evidence i lockfile. Poštuj postojeći `.specify/.gitignore` za lokalno stanje. Ne commituj tajne, `.env`, dependency foldere i generisani build/cache.
- Sačuvaj postojeće korisničke izmene. Menjaj samo fajlove potrebne za trenutni task; ne preuređuj materijale iz roditeljskog direktorijuma.

## Handoff

Navedi šta je promenjeno, zahtev/task koji je pokriven, provere i stvarne rezultate, provere koje nisu pokrenute i poznata ograničenja. Funkcionalnost je gotova kada se specifikacija, taskovi, kod, testovi i dokaz slažu.
