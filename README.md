# AI Config Manager (Tauri)

本项目是一个本地优先的配置编排工具，用于统一管理：

- `~/.codex`
- `~/.gemini`
- `~/.claude`

核心理念：一次编辑公共配置，按映射同步到三端，支持共享导入导出和备份恢复。

## 功能

1. 公共配置编辑
- 直接编辑 `source` 与三端目录文件
- 支持搜索、新建、删除、保存
- `Ctrl/Cmd + S` 快捷保存
- 左侧导航栏 + 右侧预览/编辑仪表盘布局

2. 同步预览
- 读取 `~/.ai-config-manager/source` 作为公共配置源
- 按 `mapping.json` 映射生成同步计划
- 显示 `create/update/unchanged` 差异项
- 可勾选部分项执行同步
- 默认术语采用 `instructions`（对应 `AGENTS.md/GEMINI.md/CLAUDE.md`）

3. 共享导入导出
- 导出 source + mapping 为 zip 包
- 支持去敏导出（`api_key/token/secret/password` 掩码）
- 导入前可预览覆盖情况

4. 备份恢复
- 每次同步/导入自动生成备份
- 可按备份 ID 回滚

## 目录约定

应用工作目录：`~/.ai-config-manager`

- `source/` 公共配置源（默认包含 `instructions/skills/plugins/commands/mcp`）
- `mapping.json` 映射规则
- `backups/` 自动备份
- `exports/` 导出的配置包

## 开发启动

前置依赖：

1. Node.js + pnpm
2. Rust 工具链（`rustc`, `cargo`）
3. Tauri 官方前置依赖（见 https://tauri.app/start/prerequisites/ ）

安装与运行：

```bash
pnpm install
pnpm tauri dev
```

仅前端调试：

```bash
pnpm dev
```

## 关键命令（Rust）

- `init_workspace`
- `get_agent_endpoints`
- `list_scope_files`
- `read_scope_file`
- `save_scope_file`
- `delete_scope_file`
- `preview_sync`
- `apply_sync`
- `list_backups`
- `restore_backup`
- `export_share_package`
- `preview_import_package`
- `apply_import_package`

## 注意事项

1. 本地离线优先，不会主动上传你的配置内容。
2. 当前版本是文本级同步，不做语义级合并。
3. 若你本机未安装 Rust，`pnpm tauri dev` 无法运行。
