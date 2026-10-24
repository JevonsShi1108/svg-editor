import { EditorSession } from '../../src/application/session/EditorSession.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { XmlSvgCodec } from '../../src/infrastructure/svg/XmlSvgCodec.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { ControlledFileStore } from './ControlledFileStore.js';
export const explicitSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect id="r1" x="10" y="20" width="30" height="40"/></svg>';
export const anonymousSvg = explicitSvg.replace(' id="r1"', '');
export const ioFixture = () => {
  const files = new ControlledFileStore();
  const codec = new XmlSvgCodec();
  const catalog = new CommandCatalog(defaultLimits);
  const session = new EditorSession({ commands: catalog, codec, files, limits: defaultLimits });
  files.files.set('/memory/a.svg', explicitSvg);
  files.files.set('/memory/b.svg', 'OLD');
  files.files.set('/memory/anonymous.svg', anonymousSvg);
  return { files, codec, catalog, session };
};
