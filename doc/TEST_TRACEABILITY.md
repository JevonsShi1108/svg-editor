# Phase 1 测试追踪

2026-10-25 恢复结果：用户开启开发者模式后，原 test/integration/files.test.ts 未修改，19 项全部通过、0 skip；真实 file symlink 和 dangling link 的 read/save 拒绝、链接保留与原目标 OLD 均已实际断言。完整 npm run verify 已通过：767 passed、0 failed、0 skipped，静态/架构/覆盖率/8 项性能/315 个 local_required 全绿。此前 EPERM 和 BLOCKED 收据保留为历史；最终准确候选状态仍以提交后的干净检出收据为准。

权威编号来自 `spec/SVG_Editor_Phase1_Test_Plan.md`；可执行追踪存 `traceability.json`，每条保留来源行、断言、required_by、gate_scope、状态、测试路径和证据。尚未完整核验的条目保持 planned；局部证据不计整条通过。

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

M12 协议证据：test/fixtures/cli-protocol.ts 为独立手写 19 命令及非法参数表；test/unit/cli-protocol.test.ts、terminal.test.ts、test/integration/cli-protocol.test.ts 覆盖 CLI-01—14/ERR-01—14 和全部 36 CLI set。test/e2e/lab.test.ts、output-failure.test.ts、smoke.test.ts 共 7 个真实进程用例通过 E2E-01—07；课程两份脚本在 test/fixtures/sessions/，other.svg 逐字来自 LAB。test/property/cli.test.ts 实际执行 PROP-16（2×50 次）。QRY 跨状态及其他尚待最终逐项审查的条目暂不提前关闭。

M13：test/model/ReferenceModel.ts 使用独立 flat testUid 记录、完整内容快照历史、内容 token；group 由数值路径和一次重建计算，未复制生产插组/逐点 Placement 算法。test/unit/model-calibration.test.ts 独立校准 STR-01—04、12 兄弟反选、REG-STATE 和同名身份。test/model-run/ 的模型、资源、实际文件、回放探针及具体反例共 7 例通过 ci 档。MODEL-01—10 现有自动证据闭合；原语 poison 的全部义务仍由确定性故障套件承担。check:deps 实际检查纯模型及其禁止边。

M14 追踪与门禁检查点（2026-10-25）：逐项重新审查 339 个编号，包含 8 个 E2E；追踪存每条断言审查、实际 Vitest case 选择器和证据。检查器的编号正则曾遗漏带数字的 E2E 前缀，已固定提取回归并补齐这 8 条，不把仅有测试文件当作追踪闭合。M14 到期 local_required 共 310 条，FS-10 仍 blocked；M15 交付/预览保持 planned，变异 20 条未运行、远程/标签/截止 3 条验收后、DEL-08 由精确 SHA 收据关闭。23 个元数据自检断言检出缺证据、错误降级和未来项误通过；AST 检查禁止 .only/skip/todo 等遗漏修饰。

新增明确六类型 × 根/组内 CLI 创建和实际进程测试、大小写 ID 独立编辑/删除、非空 Group 自身三样式、Unicode 文本/原始属性 L−1/L/L+1 跨入口，以及 ungroup 首/中/末前写故障。完整覆盖率套件现 767 例，766 passed / 1 FS-10 EPERM、0 skip；语句 95.67% (1505/1573)、行 97.18% (1380/1420)、分支 92.86% (859/925)。M14 阶段静态、单元、属性、E2E、模型、性能通过；集成/覆盖率套件/追踪因同一个 FS-10 保持失败。实际收集日志和退出码见 artifacts/verification/latest-stage-M14.json，追踪报告 artifacts/traceability/report.json。新增 ci 档固定与新 seed 再次通过（artifacts/verification/latest-random-ci.json）。

verify、verify:stage、random:local/ci/release 都执行真实工具并保留每步日志/退出码/源码和锁文件摘要；失败后继续无依赖检查，最终仍返回失败，不重试到绿。verify 的全 local_required 检查不会预先要求自身最终收据。当前用户答复将开启开发者模式后通知，尚无开启完成确认，FS-10 不作人工延后。下一步 M15 报告/PlantUML、真实预览能力、精确 SHA 干净复验及提交外收据；尚未 READY。

M15 交付产物检查点：doc/README.md 已按实际代码完成架构方案、过程记录、一致性自查与质量保证；doc/architecture.puml 经官方 PlantUML 1.2026.8 校验 jar 在本地 Java 实际渲染，图和源摘要记录于 architecture.meta.json。两个 8 节点代表 SVG 经实际编译 CLI 保存并读回，真实浏览器已观察位置/中文/层序/继承并保存 PNG，source/SVG/截图摘要见 doc/examples/preview.json；E2E-08 verified，不等于用户验收。预览原沙箱服务超时，获批普通 Windows 只读 loopback 服务成功。

候选前 release 档已实际通过：16 性质各固定与新 seed ×1,000 次，模型每 seed 500×最多200命令/60节点，另有 MODEL-IO 每 seed 1,000 短真实文件序列；日志 artifacts/verification/latest-random-release.json。本轮无产品随机失败。完整 verify 当前仍仅因 FS-10 系统 EPERM 返回失败；Git 增量/报告/图/实现偏差四交付条目已核验，DEL-08 保持待最终收据。candidate:verify 会在干净精确 SHA 中实际 npm ci、build、verify（含覆盖率/性能/local随机）与 release，保留逐检查日志和10个闭合子项；不在被测提交中写自身SHA。

## 2026-10-25 系统能力恢复后的完整验证

用户确认已开启开发者模式，原 FS-10 和生产实现均未改动。npx vitest run test/integration/files.test.ts 实际19 passed/0 failed/0 skip，真实链接/悬空链接成功创建后 read 拒绝、replace not-committed、链接存在及 target=OLD 断言执行；日志 artifacts/logs/FS10-developer-mode-rerun.log，JSON artifacts/test-results/fs10-resume.json。

npm run verify 在普通 Windows 执行环境退出0；767项全部通过（318单元/回归、417集成、16性质、7模型/回放/资源、9真实进程E2E），0失败、0跳过。类型/lint/格式/依赖、全部生产V8覆盖率、8项性能和339编号中的315个local_required检查通过。原始运行 artifacts/verification/runs/2026-10-25T04-31-11.016Z-8c8dc74c/report.json；汇总 artifacts/logs/M15-FS10-resolved-verify.log。UTC日志时间对应本地2026-10-25 12:31。

覆盖率仍为语句95.67% (1505/1573)、行97.18% (1380/1420)、分支92.86% (859/925)，核心domain/history/Session各范围均达到冻结门槛。生产源码和测试断言未改变，sourceDigest仍885072b0eff51df21e7cb2911473b27d4f1b17d60b6c1c972af6d6281f3ae064。先前系统能力失败及旧收据均保留；这里记录本次预提交工作树事实，最终完整SHA、clean_checkout、release与DEL-08十个闭合子项由新提交外收据记录，报告不包含自身SHA。未执行push或final。
