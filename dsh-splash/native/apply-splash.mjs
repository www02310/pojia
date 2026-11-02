#!/usr/bin/env node
/**
 * apply-splash.mjs — 给 DeepSeek Harness 桌面端打「启动画面」补丁（通用版）
 *
 * 用法（用 app 自带的 node 跑，无需任何依赖）：
 *   node apply-splash.mjs                  # 自动探测 DSH 安装目录
 *   node apply-splash.mjs "D:\xxx\dsh"     # 手动指定安装目录
 *   node apply-splash.mjs --dry-run        # 只验证不落盘
 *   node apply-splash.mjs --restore        # 从备份还原
 *
 * 原理：重建 app.asar —— lib/main.js 插入启动画面逻辑（openDshSplash/closeDshSplash
 *   + 4 个调用点），其余文件原样搬运、逐字节校验；启动画面 HTML 放 $DSH_HOME/splash/
 *   （app 升级不丢失），main.js 找不到该文件就整体跳过，不影响主流程。
 * 安全：先全量自验证（语法 + 除 main.js 外所有文件逐字节比对 + 边界检查），通过才落盘；
 *   首次打补丁前自动备份 app.asar → app.asar.pre-splash.bak。
 * asar 头部格式（实证）：[u32:4][u32:jsonLen+8][u32:jsonLen+4][u32:jsonLen][JSON][数据]，
 *   JSON 后紧跟文件数据，整体 4 字节对齐。
 * 兼容性：在 DSH 0.2.1-rc.2（Electron 44.7.0）上实测通过；其他版本若 main.js 插入点
 *   不匹配，脚本会报错且不做任何修改。
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync, renameSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MARKER = "[dsh-splash]";
const BLOCK_SIZE = 4194304;

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const RESTORE = args.includes("--restore");

function fail(msg) {
	console.error("✗ " + msg);
	process.exit(1);
}

/** 自动探测 DSH 安装目录：显式参数 > 环境变量 > 注册表 > 常见路径 */
function findAppDir() {
	const explicit = args.find((a) => !a.startsWith("--"));
	const candidates = [];
	if (explicit) candidates.push(explicit);
	if (process.env.DSH_INSTALL_DIR) candidates.push(process.env.DSH_INSTALL_DIR);
	const roots = [
		"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
		"HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
		"HKCU\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
		"HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
	];
	for (const root of roots) {
		try {
			const text = execFileSync("reg", ["query", root, "/s", "/f", "DeepSeek Harness", "/t", "REG_SZ"], {
				encoding: "latin1",
				stdio: ["ignore", "pipe", "ignore"]
			});
			for (const line of text.split(/\r?\n/)) {
				let m = line.match(/InstallLocation\s+REG_SZ\s+(.+)$/i);
				if (m && m[1].trim()) candidates.push(m[1].trim());
				m = line.match(/DisplayIcon\s+REG_SZ\s+(.+?),\d+\s*$/i);
				if (m) candidates.push(dirname(m[1].trim()));
			}
		} catch {
			/* 注册表不可用（策略限制等）时静默跳过 */
		}
	}
	const local = process.env.LOCALAPPDATA || "";
	const pf = process.env.ProgramFiles || "C:\\Program Files";
	const pfx86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
	candidates.push(
		join(local, "Programs", "DeepSeek Harness"),
		join(local, "DeepSeek Harness"),
		join(pf, "DeepSeek Harness"),
		join(pfx86, "DeepSeek Harness")
	);
	for (const c of candidates) {
		try {
			if (c && existsSync(join(c, "DeepSeek Harness.exe")) && existsSync(join(c, "resources", "app.asar"))) return c;
		} catch {
			/* ignore */
		}
	}
	return "";
}

const APP_DIR = findAppDir();
if (!APP_DIR) {
	fail(
		"找不到 DeepSeek Harness 安装目录。\n" +
			"  请用参数指定，例如：node apply-splash.mjs \"D:\\deepseek harness\"\n" +
			"  （目录里应当有 DeepSeek Harness.exe 和 resources\\app.asar）"
	);
}
const ASAR = join(APP_DIR, "resources", "app.asar");
const BAK = ASAR + ".pre-splash.bak";
const NEW = ASAR + ".new";
const DSH_HOME = process.env.DSH_HOME || join(process.env.USERPROFILE || process.env.HOME || "", ".dsh");
const SPLASH_DIR = join(DSH_HOME, "splash");
console.log("· 安装目录: " + APP_DIR);

// ---------------------------------------------------------------- 补丁代码
const REGION = [
	"//#region [dsh-splash] 启动画面（本地补丁；还原：node apply-splash.mjs --restore）",
	"let dshSplashWindow;",
	"let dshSplashShownAt = 0;",
	"let dshSplashFailsafe;",
	"let dshSplashTarget;",
	"const DSH_SPLASH_MIN_SHOW = 6400;",
	"// 启动时序日志：DSH_HOME/splash/boot.log，排查「动画被切」时看这个",
	"function dshSplashLog(msg) {",
	"\ttry {",
	"\t\tmkdirSync(DSH_SPLASH_HOME, { recursive: true });",
	"\t\tappendFileSync(join(DSH_SPLASH_HOME, \"boot.log\"), new Date().toISOString() + \" \" + msg + \"\\n\", \"utf8\");",
	"\t} catch {}",
	"}",
	'const DSH_SPLASH_HOME = join(process.env.DSH_HOME || join(homedir(), ".dsh"), "splash");',
	'const DSH_SPLASH_HTML = join(DSH_SPLASH_HOME, "splash.html");',
	'const DSH_SPLASH_GEOM = join(DSH_SPLASH_HOME, "window.json");',
	"// 记住上次宿主窗口的位置与大小：下次启动的时候启动窗直接对齐，不会先大后小地跳一下",
	"function dshSplashSavedGeometry() {",
	"\ttry {",
	"\t\tconst g = JSON.parse(readFileSync(DSH_SPLASH_GEOM, \"utf8\"));",
	"\t\tif (g && g.width > 420 && g.height > 300) {",
	"\t\t\treturn {",
	"\t\t\t\tx: Number.isFinite(g.x) ? Math.round(g.x) : void 0,",
	"\t\t\t\ty: Number.isFinite(g.y) ? Math.round(g.y) : void 0,",
	"\t\t\t\twidth: Math.round(g.width),",
	"\t\t\t\theight: Math.round(g.height)",
	"\t\t\t};",
	"\t\t}",
	"\t} catch {}".replace('"\t} catch {}"', '"\t} catch {}"'),
	"\treturn void 0;",
	"}",
	"function dshSplashSaveGeometry(win) {",
	"\ttry {",
	"\t\tif (!win || win.isDestroyed()) return;",
	"\t\tconst b = win.getBounds();",
	"\t\tif (b.width < 420 || b.height < 300) return;",
	"\t\tmkdirSync(DSH_SPLASH_HOME, { recursive: true });",
	"\t\twriteFileSync(DSH_SPLASH_GEOM, JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height }), \"utf8\");",
	"\t} catch {}",
	"}",
	"// 没有历史记录时的兜底：取工作区，但别铺满整块屏（那会像全屏截图）",
	"function dshSplashFallbackGeometry() {",
	"\ttry {",
	'\t\tconst electron = createRequire(import.meta.url)("electron");',
	"\t\tconst wa = electron.screen.getPrimaryDisplay().workAreaSize;",
	"\t\tif (wa && wa.width > 420 && wa.height > 300) {",
	"\t\t\treturn { width: Math.min(wa.width, 1280), height: Math.min(wa.height, 860) };",
	"\t\t}",
	"\t} catch {}",
	"\treturn { width: 1200, height: 800 };",
	"}",
	"// 把启动窗贴到宿主主窗口的位置与大小上",
	"function dshSplashMatch(win) {",
	"\ttry {",
	"\t\tif (!dshSplashWindow || dshSplashWindow.isDestroyed()) return;",
	"\t\t// 已经显示出来的窗口不再改几何：可见状态下 setBounds 会在某些 DPI 缩放组合下留下上一帧的重影",
	"\t\tif (typeof dshSplashWindow.isVisible === \"function\" && dshSplashWindow.isVisible()) return;",
	"\t\tif (!win || win === dshSplashWindow || win.isDestroyed()) return;",
	"\t\tconst b = win.getBounds();",
	"\t\tif (b.width < 420 || b.height < 300) return;",
	"\t\tdshSplashTarget = win;",
	"\t\tconst cur = dshSplashWindow.getBounds();",
	"\t\tif (cur.x !== b.x || cur.y !== b.y || cur.width !== b.width || cur.height !== b.height) {",
	"\t\t\tdshSplashWindow.setBounds(b);",
	"\t\t}",
	"\t} catch {}",
	"}",
	"function openDshSplash() {",
	"\tif (dshSplashWindow && !dshSplashWindow.isDestroyed()) return;",
	"\ttry {",
	"\t\tif (!existsSync(DSH_SPLASH_HTML)) return;",
	"\t\tconst geo = dshSplashSavedGeometry() || dshSplashFallbackGeometry();",
	"\t\tdshSplashWindow = new BrowserWindow({",
	"\t\t\tx: geo.x,",
	"\t\t\ty: geo.y,",
	"\t\t\twidth: geo.width,",
	"\t\t\theight: geo.height,",
	"\t\t\tcenter: geo.x === void 0,",
	"\t\t\tframe: false,",
	"\t\t\tresizable: false,",
	"\t\t\tminimizable: false,",
	"\t\t\tmaximizable: false,",
	"\t\t\tskipTaskbar: true,",
	"\t\t\talwaysOnTop: true,",
	"\t\t\tshow: false,",
	'\t\t\tbackgroundColor: "#0b0d12",',
	"\t\t\twebPreferences: {",
	"\t\t\t\tnodeIntegration: false,",
	"\t\t\t\tcontextIsolation: true,",
	"\t\t\t\tsandbox: true,",
	"\t\t\t\twebSecurity: true,",
	"\t\t\t\tdevTools: false",
	"\t\t\t}",
	"\t\t});",
	"\t\tdshSplashWindow.setMenu(null);",
	"\t\ttry { dshSplashWindow.setAlwaysOnTop(true, \"screen-saver\"); } catch {}",
	"\t\tdshSplashLog(\"alwaysOnTop level=screen-saver\");",
	'\t\tdshSplashWindow.once("ready-to-show", () => {',
	"\t\t\tif (dshSplashWindow.isDestroyed()) return;",
	"\t\t\t// 显示之前做最后一次对齐：此时窗口不可见，不会留重影",
	"\t\t\ttry {",
	"\t\t\t\tfor (const w of BrowserWindow.getAllWindows()) dshSplashMatch(w);",
	"\t\t\t} catch {}",
	"\t\t\tdshSplashWindow.show();",
	"\t\t\tdshSplashLog(\"shown bounds=\" + JSON.stringify(dshSplashWindow.getBounds()));",
	"\t\t\ttry {",
	"\t\t\t\tconst electron = createRequire(import.meta.url)(\"electron\");",
	"\t\t\t\tconst disp = electron.screen.getPrimaryDisplay();",
	"\t\t\t\tdshSplashLog(\"display scale=\" + disp.scaleFactor + \" bounds=\" + JSON.stringify(disp.bounds) + \" work=\" + JSON.stringify(disp.workAreaSize));",
	"\t\t\t} catch {}",
	"\t\t\tdshSplashLog(\"splash bounds=\" + JSON.stringify(dshSplashWindow.getBounds()) + \" content=\" + JSON.stringify(dshSplashWindow.getContentBounds()) + \" zoom=\" + dshSplashWindow.webContents.getZoomFactor());",
	"\t\t\tdshSplashLog(\"painted in \" + (Date.now() - dshSplashShownAt) + \"ms\");",
	"\t\t});",
	'\t\tdshSplashWindow.once("closed", () => {',
	"\t\t\tdshSplashWindow = void 0;",
	"\t\t});",
	'\t\tdshSplashWindow.loadFile(DSH_SPLASH_HTML, { query: { version: app.getVersion() } }).catch(() => {});',
	"\t\tdshSplashWindow.webContents.on(\"did-start-loading\", () => dshSplashLog(\"did-start-loading\"));",
	"\t\tdshSplashWindow.webContents.on(\"did-finish-load\", () => {",
	"\t\t\tdshSplashLog(\"did-finish-load\");",
	"\t\t});",
	"\t\tdshSplashWindow.webContents.on(\"render-process-gone\", (_e, d) => dshSplashLog(\"render-process-gone \" + (d && d.reason)));",
	"\t\tdshSplashWindow.webContents.on(\"did-fail-load\", (_e, code, desc) => dshSplashLog(\"did-fail-load \" + code + \" \" + desc));",
	"\t\tdshSplashWindow.on(\"resize\", () => dshSplashLog(\"splash resized \" + JSON.stringify(dshSplashWindow.getBounds())));",
	"\t\tdshSplashWindow.on(\"move\", () => dshSplashLog(\"splash moved \" + JSON.stringify(dshSplashWindow.getBounds())));",
	"\t\tdshSplashShownAt = Date.now();",
	"\t\tdshSplashLog(\"opened \" + geo.width + \"x\" + geo.height + \" at (\" + (geo.x === void 0 ? \"?\" : geo.x) + \",\" + (geo.y === void 0 ? \"?\" : geo.y) + \")\");",
	"\t\tdshSplashFailsafe = setTimeout(() => closeDshSplash(true), 25000);",
	'\t\tif (typeof dshSplashFailsafe.unref === "function") dshSplashFailsafe.unref();',
	"\t\t// 宿主窗口可能已经先建好了，立刻对齐一次",
	"\t\ttry {",
	"\t\t\tfor (const w of BrowserWindow.getAllWindows()) {",
	"\t\t\t\tif (w !== dshSplashWindow) dshSplashMatch(w);",
	"\t\t\t}",
	"\t\t} catch {}",
	"\t} catch {",
	"\t\t/* 启动画面尽力而为，失败不影响主流程 */",
	"\t}",
	"}",
	"function closeDshSplash(force) {",
	"\tif (dshSplashFailsafe) {",
	"\t\tclearTimeout(dshSplashFailsafe);",
	"\t\tdshSplashFailsafe = void 0;",
	"\t}",
	"\tdshSplashSaveGeometry(dshSplashTarget || dshSplashWindow);",
	"\tconst win = dshSplashWindow;",
	"\tdshSplashWindow = void 0;",
	"\tdshSplashTarget = void 0;",
	"\tif (!win || win.isDestroyed()) return;",
	"\tconst elapsed = Date.now() - dshSplashShownAt;",
	"\tconst destroy = () => {",
	"\t\tif (win.isDestroyed()) return;",
	"\t\t// 收尾淡出 ~120ms，别硬切",
	"\t\tlet opacity = 1;",
	"\t\tconst timer = setInterval(() => {",
	"\t\t\tif (win.isDestroyed()) { clearInterval(timer); return; }",
	"\t\t\topacity -= 0.16;",
	"\t\t\tif (opacity <= 0) {",
	"\t\t\t\tclearInterval(timer);",
	"\t\t\t\twin.destroy();",
	"\t\t\t\tdshSplashLog(\"closed after \" + (Date.now() - dshSplashShownAt) + \"ms\");",
	"\t\t\t\treturn;",
	"\t\t\t}",
	"\t\t\ttry { win.setOpacity(Math.max(opacity, 0.02)); } catch {}",
	"\t\t}, 16);",
	"\t\tif (typeof timer.unref === \"function\") timer.unref();",
	"\t};",
	"\t// 动画没演完就不撤：主窗口早就绪也等它走完，否则就是「跑马灯没跑完就跳进主界面」",
	"\tconst wait = force ? 0 : DSH_SPLASH_MIN_SHOW - elapsed;",
	"\tif (wait > 0) {",
	"\t\tdshSplashLog(\"close requested at \" + elapsed + \"ms, holding \" + wait + \"ms more\");",
	"\t\tsetTimeout(destroy, wait);",
	"\t} else destroy();",
	"}",
	"// 跟着宿主窗口走：位置/大小变了就同步（用户改了窗口尺寸，下次启动也记得住）",
	"try { app.on(\"before-quit\", () => closeDshSplash(true)); } catch {}",
	"try { app.on(\"window-all-closed\", () => closeDshSplash(true)); } catch {}",
	"try {",
	'\tapp.on("browser-window-created", (_event, win) => {',
	"\t\ttry {",
	"\t\t\tif (!win || win === dshSplashWindow) return;",
	"\t\t\tdshSplashMatch(win);",
	'\t\t\twin.on("move", () => dshSplashMatch(win));',
	'\t\t\twin.on("resize", () => dshSplashMatch(win));',
	'\t\t\twin.once("ready-to-show", () => dshSplashMatch(win));',
	"\t\t\tconst maybeClose = () => {",
	"\t\t\t\tif (!dshSplashWindow || win === dshSplashWindow) return;",
	"\t\t\t\tlet bounds = null;",
	"\t\t\t\ttry { bounds = win.getBounds(); } catch {}",
	"\t\t\t\t// 辅助窗（隐藏窗、提示窗）不触发收尾；只认够大的主窗口",
	"\t\t\t\tif (bounds && (bounds.width < 420 || bounds.height < 300)) return;",
	"\t\t\t\tcloseDshSplash();",
	"\t\t\t};",
	"\t\t\twin.on(\"close\", () => { if (dshSplashWindow && win !== dshSplashWindow) closeDshSplash(true); });",
	"\t\t\twin.on(\"hide\", () => { if (dshSplashWindow && win !== dshSplashWindow) closeDshSplash(true); });",
	'\t\t\twin.once("show", maybeClose);',
	"\t\t\tif (typeof win.isVisible === \"function\" && win.isVisible()) maybeClose();",
	"\t\t} catch {}",
	"\t});",
	"} catch {}",
	"//#endregion",
	""
].join("\n");

const EDITS = [
	[
		"region + reportFatal 调用",
		"function reportFatal(error, source) {\n\tconsole.error(error);",
		REGION + "function reportFatal(error, source) {\n\tcloseDshSplash(true);\n\tconsole.error(error);"
	],
	[
		"main() 开头打开 splash",
		"async function main() {\n\tconst desktopSettings = readDesktopSettings(app.getPath(\"userData\"));",
		"async function main() {\n\topenDshSplash();\n\tconst desktopSettings = readDesktopSettings(app.getPath(\"userData\"));"
	]
];

// ---------------------------------------------------------------- asar 工具
function parseAsar(buf) {
	const jsonLen = buf.readUInt32LE(12);
	if (jsonLen <= 0 || 16 + jsonLen > buf.length) throw new Error("asar 头部异常: jsonLen=" + jsonLen);
	const header = JSON.parse(buf.toString("utf8", 16, 16 + jsonLen));
	// 数据区起点 = 8 + 头部字段(4)，该字段已经包含 JSON 到 4 字节对齐的填充字节。
	// 直接写 16 + jsonLen 会在 jsonLen 不是 4 的倍数时整体错位（0.2.1-rc.3 的
	// 头部正好多 1 个对齐字节，错位 1 字节 → 每个文件少 1 字节，属于静默损坏）。
	const dataBase = 8 + buf.readUInt32LE(4);
	if (dataBase < 16 + jsonLen || dataBase > 16 + jsonLen + 3) throw new Error("asar 头部异常: 数据区起点 " + dataBase);
	return { header, dataBase, jsonLen };
}
function findEntry(header, parts) {
	let cur = header;
	for (const p of parts) {
		if (!cur || !cur.files || !cur.files[p]) throw new Error("asar 中找不到 " + parts.join("/"));
		cur = cur.files[p];
	}
	return cur;
}
function* walkFiles(node, prefix) {
	for (const [name, entry] of Object.entries(node.files || {})) {
		const path = prefix ? prefix + "/" + name : name;
		if (entry.files) yield* walkFiles(entry, path);
		else yield [path, entry];
	}
}
/** 按原偏移升序收集全部【已打包】文件（unpacked 条目数据在 app.asar.unpacked/，不在归档内，原样保留） */
function collectFiles(header, dataBase, buf) {
	const files = [];
	for (const [path, entry] of walkFiles(header, "")) {
		if (entry.unpacked) continue;
		const size = Number(entry.size);
		const offset = Number(entry.offset);
		if (dataBase + offset + size > buf.length) throw new Error("文件越界: " + path);
		files.push({ path, entry, size, offset, data: buf.subarray(dataBase + offset, dataBase + offset + size) });
	}
	files.sort((a, b) => a.offset - b.offset);
	return files;
}
function buildAsar(header, orderedFiles) {
	// 1) 数据区：按序拼接，重算 offset
	let cursor = 0;
	for (const f of orderedFiles) {
		f.newOffset = cursor;
		cursor += f.size;
	}
	// 2) 新头部 JSON（offset 用字符串，保持与原格式一致）
	const newHeader = JSON.parse(JSON.stringify(header));
	for (const f of orderedFiles) setEntry(newHeader, f.path.split("/"), { size: f.size, offset: String(f.newOffset), integrity: f.integrity });
	let json = JSON.stringify(newHeader);
	// 以 UTF-8 字节数对齐，不能按字符串长度（含非 ASCII 路径时两者不等）
	let jsonBuf = Buffer.from(json, "utf8");
	if ((16 + jsonBuf.length) % 4 !== 0) {
		jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - ((16 + jsonBuf.length) % 4), 0x20)]);
	}
	const jsonLen = jsonBuf.length;
	const dataBase = 16 + jsonLen;
	// 3) 头部 16 字节 + JSON + 数据
	const head = Buffer.alloc(16);
	head.writeUInt32LE(4, 0);
	head.writeUInt32LE(jsonLen + 8, 4);
	head.writeUInt32LE(jsonLen + 4, 8);
	head.writeUInt32LE(jsonLen, 12);
	return Buffer.concat([head, jsonBuf, ...orderedFiles.map((f) => f.data)]);
}
function setEntry(node, parts, value) {
	let cur = node;
	for (let i = 0; i < parts.length - 1; i++) cur = cur.files[parts[i]];
	cur.files[parts[parts.length - 1]] = value;
}
function integrityOf(buf) {
	const blocks = [];
	for (let i = 0; i < buf.length; i += BLOCK_SIZE) blocks.push(createHash("sha256").update(buf.subarray(i, i + BLOCK_SIZE)).digest("hex"));
	return { algorithm: "SHA256", hash: createHash("sha256").update(buf).digest("hex"), blockSize: BLOCK_SIZE, blocks };
}

// ---------------------------------------------------------------- 主流程
if (RESTORE) {
	if (!existsSync(BAK)) fail("没有找到备份 " + BAK);
	copyFileSync(BAK, ASAR + ".restoring");
	renameSync(ASAR + ".restoring", ASAR);
	console.log("✓ 已从备份还原 app.asar（启动画面已移除）");
	process.exit(0);
}

if (!existsSync(ASAR)) fail("找不到 " + ASAR);

try {
	const out = execFileSync("tasklist", ["/FI", 'IMAGENAME eq DeepSeek Harness.exe'], { encoding: "latin1" });
	if (/DeepSeek Harness\.exe/i.test(out)) fail("DeepSeek Harness 正在运行。请先【托盘右键 → 退出】完全关闭，再运行本脚本。");
} catch { /* tasklist 不可用时跳过检测 */ }

console.log("· 读取并解析 app.asar …");
const buf = readFileSync(ASAR);
const { header, dataBase } = parseAsar(buf);
const files = collectFiles(header, dataBase, buf);
const mainFile = files.find((f) => f.path === "lib/main.js");
if (!mainFile) fail("找不到 lib/main.js");
console.log("· 共 " + files.length + " 个文件，main.js 大小 " + mainFile.size);

if (Buffer.from(mainFile.data).toString("utf8").includes(MARKER)) {
	console.log("· 已包含补丁标记，跳过代码补丁。");
} else {
	console.log("· 应用代码补丁（4 处插入）…");
	let text = mainFile.data.toString("utf8");
	for (const [label, from, to] of EDITS) {
		const count = text.split(from).length - 1;
		if (count !== 1) fail("插入点不唯一或不存在（" + count + " 处）：" + label);
		text = text.replace(from, to);
	}
	const patched = Buffer.from(text, "utf8");

	// 自验证 1：语法检查
	const tmpJs = join(HERE, ".main.patched.check.js");
	writeFileSync(tmpJs, patched);
	try {
		execFileSync(process.execPath, ["--check", tmpJs], { stdio: "pipe" });
		console.log("· 语法检查通过（node --check），补丁后 main.js " + patched.length + " 字节");
	} catch (e) {
		try { unlinkSync(tmpJs); } catch {}
		fail("补丁后 main.js 语法错误:\n" + String(e.stderr || e.message));
	} finally {
		try { unlinkSync(tmpJs); } catch {}
	}

	// 替换 main.js 数据，重算 integrity
	mainFile.data = patched;
	mainFile.size = patched.length;
	mainFile.integrity = integrityOf(patched);

	// 自验证 2：重建并全量比对
	const outBuf = buildAsar(header, files);
	const check = parseAsar(outBuf);
	const newFiles = collectFiles(check.header, check.dataBase, outBuf);
	if (newFiles.length !== files.length) fail("重建后文件数不一致");
	const oldByPath = new Map(files.map((f) => [f.path, f]));
	let identical = 0;
	for (const nf of newFiles) {
		const of = oldByPath.get(nf.path);
		if (!of) fail("重建后出现新文件: " + nf.path);
		if (nf.path === "lib/main.js") {
			if (!nf.data.toString("utf8").includes(MARKER)) fail("main.js 补丁未生效");
			continue;
		}
		if (Buffer.compare(nf.data, of.data) !== 0) fail("文件被意外改动: " + nf.path);
		identical += 1;
	}
	// 自验证 3：新 asar 里每个文件都能按头部声明的偏移/大小完整取出
	for (const nf of newFiles) {
		if (check.dataBase + Number(nf.entry.offset) + Number(nf.entry.size) > outBuf.length) fail("新 asar 偏移越界: " + nf.path);
	}
	console.log("· 重建校验通过（其余 " + identical + " 个文件逐字节一致，总大小 " + buf.length + " → " + outBuf.length + "）");

	if (DRY) {
		console.log("✓ dry-run 完成，未写入任何文件。");
		process.exit(0);
	}

	if (!existsSync(BAK)) {
		copyFileSync(ASAR, BAK);
		console.log("· 已备份 → " + BAK);
	}
	writeFileSync(NEW, outBuf);
	renameSync(NEW, ASAR);
	console.log("✓ 补丁已写入 app.asar");
}

// 确保 splash 资源就位（$DSH_HOME/splash/）
if (!existsSync(SPLASH_DIR)) mkdirSync(SPLASH_DIR, { recursive: true });
for (const f of ["splash.html", "logo.svg"]) {
	const src = join(HERE, "splash", f);
	const dst = join(SPLASH_DIR, f);
	if (!existsSync(dst) && existsSync(src)) copyFileSync(src, dst);
}
for (const f of ["splash.html", "logo.svg"]) {
	if (!existsSync(join(SPLASH_DIR, f))) fail("缺少启动画面资源 " + f);
}
console.log("✓ 启动画面资源就位: " + SPLASH_DIR);
console.log("\n全部完成。重启 DeepSeek Harness 即可看到启动画面。");
