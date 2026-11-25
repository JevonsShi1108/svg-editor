# CLI 重构指标

运行 `npm run metrics:p2 -- --base final --head HEAD` 可按 Git blob 复算，交付后可将 HEAD 换为 p2。清单记录两端的路径、职责、类别、物理行、blob 及每个函数的复杂度。[完整清单](inventory.json)

| 范围 | 文件数 | 原行数 | 候选行数 | 行增量 | 原圈复杂度 | 候选圈复杂度 | 增量 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| kernel | 78 → 96 | 3959 | 4583 | 624 | 1004 | 1171 | 167 |
| assembly | 1 → 4 | 38 | 378 | 340 | 1 | 123 | 122 |
| plugin | 0 → 14 | 0 | 341 | 341 | 0 | 78 | 78 |
| vscode | 0 → 4 | 0 | 107 | 107 | 0 | 21 | 21 |

CLI 合计从 3997 行变为 5302 行（增量 1305），函数圈复杂度之和从 1005 变为 1372（增量 367）。

- `CommandCatalog.parse` → `CommandRegistry.parse`，函数圈复杂度 3 → 3。
- `CommandCatalog.bind` → `CommandRegistry.bind`，函数圈复杂度 5 → 6。
- `CommandCatalog.parseCreate` → `BuiltinCommands.parseCreate`，函数圈复杂度 10 → 10。
- `ShapeFactory.validateCreation` → `ShapeRegistry.validateCreation`，函数圈复杂度 10 → 9。
- `GroupShape.move` → `ContainerShape.move`，函数圈复杂度 2 → 2。

前三行分别为内核、装配处和插件。vscode 单独统计。物理行包含空行和注释，末尾换行不另计一行。只统计 Git 中的生产 TS/JS（含 API 声明），排除测试、配置、文档、脚本、依赖和构建结果。

分析器为 TypeScript 5.9.3。每个有函数体的函数、方法、访问器或箭头函数从 1 起算。每个分支、循环、非 default 的 case、catch、三目、短路运算及可选链加 1。嵌套函数单独计数。顶层模块语句不计入函数圈复杂度。脚本用直线、单分支和复合条件函数校准 1、2、3。

两端源码路径和 blob 的 SHA-256 分别为 `8a7c9a481dfe8d429a5884996b55d10720ea6d732be771f96dc692740a0d4074` 和 `d28ff91de8e8bfac9838814cacee58ad0658808b363248a143b43cd4a4d87d19`。
