import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const classify = (file) => {
  if (/^extensions\/[^/]+\/src\//.test(file)) return 'vscode';
  if (/^plugins\/[^/]+\/src\//.test(file)) return 'plugin';
  if (/^src\/(main\.ts|host\/)/.test(file)) return 'assembly';
  if (
    /^src\/(domain|application|infrastructure|cli)\/|^src\/public\.ts$|^packages\/api\//.test(file)
  )
    return 'kernel';
  throw Error('Unclassified production file: ' + file);
};

const shortRole = {
  'domain/shapes': '图形状态、创建规则和几何行为',
  'domain/document': '画布、节点索引和结构编辑',
  'domain/transactions': '控制写权限及事务生命周期',
  'domain/changes': '记录并回放可逆变更',
  'domain/internal': '封装领域存储和变更权限',
  'domain/values': '校验和描述领域值',
  'domain/errors': '表达领域诊断',
  'application/commands': '绑定或执行命令',
  'application/contracts': '定义公开会话及插件契约',
  'application/internal': '会话内部协议和结果值',
  'application/session': '编排会话及查询',
  'application/history': '维护文档历史和状态身份',
  'application/ports': '定义文件与编解码端口',
  'application/errors': '转换为结构化应用错误',
  'infrastructure/svg': '严格 SVG 解析与序列化',
  'infrastructure/files': '实现文件系统端口',
};
const roles = {
  PluginHost: '暂存当前插件的四类注册，核对清单后一次发布',
  ConfigLoader: '校验配置并解析包与模块入口',
  'code-profile': '选择代码预设的插件、清单及顺序',
  BuiltinCommands: '提供原 19 条命令的解析与绑定',
  CommandRegistry: '按注册名查找绑定并保持 help 顺序',
  PluginCommandBinding: '核对插件参数后绑定异步只读查询',
  ShapeRegistry: '按创建名或 XML 标签与 data-kind 选取 provider',
  NativeShapeProvider: '将原图形的 schema 和构造器适配为 provider',
  ContainerShape: '维护有序孩子并递归执行 move/scale',
  AttributeDispatch: '匹配处理器并绑定本次事务的部件编辑能力',
  TreeDecorations: '准备行尾标签并隔离保存观察器故障',
  StatsCommand: '深度优先统计叶子、容器和首次出现的类型',
  DirCommand: '在启动目录列出并排序普通文件和目录',
  NodeDirectoryReader: '将 readdir 的 Dirent 转成目录项值',
  DirectoryReader: '定义目录项读取端口',
  BoxAttributes: '将 fill 和 label 转发到必需子部件',
  BoxProvider: '生成框体子树、SVG 识别规则和操作反馈',
  BoxShape: '保留复合容器语义和独立的树显示字段',
  BoxTypeLabel: '按运行时类型为框体行追加标记',
  ModifiedStar: '比较保存内容并将变化标记传播到祖先',
  SvgOutline: '从 XML 事件与 UTF-16 字符偏移生成大纲',
  SvgSymbolProvider: '适配为可导航的 DocumentSymbol',
  SvgFileDecorationProvider: '按实际文件类型向 Explorer 提供徽标',
};
function responsibility(file) {
  const name = path.basename(file).replace(/(?:\.d)?\.(?:ts|js)$/, '');
  const layer = file.split('/').slice(1, 3).join('/');
  const role =
    roles[name] ??
    shortRole[layer] ??
    (file.startsWith('plugins/')
      ? '实现 ' + file.split('/')[1] + ' 插件'
      : file.startsWith('extensions/')
        ? '提供 VS Code 编辑器集成'
        : file.includes('/host/')
          ? '装配、解析模块及校验注册'
          : file.startsWith('src/cli/')
            ? '转换 CLI 输入、输出和终端事件'
            : file === 'src/main.ts'
              ? '组装 CLI 并启动 REPL'
              : '导出插件公开 API');
  return name + ' · ' + role;
}

const logical = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);
function functions(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const rows = [];
  function visit(node, owner) {
    if (ts.isFunctionLike(node) && node.body) {
      const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      const clasp =
        node.parent && ts.isClassLike(node.parent) ? node.parent.name?.getText(ast) + '.' : '';
      const name =
        node.name?.getText(ast) ??
        (ts.isConstructorDeclaration(node)
          ? 'constructor'
          : (node.parent?.name?.getText(ast) ?? '<callback>'));
      owner = { name: clasp + name, line, complexity: 1 };
      rows.push(owner);
    }
    if (
      owner &&
      (ts.isIfStatement(node) ||
        ts.isForStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node) ||
        ts.isCatchClause(node) ||
        ts.isCaseClause(node) ||
        ts.isConditionalExpression(node) ||
        (ts.isBinaryExpression(node) && logical.has(node.operatorToken.kind)) ||
        node.questionDotToken)
    )
      owner.complexity++;
    ts.forEachChild(node, (n) => visit(n, owner));
  }
  visit(ast, undefined);
  return rows;
}
assert.deepEqual(
  functions(
    'calibration.ts',
    'function a(){return 1} function b(x){if(x)return 1} function c(x,y){if(x && y)return 1}',
  ).map((f) => f.complexity),
  [1, 2, 3],
);

function scan(ref) {
  const commit = git('rev-parse', '--verify', ref + '^{commit}')
    .toString()
    .trim();
  const entries = git('ls-tree', '-rz', commit)
    .toString()
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t');
      return { blob: line.slice(0, tab).split(' ')[2], file: line.slice(tab + 1) };
    })
    .filter(
      ({ file }) =>
        /^(src\/|packages\/api\/|(?:plugins|extensions)\/[^/]+\/src\/)/.test(file) &&
        /\.(?:ts|js)$/.test(file),
    );
  assert.ok(entries.some((e) => e.file === 'src/main.ts'));
  const blobs = execFileSync('git', ['cat-file', '--batch'], {
    input: entries.map((e) => e.blob).join('\n') + '\n',
    maxBuffer: 64 * 1024 * 1024,
  });
  let cursor = 0;
  const files = entries.map(({ blob, file }) => {
    const newline = blobs.indexOf(10, cursor);
    const [id, kind, length] = blobs.subarray(cursor, newline).toString().split(' ');
    assert.equal(id, blob);
    assert.equal(kind, 'blob');
    const end = newline + 1 + Number(length),
      source = blobs.subarray(newline + 1, end).toString('utf8');
    cursor = end + 1;
    const lines = source === '' ? 0 : source.split(/\r?\n/).length - Number(source.endsWith('\n'));
    return {
      file,
      blob,
      category: classify(file),
      responsibility: responsibility(file),
      lines,
      functions: functions(file, source),
    };
  });
  const groups = Object.fromEntries(
    ['kernel', 'assembly', 'plugin', 'vscode'].map((category) => {
      const subset = files.filter((f) => f.category === category);
      return [
        category,
        {
          files: subset.length,
          lines: subset.reduce((n, f) => n + f.lines, 0),
          complexity: subset.flatMap((f) => f.functions).reduce((n, f) => n + f.complexity, 0),
        },
      ];
    }),
  );
  return {
    digest: createHash('sha256')
      .update(entries.map((e) => e.file + '\0' + e.blob).join('\n'))
      .digest('hex'),
    groups,
    files,
  };
}
const before = scan(option('--base', 'final')),
  after = scan(option('--head', 'HEAD'));
const output = option('--out', 'docs/metrics');
const rows = Object.keys(before.groups).map((category) => {
  const a = before.groups[category],
    b = after.groups[category];
  return `| ${category} | ${a.files} → ${b.files} | ${a.lines} | ${b.lines} | ${b.lines - a.lines} | ${a.complexity} | ${b.complexity} | ${b.complexity - a.complexity} |`;
});
const groupTotals = (data) =>
  Object.fromEntries(
    ['files', 'lines', 'complexity'].map((key) => [
      key,
      ['kernel', 'assembly', 'plugin'].reduce((n, c) => n + data.groups[c][key], 0),
    ]),
  );
const oldTotals = groupTotals(before),
  newTotals = groupTotals(after);
const migration = [
  ['CommandCatalog.parse', 'CommandRegistry.parse'],
  ['CommandCatalog.bind', 'CommandRegistry.bind'],
  ['CommandCatalog.parseCreate', 'BuiltinCommands.parseCreate'],
  ['ShapeFactory.validateCreation', 'ShapeRegistry.validateCreation'],
  ['GroupShape.move', 'ContainerShape.move'],
]
  .map(([oldName, newName]) => {
    const find = (data, name) =>
      data.files.flatMap((f) =>
        f.functions.filter((fn) => fn.name === name).map((fn) => ({ file: f.file, ...fn })),
      )[0];
    return { before: find(before, oldName), after: find(after, newName) };
  })
  .filter((row) => row.before && row.after);
const inventory =
  JSON.stringify({ typescript: ts.version, before, after, migration }, null, 2) + '\n';
const doc = [
  '# CLI 重构指标',
  '',
  '运行 `npm run metrics:p2 -- --base final --head HEAD` 可按 Git blob 复算，交付后可将 HEAD 换为 p2。清单记录两端的路径、职责、类别、物理行、blob 及每个函数的复杂度。[完整清单](inventory.json)',
  '',
  '| 范围 | 文件数 | 原行数 | 候选行数 | 行增量 | 原圈复杂度 | 候选圈复杂度 | 增量 |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...rows,
  '',
  `CLI 合计从 ${oldTotals.lines} 行变为 ${newTotals.lines} 行（增量 ${newTotals.lines - oldTotals.lines}），函数圈复杂度之和从 ${oldTotals.complexity} 变为 ${newTotals.complexity}（增量 ${newTotals.complexity - oldTotals.complexity}）。`,
  '',
  ...migration.map(
    (m) =>
      `- \`${m.before.name}\` → \`${m.after.name}\`，函数圈复杂度 ${m.before.complexity} → ${m.after.complexity}。`,
  ),
  '',
  '前三行分别为内核、装配处和插件。vscode 单独统计。物理行包含空行和注释，末尾换行不另计一行。只统计 Git 中的生产 TS/JS（含 API 声明），排除测试、配置、文档、脚本、依赖和构建结果。',
  '',
  `分析器为 TypeScript ${ts.version}。每个有函数体的函数、方法、访问器或箭头函数从 1 起算。每个分支、循环、非 default 的 case、catch、三目、短路运算及可选链加 1。嵌套函数单独计数。顶层模块语句不计入函数圈复杂度。脚本用直线、单分支和复合条件函数校准 1、2、3。`,
  '',
  '两端源码路径和 blob 的 SHA-256 分别为 `' + before.digest + '` 和 `' + after.digest + '`。',
  '',
].join('\n');
for (const [name, body] of [
  ['inventory.json', inventory],
  ['README.md', doc],
]) {
  const file = path.join(output, name);
  if (args.includes('--check'))
    assert.equal(readFileSync(file, 'utf8'), body, 'Metrics drift: ' + file);
  else {
    mkdirSync(output, { recursive: true });
    writeFileSync(file, body);
  }
}
console.log(rows.join('\n'));
