# Milan — završna provera, očekivanja pre izvršavanja

2026-10-27, Europe/Belgrade. Driver: Codex u Milanovoj sesiji, po njegovom
zahtevu za nastavak. Grana `fix/week08-finalization`, osnova `07db76b`.
Ljudski review, samostalni negativni test i demo nisu ovim potvrđeni.

Izvori: `milan/weekly-assignment week08.md` i
`Nedelja-08/02-Nedeljni-zadatak-Secure-the-Arcade.md` imaju isti SHA256
`0382b5f9ca929e6121dde9a33113a183535a1b37d14fe6a2af359893ca9a1abd`.
Spec-quality checklist: 9/9; Spec Kit prerequisites razrešava feature 005.
Nema extension hook-ova. Jedan coding agent; nema live provider poziva.

## Plan i kriterijum

1. Ponoviti prethodnu security osnovu: očekujemo T00–T17 kontrole očuvane.
   Izvršeno pre izmene: `npm.cmd run test:security`, exit 0, 123/123;
   izlaz `005-milan-security-baseline.txt`.
2. Proveriti hipotezu o UI polling-u: GET traje 1200 ms, interval je 750 ms.
   Očekujemo prikaz potvrđenog završetka bota i analize odmah po odgovoru,
   bez preklopljenih GET-ova i bez ponovljenih POST-ova. GET greška ne sme
   prekinuti narednu legitimnu proveru. Nova partija/unmount i dalje odbacuju
   zastarele odgovore. Test koristi fake sat i sintetičke DTO-e.
3. Samo posle smislenog RED-a minimalno popraviti `frontend/src/App.tsx`;
   sačuvati intervale, serverske limite, poker pravila i provider konfiguraciju.
4. Izvršiti fokusirane UI provere, punu suite, typecheck/lint/build i browser
   security/full regresiju. Prve padove sačuvati. Ne prepisivati stare screenshotove.
5. Ažurirati putanje izvora i stvarni CI status; pripremiti ponovljive korake
   za Milanov ručni deo. T030/T031 ostaju otvoreni do ljudskih dokaza.

Hipoteza nije potvrda da je baš ovaj problem uzrok Milanovog opaženog usporenja.
Live latencija se ne meri: W08 zahteva fake/sintetički profil. Pozitivni test
uklanja determinističku UI prepreku, ne ubrzava udaljeni model.
