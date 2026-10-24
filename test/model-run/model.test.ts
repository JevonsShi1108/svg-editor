import { it, expect } from 'vitest';
import fc from 'fast-check';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ModelHarness } from '../helpers/ModelHarness.js';
import { PropertyRunner } from '../helpers/PropertyRunner.js';
import { AdaptiveCommand } from './AdaptiveCommand.js';
import { fixedSteps, initialSteps } from './macros.js';
import type { ModelStep } from '../model/types.js';
const arbitrary = fc
  .record({
    kind: fc.integer({ min: 0, max: 24 }),
    a: fc.integer({ min: 0, max: 120 }),
    b: fc.integer({ min: 0, max: 120 }),
    value: fc.integer({ min: -8, max: 8 }),
    shape: fc.integer({ min: 0, max: 5 }),
  })
  .map((s) => new AdaptiveCommand(s));
const profile = PropertyRunner.profile();
it('MODEL-01/04/05/06/07/08 fixed category macros execute every request, no-op/Redo/barriers and physical OLD/NEW', async () => {
  const h = new ModelHarness(profile.maxNodes);
  for (const step of fixedSteps) await h.run(step);
  for (const command of [
    'init',
    'read',
    'save',
    'canvas',
    'create',
    'delete',
    'move',
    'scale',
    'set',
    'group',
    'ungroup',
    'addto',
    'front',
    'back',
    'undo',
    'redo',
    'tree',
    'show',
    'help',
  ])
    expect(h.coverage[`command:${command}`]).toBeGreaterThan(0);
  for (const category of [
    'before:redo',
    'before:barrier:read',
    'before:barrier:save',
    'before:barrier:init',
    'dry-run',
    'no-op',
    'no-op:barrier-release',
    'error:INVALID_SCALE',
    'read:semantic-repair',
    'save:committed:false',
    'save:not-committed:false',
    'save:indeterminate:false',
    'save:indeterminate:true',
  ])
    expect(h.coverage[category], category).toBeGreaterThan(0);
  mkdirSync('artifacts/random', { recursive: true });
  writeFileSync(
    'artifacts/random/MODEL-fixed.json',
    JSON.stringify({ profile, steps: h.trace, coverage: h.coverage, passed: true }, null, 2),
  );
});
it('MODEL-01/04/05/09 randomized asynchronous model sequences match actual Session after every executed step', async () => {
  if ((process.env.FC_PATH || process.env.FC_REPLAY_PATH) && process.env.FC_TARGET !== 'MODEL-01')
    throw new Error('Model replay requires FC_TARGET=MODEL-01');
  const seeds = process.env.FC_SEED ? [Number(process.env.FC_SEED)] : [20261025, Date.now() | 0];
  for (const seed of seeds) {
    const coverage: Record<string, number> = {};
    const lengths: number[] = [];
    let failedTrace: { steps: ModelStep[]; failure: unknown } | null = null;
    const commands = fc.commands([arbitrary], {
      maxCommands: profile.maxCommands,
      size: 'max',
      ...(process.env.FC_REPLAY_PATH ? { replayPath: process.env.FC_REPLAY_PATH } : {}),
    });
    const result = await fc.check(
      fc.asyncProperty(commands, async (commandList) => {
        const h = new ModelHarness(profile.maxNodes);
        try {
          for (const step of initialSteps) await h.run(step);
          await fc.asyncModelRun(() => ({ model: h.model, real: h }), commandList);
        } catch (error) {
          failedTrace = { steps: h.trace, failure: h.failure };
          throw error;
        } finally {
          lengths.push(Math.max(0, h.trace.length - initialSteps.length));
          for (const [key, n] of Object.entries(h.coverage))
            coverage[key] = (coverage[key] ?? 0) + n;
        }
      }),
      {
        seed,
        numRuns: profile.modelRuns,
        ...(process.env.FC_PATH ? { path: process.env.FC_PATH } : {}),
      },
    );
    const serialized = result.counterexample?.[0].toString() ?? '';
    const replayPath = /replayPath="([^"]*)"/.exec(serialized)?.[1] ?? null;
    if (result.failed && result.counterexample) {
      // Re-execute the final shrunken commands so concrete evidence is guaranteed to
      // correspond to the reported minimum, not the last rejected shrink candidate.
      const h = new ModelHarness(profile.maxNodes);
      try {
        for (const step of initialSteps) await h.run(step);
        await fc.asyncModelRun(() => ({ model: h.model, real: h }), result.counterexample[0]);
      } catch {
        failedTrace = { steps: h.trace, failure: h.failure };
      }
    }
    const evidence = {
      name: 'MODEL-01',
      generatorVersion: 'v2-max-size',
      profile,
      seed: result.seed,
      path: result.counterexamplePath,
      replayPath,
      runs: result.numRuns,
      skips: result.numSkips,
      shrinks: result.numShrinks,
      failed: result.failed,
      serialized,
      minimum: failedTrace,
      initialFixture: initialSteps,
      coverage,
      sequenceLengths: {
        maximum: Math.max(...lengths),
        total: lengths.reduce((a, b) => a + b, 0),
        runs: lengths.length,
      },
      limits: {
        maxNodes: profile.maxNodes,
        maxDepth: 5,
        maxSvgBytes: 1048576,
        maxTextLength: 1000,
        maxAttributeLength: 100,
      },
      inputProfile: 'EXEC-P1 v1.0',
      node: process.version,
      lockSha256: createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),
      error: result.failed ? String(result.errorInstance) : null,
    };
    mkdirSync('artifacts/random', { recursive: true });
    mkdirSync(`artifacts/random/${profile.name}`, { recursive: true });
    writeFileSync(
      `artifacts/random/${profile.name}/MODEL-01-${result.seed}.json`,
      JSON.stringify(evidence, null, 2),
    );
    writeFileSync(
      `artifacts/random/MODEL-01-${result.seed}.json`,
      JSON.stringify(evidence, null, 2),
    );
    if (result.failed) {
      mkdirSync('artifacts/random/failures', { recursive: true });
      writeFileSync(
        `artifacts/random/failures/MODEL-01-${result.seed}-${Date.now()}.json`,
        JSON.stringify(evidence, null, 2),
      );
    }
    console.log(
      `MODEL-01 profile=${profile.name} seed=${result.seed} runs=${result.numRuns} maxCommands=${profile.maxCommands} failed=${result.failed}`,
    );
    if (result.failed) throw result.errorInstance;
    expect(result.numSkips).toBe(0);
  }
}, 180000);
