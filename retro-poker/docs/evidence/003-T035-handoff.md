# T034/T035 — coaching pouzdanost, 2026-10-06

Primenjena je precizna dijagnostika formata i popravljena Gemini transportna šema.
Potrošeno je **48 od odobrenih 50 pojedinačnih API zahteva**, isključivo
`gemini-3.5-flash-lite`. Nije bilo automatskih retry/fallback poziva.

## Signal, uzrok i popravka

Početnih šest live run-ova:4completed/2failed (`transport_shape`). Detaljnija safe
klasifikacija na devet scenarija:7completed/2failed, oba `invalid_kind` u finalu.
Run-ovi: `b53dfc15-4352-4f9d-9bf0-f143f7a1dba1` (single-all-in/showdown) i
`f7a7c35d-d0f7-4ea6-99ee-3a654dba21fa` (street-review/street). Dokaz je runtime
odbijanje tipa odgovora; nisu bili odbijeni zbog decisionRef/factCode/finding-a.
Raw odgovor se ne čuva: nedostajući naspram pogrešnog kind-a nije razlučen.
Tačno polje dva istorijska korisnička run-a ostaje nepoznato iz njihovih DTO-a.

Utvrđen je konkretan defekt adaptera: Zod JSON schema za literalne oznake kind-a
slala je `const`, dok [Gemini dokumentovani skup](https://ai.google.dev/gemini-api/docs/structured-output)
navodi `enum` za string/number klasifikacije, a ne `const`. Pročitan je i lokalni
SDK2.24.0 responseJsonSchema type opis. Oba coaching koraka sada dobijaju ekvivalentni
singleton enum. Test snima stvarno prosleđenu SDK šemu oba koraka, proverava da nema
const i da izvorni neutralni ugovor nije mutiran. RED1FAIL/34PASS→GREEN137/137.
Veza schema defekta sa stohastičkim live invalid_kind-om je zaključak iz ovog signala
i retesta; sirovi sadržaj greške nije istorijski rekonstruisan.

Numerisani izbor kanonskih činjenica (T033), tačno članstvo final dokaza, duplikati,
opseg indeksa, nepoznata polja, completion i ograničenja teksta ostaju validirani.
Adapter ne popravlja nevalidan kandidat niti bira dokaze umesto modela. Uputstva
modelu navode dozvoljen korak, jedinstvene indekse i granice teksta. T034/T035 dodatno
prenosi samo allowlisted `outputIssue`, bez raw vrednosti ili Zod poruke.

## Stvarni live rezultati

| Paket | Run-ovi | Zahtevi | Uspeh | Odbijanje |
|---|---:|---:|---:|---|
| baseline | 6 | 12 | 4/6 | 2 transport_shape |
| diagnosis | 9 | 18 | 7/9 | 2 invalid_kind |
| enum-retest | 9 | 18 | 9/9 | 0 |

Diagnosis i enum-retest imaju istu matricu: street/betting/showdown × single-all-in,
street-review i long-match. Treći scenario je nezavisan holdout sa tri ruke i12
odluka kroz sve faze (betting uzorak3); alat bira najviše10 odluka. Literalni oracle
za kontrolisani špil i završne stackove proveren je pre coach poziva. Sintetičke
partije koriste zaseban in-process HTTP app sa produkcionim adapterom/orchestratorom,
ne korisnikovu otvorenu partiju. Sve24 read-only provere prolaze. Svaki run ima
2model koraka/2zahteva/1alat; nema quota/timeout grešaka, retry-ja ili fallback-a.
Ovo meri validnost toka, ne optimalnost saveta ili pouzdanost svih budućih odgovora.

[Safe JSON dokaz](003-T035-live.json) sadrži24izveštaja i37dispatch vremena
(ordinali12–48). Minimalni zabeleženi razmak6000ms, najviše10poziva u bilo kom
zabeleženom prozoru60s. Vremena1–11nisu beležena i nisu naknadno izmišljena; gate
je od početka primenjivao isti razmak i početni60scooldown. Testiran je hard cap50
koji se prenosi kroz isti ledger između serijskih CLI pokretanja, brojanje neuspeha
pre dispatch-a, abort, zabranjen model i429cooldown. CLI se pokreće samo jedanput
istovremeno; ledger nema inter-process lock. Dva odobrena zahteva ostala su neiskorišćena.

Poznata potrošnja je22927totalTokens iz44zahteva;4odbijena izlaza nemaju zabeleženu
usage metriku. Ukupan broj tokena i cena su nepoznati. Nijedan ključ, prompt,
raw response, privatne karte ili reasoning nije uključen u live dokaz.

## Provere i primena

| Provera | Dokaz | Rezultat |
|---|---|---|
| T034 stvarno primenjen, fokus | [log](003-T034-applied.txt) | 119/119 |
| kind schema RED | [log](003-T035-kind-red.txt) | 1FAIL/34PASS |
| konačni fokus | [log](003-T035-kind-green.txt) | 137/137 |
| puna offline regresija | [log](003-T035-regression.txt) | 888/888,61fajl |
| tipovi | [log](003-T035-typecheck.txt) | exit0 |
| lint | [log](003-T035-lint.txt) | exit0 |
| build | [log](003-T035-build-kind.txt) | exit0 |

Dodatni RED/GREEN logovi za gate/focus, safe issue dijagnozu i long-match sačuvani
su odvojeno (`003-T035-red/green`, `detail-red/green`, `long-red/green`). Početni
flags test setup i TS inference greške sačuvani su kao neuspešni pokušaji; nisu
dokaz očekivanog behavior RED-a. Ne menjaju se očekivanja da bi nevalidan odgovor prošao.

T034 prvobitno pripremljen van aktivnog runtime-a; sada primenjen po odobrenju.
Prvi git apply iz poddirektorijuma bez Git prefiksa nije primenio source patch.
Stvarna primena koristi `git -C .. apply --directory=retro-poker -- retro-poker/docs/evidence/003-T034-prepared.patch`;
119testova i prisustvo novih runtime izvora provereni su nakon nje. Prethodni
apply-check0 sam za sebe nije dokaz primene. Backend watcher sme da restartuje po
aktuelnom korisničkom odobrenju; memorijska partija nema trajno čuvanje.

Browser E2E nije ponovljen u ovoj sesiji: korisnička dev aplikacija zauzima5173;
UI testovi prolaze u punoj regresiji, stvarni HTTP/provider tok kroz izolovane
fixture-e potvrđen je live proverama. Nema deploy-a, commit-a, push-a, subagenata,
novih zavisnosti ili potvrđenog ljudskog peer review-a. T027 walkthrough je zaseban
odloženi ljudski task. T034/T035 implementacija i ovde dokumentovana provera završeni su.
