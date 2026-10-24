# SVG 编辑器 Phase 1 测试方案

**需求追踪、测试预言机、用例设计与验收流程**

- 文档版本：1.0。
- 整理日期：2026-10-25。
- 适用项目：Lab1 Phase 1，TypeScript 命令行 SVG 编辑器。
- 实现基线：`SVG_Editor_Phase1_Implementation_Spec.md`，版本 1.0。
- 原始要求：`phase_cli_1.md`。
- 文档性质：测试设计及执行指导。文中用例、门槛、随机运行规模均为待实施方案，不代表已有代码、测试已经执行或已经通过。
- 建议工程落点：`doc/TEST_PLAN.md`；实际运行结果另记入 `doc/TEST_REPORT.md`，并在课程要求的 `doc/README.md` 中概述质量保证证据。

本方案以“行为符合要求、状态转移可信、边界没有被绕过”为验收核心。普通命令用确定性用例建立基础；事务、历史和结构编辑用不变量、属性及独立参考模型覆盖组合风险；SVG 与文件写入使用独立夹具和故障注入验证；架构与交付要求单独审查。覆盖率用于发现遗漏，不能代替这些证据。

## 目录

1. [来源、范围与验收原则](#test-01)
2. [测试前需要统一的输入与配置细则](#test-02)
3. [测试层次、工具与组织](#test-03)
4. [状态等价、快照与不变量](#test-04)
5. [需求与测试追踪矩阵](#test-05)
6. [公共夹具与用例书写规则](#test-06)
7. [CLI 与命令功能测试](#test-07)
8. [结构编辑算法测试](#test-08)
9. [历史、屏障、dirty 与 revision 测试](#test-09)
10. [事务、权限、dry-run 与故障状态测试](#test-10)
11. [SVG 编解码、安全与自动 ID 测试](#test-11)
12. [文件 IO、保存提交点与队列测试](#test-12)
13. [属性测试](#test-13)
14. [独立参考模型与状态机测试](#test-14)
15. [端到端验收与预览](#test-15)
16. [架构、静态检查与代码审查](#test-16)
17. [资源、性能与内存验证](#test-17)
18. [变异测试与测试有效性审查](#test-18)
19. [增量实施、持续验证与发布门槛](#test-19)
20. [测试报告与最终交付检查](#test-20)
21. [资料与来源索引](#test-21)

<a id="test-01"></a>

## 1. 来源、范围与验收原则

### 1.1 来源标记与优先级

| 标记 | 含义 | 使用方法 |
| --- | --- | --- |
| LAB | `phase_cli_1.md` | 原始命令、面向对象范式、输出、Git 和报告要求 |
| SPEC | `SVG_Editor_Phase1_Implementation_Spec.md` | 已确认的 D01—D10、架构、接口、状态转移与支持范围 |
| TEST | 本测试方案提出的做法 | 工具、组织、测试数据、运行规模和质量门槛 |
| CFG | 尚需集中记录的输入或配置细则 | 采用第 2 节的明确选择后，才形成该类边界的确定性预期 |
| W1—W8 | 第 21 节官方资料 | 测试工具能力与 XML/SVG 技术事实 |

LAB 的硬性要求必须覆盖；已经由 SPEC 明确解决的歧义按最终契约测试。例如成功空编辑保留 Redo、无参数 save 使用最近成功路径、严格 SVG 子集均按 SPEC 执行。项目会话中已保存的有效决策通过 SPEC 的 D01—D10、v0.2 架构和接口定稿追踪，不另造一套口头基线。[LAB §1—§4；SPEC §1—§2]

测试发现规范冲突时，记录涉及的条款、可复现输入和影响，修订统一基线后再改用例。不能仅因实现当前输出了某个结果，就把它录为预期。

### 1.2 当前范围

**必须验证的用户功能：**

- 19 个命令：init、read、save、canvas、create、delete、move、scale、set、group、ungroup、addto、front、back、tree、show、help、undo、redo。
- 六种图形：rect、circle、ellipse、line、text、g。
- 组合结构、SVG 读写、明确的错误信息和 REPL 连续运行。
- 应用 API 的 dry-run、串行执行、结构化结果与异常效果分类。
- 已确定的事务、历史、身份、保存检查点、资源限制和封装边界。

**不作为本阶段功能验收目标：**

box 插件、动态插件管理器、完整 CSS/transform、GUI、选择和命中测试、内嵌渲染器、JSONL CLI、宏事务、历史持久化、跨进程协同。应验证这些边界不会被意外放宽，例如 `create box` 必须报未知类型、导入 transform 必须拒绝。应用 dry-run 不意味着增加 `dryrun` CLI 命令。[SPEC §1.5、§12.4、§13.5]

### 1.3 优先级

| 优先级 | 含义 | 发布要求 |
| --- | --- | --- |
| 必须 | 原始功能、确定性核心回归、不变量、事务/IO 安全边界、架构约束 | 存在未解决失败时不能宣称通过验收 |
| 强化 | 随机属性、状态机、扩大故障组合、性能与内存趋势 | 本方案建议至少执行轻量版本；未执行须在报告中明确 |
| 可选 | 系统化变异测试、额外平台及更长压力运行 | 按收益安排，不替代必须项 |

第 19 节给出建议的完整发布门槛。不要通过大量低价值重复用例挤占高风险组合测试。

### 1.4 六条防止“测试本身写错”的规则

1. **撤销恢复的是文档内容和历史内容身份，revision 不回退。** 不对 undo 前后的整个 SessionStatus 做相等断言。
2. **普通失败、保存结果不确定、内部不可信是三类结果。** 只有普通失败要求完整会话不变；external-unknown 的内存不变但不能断言目标文件没变；untrusted 要验证 poisoned。
3. **缺失属性与显式默认值不同。** 不把 `fill` 缺失与 `fill="black"` 在比较器中合并。
4. **group 与 ungroup 不是一般意义的互逆命令。** 顶层组不能解散；不连续或跨父分组也改变原归属和层序。通用逆操作应测试 undo。
5. **往返通过不等于 Codec 正确。** encoder/decoder 可能犯对称错误，必须增加手写预期和独立 XML 检查。
6. **规范化不等于字节保真。** XML 缩进、引号和属性顺序可变化，文本、结构、显式属性存在性及支持的只读属性不能丢失。[SPEC §2.2、§8、§10.7、§12]

<a id="test-02"></a>

## 2. 测试前需要统一的输入与配置细则

这一步只处理基线未细化的外围规则。核心架构和已确认用户语义不重新讨论。下列“建议”属于 TEST，不冒充 LAB/SPEC 的原有要求；实现相关功能时把最终选择集中记入 `doc/INPUT_PROFILE.md` 或实现规范的配置附录，并让测试引用该版本。

### 2.1 决策登记表

| 编号 | 需要明确的边界 | 本方案建议与测试处理 |
| --- | --- | --- |
| CFG-01 | init/canvas 单尺寸参数 | 建议只接受 0 或 2 个尺寸，1 个报语法错误；无参 init 800×600，无参 canvas 查询已经确定 |
| CFG-02 | group 最小目标数 | 建议至少 2 个不同目标，与 LAB 的 id1/id2 语法一致；0/1/2 个分别测试，1 个的预期取决于最终记录 |
| CFG-03 | 零尺寸、零半径、零笔画 | 建议画布宽高 >0，图形宽高/半径/stroke-width ≥0；负坐标允许。不要把所有数值一律要求 >0 |
| CFG-04 | 数值词法、负零和下溢 | 建议完整十进制/科学计数解析；输入 -0 统一规范为 +0；对非零运算结果下溢成 0 明确选择拒绝或允许并记录。NaN/Infinity/尾随垃圾/溢出拒绝已经确定 |
| CFG-05 | px 与 viewBox 词法 | 明确 SVG 长度是否接受显式 px；CLI 数字建议仅裸数；viewBox 分隔符和数值等价规则统一。百分比/em 与非规范坐标变换已确定拒绝 |
| CFG-06 | 引号和转义 | 必须支持双引号与未闭合检测；建议只专门处理引号、反斜杠的转义，其他反斜杠保留字面含义。不要自动做 shell 展开；文本换行测试可通过 API/XML 输入 |
| CFG-07 | ID 词法 | 记录完整可接受集合，包含空串、空白、中文、首字符和长度规则；大小写敏感、不自动 trim、不自动修复非法显式 ID 已确定。建议先选明确的合法子集，避免各入口自行猜测 |
| CFG-08 | 颜色词法及规范化 | 至少明确命名颜色、none、#RGB/#RRGGBB；#RGBA/#RRGGBBAA 是否支持、大小写是否规范化须记录；url()/var()/复杂 paint 拒绝已确定 |
| CFG-09 | 缺省几何和画布尺寸推导 | 逐属性记录“可省略及默认值”或“必填”；记录缺失 width/height 能否由 viewBox 推导。允许缺省时必须保留显式存在性，不能由测试任意补齐 |
| CFG-10 | 根与只读属性 schema | 列出根/g/叶各自允许的 fill、stroke、stroke-width、font-size、text-anchor、data-kind 等；尤其说明根 id、xmlns 声明、字体零值、data-kind 值和位置。根允许的继承属性不得丢失 |
| CFG-11 | 文本内容模型与 XML 词法细节 | text 为纯文本；明确 CDATA/注释的处理、容器排版空白、XML 声明编码与版本、UTF-8 BOM；建议只接受 UTF-8、XML 1.0，CDATA 作为纯文本来源，不保留其字面形式 |
| CFG-12 | 资源阈值与计量 | 生产阈值由 composition 统一确定；maxSvgBytes 用 UTF-8 字节，节点计数不含根，深度建议根=0、直接孩子=1；文本/属性长度建议按 Unicode 标量计数，并记录是否还有原始词法长度限制 |
| CFG-13 | SVG 输出的字节准入 | maxSvgBytes 在 SPEC 中是输入限制；单独决定 save 是否限制输出大小。不能因输入上限而擅自要求每次编辑重新编码全文，也不能自动断言大输出 save 必须失败 |
| CFG-14 | 文件系统平台策略 | 明确支持的操作系统、相对路径的解析基点、符号链接目标处理、目录目标、临时文件命名与替换能力。普通文件原子替换三态契约已确定；symlink 策略不能由测试猜测 |
| CFG-15 | 非规定文本、输出流与退出 | 建议正常结果到 stdout、诊断到 stderr；明确 EOF/致命呈现错误的进程行为。原文固定错误文本必须保留，不为每条 REPL 错误设计独立进程退出码 |
| CFG-16 | 工具版本与多错误优先级 | Node、TS、XML 库和测试库锁版本；未规定的多重错误优先级先不锁死，需求用例采用单故障输入；最终确需优先级时集中记录 |
| CFG-17 | poisoned 的诊断元数据 | state=poisoned、dirty=null、受限操作已确定；故障转移时 revision 如何反映发布、history 诊断字段如何保留须记录，建议首次故障转移 revision +1，失败恢复尝试不再递增 |

退化图形与有效绘制不是同一概念。采用 CFG-03 的非负规则有 SVG 几何语义依据，但它仍是本项目需要明确写下的选择。[W7]

### 2.2 如何让这些细则可执行

- 每个 CFG 项记录“选择、理由、受影响用例、版本”；不把一条待决测试长期 `skip` 后仍报告验收完整。
- 已确定的核心用例先实施。只有依赖未定边界的参数行标注 `[CFG-xx]`。
- 数值、颜色、ID 等在生产代码中共用验证器；测试预期来自独立登记的规则表，不能直接把生产 schema 的返回值当正确答案。
- 不要求为了测试添加 JSONL、选择状态或通用插件系统。
- 来源未给出具体提交截止日期，方案不填写虚构日期。

<a id="test-03"></a>

## 3. 测试层次、工具与组织

### 3.1 分层及各自负责的问题

| 层次 | 测试对象 | 真实组件 | 替身范围 | 主要证据 |
| --- | --- | --- | --- | --- |
| 值与领域单元 | 值规则、Shape、Document、Placement、ChangeSet | 真实领域实现 | 必要的测试构建器 | 字段、层级、索引、身份、精确恢复 |
| 应用契约 | EditorSession、HistoryManager、全部请求 | 真实命令/领域/历史 | FakeCodec/FakeFileStore | 结果标志、屏障、dirty、revision、原子性 |
| Codec 集成 | XmlSvgCodec 与 Builder/Factory | 真实 XML 适配器和领域 | 无文件 IO | 输入准入、语义保持、独立 XML 预期 |
| 文件适配器 | NodeFileStore | 真实临时目录及文件 | 仅故障点使用底层替身 | 文件内容、写入阶段、结果分类 |
| CLI 适配 | Tokenizer/Catalog/Presenter | 真实解析与映射 | 内存输入输出 | 引号、参数、固定文案、输出隔离 |
| 端到端 | CLI 进程→Session→Codec→文件 | 实际启动入口 | 仅受控临时目录 | 课程会话、错误后继续、可读可写 |
| 性质与状态机 | 小文档、合法/非法请求序列 | 真实应用和领域 | 内存文件系统、独立模型 | 组合缺陷和最小反例 |
| 静态与人工 | 源码依赖、封装、OO、报告/Git | 实际代码与仓库 | 无 | 非功能性硬要求 |

Session 测试不能把 Document/History 全 mock 掉，否则测到的只是一层转发。端到端测试也不能代替字段级的领域断言。

### 3.2 工具选择

| 工具 | 用途 | 约束 |
| --- | --- | --- |
| Vitest | 统一测试、断言、少量模块替身、覆盖率 | Node 环境；CLI 项目无须默认 jsdom |
| fast-check | 有界数据生成、属性测试、可缩减命令序列 | 失败保存 seed、path；commands 状态机另存 replayPath；保留具体序列与锁文件版本 |
| TypeScript 编译器 | strict 类型检查 | 测试代码也纳入类型检查；不要认为测试运行器自动完成所有 TS 检查 |
| ESLint 与格式检查 | 静态约束与可读性 | 规则不替代 OO 人工审查 |
| dependency-cruiser | 源码依赖规则、循环依赖 | 必须包含 type-only 依赖，正确解析路径别名 |
| StrykerJS | 可选变异测试 | 先限定核心模块，审查存活变异，避免追逐单一分数 |
| Node 子进程与临时目录 | 真实 CLI/文件验收 | 不访问用户真实文件；每个用例有独立目录 |

fast-check 提供命令前置检查、运行、序列生成和异步模型执行；其官方文档明确提醒，参考模型应比被测系统更简单，避免自我比较。[W1] Vitest 支持覆盖率，但必须显式设置 `coverage.include`，否则未被导入的源文件可能不出现在报告中。[W3]

### 3.3 建议目录

| 路径 | 内容 |
| --- | --- |
| `test/unit/domain/` | 值、六种 Shape、Document、两类 Change、事务权限 |
| `test/unit/application/` | HistoryManager、Catalog、Session 状态转移 |
| `test/unit/cli/` | tokenizer、参数规则、Presenter |
| `test/integration/codec/` | SVG 正反例、独立 XML 检查、往返 |
| `test/integration/files/` | NodeFileStore 与真实临时文件 |
| `test/integration/session/` | 真实核心配端口替身、队列与故障注入 |
| `test/e2e/` | 独立于实现细节的 LAB 验收会话 |
| `test/property/` | 有界随机性质 |
| `test/model/` | 独立参考模型和状态机命令 |
| `test/architecture/` | 依赖规则与封装检查 |
| `test/performance/` | 单独运行的规模/内存趋势 |
| `test/fixtures/` | 手写 SVG、命令脚本、预期语义描述 |
| `test/support/` | Snapshot、InvariantOracle、FakeFileStore、ControlledDeferred 等 |
| `test/regressions/` | 随机测试缩减出的长期固定反例 |

测试辅助类采用一类一文件，纯类型可以分组。测试模型使用简单数据结构是刻意的独立性设计，不允许被生产代码导入。

### 3.4 测试可见性与替身

公共 Session 只有 `execute`。不要为测试增加 `getLiveDocument()`、`getHead()` 或导出内部 authority。

- Session 黑盒通过 `tree/show/canvas` 的 DTO 和每次 ExecutionResult.status 检查可观察结果。
- Domain/History 单元测试用自己构造并持有的文档、节点、条目验证身份和权限。
- 值快照只读且独立；必要的测试专用内部入口只在测试构建中可用，不在公共 barrel exports 中导出。
- FakeFileStore 记录 resolve/read/replace 参数，控制结果与完成时机；FakeCodec 可在 decode/encode 抛出受控错误。
- 要验证 prepare 后失败，使用受限内部协作者替身或测试构建点，不让生产 publish 接受任意外部回调。
- 不在没有具体故障风险时对每个私有方法调用次数写测试；调用计数主要用于提交次序和性能边界。

<a id="test-04"></a>

## 4. 状态等价、快照与不变量

### 4.1 三种比较层次

记文档语义为：

\[
D_{\rm sem}=(\text{画布},\text{根保留属性},\text{有序节点树},\text{每个节点的自身状态})
\]

自身状态包含类型、公开 ID、几何、文本、显式属性存在性、允许保留的只读属性与元数据。树的兄弟顺序不能排序后再比较。

记可观察会话为：

\[
S_{\rm obs}=(D_{\rm sem},\text{state},\text{path},\text{dirty},U_n,R_n,b,v)
\]

其中 `U_n/R_n` 是栈长度，`b` 为屏障，`v` 为 revision。无文档/poisoned 时不能通过 tree 读取不可信内容。

核心内部进一步包含 DocumentId、StateId、savedStateId、节点稳定身份、实际栈条目、活动索引和事务生命周期。不同层分别验证，不能为了在黑盒中比较内部 token 而泄露它们。[SPEC §5—§8]

| 场景 | 应比较 | 不应要求 |
| --- | --- | --- |
| undo 后恢复 | 文档语义、应恢复的内容身份、历史移动 | revision 回到旧值、历史两栈完全不变 |
| redo 后恢复 | 已记录的 after 状态及原节点身份 | 重新执行原命令或新建同名节点 |
| decode(encode(D)) | 文档语义 | 对象/DocumentId/历史/路径不变 |
| 普通失败 | 完整可信会话及核心内部可继续性 | 新的成功警告或保存检查点 |
| 成功 dry-run | 完整原会话不变；preview 是独立值 | 解除屏障、分配对外可见状态 |
| external-unknown | 内存会话不变，错误分类正确 | 目标文件一定还是 OLD |
| untrusted | poisoned、dirty=null、操作受限 | 原会话完全恢复或普通错误继续编辑 |

### 4.2 比较器的设计

`SemanticSnapshot` 必须：

- 保留 children 的顺序，保留空 Group。
- 对属性使用“缺失/显式值”的表示，区别 `undefined` 缺失和显式默认。
- 把文本当精确字符串，保留空格、换行、中文和补充平面字符。
- 根尺寸及支持的根属性参与比较。
- 排除路径、历史、revision、DOM 和节点引用。
- 允许对无语义的属性列举顺序做规范排序；禁止对图形兄弟排序。
- 数值依冻结的 -0 规则比较；不使用会吞掉 NaN/Infinity 的 JSON 序列化代替数值断言。

**精度规则：** Undo/Redo 由 Memento 恢复时应精确相等；Codec 使用足以恢复同一个有限 double 的编码时应精确相等。几何运算预期用同一输入独立计算一次并核对字段，不把误差容忍用于掩盖恢复丢精度。仅对额外的数学近似性质设置独立的绝对/相对误差，不能给所有测试套一个宽松 epsilon。

### 4.3 文档不变量

每条确定性操作、每个模型状态机步骤以及每次可恢复失败之后，对仍然可信的 ready 文档执行以下检查。empty 状态验证没有文档；poisoned 状态只验证故障隔离，不能继续遍历旧文档。生产正常编辑不因此被要求每次全树扫描。

| 编号 | 不变量 | 独立检查办法 |
| --- | --- | --- |
| INV-01 | 根唯一、无父；叶子没有孩子 | 从 root 遍历并核对节点能力 |
| INV-02 | 每个活动图形恰有一个父容器 | 身份集合检测重复可达，核对 parent 与 children |
| INV-03 | 不成环 | 按对象身份维护访问集；检测重复访问，不只看 ID |
| INV-04 | 活动 ID 全局唯一、大小写敏感 | 遍历得到独立 Map |
| INV-05 | 活动索引恰好对应可达树 | 核对索引大小、所有 key、每个 key 对应对象；额外核对已删除 ID 不可查 |
| INV-06 | nodeCount 等于可达 Shape 总数 | 遍历计数，不含根 |
| INV-07 | 所有活动节点属于同一 Document，且 owner 自创建起不变 | 对比 ownerDocumentId；在删除、重挂和回放前后核对稳定身份 |
| INV-08 | 数值、文本、属性和结构资源合法 | 对照独立边界表和注入配额 |
| INV-09 | 节点自身状态不包含动态父子结构副本 | 快照/结构操作交叉检查与代码审查 |
| INV-10 | 命令结束后无遗留活动事务 | 再开始合法事务或下一次有效编辑应成功 |
| INV-11 | 分离子树内部 parent 可以保留，但都不是活动成员 | 删除组后分别检查每个后代 isAttached/index |
| INV-12 | 查询及 DTO 修改不能修改文档 | 尝试修改返回嵌套数组/属性；再次查询仍原值 |

仅调用生产 `doc.assertInvariants()` 不足以证明自身检查器正确。应同时使用独立遍历的 `InvariantOracle`，并用少量测试专用损坏夹具验证它能发现重复父节点、环、索引残留和错误计数。损坏只存在于隔离测试构建，不暴露生产写接口。

若公共读接口只能遍历到可达节点，无法枚举所有索引项，就通过领域测试内部检查和“删除后逐 ID 查询 + 索引规模检查”补齐，不能声称只遍历树就能证明没有幽灵索引。

### 4.4 会话与历史不变量

- ready 文档的 dirty 与保存内容身份关系一致；empty 为 false，poisoned 为 null。
- HistoryEntry 与 ChangeSet 属于同一 Document。
- Undo 栈顶的 afterStateId、Redo 栈顶的 beforeStateId 与当前身份匹配。
- 一条实变编辑新增一个用户历史条目；多步 group/递归变换不拆成多个。
- 没有实际内容变化时不新增条目、不清 Redo。
- 历史回放移动原条目；不重新创建业务命令、图形或内容身份。
- 成功发布的 revision 单调；查询、dry-run、普通失败不增加。
- 所有请求，包括查询，在单个 Session 中串行。
- DTO、preview、HistoryManager 旧值和 Memento 不受后续编辑反向污染。
- 普通失败后不仅快照相同，还要能继续成功编辑/undo/redo，防止“数据恢复了但锁没释放”。

<a id="test-05"></a>

## 5. 需求与测试追踪矩阵

下表是实施时的覆盖账本。每个用例 ID 应出现在测试名称或用例元数据中；一行可以由参数化测试产生多个实例。证据栏在执行后填写测试文件、结果和提交 SHA，而不是填写“预计通过”。

| 需求 | 来源 | 测试族/重点用例 |
| --- | --- | --- |
| 19 个命令及参数 | LAB §3；SPEC 附录 A | CLI-01—CLI-14、DOC、CRT、GEO、SET、STR、QRY、HIS、E2E |
| 显式 ID、大小写、全局唯一 | LAB §2；SPEC §5.1 | CRT-04/05、ID-01—ID-11、HIS-09 |
| 六类图形及父容器 | LAB §4.1 | CRT-01—CRT-09 |
| 36 个 set 白名单组合 | LAB §4.1；SPEC 附录 A.3 | SET-01—SET-09 |
| 增量移动、原点缩放、Composite | SPEC D01、§3.4 | GEO-01—GEO-10、PROP-04 |
| Group.set 的自身属性语义 | SPEC D04 | SET-03/04、STR-14 |
| 分组 LCA/顺序/插入位置 | SPEC D02/D03、§9.3 | STR-01—STR-07、REG-GROUP |
| 解组顶层限制与提升顺序 | LAB §4.2；SPEC §9.4 | STR-08—STR-10 |
| 重挂、层序、删除子树 | SPEC §9 | STR-11—STR-17、INV、HIS-09 |
| 一命令一个历史单元 | LAB §4.3；SPEC §8.6 | HIS-01—HIS-03、TX、REG-GROUP |
| 文档屏障、空操作例外 | SPEC D05/D06 | HIS-04—HIS-08、DOC-05、DRY-03 |
| StateId/dirty/revision | SPEC §8.7 | HIS-10—HIS-13、REG-STATE |
| 当前路径及无参保存 | SPEC D09、§11.5 | DOC-03/06、IO-01—IO-10 |
| canvas 不缩放内容 | SPEC D10 | DOC-04/05、TX-10 |
| 修改权限及生命周期 | SPEC §7.3—§7.7 | TX-01—TX-09、ARCH |
| prepare 后统一发布 | SPEC §8.1—§8.3 | FAIL-01—FAIL-12、IO-04 |
| dry-run 完整回滚 | SPEC §8.4 | DRY-01—DRY-08、PROP-03 |
| read 候选与警告延迟 | SPEC §10.5、§11.3 | ID-05/06、IO-02、FAIL |
| SVG 严格子集及值校验 | SPEC §10 | XML-01—XML-24、VAL、SEC |
| 精确文本与属性保留 | SPEC §5.4、§10.2/10.6 | SET-04、XML-08—XML-16、PROP-07 |
| 自动 ID 与 semanticRepair | SPEC D08、§10.5 | ID-01—ID-11 |
| 保存三态、输出失败 | SPEC §11—§12 | IO-03—IO-09、CLI-14、REG-SAVE |
| 队列与请求复制冻结 | SPEC §6.3、§7.1 | QUEUE-01—QUEUE-07 |
| poisoned 故障与恢复 | SPEC §12.3 | FAIL-09—FAIL-12、FAULT-01—FAULT-06 |
| 资源与性能边界 | SPEC §13 | LIM-01—LIM-10、PERF-01—PERF-08 |
| 显示语义及错误文本 | LAB §2、§4.2、§5 | ERR、QRY-01—QRY-06、E2E |
| OO/Command/Composite/两处分派 | LAB §2.1；SPEC §4/§15 | ARCH-01—ARCH-10、人工审查 |
| 依赖、封装、无 IO/DOM 侵入 | SPEC §4.2、§5.5 | ARCH、TX、DTO、独立假端口运行 |
| 阶段边界与未来扩展 | SPEC §1.5/§13.4—§13.5 | CRT-06、XML-20、ARCH-09 |
| Git、final tag、课程报告 | LAB §1；SPEC 附录 C | DEL-01—DEL-08 |

用例族中的范围是导航，不要求实现为一份庞大测试文件。最终追踪检查要识别未实现/跳过的行，而不能仅检查字符串出现过。

<a id="test-06"></a>

## 6. 公共夹具与用例书写规则

### 6.1 最小夹具集合

| 夹具 | 内容 | 主要用途 |
| --- | --- | --- |
| F-EMPTY | 新 Session，无文档 | help、无文档错误、恢复入口 |
| F-SIX | 六种 Shape，非零且互不相同的几何；有/无显式样式 | 创建、变换、set、Codec |
| F-NEST | 三层混合 Group，含空组、带显式样式与继承样式的叶子 | Composite、删除、资源、继承 |
| F-ORDER | root=[A,B,C,D] | 同级重排和不连续分组 |
| F-CROSS | root=[A,P,D,Z]，P=[B,C] | 跨父 group、P1/P3/P4 |
| F-NESTED-G | root=[P]，P=[L,G,R]，G=[u,v] | 合法 ungroup 和精确位置恢复 |
| F-REDO | 从已确认保存内容开始，实变编辑后 undo | Redo 保留/截断、失败、dry-run |
| F-OVERFLOW | g 内 a.x=1，b.x=1e308，其余尺寸=1 | 后段变换溢出与回滚 |
| F-ATTR | 缺失 fill、显式 black、显式 red；根/组有允许展示属性 | 属性存在性与样式继承 |
| F-TEXT | 空串、前后空格、中文、emoji、&<>、CR/LF/TAB | 文本与 XML 转义 |
| F-AUTOID | 匿名节点在前，显式 rect1/rect3 等在后 | 两遍 ID 分配 |
| F-LIMIT | 注入很小配额的边界树 | L−1/L/L+1，资源拒绝与回滚 |

用于核心成功路径的 SVG 夹具应显式写出 width/height 及必要几何，避免在核心测试中混入 CFG-09 的缺省争议。负例通常只引入一种错误。

### 6.2 用例模板

每个用例记录：

1. ID、优先级、来源条款。
2. 初始文档、路径、dirty、历史与屏障；必要时写明 revision。
3. 输入命令/API 请求，以及所采用 CFG。
4. 预期结果类别、关键数据/错误与警告。
5. 文档前后差异；历史/路径/dirty/revision 的前后变化。
6. 文件或输出副作用；故障注入阶段。
7. 要执行的独立不变量检查。
8. 后续可继续性操作。

所有普通失败用例默认附加 `assertUnchanged`，但 external-unknown 和 untrusted 使用各自断言。所有编辑成功用例默认附加 INV；参数化表中的每一行分别执行，不只运行一个代表。

### 6.3 建议辅助断言

`assertSemanticEqual`、`assertObservableSessionEqual`、`assertDocumentInvariant`、`assertOrdinaryFailureUnchanged`、`assertHistoryTransition`、`assertSingleLineDiagnostic`、`assertNoExternalAccess`。

这些名称是测试辅助协议，不意味着生产代码必须提供同名函数。辅助断言要有少量独立正反样例验证，避免一个错误的比较器使整个套件假绿。

<a id="test-07"></a>

## 7. CLI 与命令功能测试

本节以“必须”为默认优先级。正例检查返回内容与状态；普通负例检查 `effect=unchanged`、无成功反馈及后续可继续性。错误优先级未冻结时，每个负例只制造一种错误。

### 7.1 词法、语法与入口

| ID | 输入或前置条件 | 关键预期 |
| --- | --- | --- |
| CLI-01 | 空行、仅空白、`# comment`；分别在 empty、屏障、Redo 状态输入 | 无命令执行，无版本、屏障、历史变化 |
| CLI-02 | `create rect r 0 0 10 10 #4a90d9` | # 颜色完整传入，不视为行内注释 |
| CLI-03 | `create text t 1 2 "a  in b # c 中文🙂" in g1` | text 保留双空格/in/#/Unicode；只有末尾独立 in 子句被解析 |
| CLI-04 | `create text t 1 2 ""`、前后带空格的文本 | 空串和前后空格按输入保留 |
| CLI-05 | 双引号未闭合、缺参数、多参数、残缺/重复 in | 一条语法诊断，原状态不变 |
| CLI-06 | 文件路径含空格；引号与反斜杠边界 | 传入 FileStore 的原始路径值正确；额外转义依 CFG-06 |
| CLI-07 | 19 个合法命令逐一 parse/bind | 得到人工列出的请求字段；不是“把同一 Catalog 输出再比较自己” |
| CLI-08 | 各命令少一参/多一参、未知命令 | 语法/未知命令错误；init/canvas/group 边界依 CFG-01/02 |
| CLI-09 | 数字 `10oops`、NaN、Infinity、空数字；API 传入非有限 number | 各入口都拒绝，不用 parseFloat 截断接受 |
| CLI-10 | text/g 创建时附加 fill；line 可选颜色 | text/g 多参失败；line 颜色写 stroke，不写 fill |
| CLI-11 | 在无文档时执行所有依赖文档的请求 | 统一无文档错误；help 可用；init/read 可建立文档 |
| CLI-12 | CLI create/group 不提供 ID | 语法失败，不自动命名；自动 ID 仅属于 SVG 导入 |
| CLI-13 | 每种用户错误后再执行合法查询/编辑 | REPL 与 Session 队列继续工作，不丢下一行 |
| CLI-14 | 已成功业务提交后 Presenter/stdout 抛错 | 不重新 execute、不回滚，不把输出错误映射为文件写失败 |

为 CLI-07 建立独立的参数例表，例如 `move r 1.5 -2` 应得到 `{command:'move', id:'r', dx:1.5, dy:-2}`。API 结构化请求另测未知类型/非法属性/缺字段，不依赖 TS 类型在运行期保护不可信调用者。

### 7.2 文档命令

| ID | 场景 | 关键预期 |
| --- | --- | --- |
| DOC-01 | 无参/双尺寸 init；对已有文档再 init | 默认 800×600；新 Document/State；空树；dirty=true；路径=null；清栈、init 屏障、revision+1 |
| DOC-02 | init 尺寸非法或候选构建失败 | 保留整个旧会话；empty 状态下仍为 empty |
| DOC-03 | 读取合法六类 SVG；分别有/无补 ID | 候选成功后统一替换；read 屏障、revision+1、路径更新；仅补 ID 时 dirty=true |
| DOC-04 | canvas 无参及实际修改尺寸 | 无参纯查询；实变只改根尺寸和规范 viewBox，子图形各字段不变，清栈设屏障、revision+1 |
| DOC-05 | canvas 设置原尺寸，分别在 barrier 和有 Redo 时 | 完整无变化，不设/解屏障、不清 Redo、不增加 revision |
| DOC-06 | save 显式路径后无参 save；read 新路径后无参 save；init 后无参 save | 总是使用最近成功路径；init 清路径；没有目标时失败，不猜文件名 |
| DOC-07 | 相同内容/相同文件再次 read 或 init | 成功文档替换仍产生新文档身份、清历史与设屏障，不按内容相同优化成编辑 no-op |
| DOC-08 | clean 文档再 save | 内容不变但会话提交：清栈、save 屏障、revision+1；dirty=false |
| DOC-09 | 有保存点和 Redo 时，canvas 输入负数/非有限数/零值边界（CLI 与 API） | 零值依 CFG-03；非法输入后根尺寸、规范 viewBox、子树、路径、dirty、U/R、屏障、revision 全不变 |

save 的文件结果与 read 的失败原子性在第 12 节展开；这些表格只固定用户层状态行为。

### 7.3 创建与寻址

| ID | 参数化范围 | 关键预期 |
| --- | --- | --- |
| CRT-01 | 六种类型 × 默认根/指定 Group | 各字段和类型正确；挂父容器末尾；活动 ID、计数+1；一个 Undo 单元 |
| CRT-02 | rect/circle/ellipse 可选 fill；line 可选 stroke | 省略时属性缺失，指定时存在；不偷偷补 fill=black/stroke=none |
| CRT-03 | 创建嵌套 Group、空 Group、Group 中 text | 统一容器能力；text 是自身文本值，序列化为 XML 子文本 |
| CRT-04 | 相同/不同类型复用活动 ID | 全局重复失败；已有树、索引、历史不变 |
| CRT-05 | `r1` 和 `R1` | 作为两个不同 ID；编辑与删除不串对象 |
| CRT-06 | `create box`、hexagon、未知 type 的结构化 API | unknown shape type，CLI 保留 plugin 后缀；不意外加载插件 |
| CRT-07 | in 目标不存在或为叶子 | 分别使用规定的 no such container / not a container |
| CRT-08 | 非法几何、颜色、文本及节点/深度超限 | 失败不留下半创建节点、活动索引或历史条目 |
| CRT-09 | create→undo→redo；同一请求先 dry-run 再 commit | 恢复原位置；正式创建结果符合预览；临时节点不占用 ID |

### 7.4 几何变换的手算基准

以下每一行分别以初始值执行 move 或 scale，不能先 move 后再用该列的 scale 预期。

| 类型 | 初始状态 | `move 5 -3` | `scale 2` |
| --- | --- | --- | --- |
| rect | x=10,y=20,w=30,h=40 | x=15,y=17,w=30,h=40 | x=20,y=40,w=60,h=80 |
| circle | cx=12,cy=18,r=5 | cx=17,cy=15,r=5 | cx=24,cy=36,r=10 |
| ellipse | cx=9,cy=15,rx=3,ry=6 | cx=14,cy=12,rx=3,ry=6 | cx=18,cy=30,rx=6,ry=12 |
| line | x1=1,y1=2,x2=11,y2=22 | x1=6,y1=-1,x2=16,y2=19 | x1=2,y1=4,x2=22,y2=44 |
| text | x=7,y=8,text="A" | x=12,y=5,text="A" | x=14,y=16,text="A" |

| ID | 场景 | 关键预期 |
| --- | --- | --- |
| GEO-01 | 上表所有叶子 move | 仅平移位置；line 两端都移动；文本内容/尺寸类属性不变 |
| GEO-02 | 上表所有叶子 scale | 位置与尺寸同乘，围绕文档原点；不围绕自身中心 |
| GEO-03 | 三级混合 Group move/scale，旁边有非目标子树 | 所有后代恰好变换一次；非目标节点不变；一条历史 |
| GEO-04 | 图形/祖先含 stroke-width=3、font-size=16 | move/scale 都不修改这两个属性或其存在性 |
| GEO-05 | move 0 0、scale 1、空 Group 的合法变换 | 无内容变化；按空编辑规则处理屏障与 Redo |
| GEO-06 | 空 Group 执行 scale 0/-1/NaN 或非法 move | 必须先校验参数并失败，不能因无孩子而成功 |
| GEO-07 | F-OVERFLOW 执行 scale g 2 | a 的先前修改精确回滚；b 写入前拒绝；全部状态恢复 |
| GEO-08 | move 的加法溢出；尺寸/radius 运算超界 | 同样失败原子；不是只检查输入有限就放行结果 |
| GEO-09 | x=0.1、scale 3 后 undo/redo | before/after 数值精确恢复；不通过乘倒数实现撤销 |
| GEO-10 | 零几何、-0、subnormal、下溢和大有限数 | 按 CFG-03/04 的逐项规则；允许的退化值不应被错误统一拒绝 |

GEO-07 必须从具有 Redo 的起点再运行一次，以检出“失败虽然恢复树却清掉 Redo”的错误。

### 7.5 set 全白名单与属性存在性

合法组合共 **36** 个：

| 类型 | 公共属性 | 自身属性 | 总数 |
| --- | --- | --- | --- |
| rect | fill、stroke、stroke-width | x、y、width、height | 7 |
| circle | 同上 | cx、cy、r | 6 |
| ellipse | 同上 | cx、cy、rx、ry | 7 |
| line | 同上 | x1、y1、x2、y2 | 7 |
| text | 同上 | x、y、text | 6 |
| g | 同上 | 无 | 3 |

| ID | 场景 | 关键预期 |
| --- | --- | --- |
| SET-01 | 36 个合法组合逐行设置有效的新值 | 只改目标自身对应字段；历史一条；undo/redo 恢复 |
| SET-02 | 各类型设置另一类型专属属性，例如 circle.width、g.x | unknown attribute；不创建任意动态字段 |
| SET-03 | g 设置 fill/stroke/stroke-width | 只改 g 自身；子节点显式样式不被覆写 |
| SET-04 | 缺失 fill→显式 black→undo→redo | 第一步是真变化；undo 恢复缺失；redo 恢复显式存在 |
| SET-05 | 同一显式属性设为同一规范值 | 真正 no-op；不清 Redo；有屏障时仅解屏障 |
| SET-06 | set id/transform/style/font-size/text-anchor/data-kind/label | 当前 CLI 白名单均拒绝，即使导入可以保留部分只读属性 |
| SET-07 | 负尺寸、非有限、非法 paint、非法 XML 字符 | 共享值验证；保留原值、原属性存在性和全部会话状态 |
| SET-08 | text 设置空串、中文/emoji、连续空格、&<> | 内容精确；查询与保存转义不改变真实文本 |
| SET-09 | 持有旧 describe/preview/历史 before 值后继续 set | 旧值不变化；没有共享可变属性 Map/数组 |

### 7.6 查询及精确错误文本

| ID | 场景 | 关键预期 |
| --- | --- | --- |
| QRY-01 | tree 全文档，包括空树、空 Group、六类型 | 层级、顺序、类型、ID、画布及关键几何字段完整 |
| QRY-02 | tree id | 只输出该节点与子孙，不混入兄弟；节点顺序真实 |
| QRY-03 | show 各类型，父为根/Group | 父级正确，显式属性和文本正确；无 live 对象 |
| QRY-04 | help 在 empty/ready/poisoned | 19 命令说明与语法正确；无业务状态改变 |
| QRY-05 | 有屏障/Redo 时多次 tree/show/help/canvas 查询 | 两栈、屏障、路径、dirty、revision 不变，不触发 save 或预览副作用 |
| QRY-06 | 统计含多层组、删除/undo 后的节点数 | 包括 g，不包括 root；LAB 的 5/7/8 仅在相应夹具状态下成立 |

对 tree/show 采用“结构字段断言 + 少量稳定快照”。不把所有列宽/空格布局变成不可调整的契约；不能为消除快照差异而排序节点或 trim 文本内容。

**ERR 固定文案表：** 以下每行至少一个端到端或 Presenter+真实错误结果用例；占位值替换成实际 ID/属性/路径。

| 用例 ID | 场景 | 必须保留的文本 |
| --- | --- | --- |
| ERR-01 | ID 冲突 | `error: id already exists: r1` |
| ERR-02 | 图形不存在 | `error: no such shape: r9` |
| ERR-03 | in 目标不存在 | `error: no such container: node9` |
| ERR-04 | in 目标非容器 | `error: not a container: start` |
| ERR-05 | 未知类型 | `error: unknown shape type: hexagon (is the plugin loaded?)` |
| ERR-06 | group 同选祖先和后代 | `error: cannot group a container into its own descendant: g1` |
| ERR-07 | 顶层 ungroup | `error: cannot ungroup top-level container: scene` |
| ERR-08 | 非正缩放因子 | `error: scale factor must be positive` |
| ERR-09 | 无法读取 | `error: cannot read file: a.svg` |
| ERR-10 | 确认未提交的写失败 | `error: cannot write file: a.svg` |
| ERR-11 | 无文档 | `error: no document. use 'init' or 'read' first` |
| ERR-12 | 未知属性 | `error: unknown attribute: bogus` |
| ERR-13 | Undo 被 IO 屏障阻止 | `error: undo not allowed after io command` |
| ERR-14 | 补匿名 rect ID | `warning: assigned id rect1 to unnamed <rect>` |

Redo 屏障至少断言 HISTORY_BLOCKED；其精确文本按统一 Presenter 契约。未来 composite shape 的 ungroup 错误不要求在 Phase 1 构造可达业务路径。

另外验证：每条诊断只有一行；插入 ID/路径/文本摘要的 CR/LF/ESC 被安全展示；不打印原始 XML 或内部堆栈。展示转义不能改变真正交给 FileStore 的路径或保存的文本。

<a id="test-08"></a>

## 8. 结构编辑算法测试

来源：SPEC §9、D02—D04。除正向结果外，每种结构操作都做 undo/redo、失败不变和 INV 检查。

### 8.1 结构操作用例表

| ID | 初始结构与操作 | 预期 |
| --- | --- | --- |
| STR-01 | root=[A,B,C,D]；`group G D B` | root=[A,C,G]，G=[B,D]；忽略参数的反向顺序 |
| STR-02 | root=[A,P,D,Z]，P=[B,C]；`group G D B` | root=[A,P,G,Z]，P=[C]，G=[B,D] |
| STR-03 | root=[P,Q,Z]，P=[a,b]，Q=[c,d]；组 b,c | root=[P,Q,G,Z]，P=[a]，Q=[d]，G=[b,c]；最后第一层分支 Q 仍保留 |
| STR-04 | 最近公共父容器为内层 P，而不是 root | G 挂在 P；不把全部跨父分组提升到根 |
| STR-05 | 新组 ID 重复、重复目标、缺目标、目标数不合法 | 全失败；不留下空 G 或索引；数量边界依 CFG-02 |
| STR-06 | 同选容器及后代，参数顺序交换；选完整 Group 与无关叶子 | 前两例拒绝；后例合法，整棵 Group 子树保持完整 |
| STR-07 | group 导致节点数或深度超限；已有 Redo | 原子拒绝，目标仍在原父/原序；Redo 保留 |
| STR-08 | root=[P]；P=[L,G,R]，G=[u,v]；ungroup G | P=[L,u,v,R]，G 不在活动索引；undo 精确重建 P/G 与全部原位置 |
| STR-09 | ungroup 根直接子 Group；目标为叶子或不存在 | 各自拒绝；顶层空 Group 也不能例外 |
| STR-10 | 解散嵌套空 Group / 单孩子 Group | 空组删除是实变，有一个 Undo 单元；单孩子占据组原位置 |
| STR-11 | addto 跨父、同父中间、同父最后 | 跨父/中间移到目标末尾；同父最后为 no-op |
| STR-12 | addto 自己到自己、祖先到后代、非法目标、目标超深 | 不产生环或半移走；所有状态保持 |
| STR-13 | [A,B,C,D] 中 front B / back B；单兄弟/已经边界 | 分别 [A,C,D,B] / [B,A,C,D]；边界 no-op；只改同级顺序 |
| STR-14 | 缺失 fill 的节点从红组移到蓝组；旁边有显式 fill | 节点自身状态不补样式；显式 fill 不变；不承诺继承后的外观不变 |
| STR-15 | delete 深层 Group | 整个子树退出活动索引/计数；外部节点不变；undo 一次完整恢复 |
| STR-16 | 创建合法 ID 为 `svg` 的普通图形，再编辑/删除它 | 操作该图形，根画布不受影响；未存在此 ID 时不能把字符串当根哨兵 |
| STR-17 | 删除组后逐个查原后代；再 undo/redo | 后代未活动时查不到；内部 parent 可保留，不能据 parent!=null 误判活动 |

资源规则关注操作的最终合法结构。对已有同父节点重排不应错误地当作新增节点而暂时触发“数量+1”；但 group 本身新增一个节点，不能漏算。

### 8.2 REG-GROUP 详细回归

将 SPEC P1/P4 转为固定测试，初始：

```text
root=[A,P,D,Z]
P=[B,C]
```

执行 `group G B D`，三条实际位置变化应在领域日志测试中可验证：

| 步骤 | from → to | 执行后 |
| --- | --- | --- |
| 建空组 | G: null → (root,3) | root=[A,P,D,G,Z] |
| 移 B | (P,0) → (G,0) | P=[C]，G=[B] |
| 移 D | (root,2) → (G,1) | root=[A,P,G,Z]，G=[B,D] |

**关键断言：**

- 创建 G 时记录的 root 索引是 3，不能在命令完成后被改成最终索引 2。
- Undo 逆序恢复 D、B，再删除 G；结果精确为初始树。
- Redo 正向重放同一组记录，复用同一 G 对象。
- 不能把全部回放前置条件都拿最终/最初树一次性验证；中间状态取决于此前步骤。
- 任一步受控中止后，已完成步骤被补偿，两栈未移动。
- 命令摘要记录的 children 数为 2，节点总数增加 1。

### 8.3 不应使用的结构性质

以下不是本项目的通用正确性断言：

- `ungroup(group(S)) = S`。
- 分组后所有图形与未选图形的全局遮挡关系不变。
- reparent 后 computed style 不变。
- 任意父容器下的 Group 都可以 ungroup。

可以验证的普遍性质是：group/addto/ungroup 保持被移动节点的自身状态；选中节点的相对文档顺序符合规则；undo 恢复原树。若另测 group→ungroup 的逆性质，应限定为非根父容器中的连续同父节点，且不混入样式修改。

<a id="test-09"></a>

## 9. 历史、屏障、dirty 与 revision 测试

### 9.1 转移总表

令 U/R 为编辑历史栈；c 为当前内容身份；s 为保存内容身份。下表以可信 ready 文档为前提；init/read 可从 empty 或 poisoned 建立新文档。

| 操作 | 文档/内容 | 历史与屏障 | 路径/保存点 | revision |
| --- | --- | --- | --- | --- |
| init 成功 | 新文档、新 c | 清 U/R，屏障 init | path=null，s=null | +1 |
| read 无修复成功 | 新文档、新 c | 清 U/R，屏障 read | 新路径，s=c | +1 |
| read 补 ID 成功 | 新文档、新 c | 清 U/R，屏障 read | 新路径，s=null | +1 |
| save committed | 内容/c 不变 | 清 U/R，屏障 save | 新路径，s=c | +1 |
| canvas 实变 | 新 c，子图形不变 | 清 U/R，屏障 canvas | 原路径/原 s | +1 |
| canvas 同尺寸 | 不变 | 完整不变 | 不变 | 0 |
| 编辑实变 | 新 c | U 加一，R 清空，解屏障 | 原路径/原 s | +1 |
| 编辑 no-op，有屏障 | 不变 | 两栈不变，解屏障 | 不变 | +1 |
| 编辑 no-op，无屏障 | 不变 | 完整不变 | 不变 | 0 |
| undo/redo 成功 | 恢复记录的 c | 移动原条目 | 原路径/原 s | +1 |
| 查询/普通失败/dry-run | 不变 | 不变 | 不变 | 0 |
| save indeterminate | 内存不变 | 不变 | 不变 | 0 |
| untrusted | 不再可信 | 不按普通成功历史推断 | dirty=null | 按 CFG-17 |

同时检查 `contentChanged` 与 `sessionChanged`：查询均 false；空编辑解屏障为 false/true；无屏障空编辑为 false/false；save 为 false/true。成功替换文档、实际编辑/画布变化、Undo/Redo 按对应提交填写。

### 9.2 历史用例

| ID | 场景 | 关键预期 |
| --- | --- | --- |
| HIS-01 | 每种编辑分别执行→undo→redo | 一命令至多一个条目；恢复完整 before/after |
| HIS-02 | 多步 group/delete 子树/递归 move | 一次 undo 完成整条命令，不暴露半恢复 |
| HIS-03 | 编辑 A,B；undo B；实变编辑 C | Redo B 被截断；undo C 返回 A 后状态 |
| HIS-04 | 有 Redo 后查询、失败编辑、合法 no-op | Redo 保留，能重放旧条目 |
| HIS-05 | init/read/save/实际 canvas 成功后 undo/redo | 两栈清空，HISTORY_BLOCKED；下一条成功编辑解除 |
| HIS-06 | 屏障后空行/注释/查询/失败/dry-run | 全部不解屏障 |
| HIS-07 | 屏障后 move 0 0 或合法空组变换 | 解屏障但不创建历史；再 undo 为“空历史”，不是 HISTORY_BLOCKED |
| HIS-08 | 同尺寸 canvas、clean save 再保存 | 前者不改屏障；后者仍重新设置 save 屏障 |
| HIS-09 | 删除旧 r1，创建不同类型的新 r1；双 undo/双 redo | 旧/新对象不混淆；历史按稳定身份重放 |
| HIS-10 | 保存点后编辑→undo→redo | dirty true→false→true；revision 每次成功增加 |
| HIS-11 | 保存点后 move +1 再 move -1 | 几何可相同，新的内容身份仍 dirty；不能按文件 hash 擅自判 clean |
| HIS-12 | 无文档、屏障、无可撤销条目、无可重做条目 | 错误类别区分且状态不变；不要把空历史等同屏障 |
| HIS-13 | old HistoryManager 引用、多次 afterEdit/afterUndo | 旧历史值不被修改；条目移动是同一对象；快照不随未来改变 |

### 9.3 REG-STATE 固定轨迹

使用全新 Session，记其初始 revision 为 v0；a.svg 含显式 ID 的 Rect r1，x=10、y=20、width=30、height=40，确保下列 ±1 都是可精确表示的实变。从一次干净 `read a.svg` 开始。用 α/β/γ/δ 表示模型内容身份，不要求公开 API 暴露这些 token。表中版本列是相对 v0 的增量，不额外规定构造器的初始 revision 数值。

| 步骤 | 操作 | c / s | U/R 数 | 屏障 | dirty | revision−v0 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | read a.svg，无补 ID | α/α | 0/0 | read | false | 1 |
| 2 | move r1 1 0 | β/α | 1/0 | 无 | true | 2 |
| 3 | undo | α/α | 0/1 | 无 | false | 3 |
| 4 | move r1 0 0 | α/α | 0/1 | 无 | false | 3 |
| 5 | 非法编辑 | α/α | 0/1 | 无 | false | 3 |
| 6 | dry-run move r1 2 0 | α/α | 0/1 | 无 | false | 3 |
| 7 | redo | β/α | 1/0 | 无 | true | 4 |
| 8 | save b.svg，committed | β/β | 0/0 | save | false | 5 |
| 9 | canvas 原尺寸 | β/β | 0/0 | save | false | 5 |
| 10 | move r1 0 0 | β/β | 0/0 | 无 | false | 6 |
| 11 | undo，空历史失败 | β/β | 0/0 | 无 | false | 6 |
| 12 | move r1 1 0 | γ/β | 1/0 | 无 | true | 7 |
| 13 | move r1 -1 0 | δ/β | 2/0 | 无 | true | 8 |
| 14 | undo | γ/β | 1/1 | 无 | true | 9 |
| 15 | undo | β/β | 0/2 | 无 | false | 10 |

第 13 步几何等于第 8 步，仍为 dirty；第 15 步恢复历史内容身份后才 clean。这一轨迹同时检验空编辑、Redo、dry-run、save 和“内容相同不等于同一保存状态”。

### 9.4 同名不同代对象

领域/历史层固定测试：

```text
旧 Rect r1 → delete r1 → 新 Circle r1
→ undo create → undo delete
→ redo delete → redo create
```

断言旧 Rect 与新 Circle 不同；undo delete 恢复原 Rect 对象；redo create 恢复原 Circle 对象。分别验证几何、原父与位置、活动索引，以及两者 ownerDocumentId 从创建开始不变化。测试不能只看 ID 始终叫 r1。

<a id="test-10"></a>

## 10. 事务、权限、dry-run 与故障状态测试

### 10.1 事务与能力生命周期

| ID | 场景 | 预期 |
| --- | --- | --- |
| TX-01 | active→prepare→commitPrepared | prepared 禁止新业务写入；提交后权限失效且下次事务可开始 |
| TX-02 | active→rollback；prepared→rollback | 都恢复完整状态；prepared 回滚不能被仅允许 active 的断言错误阻断 |
| TX-03 | committed/rolled-back tx 再调用 changeState/place | 拒绝，不改变文档 |
| TX-04 | 同文档嵌套 beginEdit | 拒绝；外层事务仍可完成或回滚 |
| TX-05 | 跨 Document 使用 tx/节点/容器/GroupPlan | 拒绝；两份文档都不变 |
| TX-06 | Builder build 成功后再次修改/发布；把旧构建能力用于已发布文档 | 权限失效，不绕过事务 |
| TX-07 | 用其他 target 的 Memento 或过期 expected 状态回放 | 检出身份/状态不匹配；不按 SVG ID 猜测恢复目标 |
| TX-08 | 持有 ChangeSet、Memento、ChangePreview 后继续编辑 | 历史 before/after 不变；describeState 解释给定快照而非当前值 |
| TX-09 | 尝试从 Command/公共 API 获取 lease 控制端或原始 writer authority | 不可得；没有“持有普通 tx 就能无日志写字段”的接口 |
| TX-10 | canvas 修改通过根状态事务；根状态准备失败 | 根与保存元数据原子恢复；成功不进入 Undo |
| TX-11 | 删除、重挂、undo/redo 后核对 ownerDocumentId | 所有节点 owner 从创建起不变，分离不变成新文档节点 |
| TX-12 | GroupPlan 同一窗口使用及过期/跨文档误用 | 成功计划不跨 await/后续命令缓存；越界使用被内部契约或架构审查检出 |

TX-12 不要求为防内部误用新增用户可调用的 plan API；如果没有可构造的过期调用入口，使用源码审查证明生命周期，跨文档计划仍做明确负例。

### 10.2 故障注入矩阵

下面列出**可恢复且可观察的边界**。不以人为触发不可恢复 OOM、kill 进程或突然断电要求普通事务回滚。

| ID | 注入位置 | 期望效果及必须断言 |
| --- | --- | --- |
| FAIL-01 | 命令绑定/值校验，在事务前失败 | unchanged；领域/文件副作用为 0 |
| FAIL-02 | 原语日志位置预留/快照准备失败，尚未写入 | 当前原语无写入；此前完成原语完整补偿 |
| FAIL-03 | 复合命令第 k 个原语写前失败 | 已完成 1…k−1 逆序恢复；索引、计数、顺序和权限恢复 |
| FAIL-04 | prepare 已完成，HistoryEntry/下一 HistoryManager 准备失败 | prepared 事务仍可回滚；没有“内容变了但历史没记”的状态 |
| FAIL-05 | prepare 后下一 Head/完整结果 DTO 构造失败 | 完整回滚；revision、保存点和两栈保持 |
| FAIL-06 | dry-run preview 构造失败 | 不返回残缺预览；回滚后 unchanged |
| FAIL-07 | undo 已回放部分记录，下一步受控中止 | 补偿实际方向；旧栈不移动；之后可再次 undo |
| FAIL-08 | redo 已回放部分记录，下一步受控中止 | 同上；不能重新执行业务命令“补救” |
| FAIL-09 | 原始写入可能只完成一部分，无法证明恢复 | untrusted；poisoned；dirty=null，禁止继续编辑/保存 |
| FAIL-10 | rollback/历史补偿本身失败 | 同上，不声称 unchanged |
| FAIL-11 | 历史 DocumentId/StateId/条目对象/中间 expected 不匹配 | 内部不变量错误，按 poisoned 路径；不降级为 SHAPE_NOT_FOUND |
| FAIL-12 | poisoned 状态恢复 init/read 候选失败 | 保留故障态；不能只清错误标志后继续旧文档 |

复合变换至少在“第一处、已经完成一处、最后一处”故障。group 覆盖“新组已插入、一个孩子已移入、prepare 后”；ungroup 覆盖“一个孩子已提升、空组已摘除、prepare 后”。这用少量结构代表覆盖故障阶段，不为每个字段编写大量相同 mock。

**发布临界区审查：** `publish` 仅同步终结事务、替换私有 Head、返回已经构造的结果；没有 await、IO、序列化、用户文案格式化或外部回调。测试替身不能反过来要求在此临界区新增任意回调。

### 10.3 Dry-run 用例

| ID | 场景 | 预期 |
| --- | --- | --- |
| DRY-01 | 每个 EditRequest 的合法实变参数 | 使用同样验证和领域逻辑；wouldChange=true；回滚后原会话不变 |
| DRY-02 | 各合法 no-op | wouldChange=false；不创建历史，不增加 revision |
| DRY-03 | 处于 IO 屏障时 dry-run，含合法 no-op | 不解除屏障，与 commit 空编辑不同 |
| DRY-04 | 已有 Redo 时 dry-run create/group/delete | Redo 完整保留；临时节点不在索引；后续 redo 成功 |
| DRY-05 | 非法请求与中途失败 | 与正式执行相同的错误类别；完整恢复，无预览成功 |
| DRY-06 | preview 返回后再查询/编辑、尝试修改 preview | 预览仍描述候选结果，且不影响当前文档 |
| DRY-07 | dry-run 后在相同前置状态 commit 同请求 | 语义结果与预览一致；临时 ID 不造成重复冲突 |
| DRY-08 | init/read/save/canvas/tree/show/help/undo/redo 使用 dry-run | 模式不支持，完整不变；不发起文件 IO |

成功 dry-run 不分配可观察的新 StateId、不改变自动 ID 编号器、不保留永久临时节点注册表。没有要求内部临时对象地址或不可观察分配计数完全不动；真正要求的是已提交状态与未来行为不受污染。

### 10.4 故障态恢复

| ID | poisoned 后操作 | 预期 |
| --- | --- | --- |
| FAULT-01 | 所有编辑、undo/redo、save | 拒绝；不输出不可信 SVG，不进行保存 |
| FAULT-02 | tree/show/canvas 查询 | 不读取不可信内容；返回故障诊断 |
| FAULT-03 | help | 可用；状态仍 poisoned、dirty=null |
| FAULT-04 | 合法 init | 发布全新可信文档；ready、dirty=true、路径清空、init 屏障 |
| FAULT-05 | 合法 read，有/无补 ID | 发布全新文档；read 屏障；dirty 由补 ID 决定 |
| FAULT-06 | 非法 init/失败 read | 保留 poisoned；成功恢复前不允许绕过限制 |

无须为这些测试添加新用户诊断命令；现有 ExecutionResult.status 已能表达故障状态。poisoned 后不再用通用 INV 遍历旧文档，只验证故障隔离与成功恢复后的新文档不变量。

<a id="test-11"></a>

## 11. SVG 编解码、安全与自动 ID 测试

来源：SPEC §10。采用**手写最小夹具 + 人工预期语义 + 独立 XML 检查 + 往返性质**四种证据；仅运行 read(save(D)) 不够。

### 11.1 SVG 支持范围矩阵

| ID | 输入/操作 | 预期 |
| --- | --- | --- |
| XML-01 | 一个 SVG namespace 根；六类图形、嵌套组、空组 | decode 与人工 expected DTO 一致；children 顺序保留 |
| XML-02 | 默认 namespace 与任意合法前缀映射到相同 SVG URI | 得到等价文档；不依前缀字符串识别图形 |
| XML-03 | 缺/错 namespace、同 local name 不同 URI、局部将使用中的前缀重绑定到非 SVG URI | 明确拒绝；不按标签尾部名称误接受 |
| XML-04 | 无 viewBox / `0 0 width height` / 数值等价的规范表示 | 接受；encode 统一生成规范 viewBox，画布不改变 |
| XML-05 | viewBox 原点非零、尺寸不等、数量错误、非有限数 | 拒绝；不静默重映射坐标 |
| XML-06 | 根/组/叶上 transform，包括 translate(0,0)、scale(1) | 都拒绝；不因为恰好为恒等变换而放宽支持范围 |
| XML-07 | path/use/image/defs/foreignObject/script、嵌套 svg | 明确拒绝；不能丢元素后成功 |
| XML-08 | style/class/filter/clip-path/mask/href/事件属性、未知 data-* | 依严格白名单拒绝；已允许属性之外不透传 |
| XML-09 | 根/Group/叶上的允许只读展示属性 | 按 CFG-10 验证后保留；编辑其他字段、undo/redo、保存都不丢 |
| XML-10 | 父组显式 fill、子缺失 fill、另一个子显式 fill | 三者各自显式状态保留；不把继承结果写入子节点 |
| XML-11 | 分别导入缺失 fill 与显式 fill=black | 两份语义和输出存在性可区分，不能折叠 |
| XML-12 | 文本中文、emoji、空串、前后/连续空格、实体 | 解码后精确保留；无全局 trim |
| XML-13 | 字面 CR/CRLF 与 `&#xD;`；领域文本含真实 CR | 按 XML 行尾规则解码；需要保留的 CR 编码为字符引用 |
| XML-14 | U+0000、XML 禁止控制字符、未配对代理项 | 拒绝；合法补充平面字符保留 |
| XML-15 | 大有限数、小非零数、非整小数 | 编码不固定小数截断；读回同一规范有限值 |
| XML-16 | encode 漂亮打印后查看 text | 只允许元素间格式化，不向 text 内插入额外空格/换行 |
| XML-17 | text 含 tspan/textPath/其他子元素 | 拒绝，不压平为纯文本 |
| XML-18 | 非容器含图形孩子、容器内非排版文本、未知内容模型 | 明确拒绝；排版空白按 CFG-11 处理 |
| XML-19 | XML 注释、CDATA、不同引号/缩进/属性顺序 | 按 CFG-11 接受的形式规范化；不因此 semanticRepair=true |
| XML-20 | `g data-kind="box"`，放在非顶层 Group 内 | 普通 Group，保留标记；set label 仍拒绝；set fill 仅改自身；可按普通嵌套组 ungroup |
| XML-21 | 不闭合、多根、重复属性、未定义实体、末尾非空白垃圾 | 解码失败；read 旧会话不变，无部分警告 |
| XML-22 | 合法 XML 声明与 xml-stylesheet/其他 PI | 声明按 CFG-11 接受；额外 PI 拒绝 |
| XML-23 | 字节/节点/深度/文本/属性分别越限 | 可分类资源错误；不截断文档以宣称成功 |
| XML-24 | 直接调用 decode/encode | 不调用 FileStore，不写终端，不读 Session，不修改源描述 |

对于未冻结的缺省几何、px、BOM、root id 等，另外以 CFG 参数表生成测试，不将它们混入必须成功的基本夹具。

### 11.2 独立 XML 与文本预言机

用一个小型手写夹具固定预期：

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
  <g id="g1" fill="red">
    <rect id="r1" x="1.25" y="-2" width="3" height="4"/>
    <text id="t1" x="5" y="6">  A &amp; B &lt; C  </text>
  </g>
</svg>
```

人工预期应写明：

- root 400×300；root=[g1]，g1=[r1,t1]。
- g1.fill 显式 red，r1.fill/t1.fill 缺失。
- r1 的 x=1.25、y=-2、width=3、height=4。
- t1 内容精确为 `"  A & B < C  "`，两端各两空格。
- 原文没有缺 ID，因此 read 成功后 dirty=false；补规范 viewBox 不构成语义修复。
- encode 后必须有规范 viewBox；允许属性顺序和排版变化。

对编码结果使用独立 XML 解析/验证路径核对 namespace、元素次序、属性存在性和解码文本。独立检查器可以是另一解析库，也可以是足够小的测试专用 XML 校验工具；不能调用生产 Codec 来完成这项“独立”检查。

另设文本表：

| 领域文本/输入 | 断言 |
| --- | --- |
| `A & B < C > D` | 编码合法，解码恢复原文本；没有少转义或重复转义 |
| 字面字符串 `&amp;` 等实体拼写 | 保存时 ampersand 再转义一次，读回仍是字面实体拼写，不被错误二次解码 |
| 双引号/单引号/& | 文本与属性的转义按各自上下文处理；无需强求一种等价实体写法 |
| 真实 CR、LF、TAB | 可保留值精确回读；原始 XML 行尾规范化与字符引用区别对待 |
| 中文与合法代理对 emoji | 完整保存，长度限制按已冻结计量单位 |
| 未配对高/低代理项、NUL | 进入领域时拒绝，不等到输出文件时才丢数据 |

若某属性 schema 根本不允许特殊空白或引号，就验证拒绝；不要为测试属性转义故意扩大 ID/paint 的可接受集合。XML 对行尾和属性空白的规范化有明确规则，需使用字符引用或在值层拒绝无法保留的输入。[W6]

### 11.3 自动补 ID

| ID | 输入构造 | 预期 |
| --- | --- | --- |
| ID-01 | 前部匿名 rect，后部显式 rect1 | 匿名分配 rect2；后部 rect1 不变 |
| ID-02 | 显式 rect1/rect3；两个匿名 rect | 依文档顺序分配 rect2、rect4 |
| ID-03 | 显式 rect1 位于 circle 上，匿名 rect 在前 | 仍避开 rect1；预留是全局、跨类型的 |
| ID-04 | 匿名 g 内匿名 rect/circle，后有匿名 rect | 按文档顺序；各标签编号独立；警告与实际节点匹配 |
| ID-05 | 跨父/跨类型的显式重复 ID | 整份导入失败，没有补 ID 警告发布 |
| ID-06 | 前段匿名、后段非法尺寸/结构/超限 | 丢候选和全部警告；旧会话不变 |
| ID-07 | 失败 read 后再读同一合法匿名文件；重复独立读入 | 分配结果相同，不被上次编号器污染 |
| ID-08 | `id=""`、非法显式 ID、仅空白 ID | 按 CFG-07 拒绝，不能当作“缺失”自动改名 |
| ID-09 | `r1` 与 `R1`，显式 ID 占用多个编号空洞 | 大小写敏感；精确保留显式值、跳过冲突 |
| ID-10 | 全显式 ID，仅注释/排版/viewBox 规范化 | semanticRepair=false，读后 clean |
| ID-11 | 成功导入至少一个匿名节点 | semanticRepair=true，读后 dirty；成功 save 后 clean |

**最小跨类型反例：**

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60">
  <rect x="0" y="0" width="10" height="10"/>
  <circle id="rect1" cx="20" cy="20" r="5"/>
</svg>
```

预期第一个节点为 rect2，第二个仍为 rect1。它能发现“单遍边读边命名”以及“只预留同类型 ID”两类错误。

### 11.4 跨入口值校验

`VAL-01—VAL-06` 分别覆盖有限坐标、尺寸/半径、scale 因子、stroke-width、paint、text/ID。每类用同一人工数据表运行于适用的入口：

| 入口 | 测试目的 |
| --- | --- |
| CLI create/set/init/canvas | 词法完整解析与参数绑定；画布尺寸用独立值类别 |
| 结构化 API create/set/init/canvas | 不依赖 tokenizer 的运行期校验，覆盖画布参数 |
| SVG read | 属性解析后接受同样领域值，不放过不安全字符串 |
| 领域直接方法 | 调用方不能绕过值约束 |
| 几何计算结果 | 输入合法不代表结果合法；结果仍验证 |

“统一”指值规则一致，不要求 API number 支持 CLI 的所有字符串写法。对应 numeric schema 不允许的类型应拒绝，不能任意 Number(...) 强制转换。

每张表包括：典型值、合法边界、边界外、空值、尾随垃圾、非有限、大/小有限数；paint 包括 none、命名色、已支持 hex、url()/var()/表达式；text 包括 XML 合法/非法字符和长度边界。

### 11.5 SVG 安全用例

| ID | 输入/攻击面 | 预期 |
| --- | --- | --- |
| SEC-01 | 任意 DOCTYPE，包括不带实体的 DTD | 直接拒绝，不加载 DTD |
| SEC-02 | 内部实体、小型递归/扩展实体样例 | 拒绝；不能启动不受控展开 |
| SEC-03 | 外部实体与外部 DTD，使用受控虚拟 URL/路径 | 拒绝；外部 resolver、网络、额外文件访问次数为 0 |
| SEC-04 | script、事件属性、javascript:/url()/href、foreignObject | 严格 schema 拒绝，不透传到保存文件 |
| SEC-05 | namespace 混淆、XInclude、同名异 URI 属性 | 拒绝，不按前缀或 local name 单独放行 |
| SEC-06 | 过深树、过长属性/文本、大量小节点 | 在配额边界分类拒绝，不能栈溢出/卡死后才失败 |
| SEC-07 | 错误文本中的换行、ANSI 控制字符、原始 XML | 诊断保持单行、无终端注入，不泄露原始内容/堆栈 |
| SEC-08 | 普通合法实体 `&amp;`、数值字符引用及纯文本 | 合法字符不被“禁所有实体”误拒绝 |

使用很小的受控样例验证拒绝路径和访问次数即可。不访问真实敏感文件或真实外网，也不把大规模拒绝服务 payload 带进日常 CI。安全目标来自既定的 SVG 子集与解析契约，不额外引入浏览器沙箱产品功能。

<a id="test-12"></a>

## 12. 文件 IO、保存提交点与队列测试

### 12.1 保存三态必须分别断言

初始文件 `b.svg=OLD`，当前路径 `a.svg`，dirty=true，保留非空历史。调用 `save b.svg`：

| FileStore 结果 | 文件事实 | 应用返回 | 内存状态 |
| --- | --- | --- | --- |
| not-committed | OLD 保留 | FILE_IO_ERROR，effect=unchanged | 文档、c/s、path、U/R、barrier、revision 全不变 |
| committed | 完整 NEW=encode(D) | 成功 | path=b.svg，s=c，dirty=false，清 U/R，barrier=save，revision+1 |
| indeterminate | 可能 OLD，也可能 NEW，不能断言 | SAVE_OUTCOME_UNKNOWN，effect=external-unknown | 旧 Head 保留，不自动重试，不 poisoned |

把 indeterminate 的物理情况分别设为“实际未替换”和“实际已替换”运行同一应用层测试；两者都必须保持相同的不确定结果分类。

### 12.2 文件与提交用例

| ID | 场景/故障位置 | 关键断言 |
| --- | --- | --- |
| IO-01 | resolve 路径、最近成功路径、中文/空格路径 | Application 不自行使用 cwd/path API；失败不更改 currentPath |
| IO-02 | read 在读取/解码/补 ID 后校验/结果准备失败 | 当前文档和元数据全不变；不发布局部 warning；队列可继续 |
| IO-03 | save 无路径或 encode 失败 | replaceUtf8 调用 0 次；状态不变 |
| IO-04 | encode 成功，保存后 Head/结果准备失败 | replaceUtf8 仍 0 次，证明完整准备在外部提交之前 |
| IO-05 | temp create/write/close 失败或确认替换未发生 | 旧文件完整；not-committed；不发布预备保存状态 |
| IO-06 | replaceUtf8 committed | 文件新内容完整；只发布一次；原文档对象/当前内容身份不变 |
| IO-07 | replaceUtf8 indeterminate；或异常无法证明未替换 | 按不确定处理，不猜 OLD、不自动重试、不把内存标故障 |
| IO-08 | committed 后格式化/stdout 失败 | 已保存事实、路径、检查点、历史屏障和 revision 保留；不报 cannot write file |
| IO-09 | 替换前清理 temp 失败；成功后诊断失败 | 不误删原目标；主错误不被掩盖；成功后不降格 not-committed |
| IO-10 | 文件被其他进程在确认保存后修改 | savedStateId 仍表示最近确认保存点；当前阶段不自动监视/重算 dirty |

IO-10 是边界说明和小型适配器场景，不要求加入跨进程锁、冲突检测或文件监听器。也不设置 save 超时后抢跑、取消成功或断电持久性验收目标。

### 12.3 NodeFileStore 真实集成

| ID | 夹具 | 预期 |
| --- | --- | --- |
| FS-01 | 真实临时目录中的合法 UTF-8 SVG | 读取正确；多字节 Unicode 跨读取块也能正确解码 |
| FS-02 | 非法 UTF-8 字节、截断多字节序列 | 严格解码报错，不静默替成 U+FFFD |
| FS-03 | 不存在文件、目录误作文件、受控访问错误 | 分类读写错误，无旧会话改变 |
| FS-04 | 首次保存与覆盖已有普通文件 | 正确新建/替换，结果完整；不先删除旧目标 |
| FS-05 | 临时文件碰撞 | 独占创建不覆盖已有碰撞文件；处理方式按适配器策略 |
| FS-06 | 写入与 close 未完成时观察替换调用 | 不能提前替换；临时文件位于目标同目录 |
| FS-07 | 部分 temp 写、close 失败、确认替换未发生 | OLD 完整，尽力清理；只清理本操作拥有的 temp |
| FS-08 | 清理再次失败 | 保留主要阶段/错误；残留如实报告，不误删目标 |
| FS-09 | stat 大小与实际流字节数不一致 | 按实际累计读取执行 maxSvgBytes，不能仅凭 stat 放行 |
| FS-10 | 普通路径/相对路径/符号链接/悬空链接 | 按 CFG-14 冻结策略逐项验证，不假定所有 OS 相同 |
| FS-11 | 替换异常且无法确认目标是否改变 | indeterminate；不对文件实际内容作旧/新断言，应用行为同 IO-07 |

适配器“确认未提交”的结论必须有失败阶段依据。不能把所有 rename 异常一律映射为未修改目标；POSIX 的相应失败保证对 EIO 有例外。[W8]

用精确的底层文件系统替身制造罕见错误，再用真实临时文件证明正常路径。不要单靠 chmod/只读属性制造跨平台错误：在管理员/root 环境它可能不产生预期失败。

### 12.4 队列与请求隔离

| ID | 控制步骤 | 预期 |
| --- | --- | --- |
| QUEUE-01 | 用 Deferred 闸门阻塞 save 的 replace；随后排队 edit、query | 后续请求既不执行也不返回；释放后按入队顺序处理 |
| QUEUE-02 | 阻塞 read；排队查询/编辑/历史命令 | 所有类别同队列，不能读到候选半成品 |
| QUEUE-03 | 前任务返回用户错误/IO错误；后任务合法 | 后任务正常运行，Promise 链不永久 rejected |
| QUEUE-04 | 入队后修改 caller request.shape、ids 数组、path 字段 | 实际执行采用入队时复制冻结的值 |
| QUEUE-05 | 不逐条 await，排队 delete r1、create 新 r1、move r1 | move 在执行时解析 ID，作用于新对象，不能捕获旧 Shape |
| QUEUE-06 | 前序编辑后紧接 save；save 后再查询 | save 编码已提交前序内容；各 status 是各自完成时的独立快照 |
| QUEUE-07 | save 三态逐一释放闸门 | 后任务分别从新 Head 或原 Head 继续；不因时间竞争提前放行 |

采用明确的 started/completed 事件、可控制 Promise 和调用日志，不使用任意 sleep 推断顺序。测试可以设置**整个测试的防挂起超时**，但它不等于产品提供 save 取消/超时语义。

### 12.5 REG-SAVE 完整验收序列

1. 读入 a.svg，编辑得到脏文档，记录原 status。
2. 保存到 b.svg，注入 not-committed；断言 OLD、原 status、原 Redo/Undo。
3. 再保存，注入 indeterminate；对目标可能 OLD/NEW 各运行一次，均断言原 status 和一次调用。
4. 再保存，返回 committed；核对 b.svg、clean、路径、屏障、revision。
5. 模拟此成功结果呈现时输出失败；核对业务事实保持。
6. 在仍存活的 EditorSession/API 测试实例上执行合法空编辑解除屏障，证明呈现失败没有损坏业务会话。真实 CLI 是否在呈现错误后退出另按 CFG-15，不强求退出的进程继续接收输入。

步骤 2/3/4 使用独立重置夹具或清晰记录物理文件内容，不能因前一次不确定结果改变了目标而错误假定下一次仍为 OLD。

<a id="test-13"></a>

## 13. 属性测试

属性测试只对写明的输入域和前提做量化。所有随机输入有限、有界、可复现；每个高风险性质先有一个确定性反例驱动的测试。

### 13.1 属性目录

| ID | 前提 | 性质及比较层次 |
| --- | --- | --- |
| PROP-01 | C 是成功实变、可撤销编辑 | undo(C(D)) 与 D 语义等价，身份/历史按规则；revision 增加。C 已清掉的旧 Redo 不要求恢复 |
| PROP-02 | 对应 undo 后，该历史条目仍为 Redo 栈顶，且未建立屏障 | redo 后语义等于第一次 C 的 after；核心层复用相同条目/节点 |
| PROP-03 | 从可信状态执行 EditRequest dry-run，且未发生不可信内部故障 | 成功或 effect=unchanged 时原会话不变；成功预览回滚后仍有效；同初态/依赖条件下紧接的成功 commit，其 contentChanged 与 wouldChange 对应。补偿失败按 poisoned 测试 |
| PROP-04 | 合法混合 Group、合法变换 | Group 变换结果等于独立计算各叶子一次的结果，非后代不变 |
| PROP-05 | 任意可信提交/普通失败/dry-run 后 | 可达节点集合、活动索引、父指针、计数满足独立 INV |
| PROP-06 | 合法结构重挂/分组/解组/重排 | 存活节点自身状态不变，顺序及归属按具体规则；不比较 computed style |
| PROP-07 | D 属支持子集，encode(D) 满足 decode 配额 | decode(encode(D)) ≡ D，含存在性/只读属性/元数据，不含会话身份 |
| PROP-08 | X 是被支持且有足够配额的 SVG | N(N(X))=N(X)，N=encode∘decode；同时检查首次规范化语义 |
| PROP-09 | 初态可信，且错误返回 effect=unchanged | 可信完整会话保持，后续合法请求可继续 |
| PROP-10 | 已完成参数/合法性验证的真正 no-op | 不加 Undo、不清 Redo；屏障及 revision 按 §9.1 |
| PROP-11 | 相同输入和支持规则 | 自动 ID、警告顺序及 semanticRepair 确定，不受以前失败影响 |
| PROP-12 | 任意返回 DTO/preview | 调用者改动不影响核心；未来编辑不反向改变旧返回值 |
| PROP-13 | 对两个不同叶子的独立合法字段修改 | 交换顺序后最终文档语义相同；不要求历史/token/revision 的中间序列相同 |
| PROP-14 | front/back/addto 目标不变，第一次成功 | 第二次相同操作无内容变化；若屏障已解除则无会话变化 |
| PROP-15 | 任何成功的资源受限编辑/导入 | 活动规模、深度、文本及属性不超限；拒绝不得裁剪内容 |
| PROP-16 | 同一初态下等价的 CLI/API 请求 | 结果文档和公开状态对应；不比较新建会话的内部 token |

PROP-01/02 的“精确恢复”来自快照回放，不能替换为 `scale f; scale 1/f` 或 `move dx; move -dx` 的浮点代数测试。

### 13.2 生成器

| 生成器 | 设计 |
| --- | --- |
| 支持的文档 | 默认最多 30—40 个节点、深度 4—5；六类型；空组/混合组；显式和缺失属性均有 |
| 数值 | 大部分小整数/二进制可精确表示小数；另有浮点专组覆盖 0.1、大/小有限数和溢出 |
| ID | 合法集合内有界字符串；专门构造大小写区别、编号冲突、删除后重用 |
| 文本 | XML 合法 Unicode 标量；显式混入空格、CR/LF/TAB、&<>、emoji；非法字符由负例生成器提供 |
| 颜色 | 从冻结 schema 的独立表生成；危险/非法字符串走独立负例 |
| 树结构 | 宽树、深链、空组、多个父、祖孙关系；先构造合法树，避免大量事后过滤 |
| 错误请求 | 已存在 ID 冲突、自身/祖孙循环、已知非容器、单项非法值、刚好越限 |
| 不支持 SVG | 在最小合法基底中加入一个不支持特性，失败原因容易解释 |

不要大量使用 `fc.pre` 丢弃样本来掩盖生成器质量；不要让随机字符串几乎都落到“ID 不存在”。每类命令应有实际执行计数，记录有效/故意失败/no-op 的比例。

### 13.3 运行规模与复现

以下是 TEST 建议起点，首次实际运行后按时间预算调整，不宣称固定性能：

| 场合 | 单一属性 | 状态机序列 | 数据规模 |
| --- | --- | --- | --- |
| 本地快速 | 每条 50 次 | 30 条 × 最长 40 步 | ≤30 活动节点 |
| 合并前 | 每条 200 次 | 100 条 × 最长 80 步 | ≤40 活动节点 |
| 发布前/扩展 | 每条 1000 次 | 500 条 × 最长 200 步 | ≤60 活动节点；压力测试另跑 |

本地使用固定回归 seed 加一个新 seed；持续验证保存实际随机 seed。普通属性失败保存 `seed`、`path`；使用 `fc.commands` 的状态机还要保存并传回 `replayPath`。两者都保留缩减后的具体初始数据与命令序列、失败步骤、CFG/ResourceLimits、Node/依赖锁版本。重放时 seed/path 交给 assert，replayPath 交给 commands；依赖或生成器变化后仍需具体反例文件保障可复现。[W1][W2]

若未跑到某个重要操作类别，补固定用例或定向生成，不通过反复盲目加大 numRuns 解决。

<a id="test-14"></a>

## 14. 独立参考模型与状态机测试

### 14.1 模型的数据和算法必须更简单

建议测试模型使用：

- 平面节点记录：testUid、publicId、type、ownState、parentUid、有序 childrenUids。
- 根画布与其保留属性。
- 模型 documentToken、currentContentToken、savedToken、currentPath、revision、barrier。
- Undo/Redo 条目存完整的 **before/after 文档内容快照**（根、有序树、节点自身状态和 testUid），另存 before/after 内容 token；快照不包含 revision、path、savedToken、U/R 或 barrier，避免递归保存历史或错误回退会话元数据。
- 可控内存文件表和写入结果。

生产实现使用细粒度 ChangeSet/Memento/Placement；模型使用小规模文档全快照，undo/redo 恢复文档和对应内容 token，再独立更新历史与 revision，保留当时的路径和保存检查点。这样两者不会共同依赖同一位置回放算法。模型深拷贝是测试的简化手段，不能搬进生产普通编辑路径。

dirty 必须按模型 token 关系计算，不根据几何是否等于某个文件判断。testUid 区分同名新旧节点；不把公开 ID 当节点生命期身份。

### 14.2 模型的 group 采用一次性构造结果

不要调用或复制生产 `GroupPlan` 的“先插入组，再逐个 Placement”步骤。模型可以：

1. 在旧树上取得每个选中节点的路径（从根起的兄弟索引整数数组），校验互不为祖孙。
2. 按索引数组逐分量数值比较确定原文档顺序，求父路径的公共前缀确定最近公共父容器；不用 ID 排序，也不用路径字符串的默认字典序。
3. 找出该容器中最靠后的相关第一层分支 j。
4. 在模型副本一次性移除所选节点；保留未选节点、空原父组及其顺序。
5. 新组放在“原第 0…j 个直接孩子中，移除后仍保留的孩子数”所指位置。
6. 把选中子树按旧文档顺序作为新组孩子。

这与生产顺序写入算法不同，但应在 §8 的手算夹具上得到相同结果。模型本身先过 STR-01—STR-04，再用至少 12 个兄弟、反向选择索引 10 与 2 的宽树校准数值顺序，不能未经校准就用它判定实现。

### 14.3 模型与真实系统的边界

- 模型不得调用生产 Shape 变换、GroupPlan、ChangeSet、Codec 或不变量函数计算期望。
- 可以共用无行为的请求类型和固定输入数据；**不能共用业务决策函数**。
- 主状态机使用真实 Session/命令/领域/历史，端口用受控假实现，专注状态转移。
- 另设较短的真实 Codec + 临时文件序列，验证保存/再读与核心集成；期望仍来自手写夹具或模型语义。
- 随机模型先覆盖 ready/empty 与普通失败/保存三态。poisoned 的原语损坏先用确定性故障测试覆盖，避免为低收益仿造另一个完整恢复内核。
- 实际 Session 仍通过公开 execute 观察；不可观察身份由领域/History 测试补齐。

### 14.4 命令生成与状态覆盖

| 类别 | 建议抽样权重 | 定向选择 |
| --- | --- | --- |
| create/move/scale/set | 30% | 现有叶子、组、各种类型、属性存在性 |
| group/ungroup/addto/front/back/delete | 25% | 同父/跨父、非连续、深层、空组、祖孙关系 |
| undo/redo | 15% | 合法回放、空栈、屏障三种情形 |
| 明确 no-op | 10% | scale 1、move 0 0、边界重排、同父末尾 |
| 故意非法请求 | 10% | ID 冲突、未知目标、祖孙循环、非法因子、超限 |
| init/read/save/canvas | 5% | 屏障、保存点、补 ID、保存三态 |
| 查询与 dry-run | 5% | 有 Redo/有屏障时执行、预览隔离 |

权重是起始建议，不是通过条件。固定宏序列保证“保存点→编辑→undo→no-op→redo”“delete→同名 create→双 undo”等关键路径必定出现。

合法命令的 `check(model)` 只检查执行前提；**故意非法命令不能被 check 过滤掉**。例如“把组移进自己的后代”命令的 check 只需确认模型有可选祖孙对，run 中必须真正提交非法请求并验证拒绝。

从模型选目标时使用可缩减的选择参数或稳定句柄，run 内不再调用随机数。缩减后前置条件可以重新判断，但要保存每次实际解析出的 ID/请求，确保反例可独立回放。

### 14.5 每步的核对协议

1. 模型根据当前状态计算预期类别和下一状态，计算只发生在候选副本。
2. 对真实系统执行结构化请求并等待完成。
3. 比较成功/错误、effect、warnings，以及变化标志。
4. ready 状态比较完整文档语义和公开 status；empty 比较空状态；不可信状态仅按故障协议。
5. 核对 U/R 长度、屏障、path、dirty、revision；领域测试层另核对内部身份。
6. 运行独立不变量检查，保留旧 DTO 检测反向修改。
7. 断言通过后，将候选状态提交到稳定模型容器，例如 `model.state = candidate`，再继续；不要只重绑 run 内的局部 model 参数。第一处差异立即保留上下文。
8. 结束时清理测试临时目录/端口资源，不把某个测试的历史或队列复用给下一个测试。

### 14.6 fast-check 实施骨架

以下展示组织方式，`createModelHarness`、`commandArbitraries` 等是需要按本方案实现的测试辅助代码，不是生产 API，也不表示此片段现已可运行。`replayParameters` 保存 assert 的 seed/path 等参数，`replayPath` 为可选的 commands 重放路径：

```ts
import fc from 'fast-check';

it('MODEL-01 bounded edit histories match the reference model', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.commands(commandArbitraries, {
        maxCommands: 80,
        ...(replayPath === undefined ? {} : { replayPath }),
      }),
      async (commands) => {
        const h = await createModelHarness({
          maxNodes: 40,
          maxDepth: 5,
          initialFixture: 'small-nested',
        });
        try {
          await fc.asyncModelRun(
            () => ({ model: h.model, real: h.real }),
            commands,
          );
        } finally {
          await h.close();
        }
      },
    ),
    {
      numRuns: 100,
      ...replayParameters,
    },
  );
});
```

应用 execute 是异步的，因此使用异步模型运行；日常队列测试优先使用可控制 Deferred。需要额外探索异步调度时再使用 scheduledModelRun，不把它列为 Phase 1 必须引入的复杂层。[W1]

### 14.7 模型专项验收

| ID | 模型/生成器自身的验收 |
| --- | --- |
| MODEL-01 | 对 §8、§9 的手算轨迹给出精确预期；作为状态机主入口 |
| MODEL-02 | 参考模型不导入生产行为/事务/Codec，依赖检查验证 |
| MODEL-03 | 分组最终树算法独立，跨父/反序/最后分支保留均覆盖 |
| MODEL-04 | 故意失败命令确实执行，不能全部被 check 跳过 |
| MODEL-05 | 记录有效操作类别、no-op、错误、屏障及 Redo 状态覆盖 |
| MODEL-06 | 模型恢复快照和内容 token，不把 revision 回滚 |
| MODEL-07 | 同名不同 testUid 重用、删除子树与回放被抽样到 |
| MODEL-08 | save 三态及 read semanticRepair 被建模，文件未知不冒称 OLD |
| MODEL-09 | seed/path/replayPath 和具体最小命令序列可重放；保存失败步骤差异 |
| MODEL-10 | 每个确认缺陷的缩减反例转为固定回归，修复后保留 |

模型与实现一致仍不能替代独立 LAB 验收及人工规范审查。二者同时误解需求的风险，用来源独立的端到端用例和定向变异检验补足。

<a id="test-15"></a>

## 15. 端到端验收与预览

端到端只保留少量高价值会话。全部边界不需要重复穿过真实进程，以免测试慢、失败定位困难。

### 15.1 端到端场景

| ID | 场景 | 验收重点 |
| --- | --- | --- |
| E2E-01 | LAB §6 典型会话 | 核心命令、祖孙分组拒绝、删除恢复、save 屏障、读入补 ID |
| E2E-02 | LAB §6.1 版本 A 的两节点流程图 | 8 个元素、嵌套 in、组合移动、文本修改、可保存可读回 |
| E2E-03 | 用户错误与恢复会话 | 参数错误/目标错误后下一行仍执行；一行一条诊断 |
| E2E-04 | 双引号、中文、emoji、#、in、带空格文件路径 | 真实终端输入到最终 XML 的参数边界完整 |
| E2E-05 | 外部 SVG 夹具导入 | 无修复/补 ID/不支持格式三类；失败旧文档保留，警告不提前输出 |
| E2E-06 | 真实进程正常 EOF 和最后一次异步 save | 按 CFG-15 等待已接受任务结束；不在文件写完前退出 |
| E2E-07 | 同一发布构建在支持平台启动 | 实际入口、依赖、路径解析和换行符合记录，不依赖测试 runner 装配 |
| E2E-08 | 最终构建输出的代表 SVG 预览 | 在浏览器查看结构位置、文字、层序、继承，无新增内嵌渲染器要求 |

E2E-01 的 `other.svg` 使用 LAB 给出的真实 7 元素夹具。图形总数必须从文档计算，不能把示例数字写死。版本 B 的 box 不作为正例。

### 15.2 可直接转为脚本的流程图验收

测试工作目录为独立临时目录，文件名保持带空格，用来同时验证参数引用。

```text
init 800 600
create g flowchart
create g node1 in flowchart
create rect start 120 100 160 60 #4a90d9 in node1
create text start-label 155 135 "开始" in node1
create g node2 in flowchart
create rect process 520 100 160 60 #f5a623 in node2
create text process-label 545 135 "处理数据" in node2
create line arrow1 280 130 520 130 black in flowchart
tree
move node2 0 100
show process
show process-label
undo
show process
set process-label text "处理数据 v2"
save "flow chart.svg"
undo
read "flow chart.svg"
tree
```

检查点：

- tree 中恰有 3 个 g、2 个 rect、2 个 text、1 个 line，共 8 个 Shape。
- move 后 process.y=200、process-label.y=235；node1 和 arrow1 不变。
- undo 后 process.y=100、process-label.y=135。
- 保存文件包含更新后的 `处理数据 v2`、正确 namespace 和规范 viewBox。
- save 后 undo 被屏障阻止。
- read 回文件时无需补 ID，没有 assigned id 警告。
- 最终 tree 与保存前文档语义一致，不能要求 Session 的路径/历史/token 与保存前相同。

### 15.3 实际进程测试方法

- 使用实际项目启动入口，验证构建后的入口至少一次；不能只通过测试代码 new Session 模拟整个 CLI。
- 用子进程标准输入写入脚本，关闭 stdin 触发 EOF；设置测试级超时防止挂起。
- 使用 `shell=false` 和参数数组，避免宿主 shell 解释 #、引号或特殊字符。
- stdout/stderr 分别捕获；不把启动器 npm 自己的日志误认成业务输出。
- 精确匹配规定错误/提示符，解析或局部匹配必要成功字段，不把整段输出直接一键更新为 golden。
- 每个用例独立 cwd/文件；结束等待进程/文件句柄关闭后清理。
- 普通 REPL 命令失败与进程退出码分开检查；正常 EOF、启动失败、致命输出错误按 CFG-15 约定测试。

### 15.4 浏览器预览的作用

查看本项目产生的可信小 SVG 即可，检查文档可打开、文本正确、图形位置/层序/继承符合预期。浏览器预览不能证明活动索引、属性存在性、历史或数值精确恢复；字体/抗锯齿有平台差异，不设置像素完全相同的默认门槛。

不使用“自动 save 临时文件”来做应用查询或未来预览，因为 save 会改变路径、检查点和历史屏障。[SPEC §11.8]

<a id="test-16"></a>

## 16. 架构、静态检查与代码审查

功能全绿仍可能违反本 Lab 的考察重点。架构检查必须与行为测试并列。

### 16.1 自动与人工检查表

| ID | 检查 | 自动证据 | 需人工确认的部分 |
| --- | --- | --- | --- |
| ARCH-01 | TypeScript strict、类层次、字段封装、一类一文件 | 类型检查、类/文件名检查 | 纯类型分组合理；不是贫血模型配外部过程式内核 |
| ARCH-02 | 依赖方向与类型归属 | dependency-cruiser，包括 type-only 和别名 | Domain 类型没有反向放进 application/contracts |
| ARCH-03 | CLI 只负责适配 | 依赖规则、真实假端口执行 | 无图形编辑/历史/文件提交业务 |
| ARCH-04 | Command 实际落地 | 命令类与 Catalog 校验 | 不是空包装，Session 不再按所有 command 写第二套分派 |
| ARCH-05 | Composite | Group/叶子行为测试 | Group.move/scale 委托孩子；Group.set 自身语义；delete 用统一结构原语 |
| ARCH-06 | 两处名称分派 | AST/文本搜索辅助清单 | Catalog/Factory 唯一映射；Codec/Presenter/Parser 无第三处按 tag 业务分派 |
| ARCH-07 | 状态和副作用归属 | 多 Session 隔离、禁止 IO 模块依赖 | 无全局会话、无第二份可变 XML 属性表、无环境变量侵入 |
| ARCH-08 | 运行期封装与公开能力 | exports/声明检查、DTO 修改负例 | 没有公开 live Document、原始 setter、authority 或 lease 控制端 |
| ARCH-09 | 扩展点与范围 | 用 FakeCodec/FileStore 替换实现运行核心 | 不为了通过测试先做 box/动态插件/GUI；变化点按文档标注 |
| ARCH-10 | 普通编辑成本和历史结构 | 编码调用检测、性能辅助证据 | 不全文复制/hash；不可变历史栈不每次复制整个数组 |
| ARCH-11 | 架构规则本身有效 | 独立违规 fixture 中植入禁止依赖，检查必报错 | 不因 glob/路径别名/构建目录排除失去约束 |

### 16.2 依赖规则必须覆盖的边

| 来源 | 应允许 | 应拒绝 |
| --- | --- | --- |
| cli | application 公开入口、纯值契约、语法元数据 | infrastructure 实现、领域可变能力 |
| application | domain、自己的 ports/contracts | cli、具体 XmlSvgCodec/NodeFileStore |
| domain | 自身值/协议与语言能力 | application、cli、infrastructure、DOM、Node IO |
| infrastructure | application ports、domain 构建/描述契约 | CLI 呈现、Session 内部可变状态 |
| main/composition | 所需装配模块 | 承载 move/group/undo 算法 |
| src 生产代码 | 生产模块 | test 参考模型/测试入口/故障替身 |

dependency-cruiser 配置必须包含 TypeScript 编译前依赖，避免漏掉 `import type`；官方规则说明中 type-only 依赖与相应选项有关。[W4] 用一个“domain 导入 application 的纯类型”违规夹具确认它确实被拦截，而不只检查普通运行期 import。

对公共合同的 re-export 也检查最终类型内容，不能以“从 application 导入”为名把 live Shape/Document 间接泄露给 CLI。

### 16.3 两处分派的审查方法

先搜索 `switch`、按 type/tag/command 的条件链、名称到 handler 的 Map/对象表，再按职责判断。以下分支本身合法：执行模式、事务阶段、错误类别、根 svg 结构识别。

审查真正要排除的是：

- Parser 重复维护命令名→解析器，Catalog 又维护一份。
- Session 把 Command 丢回 name switch 执行。
- Codec/Presenter 重复列举每种图形来计算几何/属性语义。
- Command 统一按 tag 计算所有图形变换。
- Factory 外另有一份类型→类注册表。

不要用“源码不能出现 switch”代替本项。最终报告必须将 Catalog 与 Factory 这两处分派注明为后续注册机制演化的变化点/待重构点。[LAB §2.1；SPEC §4.5]

### 16.4 AI 实现与审查分工

1. 实现者以实现规范完成一个可审阅的小功能。
2. 测试设计者从 LAB/SPEC 写预期，先解释断言来源，再查看实现返回值。
3. 独立审查者先读原始需求与测试追踪，再检查代码，重点尝试构造反例。
4. 对失败先定位需求、实现、模型或测试预期哪一方有误，不能自动更新快照。
5. 确认缺陷后先固定最小反例，再修改代码；记录原因与证据。
6. 架构语义改变时同步修订文档和测试，而不是只让测试追随实现。

交给审查者的重点问题：是否有遗漏状态、是否存在同源错误、失败是否真回滚、权限是否可绕过、输出失败是否被当业务失败、是否悄悄扩大 SVG 支持范围。审查不要求每次调用另一个工具或模型，但必须有从原始要求独立核对的证据。

<a id="test-17"></a>

## 17. 资源、性能与内存验证

### 17.1 资源边界

用很小的注入配额验证 L−1/L/L+1，避免靠巨大输入测试拒绝路径。参数值是测试夹具，不替代生产 ResourceLimits 的选择。

| ID | 配额/场景 | 关键断言 |
| --- | --- | --- |
| LIM-01 | maxSvgBytes，含中文/emoji | 按实际 UTF-8 字节限制；跨块多字节不误判；超限分类拒绝 |
| LIM-02 | maxNodeCount，read/create/group | 按最终活动 Shape 计数，g 算、root 不算；临界成功/超限失败 |
| LIM-03 | 删除子树后再创建；历史持有已删对象 | 删除释放活动配额；历史保留对象不算活动节点 |
| LIM-04 | maxTreeDepth，create in 深组 | 根/直接孩子深度按统一定义，恰好等于上限可接受 |
| LIM-05 | addto 移动高子树至深容器 | 考虑整棵被移子树高度，不只看目标父深度 |
| LIM-06 | group 包装导致深度增加 | 超限时不留下新组、不丢目标；失败保留 Redo |
| LIM-07 | maxTextLength，create/set/read | 同一计量单位，含 Unicode 区分样例，越限不截断 |
| LIM-08 | maxAttributeLength，ID/paint/只读属性 | 按冻结适用范围一致检查，不被不同入口漏过 |
| LIM-09 | 会话创建后调用者修改原 limits 对象/环境变量 | 当前会话的规则不变；undo/redo 不受动态配置污染 |
| LIM-10 | 合法内存文档编码超过输入字节上限 | 再 decode 可明确超限；save 输出限制按 CFG-13；不裁剪、不要求每条编辑全文 encode |

例如测试深度上限设为 3 时，分别构造深度 2/3/4；测试字节数时直接计算 UTF-8 bytes，不能使用 JS string.length 代替。每个资源负例都检查状态原子性和后续操作。

### 17.2 性能目标与基准

性能测试同时记录 n=活动节点数、k=涉及节点数、s=相关兄弟数、B=文本/属性规模。仅使用“文件大小”不足以解释宽树重排和深树操作的成本。

| ID | 检查 | 验收方式 |
| --- | --- | --- |
| PERF-01 | 单叶 move/set 随无关文档规模增长 | 时间/分配趋势应无显著全文处理；明确禁止普通编辑调用 encode/hash/全树深拷贝 |
| PERF-02 | Group move/scale | 成本随涉及后代 k 增长，未涉及子树不遍历做业务修改 |
| PERF-03 | 删除子树与索引维护 | 全部 k 个后代正确注销；不能为追求常数时间漏更新 |
| PERF-04 | 同级重排/addto | 接受数组带来的 O(s)，检测重复无关全文扫描 |
| PERF-05 | group 宽树/跨父 | 记录 O(ks) 最坏增长可能；不错误要求所有情况 O(k) |
| PERF-06 | 长历史 push/pop 与 Undo/Redo | 栈头操作不复制全部历史；回放成本与实际变化/数组维护相称 |
| PERF-07 | decode/encode | 记录 B+n 规模趋势、峰值内存与配额拒绝，不声称任意复杂 SVG 都可处理 |
| PERF-08 | 文档操作设置屏障并清历史/实变编辑截断 Redo/替换文档后的引用释放 | 无永久全节点注册表；按可达引用解释内存保留 |

建议在同一环境、固定数据和 seed 下，选择 100/1000/5000 节点或生产配额内相近规模，多次运行记录中位数及较高分位。精确次数与时限在首次基准后冻结；共享 CI 不使用跨机器通用的硬毫秒门槛。

把全树不变量检查、输入生成、首次 JIT、测试快照构造放在计时区间之外或单独报告，否则测到的是测试框架 O(n) 成本。结构性禁止项适合强断言，毫秒数据用于趋势诊断。

### 17.3 内存与历史

删除一个组可能只形成一条 PlacementChange，但历史仍会持有整棵子树。这是可撤销性需要，不能据“一条记录”宣称常量内存。[SPEC §13.3]

验证三种保留关系：

- 仍可 undo 的删除子树继续存活，行为正确。
- Redo 被实变新编辑截断后，失去所有历史/事务引用的候选可以释放。
- init/read/save 屏障清历史后，不再由永久节点注册表强引用旧节点。

以源码引用路径和必要时的堆快照辅助判断；不把“调用一次 GC 后 WeakRef 必须为空”作为稳定 CI 断言。不要为满足内存测试引入未经约定的历史截断/淘汰策略。

<a id="test-18"></a>

## 18. 变异测试与测试有效性审查

变异测试可选；核心目的是证明已有断言能发现关键错误。StrykerJS 可用于 TypeScript 项目并与测试 runner 配合，落地时按锁定版本选择兼容的 Vitest runner。[W5]

### 18.1 定向变异清单

这些是有意制造的错误与应当检出它们的证据。可以先手工在隔离分支验证少量，再决定是否跑自动化工具。

| ID | 错误变异 | 应失败的测试 |
| --- | --- | --- |
| MUT-01 | front/back 首尾颠倒 | STR-13 |
| MUT-02 | group 按参数顺序，而非原文档顺序 | STR-01/02、REG-GROUP |
| MUT-03 | 保存 G 最终索引覆盖创建时索引 | REG-GROUP undo |
| MUT-04 | delete 只注销 Group，不注销子孙 | STR-15/17、INV-05 |
| MUT-05 | 历史根据 SVG ID 查当前对象 | HIS-09、同名不同代轨迹 |
| MUT-06 | undo scale 使用倒数 | GEO-09、PROP-01/02 |
| MUT-07 | 把缺失 fill 当显式 black | SET-04、XML-11、PROP-07 |
| MUT-08 | 成功 no-op 清 Redo 或加入 Undo | HIS-04/07、PROP-10 |
| MUT-09 | 同尺寸 canvas 调用 afterEdit(null) | DOC-05、REG-STATE |
| MUT-10 | dry-run 解屏障或增加 revision | DRY-03/04 |
| MUT-11 | read 边读边补 ID/提前发 warning | ID-01/03/06/07 |
| MUT-12 | 自动补 ID 后仍标 clean | ID-11、DOC-03 |
| MUT-13 | clean save 直接短路不设屏障 | DOC-08、HIS-08 |
| MUT-14 | indeterminate 自动重试或当 not-committed | IO-07、REG-SAVE |
| MUT-15 | stdout 失败时业务回滚 | IO-08、CLI-14 |
| MUT-16 | 入队请求不复制或提前解析 Shape | QUEUE-04/05 |
| MUT-17 | 删除 transform/未知属性后继续导入 | XML-06/08 |
| MUT-18 | 在 text 内插入缩进或固定小数截断 | XML-15/16、PROP-07 |
| MUT-19 | prepare 后不可回滚/先提交再构造结果 | FAIL-04/05、TX-02 |
| MUT-20 | 忽略 type-only 的依赖违规 | ARCH-02/11 的违规夹具 |

若变异存活，先判断是否等价变异、是否不在当前支持范围、是否实际遗漏断言。不要为了提高分数加入只重复实现内部调用顺序而无需求意义的断言。

定向变异验证在独立工作分支/测试副本完成，恢复后重跑相关测试，不能把变异代码混入发布提交。变异结果单独记录，未执行时明确写“未执行”。

### 18.2 覆盖率的使用

建议初始门槛：

| 范围 | 语句/行 | 分支 | 补充条件 |
| --- | --- | --- | --- |
| 领域、历史、Session 核心 | ≥90% | ≥85% | 本方案列出的关键状态/故障分支全部有确定性证据 |
| 整体生产源码 | ≥80% | ≥75% | include 覆盖所有相关生产文件，未导入文件不能消失 |
| 需求追踪 | 所有必须行有证据 | 不适用 | 19 命令、36 set 组合、关键状态边界不能以平均比例替代 |

这些是 TEST 建议，不是 LAB 原有评分线。首次落地可根据代码形态校准并写明理由；不能通过排除困难文件、取消分支统计或修改用例预期来让数字变好。覆盖率配置只排除确实无可执行行为的纯类型/生成文件等，并记录范围。

有 95% 覆盖率但 save 不确定分支未测，仍不满足本方案；有一处仅运行在不可恢复进程故障中的防御分支未覆盖，则应说明其证据与限制，而不是盲目制造危险故障。

<a id="test-19"></a>

## 19. 增量实施、持续验证与发布门槛

### 19.1 按依赖实施测试

| 阶段 | 先交付什么 | 完成证据 |
| --- | --- | --- |
| T0 基线与测试底座 | 来源追踪、CFG 登记、固定夹具、独立 Snapshot/INV、锁定工具 | 比较器正反例、类型/依赖检查入口可运行 |
| T1 值与富领域模型 | 六 Shape、36 set 组合、几何、存在性、DTO | CLI/API/读取适用值表一致；叶子行为可独立验证 |
| T2 树结构与可逆变更 | Placement、GroupPlan、group/ungroup/delete、权限、两类 Change | STR、TX、REG-GROUP 与全部 INV |
| T3 历史与 Session | no-op、屏障、dirty/revision、统一发布、dry-run、故障注入 | REG-STATE、FAIL、DRY、FAULT、QUEUE |
| T4 Codec 与文件边界 | 支持子集、自动 ID、转义/UTF-8、三态保存 | XML、ID、SEC、IO、FS、REG-SAVE |
| T5 CLI 闭环 | parser/presenter、19 命令、来源会话、真实进程 | ERR、QRY、E2E，代表 SVG 可预览 |
| T6 组合探索 | 属性、独立状态机、最小反例固定、资源/性能 | PROP、MODEL、LIM；规模及 seed 可重放 |
| T7 发布审查 | 独立需求/架构复审、完整运行、真实证据、课程报告/tag核验 | 第 20 节交付清单 |

开发顺序可与模块实现交错，例如简单 CLI 垂直切片可以更早出现；表中顺序描述测试依赖，不要求直到 T5 才第一次启动产品。

每完成一个有意义的功能与对应验证再提交 Git。不要将“测试设计全部写好”误认为“先实现所有代码、最后一次性补测试”。

### 19.2 建议测试命令协议

以下是后续应在 package scripts 中建立的入口名，目前不表示工程已有这些命令：

| 入口 | 内容 |
| --- | --- |
| `npm run typecheck` | 生产与测试 TypeScript 检查 |
| `npm run lint` / `npm run format:check` | 静态规则与格式 |
| `npm run check:deps` | 架构依赖规则与必要违规夹具 |
| `npm run test:unit` | 值、领域、历史、CLI 单元 |
| `npm run test:integration` | Session/Codec/文件适配器 |
| `npm run test:e2e` | 真实 CLI 会话 |
| `npm run test:property` | 属性测试 |
| `npm run test:model` | 独立参考模型状态机 |
| `npm run test:coverage` | 常规测试与完整源码覆盖率 |
| `npm run test:performance` | 单独的基准/内存趋势 |
| `npm run test:mutation` | 可选定向变异 |
| `npm run verify` | 可重复的合并前静态+必须测试+轻量随机组合 |

如提供 `FC_SEED`、`FC_PATH`、`FC_REPLAY_PATH`、`TEST_PROFILE` 环境变量，明确它们是**本项目测试脚本读取并转交 fast-check 的约定**，不是假定工具会自动识别。seed/path 传给 assert，replayPath 传给 commands；配置回放参数时避免污染无关测试的全局随机设置。

### 19.3 验证频率

| 场合 | 运行范围 |
| --- | --- |
| 修改一个模块 | 相关确定性测试、类型检查、受影响依赖规则 |
| 一次功能提交前 | 涉及的单元/集成、既有相关反例、基本静态检查 |
| 合并/阶段完成 | 全部必须测试、端到端、轻量 property/model、覆盖率 |
| 发布候选 | 从干净检出运行 verify，扩展随机、资源/性能审查、独立人工复核 |
| 随机测试发现缺陷 | 固定 seed/path（状态机加 replayPath）重放→缩减→独立固定反例→修复→局部+相关回归 |

测试用例彼此独立；可以跨文件并行，单 Session 内仍按产品契约串行。真实文件用例使用隔离目录，不通过全局共享路径或固定端口相互干扰。不要依靠自动重试隐藏 flaky；重跑用于定位，第一次失败必须保留。

### 19.4 发布门槛

建议以以下条件作为可宣称完成的依据：

1. LAB/SPEC 的必须需求追踪没有缺口，CFG 对实际支持输入已集中记录。
2. 19 命令、六类型、36 个 set 组合及规定错误文本均有确定性证据。
3. 不变量、跨父分组、同名对象、浮点恢复、no-op/屏障/dirty/revision 回归通过。
4. prepare 后失败、dry-run、回放补偿、poisoned 恢复、保存三态和提交后输出失败已验证。
5. SVG 不静默丢弃不支持内容，自动 ID 和文本/属性存在性正确。
6. 静态检查与架构人工审查无未记录违规，公共能力不泄漏。
7. 至少完成轻量属性与模型测试；已发现的最小反例成为固定回归。
8. 真实 CLI 会话、真实文件读写、代表 SVG 预览完成。
9. 全部测试从指定发布提交可复现；没有 .only、未说明的 skip、未处理 flaky、意外依赖开发者本机文件。
10. 性能/内存没有违反既定架构的明显全文处理或永久注册表问题；实测数据如实记录。
11. 最终报告和 Git 交付符合 LAB。

覆盖率数值和随机次数是辅助门槛。必须项失败不能用“整体大多数通过”替代；未执行的强化/可选项按事实披露。

<a id="test-20"></a>

## 20. 测试报告与最终交付检查

### 20.1 报告模板

最终 `doc/TEST_REPORT.md` 至少填写：

| 项目 | 应记录 |
| --- | --- |
| 被测版本 | 提交 SHA、分支/候选 tag、工作区是否干净 |
| 环境 | OS、Node/npm、TS、测试库/XML 库版本、锁文件标识 |
| 规范版本 | LAB、SPEC、TEST、INPUT_PROFILE 版本或内容 hash |
| 执行命令 | 实际命令及参数，不只写“测试通过” |
| 需求覆盖 | 追踪行→测试文件/ID→结果；未实现/跳过逐项说明 |
| 自动测试 | 通过/失败/跳过数量、失败用例与日志 |
| 属性/模型 | 属性数、numRuns、maxCommands、seed/path、状态机 replayPath、具体最小反例路径 |
| 故障注入 | 注入位置、预期/实际 effect、恢复与后续操作证据 |
| 覆盖率 | 统计范围、语句/行/分支、遗漏原因 |
| 性能/内存 | n/k/s/B、环境、重复次数、分位数、解释与限制 |
| 独立审查 | 审查点、发现问题、修复提交、仍未解决的限制 |
| 人工预览 | 文件、查看环境、结果；不以“看起来正常”代替自动证据 |

状态只用“通过/失败/未执行/有条件不适用”等明确值。当前这份测试方案的状态为**设计完成、待实现执行**，不能从规划的测试数量推导任何实际通过率。

### 20.2 交付检查

| ID | 检查项 | 证据 |
| --- | --- | --- |
| DEL-01 | Git 历史体现增量开发，非 one-shot 大提交 | 有意义的功能/测试/修复提交及审查记录 |
| DEL-02 | 代码推送远程仓库 | 远程可核对的对应提交 |
| DEL-03 | final tag 指向确实验证过的最终提交 | tag 目标 SHA 与报告一致；不能验证 A 却标记 B |
| DEL-04 | final tag 在课程截止前完成 | 按真实课程截止核对；来源未提供日期，不能自行补造 |
| DEL-05 | `doc/README.md` 格式与栏目完整 | 架构方案、过程记录、一致性自查、质量保证 |
| DEL-06 | 架构图使用课程要求的 PlantUML 组件图/包图 | 源码/渲染与实际目录对应；本方案表格或其他图不替代该要求 |
| DEL-07 | 实现与方案偏差已记录 | 模块、依赖、变化点、两处分派待演化说明 |
| DEL-08 | 从 final 对应干净检出可复现 | 锁依赖安装、构建、测试入口、fixture 和文档齐全 |

测试报告应链接真实产物和缺陷记录。无需把每次庞大日志或整个 coverage HTML 都提交进 Git；保留必要摘要和可定位的运行产物，避免敏感本机路径/环境数据混入报告。

### 20.3 每次缺陷的最小记录

记录“来源条款→初始状态→最小输入→预期→实际→根因→修复→新增回归 ID”。例如：

- 来源：SPEC D06。
- 初始：Undo 后存在一条 Redo。
- 输入：`move r1 0 0`。
- 预期：Redo 保留，revision 不变。
- 实际：Redo 被清空。
- 根因：Session 对所有成功编辑统一清 Redo，没有区分 changes.isEmpty。
- 修复证据：对应提交与 HIS-04/PROP-10 的实际运行结果。

这只是报告写法示例，不表示项目已经发现或修复了该缺陷。

<a id="test-21"></a>

## 21. 资料与来源索引

### 21.1 项目来源

- **LAB：** 用户提供的 `phase_cli_1.md`。§1：交付；§2：通用约定及范式；§3：命令；§4：细则、错误、历史与未来 box；§5：显示；§6：典型会话。
- **SPEC：** 用户提供的 `SVG_Editor_Phase1_Implementation_Spec.md`，版本 1.0，2026-10-25。本文按其 §1—§16 与附录 A—C 设计，并把 §14 的 P1—P6 状态推演转为确定性回归和故障测试。
- **对应关系：** P1→STR/REG-GROUP；P2→GEO-07/FAIL-03；P3→DRY；P4→HIS/REG-GROUP；P5→ID-06/IO-02；P6→IO/REG-SAVE。

本次可用来源中，两份实现规范副本内容一致。设计以版本 1.0 为准；今后实现规范修订时按追踪矩阵定位受影响用例，不静默保留相互矛盾的预期。

### 21.2 官方技术资料

工具资料用于确认能力和注意事项，具体命令与配置仍按工程锁定版本落实；不把网页当前版本自动当成项目已选版本。

- **W1：** [fast-check — Model based testing](https://fast-check.dev/docs/advanced/model-based-testing/)。命令 check/run、序列缩减、异步模型运行、replayPath 与模型独立性。
- **W2：** [fast-check — Read test reports](https://fast-check.dev/docs/tutorials/quick-start/read-test-reports/)。seed/path 重放和最小反例。
- **W3：** [Vitest — Coverage](https://vitest.dev/guide/coverage)。覆盖率 provider、include 与未测试文件统计。
- **W4：** [dependency-cruiser — Rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)。依赖规则与 type-only 检查。
- **W5：** [StrykerJS — Getting started](https://stryker-mutator.io/docs/stryker-js/getting-started/)，[Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)。可选变异测试及 runner 集成。
- **W6：** [XML 1.0 Fifth Edition](https://www.w3.org/TR/xml/)，§2.2、§2.11、§3.3.3。合法字符、行尾及属性值规范化。
- **W7：** [SVG 2 — Basic Shapes](https://www.w3.org/TR/SVG2/shapes.html)。几何属性及退化形状语义，供零边界决策参考。
- **W8：** [POSIX — rename](https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html)。目标替换与失败语义；保存三态的项目契约以 SPEC 为准。








