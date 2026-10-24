import { expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { parseXml10 } from '../helpers/parse-xml10.js';
import { TempDirectory } from '../helpers/TempDirectory.js';
import { runCli } from '../helpers/run-cli.js';
const fixture = (name: string) =>
  fs.readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
const elements = (source: string) => {
  const doc = parseXml10(source);
  return Array.from(doc.getElementsByTagName('*')).filter((e) => e.tagName !== 'svg');
};
it('E2E-01 LAB §6 actual full course session: group error, delete restoration, 5/7 counts and ID warning', async () => {
  const temp = await TempDirectory.create();
  try {
    await fs.writeFile(path.join(temp.path, 'other.svg'), await fixture('svg/other.svg'));
    const output = await runCli(temp.path, await fixture('sessions/lab-6.txt'));
    expect(output.code).toBe(0);
    expect(output.stderr).toBe(
      'error: cannot group a container into its own descendant: markers\nerror: undo not allowed after io command\nwarning: assigned id rect1 to unnamed <rect>\n',
    );
    // EXEC-P1 §4.7 resolves successful document paths to stable absolute values.
    expect(output.stdout).toContain(`saved to ${path.join(temp.path, 'demo.svg')} (5 elements)`);
    expect(output.stdout).toContain(`read ${path.join(temp.path, 'other.svg')} (7 elements)`);
    expect(output.stdout).toContain('rect#rect1  x=0 y=0');
    expect(output.stdout).toContain('circle#c1  cx=130 cy=100');
    expect(output.stdout).toContain('circle#c1  cx=100 cy=100');
    const nodes = elements(await fs.readFile(path.join(temp.path, 'demo.svg'), 'utf8'));
    expect(nodes.map((n) => n.getAttribute('id'))).toEqual(['bg', 'title', 'markers', 'c1', 'box']);
    expect(nodes.find((n) => n.getAttribute('id') === 'title')!.textContent).toBe('My Diagram');
    expect(nodes.find((n) => n.getAttribute('id') === 'c1')!.getAttribute('cx')).toBe('130');
    expect(nodes.find((n) => n.getAttribute('id') === 'box')!.parentNode!.nodeName).toBe('g');
    expect(output.stdout).not.toMatch(/(?:^|\n)svg> /);
  } finally {
    await temp.close();
  }
});
it('E2E-02 LAB §6.1 A actual 8-node Composite flowchart: group move/undo, text, real save/read', async () => {
  const temp = await TempDirectory.create();
  try {
    const output = await runCli(temp.path, await fixture('sessions/lab-6-1-a.txt'));
    expect(output.code).toBe(0);
    expect(output.stderr).toBe('');
    expect(output.stdout).toContain(
      `saved to ${path.join(temp.path, 'flowchart.svg')} (8 elements)`,
    );
    expect(output.stdout).toContain(`read ${path.join(temp.path, 'flowchart.svg')} (8 elements)`);
    expect(output.stdout).toContain('rect#process  x=520 y=200');
    expect(output.stdout).toContain('text#process-label  x=545 y=235');
    const nodes = elements(await fs.readFile(path.join(temp.path, 'flowchart.svg'), 'utf8'));
    expect(nodes).toHaveLength(8);
    const byId = (id: string) => nodes.find((n) => n.getAttribute('id') === id)!;
    expect(nodes.map((n) => n.getAttribute('id'))).toEqual([
      'flowchart',
      'node1',
      'start',
      'start-label',
      'node2',
      'process',
      'process-label',
      'arrow1',
    ]);
    expect(byId('node1').parentNode).toBe(byId('flowchart'));
    expect(byId('process').parentNode).toBe(byId('node2'));
    expect(byId('process').getAttribute('y')).toBe('100');
    expect(byId('process-label').getAttribute('y')).toBe('135');
    expect(byId('process-label').textContent).toBe('处理数据 v2');
    expect(byId('arrow1').getAttribute('stroke')).toBe('black');
    expect(byId('arrow1').hasAttribute('fill')).toBe(false);
  } finally {
    await temp.close();
  }
});
it('E2E-01/02 counts derive from actual document rather than the LAB sample constants', async () => {
  const temp = await TempDirectory.create();
  try {
    const output = await runCli(
      temp.path,
      'init\ncreate g a\nsave zero.svg\ncreate g b\nsave two.svg\ncreate circle c 1 2 3\nsave three.svg\n',
    );
    expect(output.code).toBe(0);
    expect(output.stderr).toBe('');
    for (const [name, count] of [
      ['zero', 1],
      ['two', 2],
      ['three', 3],
    ] as const) {
      expect(output.stdout).toContain(
        `saved to ${path.join(temp.path, `${name}.svg`)} (${count} elements)`,
      );
      expect(elements(await fs.readFile(path.join(temp.path, `${name}.svg`), 'utf8'))).toHaveLength(
        count,
      );
    }
  } finally {
    await temp.close();
  }
});
it('E2E-03/04/06/07 CRLF input recovers errors and preserves quotes, Unicode, #, in, path and EOF save', async () => {
  const temp = await TempDirectory.create();
  try {
    const lines = [
      'show r',
      'init',
      'create g in',
      'create text t 1 2 " a  in # 中文🙂 \\"quoted\\" \\\\ " in in',
      'create line l 0 0 1 1 #4a90d9 in in',
      'create text bad 0 0 "oops" red',
      'move missing 1 2',
      'create box b',
      'create rect svg 0 0 1 1',
      'set t text " a  in # 中文🙂 \\"quoted\\" \\\\ "',
      'show t',
      'tree',
      'save "文件 in # 图.svg"',
    ];
    const output = await runCli(temp.path, lines.join('\r\n') + '\r\n');
    expect(output.code).toBe(0);
    expect(output.stderr.trimEnd().split('\n')).toHaveLength(4);
    expect(output.stderr).toContain('error: unknown shape type: box (is the plugin loaded?)');
    expect(output.stdout).toContain(
      `saved to ${path.join(temp.path, '文件 in # 图.svg')} (4 elements)`,
    );
    const nodes = elements(await fs.readFile(path.join(temp.path, '文件 in # 图.svg'), 'utf8'));
    expect(nodes.find((n) => n.getAttribute('id') === 't')!.textContent).toBe(
      ' a  in # 中文🙂 "quoted" \\ ',
    );
    expect(nodes.map((n) => n.getAttribute('id'))).toEqual(['in', 't', 'l', 'svg']);
    expect(await fs.readdir(temp.path)).toEqual(['文件 in # 图.svg']);
  } finally {
    await temp.close();
  }
});
it('E2E-05 external strict SVG clean/repair/reject; rejected candidate emits no early ID warnings and preserves old document', async () => {
  const temp = await TempDirectory.create();
  try {
    const root = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="30">';
    await fs.writeFile(
      path.join(temp.path, 'clean.svg'),
      `${root}<rect id="r" width="1" height="2"/></svg>`,
    );
    await fs.writeFile(
      path.join(temp.path, 'repair.svg'),
      `${root}<rect width="1" height="2"/></svg>`,
    );
    await fs.writeFile(path.join(temp.path, 'bad.svg'), `${root}<rect/><path d="M0 0"/></svg>`);
    const output = await runCli(
      temp.path,
      'read clean.svg\nshow r\nread repair.svg\nshow rect1\nread bad.svg\nshow rect1\nsave kept.svg\n',
    );
    expect(output.code).toBe(0);
    expect(output.stderr.match(/warning:/g)).toHaveLength(1);
    expect(output.stderr.match(/error:/g)).toHaveLength(1);
    expect(output.stdout.match(/rect#rect1 {2}parent=svg/g)).toHaveLength(2);
    expect(
      elements(await fs.readFile(path.join(temp.path, 'kept.svg'), 'utf8')).map((n) =>
        n.getAttribute('id'),
      ),
    ).toEqual(['rect1']);
  } finally {
    await temp.close();
  }
});
