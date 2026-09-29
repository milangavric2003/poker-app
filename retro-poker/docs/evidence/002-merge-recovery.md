# Merge Gemini recovery u ai-integ — 2026-09-29

## Odobrenje i obim

Korisnik je odobrio lokalni merge `fix-timeout-error` u `ai-integ`, rešavanje
konflikata i očuvanje bot popravki i drugih bagfix-eva iz recovery grane,
uz waiting UI i postojeću analizu iz `ai-integ`.

Roditelji: `ai-integ` na `c6f6bb3`, `fix-timeout-error` na `757faed`.
Radni direktorijum bio je čist. Git merge je prijavio 10 konfliktnih fajlova.
Nije rađen push, nije menjan lokalni `.env` i nisu izvršeni live provider pozivi.

## Odluke pri spajanju

- Zadržan ravni Gemini transport sa nullable `amountTo`, instrukcijama i
  normalizacijom samo null iznosa za fold/check/call/all_in. Lokalna JSON/Zod
  validacija i poker engine ostaju strogi. Transport sada zahteva i kopira
  `decisionOrdinal` koji noviji `ai-integ` koristi protiv zastarelih predloga.
- Zadržan recovery profil: `GEMINI_MAX_ATTEMPTS` 1–2, bot total 12–35 s i
  attempt do 30 s. Default ostaje dva pokušaja, 5 s po attempt-u i 12 s total.
  Sačuvane su rezerve od 500/1000 ms, `Retry-After` i progress callback-ovi.
  Jedan pokušaj je odobrena promena u odnosu na istorijski T005 fixed-two ugovor;
  config test i quickstart sada dokumentuju aktuelno ponašanje.
- Zadržani `ai-integ` App/polling, ActionPanel, AnalysisPanel i session tokovi.
  Analiza je dostupna za završenu partiju po postojećem uslovu; merge ne menja
  njenu dostupnost u analizu posle svake pojedinačne ruke.
- Zadržani bezbedna provider dijagnostika, `invalid_request`, CLI provere i
  `cards: null` za eliminisane igrače. Diagnostic polje je dodato u zajednički
  `UsageResponseSchema`, uz postojeću obaveznu usage validaciju i safe-integer
  zaštitu metrika. Nije vraćena stara duplirana frontend šema.
- Evidence i logovi obe grane su sačuvani. Raniji live uspeh iz recovery grane
  ostaje istorijski dokaz; nije pripisan ovom merge-u.

## Izvršene provere

1. Posle tekstualnog spajanja i usklađivanja fixture identiteta:
   `npm.cmd test -- tests/integration/gemini-http.test.ts tests/unit/ai-provider-schema.test.ts tests/unit/ai-slow-profile.test.ts tests/unit/ai-config.test.ts`
   — exit 1, 27 passed / 3 failed. Stvarni padovi: transport nije zahtevao
   `decisionOrdinal`; frontend je odbijao diagnostic polje za bot i analysis.
2. Posle korekcije transporta i zajedničkog ugovora, isti skup proširen sa
   `gemini-live-smoke`, `gemini-adapter` i UI `ai-status/actions/analysis/api/dashboard`
   — exit 0, 11 fajlova, 94/94 testa.
3. Prva puna regresija — exit 1, 535 passed / 1 failed. Test stare strukture šeme
   pretpostavljao je root properties/required umesto action-specific anyOf grana.
   Usklađen je da obe grane budu strict i obe zahtevaju `decisionOrdinal`.
   Typecheck je prijavio isti zastareli pristup `.required`; nije bilo druge greške.
4. Završni `npm.cmd test` — exit 0, 42 fajla, **536/536**.
5. `npm.cmd run typecheck` — exit 0.
6. `npm.cmd run lint` — prvi prolaz exit 1 zbog preloma `it.each` poziva;
   posle format korekcije exit 0.
7. `npm.cmd run build` — exit 0, Vite 120 modula i server TypeScript build.
8. `npm.cmd run test:e2e` — exit 0, **10/10 Chromium** testova. AI browser scenario
   proverava vidljiv indikator čekanja, model outcome, analysis failure i ručni
   retry, strukturisanu analizu i dashboard, uz očuvanje poker rezultata.

Gemini HTTP testovi presreću fetch i koriste lažni ključ; smoke runner je proveren
sa presretnutim HTTP 200/503 i stvarnim aplikacionim rutama. Pokrivene su i odsutna
i zastarela vrednost `decisionOrdinal`. Browser koristi fake provider.
Ove provere potvrđuju lokalnu integraciju i regresiju, ne trenutnu dostupnost
Gemini servisa. Novi uspešan live poziv posle merge-a nije proveravan.

Rad je izvršio jedan coding agent. Korisnik je odredio prioritete grana i odobrio
merge; dodatni ljudski review nije tvrđen.
