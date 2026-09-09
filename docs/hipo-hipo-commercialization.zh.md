# Hipo Hipo 商业化需求说明

配套 MVP Feature：

- [`hipo-hipo-mvp-feature-requirements.zh.md`](/Users/kaiyu/Downloads/hipo-hipo-mvp-feature-requirements.zh.md)

本文规定 **免费版 vs 付费版** 的商业规则，供研发与增长验收。
---

## 1. 背景与问题

Hipo Hipo 作为知识层基础设施售卖：解析 Library、治理 Memory、带 citation 的 Ask，以及通过 MCP 连接 Agent。

用户需要：免费档足够体验 parse + Ask + Memory review；超出页数 / 项目数 / Recall 后再订阅付费。

若计量不清：

- 用户分不清 Ask 被挡是产品故障还是配额墙。
- 支持无法解释 pages vs Recall vs project 上限。
- 研发无法做一致的拦截。

商业模式：**免费体验 + 订阅**；解析页用尽时可 **page pack**，或 **自带 API key（bring-your-own API key）**。

---

## 2. 产品目标

### 2.1 主要目标

- 新用户可在 Featured 与少量 my projects 上免费试用 Hipo Hipo。
- 按三条与成本 / 价值对应的轴计量：**parse pages（解析页）**、**project count（项目数）**、**Recall**。
- 解析页用尽时给出清晰下一步：连接自有 API key、订阅、或购买页包。
- 免费档仍可做人治理 Memory（浏览、risk review、标 inactive），不为「确认自己的项目事实」单独收费。

### 2.2 次要目标

- 年付相对月付有简单折扣。
- 付费档的项目与 Recall 上限足够支撑日常个人使用 + 轻度 MCP。

### 2.3 非目标

- 本文不定义支付渠道、税务、发票 UX、优惠券。
- 本文不定企业 / 座席定价。
- 本文不把人手动 `risk` → `active` confirm 做成付费墙。
- 本文不恢复 Ephemeral promote / 仅导出 Stable 的规则。

---

## 3. 定义

### 3.1 Parse page quota（解析页配额）

一 **page** = Library 文档经 Knowhere 解析（或等价能力）摄入时消耗的一个页单位。月度额度按计费实现约定的账期 / 自然月重置（MVP 若尚未正式计费，可用自然月）。

### 3.2 Project quota（项目配额）

计入套餐上限的是用户**自建 my projects**。

**Featured** 项目（`research`、`financial`）**不计入** my-project 配额。

### 3.3 Recall

一次 **Recall** = 一次把当前项目的 **Library + Memory(`active`)**（仅当 Settings 允许或用户显式勾选时才含 `risk`）注入 Ask 回答或 Agent / MCP 检索回合的 retrieve。

计数规则：

- 一次带检索的 Ask 发送 = **1 Recall**（不是按 citation 条数计）。
- 一次 MCP Agent 检索回合（该回合内的 search + 后续 chunk reads）= **1 Recall**，不是按 N 次 tool call 计。
- **不消耗** Recall：打开 citation drawer、浏览 Library / Memory、编辑 Memory、risk review UI、导出、改 Settings。

### 3.4 Page pack（页包）

预付解析容量：**$15 / 1,000 pages**；在订阅或免费月度页数不足时使用（产品 brief）。

---

## 4. 免费版（Free）

| 计量项 | 上限 |
|--------|------|
| Parse pages | **300 pages / month** |
| My projects | **最多 3 个** |
| Recall | **500 / month** |

当 **parse pages** 用尽时，产品必须提供：

1. 连接用户**自有 API key**，或  
2. **订阅**（按付费权益含页数 + 写回 + MCP 完全访问），或  
3. 购买 **page pack：$15 / 1,000 pages**。

免费档仍包含 Feature 文档中的 MVP 产品面，但受上述计量约束（Ask / MCP retrieve 消耗 Recall；上传解析消耗 pages）。

---

## 5. 付费版（Paid）

**价格：`$19 / month`，或年付 `$190 / year`。**

| 计量项 | 上限 |
|--------|------|
| Parse pages | **3,000 pages / month**；超出可经页包 / 加购 |
| My projects | **最多 10 个** |
| Recall | **5,000 / month** |

付费权益相对免费：更高页数、更高项目上限、更高 Recall，以及订阅内的完整 MCP 访问（对比免费页数用尽后的替代路径）。

---

## 6. 交互规则

### 6.1 可见性

- 用户可在明显的 Settings / 账户区看到剩余 **pages**、**Recall**、**my-project slots**。
- 硬拦截前建议软提示（如 Recall 或 pages 约 80%）。

### 6.2 硬拦截

- **Pages 用尽：** 拦截会超出剩余页数的新解析；展示三步路径（API key / 订阅 / 页包）。已解析 Library 仍可读。
- **Recall 用尽：** 拦截会再消耗 Recall 的 Ask / MCP retrieve；浏览与 Memory review 仍可用。
- **项目上限：** 拦截新建超出套餐的 my project；Featured 仍可进；已有项目仍可用。

### 6.3 单独不要求付费的动作

- 打开 citation drawer。
- 阅读 Library / Memory。
- 人手动 risk review（`risk` → `active` / `inactive` / delete）。
- 将记忆标为 `inactive` 或在规则允许下重新纳入。
- 导出当前项目（免费档若允许导出则不限制为「仅 active」或旧版「仅 Stable」）。

### 6.4 Memory 与变现

- 仅单层 Memory。
- **不要**实现「付费才能从 Ephemeral promote」或「只能导出 Stable」。
- 导出的 Memory 树须带 status 字段（`active` / `inactive` / `risk`），与 Feature 文档一致。

### 6.5 离开与返回

- 刷新后配额展示应为最新剩余量，不得 UI 重置成「无限」。
- 被拦截的 Ask 在重连后仍须以同一原因保持可见拦截态。

---

## 7. Agile MVP scope

### Sprint 意图：诚实计量

目标：免费 / 付费上限可理解、可执行，避免被误报成「产品坏了」。

Stories：

1. 作为免费用户，我每月最多可用 300 解析页、3 个 my projects、500 次 Recall。
2. 作为页数用尽的免费用户，我能看到：自有 API key、订阅、或购买 $15 / 1,000-page 页包。
3. 作为付费订阅用户（$19 / mo 或 $190 / yr），我获得更高页数（如 3k）、10 个 my projects、5000 次 Recall。
4. 作为用户，我理解 Ask 发送 / Agent retrieve 消耗 Recall，而打开 citation 不消耗。
5. 作为支持 / QA，我能从稳定文案判断是哪条计量导致拦截。

Definition of done：

- 免费 / 付费上限与 §4–§5 一致。
- Featured 不消耗 my-project 配额。
- Recall 定义在埋点与文案上与 §3.3 一致。
- 页数用尽展示 API key / 订阅 / 页包路径。
- 无 Ephemeral promote 付费墙；Memory 导出不限旧版「仅 Stable」。
- 拦截原因能区分 **pages** vs **Recall** vs **project cap**。

---

## 8. 与产品模块的映射

| 模块 | 免费 / 付费影响 |
|------|-----------------|
| Library 上传 / 解析 | 消耗 **pages** |
| Projects 新建 | 消耗 **my-project** 名额 |
| Ask 带检索的回答 | 消耗 **Recall** |
| MCP retrieve turn | 消耗 **Recall** |
| Memory review / 编辑 | 不耗 Recall；无 promote 费 |
| Citation drawer | 不耗 Recall |
| Export | brief 无单独计量（套餐内允许；打包内容见 Feature 文档） |

---

## 9. 本文范围外

- 支付处理器集成细节。
- Team / enterprise SKU。
- 除已述页包外的精确超量 SKU。
- Graph 变现（Graph 不在 MVP Feature 内）。
