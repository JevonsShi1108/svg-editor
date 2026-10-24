# Phase 1 实现进度

目标：完整本地候选，未推送、未创建/移动 final；验收属于用户。

## 来源和现场

四份真实来源已在 `doc/spec/` 原路径，无附件重命名映射。LAB/SPEC/TEST/EXEC 是原有用户文件，保持内容。起始 Git 根为本项目；master 尚无提交；暂存区空；仅原有未跟踪 `doc/spec/`，无实现、测试或锁文件。未找到适用祖先或项目 AGENTS.md，现新建项目指引。Git 使用已有 JevonsShi1108 身份。

## 阶段

- M00 verified：基线、锁文件、工具链和输入细则。纯初始化，无功能测试，不计测试通过。verify:stage M00 与 npm audit（0 漏洞）已实际通过；Node/npm 版本及精确依赖锁定。
- M01 verified：统一值规则、不可变纯描述契约、独立快照正反例。76 个真实测试；strict/lint/format/dependency checks 通过；违规夹具确认禁止的 type-only 和 IO 边可被发现。完整跨入口 VAL 留待 CLI/Codec 就绪，不能由值层通过替代。
- M02 verified：CanvasRoot、rect/g、独占 Builder、活动索引、两类 Change、EditTransaction/EditLease 和双向日志回放。87 个单元测试（含已有 76）；M02 阶段门禁通过。原对象/属性缺失/子树索引/父关系在 active 与 prepared 回滚后恢复，跨文档和过期能力拒绝。
- M03—M15 planned：不得把本阶段门禁冒充整体完成。

## 决策

采用 EXEC-P1 v1.0；Windows 是本轮必验平台，其他平台可选未执行。生产入口在 M11 接真实端口前不建立。

## 缺陷与下一动作

M01 修正了检查器配置错误：dependency-cruiser API 必须在调用层开启 validate，规则集 options 不接受该字段；以真实禁止边确认修复。M02 审查补充拒绝继承自 Object 原型的伪属性；类型之间按 SPEC 互相引用，但运行期导入图单独检查无环，分层规则仍覆盖 type-only。下一步 M03 六类型/36 set/Composite 几何和轻量属性。
