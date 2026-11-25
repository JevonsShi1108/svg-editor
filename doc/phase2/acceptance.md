# Phase 2 验收摘要

课程评审可从本地候选或已授权交付的 `p2` 开始。完整 SHA、检查起止时间和发布读回值由提交外收据记录。

- **扩展。** VS Code 1.147.0 的真实 Explorer 显示 `[]`。原生 Outline 可从第 1 行跳到第 3 行的 `rect#start`，未保存改名和插行后定位第 4 行，残缺 XML 清空，补全后恢复。[观测和图片摘要](vscode-evidence.json) · [课程报告与两张实拍](../README.md)
- **CLI。** 六种内置图形、19 条命令、四个扩展点、stats、dir、box、两种树标签与双装配齐备。故障覆盖半途写入、已有 redo、XML 读入失败、配置清单错误和异步暂存冲突。[扩展点、ADR 与架构图](../README.md) · [条款追踪](traceability.json)
- **兼容性。** 编译后的真实进程以相同绝对 cwd 重放 Phase 1 §6、§6.1 A、§6.1 B 和新插件会话。分别检查 stdout、stderr、退出码及保存文件。目录、框体中文标题、两个框共 8 个节点另有独立期望。[会话夹具](../transcript/) · [字节比较脚本](../../scripts/test-assemblies.mjs)
- **独立接入。** 两个 box 提交的共同父为 `83028b23bbfa0194172e08290983cd5dbf695e89`，代码与配置分支的插件 tree 同为 `a7a655d7495053fac9ee9812c371d94f53ff30de`。审计先确认保护路径真实存在，再核对完整变更和锁文件。[Git 差异验证](../../scripts/check-plugin-diffs.mjs) · [指标与函数清单](../../docs/metrics/README.md)

## 复验准确候选

1. 在单独的干净检出核对 `git rev-parse HEAD` 和目标 SHA。运行 `npm ci`、`npm run build:vscode`。设置 `VSCODE_EXECUTABLE_PATH` 可使用已安装的 1.147.0。
2. 将 `extensions/svg-tools/example` 复制为该检出中的 `artifacts/desktop-candidate/fixture`，使用 `--extensionDevelopmentPath` 指向本检出的扩展并打开该夹具。选中 plain.txt 观察徽标，打开 example.svg 后点击原生 Outline 的 rect#start，读状态栏行号。将同一实际窗口的两张 JPEG 原图保存到 `artifacts/desktop-candidate/badge.jpg` 与 `outline.jpg`。
3. 将观察值传入 `node scripts/record-candidate-desktop.mjs "1.147.0" "<实际开发宿主标题>" 3 "rect#start" "[]"`，把本次窗口观察与检出、构建和夹具绑定。
4. 运行 `npm run candidate:verify -- <完整 SHA>`。脚本重新安装锁文件、构建、执行完整 verify 和 release 随机档，核验图、指标、进程原始字节与现场图。最终收据以及原始证据快照置于 `artifacts/acceptance/`。在验收通过并取得阶段二发布授权后，向同一 origin 原子推送开发分支和带说明的 p2 标签，核对远程分支与 peeled tag。
