import fs from 'node:fs'

const asar = 'D:\\deepseek harness\\resources\\app.asar'
const fd = fs.openSync(asar, 'r')
try {
  const head = Buffer.alloc(16)
  const n = fs.readSync(fd, head, 0, 16, 0)
  console.log('header bytes', n, head.readUInt32LE(0), head.readUInt32LE(4), head.readUInt32LE(8), head.readUInt32LE(12))
  const jsonLen = head.readUInt32LE(12)
  const jsonBuf = Buffer.alloc(jsonLen)
  fs.readSync(fd, jsonBuf, 0, jsonLen, 16)
  const dir = JSON.parse(jsonBuf.toString('utf8'))
  const entry = dir.files.lib.files['main.js']
  console.log('entry', entry.offset, entry.size)
  const size = Number(entry.size)
  const offset = 8 + jsonLen + Number(entry.offset)
  console.log('offset', offset, 'size', size, 'stat', fs.fstatSync(fd).size)
  const buf = Buffer.alloc(size)
  const got = fs.readSync(fd, buf, 0, buf.length, offset)
  console.log('read', got, 'has openDshSplash', buf.includes('openDshSplash'))
} catch (err) {
  console.log('ERR', err.code, err.message)
} finally {
  fs.closeSync(fd)
}
