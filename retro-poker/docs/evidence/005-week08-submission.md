# Week08 — paket za predaju i prezentaciju

2026-10-27, Europe/Belgrade. **Implementacija, Git isporuka, CI i dokumentacioni
paket su završeni. Vedran i Milan su lokalno isprobali aplikaciju i demo zasebno
i zajedno i spremni su za prezentaciju 28.10.** To je korisnik potvrdio u razgovoru
27.10; formalni osamominutni demo i individualna odbrana još nisu izvedeni.

## Linkovi za predaju

| Artefakt | Link |
|---|---|
| Projekat i aktuelna dokumentacija | [main](https://github.com/milangavric2003/poker-app/tree/main) |
| Proveren tehnički checkpoint | [c5038bb04ef442032d7b20a94e0300a9c774dd71](https://github.com/milangavric2003/poker-app/commit/c5038bb04ef442032d7b20a94e0300a9c774dd71) |
| Glavni dokaz | [EVIDENCE_W08.md](../EVIDENCE_W08.md) |
| Zahtev → kontrola → test → rezultat, I1–I8/T00–T17 | [završna matrica](005-phase7-matrix.md) |
| Doprinosi Vedrana i Milana | [Git dokaz i potvrda](005-week08-delivery.md) |
| Završni Week08 merge | [PR #11](https://github.com/milangavric2003/poker-app/pull/11) |
| Milanova završna dorada | [PR #12](https://github.com/milangavric2003/poker-app/pull/12) |
| Hosted CI proverenog main commita | [40558876322 — Windows i Linux PASS](https://github.com/milangavric2003/poker-app/actions/runs/40558876322) |

Commit sa ovim dokumentom je naknadna dokumentaciona finalizacija istog runtime-a;
ne zamenjuje tehnički checkpoint niti izmišlja ranije rezultate testova.
[Provera dokumentacije i nepromenjenog runtime-a](005-week08-submission-check.json).

## Zatvoren tehnički deo

- [1040/1040 testova](005-milan-final-tests.txt), uključujući 123 security testa.
- [Build i 27/27 Chromium E2E](005-milan-final-e2e.txt), uključujući 6 security browser scenarija.
- [Typecheck](005-milan-final-typecheck.txt) i [lint](005-milan-final-lint.txt) PASS.
- Hosted clean install, testovi, build i browser provere prolaze na Windowsu i Linuxu za `c5038bb`.
- Naknadno lokalno na `main@c2a0d95`: 123/123 security, 1040/1040 full,
  27/27 Chromium E2E sa build-om, typecheck i lint PASS. Ova sesija nije
  ponovila clean install, audit, Linux CI ni live provider.
- PR #12 spojen je u week08-init, zatim #11 u main; autorstvo je sačuvano.
- PR #9 zatvoren je kao zamenjen selektivnim prenosom; #10 je uključen i zatvoren.
- Milan je izvršio [vođeni negativni HTTP test i normalan coaching](005-milan-human-check.json),
  a zatim ručno igrao/proverio aplikaciju kroz `npm run dev` i potvrdio da radi.

Dokazi za startup CSP i spor GET su u [T034 handoff-u](005-milan-csp-handoff.md)
i [Milanovoj tehničkoj doradi](005-milan-handoff.md). Zadržani su početni padovi,
pozitivne kontrole i stvarne granice zaključka. Fake testovi ne dokazuju ponašanje
živog modela; nema novih live poziva u završnoj dokumentacionoj proveri.

## Status dorada iz pregleda 88/100

1. **Demo i pojedinačna odbrana:** lokalna proba oba člana, zasebno i zajedno,
   potvrđena je 27.10. Formalni nastup 28.10. i stvarni individualni ulazi/ishodi
   ostaju T030. Milan potvrđuje da su obojica predložila i lokalno izvršila
   negativnu proveru povećanja `maxSteps`; dokumentovan je njegov ishod uz
   Codexovo uputstvo, dok Vedranov zaseban izlaz nije sačuvan.
   [Obrazac za zapis](005-phase7-demo.md).
2. **Evidence:** [aktuelni T00–T17 rezultati i tri ista ulaza pre/posle](../EVIDENCE_W08.md)
   stoje ispred jasno označenog istorijskog plana. Početni `NOT RUN` i RED zapisi
   nisu prepravljeni u naknadni PASS.
3. **Deployment granice:** [README](../../README.md#granice-lokalnog-demo-a)
   izričito navodi single-user bez auth/vlasništva, procesni rate/kapacitet i
   memorijske događaje. To nije tvrdnja o višekorisničkom deployment-u.

## Prezentovanje

Iz `retro-poker/`: `npm.cmd run demo:security`, zatim http://127.0.0.1:5173/.
Profil koristi stvarni API/alat/production CSP i constructor-only fake provider.
[Ručni koraci](005-milan-manual.md), [osam minuta i individualne varijante](005-phase7-demo.md).
Browser testovi i ručni server dele portove: ugasiti ručni server pre testova.
[Operativne granice lokalnog single-user demo-a](../../README.md#granice-lokalnog-demo-a)
navode odsustvo auth-a, procesne limite i memorijske događaje.

T031 je završen kao paket dokumentacije i linkova po Milanovom zahtevu.
Njegova prethodna zavisnost od izvedenog T030 razdvojena je u planu: dokumentacija
može biti završena pre prezentacije. **T030 ostaje otvoren za stvarno izvođenje**,
objašnjenje kontrola/testova i individualnu varijantu oba člana. Nijedan nastavni
zahtev nije uklonjen niti je spremnost prikazana kao izveden rezultat.

Posle izvođenja dopisati ime/datum, ulaz/očekivanje/ishod i kratko objašnjenje
svakog člana, potvrdu zajedničkog demo-a i individualne varijante; tada zatvoriti T030.
`student-weekly-report` je zaseban naredni razgovor i nije izvršen ovim korakom.

## Poruka za kolegu

> Tehnički deo Week08 je završen: kod i dokumentacija su na main-u, testovi i
> Windows/Linux CI prolaze, PR-ovi su sređeni. Obojica smo zasebno i zajedno
> isprobali lokalni demo i spremni smo za prezentaciju 28.10; formalni zajednički
> demo i individualni deo tek predstoje.
