# Phase 1 测试报告

当前：M06 阶段通过，完整验收尚未就绪；M07—M15 planned。M01 的 `npm run verify:stage -- M01` 实际执行 strict 类型检查、lint、格式、架构规则及 76 个非空单元测试。失败 0、跳过 0；值层覆盖 VAL-01—06、GEO-10、XML-14、LIM-07/08 的当前适用部分；跨入口完整用例仍按阶段补齐。

ARCH-11 以三条实际禁止依赖验证检查器（含 domain→application 的纯类型和 domain→Node fs）。Snapshot 正反例分别检出顺序、根样式、文本空白和画布尺寸差异。预期来自手工表和 EXEC CFG，不调用生产校验器生成预期。

M02：`npm run verify:stage -- M02` 通过，87 tests / 2 files，失败 0、跳过 0；日志 `artifacts/logs/M02.log`。新增真实事务生命周期、prepared 回滚、跨文档、同 ID 大小写、独立索引/计数检查、不可变历史描述、资源限额和前写失败补偿。InvariantOracle 用损坏夹具验证重复父/循环入口/幽灵计数/错误索引会失败；生产未增加破坏入口。完整 Session 层、全部图形/结构及故障态测试仍 planned。

M03：`npm run verify:stage -- M03` 通过，152 确定性测试 / 3 files，3 条性质 / 1 file，失败 0、跳过 0。六类型各根/组内 12 创建场景、36 set 组合逐条执行、TEST §7.4 的 move 与 scale 从独立初态手算验证。三级混合组、stroke-width/font-size 保留、空组非法因子、后段溢出/下溢回滚均执行。性质每条执行 local 50 次×2 seeds（20261025 及本次新 seed），真实参数和结果在 `artifacts/random/*.json`；本阶段总计 300 次。日志 `artifacts/logs/M03.log`。CLI/Session 跨入口完整预期仍待后续。

最终候选将从精确 SHA 干净检出执行锁文件安装、构建、verify、release 随机和覆盖率；完整 SHA 和结果写入提交外收据。未执行推送、final 或用户验收。

M06：`npm run verify:stage -- M06` 通过，211 单元 / 6 files、9 集成 / 2 files、6 性质 / 2 files，失败 0、跳过 0；性质 local 各 2×50 次。日志 `artifacts/logs/M06.log`。8 个当前命令的手写请求/语法表、真实 REPL→Session→Domain→History 链、请求嵌套复制、查询/失败/no-op 保留 Redo、prepare 后 history/DTO 构造失败回滚、错误后下一请求执行、会话隔离和运行期私有能力负例均执行。完整 19 命令、正式编译 CLI 和真实文件 E2E 仍 planned；没有生产假端口。

M05：`npm run verify:stage -- M05` 通过，176 确定性用例 / 5 files、6 性质 / 2 files，失败 0、跳过 0；随机各 local 2×50 次。日志 `artifacts/logs/M05.log`。HistoryManager 旧值不变、栈顶原条目移动、空编辑仅解屏障、Redo 截断、身份不匹配、同 ID 两代真实对象双撤销重做及 10,000 条身份连续的历史链均执行；源码为 O(1) 栈头更新，未复制历史数组。

M04：`npm run verify:stage -- M04` 通过，171 确定性用例 / 4 files、6 性质 / 2 files，失败 0、跳过 0；性质各 2×50 次（总 600）固定+新 seed。日志 `artifacts/logs/M04.log`；随机参数 `artifacts/random/`。STR-01—17 领域算法及 REG-GROUP 的三条精确位置日志已执行；跨父/内层 LCA/保留最后分支、顶层解组拒绝、空/单孩子解组、样式存在性、整棵子树索引与限额均覆盖。预留未来 Session 的 Redo/屏障断言，不在本阶段伪造。
