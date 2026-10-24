import { EditorSession } from '../../src/application/session/EditorSession.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { TestPorts } from './TestPorts.js';
import { expect } from 'vitest';
import type { ExecutionResult } from '../../src/application/contracts/api.js';
export const sessionFixture = () => {
  const ports = new TestPorts();
  const catalog = new CommandCatalog(defaultLimits);
  const session = new EditorSession({
    commands: catalog,
    codec: ports,
    files: ports,
    limits: defaultLimits,
  });
  return { ports, catalog, session };
};
export const committed = (result: ExecutionResult) => {
  expect(result.ok).toBe(true);
  if (!result.ok || result.mode !== 'commit') throw new Error('Expected successful commit mode');
  return result;
};
export const semantic = async (session: EditorSession) => {
  const result = committed(await session.execute({ command: 'tree' }));
  if (result.data.kind !== 'tree' || !result.data.document)
    throw new Error('Expected complete document');
  return result.data.document;
};
