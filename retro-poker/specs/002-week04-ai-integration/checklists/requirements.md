# Specification Quality Checklist: Week04 AI integracija

**Purpose**: Provera potpunosti, jednoznačnosti i proverljivosti feature 002 zahteva pre tehničkog planiranja.  
**Created**: 2026-09-26  
**Feature**: [spec.md](../spec.md)

**Review Ownership**: Codex je izvršio requirements-quality pregled u specify/clarify
koraku. Ljudski review niti governance amendment nisu predstavljeni kao završeni.  
**Marker Semantics**: `[x]` znači da je kvalitet zahteva pregledan i zadovoljen; ne
znači da je implementacija ili test izvršen. `[ ]` označava stvarni pre-implementation gate.

## Content Quality

- [x] CHK001 Spec opisuje korisničko ponašanje i bezbednosne granice bez izbora
  konkretne biblioteke, model ID-ja, endpoint-a ili adapter arhitekture.
- [x] CHK002 US1–US4 imaju prioritet, vrednost, nezavisnu proveru i pozitivne,
  negativne i failure acceptance scenarije.
- [x] CHK003 Popunjene su sve obavezne sekcije template-a i uklonjeni placeholder-i.
- [x] CHK004 Potvrđene odluke, predložene brojke i odluke ostavljene planu jasno su razdvojene.

## Requirement Completeness and Testability

- [x] CHK005 FR-001–FR-027 koriste proverljive MUST/MUST NOT ishode i povezani su sa AIAC scenarijima.
- [x] CHK006 Bot kontekst precizira dozvoljene podatke i izričito zabranjuje tuđe karte,
  budući špil, seed, tajne i kasniji ishod.
- [x] CHK007 Strukturisani output prolazi schema i semantičku/engine validaciju pre mutacije.
- [x] CHK008 Idempotency pravilo pokriva stale, timeout, cancellation, reset, kasni i dupli odgovor.
- [x] CHK009 429, timeout, 5xx, malformed, semantic rejection, missing key i provider
  unavailable imaju konačno i odvojeno ponašanje za botove i analizu.
- [x] CHK010 Retry istog modela i fallback na drugi Gemini model terminološki i merljivo su razdvojeni.
- [x] CHK011 Predloženi maksimum je 2 pokušaja, 12 s za bot ishod i 30 s za analysis
  ishod; vrednosti su eksplicitno označene kao predlozi za potvrdu u planu.
- [x] CHK012 Krajnji bot fallback koristi postojeću determinističku strategiju i vidljiv je korisniku.
- [x] CHK013 Neuspeh analize čuva rezultat i nudi eksplicitni ručni retry bez lažnog sadržaja.
- [x] CHK014 Dashboard definiše agregate, in-memory retention, oba reset ponašanja i „nepoznato” usage/cost.
- [x] CHK015 Secrets/privacy pravila obuhvataju browser, prompt, source, Git, log,
  dashboard, screenshot, issue i raw provider response.
- [x] CHK016 Fake provider matrix pokriva success i sve tražene failure klase bez mreže ili ključa.
- [x] CHK017 Live smoke je odvojen, ručan i opcion; specifikacija nigde ne traži ključ kroz Codex chat.
- [x] CHK018 SC-001–SC-009 imaju merljive ishode za konfiguracije, curenje podataka,
  trajanje, attempts, duplu mutaciju, analizu, dashboard i governance gate.
- [x] CHK019 Pending provider ne blokira nezavisne lokalne read-only zahteve, a
  serijalizacija mutacija iste partije ostaje zahtevana.

## Scope and Traceability

- [x] CHK020 Eksplicitno je zabeleženo da model-driven botovi, match analiza i obavezan
  dashboard proširuju/menjaju staru Week04 granicu, bez tvrdnje da ih §12 već podržava.
- [x] CHK021 Sledljivost povezuje GAME_SPEC §12, AC18/AC19, feature 001 ugovore,
  constitution, challenge materijal, API addendum i aktuelni korisnički zahtev.
- [x] CHK022 U scope-u je samo lokalna Gemini integracija; novac, nalozi, multiplayer,
  baza, deployment, trajni replay, drugi provider family i direktna modelska mutacija su isključeni.
- [x] CHK023 Proširenje in-memory istorije za celu partiju je navedeno kao zavisna
  promena postojećeg Week03 ugovora, bez menjanja Week03 fajlova u ovom koraku.

## Official Provider Context

- [x] CHK024 Zvanični Google izvori za SDK, models, structured output/function calling,
  key, free tier, billing, pricing i rate limits provereni su 2026-09-26 i linkovani u spec-u.
- [x] CHK025 Spec ne obećava besplatan model/poziv niti izmišlja kvotu ili cenu;
  konkretan model i aktuelna dostupnost ostaju proveri u planu/live okruženju.

## Pre-implementation Governance Gate

- [ ] CHK026 Pre implementacije posebno uskladiti `GAME_SPEC.md` §12 sa odobrenim
  model-driven botovima, analizom završene partije i obaveznim dashboardom; ako
  constitution proces to zahteva, eksplicitno odobriti i evidentirati amendment
  principa VI i zavisnih odredbi. Ovaj specify korak namerno ne menja te dokumente.

## Review Result

- Requirements-quality rezultat: **25/25 primenljivih kriterijuma zadovoljeno**.
- Clarify rezultat: nema `NEEDS CLARIFICATION` oznaka; rutinske odluke su zapisane kao
  assumptions ili numerički `PROP-*` predlozi.
- Governance rezultat: **1 otvoren, nameran pre-implementation gate (CHK026)** zbog
  eksplicitnog konflikta sa `GAME_SPEC.md` §12 i constitution principom VI.
- Nisu kreirani `plan.md`, `tasks.md`, aplikacioni kod, test implementacija, zavisnosti,
  API klijent niti live provider poziv.
