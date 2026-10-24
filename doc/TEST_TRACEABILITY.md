# Phase 1 测试追踪

权威编号来自 `spec/SVG_Editor_Phase1_Test_Plan.md`；可执行追踪存 `traceability.json`，每条保留来源行、断言、required_by、gate_scope、状态、测试路径和证据。当前功能均 planned，不计通过。

M00 只执行工具链/文档初始化，无功能测试。最终门禁必须拒绝任何到期 local_required 缺少真实证据；candidate_verification 只由提交外最终收据关闭。

M01 部分证据：`test/unit/values.test.ts` 的 76 个真实断言用例和 `test/helpers/SemanticSnapshot.ts` 正反样例；`scripts/check-deps.mjs` 包括真实违规夹具。VAL/几何/文本/限额的跨入口部分尚不具备依赖，未记整条 verified。阶段门禁为 `npm run verify:stage -- M01`。

M02 部分证据：`test/unit/core.test.ts`（11 个用例）通过真实 rect/g 与两类原语覆盖 TX-01—09 当前适用部分、CRT/INV/STR-16/17 的领域切片、FAIL-02/03 前写失败。`test/helpers/InvariantOracle.ts` 的独立遍历与损坏负例均执行。完整各编号跨入口义务仍按原 required_by 保留，不因局部通过而关闭。

M03 领域子场景证据：`test/unit/shapes.test.ts` 含 6×2 创建、36×set、每叶 move/scale 独立手算、GEO-03—10/SET-02—09 相关领域断言；`test/property/geometry.test.ts` 实际运行 PROP-04/05/12。状态/CLI 相关子场景按 EXEC 仍留 M07/M12；不把领域组合完成冒充全部跨入口完成。

合法延后范围：E2E-08 环境无法可视预览时 manual_acceptance；DEL-02/03/04 标签/推送/截止 after_user_acceptance；显式可选变异/额外平台 optional。其他必须项不允许擅自延后。

M11（未关闭）：`test/integration/files.test.ts` 16 例中 15 例通过、FS-10 真实 file symlink/dangling 例在 `fs.symlink` 处 EPERM；完整集成套件 276 passed/1 failed。`test/e2e/smoke.test.ts` 1 例真实编译入口/端口冒烟通过。FS-10 gate_scope 保持 local_required，状态 blocked；lstat 注入和路径解析通过不替代真实链接，后续完整 verify 必须拒绝此缺口。

M10 应用 IO 证据：`test/integration/io-session.test.ts` 与 `queue-io.test.ts` 共新增 28 个用例，覆盖 DOC/ID 的发布/保存点、REG-STATE/REG-SAVE、IO 应用三态/呈现失败、QUEUE-01—07 与 FAULT read 恢复。`test/regressions/candidate-isolation.test.ts` 固定候选隔离缺陷。所有测试使用真实 Codec/Session/History/Domain，FileStore 替身只在 test；FS-01—11 的底层真实适配器证据不在本阶段关闭。

M09 Codec 证据：`test/integration/codec.test.ts` 的 124 个正/反/资源/ID 场景、`test/property/codec.test.ts` 的 PROP-07/08/11 及 `test/regressions/root-px.test.ts`。覆盖 XML 解码侧、ID-01—10 的 Codec 部分、SEC 解析侧和 LIM 读取准入部分；ID-06/10/11 的 Session 原子发布/dirty/read/save 部分到 M10，终端安全呈现到 M12。不得由直接 decode 成功替代 read 发布测试。

M08 编码证据：`test/integration/encoder.test.ts` 的 19 个真实用例独立核对 XML-09—16/24 的编码侧与 LIM-10 输出边界，使用 @xmldom/xmldom，不靠自家 decode 往返；XML 各编号的解码/发布侧仍留 M09/M10。

M07 证据：`test/integration/memory-commands.test.ts` 包含全部编辑生命周期/空操作/36 set/6×2 API/无保存点 canvas/同名重用；`test/integration/faults.test.ts` 包含 prepared/root/preview、Undo/Redo 部分中止补偿、FAIL-09/10/11、FAULT init 恢复；`test/property/session.test.ts` 实际执行 PROP-01/02/03/09/10/13。`test/regressions/limits-shape.test.ts` 固定 REG-LIMITS-01。完整保存点、read/save dry-run 模式/poisoned 拒绝及 read 恢复留 M10，CLI 全协议留 M12，不记提前通过。

M06 应用切片证据：`test/unit/cli.test.ts` 35 个词法/请求/语法例，`test/integration/session.test.ts` 7 个状态/队列/准备失败/隔离例，`test/integration/repl.test.ts` 2 个真实适配例。覆盖 DOC-01/02、CLI-01—13 当前命令子集、HIS/QRY 当前适用项、FAIL-01/04/05、QUEUE-03/04。其余编辑、保存点、全命令和生产文件 E2E 子项未关闭；没有把当前 8 命令帮助输出冒充最终 19 命令帮助。

M05 历史证据：`test/unit/history.test.ts` 的 5 个真实用例覆盖 HIS-03/04/05/07/09/12/13 的 HistoryManager 层、ARCH-10/PERF-06 的栈结构与长链；使用真实 ChangeSet，两个不同类的同名节点恢复其原对象。dirty/revision/应用发布部分到 M06/M07/M10 才具备依赖。

M04 领域结构证据：`test/unit/structure.test.ts` 的 19 个真实用例与 `test/property/structure.test.ts` 的 PROP-06/14/15；精确验证 REG-GROUP 的 index=3、Ungroup 的逐步 index=1/2/3、原对象 Undo/Redo、跨文档/过期计划和中途补偿。状态相关 STR/HIS/FAIL 子项在 M07 补齐。
