# Zahtev za spajanje recovery grane — 2026-09-29

Korisnik je izričito odobrio merge `fix-timeout-error` u `ai-integ` sa rešavanjem
konflikata. Sa fix grane treba sačuvati rad botova i sve ostale popravljene bagove;
sa `ai-integ` sačuvati vidljivo čekanje na AI odgovor, nastavak poteza po završetku
čekanja i postojeću implementaciju analize. Ako ostane nejasna odluka, pitati.

Plan: pregled oba roditelja i čistog radnog direktorijuma; merge bez automatskog
commita; usklađivanje konflikata i ugovora između grana; fokusirana regresija,
typecheck/lint/build i browser provera; evidence i lokalni merge commit.

Kriterijum: Gemini nullable bot transport radi sa novijim decision identitetom;
čekanje i analysis tok ostaju pokriveni; dijagnostika prolazi backend/frontend
validaciju; očuvana istorija obe grane. Lokalni `.env` ostaje van commita.
Novi live pozivi i push nisu deo ovog merge-a. Rezultati:
[002-merge-recovery.md](evidence/002-merge-recovery.md).
