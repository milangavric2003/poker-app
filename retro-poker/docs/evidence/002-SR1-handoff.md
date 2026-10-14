# SR1 — ponovno generisanje AI analize, 2026-10-14

Izmene su na `add-modifications`, početni HEAD `c73ae8c` (merge #8).
Relevantna istorija: `338409b` (Week05 implementacija), `d2909f4`
(T036–T040), `57662f4` (T020–T025), `07f9b1f` (merge AI waiting/analysis).
Git koren je roditelj projekta. Početno nema izmena u projektu; korisnički
neverzionisani HTML i prateći folder u roditelju ostaju netaknuti.
Ponovljiv baseline je HEAD; nema commit-a, push-a ili merge-a.

## Tok i konkretni nalazi

Promena se odnosi na Week04 `AI analiza partije` → `Sažetak`, preko
`POST /api/game/analysis`, ne na Week05 panel `Coaching partije` sa ciljem
i dva modelska koraka. UI i rute su pregledani pre izbora scope-a.

Backend već dozvoljava novi zahtev posle completed/failed, rezerviše novi UUID,
odbija generating pod session lock-om i radi provider await van lock-a.
Fingerprint/abort štite commit; analysis ne povećava poker version.
Prethodna faza prolazi 50/50 fokusiranih testova u 4 fajla:
`npm.cmd test -- tests/integration/ai-analysis.test.ts tests/integration/ai-concurrency.test.ts tests/ui/analysis.test.tsx tests/ui/ai-status.test.tsx`, exit 0.
To potvrđuje pregledane offline scenarije, ne pouzdanost živog Gemini servisa.

Nedostaci:

- Completed AnalysisPanel nema kontrolu za novo generisanje. Refresh sam po sebi
  ne vraća idle: mount GET ponovo čita isti completed backend snapshot. Dakle,
  uzrok nedostupne akcije je UI uslov, ne potreba za restartom backend lifecycle-a.
- acceptsAiSnapshot dopušta stariji analysis UUID zbog same-hand lastBotOutcome;
  ista poker verzija ne razlikuje uzastopna generisanja.
- Kasno odbijeni analysis POST posle unmount-a pokreće recovery GET bez potrebe.

Plan/spec/tasks/HTTP ugovor feature-a 002 dopunjeni su za eksplicitno ponovno
generisanje. Spec Kit prerequisite proverava postojeće artefakte bez menjanja grane;
checklist 26/26 ostaje read-only, extension hooks ne postoje.

## Najmanja ispravka i TDD

AnalysisPanel sada nudi `Generiši analizu ponovo` posle uspeha. Postojeći retry,
sinhroni mutation lock, generating zabrana i read-only polling ostaju.
Polling prihvata trenutni analysis UUID; samo eksplicitni POST/recovery sme da
uspostavi novi identitet za isti game/hand/version. Token/fingerprint sprečava
kasni POST/recovery posle unmount-a ili nove partije; new-game intent poništava
stari poll token. Poker engine, provider, validatori, call limiti i timeout nisu menjani.

Prvi novi lifecycle fixture nije prošao GameView šemu zbog doprinosa igrača.
To je setup neuspeh u [prvom logu](002-SR1-red.txt), osim stvarnog panel RED-a;
ne računa se kao dokaz lifecycle propusta. Fixture je ispravljen, originalni
App/AnalysisPanel iz HEAD-a privremeno vraćeni isključivo za izolovano testiranje,
a pripremljene izmene sačuvane i vraćene u finally bloku.
[Ispravljen RED](002-SR1-red-corrected.txt): 5 FAIL / 7 PASS, exit 1 — missing
completed button, dva stale snapshot slučaja, retry koji prati stari rezultat.
[Unmount RED](002-SR1-unmount-red.txt): 1 FAIL, exit 1 — dva GET-a umesto jednog.
[GREEN](002-SR1-green.txt): 50/50 u 4 fajla, exit 0.

Testovi pokrivaju success→success, failed→success, jedan POST pri duplom kliku,
stari generating/completed/failed snapshot, prestanak pollinga, new-game intent,
unmount, backend odbijanje paralelnog zahteva i read-only rezultat.
[Nezavisni holdout](002-SR1-holdout.txt): 22/22, exit 0; timed-out provider rezultat
posle novijeg completed ne menja analizu niti broj logičkih interakcija.

## Završne provere

Node `24.20.0`, npm `11.19.0`, Windows PowerShell.

| Komanda | Stvarni rezultat | Dokaz |
|---|---|---|
| `npm.cmd test` | 898/898, 62 fajla, exit 0 | [final](002-SR1-regression-final.txt) |
| `npm.cmd run test:e2e -- tests/e2e/ai-offline.spec.ts` | 1/1, exit 0 | [browser](002-SR1-browser.txt) |
| `npm.cmd run test:e2e` | 13/13, exit 0 | [E2E regresija](002-SR1-e2e-regression.txt) |
| `npm.cmd run typecheck` | exit 0 | [typecheck](002-SR1-typecheck-final.txt) |
| `npm.cmd run lint` | exit 0 | [lint](002-SR1-lint-final.txt) |
| `npm.cmd run build` | exit 0 | [build](002-SR1-build.txt) |
| `git diff --check` | exit 0 | [diff provera](002-SR1-diff-check.txt) |

Browser fake scenario radi failure→success→success sa jednom navigacijom,
tačno tri analysis POST-a i tri logičke interakcije; nova uspešna analiza ima
novi UUID i drugačiji prikazani sažetak. Igrači, žetoni, game/hand/version i rezultat
ostaju isti. Nema reload-a ni automatskog generisanja. Test helper podržava slobodan
loopback port; samo izolovani proxy mapira Origin na već propisani test Origin,
produkcioni Origin validator nije menjan. Pre pune E2E provere portovi 5173/3001
nisu zauzeti; nije zaustavljen, restartovan ili rekonfigurisan korisnikov dev server.
E2E prikazuje bezazlen NO_COLOR/FORCE_COLOR warning, ne test failure.

Ograničenja: bez stvarnih Gemini poziva (0 API budžeta), bez merenja kvaliteta modela
i bez novog ljudskog peer review-a. Coaching completed dugme ostaje zaseban postojeći
tok; njegova regresija prolazi. Nestanak backend memorije i dalje zahteva novu partiju.
Izmene ostaju u radnom stablu za pregled; istorijski dokazi nisu prepisani.
