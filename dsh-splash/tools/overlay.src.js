/*!
 * DSH Splash · runtime overlay
 * 由 tools/build-overlay.mjs 从 assets/splash.html 生成，请勿直接编辑生成物。
 * 无需改宿主文件：通过 webServer 的 index-inject 注入，启动早期挂一层全屏覆盖层。
 */
(function () {
  'use strict'
  var CSS = @CSS@;
  var MARKUP = @MARKUP@;
  var GLYPHS = @GLYPHS@;

  var META = (typeof window !== 'undefined' && window.__DSH_SPLASH_META__) || {}
  var CFG = (META.config && typeof META.config === 'object') ? META.config : {}
  var NS = 'http://www.w3.org/2000/svg'
  var HOST_ID = 'dsh-splash-overlay-host'
  var SEEN_KEY = '__dsh_splash_seen__'

  // 每个窗口只放一次：HMR 热重载 / 页面刷新不再重复播放
  // 注意：**标记只在动画真正播完后写下**。桌面壳可能先加载一个占位页再导航到正式页，
  // 若在脚本开头就打标记，正式页会因为「已看过」而整段不播（实测就是这样丢的）。
  try {
    if (window.__DSH_SPLASH_BOOTED__) return
    window.__DSH_SPLASH_BOOTED__ = true
    if (CFG.oncePerSession !== false && sessionStorage.getItem(SEEN_KEY) === '1') return
  } catch (e) {}

  function markSeen() {
    try { sessionStorage.setItem(SEEN_KEY, '1') } catch (e) {}
  }

  function alive() {
    try { return !!(window.__DSH_SPLASH_META__ && window.__DSH_SPLASH_META__.enabled) } catch (e) { return true }
  }

  var host = null
  var shadow = null
  var removed = false

  function teardown() {
    if (removed) return
    removed = true
    try { if (host && host.parentNode) host.parentNode.removeChild(host) } catch (e) {}
    host = null; shadow = null
  }

  function makeHost() {
    var parent = document.body || document.documentElement
    if (!parent) return null
    var el = document.createElement('div')
    el.id = HOST_ID
    el.setAttribute('aria-hidden', 'true')
    // 立在所有界面之上；宿主窗口自身还是隐藏的，用户看到的第一帧就是它
    el.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483647;'
      + 'pointer-events:auto;background:#0b0d12;contain:strict;'
    parent.appendChild(el)
    // position:fixed 只对「没有任何 transform/filter/contain 祖先」的元素才是相对视口。
    // 宿主一旦在 body/html 上挂了变换，覆盖层就会被缩在某个盒子里。
    // 这里按实测矩形做反向补偿，铺满整个视口；尺寸变化时重新贴。
    function fit() {
      try {
        for (var pass = 0; pass < 3; pass++) {
          var r = el.getBoundingClientRect()
          var vw = window.innerWidth || document.documentElement.clientWidth
          var vh = window.innerHeight || document.documentElement.clientHeight
          el.style.width = vw + 'px'
          el.style.height = vh + 'px'
          var dx = -r.left, dy = -r.top
          el.style.left = (parseFloat(el.style.left) || 0) + dx + 'px'
          el.style.top = (parseFloat(el.style.top) || 0) + dy + 'px'
          if (Math.abs(r.width - vw) < 1.5 && Math.abs(r.height - vh) < 1.5) break
        }
      } catch (e) {}
    }
    fit()
    try { window.addEventListener('resize', fit) } catch (e) {}
    setTimeout(fit, 80)
    setTimeout(fit, 320)
    setTimeout(fit, 900)
    return el
  }

  try {
    host = makeHost()
    if (!host) return
    shadow = host.attachShadow ? host.attachShadow({ mode: 'closed' }) : null
    if (!shadow) { teardown(); return }
    var style = document.createElement('style')
    style.textContent = CSS
    shadow.appendChild(style)
    var wrap = document.createElement('div')
    wrap.className = 'splash-root'
    wrap.innerHTML = MARKUP
    shadow.appendChild(wrap)
  } catch (e) {
    teardown()
    return
  }

  var $ = function (id) { try { return shadow.getElementById(id) } catch (e) { return null } }
  var statusEl = null
  try { statusEl = shadow.querySelector('.status') } catch (e) { statusEl = null }

  // 节奏：窗口一出现就几乎立刻起笔（不再留 1 秒多的空场）
  var WRITE_START = 320, DUR = 360, STAGGER = 285, T_LOGO = 4900, T_FADE = T_LOGO + 1250
  var started = false, finished = false

  function setVersion() {
    var el = $('ver')
    if (!el) return
    var v = META.version ? String(META.version) : ''
    if (v) el.textContent = 'v' + v
  }

  setVersion()

  // ── 跑马灯点阵依次起跑 ──
  var dots = shadow.querySelectorAll('.marquee i')
  for (var i = 0; i < dots.length; i++) dots[i].style.animationDelay = (i * 0.075) + 's'

  // ── 构建路径：每个字母 = 辉光底 + 亮白笔画 + 笔尖 ──
  var glowG = $('glow'), inkG = $('ink'), pensG = $('pens')
  var items = []
  if (glowG && inkG && pensG) {
    for (var j = 0; j < GLYPHS.length; j++) {
      var g = GLYPHS[j]
      var glow = document.createElementNS(NS, 'path')
      glow.setAttribute('d', g.d)
      glow.setAttribute('transform', 'translate(' + g.tx + ',0) scale(' + g.s + ',' + (-g.s) + ')')
      glowG.appendChild(glow)
      var ink = document.createElementNS(NS, 'path')
      ink.setAttribute('d', g.d)
      ink.setAttribute('transform', 'translate(' + g.tx + ',0) scale(' + g.s + ',' + (-g.s) + ')')
      inkG.appendChild(ink)
      var halo = document.createElementNS(NS, 'circle')
      halo.setAttribute('r', 5.5); halo.setAttribute('class', 'pen-halo')
      var pen = document.createElementNS(NS, 'circle')
      pen.setAttribute('r', 2.4); pen.setAttribute('class', 'pen')
      pensG.appendChild(halo); pensG.appendChild(pen)
      items.push({ ink: ink, glow: glow, halo: halo, pen: pen, L: 0, start: WRITE_START + j * STAGGER })
    }
  }

  // 量取路径长度。注意：窗口还隐藏时宿主可能尚未完成布局，getTotalLength() 会返回 0，
  // 这时不能把 dasharray 写成 "0 0"（会整条描边亮出来）。所以只在长度有效时才落样式，
  // 并把「量不到」交给调用方在后续帧里重试。
  function measure() {
    var ok = 0
    for (var k = 0; k < items.length; k++) {
      var it = items[k]
      try {
        it.L = it.ink.getTotalLength()
      } catch (e) { it.L = 0 }
      if (!it.L || !isFinite(it.L)) { it.L = 0; continue }
      ok++
      it.ink.style.strokeDasharray = it.L + ' ' + it.L
      it.ink.style.strokeDashoffset = it.L
      it.glow.style.strokeDasharray = it.L + ' ' + it.L
      it.glow.style.strokeDashoffset = it.L
    }
    return ok
  }

  function fadeOut(after) {
    if (finished) return
    finished = true
    markSeen()
    try { if (host) host.style.transition = 'opacity .42s ease'; host.style.opacity = '0' } catch (e) {}
    setTimeout(function () { teardown(); if (typeof after === 'function') after() }, 460)
  }

  function animate() {
    if (started || finished || !alive()) return
    started = true
    var t0 = null
    var tries = 0
    var degraded = false
    function frame(ts) {
      if (finished) return
      // 首帧先量长度：此时布局一定已经发生过，量不到就等下一帧再试（最多 ~2 秒）
      if (t0 === null) {
        if (!items.length) { t0 = ts } else {
          var ok = 0
          try { ok = measure() } catch (e) { ok = 0 }
          if (ok === 0) {
            if (tries++ < 120) { requestAnimationFrame(frame); return }
            // 实在量不到：退化成「整体淡入」，至少不出现整条描边的怪样子
            degraded = true
            for (var q = 0; q < items.length; q++) {
              try { items[q].ink.classList.add('done') } catch (e2) {}
            }
          }
          t0 = ts
        }
      }
      var now = ts - t0
      for (var m = 0; m < items.length; m++) {
        var p = items[m]
        if (!p.L) continue
        var t = (now - p.start) / DUR
        if (t < 0) continue
        if (t < 1) {
          var e = 1 - Math.pow(1 - t, 3) // easeOutCubic：起笔快、收笔稳
          p.ink.style.strokeDashoffset = p.L * (1 - e)
          p.glow.style.strokeDashoffset = p.L * (1 - e)
          var pt = p.ink.getPointAtLength(p.L * e)
          p.pen.setAttribute('cx', pt.x); p.pen.setAttribute('cy', pt.y)
          p.halo.setAttribute('cx', pt.x); p.halo.setAttribute('cy', pt.y)
          p.pen.style.opacity = 1; p.halo.style.opacity = 1
        } else if (!p.done) {
          p.done = true
          p.ink.style.strokeDashoffset = 0
          p.glow.style.strokeDashoffset = 0
          p.ink.classList.add('done')
          p.pen.style.opacity = 0; p.halo.style.opacity = 0
        }
      }
      if (now > T_LOGO || degraded) {
        var lg = $('logo'), ul = $('underline'), mq = $('marquee')
        if (lg) lg.classList.add('on')
        if (ul) ul.classList.add('on')
        if (mq) mq.classList.add('dim')
        if (statusEl && statusEl.textContent !== '就绪') statusEl.textContent = '就绪'
      }
      if (now > T_FADE || (degraded && now > 2200)) { fadeOut(); return }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  // ── 起跑时机 ──
  // 越早越好：脚本一落地就排一帧，宿主把窗口显示出来的那一刻 rAF 就会回调 → 立刻起笔。
  // （窗口隐藏时 Chromium 不回调 rAF，所以「等到 rAF」天然等价于「等到真的可见」。）
  var kicked = false
  function kick() {
    if (kicked || finished) return
    kicked = true
    if (alive()) animate(); else fadeOut()
  }

  // 点击行为：默认**不跳过**——加载期间点界面不该让主页面直接跳出来。
  // 只有显式配置 clickToSkip=true 时，点击才收掉画面。
  host.addEventListener('mousedown', function (e) {
    if (CFG.clickToSkip === true) { if (started) fadeOut(); else kick(); return }
    e.preventDefault(); e.stopPropagation()
  }, true)
  host.addEventListener('click', function (e) {
    if (CFG.clickToSkip === true) return
    e.preventDefault(); e.stopPropagation()
  }, true)
  host.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation() }, true)

  requestAnimationFrame(kick)
  try {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') kick()
    })
  } catch (e) {}
  setTimeout(kick, 1500)   // 兜底：rAF 被节流时也不至于一直不开始

  // 硬保险：20 秒后无论动画演到哪都收掉，绝不挡住界面
  setTimeout(function () { fadeOut() }, 20000)
})();
