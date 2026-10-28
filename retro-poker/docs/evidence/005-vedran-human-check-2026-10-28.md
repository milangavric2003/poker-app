# Vedran — uspešna lokalna proba, 2026-10-28

Izvor: Vedranova potvrda, slike UI-ja i izlazi komandi dostavljeni u razgovoru.
Codex je uredio zapis, bez ponavljanja testova. Pregledani HEAD je `974b387`;
tačan SHA korisnikovog pokretanja nije dostavljen uz izlaze. Slike i puni izlazi
su u razgovoru, nisu zasebni fajlovi u repozitorijumu.

## Ručna provera

- `npm.cmd run demo:security`: uspešan build i startup; fake provider,
  sintetičke karte, 0 live AI poziva.
- Jedan bot, AI botovi isključeni: partija završena nakon prvog all-in poteza.
- Coaching „Odluke po fazama” završen uz sažetak, preporuku i all_in dokaz.
  Network: POST coach 202, čitanje run-a 200.
- Analiza i ponovna analiza: 2 uspešne analize i 1 completed coaching;
  ukupno 3 logička pokretanja, 4 uspešna fake provider pokušaja, 2 coaching
  koraka, 1 izvršen lokalni alat, 0 AI bot odluka. UI oznaka modela nije live poziv.
- Nova partija uklanja staru analizu/coaching; coaching zaključan dok igra traje.
- Vođeni negativni zahtev sa dodatnim `maxSteps:999`: dostavljen HTTP 400
  za POST `/api/game/coach`. Response JSON i poređenje stanja/usage pre i posle
  nisu priloženi. Sam status ne dokazuje `INVALID_INPUT` ili 0 provider/tool
  poziva. Konkretno uputstvo je Codexov primer, ne dokaz samostalne ideje testa.
- Korisnik potvrđuje uredan izgled i kontrole sa pet botova i oko 390 px širine.

## Provere koje je korisnik pokrenuo

| Komanda iz `retro-poker/` | Dostavljen rezultat |
|---|---|
| `npm.cmd test -- tests/contract/security-http.test.ts` | 37/37 PASS, 1 fajl, 1.08 s |
| `npm.cmd run test:security:e2e -- --headed` | Build uspešan; 6/6 PASS, 20.3 s |
| `npm.cmd run test:security` | 123/123 PASS, 11 fajlova, 2.35 s |

Browser izlaz potvrđuje normalan startup bez CSP violations, blokiran kontrolisani
eval i dostupnu spoljašnju skriptu uz pozitivne kontrole; coaching 2/1,
pokerUnchanged=true i mobileOverflow=false. Napadački tekst ne stvara izvršivi
DOM niti automatske zahteve. Sentinel odsutan iz pregledanih JS/CSS/HTML;
source maps ne postoje.

Serverski izlaz: početno odbijanje INVALID_INPUT sa 0/0 brojačima; shell,
constructor i toString bez executor poziva; burst [202,202,202,202,202,429],
5 prihvaćenih/10 provider/5 tool; normalan tok completed, 2 koraka/1 alat,
pokerPreserved=true. Automatizovani dokazi su odvojeni od ručnog HTTP 400.

## Granice

Potvrđena je uspešna lokalna proba i navedeni automatizovani testovi.
Ovaj zapis ne potvrđuje novo pokretanje pune suite, punog E2E, audita, clean
install-a ili hosted CI-a. Formalni osamominutni demo i individualna odbrana
nisu prijavljeni kao izvedeni; T030 ostaje otvoren.
