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
- M06 verified：私有 SessionHead/协调能力、唯一 Catalog、8 命令切片、串行请求复制冻结、准备完整再发布、Parser/Presenter/REPL 真实内存适配链。211 单元、9 集成、6 性质通过，性质各 2×50 次。假端口仅在 test，无生产启动 stub。
- M07 verified：17 内存命令、canvas、真实 dry-run 回滚、no-op/屏障/身份/revision、部分回放补偿、poisoned 隔离与 init 恢复。212 单元/固定回归、90 集成、12 性质各 2×50 次通过；read/save 相关子项按 EXEC 留 M10。
- M08 verified：独立 XmlSvgEncoder、共享 XML 字符规则、schema 属性元数据复用。212 单元/回归、109 集成（新增 19 编码独立预言机）、12 性质各 2×50 次通过；严格子集 decode 仍未接入。
- M09 verified：saxes 严格 namespace/内容模型/DTD/PI 拒绝、两遍全局 ID、纯文本/CDATA、五项限额准入、六类往返与规范化。213 单元/回归、233 集成、15 性质各 2×50 次通过；root px 缺陷已有修复前失败及固定回归。
- M10—M15 planned：不得把本阶段门禁冒充整体完成。

最新下一动作：M10 read/save 候选协议、保存点/dirty、保存三态和受控异步队列；正式入口仍留 M11 真端口装配。

## 决策

采用 EXEC-P1 v1.0；Windows 是本轮必验平台，其他平台可选未执行。生产入口在 M11 接真实端口前不建立。

## 缺陷与下一动作

REG-ROOT-PX-01：独立 XML 正例发现根 font-size="0px" 被按内存裸数误拒绝。先运行最小固定回归确认失败（`artifacts/logs/REG-ROOT-PX-01-before.log`），然后在 Decoder 用 CanvasRoot 同一 schema 进行 SVG 归一化再交 Builder；子节点和根保持同样规则，未放宽单位。

REG-LIMITS-01：审查发现空/缺字段 ResourceLimits 会绕过构造验证。先运行固定回归确认失败（`artifacts/logs/REG-LIMITS-01-before.log`），再要求恰好五个字段且各自为正安全整数。固定回归纳入 test:unit 的 test/regressions，不通过改预期修复。M07 全阶段门禁恢复绿色。

M01 修正了检查器配置错误：dependency-cruiser API 必须在调用层开启 validate，规则集 options 不接受该字段；以真实禁止边确认修复。M02 审查补充拒绝继承自 Object 原型的伪属性；类型之间按 SPEC 互相引用，但运行期导入图单独检查无环，分层规则仍覆盖 type-only。M03 修正测试夹具的根追加索引手算错误：根已有 parent，因此新节点应在索引 1（LAB 规定追加）；组内首节点为 0，未修改正确的产品预期。M06 审查将 Session 的全部内部方法改为运行期 # 私有，防止绕过 execute 获得 live Document；负例已执行。
