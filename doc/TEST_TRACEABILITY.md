# Phase 1 测试追踪

权威编号来自 `spec/SVG_Editor_Phase1_Test_Plan.md`；可执行追踪存 `traceability.json`，每条保留来源行、断言、required_by、gate_scope、状态、测试路径和证据。当前功能均 planned，不计通过。

M00 只执行工具链/文档初始化，无功能测试。最终门禁必须拒绝任何到期 local_required 缺少真实证据；candidate_verification 只由提交外最终收据关闭。

M01 部分证据：`test/unit/values.test.ts` 的 76 个真实断言用例和 `test/helpers/SemanticSnapshot.ts` 正反样例；`scripts/check-deps.mjs` 包括真实违规夹具。VAL/几何/文本/限额的跨入口部分尚不具备依赖，未记整条 verified。阶段门禁为 `npm run verify:stage -- M01`。

M02 部分证据：`test/unit/core.test.ts`（11 个用例）通过真实 rect/g 与两类原语覆盖 TX-01—09 当前适用部分、CRT/INV/STR-16/17 的领域切片、FAIL-02/03 前写失败。`test/helpers/InvariantOracle.ts` 的独立遍历与损坏负例均执行。完整各编号跨入口义务仍按原 required_by 保留，不因局部通过而关闭。

M03 领域子场景证据：`test/unit/shapes.test.ts` 含 6×2 创建、36×set、每叶 move/scale 独立手算、GEO-03—10/SET-02—09 相关领域断言；`test/property/geometry.test.ts` 实际运行 PROP-04/05/12。状态/CLI 相关子场景按 EXEC 仍留 M07/M12；不把领域组合完成冒充全部跨入口完成。

合法延后范围：E2E-08 环境无法可视预览时 manual_acceptance；DEL-02/03/04 标签/推送/截止 after_user_acceptance；显式可选变异/额外平台 optional。其他必须项不允许擅自延后。
