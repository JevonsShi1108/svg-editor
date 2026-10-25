# M14 从 LAB/SPEC 重新核对

2026-10-25 恢复结果：用户开启开发者模式后，原 test/integration/files.test.ts 未修改，19 项全部通过、0 skip；真实 file symlink 和 dangling link 的 read/save 拒绝、链接保留与原目标 OLD 均已实际断言。完整 npm run verify 已通过：767 passed、0 failed、0 skipped，静态/架构/覆盖率/8 项性能/315 个 local_required 全绿。此前 EPERM 和 BLOCKED 收据保留为历史；最终准确候选状态仍以提交后的干净检出收据为准。

本轮按原始约束重新查源码、追踪和反例，不把覆盖率当作架构正确性的证明。复核由当前执行者以单独的需求检查顺序完成，没有声称外部审查者或额外模型背书。M14 首次复核时 FS-10 曾被系统 EPERM 阻塞；本次能力恢复后的结果见顶部，旧检查点保留为历史。

## 范围与模式

LAB §2.1 / SPEC §4：生产类按类名分文件；领域包含六个 Shape 子类及 Group Composite。Group.move/scale 委托孩子；自身 set 沿用 Shape，不传播显式样式。各 Command 在 run 内调用领域行为；Session 通过多态协调接口执行，不重新按命令名分派。`main.ts` 仅装配真实端口和终端。

名称注册只有 CommandCatalog 和 ShapeFactory 两处。检查脚本实际提取 19 个命令注册名、6 个工厂名，与独立固定集合核对；搜索 shape.type/command 的名称条件，以及 Map、switch 后逐项判断职责。Presenter 的 ResultData.kind、Decoder 的根/contentModel 分支、事务阶段和错误类别属于协议判别，没有复制图形几何或命令执行分派。后续注册机制的演化仍是明确变化点，当前不新增插件加载或 box。

## 类型、权限和依赖

SPEC §6—8：Session 的 Head、队列和全部协调方法使用运行期 # 私有。公开 execute 返回纯值 DTO；CLI 仅依赖 SessionExecutor/CommandParser/结果契约及错误转换。api.ts 的可达结果类型没有 live Shape、Document、authority 或 lease；history.ts 内部条目类型没有从 API 结果重新导出。

领域业务只能持 EditTransaction，控制端由 EditLease 持有；原始 writer 位于 internal 协作者。NodeMemento 只有 target 绑定的自身属性/文本，无父子结构副本。结构只通过 PlacementChange，状态只通过 NodeStateChange。内部模块不是针对任意不受信代码的安全沙箱；应用公开入口不泄露这些模块的 live 对象。

依赖检查覆盖编译前纯类型引用、运行期无环及类名/文件名。M14 加强 CLI 禁止导入 application/internal/commands/history、infrastructure 禁止 Session internal。13 个实际植入禁止边均被检出，包括类型别名解析、domain→application type-only、domain/application→Node core、CLI→基础设施/live 领域/私有 Head、基础设施→私有 Head、生产→测试、模型→生产行为。记录在 `artifacts/architecture/report.json`。

REG-ARCH-CORE-01：首次逐边复核发现库将 node:crypto 规范为 crypto，按字符串 node: 前缀可能漏检。先保存 `artifacts/logs/REG-ARCH-CORE-01-before.log`，再增加 dependencyTypes=core 规则。路径别名同时传入库官方 extract-ts-config 的展开配置，负例必须解析到真实目标，不能把 unresolved 的字符串误认为成功验证别名。

## 原子性、历史和成本

SPEC §8—12：事务在写入前验证并预留日志，prepare 后仍可回滚；无法证明完整恢复的写入/补偿错误进入 poisoned。会话在发布前构造完整 History/Head/DTO，临界区只同步终结事务、替换 Head 和返回结果。Read/Init 的失败候选不污染原可信文档。Save 在外部替换前构造完整成功结果；committed/not-committed/indeterminate 三态不同，输出失败不回滚或重试。

StateId 与保存点决定 dirty，不以几何相同、文件 hash 或外部文件变化判断。不可变 HistoryStackNode 共享旧尾，仅更新两栈头。索引只持有活动节点；internal/storage 的五个能力表是 WeakMap，GroupPlan 也是 WeakMap；没有永久强持有所有已删除/临时节点的表。删除子树的历史仍会持有整棵子树，这是撤销需要的 O(k) 保留。

普通叶子变换只构造自身状态及相关记录；不调用描述全文/encode/hash。入队时复制小请求属于规范要求，不能误测成禁止所有 structuredClone。性能测试实际监测复制参数形状及大小、encode/Document.describe 调用次数，并保留无关节点的原状态身份。结构数组维护允许 O(s)，分组允许已约定的 O(ks) 最坏成本，没有加入不合理的统一常数时间断言。

## 需求复核后补足的断言

`cross-entry-values.test.ts` 的 106 例使用手写数值、paint、text/ID 表，经 CLI/API/领域/SVG 的适用入口执行；非法值后检查原树、路径、dirty、revision、Undo/Redo，并继续合法重放。Scale 不伪造 SVG transform 入口，多行文本不伪造单行 CLI 协议。

`quality-gaps.test.ts` 补六类型 read 身份与只读属性、各类型 query 的父级和自身属性、保存点/Redo 下 CLI canvas 非法输入、调用者/环境不能修改 limits、Composite 后段快照准备失败。故障套件逐一执行 poisoned 下全部编辑及保存的拒绝。文件套件补 read-close 失败保留主要 decode/resource 错误的真实句柄场景。

这些新增断言通过；全量覆盖率套件 736 例中 735 通过、唯一失败仍是创建真实符号链接的系统 EPERM，0 skip。不能据此宣布项目全绿。覆盖率 include 全部生产代码，只有无可执行语句的类型文件明确排除；main.ts 保留在统计内，因实际子进程测试不回流 Vitest 覆盖率而显示 0，并未排除入口凑比例。

可选 mutation 未运行，不报 mutation score。浏览器预览、精确 SHA 干净检出和最终收据仍待 M15；远程与 final 均等待用户验收后授权。

M14 追踪与门禁检查点（2026-10-25）：逐项重新审查 339 个编号，包含 8 个 E2E；追踪存每条断言审查、实际 Vitest case 选择器和证据。检查器的编号正则曾遗漏带数字的 E2E 前缀，已固定提取回归并补齐这 8 条，不把仅有测试文件当作追踪闭合。M14 到期 local_required 共 310 条，FS-10 仍 blocked；M15 交付/预览保持 planned，变异 20 条未运行、远程/标签/截止 3 条验收后、DEL-08 由精确 SHA 收据关闭。23 个元数据自检断言检出缺证据、错误降级和未来项误通过；AST 检查禁止 .only/skip/todo 等遗漏修饰。

新增明确六类型 × 根/组内 CLI 创建和实际进程测试、大小写 ID 独立编辑/删除、非空 Group 自身三样式、Unicode 文本/原始属性 L−1/L/L+1 跨入口，以及 ungroup 首/中/末前写故障。完整覆盖率套件现 767 例，766 passed / 1 FS-10 EPERM、0 skip；语句 95.67% (1505/1573)、行 97.18% (1380/1420)、分支 92.86% (859/925)。M14 阶段静态、单元、属性、E2E、模型、性能通过；集成/覆盖率套件/追踪因同一个 FS-10 保持失败。实际收集日志和退出码见 artifacts/verification/latest-stage-M14.json，追踪报告 artifacts/traceability/report.json。新增 ci 档固定与新 seed 再次通过（artifacts/verification/latest-random-ci.json）。

verify、verify:stage、random:local/ci/release 都执行真实工具并保留每步日志/退出码/源码和锁文件摘要；失败后继续无依赖检查，最终仍返回失败，不重试到绿。verify 的全 local_required 检查不会预先要求自身最终收据。当前用户答复将开启开发者模式后通知，尚无开启完成确认，FS-10 不作人工延后。下一步 M15 报告/PlantUML、真实预览能力、精确 SHA 干净复验及提交外收据；尚未 READY。
