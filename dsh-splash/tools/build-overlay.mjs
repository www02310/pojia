// 从 assets/splash.html 生成可注入的 assets/splash-overlay.js
// 用法：node tools/build-overlay.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const html = read('assets/splash.html')

// ── CSS ──
const cssMatch = /<style>([\s\S]*?)<\/style>/i.exec(html)
if (!cssMatch) throw new Error('splash.html 里找不到 <style>')
let css = cssMatch[1]
  .replace(/:root\s*\{/g, ':host {')
  .replace(/html\s*,\s*body\s*\{/g, ':host {')
  .replace(/body::before/g, ':host::before')
// 覆盖层根节点：撑满 + 自己成层
css += `
  :host { display: block; }
  .splash-root { position: absolute; inset: 0; display: block; }
  .stage { position: relative; height: 100%; }
  /* 量到路径长度之前先藏起描边：否则会整条字母轮廓亮出来（0 长虚线段 = 什么都不画） */
  .write .ink path, .write .glow path { stroke-dasharray: 0 100000; }
`

// ── 标记 ──
const bodyMatch = /<body>([\s\S]*?)<script>/i.exec(html)
if (!bodyMatch) throw new Error('splash.html 里找不到 <body>')
let markup = bodyMatch[1].trim()

// logo 内联（覆盖层不联网取文件）
const logoSvg = read('assets/logo.svg')
  .replace(/<\?xml[^>]*\?>/i, '')
  .replace(/\swidth="[^"]*"/i, ' width="22"')
  .replace(/\sheight="[^"]*"/i, ' height="22"')
  .trim()
markup = markup.replace(/<img\s+src="logo\.svg"[^>]*>/i, logoSvg)

if (markup.includes('logo.svg')) throw new Error('logo.svg 没有被内联，检查 splash.html 的 img 标签')

// ── 字形数据 ──
const gStart = html.indexOf('var GLYPHS')
const gEnd = html.indexOf('var WRITE_START')
if (gStart < 0 || gEnd < 0) throw new Error('splash.html 里找不到 GLYPHS / WRITE_START')
const gRaw = html.slice(html.indexOf('[', gStart), html.lastIndexOf(']', gEnd) + 1)
const glyphs = JSON.parse(gRaw) // 顺带校验
if (!Array.isArray(glyphs) || glyphs.length < 10) throw new Error('GLYPHS 数量异常：' + (glyphs && glyphs.length))

// ── 拼装 ──
let src = read('tools/overlay.src.js')
src = src
  .replace('@CSS@', JSON.stringify(css))
  .replace('@MARKUP@', JSON.stringify(markup))
  .replace('@GLYPHS@', JSON.stringify(glyphs))

if (src.includes('@CSS@') || src.includes('@MARKUP@') || src.includes('@GLYPHS@')) {
  throw new Error('占位符未被完全替换')
}

const out = 'assets/splash-overlay.js'
writeFileSync(join(ROOT, out), src, 'utf8')
console.log('[build-overlay] ' + out)
console.log('  css   ' + css.length + ' B')
console.log('  markup ' + markup.length + ' B')
console.log('  glyphs ' + glyphs.length + ' 个 / ' + JSON.stringify(glyphs).length + ' B')
console.log('  total ' + src.length + ' B')
