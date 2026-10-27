# T030 — priprema demo-a i ljudske potvrde

**Aktuelno 2026-10-27:** korisnik potvrđuje da su Vedran i Milan lokalno
isprobali aplikaciju i demo zasebno i zajedno, i da su spremni za prezentaciju
28.10. T031 dokumentacija/linkovi su završeni unapred; T030 ostaje otvoren za
formalni zajednički demo i individualnu proveru. Doprinosi su potvrđeni i
vezani za commitove u
[konačnom paketu](005-week08-submission.md). Naredna tabela iz 26.10. čuva
istorijsko stanje pre potvrde doprinosa i nije aktuelna mapa autorstva.

Lokalna proba je prijavljena kao ljudska potvrda, bez zapisnika o trajanju,
zasebnim ulazima i ishodima svakog člana. Ne zamenjuje formalno izvođenje niti
potvrđuje individualnu odbranu. Milan je dodatno potvrdio da su obojica predložila
i lokalno izvršila negativnu proveru povećanja `maxSteps`. Raniji [zapis konkretne probe](005-milan-human-check.json)
pripisuje Codexu uputstvo, a Milanu izvršenje `maxSteps:999` sa 400 i
nepromenjenim stanjem/usage-om. Milan dodatno potvrđuje da je Vedran pri svom
lokalnom pokušaju proverio ulaz, očekivanje, odgovor i stanje partije. Tačan
Vedranov odgovor i brojači nisu sačuvani u mašinskom tragu. Posle prezentacije
dopisati stvarni tok i individualne odgovore u T030, uz proverljive ulaze/ishode.

## Lokalna proba — potvrđeno u razgovoru 27.10.

| Član | Šta je lokalno urađeno | Sačuvan ishod / granica dokaza |
|---|---|---|
| Vedran | Aplikaciju i demo isprobao zasebno i sa Milanom; predložio i izvršio proveru povećanja `maxSteps`, proverio ulaz, očekivanje, odgovor i stanje partije. | Izvršenje je Milanova potvrda u razgovoru. Nije sačuvan Vedranov zaseban HTTP izlaz, broj provider/tool poziva ni usage poređenje. |
| Milan | Aplikaciju i demo isprobao zasebno i sa Vedranom; predložio proveru povećanja `maxSteps` i izvršio `maxSteps:999` u vođenom HTTP primeru, uz normalan coaching. | [Prijavljeno 400/`INVALID_INPUT`, nepromenjena partija i usage](005-milan-human-check.json). Konkretno uputstvo je Codexov primer. |

Ovo beleži **lokalnu probu**. Trajanje zajedničkog nastupa i objašnjenja u
formalnoj individualnoj odbrani još nisu zabeleženi; zato T030 ostaje otvoren.

## Istorijski status pre kasnijih ljudskih potvrda

2026-10-26. **NIJE IZVEDENO / T030 otvoren.** Codex priprema nije ljudski demo.
Rani zahtev za konkretne potvrde poslat je korisniku tokom završne provere.

Git pokazuje Week08 commitove Vekijevog autorstva: `0d361f1`, `d08e06c`, `2b8ea4e`,
`cc0d3fb`, `9d89726`, `e498a06`, `d508f13`. Njihovi evidence/handoff zapisi navode
Codex rad i nepotvrđen peer review. To ne potvrđuje samostalno osmišljen test.
Milanov istorijski `116bac6` (CI) pripada prethodnoj osnovi; nije dokaz njegovog
novog W08 negativnog testa, razumevanja ili izvedenog demo-a.

| Član | Doprinos kontroli | Samostalno osmišljen negativni test | Objašnjenje granice/ograničenja | Demo i individualna varijanta |
|---|---|---|---|---|
| Veki | Commit autorstvo postoji; sadržaj pripremljen uz Codex; samostalni doprinos treba potvrditi | Nije potvrđeno | Nije potvrđeno | Nije potvrđeno |
| Milan | W08 kontrola nije potvrđena | Nije potvrđeno | Nije potvrđeno | Nije potvrđeno |

## Osam minuta, fake-only

Milan je 2026-10-27 prijavio izvršen asistentski maxSteps negativni primer
(400, stanje/metrike nepromenjeni) i uspešan normalan street coaching.
[Stvarni prijavljeni ishodi i ograničenja](005-milan-human-check.json).
Ovaj raniji zapis potvrđuje Milanov ručni pregled. Kasnija ljudska potvrda
predloga i Vedranovog izvršenja nalazi se u aktuelnoj tabeli iznad. Osam minuta
formalnog demo-a i individualna varijanta i dalje nisu izvedeni; T030 je otvoren.

Pre demo-a: Node 24.20.0/npm 11.19.0, clean instalacija i Chromium. Bez `.env`,
pravih ključeva, live CLI-ja ili `dev:backend`. Koristiti postojeće automatizovane
browser fixture-e (stvarni UI/API/alat), uz headful Playwright za vidljiv browser.
Ne menjati testove u aktivnom stablu za vežbu; kopija u `.verification/` je pogodna.
Iz projektnog korena postaviti `GEMINI_ENABLED=false`, `GEMINI_API_KEY=''`.
Sledeće komande pripremiti unapred; browser komande serijski i sa slobodnim
5173/3001 portovima. `test:security:e2e` i `test:e2e` već grade izvore.

| Vreme | Demonstracija i konkretna komanda / dokaz |
|---|---|
| 0:00–1:10 | `npm.cmd run test:security:e2e -- tests/e2e/security-production.spec.ts --headed -g "T16 initial"`: Nova partija, Call, All-in, završen coaching; objasniti 2 model koraka/1 stvarni read-only alat i isti poker rezultat. |
| 1:10–2:00 | Pokazati tok browser→HTTP→session→model proposal→allowlist alat→output validator→model→tekst. Navesti server autoritet, UUID nije credential, fake nije pravi model. Koristiti finalnu matricu T00–T17. |
| 2:00–3:00 | `npm.cmd test -- tests/contract/security-http.test.ts tests/integration/security-tools.test.ts --reporter=verbose --disableConsoleIntercept`: pokazati jedan privileged body i T08 schema-valid betting/1 nasuprot street run-u. Prvi 0/0, drugi 1 provider/0 tool; normalna kontrola 2/1. |
| 3:00–4:05 | `npm.cmd test -- tests/integration/security-admission.test.ts tests/integration/security-lifecycle.test.ts --reporter=verbose --disableConsoleIntercept`: max active 2, šesti start 429, late rezultat ne menja novu partiju/usage. Razlikovati abort i fizički settle, rate token i lease. |
| 4:05–5:10 | `npm.cmd run test:security:e2e -- tests/e2e/security-rendering.spec.ts --headed`: literalni napad i srpski tekst, marker i DOM; iz prvog production browser testa pokazati 200/control true, CSP violation i app marker false. |
| 5:10–6:05 | `npm.cmd test -- tests/integration/security-secrets.test.ts tests/integration/security-events.test.ts tests/unit/security-events.test.ts --reporter=verbose --disableConsoleIntercept`: factory sentinel učitan; adapter/tool grane bez curenja, closed event i korelacija, 200/30min retention. |
| 6:05–7:00 | Pokazati originalne T006 rezultate i isti input posle: T07 PASS→PASS, T13/T16 RED→GREEN. Pokazati clean snapshot/lock hash i audit odluke. Navesti remote CI status odvojeno od lokalnog. |
| 7:00–8:00 | Svaki član objašnjava i izvršava svoju malu individualnu varijantu; beležiti stvarni ulaz, očekivanje pre testa, komandu i izlaz. Ako ne stane, dovršiti individualni deo posebno i zabeležiti trajanje. |

## Kratak podsetnik za individualna pitanja

| Pitanje | Gde pokazati odgovor | Granica koju treba jasno izreći |
|---|---|---|
| Zašto `maxSteps:999` ne menja partiju niti pokreće model? | [Strict coach DTO i 1024-byte limit](../../backend/src/routes.ts), [HTTP negativni test](../../tests/contract/security-http.test.ts) | Provera game/run ID-ja nije autentifikacija korisnika. |
| Zašto model ne može da zatraži drugi alat ili podmetne tuđ rezultat? | [Tačan dispatch i scope](../../backend/src/agent/orchestrator.ts), [kanonska validacija](../../backend/src/agent/validation.ts) | Fake predlog testira izvršnu kontrolu, ne ponašanje svih živih modela. |
| Zašto otkazani posao i dalje može da zauzima mesto? | [Provider lease](../../backend/src/security/capacity.ts), [T17 test](../../tests/integration/security-lifecycle.test.ts) | Abort ne garantuje prekid udaljenog rada/naplate; granica je procesna. |
| Zašto je AI tekst bezbedan u browseru? | [Tekstualni panel](../../frontend/src/components/CoachPanel.tsx), [production CSP](../../vite.config.ts), [browser test](../../tests/e2e/security-production.spec.ts) | CSP je proveren na lokalnom preview-u, ne na spoljašnjem hostingu. |

Svaki član treba da objasni svoj stvarni doprinos i **sopstveni** negativni slučaj,
sa očekivanjem zapisanim pre izvršavanja. Tabela je podsetnik za razumevanje,
ne dokaz da je individualna odbrana već izvedena.

## Predložene vežbe (Codex ih je predložio)

Ove vežbe proveravaju razumevanje; **nisu dokaz samostalnog osmišljavanja**.
Član mora zasebno predložiti sopstveni negativni slučaj i zapisati očekivanje pre
izvršavanja, ako želi da zatvori taj kriterijum T030.

- Veki: u kopiji T08 scope testa promeniti validan `focus:'betting'` u
  `focus:'showdown'`, zadržati server goal street i limit 1. Pre pokretanja objasniti
  zašto schema prolazi, a scope odbija: 1 provider/0 executor, isto poker stanje.
- Milan: u kopiji rate boundary unit testa proveriti 59998/60000 umesto 59999/60000.
  Pre pokretanja objasniti klizni prozor: najstariji token ostaje na 59998, ističe na
  60000; capacity lease ostaje odvojena kontrola. Zadržati pozitivno prihvatanje i
  naredno odbijanje, bez slabljenja assertions-a.

Za potvrdu svakog člana zapisati: ime/datum, konkretan kontrolni doprinos i fajl/
commit ili patch, ko je osmislio test i kada, sopstveni test input i očekivanje,
komandu/actual/exit, kratko objašnjenje granice i ograničenja, reviewer-a i potvrdu
izvedenog demo-a/individualne varijante. Ne pripisivati Codex predlog kao samostalnu
ideju. Ćutanje i commit author nisu potvrda. T031 je dokumentaciono završen;
T030 se zatvara tek po ovom zapisu.

## Zapis formalne prezentacije — popuniti nakon izvođenja 28.10.

| Stavka | Stvarni zapis |
|---|---|
| Zajednički demo | Datum, početak/kraj, trajanje, šta je prikazano i stvarni ishod — čeka izvođenje. |
| Vedranova individualna varijanta | Njegov ulaz i očekivanje pre testa; komanda, izlaz/status i brojači; objašnjena kontrola i njena granica — čeka izvođenje. |
| Milanova individualna varijanta | Njegov ulaz i očekivanje pre testa; komanda, izlaz/status i brojači; objašnjena kontrola i njena granica — čeka izvođenje. |
| Potvrda para | Ko je pregledao rezultat drugog člana i kada — čeka potvrdu. |

Tek posle stvarnih opažanja dopisati ovaj zapis i označiti T030 završenim.
