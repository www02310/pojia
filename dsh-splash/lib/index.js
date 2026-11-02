/**
 * dsh-splash · DSH 启动画面（插件版）
 *
 * 与「原生补丁版」不同，本插件**不改动宿主 app.asar**：
 * 它通过 webServer 的 `index-inject` 在渲染页最早阶段注入一层全屏覆盖层，
 * 播放「亮白跑马灯 → 一笔写出 DeepSeek Harness」的开场动画，演完自行淡出销毁。
 *
 * 因此：随 DSH 升级自动存活、卸载即彻底干净、不碰任何宿主文件。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// Electron 主进程把 fs 打补丁成「把 *.asar 当成目录」，
// 于是 readSync(app.asar, ...) 会被解释成「读归档里的某个文件」而报 ENOENT。
// original-fs 是 Electron 提供的不带补丁的 fs，用它按普通文件读 asar 头。
let rawFs = fs
try {
  const ofs = createRequire(import.meta.url)('original-fs')
  if (ofs && typeof ofs.openSync === 'function') rawFs = ofs
} catch (err) {
  // 非 Electron 环境（普通 node）保持用 fs
}

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const STATE_DIR = path.join(DSH_HOME, 'splash')
const CONFIG_FILE = path.join(STATE_DIR, 'config.json')
const OVERLAY_FILE = path.join(PACKAGE_ROOT, 'assets', 'splash-overlay.js')
const PREVIEW_FILE = path.join(PACKAGE_ROOT, 'assets', 'splash.html')

const PLUGIN_VERSION = readPluginVersion()
const DEFAULT_CONFIG = {
  enabled: true,
  oncePerSession: true,
  // 默认不跳过：加载期间点界面不该让主页面直接跳出来（默认把点击吞掉）
  clickToSkip: false,
  skipIfNative: true,
}

function readPluginVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
    return String(pkg.version || '0.0.0')
  } catch (err) {
    return '0.0.0'
  }
}

// ── 宿主版本 ────────────────────────────────────────────────────────────────
function hostVersion() {
  const candidates = []
  try { if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'app', 'package.json')) } catch (err) {}
  try { candidates.push(path.join(process.execPath, '..', 'resources', 'app', 'package.json')) } catch (err) {}
  for (const p of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (pkg && pkg.version) return String(pkg.version)
    } catch (err) {}
  }
  return ''
}

function resourcesRoot() {
  try { if (process.resourcesPath) return process.resourcesPath } catch (err) {}
  try { return path.join(path.dirname(process.execPath), 'resources') } catch (err) { return '' }
}

// ── 配置 ────────────────────────────────────────────────────────────────────
function readConfig() {
  let raw = {}
  try { raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) || {} } catch (err) { raw = {} }
  const cfg = { ...DEFAULT_CONFIG }
  for (const k of Object.keys(DEFAULT_CONFIG)) {
    if (typeof raw[k] === 'boolean') cfg[k] = raw[k]
  }
  return cfg
}

function writeConfig(patch) {
  const cfg = readConfig()
  for (const k of Object.keys(DEFAULT_CONFIG)) {
    if (patch && typeof patch[k] === 'boolean') cfg[k] = patch[k]
  }
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err), config: cfg }
  }
  return { ok: true, config: cfg }
}

// ── 原生补丁检测（同一台机器上装过「补丁版」时，避免两层启动画面叠在一起）──
let nativeCache = { at: 0, value: null }
function detectNativeSplash() {
  const now = Date.now()
  if (nativeCache.value && now - nativeCache.at < 15000) return nativeCache.value
  let result = { active: false, path: '', reason: '' }
  try {
    const root = resourcesRoot()
    const asar = root ? path.join(root, 'app.asar') : ''
    result.path = asar
    if (asar && rawFs.existsSync(asar)) {
      const fd = rawFs.openSync(asar, 'r')
      try {
        const head = Buffer.alloc(16)
        rawFs.readSync(fd, head, 0, 16, 0)
        const jsonLen = head.readUInt32LE(12)
        if (jsonLen > 8 && jsonLen < 64 * 1024 * 1024) {
          const jsonBuf = Buffer.alloc(jsonLen)
          rawFs.readSync(fd, jsonBuf, 0, jsonLen, 16)
          const dir = JSON.parse(jsonBuf.toString('utf8'))
          const entry = dir && dir.files && dir.files.lib && dir.files.lib.files && dir.files.lib.files['main.js']
          if (entry && entry.offset !== undefined && entry.offset !== null) {
            const size = Number(entry.size) || 0
            const offset = 8 + jsonLen + Number(entry.offset)
            if (size > 0 && size < 32 * 1024 * 1024) {
              const buf = Buffer.alloc(size)
              rawFs.readSync(fd, buf, 0, buf.length, offset)
              // 补丁版 main.js 里才有这些函数名
              result.active = buf.includes('openDshSplash') || buf.includes('DSH_SPLASH_HTML')
              result.reason = result.active ? 'app.asar 中检测到原生启动画面补丁' : ''
            }
          }
        }
      } finally {
        rawFs.closeSync(fd)
      }
    }
  } catch (err) {
    result.reason = '检测失败：' + String((err && err.message) || err)
  }
  nativeCache = { at: now, value: result }
  return result
}

// ── 注入内容 ────────────────────────────────────────────────────────────────
let overlayCache = null
function overlaySource() {
  if (overlayCache) return overlayCache
  try {
    overlayCache = fs.readFileSync(OVERLAY_FILE, 'utf8')
  } catch (err) {
    overlayCache = ''
  }
  return overlayCache
}

const META_GLOBAL = '__DSH_SPLASH_META__'

// 一行业务无关的日志，写进 $DSH_HOME/splash/plugin.log，方便判断「到底谁出的画面」
function pluginLog(line) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.appendFileSync(path.join(STATE_DIR, 'plugin.log'), new Date().toISOString() + ' ' + line + '\n', 'utf8')
  } catch (err) {}
}

function buildRows() {
  const cfg = readConfig()
  if (!cfg.enabled) { pluginLog('skip: disabled'); return [] }
  const native = detectNativeSplash()
  pluginLog('detect native.active=' + native.active + ' reason=' + (native.reason || '-'))
  if (cfg.skipIfNative && native.active) { pluginLog('skip: native patch active'); return [] }
  const src = overlaySource()
  if (!src) { pluginLog('skip: overlay asset missing'); return [] }
  pluginLog('inject overlay ' + src.length + 'B')
  return [
    {
      kind: 'global',
      name: META_GLOBAL,
      value: {
        enabled: true,
        version: hostVersion(),
        pluginVersion: PLUGIN_VERSION,
        config: cfg,
      },
    },
    // 内联 script（不是 script-src）：不存在加载失败 → 绝不阻断宿主启动
    { kind: 'script', placement: 'body', text: src },
  ]
}

// ── 面板（浏览器/桌面内打开都能用）──────────────────────────────────────────
function panelHtml() {
  const cfg = readConfig()
  const native = detectNativeSplash()
  const rows = JSON.stringify({ cfg, native, version: hostVersion(), plugin: PLUGIN_VERSION })
  const chk = (v) => (v ? ' checked' : '')
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>启动画面 · dsh-splash</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;padding:32px 20px;background:#0b0d12;color:#e8ecf5;
    font:14px/1.6 "Segoe UI",system-ui,"Microsoft YaHei",sans-serif}
  .wrap{max-width:640px;margin:0 auto}
  h1{font-size:19px;margin:0 0 4px;letter-spacing:.01em}
  .sub{color:#8b93a7;font-size:12.5px;margin-bottom:22px}
  .card{background:#11151f;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px 18px;margin-bottom:14px}
  .row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)}
  .row:last-child{border-bottom:0}
  .row .t{font-size:13.5px}
  .row .d{font-size:12px;color:#8b93a7}
  .pill{font-size:11.5px;padding:2px 9px;border-radius:99px;border:1px solid rgba(255,255,255,.14);color:#c8d0e0}
  .pill.on{color:#8ef0c0;border-color:rgba(80,220,160,.4);background:rgba(80,220,160,.08)}
  .pill.off{color:#ffb4a8;border-color:rgba(255,120,100,.35);background:rgba(255,120,100,.07)}
  label{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px}
  input[type=checkbox]{appearance:none;width:38px;height:22px;border-radius:99px;background:#2a3040;position:relative;cursor:pointer;transition:.18s;flex:0 0 auto}
  input[type=checkbox]:checked{background:#4d6bfe}
  input[type=checkbox]::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.18s}
  input[type=checkbox]:checked::after{transform:translateX(16px)}
  .btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
  a.btn,button{font:inherit;font-size:13px;padding:8px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.12);
    background:#1a2030;color:#e8ecf5;cursor:pointer;text-decoration:none}
  a.btn:hover,button:hover{background:#222a3d}
  .hint{color:#8b93a7;font-size:12px;margin-top:10px}
  code{background:rgba(255,255,255,.06);padding:1px 5px;border-radius:4px;font-size:12px}
  .warn{color:#ffcf8a}
</style></head>
<body><div class="wrap">
  <h1>启动画面</h1>
  <div class="sub">亮白跑马灯 → 一笔写出 DeepSeek Harness · 插件版 v${PLUGIN_VERSION}</div>

  <div class="card">
    <div class="row"><div><div class="t">覆盖层</div><div class="d">渲染页注入，不改动宿主文件</div></div>
      <span class="pill ${cfg.enabled ? 'on' : 'off'}">${cfg.enabled ? '已启用' : '已关闭'}</span></div>
    <div class="row"><div><div class="t">宿主版本</div><div class="d">DSH ${hostVersion() || '未知'}</div></div>
      <span class="pill">${native.active ? '原生补丁已装' : '原生补丁未装'}</span></div>
  </div>

  ${native.active && cfg.skipIfNative ? `<div class="card" style="border-color:rgba(255,190,90,.35);background:rgba(255,190,90,.06)">
    <div class="t" style="margin-bottom:6px">当前由「原生补丁版」出画面，覆盖层已让位</div>
    <div class="d">这台机器的 <code>app.asar</code> 里已经装了补丁版启动画面。两层同时放会叠在一起，所以本插件默认让位。
      想改用插件版（升级不失效、卸载无残留）：先运行补丁版的 <code>卸载.cmd</code> 还原 <code>app.asar</code>，再重启 DSH。</div>
  </div>` : ''}

  <div class="card">
    <div class="row"><div><div class="t">启动时播放动画</div><div class="d">关闭后宿主恢复原生启动流程</div></div>
      <input type="checkbox" id="enabled"${chk(cfg.enabled)}></div>
    <div class="row"><div><div class="t">每个窗口只播一次</div><div class="d">关闭后每次页面加载都会播</div></div>
      <input type="checkbox" id="oncePerSession"${chk(cfg.oncePerSession)}></div>
    <div class="row"><div><div class="t">点击可跳过</div><div class="d">默认关闭：加载时点界面不会跳进主页面</div></div>
      <input type="checkbox" id="clickToSkip"${chk(cfg.clickToSkip)}></div>
    <div class="row"><div><div class="t">检测到原生补丁时自动让位</div><div class="d">避免两层启动画面叠在一起</div></div>
      <input type="checkbox" id="skipIfNative"${chk(cfg.skipIfNative)}></div>
    <div class="btns">
      <a class="btn" href="/dsh-splash/preview" target="_blank">预览动画</a>
      <button id="reload">刷新状态</button>
    </div>
    <div class="hint">改动会写入 <code>$DSH_HOME/splash/config.json</code>；<span class="warn">注入表在宿主启动时收集一次，改完要重启 DSH 才生效。</span></div>
  </div>

  <div class="card">
    <div class="row"><div><div class="t">配置文件</div><div class="d">${escapeHtml(CONFIG_FILE)}</div></div></div>
    <div class="row"><div><div class="t">覆盖层脚本</div><div class="d">${escapeHtml(OVERLAY_FILE)}</div></div></div>
    <div class="row"><div><div class="t">app.asar</div><div class="d">${escapeHtml(native.path || '未找到')}${native.reason ? ' · ' + escapeHtml(native.reason) : ''}</div></div></div>
  </div>
</div>
<script>
  var state = ${rows};
  document.querySelectorAll('input[type=checkbox]').forEach(function (el) {
    el.addEventListener('change', function () {
      var patch = {}; patch[el.id] = el.checked;
      fetch('/dsh-splash/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(function (r) { return r.json() }).then(function (res) {
        if (!res.ok) { el.checked = !el.checked; alert('保存失败：' + (res.error || '未知错误')) }
      }).catch(function (e) { el.checked = !el.checked; alert('保存失败：' + e) })
    })
  })
  document.getElementById('reload').addEventListener('click', function () { location.reload() })
</script>
</body></html>`
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── 访问栅栏：只放行本机 + 同源 ──────────────────────────────────────────
function isLoopbackHostname(hn) {
  const h = String(hn || '').toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (!h) return false
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (h === '::1') return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (!m) return false
  return Number(m[1]) === 127 && [m[2], m[3], m[4]].every((x) => Number(x) <= 255)
}

function rejected(req) {
  try {
    const headers = req.headers || {}
    let hostUrl
    try { hostUrl = new URL('http://' + String(headers.host || '')) } catch (err) { return 403 }
    if (String(headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return 403
    const origin = headers.origin
    if (typeof origin === 'string' && origin && origin !== 'null') {
      let o
      try { o = new URL(origin) } catch (err) { return 403 }
      if (o.host.toLowerCase() !== hostUrl.host.toLowerCase()) return 403
    }
    const write = new Set(['POST', 'PUT', 'PATCH', 'DELETE']).has(String(req.method || 'GET').toUpperCase())
    if (write && !isLoopbackHostname(hostUrl.hostname)) return 403
    return null
  } catch (err) {
    return 403
  }
}

function sendJson(res, code, body) {
  const text = JSON.stringify(body)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(Buffer.byteLength(text)),
  })
  res.end(text)
}

function sendText(res, code, type, text) {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Content-Length': String(Buffer.byteLength(text)),
  })
  res.end(text)
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) { req.destroy(); resolve('') ; return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => resolve(''))
  })
}

// ── 插件本体 ────────────────────────────────────────────────────────────────
export default {
  name: 'dsh-splash',
  apply(root) {
    const disposers = []
    root.effect(() => () => {
      while (disposers.length) {
        try { disposers.pop()() } catch (err) {}
      }
    })

    // ① 注入行：必须在 apply 里立刻订阅（桌面端注入表在宿主启动时只收集一次）
    disposers.push(root.on('webserver/index-inject', (table) => {
      try {
        if (!Array.isArray(table)) return
        // 同一张表里已经推过就不重复推（宿主可能多次 emit）
        for (const row of table) {
          if (row && row.kind === 'script' && typeof row.text === 'string' && row.text.indexOf('__DSH_SPLASH_BOOTED__') >= 0) return
        }
        const rows = buildRows()
        for (const row of rows) table.push(row)
      } catch (err) {
        // 注入失败绝不影响宿主启动
        try { console.warn('[dsh-splash] 注入失败：' + String((err && err.message) || err)) } catch (e2) {}
      }
    }))

    // ② 路由：状态 / 配置 / 面板 / 预览
    root.inject(['webServer'], (ctx) => {
      const wrap = (handler) => async (req, res) => {
        const code = rejected(req)
        if (code !== null) { res.writeHead(code); res.end(); return }
        try { await handler(req, res) } catch (err) {
          try { sendJson(res, 500, { ok: false, error: String((err && err.message) || err) }) } catch (e2) {}
        }
      }

      disposers.push(ctx.webServer.register({
        kind: 'exact',
        path: '/dsh-splash/status',
        handler: wrap((req, res) => {
          const native = detectNativeSplash()
          sendJson(res, 200, {
            ok: true,
            pluginVersion: PLUGIN_VERSION,
            hostVersion: hostVersion(),
            config: readConfig(),
            native,
            overlayBytes: overlaySource().length,
            stateDir: STATE_DIR,
          })
        }),
      }))

      disposers.push(ctx.webServer.register({
        kind: 'exact',
        path: '/dsh-splash/config',
        handler: wrap(async (req, res) => {
          if (String(req.method || '').toUpperCase() !== 'POST') {
            return sendJson(res, 405, { ok: false, error: 'use POST' })
          }
          const text = await readBody(req)
          let patch = {}
          try { patch = JSON.parse(text || '{}') } catch (err) {
            return sendJson(res, 400, { ok: false, error: 'invalid JSON' })
          }
          const result = writeConfig(patch)
          sendJson(res, result.ok ? 200 : 500, result)
        }),
      }))

      disposers.push(ctx.webServer.register({
        kind: 'exact',
        path: '/dsh-splash/panel',
        handler: wrap((req, res) => {
          sendText(res, 200, 'text/html; charset=utf-8', panelHtml())
        }),
      }))

      disposers.push(ctx.webServer.register({
        kind: 'exact',
        path: '/dsh-splash/preview',
        handler: wrap((req, res) => {
          let html = ''
          try { html = fs.readFileSync(PREVIEW_FILE, 'utf8') } catch (err) {
            return sendText(res, 500, 'text/plain; charset=utf-8', 'preview unavailable')
          }
          // 预览页里的 logo.svg 走路由，避免依赖相对路径
          sendText(res, 200, 'text/html; charset=utf-8', html.replace(/src="logo\.svg"/g, 'src="/dsh-splash/logo.svg"'))
        }),
      }))

      disposers.push(ctx.webServer.register({
        kind: 'exact',
        path: '/dsh-splash/logo.svg',
        handler: wrap((req, res) => {
          let svg = ''
          try { svg = fs.readFileSync(path.join(PACKAGE_ROOT, 'assets', 'logo.svg'), 'utf8') } catch (err) {
            return sendText(res, 404, 'text/plain; charset=utf-8', 'not found')
          }
          sendText(res, 200, 'image/svg+xml; charset=utf-8', svg)
        }),
      }))
    })
  },
}
