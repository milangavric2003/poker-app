import { runCoachSmoke } from './coach-smoke.js';

try {
  const result = await runCoachSmoke(process.argv.slice(2));
  console.log(JSON.stringify(result.report));
  process.exitCode = result.exitCode;
} catch {
  console.log(JSON.stringify({ event: 'coach-smoke', passed: false, reason: 'internal_verification_failure' }));
  process.exitCode = 1;
}
