# Dependency audit — Faza 6, T027

2026-10-26, `week08-init`, HEAD `e498a06b11a8e8eb0c8c2e310b39608630547757` + radni diff. Node `v24.20.0`, npm `11.19.0`.

Prvi `npm.cmd audit --json`: exit 1, registry mrežna prepreka ([izlaz](005-phase6-audit.json)); nije čist audit. Ponovljeno sa mrežnim pristupom: exit 1, 10 pogođenih paketa (1 low, 3 moderate, 4 high, 2 critical; nije broj jedinstvenih advisory-ja), [puni report](005-phase6-audit-retry.json). Nema AI poziva.

Pre izmene: relevantna regresija 194 PASS, security 123 PASS, sentinel 3 PASS i production browser 5 PASS. Očekivanje update-a: isti ugovori i frontend/CSP, uz audit 0. Nisu dodavani exploit-i niti slabljeni testovi.

Komande (svaka exit 0; bez lifecycle skripti, force-a, override-a ili ručne izmene lockfile-a):

```powershell
npm.cmd install --save-exact --ignore-scripts fastify@5.12.7 zod@4.6.7
npm.cmd install --save-dev --save-exact --ignore-scripts concurrently@10.0.6 vite@8.3.5 vitest@5.0.5
npm.cmd update fast-uri source-map-js undici --ignore-scripts
npm.cmd audit --json
npm.cmd ls --depth=0 --json
npm.cmd ls fast-uri source-map-js undici shell-quote @vitest/mocker --all --json
```

Direktni pogođeni paketi ostaju u istim minor linijama. Tranzitivne zavisnosti osvežava npm resolver unutar postojećih kompatibilnih opsega. Nema novih direktnih zavisnosti ni Node/npm migracije. [Sve lock promene](005-phase6-lock-changes.json), [pre putanje](005-phase6-audit-paths-before.json), [posle putanje](005-phase6-audit-paths-final.json), [instalirane verzije](005-phase6-installed-final.json).

## @vitest/mocker

- Verzija: 5.0.1 → 5.0.5; tranzitivna dev: vitest → @vitest/mocker.
- Izloženost: Manual mock/redirect server i Windows putanje; projekat koristi vitest run bez browser mock server-a. Nije ignorisano zbog dev oznake.
- Odluka: **popravljeno**, ciljana kompatibilna promena; final audit nema ovog nalaza.
- Advisory: [Vitest: Code injection via unauthenticated manual mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8); pogođeno `>=5.0.0-beta.1 <5.0.3`.
- Advisory: [Vitest: Windows backslash traversal bypasses the @vitest/mocker redirect allowlist fix](https://github.com/advisories/GHSA-xp26-3454-mjgp); pogođeno `>=5.0.0-rc.2 <5.0.3`.

## concurrently

- Verzija: 10.0.5 → 10.0.6; direktna dev: npm run dev.
- Izloženost: Nasleđuje shell-quote; Windows shell putanja postoji u razvoju iako su komande fiksne.
- Odluka: **popravljeno**, ciljana kompatibilna promena; final audit nema ovog nalaza.
- Nasleđen advisory preko `shell-quote`; izvor/uslovi u istoimenoj stavci.

## fast-uri

- Verzija: 3.1.8/4.2.1 → 3.1.9/4.2.3; tranzitivna runtime: Fastify → ajv-compiler/fast-json-stringify; ajv → fast-uri.
- Izloženost: URI/schema normalizacija. Nema user/model URL fetch-a, ali server koristi validator i serializer. Nije dokazano opšte neprimenljivo.
- Odluka: **popravljeno**, ciljana kompatibilna promena; final audit nema ovog nalaza.
- Advisory: [fast-uri vulnerable to URI scheme spoofing via percent-encoded scheme decoding](https://github.com/advisories/GHSA-w74x-v6f9-j3xg); pogođeno `>=4.0.0 <4.2.3`.
- Advisory: [fast-uri vulnerable to URI scheme spoofing via percent-encoded scheme decoding](https://github.com/advisories/GHSA-w74x-v6f9-j3xg); pogođeno `>=3.0.0 <3.1.9`.
- Advisory: [fast-uri vulnerable to improper path equivalence in relative reference normalization](https://github.com/advisories/GHSA-xhq7-xmqj-769h); pogođeno `>=4.0.0 <4.2.3`.
- Advisory: [fast-uri vulnerable to improper path equivalence in relative reference normalization](https://github.com/advisories/GHSA-xhq7-xmqj-769h); pogođeno `>=3.0.0 <3.1.9`.
- Advisory: [fast-uri vulnerable to host confusion via unchecked WHATWG host canonicalization](https://github.com/advisories/GHSA-wjr9-j795-jxcr); pogođeno `>=4.0.1 <4.2.3`.
- Advisory: [fast-uri vulnerable to host confusion via unchecked WHATWG host canonicalization](https://github.com/advisories/GHSA-wjr9-j795-jxcr); pogođeno `>=3.1.3 <3.1.9`.
- Advisory: [fast-uri vulnerable to scheme injection via an unescaped first-segment colon in suffix references](https://github.com/advisories/GHSA-333x-w4r6-6crp); pogođeno `>=4.0.0 <4.2.3`.
- Advisory: [fast-uri vulnerable to scheme injection via an unescaped first-segment colon in suffix references](https://github.com/advisories/GHSA-333x-w4r6-6crp); pogođeno `>=3.0.0 <3.1.9`.

## fastify

- Verzija: 5.12.5 → 5.12.7; direktna runtime: API server.
- Izloženost: Nalaz zahteva case-sensitive propertyNames header šemu; rute trenutno koriste Zod body i eksplicitni Origin. Zakrpljeno uprkos užem exposure-u.
- Odluka: **popravljeno**, ciljana kompatibilna promena; final audit nema ovog nalaza.
- Advisory: [fastify is vulnerable to header validation bypass via case-sensitive propertyNames](https://github.com/advisories/GHSA-389g-gv7q-r4x8); pogođeno `>=5.12.2 <5.12.6`.

## shell-quote

- Verzija: 1.9.0 → 1.12.0; tranzitivna dev: concurrently → shell-quote.
- Izloženost: Eksploatacija traži nepoverljive command tokene/komentar + newline. Fiksne dev komande smanjuju exposure; zakrpljeno umesto oslanjanja na lokalni scope.
- Odluka: **popravljeno**, ciljana kompatibilna promena; final audit nema ovog nalaza.
- Advisory: [shell-quote: `quote()` command injection via a line terminator in a token after a `{ comment }` token](https://github.com/advisories/GHSA-pqg4-j6r4-53mv); pogođeno `>=1.8.4 <1.11.0`.

## source-map-js

- Verzija: 1.2.1 → 1.2.2; tranzitivna dev: vite → postcss; jsdom → css-tree.
- Izloženost: Maliciozni indexed source maps mogu blokirati event loop. Nema user map importa u igri; build/dev/test alati su ipak relevantni.
- Odluka: **popravljeno**, ciljana kompatibilna promena; final audit nema ovog nalaza.
- Advisory: [source-map-js allows event-loop denial of service through indexed source-map section offsets](https://github.com/advisories/GHSA-68fv-2mgg-jv7q); pogođeno `>=1.0.0 <1.2.2`.

## undici

- Verzija: 8.10.2 → 8.12.3; tranzitivna dev: jsdom → undici.
- Izloženost: EventSource parser, SRI algorithm case i prekomerni content-encodings mrežnog odgovora. UI test okruženje može koristiti mrežne resurse; backend ne koristi ovu jsdom granu.
- Odluka: **popravljeno**, ciljana kompatibilna promena; final audit nema ovog nalaza.
- Advisory: [undici vulnerable to Denial of Service via unbounded memory in the EventSource parser](https://github.com/advisories/GHSA-4qv8-2p9j-2685); pogođeno `>=8.0.0 <8.12.2`.
- Advisory: [undici vulnerable to Subresource Integrity bypass via non-lowercase algorithm tokens](https://github.com/advisories/GHSA-f72v-6w45-q472); pogođeno `>=8.0.0 <8.12.2`.
- Advisory: [undici vulnerable to Denial of Service via unhandled error on excessive content-encodings](https://github.com/advisories/GHSA-xjj6-f33q-929c); pogođeno `>=8.0.0 <8.12.2`.

## vite

- Verzija: 8.3.0 → 8.3.5; direktna dev: dev/build/preview.
- Izloženost: Windows launch-editor, cross-origin custom middleware, fs allow i wasm byte disclosure. Dev server se stvarno koristi; loopback ne uklanja browser/cross-origin rizik. Preview CSP ponovo proveren.
- Odluka: **popravljeno**, ciljana kompatibilna promena; final audit nema ovog nalaza.
- Advisory: [launch-editor: escapeCmdArgs() omits % escaping on Windows](https://github.com/advisories/GHSA-698v-4r3x-3vcv); pogođeno `>=8.3.0 <=8.3.2`.
- Advisory: [launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for some editors](https://github.com/advisories/GHSA-r825-w8mm-5pxw); pogođeno `>=8.3.0 <=8.3.2`.
- Advisory: [launch-editor: `fs.existsSync()` existence check can be bypassed on Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm); pogođeno `>=8.3.0 <=8.3.2`.
- Advisory: [Vite: Cross origin script execution through Vite custom middleware](https://github.com/advisories/GHSA-9jrq-w75r-8gcw); pogođeno `>=8.3.0 <=8.3.2`.
- Advisory: [Vite: Files outside `server.fs.allow` could be served when project paths match system paths on non-Windows machine](https://github.com/advisories/GHSA-rq7h-c2jc-7f22); pogođeno `>=8.3.0 <=8.3.2`.
- Advisory: [Vite: First 4 bytes of files outside of `server.fs` setting is exposed by `?vite-wasm-instance`](https://github.com/advisories/GHSA-vfpm-58rq-9qcg); pogođeno `>=8.3.0 <=8.3.2`.

## vitest

- Verzija: 5.0.1 → 5.0.5; direktna dev: test runner.
- Izloženost: Nasleđuje mocker nalaze; svi node/UI testovi koriste ovaj runner.
- Odluka: **popravljeno**, ciljana kompatibilna promena; final audit nema ovog nalaza.
- Nasleđen advisory preko `@vitest/mocker`; izvor/uslovi u istoimenoj stavci.

## zod

- Verzija: 4.6.5 → 4.6.7; direktna runtime/frontend: strict ugovori.
- Izloženost: Oversized constrained collections mogu iscrpeti memoriju. HTTP/model byte granice pomažu, ali validator ostaje na nepoverljivoj granici; zakrpljeno.
- Odluka: **popravljeno**, ciljana kompatibilna promena; final audit nema ovog nalaza.
- Advisory: [Zod can exhaust memory while validating oversized constrained collections](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5); pogođeno `<4.6.6`.

GitHub advisory izvori pregledani web alatom; Fastify i Vitest potvrđeni i kroz maintainer security advisory. Zod maintainer URL nije dostupan (404); korišćen objavljen GitHub advisory i npm report, bez izmišljene maintainer potvrde.

Finalni `npm.cmd audit --json`: **exit 0, 0 nalaza**, [report](005-phase6-audit-final.json). Posle update-a: full 1037 PASS; security 123 PASS; build + security browser 5 PASS; typecheck/lint/build exit 0. CLI `npm.cmd exec -- concurrently --help` exit 0; dev backend nije pokretan. Clean npm ci/remote CI ostaju T029. Audit 0 ne dokazuje poslovnu logiku ni buduće odsustvo novih nalaza.
