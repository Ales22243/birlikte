// Not: Uygulama simgesi artık "S&A" yazılı kalp (16 Ekim 2026, tarayıcıda SVG'den üretildi); bu betik eski düz kalbi üretir, çalıştırmayın.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

function render(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  const top = [0x2a, 0x14, 0x3a], bot = [0x14, 0x0a, 0x20]
  const pinkA = [0xff, 0xb3, 0xc7], pinkB = [0xff, 0x6f, 0x9b]
  const SS = 3
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let cover = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS) / size - 0.5) * 2.9
          const v = -((y + (sy + 0.5) / SS) / size - 0.5) * 2.9 + 0.12
          if (Math.pow(u * u + v * v - 1, 3) - u * u * v * v * v <= 0) cover++
        }
      const a = cover / (SS * SS)
      const bg = mix(top, bot, y / size)
      const hr = mix(pinkA, pinkB, y / size)
      const px = mix(bg, hr, a)
      const o = y * (size * 3 + 1) + 1 + x * 3
      raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}
for (const s of [192, 512]) writeFileSync(`public/icon-${s}.png`, render(s))
