# Gemini dijagnostika i oporavak — 2026-09-28

Korisnik je tražio da preuzmemo dijagnostiku posle neuspelog Luna pokušaja.
Scope: utvrditi stvarni HTTP razlog, popraviti dijagnostiku i pokriti SDK transport
offline testom. Ne menjati modele/retry budžete nagađanjem. Jedan agent.

Acceptance:
- Google 503/UNAVAILABLE/high demand ostaje server_error i dobija bezbedan,
  konačan opis u usage dashboard-u; raw error i tajne nisu javni.
- HTTP 400/404 ostaje invalid_request, odvojeno od autentikacije.
- Stvarni SDK u offline testu koristi presretnuti fetch, produkcionu JSON šemu,
  jedan HTTP pokušaj; test proverava validan odgovor i stvarni oblik API greške.
- Dijagnostička skripta prekida na neuspehu, vraća nonzero exit code i proverava
  sadržaj odgovora pre SUCCESS. Bez eksplicitnog opt-in nema mreže.
- Najviše pet novih generation pokušaja; eksterni neuspeh ne postaje PASS.

Plan: HTTP dijagnostika → RED regresioni testovi → minimalna popravka → GREEN,
typecheck/lint/build → dokumentovan live nalaz i preostala prepreka.
Week04 requirements checklist: 26/26; Spec Kit prerequisite automatski bira stari
001 feature prema grani, zato se ovaj odobreni bugfix eksplicitno odnosi na 002.

## Nastavak 2026-09-29: Lite sporiji profil i live uspeh

Korisnik je odobrio nastavak implementacije nakon pregleda timeout-a i kvota.
Scope dopunjen: eksplicitni bot profil 30 s attempt / 35 s total, Lite primarni,
jedan pokušaj; ravna Gemini transport šema uz strogu lokalnu validaciju; popravka
terminalnog snapshot-a; opt-in runner sa bot commit/read-only analysis uslovima.
Dokaz: docs/evidence/002-gemini-lite-success.md. Default 5/12 s profil ostaje.
Raniji limit pet poziva odnosio se na prethodni dijagnostički blok. U nastavku
je izvršeno osam generation poziva; nema dodatnog automatskog ponavljanja.
