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
- M10 verified：19 命令已绑定；真实 Codec+可控测试 FileStore 完成原子 read/save、保存点/dirty、三态、受控队列、完整 REG-STATE/REG-SAVE、poisoned read 恢复。214 单元/回归、261 集成、15 性质各 2×50 次通过。
- M11 implemented_unverified：真实 NodeFileStore、编译 CLI 已实现；build/type/lint/format/deps、214 单元、15 性质、276 集成、1 编译进程 E2E 通过。必须 FS-10 的真实文件符号链接/悬空链接夹具在正常 Windows 环境也因 EPERM 不能创建（1 集成失败），阶段门禁退出 1，未记完成。已异步请求系统链接能力；同一断言保留，没有 skip 或改为人工。
- M12 implemented_unverified：完整 19 命令手写 parse/bind 表、错误恢复、36 个 CLI set、终端转义、可定位的变化预览/历史摘要、PROP-16 与真实课程会话已完成。288 单元/回归、16 性质各 2×50 次及 7 编译进程 E2E 通过；集成唯一未通过项仍为 FS-10 系统能力。完整阶段门禁未关闭。
- M13—M15 planned：继续独立模型、覆盖率和报告；完整门禁仍必须等 FS-10。

最新下一动作：M13 独立快照模型及可重放长序列；等待用户确认开发者模式已开启后复跑真实 FS-10。M11/M12 是如实记录能力阻塞的本地检查点，不能作为全绿候选。

## 决策

采用 EXEC-P1 v1.0；Windows 是本轮必验平台，其他平台可选未执行。生产入口在 M11 接真实端口前不建立。

## 缺陷与下一动作

REG-REQUEST-SHAPE-01：缺失/非字符串图形类型会使诊断参数违反纯标量契约；先保存失败日志 `artifacts/logs/REG-REQUEST-SHAPE-01-before.log`，再补类型验证及固定回归。M12 将 ChangePreview 明确为纯值联合，状态变化含目标 type/id，历史结果在发布前准备受影响图形的当前描述。

M12 预言机校准：成功路径按已采纳 EXEC-P1 §4.7 的稳定绝对路径核对，保留 LAB 文件名和动态 5/7/8 计数；不把示例路径显示形式当成业务路径契约。独立 XML 库 xmldom 默认使用 XML 1.1 行尾规范化，现按 W3C XML 1.0 §2.11 配置仅 CRLF/CR→LF，并用 NEL/行分隔符/字符引用的手写测试校准；没有放宽文本保持预期。

ENV-FS10：沙箱 AppContainer 临时目录原生 rename 也 EPERM，而项目目录内探针成功。获批普通 Windows 环境后，真实文件替换/编译 CLI 已通过；真实文件 symlink 仍 EPERM，说明还有系统链接能力缺失。实际失败在 `fs.symlink(target, link, 'file')`，尚未进入编辑器拒绝链接的断言。日志 `artifacts/logs/M11.log`（276 passed/1 failed）和 `M11-e2e.log`（1 passed）。保留此必须门禁，最小解除方式为 Windows 开发者模式或创建符号链接权限；不得用 mocked lstat 的通过替代真实夹具。

REG-CANDIDATE-01：审查并固定复现 init 候选准备内部错误会误 poison 原可信文档（`artifacts/logs/REG-CANDIDATE-01-before.log`）。修复为候选构建失败保留旧 Head；只有已发布文档的写入/回放完整性失败才转 poisoned。M10 read/save 的只读候选准备同样隔离。M10 新增 read 帮助的 `<file.svg>` 暴露提示符测试的子串误判；提示符断言改为行起始/实际 stdout 写调用，保持非 TTY=0、TTY=3 的原期望，不将合法帮助文本当提示符。

REG-ROOT-PX-01：独立 XML 正例发现根 font-size="0px" 被按内存裸数误拒绝。先运行最小固定回归确认失败（`artifacts/logs/REG-ROOT-PX-01-before.log`），然后在 Decoder 用 CanvasRoot 同一 schema 进行 SVG 归一化再交 Builder；子节点和根保持同样规则，未放宽单位。

REG-LIMITS-01：审查发现空/缺字段 ResourceLimits 会绕过构造验证。先运行固定回归确认失败（`artifacts/logs/REG-LIMITS-01-before.log`），再要求恰好五个字段且各自为正安全整数。固定回归纳入 test:unit 的 test/regressions，不通过改预期修复。M07 全阶段门禁恢复绿色。

M01 修正了检查器配置错误：dependency-cruiser API 必须在调用层开启 validate，规则集 options 不接受该字段；以真实禁止边确认修复。M02 审查补充拒绝继承自 Object 原型的伪属性；类型之间按 SPEC 互相引用，但运行期导入图单独检查无环，分层规则仍覆盖 type-only。M03 修正测试夹具的根追加索引手算错误：根已有 parent，因此新节点应在索引 1（LAB 规定追加）；组内首节点为 0，未修改正确的产品预期。M06 审查将 Session 的全部内部方法改为运行期 # 私有，防止绕过 execute 获得 live Document；负例已执行。
