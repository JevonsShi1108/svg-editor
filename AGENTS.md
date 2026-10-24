# SVG Editor Phase 1

目标为可运行、可复验的本地 Git 候选；用户验收后才能处理远程和 final。

- 权威来源：`doc/spec/phase_cli_1.md` (LAB)、`SVG_Editor_Phase1_Implementation_Spec.md` v1.0 (SPEC)、`SVG_Editor_Phase1_Test_Plan.md` v1.0 (TEST)、`SVG_Editor_Phase1_Codex_Execution_Plan.md` (EXEC)。完整路径均在 `doc/spec/`。
- 外围输入采用 `doc/INPUT_PROFILE.md` 的 EXEC-P1 v1.0，较晚的用户明确决定优先。不得编造缺失来源。
- TypeScript strict、OO、一类一文件（文件名=类名）、Command、Composite。命令名称分派只在 CommandCatalog；图形名称分派只在 ShapeFactory。
- domain 不导入 application/cli/infrastructure/DOM/Node IO。application 不导入具体基础设施。CLI 经应用公开入口，只拿值描述。main 只装配。
- 修改只通过未发布 Builder 或有效事务；仅 NodeStateChange/PlacementChange 两类记录。Session 串行、准备完整后发布，不泄露 live Document/Shape/authority/lease。
- 每个增量：规范断言→实现→相关真实测试/静态检查→修复→回归→审查明确路径和 staged diff→本地提交→记录进度→自动继续。
- M01 起测试不得为空；未来用例 planned。禁止降低预期/覆盖率、跳过必须项、空壳通过、.only。随机失败保存 seed/path/replayPath 和最小序列，先固定回归再修复。
- 测试替身只在 test。正式 CLI 必须真实 Codec/FileStore 装配。不要新增 box、GUI、完整 CSS/transform 或 CLI 协议。
- 保留用户改动，不 reset/清理；只提交明确审查的文件。已有 Git 身份，不编造、不绕过签名。禁止 push/远程仓库/PR/发布/final 标签操作。
- 跟踪 `doc/PROGRESS.md`、`doc/TEST_TRACEABILITY.md`、`doc/TEST_REPORT.md`；未跟踪 `artifacts/progress/runtime.json` 保存实时 SHA/下一动作/失败。
- 阶段 verify:stage 只验到期项；最终 verify 验全部 local_required 并执行必须测试及 local 随机。最终 release、覆盖率、精确 SHA 干净安装构建验证不可省略。
- 最终收据在被测提交之外，不自引用；人工预览、验收后和可选项明确未执行且不计通过。自动门禁完毕才能 READY_FOR_USER_REVIEW，不等于用户验收。
