# T027 — zajednička proba i završni handoff

**Završeno 2026-10-06:** obojica su, prema korisnikovoj potvrdi, prošli objašnjenje
cilja, alata, validacije, limita i razloga zaustavljanja. Doprinos je dokumentovan
pregledom commitova obe navedene grane. T027 je zatvoren; završni paket je spreman
za predaju/demo. [Doprinos i Git dokaz](003-T027-contributions.md).

Datum: 2026-10-06, Europe/Belgrade. Tehnički paket: commit `a483ffc`
(`Implement T033-T035 enhancements for Gemini transport and evidence selection`).
Na početku ovog dokumentacionog koraka radno stablo bilo je čisto.

## Potvrđeno od korisnika

Korisnik navodi: „probali smo kolega i ja, trebalo bi da radi sve“ i pita da li
time završava ljudski walkthrough. Zabeležena je zajednička ručna proba aplikacije
posle T033–T035 i korisnikov utisak da sve radi. Oba člana imaju potvrđen doprinos
u zajedničkom testiranju. Broj partija, tačni ciljevi, run ID-jevi i datum/vreme
same probe nisu navedeni; datum ovog zapisa jeste datum prijave.

Naknadna potvrda korisnika: obojica su prošli objašnjenje cilja, alata, validacije,
limita i razloga zaustavljanja coachinga; obojica su upućeni u sve. Korisnik je
naveo identitete milangavric2003 i Veki i uputio na dve grane za individualni doprinos.
Pregled je završen i dokumentovan u povezanom doprinosu iznad. Ovo zatvara ljudski
walkthrough i projektni handoff; nije potvrda formalne predaje predavaču.

## Kratak walkthrough za oba člana

Svako može svojim rečima da prođe sledeći tok, uz
[pripremljen demo](003-T027-demo.md):

1. Cilj: coaching završene partije, prema izabranom fokusu; savet ne menja poteze,
   žetone ili rezultat i koristi raspoložive činjenice.
2. Prvi modelski korak predlaže `get_decision_evidence`. Backend proverava ime
   alata, argumente, fokus i limite pre izvršenja. Odbijen predlog ne izvršava alat.
3. Alat vraća proverene činjenice iz iste partije. Drugi korak bira numerisane
   dokaze; Gemini adapter prenosi originalne reference, factCode i finding.
4. Strict runtime provera odbija pogrešnu strukturu, nepoznata polja, duple ili
   nepostojeće dokaze. Final mora odgovarati izvornim činjenicama; validacija se
   ne preskače kada model greši.
5. Run ima najviše dva modelska koraka, jedno izvršenje alata i četiri provider
   pokušaja, timeout do 15 s po pokušaju i ukupan rok 45 s. Novi game/stale/cancel
   prekida objavu starog rezultata. Live eval koristi stroži limit dva zahteva,
   bez retry-ja/fallback-a. Limit RPM nije isto što i limit jednog run-a.
6. Doprinos: Veki je autor početnog Week05 paketa od scope-a do agent/API/UI/evidence;
   milangavric2003 je autor live smoke i kasnijih coaching/Gemini popravki. Detalji
   i granica između commit autorstva i Codex pomoći su u doprinosu iznad.

## Paket spreman za preuzimanje

- [Tehnički rezultat i ograničenja](003-T035-handoff.md): 888 offline testova,
  typecheck/lint/build uspešni; browser E2E nije ponovljen u T035 sesiji.
- [Safe live dokaz](003-T035-live.json): 48 od 50 odobrenih zahteva, samo Flash
  Lite, poslednja matrica 9/9; 24/24 read-only provera.
- [Week05 evidence](../EVIDENCE_W05.md), [usage](../AI_USAGE_LOG.md) i
  [task lista](../../specs/003-week05-bounded-agent-coach/tasks.md).

Sledeći korak je koristiti završni paket za predaju/demo. U postojećoj feature003
task listi nema otvorenih stavki; nova funkcionalnost nije preduslov handoff-a.
Ovaj korak menja samo dokumentaciju; nema novih modelskih poziva, testiranja
aplikacionog koda, restart-a, commit-a, push-a ili objavljivanja.

[Završna dokumentaciona provera](003-T027-human-final-doc-check.txt): lokalni
linkovi postoje, commit autorstvo provereno, feature003 nema otvorenih taskova.
