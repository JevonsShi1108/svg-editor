import type { Command } from 'fast-check';
export interface ProbeState {
  trace: number[];
}
export class ReplayProbeCommand implements Command<ProbeState, ProbeState> {
  constructor(readonly value: number) {}
  check(_model: Readonly<ProbeState>): boolean {
    return true;
  }
  run(_model: ProbeState, real: ProbeState): void {
    real.trace.push(this.value);
    if (this.value >= 2) throw new Error('deliberate replay probe');
  }
  toString(): string {
    return String(this.value);
  }
}
