# AgentDock

**一个本地优先的 AI CLI 配置同步桌面工具**。

AgentDock 让你在一个界面里统一编辑提示词，再同步到：

- `~/.codex/AGENTS.md`
- `~/.gemini/GEMINI.md`
- `~/.claude/CLAUDE.md`

[English](./README.md)

---

## 功能

- **统一编辑**：在同一界面编辑共享 Base 与 Codex/Gemini/Claude 专属提示词。
- **一键同步**：保存后只同步有变化的文件到各目标路径。
- **自动备份**：每次同步都会创建备份，可查看、恢复、删除。
- **首次引导**：首次启动可从现有 Agent 配置引导初始化 source 文件。
- **本地优先**：配置内容默认仅保存在本机。

---

## 前置依赖

| 依赖 | 最低版本 |
|---|---|
| Node.js | 18+ |
| pnpm | 9+ |
| Rust 工具链 | stable（`rustc`, `cargo`） |
| GitHub CLI（`gh`） | 最新版 |
| Tauri 前置依赖 | 参考[官方文档](https://tauri.app/start/prerequisites/) |

---

## 快速开始

```bash
pnpm install
pnpm tauri dev
```

仅前端调试：

```bash
pnpm dev
```

---

## 项目结构

```text
agentdock/
├── src/
│   ├── api.ts
│   ├── types.ts
│   └── features/prompt-sync/
│       ├── components/      # 侧边栏、编辑区、备份面板
│       ├── hooks/           # workspace/editor/backup hooks
│       └── utils/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs           # Tauri 命令入口
│   │   ├── mapping.rs       # 分类映射与规范化
│   │   ├── sync.rs          # 同步计划与执行
│   │   ├── backup.rs        # 备份查看/恢复/删除
│   │   ├── workspace.rs     # 工作区初始化与迁移
│   │   └── paths.rs         # 路径解析
│   └── tauri.conf.json
├── package.json
└── README.md
```

---

## 工作区目录

默认工作目录：

- `~/.agentdock`

主要内容：

- `source/` 共享源目录（`instructions`、`skills`、`plugins`、`commands`、`mcp`）
- `mapping.json` 映射规则
- `backups/` 自动备份

---

## 开发命令

```bash
# 前端开发
pnpm dev

# 前端构建
pnpm build

# Tauri 桌面应用
pnpm tauri dev

# 交互式 GitHub 发布
pnpm release:github
```

---

## 发布

自动发布命令：

```bash
pnpm release:github
```

发布说明支持多行输入，按 `Ctrl-D` 结束。

执行前先登录 GitHub CLI：

```bash
gh auth login -h github.com
```

命令会交互要求输入：

1. `Version`（例如 `0.1.1`）
2. `Release notes`（支持多行，输入完成后按 `Ctrl-D`）

之后会自动完成：

1. 更新 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 的版本号
2. 构建 macOS app bundle
3. 生成 `release/AgentDock_<version>_aarch64.app.zip` 及 SHA256 文件
4. 提交（`release: v<version>`）、打 tag、推送到 GitHub
5. 创建 GitHub Release 并上传资产
