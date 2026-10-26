# Faza 2 — ulazi i očekivanja

Datum 2026-10-26; checkpoint `d08e06c95f8051e12e15a8e80e9d950de5b3333b`,
grana `week08-init`, početno stablo čisto. Driver: Codex u sesiji sa Vekijem.
Bez ljudskog peer review-a i bez live provider-a.

Ulazi su u `tests/helpers/security-fixtures.ts` (securityInputs), fake odgovori
u postojećem `fake-ai-provider.ts`. Identifikatori partije/ruke su serverski UUID-i;
pri svakom ponavljanju vežu se za tekuću sintetičku partiju, nisu poker oracle.

- T00: jedan bot, fiksni špil As/Kc/Ah/Kd + ac23Deck od indeksa 4, bot RNG 0.9,
  lokalni bot, čovek all_in; terminal lost, stackovi [0,2000]. Street goal,
  agent_tool → agent_final; 202, completed, 2 model poziva/1 stvarni executor,
  validan evidence i identično kanonsko poker stanje/facts/istorija/verzija.
  Run i usage brojači proveravaju se odvojeno.
- T07: shell/constructor/toString, isti validni args street/10; unknown_tool,
  provider 1/tool 0 i nepromenjeno poker stanje. Zatim dozvoljen tool/final:
  completed, kumulativno provider 3/tool 1. Očekivanje postojeće zaštite PASS.
- T13: novi uzastopni završeni run-ovi u fake vremenima 0/1000/2000/3000/4000/5000 ms.
  Prvih pet 202, šesti 429 AI_RATE_LIMITED; accepted 5/provider 10/tool 5.
  Svaki run završi pre narednog POST-a, jedinstveni ID-i isključuju pending dedupe.
  Očekivan RED ako nedostaje rate kontrola; nije puna concurrency/recovery matrica.
- T16: stvarni npm build + Vite preview iz vite.config.ts, fake backend 3001,
  frontend 5173. Drugi loopback origin, /security-probe.js → 200 i marker
  __w08ScriptExecuted. Kontrolna browser stranica bez CSP mora izvršiti isti script.
  Normalna app stranica kreira igru i prikazuje Call 5. Na app stranici script
  mora biti blokiran, marker false, enforce script-src violation sa tačnim URL-om,
  bez dodatnog script HTTP zahteva. bypassCSP se ne uključuje. Očekivan RED
  ako produkciona politika nedostaje. Sentinel/coaching/mobile deo je kasniji scope.

Prvi izvršeni node testovi imali su setup greške: pogrešan won/[2000,0] oracle i
structuredClone tool kontrola koje sadrže funkciju. Izlaz je sačuvan u
`005-phase2-security-first.txt`; nije security RED. Oracle je ispravljen prema
postojećem lifecycle fixture-u (lost: deljenje počinje od sledećeg sedišta;
bot dobija As/Ah, čovek Kc/Kd), instrumentacija sada beleži poziv bez kloniranja
funkcije. Ponovljeni run je `005-phase2-security-baseline.txt`.
Prvi production pokušaj pada na pogrešnom nazivu dugmeta All-in umesto All in 1000;
zamenjen proverenim Call 5 pozitivnim kontrolnim signalom. Nije security RED.
Prvi typecheck otkrio je prošireni string[] tip špila; dodat as const.
Nijedna runtime kontrola nije menjana.
