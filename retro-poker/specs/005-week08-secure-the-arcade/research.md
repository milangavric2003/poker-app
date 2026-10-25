# Odluke i razmotrene alternative

2026-10-25. Osnova: lokalni Week08 MD materijali, source/testovi, AGENTS i constitution.

| Odluka | Razlog | Alternativa |
|---|---|---|
| W05 coaching | Dva model koraka i stvaran read-only alat | Week04 summary sam ne ispunjava taj uslov |
| Zadržati privatne dorade | Korisnik potvrđuje week08-init osnovu | Povratak na main gubi novi frontend i summary/usage dorade |
| Selektivni review test/CI prenos | Ne menja runtime i ne prepisuje istorijske dokumente | Merge cele review grane nepotrebno meša W05 evidence |
| Procesni gate i lease do settle | Otkazano čekanje nije nužno završen posao | UI disable, rate limit ili race sami ne ograničavaju fizički rad |
| Postojeći single-user model | Nema naloga ni privatne multi-user arhive | Login/x-user-id proširuje scope ili lažno dokazuje auth |
| Plain text i preview zaglavlja | Postoji odgovarajuća lokalna production putanja | Ne dodavati Markdown/sanitizer radi testa |
| Bounded memorijski security sink | Dokaziva minimizacija/retention bez infrastrukture | Raw logovi i javni log endpoint povećavaju izloženost |
| Fake provider i SDK mock | Ponovljivi malicious/timeout/error scenariji | Live uzorak nije W08 zahtev niti dokaz granica |

Audit, efektivni CSP uz CSS i clean checkout ostaju izvršne provere, ne nerazjašnjene
produktne odluke. Granice su izabrane u planu. PDF/PPTX su prema README-u paralelna
izdanja; za dizajn su korišćeni MD zadatak, šablon i materijali obe sesije.

Tehničko poreklo iz §11 zadatka:
- [OWASP API4](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/): potrošnja resursa.
- [OWASP CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html): aktivna politika.
- [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): minimizacija i log injection.
- [MDN AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController): prekid podržanih operacija.
- [Vite env](https://vite.dev/guide/env-and-mode): klijentski env/bundle granica.

Prva tri izvora pregledana su tokom prethodne analize ove konverzacije;
ostala dva su reference zadatka, ne novi web audit u ovoj pripremi.
