# Phase 1 测试报告

当前：M10 已通过；M11/M12 已实现但必须 FS-10 真实链接夹具因系统 EPERM 未完成，完整验收尚未就绪；继续 M14—M15 的不受影响工作。M01 的 `npm run verify:stage -- M01` 实际执行 strict 类型检查、lint、格式、架构规则及 76 个非空单元测试。值层覆盖 VAL-01—06、GEO-10、XML-14、LIM-07/08 的当前适用部分；跨入口完整用例仍按阶段补齐。

ARCH-11 以三条实际禁止依赖验证检查器（含 domain→application 的纯类型和 domain→Node fs）。Snapshot 正反例分别检出顺序、根样式、文本空白和画布尺寸差异。预期来自手工表和 EXEC CFG，不调用生产校验器生成预期。

M02：`npm run verify:stage -- M02` 通过，87 tests / 2 files，失败 0、跳过 0；日志 `artifacts/logs/M02.log`。新增真实事务生命周期、prepared 回滚、跨文档、同 ID 大小写、独立索引/计数检查、不可变历史描述、资源限额和前写失败补偿。InvariantOracle 用损坏夹具验证重复父/循环入口/幽灵计数/错误索引会失败；生产未增加破坏入口。完整 Session 层、全部图形/结构及故障态测试仍 planned。

M03：`npm run verify:stage -- M03` 通过，152 确定性测试 / 3 files，3 条性质 / 1 file，失败 0、跳过 0。六类型各根/组内 12 创建场景、36 set 组合逐条执行、TEST §7.4 的 move 与 scale 从独立初态手算验证。三级混合组、stroke-width/font-size 保留、空组非法因子、后段溢出/下溢回滚均执行。性质每条执行 local 50 次×2 seeds（20261025 及本次新 seed），真实参数和结果在 `artifacts/random/*.json`；本阶段总计 300 次。日志 `artifacts/logs/M03.log`。CLI/Session 跨入口完整预期仍待后续。

最终候选将从精确 SHA 干净检出执行锁文件安装、构建、verify、release 随机和覆盖率；完整 SHA 和结果写入提交外收据。未执行推送、final 或用户验收。

M11 检查点（未过阶段门禁）：`npm run verify:stage -- M11` 在正常 Windows 环境退出 1：214 单元/回归通过、15 性质各 2×50 次通过、276 集成通过 / 1 集成因 OS `fs.symlink(...,'file')` EPERM 失败、0 skip。静态检查通过；独立 `npm run test:e2e` 构建及 1 个真实 CLI/文件冒烟通过。日志 `artifacts/logs/M11.log`、`artifacts/logs/M11-e2e.log`。真实 UTF-8/跨块/BOM/非法字节、实际累计字节限制、普通文件新建覆盖、8 次独占碰撞、写/close/已知替换失败、清理失败、不确定 EIO（实际 OLD/NEW）均执行。FS-10 的稳定 cwd/字面路径和 injected lstat 拒绝已通过，但真实文件链接及悬空链接仍是自动必测阻塞，不能计通过或转人工。沙箱临时目录原生 rename 的 EPERM 已用对照探针识别，获批普通环境解决该项；正常环境仍缺链接权限，已请求用户补足。

M10：`npm run verify:stage -- M10` 通过，214 单元/回归 / 9 files、261 集成 / 8 files、15 性质 / 4 files 各 local 2×50 次；失败 0、跳过 0，日志 `artifacts/logs/M10.log`。真实 Codec 配可控 FileStore 验证 read 新身份/路径/警告/dirty，clean save 仍提交屏障，not-committed、committed、indeterminate（物理 OLD/NEW 两种）及未知异常分类；encode/下一 history/DTO 失败时 replace 调用 0。REG-STATE 15 步逐项断言版本/历史/dirty/路径；QUEUE 用 Deferred 闸门证明所有请求串行、数组/路径入队复制、EOF 等最终 save。poisoned 后 save 不编码/写端口，read 可建立新可信文档；提交后 stdout 失败不重试、不回滚。REG-CANDIDATE-01 有先失败后修复记录。真实 Node 文件端口/进程验证仍待 M11/M12。

M09：`npm run verify:stage -- M09` 通过，213 单元/回归 / 8 files、233 集成 / 6 files（新增 124 Codec 场景）、15 性质 / 4 files 各 local 50×2 seeds，共 1,500 次；失败 0、跳过 0。日志 `artifacts/logs/M09.log`。独立手写描述、六类型/存在性/只读属性、纯文本和 XML 词法、namespace、安全拒绝表、跨类型/后部显式 ID 预留、候选局部警告、字节/节点/深度/片段累计文本/属性边界均执行。PROP-07/08/11 包括全六类型往返、首轮语义与规范化幂等、独立计算补 ID。REG-ROOT-PX-01 保留修复前失败日志；read 失败旧 Head/警告发布、dirty/保存点由 M10 验证，SEC-07 终端诊断由 CLI 检查补齐。

M08：`npm run verify:stage -- M08` 通过，212 单元/回归、109 集成 / 5 files（新增 19 编码用例）、12 性质 / 3 files 各 2×50 次；失败 0、跳过 0。日志 `artifacts/logs/M08.log`。编码由另一测试库 @xmldom/xmldom 独立解析，未调用生产 decoder：核对 namespace/viewBox、六类型/层序、缺省属性不输出、根/组/叶只读属性、metadata、实体恰好转义一次、CR 字符引用、精确 double、text 无漂亮打印污染及超输入字节上限输出不裁剪。没有生产 decode stub 或 FileStore IO。

M07：`npm run verify:stage -- M07` 通过，212 单元/回归 / 7 files、90 集成 / 4 files、12 性质 / 3 files，失败 0、跳过 0。每条性质 local 50 次×固定/新 2 seeds，共 1,200 次；日志 `artifacts/logs/M07.log`、参数 `artifacts/random/`。所有 10 类编辑逐一 dry-run→commit→undo→redo，8 类 no-op 在 Redo/屏障分别执行，36 set 组合和 6×2 API 创建/几何手算执行。prepared preview/root 结果失败、Undo/Redo 中途受控中止、实际可能部分写入、补偿失败、历史身份错误与新文档恢复均执行。poisoned 保留可信诊断元数据，拒绝观察旧树；read/save 的恢复/保存点子项仍按 EXEC 待 M10。REG-LIMITS-01 有修复前真实失败日志和修复后固定回归。

M06：`npm run verify:stage -- M06` 通过，211 单元 / 6 files、9 集成 / 2 files、6 性质 / 2 files，失败 0、跳过 0；性质 local 各 2×50 次。日志 `artifacts/logs/M06.log`。8 个当前命令的手写请求/语法表、真实 REPL→Session→Domain→History 链、请求嵌套复制、查询/失败/no-op 保留 Redo、prepare 后 history/DTO 构造失败回滚、错误后下一请求执行、会话隔离和运行期私有能力负例均执行。完整 19 命令、正式编译 CLI 和真实文件 E2E 仍 planned；没有生产假端口。

M05：`npm run verify:stage -- M05` 通过，176 确定性用例 / 5 files、6 性质 / 2 files，失败 0、跳过 0；随机各 local 2×50 次。日志 `artifacts/logs/M05.log`。HistoryManager 旧值不变、栈顶原条目移动、空编辑仅解屏障、Redo 截断、身份不匹配、同 ID 两代真实对象双撤销重做及 10,000 条身份连续的历史链均执行；源码为 O(1) 栈头更新，未复制历史数组。

M04：`npm run verify:stage -- M04` 通过，171 确定性用例 / 4 files、6 性质 / 2 files，失败 0、跳过 0；性质各 2×50 次（总 600）固定+新 seed。日志 `artifacts/logs/M04.log`；随机参数 `artifacts/random/`。STR-01—17 领域算法及 REG-GROUP 的三条精确位置日志已执行；跨父/内层 LCA/保留最后分支、顶层解组拒绝、空/单孩子解组、样式存在性、整棵子树索引与限额均覆盖。预留未来 Session 的 Redo/屏障断言，不在本阶段伪造。

M12 检查点（仍未关闭 FS-10）：288 单元/回归、16 条性质各 local 2×50 次、294 集成通过/1 系统链接失败、7 编译进程 E2E 通过，0 skip。日志 artifacts/logs/M12.log 与 M12-e2e.log。独立手写 19 命令字段/绑定及多参缺参表、36 个 CLI set、错误后恢复、empty/屏障/Redo 的空输入隔离、ERR 固定文案、C0/DEL/C1 转义、实际 stdout 断管后的保存保留和停止后续请求均核对。LAB §6 和 §6.1 A 夹具保留真实 5/7/8 计数，另用 1/2/3 节点排除硬编码；用独立 XML 解析实际落盘文件断言几何/父级/文本。PROP-16 比较等价 CLI/API 的完整结果、状态、文档及真实 Codec 输出。成功文件路径以 CFG 稳定绝对路径核对；XML 独立预言机按 XML 1.0 行尾规则校准，不用 XML 1.1 默认行为误改期望。

M13：297 单元/回归、模型套件 7 例/5 files 通过，0 skip；ci 性质 16×2×200=6,400 次通过，模型每 seed 100 条/最大 80 步、实际固定 seed 最大 80 步共 3,988 个随机请求，另加每序列 6 个固定初始请求。固定宏覆盖全部 19 命令、no-op、Redo、屏障、保存三态物理 OLD/NEW 与补 ID；MODEL-IO 是独立真实临时文件短序列（每 seed 200 次）。日志 artifacts/logs/M13-model-ci.log、M13-property-ci.log，运行参数和分类计数在 artifacts/random/。MODEL-09 故意失败探针确认 shrinking、seed/path/replayPath 及具体最小 [2] 均可回放，探针成功不冒充产品缺陷；两个真实测试模型缺陷分别先失败、固定回归、修复，缩减请求跟踪在 test/fixtures/regressions/。当前未发现需要修改生产行为的新反例。完整 M13 阶段仍受 FS-10 真实链接能力阻塞，不宣称全绿。

M14 当前增量：全量 V8 套件 736 例中 735 passed / 1 FS-10 系统 EPERM，0 skip；统计全部生产源码（main 保留为 0），纯类型文件逐项列在配置中。语句 95.67% (1504/1572)、行 97.18% (1379/1419)、分支 92.86% (859/925)，核心范围门槛均满足。8 性能项通过，33 组 n/k/s/B 指标（100/1000/5000、3 warmup/11 samples）及 3 类保留关系在 artifacts/performance/report.json，源码摘要与架构报告相同。完整阶段未过：FS-10 仍缺系统能力，追踪和最终 verify 脚本仍在建设。额外 106 跨入口值表、5 需求复核用例、3 read-close 故障用例已纳入；架构 13 禁止边（含别名、type-only、core 分类）全部检出。独立需求复核过程及局限见 ARCHITECTURE_REVIEW.md；可选变异未运行。
