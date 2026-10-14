# Sačuvan implementacioni zahtev — 2026-10-14

Korisnik traži implementiran privatni frontend redizajn Retro Poker-a posle završenog
Week05 na postojećoj add-modifications grani. Sačuvati lokalne izmene, pročitati
pravila/kod i proveriti prethodne summary regeneration i AI usage promene pre koda.
Vizuelni cilj: tamna pozadina, zeleni filc, jasna ivica, čitljive karte sa uglovima i
poleđinama bez privatnih podataka, ograničeni dekorativni čipovi sa apoenima i tačnim
iznosima. Sto za human+1–5 botova; human dno, centriran board/pot, tekstualni statusi,
mobilni raspored, dostupne kontrole i usklađeni rezultat/istorija/AI paneli.
Koristiti React/TS/CSS, javni GameView, bez velike biblioteke ili novih asset servisa.
Ne menjati engine/API/AI; ne pozivati stvarni Gemini; ne prekidati aktivni dev server.
TDD za ponašanje, stvarne provere za CSS, screenshotovi pre/posle odvojeno od Week05.
Pokrenuti UI/E2E/typecheck/lint/build. Bez commit/push/merge. Plan i kriterijumi u
spec.md/plan.md; nema potrebnih produktnih razjašnjenja. Trošak/model potrošnja nepoznati.
