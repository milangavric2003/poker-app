# Week05 bounded agent coach — početni prompt V1

Ovaj prompt je sačuvan pre početka Week05 implementacije. On je početna radna
instrukcija za projekat, nije dokaz da su testovi, implementacija, provider pozivi ili
ljudski review izvršeni. Ne menjati ovu verziju posle početka rada; značajnu kasniju
instrukciju sačuvati kao novu verziju/prompt.

## Originalni prompt

```text
Radi na Week05 feature-u u postojećoj lokalnoj aplikaciji Retro Poker. Nastavi
Week03/Week04 projekat; ne pravi novu aplikaciju. Pročitaj retro-poker/AGENTS.md,
docs/GAME_SPEC.md, .specify/memory/constitution.md, specs/003-week05-bounded-agent-coach/
spec.md, plan.md i tasks.md, kao i samo one relevantne postojeće ugovore, kod i testove
koje tvoj task zahteva. Zabeleži stvarno korišćeni kontekst u docs/CONTEXT_MANIFEST.md.

Cilj je bounded, read-only agentski coaching tok za jednu završenu partiju. Korisnik
bira ograničeni coaching cilj. U jednom run-u prvi modelski korak predlaže dozvoljeni
alat get_decision_evidence; backend runtime-validira vrstu koraka, allowlist, argumente,
game/facts scope, run status i budžet; izvršava alat najviše jednom; validira njegov
ograničeni rezultat; drugi modelski korak vraća strukturisani sažetak, jednu preporuku
i evidence. Backend validira konačnu šemu i svaku evidence referencu pre prikaza.
Uspešan run mora imati dva stvarna odvojena modelska koraka i jedno stvarno izvršenje
alata. Week04 retry ili provider fallback je attempt unutar istog modelskog koraka,
ne novi agent korak.

Aplikacija ostaje autoritet. Model samo predlaže. Alat radi nad serverski vezanim,
nepromenljivim MatchFacts snapshot-om konkretne završene partije. Ne prihvataj gameId,
file path, URL, shell/SQL, proizvoljan tool ili executor iz modela. Agent nikada ne
menja poker state, RNG, hand history, MatchFacts ili stackove. Ne izračunavaj kvalitet
poteza iz samog ishoda ruke. Facts su in-memory; nema obećanja da postoje starije
partije ili agregirane pojedinačne odluke koje projekat više ne čuva.

Koristi postojeću provider-neutral/fake-first infrastrukturu i postojeći Gemini
adapter. Provider SDK detalji pripadaju adapteru, ne orchestrator-u. API ključ ostaje
server-side; ne traži ga u chatu, ne ispisuj, ne loguj i ne commituj. Bez ključa nema
live zahteva. Default testovi su potpuno offline i koriste fake provider i kontrolisan
sat. Ne dodaj framework, provider ili zavisnost bez razloga navedenog u planu.

Poštuj limite dogovorene u planu (početni predlog: 2 modelska koraka, 1 tool execution,
4 provider attempt-a ukupno, do 15 s po attempt-u i ukupno 45 s po run-u; attempt koristi
samo preostali deadline). Hidden SDK retry se isključuje ili računa u budžet. Dodaj
AbortSignal/cancellation, stale/new-game zaštitu, idempotent terminal commit i
detekciju ponavljanja istog alata + normalizovanih argumenata + facts revision pre
drugog izvršenja. Run mora uvek da stane uz enumerisan, bezbedan stop reason.

Za svako novo ponašanje radi test-first RED → najmanji GREEN → relevantna regresija;
sačuvaj stvarne komande i rezultate u docs/evidence/003-Txxx-*.txt. Setup/import greška
nije RED. Ne slabi assertion-e, ne izmišljaj rezultate ili usage i ne pripisuj kolegi
review/doprinos koji nije potvrđen. Behavior kod/testove menjaj samo po dozvoljenim
putanjama taska; ako se potrebna putanja promeni, prvo uskladi task/spec.

Korisnik i kolega rade naizmenično prema dostupnim Codex tokenima i mogu nastaviti isti
task. Ne pretpostavljaj paralelan rad. Pre handoff-a zabeleži tačan status, šta je
provereno, šta je ostalo i sledeći korak, bez prepisivanja tuđeg rada kao svog.

Završni tok/UI prikazuje samo cilj, bezbedne statuse, validirani rezultat i dokazne
reference; nikada sirov prompt, chain-of-thought, API key, sirov provider odgovor ili
stack trace. Usage/evidence razlikuje jedan logical run, model step-ove, provider
attempt-e, tool pozive i stop reason. Dodaj najmanje pet unapred definisanih eval
scenarija uključujući uspeh, unknown tool, loše argumente, provider/tool failure i
loop/step/deadline stop. Za odbačen predlog dokaži toolCallCount === 0.

Pre/live provere uradi samo nakon zelenih offline provera i izričitog lokalnog opt-in.
Smernica Week05 je do 15 live agent run-ova tokom razvoja i do 3 u finalnom demo-u;
ne pozivaj model radi specifikacije ili testova. Tajne i chain-of-thought se nikada ne
stavljaju u evidence.

Definition of Done je GAME_SPEC §14 i feature 003: sledljivost FR→test/evidence,
bounded orchestrator, runtime provere svakog prelaza, success/rejected-tool/failure
dokazi, UI status/result, read-only invariant i relevantni test/typecheck/lint/build
rezultati. Ne označavaj nijednu stavku kao PASS dok stvarni dokaz ne postoji.
```

## Poreklo i početni status

Prompt je sastavljen 2026-10-04 iz dogovorenog Week05 cilja, feature 003 i postojećih
AGENTS/GAME_SPEC/constitution pravila. Feature dokumentacija i scope izmene postoje;
Week05 implementacija nije ovim promptom pokrenuta. Nisu izvršeni Week05 testovi, live
provider pozivi, demo ili peer review. Predloženi budžeti u promptu su podložni odluci
T005 u task listi, a stvarni kontekst implementera beleži se naknadno u
`docs/CONTEXT_MANIFEST.md`.

## Dopuna pripreme T004 — 2026-10-04, pre Week05 koda

Originalni prompt iznad ostaje sačuvan. Ova dopuna popunjava nedostajuće eksplicitne
stavke; nije istorijska rekonstrukcija i ne tvrdi da je V1 commitovan. V1 je zatečen
kao untracked fajl pre ovog rada. `backend/src/agent/` i coach testovi/rute nisu
zatečeni; to potvrđuje zatečeni obim, ne celokupnu istoriju svih checkout-a.

Uloga: coding agent koji prati SpecKit, radi jedan task odjednom i čuva korisnički
diff. Ovaj razgovor radi samo T002–T006, uz proveru T001; nema Week05 aplikacionog
koda. Za sledeći razgovor dozvoljena putanja je isključivo allowed lista aktivnog
taska. Cilj/provere/ownership: feature 003 spec, plan, data-model i coach-http ugovor.

Van obima: aktivna partija, write alat, promena poker pravila, nova biblioteka ili
provider, trajna arhiva, proizvoljni URL/shell/filesystem, paralelni coding agenti.
Dokumentacioni taskovi proveravaju sadržaj, lokalne linkove, putanje, enum/budget
konzistentnost i istinitost evidence-a; za njih nema RED/GREEN tvrdnji.

Plan provera: T002 matrica svih FR→US/acceptance→planirani dokaz→nastavni izvor;
T003 strict ugovori i async vlasništvo; T004 prompt/manifest stvarno korišćenih izvora;
T005 jedinstvena policy tabela; T006 postojeći Week04 evidence, snapshot i relevantne
offline komande. Behavior tek T007+: smisleni fake-first RED pa GREEN/regresija;
finalno npm.cmd test, typecheck/lint/build i fake E2E. Provera koja nije pokrenuta
ostaje tako označena. Live nije deo ovog pripremnog razgovora.

Otvorene nejasnoće/ograničenja: reprodukcija nepreciznih refresh/UX smetnji nije data;
njihova aktuelnost ne može se zaključiti iz opšte prijave. Assignment §31 navodi
limited live demo, dok GAME_SPEC §14 bira offline DoD i opcioni live: bez izvedenog
demo-a ne tvrditi ispunjenje tog nastavnog dokaza. T005 potvrđuje numeričku politiku
iz plana; runtime ispravnost, ljudsko razumevanje i peer review još nisu potvrđeni.

T004 handoff: T001 sadržinski pregled i T002 matrica postoje; T003 plan/data-model/HTTP
ugovor pregledani uz lokalnu link proveru i git diff --check (exit 0). Original V1
sačuvan, dopunjene samo uloga, granice ovog razgovora, plan provera i nejasnoće.
Manifest dopunjen izvorima za ovaj blok, bez tvrdnje punog čitanja skraćenih ispisa.
Komande: Get-Content, rg, Test-Path i git status/diff; nema Week05 testova/live poziva.
Sledeće T005: sadržinski proveriti usklađenost spec/plan/tasks/GAME_SPEC i potvrditi
jedinstvenu tabelu limita, statusa, retention-a i evidence-a.
