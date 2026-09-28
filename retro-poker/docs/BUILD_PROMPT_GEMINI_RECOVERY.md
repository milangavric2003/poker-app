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
