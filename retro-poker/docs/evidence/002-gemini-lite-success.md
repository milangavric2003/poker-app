# Gemini Lite: oporavak i stvarni uspeh — 2026-09-29

## Nalaz i izmene

Lite komunicira sa API-jem. Raniji 503/UNAVAILABLE ne dokazuje nedostatak kredita.
Limit od 5 s prekidao je i odgovore koji bi kasnije uspeli. Lokalni `.env` sada
koristi Lite kao primarni i isti fallback model, jedan pokušaj, 30 s po bot pozivu,
35 s ukupnog bot budžeta i 29 s za analysis poziv. Default koda ostaje 5/12 s.

Bot je zatim vraćao nevalidne predloge. Stroga JSON anyOf šema, i na korenu i
unutar `action`, dala je prazan objekat na zabeleženim probama. To ne dokazuje
opštu nepodržanost anyOf. Gemini adapter sada koristi ravnu šemu sa obaveznim
identitetom, tipom poteza i nullable `amountTo`. Uklanja samo null iznos kod
fold/check/call/all_in. Zod i engine i dalje proveravaju sva polja, identitet,
verziju, red poteza i legalne iznose. Pozitivan iznos na call, null na bet i
nepoznata polja ostaju greške.

Pri pripremi terminalnog smoke scenarija otkriven je i popravljen javni snapshot:
eliminisani igrač ima `cards: null`, u skladu sa postojećim ugovorom. Rezultat
showdown-a zadržava svoja otkrivena polja.

## Live pozivi u ovom bloku

| Proba | Rezultat | Provider latency | Total tokens |
|---|---|---:|---:|
| Minimalni REST Lite, tekst OK | HTTP 200, OK | 27.667 ms | 7 |
| Produkcioni adapter, sintetički check kontekst | validan check | 12.574 ms | 228 |
| Puni bot scenario pre popravke šeme | schema_rejected | 7.688 ms | 717 |
| Analiza završene partije | completed / model_success, poker stanje neizmenjeno | 6.914 ms | 827 |
| Bot sa root anyOf | schema_rejected | 6.789 ms | 1.473 |
| Bot sa bezbednom dijagnostikom | prazan objekat, schema_rejected | 5.680 ms | 1.794 |
| Bot sa action envelope | prazan predlog, schema_rejected | 5.743 ms | 734 |
| Bot sa ravnom nullable šemom | model_success, engine commit, bez fallback-a | 1.161 ms | 808 |

Osam generation poziva u ovom bloku; prethodni neuspešni dijagnostički blok je
istorijski odvojen. Cena nije poznata. Nijedan ključ, sirovi odgovor ili privatni
kontekst nije zapisan ovde. Poslednji bot: jedan poziv, prompt 713 i candidate 95
tokena; ukupno trajanje smoke scenarija 1.261 ms; exit 0.

Komanda poslednje provere:
`node --env-file=.env dist/server/scripts/gemini-live-smoke.js --live --bot-only`.
Analiza je proverena prethodnim punim pozivom iste skripte; nakon promene bot šeme
nije ponovo slata. Analysis transport nije promenjen tom izmenom.

## Zašto raniji testovi nisu primetili problem

Fake provider i mockovani HTTP vraćali su unapred pripremljen validan JSON. Time
su proveravali lokalni ugovor i fallback, ali nisu dokazivali da živi model daje
takav odgovor ili odgovara pre 5 s. Prolaz fallback testova nije live uspeh.
Novi opt-in smoke zahteva `model_success`, engine commit i read-only analizu;
fallback ili nevalidan odgovor daju exit 1. Offline test runner-a proverava i
uspeh i HTTP 503 bez mreže. Default testovi i dalje ne troše API kvotu.

## TDD i ograničenja

Zabeleženi RED→GREEN: tri testa sporijeg profila, dva terminalnog snapshot-a,
šest usaglašavanja JSON šeme, jedan adapter test null iznosa. Provera JSON šeme
koristi Fastify validator sa `removeAdditional: false`; prvobitni pokušaj
Zod konverzije nije bio pouzdan oracle za dodatna polja u uniji.

Uspeh jednog bota i jedne analize ne garantuje dostupnost za svaku ruku. Čekanje
može trajati 30 s po botu; 503 i rate limit ostaju mogući. Browser E2E nije ponovo
pokrenut u ovom bloku. Završni rezultati lokalnih provera dopunjeni su ispod.

Završne provere 2026-09-29: npm test — 444/444 (42 fajla), exit 0;
npm run typecheck — exit 0; npm run lint — exit 0; npm run build — exit 0.
