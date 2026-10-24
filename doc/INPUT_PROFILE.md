# INPUT_PROFILE — EXEC-P1 v1.0

M14 质量细则：V8 include 全部 src，明确排除仅被 TS 擦除的接口/类型文件，不排除 main。全局 lines/statements ≥80%、branches ≥75%；domain、history、Session 各范围 lines/statements ≥90%、branches ≥85%，不自动更新阈值。基准固定 n=100/1000/5000，warmup=3、samples=11，leaf 每样本 50 次，其余批数逐指标记录；同时记录 k/s/B、median/p95、heap 前/后/样本峰值和源码摘要，无跨机器硬毫秒门槛。测试 worker 未提供 gc 时如实记 gcAvailable=false，不声称已验证立即回收；引用可达性结合源码审查与实际屏障/Redo 截断行为判断。

M11 平台与文件策略落实：Windows 普通本地文件系统；同目录 `.目标名.svg-editor-UUID.tmp`、wx 独占、最多 8 次碰撞、完整 write→close→rename，不先删目标。替换阶段 EIO/未知错误归 indeterminate，明确非提交错误码按实现集中白名单分类。沙箱 AppContainer 的临时目录 rename 被 EPERM，真实文件门禁在获批普通环境运行；该环境实际 file symlink 也 EPERM，FS-10 仍为必须自动门禁阻塞，等待链接权限，未改成可选或人工。

M09 落实注记（解释既有 §4.6，不更改 CFG）：CDATA 只作为 text 的纯文本来源；容器排版空白为普通 XML 字符数据。namespace 声明的解码值也执行属性长度准入，因此小限额的属性 L±1 测试使用 L=40，足以容纳 SVG namespace URI。具体证据在 codec.test.ts；未额外设 save 字节限额。

实际必验平台：Windows；Node 24.14.0 / npm 11.9.0。无更晚的用户 CFG 决定。工具精确版本见 package-lock.json。来源原文的以下选择在本工程直接采用；各项影响对应 TEST CFG-01—17 及 VAL/CLI/XML/LIM/FS 用例。

## 4. 一次性确定的 P1 输入与环境细则

本节填补 TEST §2 的 17 个 CFG 项。启动提示词会明确采用 **EXEC-P1 v1.0**；Codex 将选择复制并落实到 `doc/INPUT_PROFILE.md`，不用逐项询问。已有更晚的用户确认规则优先。

这些默认值是为了让实现和测试拥有同一组边界，不改变 SPEC 的已确认架构或命令语义。细节见本节各小表；任何调整都必须记录版本、原因和受影响测试。

### 4.1 CFG 总表

| CFG | EXEC-P1 默认选择                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------- |
| 01  | init/canvas 只接受 0 或 2 个尺寸；1 个为语法错误。无参 init 为 800×600，无参 canvas 查询。                        |
| 02  | group 至少 2 个不同目标；重复目标、祖先与后代同时选择仍拒绝。                                                     |
| 03  | 画布宽高、scale 因子为有限正数；形状尺寸/半径、stroke-width、font-size 为有限非负数；坐标可负。                   |
| 04  | 完整十进制/科学计数；-0 规范为 +0；接受可表示的非零 subnormal；拒绝非零输入或非零缩放乘积下溢为 0。               |
| 05  | CLI 裸数；SVG 长度接受裸数或紧跟小写 px；viewBox 是 4 个裸数，数值严格为 0 0 width height。                       |
| 06  | 参数可整体用双引号包裹；引号内仅双引号、反斜杠有专门转义；无 shell 展开、行内注释或多行命令。                     |
| 07  | ASCII ID 子集；大小写敏感，不 trim。普通图形 ID 为 svg 或 in 合法，不将字符串 svg 用作根标识。                    |
| 08  | Paint 接受 none、指定标准的全部命名色、3/6 位 hex；规范小写，保留命名/hex及3/6位形式；其他语法拒绝。              |
| 09  | 导入位置字段可缺省 0，并保留显式存在性；尺寸/半径按表必填。根 width/height 必填，不由 viewBox 推导。              |
| 10  | 根/g/叶可保留明确表中的样式和只读展示属性；根 id 拒绝；data-kind 只在 g 上作为受约束元数据。                      |
| 11  | 严格 UTF-8、XML 1.0；允许开头一个 BOM、普通 XML 声明、注释、纯文本 CDATA；拒绝 DTD/额外 PI/子文本元素。           |
| 12  | 输入 10 MiB、活动图形 10,000、深度 64、单个 text 100,000 Unicode 标量、单属性值 4,096 Unicode 标量。              |
| 13  | maxSvgBytes 仅为输入上限；不新增 save 字节上限或第六项 ResourceLimits；往返性质保留解码资源准入前提。             |
| 14  | 路径相对启动时注入的 cwd；不展开 ~ 或环境变量；拒绝最终路径为 symlink/非普通文件；保存允许新建普通文件。          |
| 15  | 正常结果 stdout，warning/error stderr；交互 TTY 使用 svg>，管道无提示符；无额外 banner；正常 EOF 等待完成再退出。 |
| 16  | 兼容的工具版本在实际环境确定并锁定；不冻结未规定的多重错误优先级，固定文案用单故障测试。                          |
| 17  | 首次进入 poisoned 使 revision +1；保留最后可信诊断元数据，dirty=null，禁止回放；失败恢复不再递增。                |

### 4.2 数值、单位、ID 与引号

裸数语法：

```text
^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$
```

- 接受 `0`、`-2`、`+3`、`1.25`、`.5`、`1.`、`1e3`、`-2.5E-4`。
- 拒绝空串、`0x10`、`0b10`、`1_000`、`1,000`、`NaN`、`Infinity`、`10oops`、`1e`；匹配后仍检查有限性和字段范围。
- 数值、paint、枚举解析允许剥离两端 XML 空白 SP/TAB/CR/LF，包括被双引号包裹的 CLI 数值和 API set 数值字符串。原始值先做长度检查，不能 trim 后绕过限额。ID、data-kind、text 不 trim。
- API 中声明为 number 的固定字段必须实际为 number，拒绝 null、boolean、数组、对象的隐式转型。set 的数值属性可收 number 或合规数字字符串；paint/text 要求 string；API set 数字字符串不接受 px。
- 非零十进制转 Number 后为 0，例如 `1e-400`，拒绝；`0e-400` 合法。原非零字段乘正因子后为 0 拒绝；真实零和 move 的合法相消到 0 合法。普通浮点舍入允许，撤销仍精确恢复保存的状态。
- SVG 长度的 px 必须紧跟数值且为小写；编码统一为裸数。viewBox 以 XML 空白或一个逗号及其两侧空白分隔，拒绝重复/尾随逗号与单位；4 个数与画布数值严格比较，不用 epsilon 接受非规范坐标系。
- ID 正则为 `^[A-Za-z_][A-Za-z0-9_.-]*$`，长度受属性限额；中文 ID、空白 ID、首字符数字拒绝。中文文本与路径不受此 ID 子集限制。
- 双引号包裹整个参数；闭引号后需空白或行尾，裸参数中嵌入引号视为语法错误。引号内 `\"`→`"`、`\\`→`\`；其他反斜杠序列保留原字符，例如 `\n` 不自动变换行。引号外反斜杠为普通字符，单引号无特殊分词意义。
- 首个非空白字符为 `#` 的行是注释；命令参数中的 `#` 完整保留。末尾 `in <group>` 按 token 边界识别，不能扫描 text 内部的字符来判断父容器。

### 4.3 Paint 的固定集合与等价

命名色集合采用 W3C CSS Color 4 §6.1 的 named-color 表，并在实现中固定为只读数据，记录其来源版本；运行期不访问网络。该表的关键词大小写不敏感，transparent/currentcolor 属于规范中的其他类别。本项目只选择命名色表、none 与 3/6 位 hex，并未宣称支持完整 CSS 颜色。[O5]

规范化示例：`RED→red`、`#ABC→#abc`、`#AABBCC→#aabbcc`。不把 `#abc` 展开为 `#aabbcc`，不把 `red` 改为 `#ff0000`，不合并 gray/grey 等不同 token。

拒绝 4/8 位 hex、transparent、currentColor、inherit、initial、unset、系统颜色、rgb()/hsl()、url()/var() 等。状态等价比较“显式存在性 + 规范 token”：RED 改 red 可为空编辑；#abc 改 #aabbcc 属于显式值变化，即使视觉同色。

### 4.4 SVG 导入几何与存在性

| 节点    | 必填几何             | 可缺省几何                       |
| ------- | -------------------- | -------------------------------- |
| svg     | width、height，均 >0 | viewBox 可缺省，但不用于推导尺寸 |
| rect    | width、height，均 ≥0 | x=0、y=0                         |
| circle  | r ≥0                 | cx=0、cy=0                       |
| ellipse | rx、ry，均 ≥0        | cx=0、cy=0                       |
| line    | 无                   | x1=y1=x2=y2=0                    |
| text    | 无                   | x=0、y=0；无文本子节点时为空串   |
| g       | 无                   | 无几何                           |

CLI create 仍需 LAB 规定的完整参数，不能因为导入允许省略位置而放宽 CLI 语法。尺寸必填是本项目严格子集的选择，不声称完整 SVG 标准要求全部显式填写。

缺失坐标拥有有效值 0，同时保留“未显式写入”状态：

- move 0 0、scale 1 不补属性。
- move 使缺失坐标的有效值实际改变时，才把该字段显式化。
- 缩放缺失的有效 0 不补属性。
- set x 0 对原本缺失的 x 是显式写入，构成变化。
- undo/redo 同时恢复数值与存在性。

根 viewBox 是尺寸的规范派生值，编码恒生成，不存第二份可变坐标系状态。缺省位置、px 转裸数、viewBox 规范化不构成 semanticRepair；自动补 ID 才构成该标记。[SPEC §5.4、§5.6、§10]

### 4.5 导入与序列化属性白名单

| 属性类别                 | svg 根                  | g                             | 六类型中的叶子         |
| ------------------------ | ----------------------- | ----------------------------- | ---------------------- |
| 根尺寸/viewBox           | 按根规则                | 拒绝                          | 不作为根属性接受       |
| id                       | 拒绝                    | 显式合法或导入补全            | 显式合法或导入补全     |
| 自身几何                 | 根尺寸                  | 无                            | 只接受本类型上一表字段 |
| fill/stroke/stroke-width | 保留                    | 保留，可 CLI set 自身         | 保留，可 CLI set 自身  |
| font-size                | 非负有限 SVG 长度，保留 | 同左                          | 同左，所有叶类型都保留 |
| text-anchor              | start/middle/end，保留  | 同左                          | 同左，所有叶类型都保留 |
| data-kind                | 拒绝                    | ID 同款 ASCII token，纯元数据 | 拒绝                   |
| namespace 声明           | 按 XML 语法处理         | 同左                          | 同左                   |
| 其他属性                 | 拒绝                    | 拒绝                          | 拒绝                   |

text-anchor 的枚举采用小写，其他拼写拒绝。所有可选属性缺失时保持缺失，不输出有效默认值。font-size/text-anchor/data-kind 只读保留，不新增 CLI set 能力；36 个合法组合仍按 LAB/SPEC 附录 A。

元素按 namespace URI + local name 判断，必须属于 SVG namespace。接受合法声明/前缀；未使用的声明可在规范输出中省略。数据属性必须是白名单中的无命名空间属性；xml:space、xml:lang、xlink:href、带前缀的 id 等拒绝。输出使用根默认 SVG namespace。

`g data-kind="box"` 仍是普通 Group；它不激活插件、不保护部件、不添加专用 set 或显示能力。

### 4.6 XML、文本和资源规则

严格 UTF-8；开头最多一个 BOM，并计入输入字节数；输出不带 BOM。XML 声明只接受 version=1.0，encoding 缺省或大小写不敏感的 UTF-8，standalone 可为 yes/no。DTD 和其他处理指令拒绝；不得用原始字符串中包含“DOCTYPE”就失败的粗略扫描误拒绝普通文本或 CDATA。

root/g 允许图形孩子、注释和 XML 排版空白；非文本叶只允许注释/排版空白；text 允许字符数据、CDATA 和注释，拒绝子元素。注释可省略，CDATA 与字符片段按顺序合并；text 中的合法空白完整保留。排版空白仅 SP/TAB/CR/LF，NBSP 不属于可随意丢弃的容器空白。

XML 的字面 CR/CRLF 按规范化规则处理；字符引用 CR 可保留实际 CR，编码时输出字符引用。拒绝 NUL、XML 禁止字符和未配对代理项。文本与属性转义分别处理，不能二次转义。[SPEC §10；TEST §11]

| 限额               | 默认值           | 计量方式与边界                                                              |
| ------------------ | ---------------- | --------------------------------------------------------------------------- |
| maxSvgBytes        | 10 × 1024 × 1024 | 真实 UTF-8 输入字节，含 BOM；FileStore 边读边限额，直接 decode 字符串也核对 |
| maxNodeCount       | 10,000           | 最终活动 Shape，含 g、不含根；历史保留的分离子树不计活动配额                |
| maxTreeDepth       | 64               | root=0，直接孩子=1；重挂检查整棵子树高度                                    |
| maxTextLength      | 100,000          | 每个 text 全部解码文本的 Unicode 标量总数，不能按片段分别过关               |
| maxAttributeLength | 4,096            | 解码后、规范化前的属性值及对应 CLI 实际值的 Unicode 标量数                  |

text 内容即使通过 set 输入仍走 maxTextLength，不套用属性限额；路径不是 SVG 属性。组合字符或 ZWJ 序列按标量数，不按可见字形数。测试注入小限额，以 L−1/L/L+1 检查；生产 limits 在 composition 建立并冻结。

save 不设额外输出字节上限，不因输出超过 maxSvgBytes 主动拒绝；再次 read 仍可能因输入上限失败。实际编码或结果准备若发生可捕获失败，按 IO-03/04 在调用 replaceUtf8 之前失败，保留旧 Head；不保证任意单项配额组合都能在有限机器内存中编码成功。通过小配额与故障注入测试这些边界，不在常规 CI 分配巨量文本。不能裁剪输出，也不能让每次编辑为了输入上限全文编码或 hash。

### 4.7 文件系统、输出与故障态

**路径。** FileStore 注入启动时捕获的 cwd；相对路径解析为稳定绝对路径，不因之后 cwd 变化改义。允许空格、中文和平台合法字符，拒绝空路径/NUL；不做 ~、$VAR 或 %VAR% 展开；扩展名不替代内容验证。

read/save 均拒绝最终路径条目为符号链接，包括悬空链接；read 必须为普通文件，save 可新建或替换普通文件，父目录须已存在。祖先目录的符号链接按平台正常解析；这不是对恶意本地并发换路径的防御承诺。M00 将实际可用平台登记为本轮必验平台，默认优先 Linux 本地文件系统；若实际工作环境是 Windows/macOS，则从一开始明确该平台的验证范围，不虚构 Linux 结果。用户指定的必验平台优先；已经确定的必须平台验证不能在最后临时降为人工待验。额外平台可记为可选未执行。

同目录独占 temp→写完→关闭→替换，保留三态结果。temp 名称与有限碰撞重试次数由适配器集中确定并测试；只清理自己创建的文件。无法证明替换未发生时返回 indeterminate，不能把所有 rename 异常都归类 not-committed。[SPEC §11；TEST FS/IO]

**终端。** stdin 和 stdout 均为 TTY 时显示 `svg>`；管道不显示提示符，无新增 banner。正常结果 stdout，warning/error stderr，单行诊断按规定转义。CLI 依次 await execute 与呈现；EOF 等待已接收工作完成再结束。普通用户命令错误允许后续命令继续，正常 EOF 退出 0；致命启动/呈现错误、未处理进程异常、EOF 时仍 poisoned 退出 1。

呈现失败不回滚已提交业务，不重试 save、不重复 execute。停止提交后续新请求；仍有已启动文件操作时等待其明确结束，不靠强制 process.exit 或 Promise.race 假装取消。[SPEC §11.7；TEST CLI-14、IO-08]

**Poisoned。** 首次进入故障态时 revision +1，dirty=null；保留最近可信内容身份、保存点、路径与不可变历史诊断元数据，但禁止回放。不得从不可信树重新计算可信内容信息。拒绝请求和失败恢复不再次加版本；成功 init/read 建立全新可信文档，并从故障态当前 revision 再 +1。save 的 external-unknown 不进入 poisoned。[SPEC §12.3；CFG-17]

### 4.8 工具版本与未规定错误

Codex 在 M00 根据已有锁文件、实际运行环境和官方兼容性选择版本；不要按本文编写日期猜“最新版”。XML 库必须能够支持 namespace、严格错误、DOCTYPE/PI 拒绝、文本/CDATA 和资源限制；选库不能成为放宽契约的理由。

多重错误优先级未规定时，不新增复杂全局排序工程。使用确定验证流程，用单故障输入锁定固定错误；新增诊断由 Presenter 集中映射，不把 XML 库内部异常直接输出给用户。

<a id="exec-05"></a>

M13 随机实施：沿用 local=50/30×40/30 nodes、ci=200/100×80/40 nodes、release=1000/500×200/60 nodes。各固定 seed 20261025 加实际新 seed，纯模型 maxDepth=5；生产限额不变。状态机生成器 v2-max-size 使用 fast-check commands size=max，全部 check=true，非法操作真实执行；replay 的 FC_SEED/FC_PATH/FC_REPLAY_PATH 只用于 FC_TARGET=MODEL-01。旧 v1 反例保存完整具体请求，不依赖后续生成器。额外 MODEL-IO 用同档 numRuns 跑短真实文件序列。
