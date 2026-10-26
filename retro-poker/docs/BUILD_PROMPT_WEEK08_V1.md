# Week08 Secure the Arcade — početni implementacioni prompt V1

Sačuvan 2026-10-26 kroz T004, pre prve Week08 security implementacije.
Prompt je Codex pripremio na osnovu korisničkog zahteva i usvojenog feature-a;
nije doslovan transkript korisničke poruke niti dokaz ljudskog review-a.
Početni checkpoint: `week08-init`, `0d361f1ce4429dbf9cd64f1adcf9dbd78c9f8874`.
Posle početka implementacije ovu verziju čuvati; značajne izmene instrukcija
zapisati u novu verziju. Aktuelni korisnički zahtev ima prioritet.

## Prompt za implementacioni razgovor

```text
Radi kao coding agent na postojećem Retro Poker projektu, feature
specs/005-week08-secure-the-arcade, na korisničkoj grani week08-init.
Git koren je roditelj projektnog direktorijuma retro-poker/. Proveri cwd,
granu, HEAD, status i postojeće korisničke izmene pre bilo kakvih izmena.
Ne menjaj granu ili istoriju da bi naziv grane odgovarao Spec Kit direktorijumu.

OPSEG OVOG POKRETANJA

Izvrši samo task ili raspon koji korisnik izričito traži u tekućem razgovoru.
Ako je ovaj prompt jedina instrukcija za pokretanje, prvi blok je T005–T007,
uz prethodnu proveru T001–T004. Ako je blok već gotov, izvesti o stanju;
nemoj automatski početi sledeći blok. Opšti Week08 cilj ne proširuje opseg bloka.
Po završetku traženih taskova stani i ostavi precizan handoff.

KONTEKST I PRIORITET

Pročitaj AGENTS.md, docs/GAME_SPEC.md (arhitektonske granice, AC19/AC23,
W05 read-only ugovor i W08-01–W08-08), .specify/memory/constitution.md i
specs/005-week08-secure-the-arcade/{spec.md,plan.md,tasks.md}.
Zatim pročitaj data-model.md, contracts/security.md, research.md, quickstart.md,
docs/EVIDENCE_W08.md i handoff prethodnog taska. Za kod/testove učitaj samo
putanje neophodne za odabrani blok. Prati projektni Spec Kit workflow;
pre primene odgovarajuće veštine pročitaj njen SKILL.md i proveri hook-ove.
Aktivni feature postavi kroz SPECIFY_FEATURE_DIRECTORY ako je potrebno.
Checklist pregledaj kao read-only gate, ne čekiraj kriterijume da zaobiđeš proveru.

Week08 zadatak od 23.10.2026 i šablon u ../Nedelja-08/ jesu nastavni izvori
ako su dostupni. Potrebni zahtevi već su u feature dokumentima; nedostajući
lokalni PDF/ZIP ne znači da kolega mora ponovo pribaviti materijal za rad.
Root weekly-assignment.md sada je Week08, ne istorijski Week05 zadatak.
Zabeleži stvarno korišćen kontekst u docs/CONTEXT_MANIFEST.md.

ŠTA ČUVAMO I ŠTA POSTIŽEMO

Week05 je završen. Naknadne summary regeneration/AI usage/frontend dorade su
privatni razvoj: očuvaj ih i ne predstavljaj kao Week08 doprinos. Ne vraćaj
aplikaciju na stariji main niti spajaj otvoreni PR u okviru ovog prompta.
Test/CI popravke prenete u osnovu proverene su i sačuvane u 005-baseline dokazima.
T004 proverava tu osnovu, nije implementacija novih bezbednosnih kontrola.

Ojačavamo jedan stvaran tok: browser coaching cilj → API → bounded orchestrator
→ model predlog → provera i get_decision_evidence → validacija tool rezultata
→ drugi model korak → provera final evidence-a → tekstualni UI.
Provider/model se u testovima zamenjuje fake-om; dozvoljeni alat se stvarno izvršava.
Normalna igra i coaching sa dva modelska koraka i jednim korisnim alatom moraju raditi.

OBAVEZNE INVARIJANTE

I1: Odbijen početni HTTP zahtev ima nula provider i nula poslovnih tool poziva.
I2: Browser/model ne određuju ovlašćenja, server identitet/config niti limite.
I3: Samo dozvoljen alat, validni argumenti i dozvoljen opseg podataka mogu se izvršiti.
I4: Coaching je read-only nad kanonskim poker stanjem; usage/run/event metapodaci
    proveravaju se odvojeno, nisu poker rezultat.
I5: Nepouzdan tekst nikada ne postaje izvršiv browser sadržaj.
I6: Broj poziva, trajanje, veličine i stvarno aktivan rad imaju serverske granice.
I7: Tajne ostaju na serveru; model, browser i log dobijaju samo potrebne podatke.
I8: Normalan W05 tok uspeva posle ojačavanja; odbijanje svega nije rešenje.

PRAVILA IMPLEMENTACIJE

Pre svake faze, kao i pri nastavku tuđeg taska, pregledaj prethodnu implementaciju,
diff, acceptance očekivanja i dokaze. Pokreni relevantne fokusirane testove.
Checkbox i raniji PASS nisu zamena za ovu proveru. Ako nađeš stvarni propust,
prvo zabeleži nalaz i popravi ga u odobrenom opsegu; uskladi plan pre proširenja
putanja. Ako odluka menja produktni scope, razjasni je pre zavisnog rada.

Za svaki mali behavior slice: očekivanje → smislen RED → najmanji GREEN → regresija.
Ako zaštita već postoji, sačuvaj PASS→PASS i ne uvodi propust. Setup/timing greška
nije security RED. Ne oslabljuj assertions, ne preskači testove i ne povećavaj
timeout da sakriješ pogrešno ponašanje. Čuvaj prvi rezultat, uključujući neuspeh.
Pre hardening-a T006 beleži najmanje tri početna scenarija T07/T13/T16;
završno poređenje koristi iste ulaze/fixture-e. T00–T17 su scenario ID-jevi,
T001–T031 su task ID-jevi: ne mešaj te dve numeracije.

Poštuj tabelu limita i politiku iz plan.md/contracts/security.md; ne prepisuj
primer iz nastavnog zadatka preko usvojenih vrednosti. Već postojeći run limiti
su 2 model koraka/1 alat/4 attempts, do 2 attempts po koraku, 15 s call/45 s run.
Planirani zajednički provider kapacitet je 2 stvarna posla, a rate prozor 5 novih
coach/analysis startova u 60 s. Lease traje do settle originalnog promise-a;
abort, nova partija ili reset usage-a ne znače da je fizički posao završen.
Retry i fallback dele budžet; SDK ne dodaje skrivene pokušaje.

Ne uvodi login, bazu, leaderboard, RAG, novi provider, deployment, game mod ili
rich-text renderer. Jedna lokalna partija/proces, loopback i memorijsko stanje
ostaju. Resurs UUID nije credential; schema provera nije scope provera.
CSRF/SQL N/A obrazloži samo za funkcije koje stvarno ne postoje; origin i
serverski ishod ipak testiraj. Nema slobodnog user text kanala ka coach modelu:
malicious fake proposal je obavezan, ali nije dokaz otpornosti pravog modela.

Browser test proverava i execution marker i bezbedan DOM, uz normalan tekst.
CSP se proverava na stvarnom production build-u i dostupnom kontrolisanom resursu,
bez bypassCSP; 404 nije dokaz blokade. Sentinel test prvo dokazuje da je server
učitao sintetičku tajnu, pa njeno odsustvo iz izlaza. Nije opšti DLP dokaz.
Security događaji imaju samo dozvoljena polja; nikad raw prompt/response/stack.

Koristi isključivo fake provider, sintetičke podatke i SDK mock transport.
Ne čitaj/ispisuj/traži pravi ključ, ne pokreći Gemini live/smoke/diagnose komande.
Istorijska live odobrenja ne važe za Week08. Nema novih live API zahteva.

DOZVOLJENE IZMENE I RAD U PARU

Menjaj samo putanje navedene u odabranim taskovima i njihovu dozvoljenu evidenciju.
Sačuvaj korisničke izmene, istorijske dokaze i screenshotove. Ne preuređuj ceo repo.
Radi jedan coding agent; Veki i Milan naizmenično vode iste taskove. Zapiši
stvarnog driver-a i handoff; ne pripisuj drugom članu review koji nije potvrđen.
Svako treba da doprinese jednoj kontroli i samostalnom negativnom testu;
Codex-generisan test sam po sebi nije dokaz da ga je čovek osmislio.
Bez automatskog commit/push/merge-a; prati konkretno korisničko Git odobrenje.

PROVERE I DEFINITION OF DONE

Postojeće komande iz retro-poker/: npm.cmd test, npm.cmd run test:e2e,
npm.cmd run typecheck, npm.cmd run lint, npm.cmd run build, git diff --check.
Za mali blok prvo fokusirane postojeće provere, zatim relevantna regresija.
Npm ci/clean checkout i novi CI imaju zaseban završni T029 dokaz.
test:security uvodi T007, test:security:e2e T022: do tada nisu postojeće komande.
Ne pokreći dev backend koji učitava .env umesto fake test helper-a.
Ne prekidaj korisnikov server ako je port zauzet; zabeleži prepreku.

Task čekiraj tek kada spec, kod i stvaran dokaz odgovaraju acceptance očekivanju.
T00–T15/T17 automatizovani; T04/T05 pravi browser; T16 production zaglavlja i
sentinel; za glavne kontrole pozitivna varijanta. Testovi mere pozive i stanje,
ne samo status kod. T12 razdvaja timeout jednog poziva i ukupan deadline;
T13 razdvaja aktivni kapacitet i rate prozor; T17 proverava lanac kroz više granica.

U docs/EVIDENCE_W08.md poveži pretnju→invarijantu→kontrolu→test→opaženi rezultat.
Sačuvaj tačnu komandu, checkpoint, exit status i ograničenje u docs/evidence/005-*.
Sažmi značajan AI rad u docs/AI_USAGE_LOG.md; nepoznati tokeni/trošak su nepoznati.
Ne označavaj clean install, remote CI, demo, peer review ili finalnu matricu kao
PASS bez izvršenog dokaza. Zatvoren blok nije zatvoren Week08.

Završni handoff: obrađeni taskovi, izmenjeni fajlovi i razlog, izvršene provere
i rezultati, šta nije provereno, poznati rizici, prvi sledeći otvoreni task.
Rutinske odluke unutar plana rešavaj samostalno; nerešen konflikt koji utiče
na ispravnost jasno opiši, bez tihog odstupanja od specifikacije.
```

## Dokaz pripreme

Aktuelna provera T001–T003 i granice ovog koraka:
[T004 handoff](evidence/005-T004-handoff.md).
Sačuvan prompt ne izvršava taskove T005–T031 i ne menja njihove checkbox-e.
