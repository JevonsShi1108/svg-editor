# Phase 1 实现进度

目标：完整本地候选，未推送、未创建/移动 final；验收属于用户。

## 来源和现场

四份真实来源已在 `doc/spec/` 原路径，无附件重命名映射。LAB/SPEC/TEST/EXEC 是原有用户文件，保持内容。起始 Git 根为本项目；master 尚无提交；暂存区空；仅原有未跟踪 `doc/spec/`，无实现、测试或锁文件。未找到适用祖先或项目 AGENTS.md，现新建项目指引。Git 使用已有 JevonsShi1108 身份。

## 阶段

- M00 verified：基线、锁文件、工具链和输入细则。纯初始化，无功能测试，不计测试通过。verify:stage M00 与 npm audit（0 漏洞）已实际通过；Node/npm 版本及精确依赖锁定。
- M01 verified：统一值规则、不可变纯描述契约、独立快照正反例。76 个真实测试；strict/lint/format/dependency checks 通过；违规夹具确认禁止的 type-only 和 IO 边可被发现。完整跨入口 VAL 留待 CLI/Codec 就绪，不能由值层通过替代。
- M02 verified：CanvasRoot、rect/g、独占 Builder、活动索引、两类 Change、EditTransaction/EditLease 和双向日志回放。87 个单元测试（含已有 76）；M02 阶段门禁通过。原对象/属性缺失/子树索引/父关系在 active 与 prepared 回滚后恢复，跨文档和过期能力拒绝。
- M03 verified：六类图形、36 个 set 组合、Composite move/scale、自身样式及几何存在性。152 个确定性测试与 PROP-04/05/12 三条性质各固定 seed+新 seed×50 次通过；strict/lint/format/架构门禁通过。
- M04 verified：完整结构编辑、LCA/原文档顺序分组、一次性 GroupPlan 生命周期、嵌套解组、重挂/层序/子树删除、最终配额。171 确定性用例与 6 条性质各 2×50 次通过；group/ungroup 多点前写故障及 prepare 后回滚通过。
- M05 verified：不可变 HistoryEntry/双链栈头、屏障/no-op、文档/State/条目身份校验、连续性。176 确定性用例与 6 条性质各 2×50 次通过；10,000 条合法身份链的 push/pop 不复制整个历史。
- M06—M15 planned：不得把本阶段门禁冒充整体完成。

最新下一动作：M06 私有 SessionHead、串行 execute、CommandCatalog 和最小 CLI 适配切片；正式入口留 M11 真端口装配。

## 决策

采用 EXEC-P1 v1.0；Windows 是本轮必验平台，其他平台可选未执行。生产入口在 M11 接真实端口前不建立。

## 缺陷与下一动作

M01 修正了检查器配置错误：dependency-cruiser API 必须在调用层开启 validate，规则集 options 不接受该字段；以真实禁止边确认修复。M02 审查补充拒绝继承自 Object 原型的伪属性；类型之间按 SPEC 互相引用，但运行期导入图单独检查无环，分层规则仍覆盖 type-only。M03 修正测试夹具的根追加索引手算错误：根已有 parent，因此新节点应在索引 1（LAB 规定追加）；组内首节点为 0，未修改正确的产品预期。下一步 M04 结构算法和位置日志回归。
