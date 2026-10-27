# Podaci prikaza

Jedini ulaz: postojeći GameView. PlayerSeat koristi player.id/seat/kind/stack/
streetContribution/status/cards i javni actorId/pozicije. Status enum:
active/folded/all_in/eliminated; cards javni par ili null. PlayingCard dobija
validiran javni kod karte ili null. ChipAmount dobija nenegativan celobrojni
iznos (postojeći ugovor max 6000). Dekoracija najviše 5 čipova, nula bez čipova.
Nema novog storage-a, poker obračuna ili prelaza stanja.
