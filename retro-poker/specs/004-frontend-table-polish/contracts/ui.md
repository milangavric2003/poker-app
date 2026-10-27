# UI ugovor

PlayingCard: `card: string | null`; null daje samo neutralnu poleđinu bez
stvarnog rank/suit sadržaja/atributa/tooltip-a. Javna karta ima čitljiv naziv.
ChipAmount: `amount: number`, `label: string`; broj uvek vidljiv, reprezentativni
čipovi aria-hidden, najviše 5. Pot region „Ukupni pot”; board „Board”.
PlayerSeat: postojeći GameView player i javne pozicije; članak ima ime/mesto,
tekstualne statuse i oznake. Backend/API ostaju nepromenjeni.
