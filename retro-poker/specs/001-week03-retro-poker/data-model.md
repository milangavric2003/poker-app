# Model podataka i tranzicije

Sve putanje implementacije su planirane. Javni oblik je u [contracts/http.md](contracts/http.md).

## Vrednosti i entiteti

| Entitet | Polja i ograničenja |
|---|---|
| Card | Dva ASCII znaka: rang iz 23456789TJQKA, suit iz cdhs; bez duplikata u jednom špilu |
| Chips | Bezbedan ceo broj 0–6000; zbir za partiju je (botCount + 1) × 1000 |
| Seat | Ceo broj 0–5; konfigurisanih mesta je botCount + 1; ljudsko mesto je 0 |
| Player | id, seat, kind human/bot, stack; status active/folded/all_in/eliminated; holeCards dužine 0 ili 2; streetContribution, handContribution, stackAtHandStart |
| Game | gameId (UUID), version (bezbedan ceo broj ≥ 0), botCount ceo broj 1–5; players; status playing/won/lost; currentHand; lastHandResult; lastHandHistory |
| Hand | handId (UUID), number ≥ 1, phase preflop/flop/turn/river/complete; buttonSeat, smallBlindSeat, bigBlindSeat; actorId ili null; deck/cursor, burnCards, board; betting; settled boolean |
| Betting | currentBet, lastFullRaise ≥ 10, pendingActors; po učesniku acted boolean i lastFacedBet; na početku post-flop currentBet=0, lastFullRaise=10 |
| Pot | id, amount, contributionCap, contributorIds i eligibleIds; u rezultatu winnerIds i payouts |
| HandResult | handId, reason showdown/uncontested, pots, refunds, revealedCards, netChanges, gameStatus |
| Event | seq (rastući broj u ruci), handId, street, type, actorId po potrebi, javni iznos; privatni observation za ljudsku odluku ostaje interni |
| RandomState | Odvojeno deckRng i botRng; ne ulazi u javne ugovore |

Ograničenja se proveravaju šemom i domenom. ID-jevi ne predstavljaju naloge.
Eliminisani učesnik ostaje na svom mestu sa stackom 0 i bez karata u novoj ruci.

## Obračun i prava

- handContribution sadrži sve neisplaćene uloge ruke; streetContribution je njegov
  podskup i nikada se ne sabira ponovo u ukupan pot.
- Nakon refund-a umanjiti doprinos i povećati stack. Posle settlement-a prebaciti
  doprinose u rezultat i nulirati neisplaćene doprinose; settled=true sprečava drugu isplatu.
- pendingActors sadrži samo učesnike koji duguju odluku; BB opcija ostaje i kada su ulozi jednaki.
  Povećanje uloga ponovo zahteva odgovor onih koji duguju, ali im ne daje automatski pravo raise-a.
- Raise pravo: igrač koji još nije odlučio ima pravo; onaj koji je odlučio mora
  sada biti suočen sa povećanjem najmanje lastFullRaise od svog lastFacedBet.
  Check beleži lastFacedBet=0. Pun raise menja lastFullRaise; kratki all-in ne menja.
  Posle svakog prihvaćenog call/bet/raise beleži se tadašnji currentBet nakon akcije
  kao lastFacedBet tog igrača, uključujući njegov sopstveni raise; blind nije odluka.
  Dalje ograničenje: mora postojati drugi nefoldovani protivnik sa žetonima za raise.
- Pre-flop currentBet je najmanje nominalni BB10, čak i kada BB nema 10.
  Post-flop kratko otvaranje4 ima currentBet4 i lastFullRaise10: minimum raiseTo14.
- Potovi nastaju iz sortiranih različitih nivoa doprinosa; za svaki nivo uključiti
  doprinose foldovanih, ali ih isključiti iz eligibleIds. Nepotvrđen jedinstveni višak
  refundirati pre isplate. Kada svi osim jednog fold-uju, taj učesnik osvaja ceo preostali pot.
- Početak svake ruke beleži stackAtHandStart pre blindova. Neto je konačni stack minus
  taj početni stack, uključujući refund; zbir neto promena svih učesnika je 0.

## Lifecycle

1. Kreiranje validne konfiguracije: postavi mesta/stackove/button, blindove, podeli
   po dve karte počev od prvog aktivnog levo od button-a; heads-up počinje BB.
2. Izvrši botove dok čovek ne dođe na red ili ruka ne završi. Početno javno stanje
   zato može već sadržati bot poteze, a uloge treba računati iz događaja.
3. Ljudski zahtev prvo prolazi format/identitet/reviziju/legalnost. Zatim napravi
   kandidat stanje sa kopijom RNG i istorije, primeni akciju i automatske prelaze.
4. Round complete → burn/board → nova betting runda. Ako više nema ulaganja,
   dovrši board; ako ostane jedan nefoldovani, bez daljeg deljenja pređi na settlement.
5. Settlement → complete; eliminacija i status partije tek posle svih potova.
6. next-hand dozvoljen samo iz complete + playing. Sačuvaj poslednji rezultat/istoriju,
   očisti privatne karte i fold statuse preživelih, prenesi stackove, pomeri blindove.
7. Restart procesa gubi Game. GET tada daje prazan pogled, a stara mutacija grešku.

Transakcija commit-uje stanje i povećava version jednom po uspešnoj komandi;
pojedinačni događaji imaju sopstveni seq. Sve operacije idu kroz isti serijski red,
uključujući GET snapshot i zamenu igre. Nevalidan zahtev ne troši RNG ni version.
Interna greška odbacuje kandidat. Bot fallback je legalna prihvaćena akcija uz signal.
Zaštitni limit 10000 automatskih poteza po komandi vraća INTERNAL_ERROR uz rollback
ako je prekoračen; ne menja pravila validne igre.

## Čuvanje i vidljivost

Backend čuva samo aktuelnu i poslednju završenu ruku, u memoriji. Javni serializer
izdvaja dozvoljena polja eksplicitno, bez spread-a internog Game/Player objekta.
Čovek uvek vidi svoje karte te ruke; botove samo pri dozvoljenom showdown-u.
BotObservation sadrži samo njegove karte, javne događaje, board, stackove i legalne akcije.
Test interfejs za deck/stack/RNG dostupan je samo kroz konstruktor u procesu, bez HTTP rute.
