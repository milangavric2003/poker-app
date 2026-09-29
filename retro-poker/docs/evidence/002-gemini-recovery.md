# Gemini recovery — 2026-09-28

## Nalaz

Stvarni generation zahtevi stižu do Google API-ja. Direktan REST zahtev bez SDK-a,
šeme i poker konteksta vraća 503/UNAVAILABLE. Bezbedno pregledana poruka prijavljuje
trenutno veliko opterećenje modela (high demand). Interactions API sa `store:false`
vraća isti razlog. Promena SDK-a/endpoint-a nema potvrđen dokaz da rešava problem.
Ovo nije dokaz globalnog outage-a, billing stanja ili uspešne generacije.

List models sa istim lokalnim ključem vraća HTTP 200 i oba konfigurisana ID-ja.
Prisustvo u katalogu nije garancija uspešnog generation pristupa: stariji
2.5 Flash-Lite pojavljuje se u listi, ali generation vraća 404 da više nije dostupan
novim korisnicima, uz preporuku prelaska na 3.5 Flash-Lite.

## Stvarni pozivi ovog nastavka

SDK: @google/genai 2.24.0. Modeli i `.env` nisu menjani. Pet generation pokušaja
ukupno, bez SDK ponavljanja; dva uspešna list models GET-a i jedan GET blokiran u
sandboxu sa EACCES nisu generation pozivi. Posle EACCES korišćena standardna
eskalacija. Ključ nije prikazan, prosleđen u argumentima komande niti zapisan.

| # | Put | Model | HTTP / ishod | Trajanje |
|---|---|---|---|---:|
| 1 | Direktni generateContent REST, minimalni tekst | gemini-3.5-flash-lite | 503 UNAVAILABLE, high demand | 625 ms |
| 2 | Direktni generateContent REST, minimalni tekst | gemini-3.1-flash-lite | 503 UNAVAILABLE, high demand | 556 ms |
| 3 | Direktni generateContent REST, minimalni tekst | gemini-2.5-flash-lite | 404 NOT_FOUND, nije dostupan novim korisnicima | 215 ms |
| 4 | Direktni Interactions REST, store:false | gemini-3.5-flash-lite | 503, high demand; provider status code nije vraćen | 1743 ms |
| 5 | Izgrađeni produkcioni adapter + coordinator + UsageStore, sintetički kontekst | gemini-3.5-flash-lite | timeout; HTTP status nepoznat; logical local_fallback | 5006 ms |

Poslednja proba je koristila samo jedan pokušaj, bez model fallback-a i sa normalnim
bot timeout-om od 5 s. Skripta je završila exit 1. Nije pokrenuta partija niti
izvršen engine commit. Nema uspešnog live odgovora; bot/analysis success ostaje
nepotvrđen. Pozivi 1–4 su prethodili pauzi razgovora, peti je izvršen posle nastavka.
Trošak i tokeni nisu dostupni. Prethodne Luna probe nisu deo ovih pet pokušaja.

## Popravke

- SDK JSON greška se parsira samo u memoriji. Čuvaju se HTTP status, zatvoreni
  provider code enum i reason high_demand/unknown. Raw tekst i details se odbacuju.
- Coordinator, UsageStore i frontend runtime ugovor prenose dozvoljenu dijagnostiku;
  tabela Attempts dobija kolonu Razlog. Različiti statusi/razlozi se ne agregiraju
  u isti red.
- Fallback banner upućuje na AI upotreba umesto tvrdnje da razlog nije dostupan.
- invalid_request (uključujući HTTP 404) više se ne svodi na auth_config_error.
- CLI proverava sadržaj odgovora: prazan HTTP 200 nije uspeh; C proverava bot šemu,
  identitet i legalnost. Greška daje exit 1 i prekida sledeće probe. Node parseEnv
  zamenjuje ručni parser, a scripts su uključeni u TypeScript provere/build.
- Dodata npm komanda diagnose:gemini; bez opt-in nema mreže.

## RED/GREEN i konačne provere

Stvarno zabeleženi RED rezultati pre popravke:
- `npm.cmd test -- tests/integration/gemini-http.test.ts`: 1 passed / 3 failed.
  Uspešna SDK serijalizacija je već radila. Padovi: izgubljena dijagnostika bot/analysis
  i 404 pogrešno klasifikovan kao auth_config_error.
- `npm.cmd test -- tests/unit/gemini-diagnosis.test.ts tests/ui/dashboard.test.tsx`:
  5 passed / 3 failed. CLI je vraćao exit 0 za 503 i prazan 200; UI nije prikazivao razlog.

GREEN:
- Fokusirani adapter/SDK HTTP/CLI/usage/UI skup: 5 suite-ova, 26/26 prošlo.
- `npm.cmd test`: 38 suite-ova, 427/427 prošlo, exit 0.
- `npm.cmd run typecheck`: exit 0. Prvi pokušaj otkrio Dict<string> vs
  Record<string,string> tip iz Node parseEnv; ispravljeno u string | undefined.
- `npm.cmd run lint`: exit 0.
- `npm.cmd run build`: exit 0.
- Posle završne promene teksta fallback bannera: `npm.cmd test --
  tests/ui/ai-status.test.tsx tests/ui/actions.test.tsx` — 22/22, exit 0;
  build ponovljen, exit 0. `git diff --check` prošao.
- Kompajlirani CLI sa `RUN_GEMINI_DIAGNOSTIC=0`: `Not run`, exit 0, bez mreže.

SDK HTTP test ne mockuje generateContent: koristi stvarni SDK i globalni presretnuti
fetch sa lažnim ključem, produkcionu JSON šemu i reprezentativni odgovor/grešku.
CLI test pokreće child process sa presretnutim HTTP-om. To su offline provere i
ne dokazuju dostupnost Google servisa. Browser E2E i uspešna live analiza nisu
pokrenuti u ovom nastavku.

## Nastavak kada provider proradi

Restartovati backend i osvežiti frontend radi nove kolone Razlog. Ručna komanda
`npm.cmd run diagnose:gemini -- --live` pravi do tri nova generation zahteva.
Ako Windows tsx bootstrap prijavi ENOMEM, posle build-a se može pokrenuti
`node --env-file=.env dist/server/scripts/gemini-diagnosis.js --live`.
Novi live pozivi zahtevaju poštovanje dogovorenog budžeta; ovih pet je iscrpljeno.
Posle uspešne dijagnostike još treba dokazati stvaran bot engine commit i analizu
kroz aplikacione rute. Fallback i zeleni offline testovi nisu taj dokaz.

## Izvori

### Dodatna proba posle korisničke slike limita

Novi korisnički zahtev pokazuje Lite timeout od 5002 ms i AI Studio tabelu sa
naslovom peak usage u poslednjih 28 dana. Tabela prikazuje Lite 5/15 RPM,
4.95K/250K TPM, 23/500 RPD; to nije dokaz iscrpljene Lite kvote niti trenutno
stanje dnevne potrošnje. Flash 3.8 ima crvene request limite, ne TPM limit.

U ovom zasebnom nastavku najavljen je i izvršen tačno jedan novi generation zahtev:
produkcioni adapter/coordinator, gemini-3.5-flash-lite kao primary, bez prethodnog
Flash pokušaja, jedan attempt bez retry-ja, bot timeout privremeno 11000 ms.
Ishod: timeout za 11018 ms, HTTP status nepoznat, nema token metadata, exit 1.
Nije izvršen engine commit. Ovo je šesti generation pokušaj tokom recovery rada
(pet u prethodnom odobrenom bloku, jedan u novom). `.env` i produkcioni pragovi nisu
menjani jer proba nije dokazala da 11 s rešava problem. Sam timeout ne otkriva
provider razlog: prethodni high_demand rezultat se ne pripisuje automatski ovoj probi.

Dokumentacija za rate limits i Live API proverena je ponovo. Live modeli koriste
WSS i ne predstavljaju zamenu za generateContent adapter prostom promenom ID-ja;
Unlimited u RPM/RPD koloni ne uklanja prikazani TPM limit.

- [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Live API](https://ai.google.dev/gemini-api/docs/live-api)

- [Gemini model capability](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Interactions overview](https://ai.google.dev/gemini-api/docs/interactions-overview)
- [Troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting)

Provereni uz lokalni SDK i stvarne HTTP rezultate; dokumentovani model ili endpoint
nisu korišćeni kao dokaz dostupnosti za ovaj zahtev.
