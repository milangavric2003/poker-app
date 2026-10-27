# Feature Specification: Uglađen poker interfejs

**Feature Branch**: `add-modifications`  
**Created**: 2026-10-14  
**Status**: Spremno za implementaciju  
**Input**: Privatni nastavak posle završenog Week05: karte, čipovi i responzivan sto.

## User Scenarios & Testing

### US1 — Čitljive i bezbedne karte (P1)

Igrač prepoznaje svoje i zajedničke karte, a protivničke ostaju skrivene.
Nezavisna provera: javni snapshot sa praznim/punim board-om i desetkom.

1. Vidljive karte imaju rang/simbol u oba ugla, centralni simbol i naziv boje; T se prikazuje kao 10.
2. Bot bez javnih karata ima dve poleđine nazvane „Skrivena karta”, bez stvarnog ranga/boje u sadržaju ili atributima.
3. Foldovane i eliminisane karte ne otkrivaju se; koristi se isključivo javni pogled (AC19).

### US2 — Iznosi i statusi za stolom (P1)

Igrač jasno razlikuje preostali stack, ulog faze i pot. Nezavisna provera:
snapshot sa 0/6000 žetona, side potom, refund-om i svim statusima.

1. Tačan iznos je uvek vidljiv; dekorativni čipovi imaju apoene ali ne obećavaju tačan zbir.
2. Najviše pet čipova po iznosu; nula nema čipove. Čitač ekrana ne čita dekoraciju.
3. Aktivni igrač, Button, SB/BB, Fold, All-in i Eliminisan imaju tekstualne oznake.
4. Potovi i refund prate postojeće podatke (R6, AC11–AC13, AC20–AC21).
   Prvi zajednički pot ima oznaku „Glavni pot”, naredni „Side pot”; sloj sa
   jednim contributor-om nosi „Nepotvrđen ulog”. ID i iznos ostaju vidljivi.

### US3 — Dostupna igra i analiza (P1)

Igrač prati 1–5 botova na desktop-u i mobilnom uređaju. Nezavisna provera:
1280×720 i 390×844; tastatura, reduced-motion i offline summary/coaching.

1. Sto je ovalan na desktop-u, board/pot u centru, čovek pri dnu; mesta i akcije se ne preklapaju.
2. Mobilni raspored menja strukturu stola; nema horizontalnog scroll-a stranice.
   Kontrole poteza dolaze odmah iza stola/korisnikovog mesta, pre istorije.
3. Kontrole, istorija, rezultat, summary, coaching i usage imaju skladan stil i ostaju dostupni.
4. Summary se ponovo generiše bez navigacije; usage osvežava summary/coaching podatke kao ranije.

## Requirements

- **FR-001**: Dosledne čitljive karte, boje, zaobljenje, senka i bezbedna poleđina (US1).
- **FR-002**: Ograničena dekoracija čipova sa označenim apoenima i autoritativnim iznosom (US2).
- **FR-003**: Responzivan sto, jasno označeni statusi i pozicije (US2/US3).
- **FR-004**: Vidljiv fokus, semantika, kontrast i reduced-motion (US3).
- **FR-005**: Sačuvani poker/API/AI tokovi; offline provere bez stvarnog Gemini poziva (ARCH1–ARCH8, AC19, AC23).

### Key Entities

Javna karta ili poleđina; dekorativni čip; javno mesto igrača; board; postojeći pot.
Nema novog izvora podataka ili obračuna poker rezultata.

### Edge Cases

1/5 botova; početak/fold/all-in/eliminacija/završetak; board 0–5; iznos 0/6000;
side pot i refund; otkrivene karte samo iz javnih podataka; dug tekst u panelima.

## Success Criteria

- **SC-001**: Sve karte i iznosi čitljivi; skrivena karta ne otkriva privatne podatke.
- **SC-002**: Na obe ciljane veličine nema preklapanja mesta, board-a i kontrola ili horizontalnog scroll-a.
- **SC-003**: Postojeće funkcionalne provere i nove semantičke provere prolaze; typecheck/lint/build uspešni.
- **SC-004**: Screenshotovi pre/posle i stvarni rezultati u zasebnom feature direktorijumu.

## Assumptions

Week05 je završen i istorijski dokazi ostaju očuvani. Pravila ostaju ista.
Nema pouzdanog podatka za isticanje pobedničkih pet karata: takvo isticanje se ne dodaje.
Dekorativna gomila je reprezentativna; tačna numerička vrednost određuje stanje.
