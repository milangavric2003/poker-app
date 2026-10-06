# Expected-first eval skup — Phase 1 T011

Datum: 2026-10-04. Očekivanja zapisana pre pokretanja validator testova.
Fixture je terminalni snapshot revizije 20; oracle koristi literalne kanonske JSON
činjenice i unapred poznate ordinale. Nema modela, mreže ili live provider poziva.

| ID | Scenario / unapred zadat oracle | Test u agent-tool.test.ts | Stvarni rezultat |
|---|---|---|---|
| E1 | betting, limit 10: samo call #2 i raise #3, rastuće; valid | E1: accepts sufficient canonical betting evidence | PASS |
| E2 | betting, limit 1: samo najnoviji raise #3, sampleLimited=true; valid | E2: accepts newest evidence at lower limit | PASS |
| E3 | street, 12 odluka, limit 10: #3–#12 rastuće, sampleLimited=true; valid | E3: accepts latest ten at upper limit | PASS |
| E4 | prazan/aggregate-only: bez pojedinačnih ref-ova; insufficient_evidence, sampleLimited za aggregates | E4: empty/aggregate-only source | PASS |
| E5 | foreign ref, revision 19 ili JSON >20480 UTF-8 bajtova: rejected/tool_validation | E5: rejects foreign/stale evidence and oversized output | PASS |

Dodatni holdout: valid-looking rezultat sa istim ref-om/revizijom ali promenjenom
izvornom akcijom mora biti odbijen. Negativni oracle-i obuhvataju unknown fields,
factCode/finding, false empty, count/order/sample flag i nonterminal snapshot.
Byte-cap oracle meri literalni očekivani JSON preko Buffer.byteLength, nezavisno
od produkcionog projekta/izbora.

Stvarno izvršeno posle zapisa očekivanja: `npm.cmd test -- tests/unit/agent-tool.test.ts`
dao je 23 PASS/8 RED zbog nedostajućeg validatora (exit 1). Posle implementacije:
`npm.cmd test -- tests/unit/agent-tool.test.ts tests/unit/agent-schemas.test.ts tests/contract/coach-contract.test.ts tests/unit/match-facts.test.ts`
64/64, exit 0; isti skup posle dodatnog terminal handId holdout-a 65/65, exit 0.
Holdout je prvo dao 1 stvarni RED/31 PASS, zatim GREEN; kandidat sa praznim
terminal handId više ne prolazi. E1–E5 prošli su u oba GREEN izvršenja.
Stvarni logovi: [RED](../../docs/evidence/003-T011-red.txt),
[GREEN](../../docs/evidence/003-T011-green.txt),
[regresija](../../docs/evidence/003-T011-regression.txt).
Kasniji orchestration eval-i (unknown tool, provider failure, deadline/loop) pripadaju
T012–T017/T024, nisu dokazani ovim skupom.
