# Feature Specification: Week05 bounded agent coach

**Feature**: `003-week05-bounded-agent-coach`  
**Status**: T002–T026 implementirani/provereni; T028/T029 male korekcije imaju dokaz.
Ljudski walkthrough T027 nije potvrđen. Specifikacija sama nije runtime dokaz.
T030 runner/stop su zabeleženi; T031 odobreni live #2 završio je validiranim finalom.
**Datum**: 2026-10-04  
**Ulaz**: proširenje Week04 analize završene partije u mali, proverljiv agentski tok.

## 1. Izvori i prioritet

Autoritativni izvori za ponašanje igre i scope su [GAME_SPEC v1.2.1](../../docs/GAME_SPEC.md),
[AGENTS.md](../../AGENTS.md) i [constitution](../../.specify/memory/constitution.md).
Week05 obrazac i minimumi dolaze iz roditeljskog
[weekly assignment](../../../weekly-assignment.md) i
[reliability addendum](../../../week-05-bounded-agentic-workflows-reliable-integration-addendum.md).
Week04 je osnova kroz [feature 002](../002-week04-ai-integration/spec.md),
provider ugovor u `backend/src/ai/types.ts`, proverenu analizu iz `match-facts.ts`,
HTTP rutu i fake-provider testove.

Ovaj feature ne menja poker pravila niti Week04 bot poteze. Ako se aktuelni zahtev,
GAME_SPEC i ovaj feature raziđu, zastati pre zavisne implementacije i uskladiti izvor.

## 2. Problem i korisnički cilj

Jednopozivna Week04 analiza vraća sažetak i savete, ali ne demonstrira stateful tok u
kome model predlaže kontrolisan sledeći korak, aplikacija pribavlja dodatne proverene
činjenice i model ih koristi za odgovor. Igraču treba jedna konkretna vežba zasnovana
na njegovim potezima iz upravo završene partije.

**Odabrani cilj:** „Pregledaj moje odluke u izabranoj oblasti i predloži jednu stvar
koju da vežbam u sledećoj partiji.” UI daje mali unapred definisani izbor oblasti
(npr. ulaganje ili odluke po fazi), umesto da Core zavisi od neograničenog slobodnog
teksta. Korisnički cilj može sadržati samo ograničeno polje iz tog izbora.

## 3. Granice i pretpostavke

- Run analizira jednu partiju koja je završena i čiji snapshot/revizija ostaje važeća.
- Projekat čuva samo lokalno stanje u memoriji. Nema trajne arhive, pa feature ne
  obećava poređenje više partija.
- `MatchFacts` zadržava do 200 detaljnih odluka, a starije odluke agregira. Analiza
  koristi samo raspoložive detaljne činjenice; output/evidence navodi ograničen uzorak
  i ne tvrdi da je obuhvatio agregirane detalje koje više nema.
- Nedostajući ili premali uzorak daje kontrolisan `insufficient_evidence` ishod;
  model ne popunjava praznine pretpostavkama.
- Analiza ostaje obrazovna. Ishod ruke sam po sebi ne utvrđuje kvalitet poteza.
- Samo server-side provider pozivi; postojeći Gemini adapter je implementaciona osnova.
- Run i njegovi evidencijski podaci su privremeni/in-memory i ne preživljavaju restart.

## 4. Korisnički scenariji

### US1 — Dobij savet zasnovan na odlukama završene partije (P1)

Kao igrač, po završetku partije biram oblast za pregled i pokrećem analizu. Dobijam
sažetak, jednu konkretnu preporuku i reference na poteze koji je podržavaju.

**Nezavisna provera:** Fastify integration test sa scripted fake modelom vraća alatni
predlog, pravi alatni rezultat, zatim validan finalni odgovor. Proveriti tačno dva
uspešna modelska koraka, jedan stvarni tool execution, dokazne reference i nepromenjen
poker snapshot.

**Acceptance scenarios**

1. **Given** važeća završena partija i dovoljno odluka, **When** igrač pokrene cilj,
   **Then** backend kreira jedan run nad nepromenljivim facts snapshot-om i pokazuje
   status `running`.
2. **Given** prvi model korak vrati dozvoljen alat i validne argumente, **When** backend
   proveri allowlist, scope i budžet, **Then** tačno jednom izvršava lokalni alat.
3. **Given** alat vrati validan rezultat, **When** drugi model korak ga obradi,
   **Then** backend validira strukturisani finalni odgovor pre objave korisniku.
4. **Given** finalni odgovor sadrži evidence reference, **When** backend ih proveri,
   **Then** svaka se odnosi na odluku koju je ovaj run stvarno dao modelu.
5. **Given** cilj nema dovoljno raspoloživih odluka, **When** korisnik pokrene run,
   **Then** sistem završi sa `insufficient_evidence`, bez izmišljanja saveta i bez
   provider/tool poziva gde se stanje to može proveriti preflight-om.
6. **Given** ruka je završena ali partija se nastavlja, **When** korisnik traži coaching,
   **Then** backend odbija zahtev: Week05 Core analizira samo terminalnu partiju.

### US2 — Odbij nedozvoljen alat ili zahtev (P1)

Kao vlasnik aplikacije želim da nijedan modelov predlog ne postane izvršna naredba pre
stroge validacije, kako bi agent radio samo sa podacima svoje završene partije.

**Nezavisna provera:** unknown tool, loši argumenti, nevažeća partija i nevažeći
identifikator završavaju kontrolisano; provider/tool pozivi su nula za nevažeći
preflight, a `toolCallCount` ostaje nula za odbačen predlog.

**Acceptance scenarios**

1. Nepoznat `toolName` ne poziva nijedan executor i zaustavlja run sa `unknown_tool`.
2. Argumenti sa nedozvoljenim poljem, focus enum-om ili limitom bivaju odbijeni pre
   izvršenja; alat se ne poziva.
3. Važeća šema sa tuđim/stale game identity-jem ne može čitati facts druge partije.
4. Preflight za aktivnu/nepostojeću partiju odbija se pre provider poziva.
5. Vrednosti u game facts-u koje sadrže instrukcije ostaju podaci i ne mogu proširiti
   allowlist, provider privilegije ili sistemske instrukcije.

### US3 — Zaustavi bounded run uz bezbedan status (P1)

Kao igrač želim razumljiv uspeh ili ograničen neuspeh, dok backend sprečava beskonačne
petlje, duplirana izvršenja i zastarele rezultate.

**Nezavisna provera:** injected fake clock/provider izvršava retry, deadline, loop,
provider failure i stale run deterministički; UI prikazuje samo status/stop code i ne
menja partiju.

**Acceptance scenarios**

1. Run ima mali eksplicitan step, tool, provider-attempt i ukupni call budžet; iscrpljen
   limit završava bez sledećeg poziva sa odgovarajućim stop reason-om.
2. Isti normalizovani tool/argumenti nad istom facts revizijom ne izvršavaju se drugi
   put; run se završava sa `repeated_action`.
3. Ukupni deadline i per-attempt timeout propagiraju abort; kasni odgovor se ignoriše.
4. Provider/tool/schema/semantic greška daje kontrolisan `failed` ili `stopped` rezultat,
   bez stack trace-a, tajni ili sirovog provider tela u javnom API-ju.
5. Reset/nova partija ili promenjena identity/revizija tokom run-a sprečava stari
   rezultat da se veže za novo stanje.
6. Otvoreni run status postaje terminalan najviše jednom; dupli POST ne pokreće dupli
   aktivni run za isti game snapshot.

### US4 — Razumem tok i ograničenja analize (P2)

Kao igrač želim da UI pokaže cilj, status, validirani savet i dokazne poteze, bez
skrivenog reasoning-a ili interne dijagnostike.

**Nezavisna provera:** UI testovi za running/completed/stopped/failed/insufficient
evidence; accessibility/E2E pokriva uspeh i kontrolisani neuspeh.

**Acceptance scenarios**

1. UI prikazuje cilj i bezbedan high-level status, zatim validirani summary,
   recommendation i evidence reference.
2. `stopped`, `failed`, `insufficient_evidence` daju razumljivu poruku i eksplicitni
   ručni retry kada je to bezbedno.
3. UI ne prikazuje prompt, chain-of-thought, API ključ, sirovo provider telo ni
   stack trace.
4. Usage/evidence razlikuju jedan logički run, modelske korake, provider retry/fallback
   attempt-e i tool execution-e.

## 5. Funkcionalni zahtevi

- **FR-001**: Sistem MUST nuditi coaching cilj samo nad terminalnom partijom sa
  raspoloživim `MatchFacts`.
- **FR-002**: Sistem MUST napraviti eksplicitan run identifikator, stanje, cilj,
  game/facts identity, korake, pozive, početak/deadline i terminalni stop reason.
- **FR-003**: Uspešan Core run MUST imati najmanje dva odvojena model koraka i jedno
  stvarno izvršenje dozvoljenog read-only alata između njih.
- **FR-004**: Backend MUST držati alatnu allowlist-u u pouzdanom kodu/konfiguraciji;
  model ne može definisati alat ili executor.
- **FR-005**: Prvi model odgovor MUST biti parsiran i runtime-validiran protiv strict
  discriminated union-a (`tool_request | refusal`; konačni odgovor se prihvata samo
  nakon tool result-a).
- **FR-006**: `get_decision_evidence` MUST prihvatati samo strict `focus` enum i
  `limit` integer od 1 do 10; unknown fields se odbacuju.
- **FR-007**: Backend MUST vezati executor za završeni game/facts snapshot primljen
  iz validiranog run-a; modelovi argumenti ne određuju proizvoljan game ID ili putanju.
- **FR-008**: Alat MUST biti read-only, deterministički, vremenski ograničen i bez
  network/filesystem/engine-mutation pristupa.
- **FR-009**: Svaki tool output MUST proći runtime proveru forme, veličine, obaveznih
  polja, poznatih `decisionRef` vrednosti i scope-a pre sledećeg model poziva.
- **FR-010**: Provider context MUST biti najmanji dovoljan cilj, dozvoljeni descriptor-i,
  run state, poslednji validirani rezultat alata i eventualno ograničeni prethodni
  structured step rezultati. Ne prosleđivati ceo repository ili `GameState`.
- **FR-011**: Finalni output MUST imati strict schema za `summary`, jednu
  `recommendation`, evidence stavke (`decisionRef` + proverljiv fact code/finding),
  `confidence` i `completed`.
- **FR-012**: Server MUST proveriti da svaki evidence ID i fact pripada allowlist-ovanoj
  činjenici koju je alat vratio; nepotvrđena tvrdnja ne može označiti run kao `completed`.
- **FR-013**: Agent MUST imati eksplicitne `maxSteps`, `maxToolCalls`, ukupni
  `maxProviderAttempts`, `totalDeadlineMs`, `providerAttemptTimeoutMs` i veličinu
  tool result-a.
- **FR-014**: Pojedinačni poziv i retry MUST koristiti AbortSignal i samo preostalo
  vreme zajedničkog deadline-a; SDK retry mora biti uključen u zabeleženi attempt
  budžet ili isključen.
- **FR-015**: Repeated action key mora uključiti tool name, canonical argumente i
  facts revision; ponovljena ista akcija se odbija pre executor poziva.
- **FR-016**: Run MUST završavati sa enumerisanim statusom i bezbednim stop reason-om,
  uključujući `completed`, `insufficient_evidence`, `invalid_input`,
  `invalid_model_proposal`, `unknown_tool`, `invalid_tool_arguments`, `tool_failed`,
  `provider_failed`, `malformed_output`, `step_limit`, `tool_call_limit`,
  `call_budget`, `deadline`, `repeated_action`, `stale_state` i `cancelled`.
- **FR-017**: Provider fallback/retry se primenjuje po postojećoj Week04 klasifikaciji
  greške, ograničeno u run-wide provider budget-u; ceo workflow se ne ponavlja
  nekontrolisano posle izvršenog alata.
- **FR-018**: Async run commit/status promena MUST proveravati game identity, hand
  identity, version/facts revision i runId; terminalni run se zatvara najviše jednom.
- **FR-019**: Javni route MUST validirati input, limit veličine, stale state i duple
  pozive; response se validira kroz deljeni strict contract i `no-store`.
- **FR-020**: AI agent MUST NOT menjati poker state, RNG, hand history, MatchFacts,
  stackove ili bot decisions; analizator čuva read-only invariant.
- **FR-021**: UI MUST prikazati samo bezbedne status/kategorije i finalni validirani
  odgovor/evidence. Nema sirovog prompt-a, chain-of-thought-a ili provider exception-a.
- **FR-022**: Run evidence/usage MUST razlikovati run, model step, provider attempt,
  tool attempt i stop reason; ne zapisuje se key, sirovi prompt, neograničen output
  niti hidden reasoning.
- **FR-023**: Default/fake testovi MUST biti offline i ne smeju zahtevati tajnu ili
  mrežu. Live demo za predaju MUST biti eksplicitan, ručni i bounded; zaseban
  uspešan live final i njegov dokaz prate T031 nakon T030 kontrolisanog prekida.
- **FR-024**: Novu partiju/reset tokom run-a MUST tretirati kao cancellation/stale;
  kasni provider odgovor ne može promeniti stanje ni prikaz aktuelne partije.
- **FR-025**: Bounded facts moraju transparentno označiti da starije odluke koje su
  agregirane nisu dostupne kao pojedinačni evidence.

## 6. Potvrđeni budžeti — T005, 2026-10-04

Početni limiti su potvrđeni bez promene. To je ugovor buduće implementacije,
ne tvrdnja o postojećem config-u. Semantika, retry, retention i stop prioritet su
u [planu](plan.md#zaključana-politika-t005), šeme u [data-model](data-model.md).

| Limit | Vrednost | Semantika |
|---|---:|---|
| Maksimalni modelski koraci | 2 | Jedan proposal, jedan final; retry nije novi step |
| Tool pozivi | 1 | Tool proposal izvršava se najviše jednom |
| Provider attempt-i ukupno | 4 | Suma retry/fallback attempt-a kroz oba step-a |
| Timeout attempt-a | 15 s | Skraćuje se na preostali run deadline |
| Ukupni deadline | 45 s | Od preflight prihvatanja do terminalnog rezultata |
| `get_decision_evidence.limit` | 1–10 | Rezultat nikad ne prelazi argument i hard cap |
| Tool output | 20 KiB = 20480 bajtova | JSON UTF-8; nikada ne seći činjenicu |
| Pokušaji po koraku | najviše 2 | Jedan retry ili fallback; config.maxAttempts=1 dodatno sužava |
| Tool timeout | 1 s | Kooperativni bounded rad, skraćuje se na preostali deadline |

Ako provider adapter ne može da poštuje ove semantike, plan mora navesti bezbednu
alternativu i test. Ograničenja su ukupna, ne obnavljaju se za svaki step.
Retention: jedan tekući/poslednji run u session-u, najviše 2 step/4 attempt/1 tool
zapisa i 1 canonical action key; nova partija/restart uklanja run. Retry nikada
ne povećava stepCount i ne ponavlja izvršeni alat. Timeout provider-a/alata i ostale
greške razlikuju se bezbednom failureCategory iz plana, uz FR-016 stopReason.
Insufficient_evidence je stopped razlog, nije dodatni status. Svi terminalni
rezultati imaju result=null osim completed. UI dobija ograničenje uzorka u
sampleLimited polju coach DTO-a. Novi ugovori ne menjaju Week04 AIAttempt semantics.

## 7. Finalni odgovor i evidence

Predloženi ugovor (konačna runtime šema u shared contract-u):

```ts
type CoachEvidence = {
  decisionRef: string;
  factCode: 'action' | 'phase' | 'legal_options' | 'known_cards' | 'hand_outcome';
  finding: string;
};

type CoachResult = {
  summary: string;
  recommendation: string;
  evidence: CoachEvidence[];
  confidence: 'low' | 'medium' | 'high';
  completed: boolean;
};
```

Sama validna forma nije dovoljna: backend proverava `decisionRef` i `factCode` prema
rezultatu alata i ograničenjima broja/dužine dokaza. Ishod ruke daje kontekst, ali
sam po sebi ne dokazuje kvalitet odluke. `completed: true` prihvata se samo uz
najmanje jednu validnu činjenicu; nedovoljno dokaza daje bezbedan terminalni odgovor
bez izmišljenih tvrdnji.
Finding mora tačno odgovarati kanonskoj činjenici iz tool rezultata za isti ref/code;
summary/preporuka su obrazovni tekst i nisu dokaz optimalnosti strategije. Granice
stringova, jedinstvenost, izbor focus-a i projekcija su u data-model ugovoru.

## 8. Van scope-a

- Analiza aktivne ruke/partije, više partija, trajna arhiva ili novi storage.
- Alat za upis, mutacija igre, generisanje bot poteza ili approval tok za upis.
- Proizvoljni shell, filesystem, URL/browser, SQL, spoljni servis ili nova provider porodica.
- Više agenata, otvoreno planiranje, preko dva model koraka, neograničen retry
  ili pozadinski daemon.
- RAG, vektorska baza, garantovana solver strategija ili automatska promena treninga.
- Live provider test u redovnom CI; podrazumevani testovi su fake.

## 9. Zavisan rad i handoff

Phase 3 HTTP forma: POST `/api/game/coach`, GET `/api/game/coach/:runId`.
Run/facts reviziju poseduje server; javni body ne prima factsRevision ni runId.
Backend DTO ostaje odvojen od Week04 GameView-a. Frontend dolazi kroz T021–T023.

Dva člana rade naizmenično na istom feature-u prema raspoloživim Codex tokenima.
Spec/task status i kratka predaja stanja su source of truth; ne planira se paralelan
rad na istim fajlovima. Svaki task označava predloženog trenutnog driver-a (`A`, `B`
ili `oba`), ali drugi član može nastaviti otvoreni task posle handoff-a i dopisati
stvarni doprinos/evidence. Ne potpisivati review u ime odsutnog člana.

## 10. Definition of Ready / acceptance summary

Implementacija počinje tek kada spec, plan i taskovi imaju dogovorene ugovore i kada
je pre prve velike implementacije sačuvan `docs/BUILD_PROMPT_WEEK05_V1.md`.
Feature je završen po GAME_SPEC §14 kada su kod, offline acceptance testovi, evidence,
UI, status/usage i dokumentovani rezultati usklađeni. Sam plan ne predstavlja dokaz.

### Dopuna za predaju — T030, 2026-10-05

Po korisnikovom odobrenju razrešena je ranija razlika između opcionog projektnog
live-a i assignment §31 MUST HAVE limited live demo. Predaja zahteva zaseban,
ograničen Week05 live dokaz i stvarni walkthrough/doprinos oba člana (T027).
Live nije deo CI: poseban `--live` opt-in, najviše jedan run ovog rada, dva koraka,
jedan alat, bez retry-ja/fallback-a; postojeći 15 s/attempt i 45 s/run rokovi važe.
Runner koristi sintetičku terminalnu partiju i produkcioni HTTP/session/orchestrator/
Gemini tok. Očekivanje uspeha: completed, 2 steps/2 attempts/1 execution, validan
final i nepromenjen poker rezultat. Bez opt-in-a ili konfiguracije: nula poziva.
Neuspeh mora imati stvarni safe razlog i exit status, bez dodatnog live pokušaja.
Privacy oracle razlikuje sirovi JSON ključ `candidate` od dozvoljene brojčane
metrike `candidateTokens`; token usage ostaje deo sanitizovanog dokaza.
Zabeležen neuspeh ne zatvara gate uspešnog live toka; T027 se ne zatvara runner-om.

Stvarni T030 rezultat: 1 run sa Gemini 3.5 Flash Lite, 2 steps/2 attempts/1 execution,
stopped/insufficient_evidence, bez finala; read-only prolazi. Safe izlaz ne omogućava
zaključak o konkretnom razlogu nedovoljnosti ili strateškom kvalitetu saveta.
T031 vodi preostali live success dokaz; T027/doprinos korisnik ostavlja za kasnije.

### T031 scenario i live odobrenje — 2026-10-05

Novi eksplicitni smoke scenario `street-review` pribavlja četiri stvarne ljudske
odluke kroz produkcione action rute jedne sintetičke terminalne ruke: call preflop,
check flop, check turn, all_in river. Ne menja poker pravila niti tool/final gates.
Pre coach start-a svi potezi su legalni, partija lost, čovek0/bot2000 i nula provider
poziva. Default T030 single-all-in ostaje za reprodukciju prvog dokaza.
Report dodaje samo scenario, available/tool decision count i runtime-validiranu
vrstu modelskog koraka/refusal reason enum. Kandidat i slobodan tekst se ne čuvaju.
Nevažeći scenario flag daje exit2 pre AI konfiguracije/poziva. Success i dalje 2/2/1
sa validiranim finalom, read-only i bez retry/fallback-a; refusal ostaje bezbedan stop.

Korisnik dopušta više live run-ova uz pitanje i navođenje rednog broja pre svakog.
Za ovaj nastavak cilj je jedan novi run, #2 u potvrđenom Week05 brojanju razgovora.
Pitanje/odgovor se čeka pre dispatch-a; preselected opcija nije odobrenje. Sledeći
run nije autorizovan samo prethodnim sandbox command prefix-om.

T031 stvarni ishod: korisnik izričito odobrio #2, street-review; completed, 2/2/1,
4 evidence reference, read-only=true, retry0/fallback0. [Live dokaz](../../docs/evidence/003-T031-live-02.txt).
Nije dokaz optimalnosti saveta niti ljudskog walkthrough-a. T027 ostaje otvoren.
