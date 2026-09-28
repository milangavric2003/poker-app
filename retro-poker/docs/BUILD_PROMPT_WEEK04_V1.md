# Week04 AI integracija — početni prompt V1

Ovo je neizmenjena kopija originalnog prompta sačuvanog u
`specs/002-week04-ai-integration/prompt.md` commitom `e5a842b` (`T002`). Kopija je
napravljena 2026-09-28 da bi obavezna T002 putanja bila ispunjena bez rekonstrukcije
ili prepisivanja istorijskog sadržaja.

## Originalni prompt

```text
Radi u projektu Retro Poker na zasebnom Week04 AI integration feature-u. Proširi
postojeću lokalnu Week03 browser poker igru opcionim model-driven botovima,
strukturisanom analizom završene partije i lokalnim usage dashboardom.

Koristi Google AI Studio Gemini API kao prvi i jedini provider family. Backend ostaje
jedini autoritet nad stanjem i potezima: model dobija samo minimalan sanitizovan
kontekst i vraća nepoverljiv strukturisan predlog koji mora proći schema, semantičku i
postojeću engine validaciju pre tačno jednog commit-a. Ne šalji skrivene karte, špil,
seed/RNG, buduće događaje, environment, source, pune promptove ili raw logove/odgovore.

API ključ je samo server-side GEMINI_API_KEY. Ne traži, ne prikazuj, ne loguj i ne
commituj njegovu vrednost. Kada ključ nedostaje, ne pravi mrežni poziv: lokalna igra i
deterministički bot fallback moraju nastaviti, a analiza mora imati bezbedan unavailable
status.

Implementiraj provider-neutral granicu i fake-first TDD. Automatski unit, contract,
integration i UI testovi ne smeju zavisiti od interneta ili stvarnog ključa. Posebno
pokrij success, malformed/schema grešku, semantički ilegalan predlog, timeout, 429,
5xx, drugi Gemini model, iscrpljeni bot fallback, missing key, neuspelu analizu,
stale/late/duplicate rezultat, reset i pending-provider konkurentnost.

Ograniči svaku logičku AI interakciju na najviše dva provider pokušaja. Bot mora dobiti
modelski ili lokalni ishod u najviše 12 sekundi; analiza validiran rezultat ili jasan
failure u najviše 30 sekundi. Retry istog modela i fallback na drugi Gemini model
moraju biti različito evidentirani. Ne dozvoli duplu mutaciju niti globalno blokiranje
read-only zahteva dok je provider pending.

Analiza završene partije je read-only obrazovna pomoć. Koristi bounded, proverene
činjenice i za ljudske odluke razdvoji znanje dostupno u trenutku poteza od kasnijeg
ishoda. Usage dashboard je samo in-memory, prikazuje logičke interakcije i attempts,
bezbedne ishode, retry/fallback i latency; tokeni i trošak ostaju „nepoznato” kada ih
provider nije stvarno vratio.

Sačuvaj specifikaciju, plan, ugovore, TDD RED/GREEN dokaze i stvarne rezultate. Ne
izmišljaj pozive, trošak, review ili PASS. Live smoke je opcion, ručan i odvojen od
podrazumevanih testova. Pre implementacije proveri governance usklađivanje Week04
scope-a sa GAME_SPEC v1.1 i constitution v1.1.0.

Operativni okvir projekta je 10–15 značajnih coding iteracija; Week04 budžet je do
20–30 live AI razvojnih poziva i do 5 demo poziva. To nisu tvrdnje da su pozivi
izvršeni.
```

## Početni status

U trenutku originalnog prompta implementacija i testovi još nisu bili pokrenuti u tom
dokumentacionom koraku. Model/SDK izbori i datumi zvanične provere nalaze se u
`specs/002-week04-ai-integration/plan.md`, `research.md` i kasnijem evidence-u. Dokument
ne sadrži ključ niti tvrdi da su live pozivi izvršeni.
