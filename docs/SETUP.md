# 完整安装步骤

所有命令在 Windows PowerShell 里跑。假设：

- `DSH_HOME` = `%USERPROFILE%\.dsh`（默认，未改过就是它）
- 安装目录 = `D:\deepseek harness`
- 仓库已克隆到本地，下文用 `<repo>` 表示仓库根目录

---

## 0. 前置

| 需要 | 说明 |
|---|---|
| Node.js ≥ 22.19 | 宿主自带 runtime 里也有，但命令行跑脚本要用系统的 |
| pnpm | 优先用宿主自带的：`%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs` |
| 7-Zip | `C:\Program Files\7-Zip\7z.exe` |
| Git LFS | 拉仓库时要，`git lfs install` 一次即可 |

---

## 1. 部署 DSH 0.2.1-rc.2

如果机器上已经有 rc.2 且能正常打开，跳过这步。

**推荐用脚本**（可重复、不碰交互式安装器）：

```powershell
cd <repo>\scripts
.\1-extract-installer.ps1
```

默认装到 `D:\deepseek harness`。换路径用 `-Target`，覆盖已有目录加 `-Force`。

**为什么不用官方 exe 直接双击装**：官方安装器在这台机器上会在「备份旧目录」这步
失败（`MoveFileExW` → Windows error 32），留下半成品目录。脚本走的是
「从 exe 里抽出 `$PLUGINSDIR\app-64.7z` 再解压」，不依赖安装器的目录搬迁逻辑。

装完必须校验这 5 项存在，缺任何一个都别启动：

```
DeepSeek Harness.exe
version
resources\app.asar
resources\runtime\office-skills\office\SKILL.md
resources\runtime\primary-runtime\dependencies\node
```

`resources\runtime` 是 asar **外**的独立目录，`app.asar` 里没有它。缺了它宿主启动必崩，
报 `ENOENT ... runtime\office-skills\office\SKILL.md`。

---

## 2. 放插件源码

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.dsh\plugins" | Out-Null
Copy-Item -Recurse -Force "<repo>\dsh-purge" "$env:USERPROFILE\.dsh\plugins\dsh-purge"
```

文件夹名必须是 `dsh-purge`，里面 `package.json` 的 `"name"` 也必须是 `dsh-purge`。

---

## 3. 配置 profile

编辑 `%USERPROFILE%\.dsh\profiles\desktop\package.json`，参照 `profile/desktop-package.json`。

两处要改：

**a) `dependencies` 里加**：

```json
"dsh-purge": "file:../../plugins/dsh-purge"
```

**b) `dsh.profile.bundles` 末尾加**：

```json
"dsh-purge"
```

注意：

- 用相对路径 `file:../../plugins/dsh-purge`，别写绝对路径
- 别重复添加
- `@deepseek-ai/dsh-base` 和 `@deepseek-ai/dsh-web-app` 必须在最前面，别动
- 改之前先备份：`Copy-Item package.json package.json.bak`

---

## 4. 装依赖

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
$pnpm = "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs"
node $pnpm install
```

成功标志：`node_modules\dsh-purge\package.json` 存在。

`ERR_PNPM_IGNORED_BUILDS` 警告可以忽略，不影响加载。

---

## 5. 打补丁（命令行，**不要走 UI**）

**关键：不要点界面里的「应用」。**

原因：点应用后后端要解包 179MB 的 `app.asar`（→ 452MB）+ 打 85 条补丁，
这期间 Node 主线程同步阻塞，前端每 5 秒一次的 status 轮询全部排队，60 秒 abort，
界面就显示「读取失败: timeout」然后卡在「处理中…」。补丁其实在跑，但前端收不到响应，
后续的「重启 + 换包」两个动作**不会触发**，你会以为失败了。

走命令行，全程可控：

### 5.1 先解包 asar

CLI 在 asar 打包的宿主上找不到 `@deepseek-ai` 目录，必须先解开：

```powershell
# 在 profile/desktop 目录下执行
node --input-type=module -e @'
const m = await import("file:///<repo>/dsh-purge/lib/extract-asar.js");
const asar = "D:/deepseek harness/resources/app.asar";
const dest = "D:/deepseek harness/resources/app";
console.log("entries:", m.extractAsar(asar, dest));
console.log("unpacked:", JSON.stringify(m.overlayAsarUnpacked(asar, dest)));
'@
```

`extractAsar` 会跳过标记为 `unpacked` 的条目，所以要再用 `overlayAsarUnpacked`
把 `app.asar.unpacked` 里的 1500+ 个原生文件补进去。

结果应该是 **18309 个文件 / 约 449MB**。

### 5.2 应用补丁

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
$env:DSH_BASE = "D:/deepseek harness/resources/app/dsh/node_modules/@deepseek-ai"
node node_modules/dsh-purge/bin/dsh-purge.js --apply
```

预期：**68/85 已清洗，0 待清洗**。

剩下 17 条是 `文件缺失` 和 `na`，属于 liangshen、hooks、0.2.0 兼容这类
你这版本来就有的模块，不是失败。

`--apply` 只做四件事：打补丁、防闪窗、写 shim、落应用记录。
**它不解包、不换包、不重启。**

> 如果 `schtasks.exe` 被安全软件拦了，那只是防 cmd 闪窗那一步，不影响补丁本体。

---

## 6. 换包（必需）

Electron 的加载顺序是 **`app.asar` 优先于 `app` 目录**。补丁写在 `resources\app` 里，
不把 `app.asar` 挪走，补丁一条都不生效。

**必须完全退出宿主**（托盘右键 → 退出，确认任务管理器里没有残留），然后：

```powershell
cd <repo>\scripts
.\2-finish-asar-swap.ps1
```

脚本会等进程退干净 → 把 `app.asar` 改名成 `app.asar.bak` → 清 `rename-pending` 锁 →
重新拉起宿主。

手动等价操作：

```powershell
$r = "D:\deepseek harness\resources"
Move-Item -LiteralPath "$r\app.asar" -Destination "$r\app.asar.bak"
Remove-Item -LiteralPath "$r\app.asar.rename-pending" -Force -ErrorAction SilentlyContinue
```

宿主开着的时候改名会报 `Device or resource busy`，那是 asar 被映射了，正常。

---

## 7. 验证

启动后：

1. 界面能进，**聊天输入框在**
2. 会话标题旁出现 **dsh-purge** 按钮
3. 点开 → Clean 页 → 显示 **68/85 已清洗**
4. **新开一个会话**，注入才进当前回合

---

## 回滚

**只回滚补丁，保留 rc.2**：

```powershell
$r = "D:\deepseek harness\resources"
# 退出宿主后
Remove-Item -LiteralPath "$r\app" -Recurse -Force
Move-Item -LiteralPath "$r\app.asar.bak" -Destination "$r\app.asar"
```

**回滚 profile 插件配置**：把 `package.json.bak` 拷回去，重新 `pnpm install`。

---

## 已知坑

### 自动更新会毁掉安装

宿主的 `resources\app-update.yml` 指向 nightly 通道，当前指向 rc.5。点左下角「新版本」后：

1. 下载 289MB 安装包到 `%LOCALAPPDATA%\@deepseek-aidsh-desktop-updater\pending\`
2. 安装器尝试把 `D:\deepseek harness` 改名备份 → **Windows error 32**（被占用）
3. 目录被搅成半成品：新文件已落地，但 `resources\runtime` 是空的
4. 启动崩：`ENOENT ... runtime\office-skills\office\SKILL.md`

**别点「新版本」。** 要彻底断根，把 `resources\app-update.yml` 改名成 `.disabled`。

补救办法见 README 里的说明——从 `pending\` 里的安装包重新解压覆盖。

### 会话格式不能降级

DSH 会话格式只有 v0→v1→…→v4 的**向上**迁移，没有降级路径。
rc.5 写过的会话在 rc.2 上可能读不出或空白。降级前备份 `~\.dsh\sessions`。

### rc.2 没有 `dsh-client-ui-slots`

这个包是 rc.3 才引入的。skills-manager、codex-ui 的 `peerDependencies` 里都写了它，
但**代码里并不 import**，所以 rc.2 上只是 pnpm 报 peer 警告，不影响加载。

### dsh-splash 不是插件

`dsh-splash` 是直接改 `resources\app.asar` 里 `lib\main.js` 的启动画面补丁工具
（`apply-splash.mjs`），没有 `package.json`，**不应该**作为 bundle 写进 profile。
写了就是坏链，宿主每次启动都会尝试加载失败。

要用启动画面的话，注意它改的是 asar，而打完 dsh-purge 后宿主走的是 `resources\app`
目录模式，得改成改 `resources\app\lib\main.js` 才行。
