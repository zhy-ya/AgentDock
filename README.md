# AgentDock

**A local-first desktop workspace for AI CLI configuration sync**.

AgentDock helps you edit shared instructions once, then sync them to:

- `~/.codex/AGENTS.md`
- `~/.gemini/GEMINI.md`
- `~/.claude/CLAUDE.md`

[中文文档](./README_CN.md)

---

## Features

- **Unified prompt editing**: Edit one shared base prompt plus Codex/Gemini/Claude-specific prompts in a single UI.
- **One-click sync**: Save and apply only changed files to target agent config paths.
- **Automatic backup lifecycle**: Every sync creates backups you can inspect, restore, or delete.
- **Workspace bootstrap**: On first launch, AgentDock can bootstrap source files from existing agent configs.
- **Local-first by design**: Data stays on your machine.

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| Node.js | 18+ |
| pnpm | 9+ |
| Rust toolchain | stable (`rustc`, `cargo`) |
| Tauri prerequisites | Follow [official guide](https://tauri.app/start/prerequisites/) |

---

## Quick Start

```bash
pnpm install
pnpm tauri dev
```

Frontend-only mode:

```bash
pnpm dev
```

---

## Project Structure

```text
agentdock/
├── src/
│   ├── api.ts
│   ├── types.ts
│   └── features/prompt-sync/
│       ├── components/      # Sidebar, editors, backup panel
│       ├── hooks/           # workspace/editor/backup hooks
│       └── utils/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs           # Tauri commands
│   │   ├── mapping.rs       # category mapping and normalization
│   │   ├── sync.rs          # sync planning and apply
│   │   ├── backup.rs        # backup list/detail/restore/delete
│   │   ├── workspace.rs     # workspace initialization/migration
│   │   └── paths.rs         # app path resolution
│   └── tauri.conf.json
├── package.json
└── README.md
```

---

## Workspace Layout

Default workspace root:

- `~/.agentdock`

Main files:

- `source/` shared source categories (`instructions`, `skills`, `plugins`, `commands`, `mcp`)
- `mapping.json` sync mapping rules
- `backups/` sync backups

---

## Development Commands

```bash
# frontend dev server
pnpm dev

# production frontend build
pnpm build

# tauri desktop app
pnpm tauri dev
```
