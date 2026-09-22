# Lokalni HTTP ugovor v1

Planirani izvor šema: shared/contracts.ts (Zod strict objekti, bez implicitne konverzije).
Ugovor je dokumentacija; ovim korakom se ne piše implementacioni kod.

## Transport

Frontend http://127.0.0.1:5173, backend http://127.0.0.1:3001.
UI šalje /api preko Vite proxy-ja; backend prihvata browser Origin samo
http://127.0.0.1:5173. Bez Origin-a dozvoljeni su lokalni test/CLI zahtevi.
Oba procesa bind 127.0.0.1, strict port bez automatskog prelaska na drugi port.
JSON request/response, Cache-Control: no-store; limit tela 16 KiB.
Nepodržan Content-Type: 415, preveliko telo: 413, bez mutacije.
Ne dozvoljavati wildcard CORS. Bez kolačića, naloga ili autentifikacije.

| Metod i ruta | Ulaz | Uspeh |
|---|---|---|
| GET /api/game | Bez tela | 200 {game: GameView ili null} |
| POST /api/game | GameConfig i uslovni header ispod | 201 {game: GameView} |
| POST /api/game/actions | PlayerAction | 200 {game: GameView} |
| POST /api/game/next-hand | NextHand | 200 {game: GameView} |

Nova partija: telo je tačno {"botCount":5}, botCount obavezan ceo JSON broj 1–5.
Kada nema igre, klijent šalje If-None-Match: *. Kada zamenjuje postojeću igru,
posle korisničke potvrde šalje If-Match: "gameId:version" iz poslednjeg GET-a.
Backend proverava uslov pod istim lock-om kao zamenu; nedostajući uslov vraća428,
neusaglašen409. Tako dupli početak/reset ne briše noviju partiju. GameConfig ne dobija nova polja.

PlayerAction: obavezni gameId i handId (UUID), expectedVersion (safe integer ≥0),
type jedan od fold/check/call/bet/raise/all_in; amountTo (safe integer 1–6000)
obavezan samo za bet/raise, zabranjen za ostale. actorId nije dozvoljen: ljudsko
mesto određuje server. NextHand: samo gameId, handId, expectedVersion.
Svi objekti odbijaju nepoznata polja i null umesto tražene vrednosti.

Primer akcije:
```json
{
  "gameId": "11111111-1111-4111-8111-111111111111",
  "handId": "22222222-2222-4222-8222-222222222222",
  "expectedVersion": 7,
  "type": "raise",
  "amountTo": 60
}
```

## GameView — potpun javni snapshot

Sva navedena polja su obavezna, osim eksplicitno uslovnih polja unutar unija.
Polja označena null ne smeju biti izostavljena niti zamenjena internim vrednostima.
Card je ASCII rang+suit iz data-model, Chips safe integer0–6000.

| Polje | Oblik i značenje |
|---|---|
| gameId, handId | UUID tekuće partije/ruke |
| version | Safe integer ≥0; povećanje jednom po prihvaćenoj komandi |
| botCount, handNumber | Integer1–5, integer≥1 |
| status | playing / won / lost |
| phase | preflop / flop / turn / river / complete |
| buttonSeat, smallBlindSeat, bigBlindSeat | Integer0–5, uključujući mrtvu poziciju |
| actorId | ID igrača na potezu ili null kada complete |
| board | Card[], broj0/3/4/5 saglasan fazi; complete može ostati na ranijem broju posle fold-a |
| players | PlayerView[], dužina botCount+1, jedinstveni id/seat |
| totalPot | Zbir još neisplaćenih doprinosa; posle settlement-a0 |
| pots | PotView[] projekcija trenutnih doprinosa; posle settlement-a prazno |
| legalActions | LegalAction[] samo za čoveka na potezu; inače prazno |
| events | PublicEvent[] za tekuću ruku, u rastućem seq redosledu |
| result | HandResult kada complete; inače null |
| previousResult | HandResult prethodne ruke ili null |

PlayerView: id, seat, kind human/bot, stack, streetContribution,
handContribution, status active/folded/all_in/eliminated, cards (null ili tačno2 Card).
Čovekove karte su dostupne i posle fold-a do sledeće ruke; protivničke samo kada
nefoldovani učesnik dođe na showdown. Eliminisani nema karte u narednoj ruci.

PotView: id, amount, contributionCap, contributorIds, eligibleIds.
Ovo je projekcija doprinosa, ne dodatni saldo. Pre završetka dozvoljen je vršni sloj
sa jednim contributor-om; konačni rezultat ga refundira. UI potove tokom igre
označava kao trenutne, a konačne isplate čita samo iz result.

LegalAction je diskriminisana unija:
- fold/check: samo type.
- call: type, payAmount (min duga i stacka), isAllIn boolean.
- bet/raise: type, minAmountTo, maxAmountTo; uključiti samo ako postoji legalan
  običan iznos, min≤max. Kratak all-in nije proširenje tog raspona.
- all_in: type, amountTo, payAmount, classification call/bet/raise.
  Uključiti samo ako je legalan, uključujući pravo ponovnog raise-a.

Svaki amountTo je ukupan street ulog. UI ne računa legality sopstvenim poker pravilima.

## Rezultat, događaji i greške

HandResult: handId, reason showdown/uncontested, gameStatus playing/won/lost;
pots: niz {id, amount, eligibleIds, winnerIds, payouts:[{playerId,amount}]};
refunds:[{playerId,amount}]; revealedCards:[{playerId,cards:[Card,Card]}];
netChanges:[{playerId,amount}] gde amount sme biti negativan ceo broj -6000..6000.
Svi ID-jevi referenciraju učesnike odgovarajuće ruke; iznosi payouts/refunds nenegativni.
Zbir payouts jednak je zbiru konačnih potova; zbir netChanges0.
Own cards nefoldovanog čoveka mogu biti u revealedCards kao i karte ostalih showdown učesnika.

PublicEvent zajednički ima seq≥1, handId, street; unija po type:
- hand_started: number, buttonSeat, smallBlindSeat, bigBlindSeat.
- blind_posted: playerId, blind small/big, amount.
- action: playerId, actionType, payAmount, amountTo (konačni street doprinos).
- board_dealt: cards (nove3 ili1).
- refund: playerId, amount.
- settled: reason (detalji u result).
Nema hole-dealt, seed, deck ili privatnog decision observation-a u javnim događajima.
Bot fallback se beleži u internoj dijagnostici, bez skrivenih karata.

GameError: {"error":{"code":"ILLEGAL_ACTION","message":"Check nije dozvoljen dok postoji doplata."}}
Bez stack trace-a ili internog stanja; poruka na srpskom, code stabilan.

| HTTP | code | Uslov |
|---|---|---|
| 400 | INVALID_INPUT | Sintaksa/šema/iznos/tip/nepoznato polje |
| 404 | GAME_NOT_FOUND | Nema igre ili pogrešan gameId |
| 409 | STALE_STATE | Pogrešan handId, expectedVersion ili neusaglašen uslov za kreiranje |
| 409 | ILLEGAL_ACTION | Nelegalan potez, faza ili tuđi red |
| 428 | PRECONDITION_REQUIRED | Nova/zamenska partija bez uslovnog header-a |
| 413 | PAYLOAD_TOO_LARGE | Prekoračen limit tela |
| 415 | UNSUPPORTED_MEDIA_TYPE | Mutacija nije application/json |
| 500 | INTERNAL_ERROR | Neuspeh servera, kandidat stanje odbačeno |

Validacija ide format → identitet → revizija → domen, pre trošenja RNG.
Serijski red za sve operacije; samo uspeh commit-uje verziju i sve bot poteze.
GET na praznom serveru je200 game:null, ne404.
Frontend proverava i uspešan i error oblik; nevalidan odgovor prikazuje kontrolisanu
grešku i zadržava prethodni potvrđeni snapshot. Ne ponavlja mutaciju automatski.
Posle greške/izgubljenog odgovora nudi GET radi usklađivanja.

## Dogovor za razvoj u paru

A implementira rute i javni serializer; B implementira klijent i komponente.
Obojica koriste iste šeme i javne fixtures. Promena ovog ugovora prvo menja dokument
i contract test, pa oba potrošača. BotObservation je interna granica, ne javna ruta.

