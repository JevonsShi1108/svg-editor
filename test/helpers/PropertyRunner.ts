import fc from 'fast-check';
import { mkdirSync, writeFileSync } from 'node:fs';
export class PropertyRunner {
  static async checkAsync<T>(name: string, property: fc.IAsyncProperty<T>): Promise<void> {
    const profile = this.profile();
    if (process.env.FC_PATH && !process.env.FC_TARGET)
      throw new Error('FC_PATH requires FC_TARGET to isolate replay');
    const seeds = process.env.FC_SEED ? [Number(process.env.FC_SEED)] : [20261025, Date.now() | 0];
    mkdirSync('artifacts/random', { recursive: true });
    for (const seed of seeds) {
      const path = process.env.FC_TARGET === name ? process.env.FC_PATH : undefined;
      const result = await fc.check(property, {
        numRuns: profile.numRuns,
        seed,
        ...(path === undefined ? {} : { path }),
      });
      writeFileSync(
        `artifacts/random/${name}-${result.seed}.json`,
        JSON.stringify(
          {
            name,
            profile,
            seed: result.seed,
            path: result.counterexamplePath,
            replayPath: null,
            runs: result.numRuns,
            skips: result.numSkips,
            shrinks: result.numShrinks,
            failed: result.failed,
            counterexample: result.counterexample,
            error: result.failed ? String(result.errorInstance) : null,
          },
          null,
          2,
        ),
      );
      console.log(
        `PROPERTY ${name} profile=${profile.name} seed=${result.seed} runs=${result.numRuns} failed=${result.failed}`,
      );
      if (result.failed) throw result.errorInstance;
    }
  }
  static profile(): {
    name: string;
    numRuns: number;
    modelRuns: number;
    maxCommands: number;
    maxNodes: number;
  } {
    const name = process.env.TEST_PROFILE ?? 'local';
    const profiles = {
      local: { numRuns: 50, modelRuns: 30, maxCommands: 40, maxNodes: 30 },
      ci: { numRuns: 200, modelRuns: 100, maxCommands: 80, maxNodes: 40 },
      release: { numRuns: 1000, modelRuns: 500, maxCommands: 200, maxNodes: 60 },
    };
    if (!Object.hasOwn(profiles, name)) throw new Error(`Unknown TEST_PROFILE: ${name}`);
    return { name, ...profiles[name as keyof typeof profiles] };
  }
  static sync<T>(name: string, property: fc.IProperty<T>): void {
    const profile = this.profile();
    if (process.env.FC_PATH && !process.env.FC_TARGET)
      throw new Error('FC_PATH requires FC_TARGET to isolate replay');
    const seeds = process.env.FC_SEED ? [Number(process.env.FC_SEED)] : [20261025, Date.now() | 0];
    mkdirSync('artifacts/random', { recursive: true });
    for (const seed of seeds) {
      const path = process.env.FC_TARGET === name ? process.env.FC_PATH : undefined;
      const result = fc.check(property, {
        numRuns: profile.numRuns,
        seed,
        ...(path === undefined ? {} : { path }),
      });
      const evidence = {
        name,
        profile,
        seed: result.seed,
        path: result.counterexamplePath,
        replayPath: null,
        runs: result.numRuns,
        skips: result.numSkips,
        shrinks: result.numShrinks,
        failed: result.failed,
        counterexample: result.counterexample,
        error: result.failed ? String(result.errorInstance) : null,
      };
      writeFileSync(
        `artifacts/random/${name}-${result.seed}.json`,
        JSON.stringify(evidence, null, 2),
      );
      console.log(
        `PROPERTY ${name} profile=${profile.name} seed=${result.seed} runs=${result.numRuns} failed=${result.failed}`,
      );
      if (result.failed) throw result.errorInstance;
    }
  }
}
