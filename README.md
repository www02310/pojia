# pojia — DeepSeek Harness + dsh-purge 可用组合包

一套**已实测跑通**的 DSH 环境快照，包含安装包、插件源码、配置和脚本。

锁定的版本组合：

| 组件 | 版本 | 说明 |
|---|---|---|
| DeepSeek Harness 桌面端 | **0.2.1-rc.2** | 官方安装包，本仓库 `installer/` 内 |
| dsh-purge | **1.1.88** | 插件源码在 `dsh-purge/` |
| 宿主内部包 | `@deepseek-ai/dsh-desktop 0.2.1-rc.2` | 与安装包一致 |

---

## 为什么要锁在 rc.2

dsh-purge 的 README 写得很明确：

> **不支持 dsh 0.2.1-rc.3 / rc.4 及更新。宿主对不上时补丁会显示待应用或跳过。
> 请退回 0.2.1-rc.2 再用本插件。**

这不是保守，是硬限制。实测在 rc.3 上强行 Apply 的后果：

- 85 条补丁里 67 条被强打进去
- **聊天输入框直接消失**（`dsh-client-ui-conversation/lib/client.js` 被塞入 rewind 相关函数，
  与 rc.3 的 UI 接口对不上）
- 宿主处在「能开但残废」的状态

rc.5 更不行，而且官方的自动更新 **会把你从 rc.2 推到 rc.5**，安装器在备份旧目录那步会失败
（`MoveFileExW` → Windows error 32），把程序目录搅成半成品，直接打不开。详见
[docs/SETUP.md#已知坑](docs/SETUP.md)。

---

## 仓库内容

```
pojia/
├── installer/
│   └── deepseek-harness-0.2.1-rc.2-win-x64.exe   # 官方安装包 289MB（Git LFS）
├── dsh-purge/                 # 【推荐】插件源码 v1.1.88（fork 自 YuJunZhiXue/dsh-purge，MIT）
├── versions/
│   └── dsh-purge-1.1.71/      # 【备选】插件源码 v1.1.71，同款目录结构，可单独下载
├── profile/
│   └── desktop-package.json   # 实测可用的 profile 配置（插件版本 + bundle 顺序）
├── scripts/
│   ├── 1-extract-installer.ps1   # 从安装包提取程序文件并部署
│   └── 2-finish-asar-swap.ps1    # 打完补丁后换 asar（必需，否则补丁不生效）
└── docs/
    └── SETUP.md               # 完整安装步骤 + 踩坑记录
```

### 两个插件版本怎么选

| | v1.1.88（`dsh-purge/`） | v1.1.71（`versions/dsh-purge-1.1.71/`） |
|---|---|---|
| 补丁总数 | 85 | 82 |
| 在 rc.2 上能匹配 | **63** | 59 |
| `core.js` 行数 | 8765 | 7984 |
| 对 rc.2 适配 | 完整（1.1.81 起专门适配） | 面向 0.2.0 档，缺 rc.2 修复 |
| 建议 | **用这个** | 仅作备份对照 |

v1.1.71 的 82 条补丁**全部包含**在 v1.1.88 里，没有被删除，是纯增量。
但 1.1.72–1.1.80 修了一批 rc.2 专属问题：`{{cwd}}`/`[cwd]` 导致整轮失败、补丁 #40 命中、
`toolFilter` 废弃兼容、`dsh-tools` 解析、`hostFs` 文件句柄、**桌面换包自杀**、`file:` 归档更新、
Ctrl+Enter 插话。所以除非有明确理由，否则别降级。

两个目录结构完全一致，互斥使用——把要用的那个复制成 `%USERPROFILE%\.dsh\plugins\dsh-purge`
（文件夹名必须是 `dsh-purge`），别同时放。

---

## 快速开始

完整步骤见 **[docs/SETUP.md](docs/SETUP.md)**，摘要：

1. 装 DSH 0.2.1-rc.2（用 `installer/` 里的 exe，或用 `scripts/1-extract-installer.ps1` 无交互部署）
2. 把 `dsh-purge/` 放到 `%USERPROFILE%\.dsh\plugins\dsh-purge`
3. 按 `profile/desktop-package.json` 改 `%USERPROFILE%\.dsh\profiles\desktop\package.json`
4. `pnpm install`
5. 命令行打补丁（**不要走 UI**，会超时）
6. 退出宿主 → 跑 `scripts/2-finish-asar-swap.ps1` 换包
7. 启动，新开会话

---

## 三个必须知道的点

**一、别点「新版本」。** 更新通道仍指向 rc.5，点一次就会重演目录损坏。
真要点，先把 `resources/app-update.yml` 改名让它失效。

**二、打完补丁必须换包。** Electron 加载顺序是 `app.asar` 优先于 `app` 目录。
补丁写在 `resources/app` 里，不把 `app.asar` 挪走，补丁等于没打。

**三、会话格式不能降级。** rc.5 写过的会话在 rc.2 上可能读不出来
（DSH 只有 v0→v4 的向上迁移，没有降级路径）。降级前建议备份 `~/.dsh/sessions`。

---

## 关于 dsh-purge 的版权

插件本体不是我写的，是 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) 的
v1.1.88 快照（fork: [www02310/dsh-purge1](https://github.com/www02310/dsh-purge1)），按 MIT 协议收录。
原作者的署名要求见 `dsh-purge/README.zh-CN.md`。

我提供的是**能跑起来的版本组合和部署脚本**，不是插件本身。
