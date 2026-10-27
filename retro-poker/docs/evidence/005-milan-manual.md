# Week08 — ponovljiv ručni pregled

Pripremljeno 2026-10-27, Codex u Milanovoj sesiji. Ovo je uputstvo, ne potvrda
izvedenog ljudskog review-a/demo-a. Za T030 su potrebni stvarni ishodi oba člana.

## Lokalni profil

Iz `retro-poker/`, posle `npm.cmd ci`, pokrenuti `npm.cmd run demo:security`.
Komanda gradi sa `envDir:false`, zatim služi stvarni production preview na
http://127.0.0.1:5173/ i API na 3001. Constructor-only fake implementira bot,
analysis i dva coaching koraka; `get_decision_evidence` ostaje stvaran alat.
Stvarni sat omogućava istek rate prozora. Nema `.env` loader-a, produkcionog
fake prekidača ili debug HTTP rute; ne koristi se pravi provider.
Zaustaviti svoj prethodni dev server pre pokretanja; ne gasiti tuđe procese.

## Redosled i očekivanja pre provere

1. Izabrati 1 bota, AI potezi off, Nova partija → All-in. Očekivati završen
   poker rezultat. Ponoviti obično igranje sa 5 botova; proveriti legalne kontrole,
   čitljivost karata/stackova, sledeću ruku i viewport oko 390 px.
2. Na završenoj partiji otvoriti Network. Coaching cilj Odluke po fazama →
   Pokreni coaching. Očekivati uspeh, 2 model koraka/2 fake pokušaja/1 real tool,
   bez promene poker rezultata. API detalji su u POST/GET `coach` odgovorima.
3. Zatražiti analizu, zatim Generiši analizu ponovo. Očekivati normalan summary,
   isti poker rezultat, nov interaction ID i odgovarajuće AI usage redove.
   Izabrati novu partiju i proveriti da stari rezultati ne prelaze u novu.
4. Direktno poslati inače validan coach zahtev sa dodatnim `maxSteps:999`.
   Očekivati 400/INVALID_INPUT, nepromenjen poker i usage, bez novog rada.
   Ovo proverava strict konfiguracionu granicu; nije samostalni dokaz budžeta.
   Ponovljiv puni HTTP dokaz: `npm.cmd test -- tests/contract/security-http.test.ts`.
5. U headed browser testu proveriti stvaran final→DOM i CSP pozitivnu kontrolu:
   `npm.cmd run test:security:e2e -- --headed`. Ovo je automatizovani prikaz;
   pokretati ga posle gašenja ručnog demo-a jer koristi iste portove.
6. Pregledati `005-phase7-matrix.md`: T07 PASS→PASS i ista T13/T16 RED→GREEN
   poređenja; objasniti bar jednu zabranu API-ja i jednu zabranu alata.

Rate limit je 5 prihvaćenih novih analiza/coaching startova u poslednjih 60 s.
Ako se pojavi 429/AI_RATE_LIMITED, proveriti Retry-After i sačekati prozor;
nova partija ili reset metrika ga ne brišu. Kapacitet 2 računa stvaran provider
posao, uključujući neotkaziv late posao. Ovo nisu dokazi brzine stvarnog Gemini-ja.

Za samostalni negativni slučaj svaki član zapisuje sopstveni ulaz i očekivanje
pre izvršavanja. Sačuvati stvarnu komandu, ishod, brojače i objašnjenje granice;
ne pripisivati Codex predlog kao samostalnu ideju. Zatim koristiti osam minuta
rasporeda iz `005-phase7-demo.md` i individualnu varijantu.

## Zapis posle stvarnog ljudskog izvršavanja

Ime/datum/checkpoint; šta je pregledano ili promenjeno; poreklo ideje testa;
ulaz/očekivanje pre; komanda/actual/exit; gde se kontrola izvršava; ograničenje;
reviewer; izveden demo i individualna varijanta. Popuniti stvarnim opažanjima.
T031 dokumentacija je završena; T030 ostaje otvoren dok taj dokaz ne postoji.
