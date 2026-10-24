# Phase 1 测试报告

当前：M01 阶段通过，完整验收尚未就绪。`npm run verify:stage -- M01` 实际执行 strict 类型检查、lint、格式、架构规则及 76 个非空单元测试。失败 0、跳过 0；值层覆盖 VAL-01—06、GEO-10、XML-14、LIM-07/08 的当前适用部分；跨入口完整用例仍 planned。

ARCH-11 以三条实际禁止依赖验证检查器（含 domain→application 的纯类型和 domain→Node fs）。Snapshot 正反例分别检出顺序、根样式、文本空白和画布尺寸差异。预期来自手工表和 EXEC CFG，不调用生产校验器生成预期。

M02：`npm run verify:stage -- M02` 通过，87 tests / 2 files，失败 0、跳过 0；日志 `artifacts/logs/M02.log`。新增真实事务生命周期、prepared 回滚、跨文档、同 ID 大小写、独立索引/计数检查、不可变历史描述、资源限额和前写失败补偿。InvariantOracle 用损坏夹具验证重复父/循环入口/幽灵计数/错误索引会失败；生产未增加破坏入口。完整 Session 层、全部图形/结构及故障态测试仍 planned。

最终候选将从精确 SHA 干净检出执行锁文件安装、构建、verify、release 随机和覆盖率；完整 SHA 和结果写入提交外收据。未执行推送、final 或用户验收。
