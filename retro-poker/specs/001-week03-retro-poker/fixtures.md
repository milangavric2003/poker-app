# Nezavisni oracle i plan testova

Očekivanja su zapisana pre implementacije. c/d/h/s = tref/karo/herc/pik; T = desetka.
Svaki red je zaseban fixture. Kontrolisani špil dopuniti preostalim jedinstvenim
kartama; očekivanje se nikad ne računa funkcijom koja se testira.

## AC15 — evaluator

Rank je leksikografski niz [category, ...kickers], category 0–8 od high-card do
straight-flush. Suit nije deo poređenja; wheel ima high=5.

| Fixture | Sedam karata ili board i privatne karte | Oracle |
|---|---|---|
| EV01 | Board 2c 3d 4h 5s Kc; A Ah Qd; B 6h Jd | A straight5 [4,5], B straight6 [4,6]; B pobeđuje |
| EV02 | Board Kc Kd 8h 5s 2c; A Ah Qd; B Jh Td | A [1,13,14,12,8], B [1,13,11,10,8]; A pobeđuje kickerom |
| EV03 | As Ah Ad Ks Kh Kd 2c | Full house AAAKK [6,14,13] |
| EV04 | As Ah Ks Kh Qs Qh 2c | Dva para AAKKQ [2,14,13,12] |
| EV05 | Ac Kd Qh Js 2c 7d 8h | High-card [0,14,13,12,11,8]; nema wrap straight-a |
| EV06 | 9c 9d 9h As Kd 4c 2h | Trips [3,9,14,13] |
| EV07 | Ah Jh 8h 5h 2h Kc Qd | Flush [5,14,11,8,5,2] |
| EV08 | 7c 7d 7h 7s Ac Kd 2h | Quads [7,7,14] |
| EV09 | 5s 6s 7s 8s 9s Ad Kc | Straight flush [8,9] |
| EV10 (AC14) | Board As Ks Qs Js Ts; A 2c 3d; B Ah Ad | Obojica [8,14], pot se deli |

Svi nivoi kategorija moraju biti poređeni i između susednih kategorija.
Dodati negativne ulaze (dupla karta, pogrešan rang/suit/broj karata) u evaluator test.
Za bot procenu 5/6 dostupnih karata dozvoljeno je evaluirati sve kombinacije pet;
produkcijski showdown uvek poredi sedam.

## AC21 — button/blindovi

Mesta rastu u smeru poteza. D=button, S=SB pozicija, B=BB; zvezdica je mrtva pozicija
koja ne plaća. U svakom redu svi preživeli imaju dovoljno žetona za blind i nisu fold/all-in.
Kolone pre/post označavaju prvog na potezu, ne pobednika.

| Fixture | Prethodno aktivni; D/S/B | Ispali | Novi D/S/B | Prvi pre / post |
|---|---|---|---|---|
| BL01 | 0,1,2,3,4,5; 0/1/2 | niko | 1/2/3 | 4 / 2 |
| BL02 | 0,1,2,3,4,5; 0/1/2 | 0 (button) | 1/2/3 | 4 / 2 |
| BL03 | 0,1,2,3,4,5; 0/1/2 | 1 (SB) | 1*/2/3 | 4 / 2 |
| BL04 | 0,1,2,3,4,5; 0/1/2 | 2 (BB) | 1/2*/3 | 4 / 3 |
| BL05 | 0,1,2,3,4,5; 0/1/2 | 1,2,3 | 1*/2*/4 | 5 / 4 |
| BL06 | 0,1,3,4,5; 1/2*/3 (posle BL04) | niko | 2*/3/4 | 5 / 3 |
| BL07 | 0,1,2; 0/1/2 | 0 | 2/2/1 | 2 / 1 |
| BL08 | 0,1,2; 0/1/2 | 1 | 2/2/0 | 2 / 0 |
| BL09 | 0,1,2; 0/1/2 | 2 | 1/1/0 | 1 / 0 |
| BL10 | 0,1; 0/0/1 | niko | 1/1/0 | 1 / 0 |

BL02 i BL07 su čisti domenski fixtures sa ljudskim mestom tretiranim kao običan učesnik;
session sloj mora zaustaviti partiju ako je čovek ispao, umesto stvarnog next-hand.
Poseban početni fixture: nova partija sa jednim botom D0/S0/B1, pre0/post1.
Sa dva bota D0/S1/B2, pre0/post1; mesta3–5 nisu deo stola.
Dodati rotacije ovih obrazaca, all-in blind SB3/BB7 uz nominalni minimum10 i proveru
da fold/all-in preskakanje ne preskoči obaveznu odluku ostalih.

## Potovi i pune ruke

AC11: board 2c 3d 7h 9s Jc; A As Ad, B Ks Kd, C Qs Qd;
doprinosi100/250/250 → A300, B300, C0. AC12 koristi isti poredak A/B:
A200/B80 → refund A120 i pot160 A (ukupno A280 vraćenih/isplaćenih žetona).
AC13: D mesto2=C; A mesto0, B mesto1; board As Ks Qs Js Ts;
A2c3d, B4c5d, C fold doprinos5; svi doprinos5 → A8/B7/C0.
Ponoviti split zasebno nad više potova, sa različitim eligible skupovima.

Za AC23: heads-up čovek0 button/SB, bot1 BB. Redosled špila:
Kc, As, Kd, Ah, 6c(burn), 2c, 3d, 7h, 8c(burn), 9s, Tc(burn), Jc.
Deljenje ide BB pa čovek u dva kruga. Čovek call5, bot check; post-flop oba check
na svakoj ulici. Čovek AA dobija pot20; završni stackovi1010/990.
Sledeća ruka: čovek BB plaća10, bot SB5; stackovi1000/985 i doprinosi10/5,
bot je prvi pre-flop. Testira se bez čekanja animacije.
Poseban AC16: početni čovek SB fold → refund BB5 + pot10 botu;
konačni stackovi995/1005; board ostaje prazan.

## Pokrivenost i nivoi provere

| Izvor | Nivo i planirana lokacija |
|---|---|
| AC01, AC02, AC03 | tests/unit/deal.test.ts; tests/contract/config.test.ts |
| AC04, AC05, AC06, AC07, AC08, AC09, AC10 | tests/unit/betting.test.ts; tests/integration/actions.test.ts |
| AC11, AC12, AC13, AC16 | tests/unit/pots.test.ts; tests/unit/hand.test.ts |
| AC14, AC15 | tests/unit/evaluator.test.ts |
| AC17 | tests/unit/bot.test.ts; tests/integration/hand-flow.test.ts |
| AC18 | tests/integration/concurrency.test.ts |
| AC19 | tests/contract/view.test.ts; tests/unit/bot.test.ts |
| AC20, AC21 | tests/unit/positions.test.ts; tests/integration/session.test.ts |
| AC22 | tests/integration/session.test.ts; tests/e2e/recovery.spec.ts |
| AC23 | tests/e2e/play-hand.spec.ts; tests/integration/hand-flow.test.ts |
| FR-017, SC-005 | tests/ui/table.test.tsx; tests/e2e/accessibility.spec.ts + screenshot 1280×720 |
| FR-018, BOT5, ARCH8 | tests/unit/history.test.ts; tests/unit/bot.test.ts; tests/e2e/recovery.spec.ts |

Posle svakog kontrolisanog i generisanog legalnog prelaza proveriti jedinstvenost karata,
očuvanje žetona i legalan actor. Property-style iteracije koriste poznate seed-ove,
ne zamenjuju navedene ručne oracle primere. E2E harness pokreće pravi backend sa
ubrizganim fixture-om u procesu; obična aplikacija nema set-deck endpoint.

