# Eval — očekivanja pre implementacije

Status: nema pune aplikacije ni integrisanog baseline-a. Nijedan demo eval nije pokrenut.

| ID | Scenario | Očekivanje | Baseline / posle |
|---|---|---|---|
| E1 | Kontrolisana puna heads-up ruka AC23 | Stackovi1010/990; sledeća ruka čuva ukupno2000 | Nije pokrenuto |
| E2 | Konfiguracije1 i5 botova | Dva/šest igrača i ukupno2000/6000 | Nije pokrenuto |
| E3 | Nevalidna konfiguracija i check uz dug | Odbijanje, nema mutacije postojeće partije | Nije pokrenuto |
| E4 | Stvarni propust integrisanog baseline-a | Očekivanje će biti zapisano kada se nalaz stvarno pojavi | Nije odabran |

Contract i betting unit testovi su lokalne provere, ne dokaz kompletnog E1–E4.
Holdout će reviewer odabrati nezavisno i pre ciljane dorade.
Ne izazivati bug radi E4; red test nedostajuće funkcionalnosti nije automatski baseline bug.

