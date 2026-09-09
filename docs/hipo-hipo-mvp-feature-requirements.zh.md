# Hipo Hipo MVP 功能需求说明

## 1. 背景与问题

Hipo Hipo 要把「上传 / 解析 playground」做成面向 Agent 的 **knowledge-layer infrastructure（知识层基础设施）**。

它**不是**通用「第二大脑」聊天工具。Web 上负责解析、管理与治理项目知识；通过 MCP 给外部 Agent 当记忆与检索后端。

本 MVP 要解决的问题：

- 多文档 RAG 需要稳定的 **project workspace**，避免 Ask / Memory / MCP 跨项目串上下文。
- 静态证据（带 citation 锚点的上传文件）与动态记忆（Agent 抽取的项目状态）必须可区分，但又要能在同一条 Ask / Agent 路径里联合检索。
- Agent 写入的记忆会污染默认 retrieve 池。因此 Memory 是**单层**，用状态 `active` / `inactive` / `risk`，而不是 Ephemeral / Stable 两套库。
- 用户需要带 **inline citation** 的 Ask：点击后打开对应 Library 页或 Memory 文件；不要在 Library 里再嵌一套问答。
- Agent 需要可控的 **MCP connect**（选项目、权限、目标 Agent）。

---



## 2. 产品目标



### 2.1 主要目标

- 为每位用户提供隔离的 **Projects**，Library + Memory + Ask 均默认绑定当前项目。
- Library 文档保留 Knowhere 解析产生的 **citation anchors**。
- 项目记忆以 **document URI** 持久化，含 L0 / L1 / L2、status、type、entities、versions。
- Agent / Ask 默认 retrieve 池 = **Library + Memory(**`active`**) only**。
- 高风险记忆标为 `risk`，经人 review 后再进入默认池。
- Ask 提供 inline citation，以及右侧 **source drawer（源文件抽屉）**。
- 通过 MCP 连接外部 Agent，并明确项目与权限。
- 一键导出单个项目：原文 + JSON（锚点）+ Markdown 索引 + Memory 树。



### 2.2 次要目标

- Featured 演示项目（`research`、`financial`），可体验 parse + citation + Ask，且**不占用**自建项目配额。
- Library **AI 一键分类**（按标题 + 解析 summary）。
- 跨项目移动文档且不丢 `doc_id` / citation 锚点。
- Project Settings：是否检索 `risk`、MCP 默认权限、归档 / 删除等。



### 2.3 非目标（MVP）

- **不做 Graph 产品模块**：无实体图谱 UI、无节点详情面板、不做「从 entity 打开 Graph」的完成态。Memory 上的「查看图谱」、entity → Graph 均为 **deferred**（隐藏或不可用占位）。无图谱数据时不导出「图谱关系」；MVP DoD 不要求图谱打包。
- 本文不定义 LLM 选型、embedding 流水线、轮询间隔、事件协议或组件架构。
- 本文不要求细于 project 范围的多人 ACL。
- 本文不定价（见商业化文档）。

---



## 3. 信息架构（MVP）


| 模块       | 职责                      | MVP 主路径                            |
| -------- | ----------------------- | ---------------------------------- |
| Projects | 工作空间隔离                  | 多项目 + 侧栏切换；Ask / retrieve 默认当前项目   |
| Library  | 静态证据、解析、citation        | 文件夹、AI 分类；问答迁到 Ask                 |
| Memory   | 动态项目记忆（单层，L0/L1/L2）     | 状态机 + risk review；默认只检索 `active`   |
| Ask      | 基于 Library + Memory 的会话 | Inline citation → 右侧 source drawer |
| MCP      | 把项目 Context 暴露给外部 Agent | 选项目、权限、Agent                       |
| Export   | 项目级打包带走                 | 原文 + JSON + Markdown 索引 + Memory 树 |
| Settings | 项目级策略                   | risk 检索、MCP 默认权限、导出 / 保留 / 删除      |


---



## 4. Memory 状态模型（全局）

只有**一层** Memory。状态是同一文件 URI 上的字段。


| Status     | 含义             | 是否进入 Agent / Ask 默认 retrieve 池 | 谁设置                                         |
| ---------- | -------------- | ------------------------------ | ------------------------------------------- |
| `active`   | 当前可信、默认可复用     | **是**                          | 低风险写入后默认；或人 review 通过后                      |
| `inactive` | 仍保留文件，但不参与默认检索 | **否**                          | 用户「从 retrieve 池中移除」；也可策略归档                  |
| `risk`     | 高风险，待人 review  | 默认**否**；Settings 可开「含 risk 检索」 | risk skill / 规则；用户可改为 `active` 或 `inactive` |


规则：

- **Delete ≠ inactive**。删除是移除（或进回收站）；`inactive` 仍可打开 L2、看版本，并可再激活。
- 同一逻辑对象 = 稳定文件 URI（如 `…/memories/preferences/architecture.md`）。变更是对该 URI 做 merge + version / diff，不是平行再开一条 record。
- 风险判定不确定时，默认按**高风险**（`risk`）处理。



### 4.1 Memory 风险评价（MVP）

独立 **risk skill + 规则**。输入包括：记忆类型、证据强度（用户亲口 / 工具验证 / 仅 Agent 推断）、是否可执行、是否与现有 `active` 记忆冲突（同 URI / 同 entities）、PII / 密钥、跨项目范围等。

命中 → `status=risk`，进入 review 队列。结构化输出至少包含：

- `route`
- `risk_level`
- `reasons`
- `entities`
- `proposed_uri`


| 维度                      | 示例                                                | 严重度                                       |
| ----------------------- | ------------------------------------------------- | ----------------------------------------- |
| Conflict                | 与现有同 URI / 同实体的 `active` 记忆矛盾                     | High                                      |
| Sensitive               | 密钥、凭证、客户名、未公开财务数字                                 | High                                      |
| Executable blast radius | 会改变 Agent 默认可执行行为（auth、retry、命令等）                 | High                                      |
| Weak evidence           | 仅 Agent 推断，无用户确认或工具验证                             | 若同时为 decision / constraint / skill 则 High |
| Scope                   | 跨项目或缺少 `project_id`                               | High                                      |


---



## 5. 模块：Projects



### 5.1 背景与问题

用户与 Agent 会并行多个长期任务。没有项目隔离时，Library、Memory、Ask、MCP 会串上下文。

### 5.2 目标

- 用户可创建多个 **my projects**。
- 侧栏切换当前项目；Ask / retrieve / Memory 默认当前项目。
- 新建项目后 Library、Memory 均为空。
- 产品预置两个 **Featured** 项目：`research`、`financial`，放入示例 Library 源（如 10-K、研报、论文），用于演示 parse + citation + Ask；**不占用**自建项目配额。
- 文档、记忆、MCP 授权、导出均绑定 `project_id`。



### 5.3 交互规则

- 当前项目在顶栏 / 侧栏始终可见。
- 切换项目后，Ask / Memory 不得继续展示上一项目数据。
- Featured 与 my projects 需明确区分标注。



### 5.4 Agile MVP scope

Stories：

1. 作为用户，我创建 my project 后看到空的 Library 与 Memory。
2. 作为用户，我在侧栏切换项目后，Ask / Memory 只显示当前项目。
3. 作为用户，我打开 Featured `research` 或 `financial`，可试用 parse + citation + Ask，且不消耗 my-project 名额。
4. 作为研发，每份 Library 文档、Memory 文件、MCP 授权与导出都以 `project_id` 为键。

Definition of done：

- 新建项目 → Library + Memory 为空。
- Ask / Memory / retrieve 默认不返回其他项目资产。
- Featured 不计入自建项目配额（具体数字见商业化文档）。
- 不存在无 `project_id` 的孤儿资产。

---



## 6. 模块：Library



### 6.1 背景与问题

静态证据必须可 citation 定位。Library 此前混有问答；现由 Ask 承接会话。用户还会传错项目、需要文件夹 / 再分类 / 跨项目移动。

### 6.2 目标

- 上传 PDF / 论文 / 财报等；**Knowhere 解析**保留 citation 锚点（section / page / table / figure 等）。
- Library 内无嵌入问答；对话入口在 Ask。
- 项目内手动建文件夹；文档可拖拽进文件夹。
- 列表展示：文件名、解析状态、页数、路径。
- **AI 一键分类**：根据文件标题 + 解析 summary 建议 / 自动创建文件夹名并移动文件（`doc_id` 不变）。
- **跨项目移动**：文档（含解析资产）可移到另一项目 / 文件夹，**不丢 citation 锚点**。



### 6.3 交互规则



#### 文件夹与列表

- 用户可建文件夹并拖拽文件。
- 解析进行中列表仍可读（状态可见）。



#### AI 分类

- 用户可一键分类；可撤销、改文件夹名、拒绝某次分类结果。
- 分类只改路径，不改 `doc_id`。



#### 跨项目移动

- `doc_id` 不变；`project_id` 改为目标项目。
- 在源项目 Ask 历史里点击**旧** citation：弹窗提示「该来源已于某日移至 Project B」，可跳转。
- 移动后，源项目 retrieve **不再命中**该文档。



### 6.4 Agile MVP scope

Stories：

1. 作为用户，我上传 PDF 后能看到解析状态，并具备可 citation 的锚点。
2. 作为用户，我可用拖拽把文件放进文件夹。
3. 作为用户，我运行 AI 分类后，按标题 + summary 自动建文件夹并移动文件。
4. 作为用户，我跨项目移动文档且 `doc_id` 不变，旧 citation 能解释迁移并跳转。
5. 作为用户，我不能在 Library 内发起 Ask；需走 Ask Tab / 入口。

Definition of done：

- Library 无产品内聊天线程。
- 列表字段：name、parse status、pages、path。
- AI 分类不改变 `doc_id`。
- 跨项目移动只改 `project_id`；源项目 retrieve  miss；旧 citation 弹窗 + 跳转可用。
- 解析失败可见，不得静默显示为「已就绪」。

---



## 7. 模块：Memory



### 7.1 背景与问题

Agent 会抽取 preference / decision / constraint / skill / session 残留。全部写入默认 retrieve 池会导致错误累积。用户需要单层文档树、清晰状态、risk review，以及按需 L0/L1/L2。

### 7.2 目标

- 单层文档记忆；同一逻辑对象 = 一个文件 URI。
- 类型树：`preferences` / `decisions` / `constraints` / `skills` / `sessions`（后续可扩展）。
- 卡片字段：status、名称、路径（URI）、类型、L0/L1 摘要、entities、版本（current / history）、更新时间、来源 session（若有）。
- 可按 status 筛选列表。
- 点击卡片 → 右侧抽屉展示完整 L0 / L1 / L2；可滚动、复制 URI、查看 entities（**MVP 不进 Graph**）。
- 同 URI 上的版本 / before-after diff；历史可看；历史版本不进默认 retrieve。
- 风险判定 → `risk` + review 队列。
- 操作：查看版本、编辑、从 retrieve 移除（→ `inactive`）、删除；对 `risk`：confirm → `active`。将 `inactive` 重新纳入 → `active`（重跑 risk，可能回到 `risk`）。



### 7.3 交互规则

- 默认 retrieve 只用 `active`，除非 Settings 允许 risk。
- `inactive` 与默认 `risk` 不进入 Ask / Agent 默认池。
- 对 `risk` 的 confirm 必须显式；拒绝路径 → `inactive` 或删除。
- 编辑保存产生新版本；若触发风险规则，状态可再次变为 `risk`。
- 删除需确认；Ask 中指向已删来源的 citation 使用「来源已删除」类弹窗（与跨项目移动提示同一交互家族）。



### 7.4 Agile MVP scope

Stories：

1. 作为用户，我按类型与状态浏览 Memory，并在抽屉中打开 L0/L1/L2。
2. 作为用户，我将记忆移出 retrieve（`inactive`）后，Ask 不再使用它。
3. 作为用户，我 review 一条 `risk`，confirm 为 `active`，或标为 `inactive` / 删除。
4. 作为用户，我编辑 L2 / 元数据 / 类型后得到新版本，并可查看 diff。
5. 作为 Agent 流水线，高风险候选写入为 `risk` 并带结构化 reasons，而不是静默写成 `active`。

Definition of done：

- 状态筛选可用；retrieve 池符合 §4。
- 抽屉对文件 URI 展示 L0、L1、L2。
- 版本时间线 + diff 可用；旧版本不进默认 retrieve。
- Risk 队列可操作（confirm / inactive / delete）。
- 「查看图谱」MVP 不要求可用。
- 无 Ephemeral / Stable 双 UI。

---



## 8. 模块：Ask



### 8.1 背景与问题

用户需要在当前项目的证据与可信记忆上得到有依据的回答，并带可点击 citation——而不是把第二套聊天埋在 Library 里。

### 8.2 目标

- 当前项目的纯会话 UI。
- 默认来源：Library + Memory(`active`)。排除 `inactive`；默认排除 `risk`，除非 Settings 允许，或用户通过 `+ Select context` 显式勾选。
- `+ Select context` 可临时勾选文件夹 / 文件。
- Inline citation 胶囊：Library = `文件名 + p.xx`；Memory = 文件名（如 `architecture.md`）；视觉可区分。
- 点击 citation → 右侧抽屉：Library → 页 / section 高亮；Memory → L2 定位；多引用时 tab 切换；可「Open in Library」/「Open in Memory」。



### 8.3 非目标

- 依赖 Graph 的答案探索。
- 同一线程跨项目 Ask。



### 8.4 交互规则

- Memory 胶囊不得混入页码。
- 打开抽屉不得离开 Ask 会话主区。
- retrieve 为空或配额用尽时需明确提示（配额细节见商业化文档）。
- 若 Select context 包含 `risk`，必须对用户明示。



### 8.5 Agile MVP scope

Stories：

1. 作为用户，我提问后得到基于当前项目 Library + `active` Memory 的回答。
2. 作为用户，我点击 Library citation，抽屉定位到对应页 / section。
3. 作为用户，我点击 Memory citation，抽屉打开该文件 L2。
4. 作为用户，多引用时可切换 citation tabs。
5. 作为用户，我用 `+ Select context` 缩小或显式加入文件范围。

Definition of done：

- 默认回答路径排除 `inactive`，默认排除 `risk`。
- Library 与 Memory citation 样式可区分。
- 抽屉定位 + Open in Library / Memory 可用。
- Ask 是唯一主问答面（不是 Library）。

---



## 9. 模块：MCP



### 9.1 背景与问题

外部 Agent 需要把 Hipo Hipo 当作检索 / 记忆后端，且项目与权限边界明确。

### 9.2 目标

- 用户选择：哪个 Project、权限范围（只读 Library / 可读 Memory `active` / 是否允许 Agent 写入 Memory）、连接到哪个 Agent。
- 默认权限：**full**（产品默认；用户可收窄）。
- 两段弹窗流程：先选择 / 唤起具体 Agent；再在 Agent 侧发起；回到当前项目完成授权。
- 展示连接状态与最近调用。
- Agent 写入 Memory 须经风险判定（高风险 → `risk`，不得静默 `active`）。



### 9.3 非目标

- 在 Hipo Hipo 内做第三方 Agent 产品 UI。
- MVP 提供 Graph 相关 MCP tools。



### 9.4 交互规则

- 授权绑定项目范围。
- 断开 / 撤销后，该授权下不得继续 retrieve / write。
- 最近调用列表可见，便于判断「是否已连接」。



### 9.5 Agile MVP scope

Stories：

1. 作为用户，我为当前项目按所选权限与 Agent 完成 MCP 连接。
2. 作为用户，我走完两段弹窗（选 Agent → 回项目授权）。
3. 作为用户，我能看到连接状态与最近调用。
4. 作为 Agent，读操作遵守 Library + Memory(`active`)（除非权限拒绝）；写操作走 risk 规则。

Definition of done：

- 连接记录包含 project + permission + agent。
- 未改权限时默认 full。
- 两段弹窗流程可端到端测试。
- 存在状态 + 最近调用 UI。
- MCP 写入 Memory 不能绕过 risk → `risk` / `active` 规则。

---



## 10. 模块：Export



### 10.1 背景与问题

用户需要把项目带走或交接，且不丢 citation 结构与 Memory 状态。

### 10.2 目标

- 一键仅导出**当前**项目。
- 打包内容：原始文档；含页码 / 资产引用、`doc_id`、citation 锚点的 JSON；Markdown 索引；含 **status 字段**的 Memory 文件树。
- 无图谱数据时不打包图谱关系（MVP：可一律省略 / N/A）。



### 10.3 非目标

- 同一压缩包导出其他项目。
- MVP 保证图谱导出。



### 10.4 交互规则

- 导出进度与成功 / 失败需明确展示。
- 从归档元数据 / 命名可识别导出的是哪个项目。



### 10.5 Agile MVP scope

Stories：

1. 作为用户，我导出当前项目，得到原文 + JSON 锚点 + Markdown 索引 + 带 status 的 Memory 树。
2. 作为用户，我可确认包内不含其他项目文件。

Definition of done：

- Export 按项目隔离。
- JSON 保留 `doc_id` 与 citation 锚点。
- Memory 树导出含 status。
- 不要求 Graph 包。

---



## 11. 模块：Settings



### 11.1 背景与问题

项目级策略应集中配置，避免开关散落在 Library / Memory / MCP。

### 11.2 目标

- 编辑项目名 / 描述；删除或归档项目。
- 开关是否允许 retrieve 包含 `risk`。
- 新 MCP 连接的默认权限。
- 导出与数据保留相关设置（按产品 brief）。



### 11.3 非目标

- 组织级 SSO / 计费控制台（计费见商业化文档）。
- 文件级 ACL。



### 11.4 交互规则

- 破坏性操作（删除项目）必须确认。
- 变更「允许检索 risk」立即影响该项目 Ask / Agent 默认池构成。



### 11.5 Agile MVP scope

Stories：

1. 作为用户，我可重命名、归档或删除项目（删除需确认）。
2. 作为用户，我开启「含 risk 检索」后，Ask 可包含 `risk` 记忆。
3. 作为用户，我可为后续 MCP 连接设置默认权限。

Definition of done：

- 上述 Settings 字段可编辑并按 `project_id` 持久化。
- risk 检索开关会改变默认 retrieve 构成。
- 删除 / 归档确认可防止误删。

---



## 12. 配套文档

免费 / 付费配额、Recall 定义、页包与升级路径：`hipo-hipo-commercialization.zh.md]`