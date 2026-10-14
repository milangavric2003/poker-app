# Privatni frontend 004 — provere i handoff, 2026-10-14

## Baseline i obim

Grana `add-modifications`; HEAD `9a6263a2301bef480badd0bedd187874a908539d`.
Početni Git status čist; nema lokalnih izmena koje bi trebalo izdvajati/stash-ovati.
Git koren `D:/AIBootcamp/week3-4`, projektni koren `retro-poker`.
Pregledane prethodne izmene `f900fa2` (summary regeneration) i `9a6263a`
(summary/coaching usage), njihov App/dashboard kod, handoff i regresioni testovi.
Baseline je ponovljiv preko HEAD-a; sačuvane četiri pre slike istog offline špila.
Kod engine-a, API ugovori i AI orkestracija nisu menjani. App dobija samo wrapper.
Week05 feature/dokazi i ranije slike nemaju završni diff. Nema commit/push/merge.

## Promena i kriterijumi

PlayingCard: javni rank/suit naziv, 10 umesto T, oba ugla, centralni simbol,
crvene/tamne boje, zaobljenje i senka; null grana daje neutralnu RP poleđinu.
PlayerSeat: ime, javne pozicije, Button/SB/BB i tekstualni statusi; human dno.
ChipAmount: tačan broj uvek vidljiv; najviše pet dekorativnih čipova po iznosu,
apoeni 1/5/25/100/500/1000, aria-hidden, nula bez gomile. Legenda eksplicitno
kaže da je prikaz ilustracija. Prikaz ne računa novu raspodelu žetona.
Table: filc, ivica, centralni board/pot i javni slojevi pota; postojeći ID/iznos
ostaju, dodate oznake glavni/side/nepotvrđen ulog. Refund ostaje u istoriji i rezultatu.
Postavljeni blind iznos čita se iz javnog događaja kada postoji; stari snapshot
fallback ostaje za pogled bez blind događaja. Nema promene engine obračuna.
CSS: tamna pozadina, retro naslovi, sans-serif tekst/brojevi, ujednačeni paneli,
fokus i reduced-motion. Desktop ima ovalan sto; mobilni dva stupca mesta,
human poslednji i kontrole neposredno iza stola, pre istorije.

## Stvarne komande i rezultati

Node v24.20.0, npm 11.19.0. Svi navedeni GREEN završeci imaju exit 0.

| Provera | Rezultat | Log |
|---|---|---|
| Baseline `npm.cmd test -- tests/ui tests/integration/ai-analysis.test.ts tests/integration/coach-lifecycle.test.ts tests/unit/ai-usage.test.ts tests/unit/coach-usage.test.ts` | 159/159, 15 fajlova | baseline-tests.txt |
| Baseline E2E table-polish/ai-offline/coach | 8/8 | baseline-e2e.txt |
| RED table semantika | 3 očekivana pada, 3 stare provere prolaze, exit 1 | red-valid-fixtures.txt |
| GREEN table semantika | 6/6 | green.txt |
| RED oznake potova | 1 očekivan pad, 6 prolazi, exit 1 | pot-labels-red.txt |
| `npm.cmd test` | 906/906, 62 fajla | final-tests.txt |
| `npm.cmd run test:e2e` | 19/19 | final-e2e.txt |
| RED mobilni redosled kontrola | 2 očekivana pada geometrije, exit 1 | mobile-actions-red.txt |
| Posle markup/CSS dorade `npm.cmd test -- tests/ui` | 121/121, 11 fajlova | final-ui-refined.txt |
| Ponovljena cela E2E suite posle dorade | 19/19 | final-e2e-refined.txt |
| Završni table-polish E2E, uključujući dodatnu side pot proveru | 6/6 | final-layout.txt |
| Završni ai-offline/coach, sa desktop/mobile panelima | 4/4 | final-ai-panels.txt |
| `npm.cmd run typecheck` | uspeh, exit 0 | typecheck-final.txt |
| `npm.cmd run lint` | uspeh, exit 0 | lint-final.txt |
| `npm.cmd run build` | frontend/backend uspeh, exit 0 | build.txt |
| `git diff --check` | exit 0 | diff-check.txt |

Prvi pokušaji novih UI testova (`red.txt`, `red-corrected.txt`) imali su cleanup i
nevalidne fixture greške; nisu TDD dokaz. Popravljeni su pre implementacije;
`red-valid-fixtures.txt` ima isključivo očekivane padove nedostajućeg prikaza.
Prvi browser prolaz (`layout-first.txt`) našao je kontrole ispod 720 px; dorada
rasporeda to rešava, sa očuvanim assertion-om u accessibility testu.
`layout-fixtures.txt` ima padove focus-visible provere posle mouse interakcije;
test sada ulazi u tastaturni modalitet Tab/Shift+Tab i proverava stvarni fokus.

Početni pokušaj logovanja bez evidence direktorijuma nije pokrenuo testove.
Spec Kit PowerShell skripte prvo su odbijene execution policy-jem; ponovljene sa
process-only `-ExecutionPolicy Bypass`, bez trajnog menjanja podešavanja.
Setup script BRANCH vrednost je feature kontekst; stvarna Git grana ostaje
add-modifications. Extensions hook-ovi ne postoje. Checklist zahteva: 6/6.
Legacy accessibility screenshot je tokom prvog prolaza zapisan na staroj putanji;
odmah je vraćen byte-for-byte iz HEAD-a read-only `git show` + binary write
(git restore nije mogao da dobije index lock). Oba legacy screenshot test mesta
sada pišu u ovaj feature. Završni diff potvrđuje da istorijske slike nisu promenjene.

## Pokriveni scenariji i screenshotovi

Playwright Chromium sa pravim lokalnim Vite/Fastify serverima i offline/fake
provider-ima: 1 i 5 botova, početak, aktivna ulaganja, call/check/fold/all-in,
showdown/nastavak ruke, prazan/pun board, summary retry/regeneration bez reload-a,
coaching uspeh/greške i automatsko usage osvežavanje/reset. Sačuvani postojeći
funkcionalni assertion-i; screenshot putanje jedina izmena u legacy game testovima.

Novi table testovi proveravaju geometriju mesta/board-a/akcija, odsustvo horizontalnog
scroll-a, Tab fokus/outline, reduced-motion i broj poleđina. UI test proverava da
neutralna poleđina ne sadrži rang/boju u DOM sadržaju ili atributima i da dekorativni
čipovi ostaju bounded i aria-hidden. Semantičke oznake ne zavise samo od boje.

Veliki pot 5999, stack 6000, kombinovani fold/all-in/eliminacija i refund koriste
posebne strict GameViewSchema-validirane javne sintetičke browser fixture-e.
To je dokaz prikaza, ne nova tvrdnja o engine prelazu između ta dva fixture-a.
Postojeći pots/engine testovi i realni hand E2E ostaju autoritet za obračun.

Sve slike su u ovom direktorijumu:

- `before-{1280,390}-{1,5}bots.png`: četiri baseline slike.
- `after-{1280,390}-{1,5}bots.png`: ista četiri scenarija nakon redizajna.
- `after-{1280,390}-river-statuses.png`: pun board i javni statusi.
- `after-{1280,390}-6000-stack-refund.png`: nula pot, veliki stack i rezultat/refund.
- `after-accessibility-1280x720.png`, `after-showdown-1280x720.png`.
- `after-summary-usage-{1280,390}.png`, `after-coach-usage-{1280,390}.png`.

Slike stvarno otvorene lokalnim view_image alatom: baseline desktop sa pet botova,
novi desktop i mobilni sa pet botova, mobilni river/statusi i stack/refund,
mobilni summary/usage i desktop coach/usage. Ostale slike generisane Playwright-om;
automatizovane geometrijske provere pokrivaju obe ciljane širine.

## Konvergencija i ograničenja

Pregled FR-001–005, SC-001–004, tri priče i njihovih 11 acceptance scenarija,
pet plan faza i sedam constitution principa: nema preostalog buildable jaza.
Prerequisites skripta nalazi novi spec/plan/tasks i prateće artefakte. T001–T010
imaju dokumentovan dokaz; nema novih convergence taskova.

Browser alat nije dostupan; pregled rađen Playwright-om i view_image-om.
Firefox/WebKit i fizički mobilni uređaj nisu testirani; nije izvršen ručni čitač
ekrana ili formalni audit kontrasta. Tastatura/ARIA/privatnost i reduced-motion
provereni navedenim testovima. Pobedničke karte nisu dekorativno istaknute jer
postojeći ugovor ne identifikuje pouzdano pobedničkih pet. Čipovi su reprezentativni.
Nijedan stvarni Gemini poziv nije izvršen. Korisnički dev server/partija nisu
prekidani; testovi zatvaraju sopstvene servere. Codex je implementirao/proverio;
ljudski pregled i doprinos kolege u ovoj sesiji nisu potvrđeni. Izmene su spremne
za pregled na add-modifications.
