# Phase 1 实现进度

2026-10-25 恢复结果：用户开启开发者模式后，原 test/integration/files.test.ts 未修改，19 项全部通过、0 skip；真实 file symlink 和 dangling link 的 read/save 拒绝、链接保留与原目标 OLD 均已实际断言。完整 npm run verify 已通过：767 passed、0 failed、0 skipped，静态/架构/覆盖率/8 项性能/315 个 local_required 全绿。此前 EPERM 和 BLOCKED 收据保留为历史；最终准确候选状态仍以提交后的干净检出收据为准。

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
- M11 verified：真实 NodeFileStore、编译 CLI 和原 FS-10 file/dangling symlink 全部实际通过（原文件19例），此前系统 EPERM 检查点保留在历史报告。
- M12 verified：完整19命令协议、36 CLI set、课程会话和9个真实进程 E2E 已纳入本次完整767例绿色门禁，含终端故障/恢复。
- M13 verified：独立平面节点模型、固定回放、故意非法请求和真实文件短序列通过；原 ci/release 配额保留，能力恢复后完整 verify 再次通过。
- M14 verified：339项追踪中315个 local_required 全部 verified；全767例、覆盖率、8性能、架构/静态、ci随机通过，FS-10阻塞解除。
- M15 本地前置 verified：课程报告、真实 PlantUML、SVG/浏览器证据及完整自动门禁已完成。最后必要提交后的精确 SHA 干净安装/构建/verify/release 由提交外收据闭合，不把预提交通过当作用户验收。

最新下一动作：提交本次已审查证据；从该完整 SHA 干净检出运行 candidate:verify，将准确结果写入提交外收据。全部自动门禁和10个收据子项闭合后才交用户验收。

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

M13 模型自检缺陷：REG-MODEL-ORACLE-01 依据 SPEC §6.1 / CFG-04 修正 empty dirty 和负零规范化；REG-MODEL-HARNESS-01 修正“注入 indeterminate 并不表示 save 已进入 IO”的文件核对条件。两者保留修复前日志、seed/path/replayPath、具体缩减请求和固定回归。v1 默认长度生成器失败已重放；v2 显式 size=max 保证实际长序列，旧反例可脱离生成器由具体请求回放。纯模型依赖只允许本目录和无行为类型；植入模型→Shape 的违规边已被实际检出。

REG-PREVIEW-SHAPE-01：按 SPEC ChangePreview 的受影响图形摘要契约，发现 dry create 只有 ID/位置，缺失创建内容。先保存 7 个固定失败用例，再使 PlacementChange 在写前捕获纯值 ShapeDescription；后续 describe 不读取 live 状态。六类型 preview 与手写初态、正式 commit 对应，回滚后及后续 set 后仍稳定；中段摘要分配失败也补偿此前 Placement。原 REG-GROUP/ungroup 的精确位置断言不放宽，独立补充新摘要字段预期。修复后完整 751 用例中 750 通过、仅 FS-10 仍 EPERM，0 skip，性能 8 项与覆盖率通过数值门槛；源摘要已重新验证。

M14 追踪与门禁检查点（2026-10-25）：逐项重新审查 339 个编号，包含 8 个 E2E；追踪存每条断言审查、实际 Vitest case 选择器和证据。检查器的编号正则曾遗漏带数字的 E2E 前缀，已固定提取回归并补齐这 8 条，不把仅有测试文件当作追踪闭合。M14 到期 local_required 共 310 条，FS-10 仍 blocked；M15 交付/预览保持 planned，变异 20 条未运行、远程/标签/截止 3 条验收后、DEL-08 由精确 SHA 收据关闭。23 个元数据自检断言检出缺证据、错误降级和未来项误通过；AST 检查禁止 .only/skip/todo 等遗漏修饰。

新增明确六类型 × 根/组内 CLI 创建和实际进程测试、大小写 ID 独立编辑/删除、非空 Group 自身三样式、Unicode 文本/原始属性 L−1/L/L+1 跨入口，以及 ungroup 首/中/末前写故障。完整覆盖率套件现 767 例，766 passed / 1 FS-10 EPERM、0 skip；语句 95.67% (1505/1573)、行 97.18% (1380/1420)、分支 92.86% (859/925)。M14 阶段静态、单元、属性、E2E、模型、性能通过；集成/覆盖率套件/追踪因同一个 FS-10 保持失败。实际收集日志和退出码见 artifacts/verification/latest-stage-M14.json，追踪报告 artifacts/traceability/report.json。新增 ci 档固定与新 seed 再次通过（artifacts/verification/latest-random-ci.json）。

verify、verify:stage、random:local/ci/release 都执行真实工具并保留每步日志/退出码/源码和锁文件摘要；失败后继续无依赖检查，最终仍返回失败，不重试到绿。verify 的全 local_required 检查不会预先要求自身最终收据。当前用户答复将开启开发者模式后通知，尚无开启完成确认，FS-10 不作人工延后。下一步 M15 报告/PlantUML、真实预览能力、精确 SHA 干净复验及提交外收据；尚未 READY。

M15 交付产物检查点：doc/README.md 已按实际代码完成架构方案、过程记录、一致性自查与质量保证；doc/architecture.puml 经官方 PlantUML 1.2026.8 校验 jar 在本地 Java 实际渲染，图和源摘要记录于 architecture.meta.json。两个 8 节点代表 SVG 经实际编译 CLI 保存并读回，真实浏览器已观察位置/中文/层序/继承并保存 PNG，source/SVG/截图摘要见 doc/examples/preview.json；E2E-08 verified，不等于用户验收。预览原沙箱服务超时，获批普通 Windows 只读 loopback 服务成功。

候选前 release 档已实际通过：16 性质各固定与新 seed ×1,000 次，模型每 seed 500×最多200命令/60节点，另有 MODEL-IO 每 seed 1,000 短真实文件序列；日志 artifacts/verification/latest-random-release.json。本轮无产品随机失败。完整 verify 当前仍仅因 FS-10 系统 EPERM 返回失败；Git 增量/报告/图/实现偏差四交付条目已核验，DEL-08 保持待最终收据。candidate:verify 会在干净精确 SHA 中实际 npm ci、build、verify（含覆盖率/性能/local随机）与 release，保留逐检查日志和10个闭合子项；不在被测提交中写自身SHA。

REG-DIAGRAM-EOL-01：7702cb7 精确干净检出的图源校验实际失败：工作区 CRLF 摘要25df14…，Git LF blob 摘要b409bd…（artifacts/logs/REG-DIAGRAM-EOL-01-before.json）。修复生成器先按仓库 LF 规则规范图源，再真实渲染并计算摘要；来源版本摘要也以 Git LF blob 记载。生产 sourceDigest 在原工作区和该干净检出完全相同885072b0…，代表 SVG/浏览器证据未受影响。修复后 doc:diagram 实际成功，追踪仅保留FS-10失败；下一精确SHA仍须完整安装复验。

能力恢复后的 ci 档亦实际通过：artifacts/verification/runs/2026-10-25T04-32-06.881Z-9412366b/report.json。16个性质各固定/新seed ×200次，MODEL-01每seed 100组×最多80命令/40活动节点，MODEL-IO每seed 200短真实文件序列。最终精确候选另跑release，不能由ci替代。
