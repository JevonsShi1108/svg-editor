import { it, expect } from 'vitest';
import fc from 'fast-check';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ReplayProbeCommand } from './ReplayProbeCommand.js';
it('MODEL-09 replay harness detects intentional failure, shrinks and replays seed/path/replayPath AND concrete minimum', () => {
  const arb = fc.integer({ min: 0, max: 8 }).map((n) => new ReplayProbeCommand(n));
  let concrete: number[] = [];
  const property = (replayPath?: string) =>
    fc.property(
      fc.commands([arb], {
        maxCommands: 40,
        size: 'max',
        ...(replayPath === undefined ? {} : { replayPath }),
      }),
      (commands) => {
        const real = { trace: [] as number[] };
        try {
          fc.modelRun(() => ({ model: { trace: [] as number[] }, real }), commands);
        } catch (error) {
          concrete = real.trace;
          throw error;
        }
      },
    );
  const initial = fc.check(property(), { seed: 7919, numRuns: 30 });
  expect(initial.failed).toBe(true);
  expect(initial.counterexample).not.toBeNull();
  expect(initial.numShrinks).toBeGreaterThan(0);
  const serialized = initial.counterexample![0].toString();
  const replayPath = /replayPath="([^"]*)"/.exec(serialized)![1]!;
  const replay = fc.check(property(replayPath), {
    seed: initial.seed,
    path: initial.counterexamplePath!,
    numRuns: 1,
    endOnFailure: true,
  });
  expect(replay.failed).toBe(true);
  expect(concrete).toEqual([2]);
  const exact = { trace: [] as number[] };
  expect(() => {
    for (const value of concrete) new ReplayProbeCommand(value).run({ trace: [] }, exact);
  }).toThrow('deliberate replay probe');
  expect(exact.trace).toEqual(concrete);
  mkdirSync('artifacts/random', { recursive: true });
  writeFileSync(
    'artifacts/random/MODEL-replay-probe.json',
    JSON.stringify(
      {
        kind: 'harness-self-test',
        expectedFailureDetected: true,
        seed: initial.seed,
        path: initial.counterexamplePath,
        replayPath,
        minimum: concrete,
        shrinks: initial.numShrinks,
        replayed: true,
      },
      null,
      2,
    ),
  );
});
