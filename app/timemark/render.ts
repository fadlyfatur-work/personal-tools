export type Settings = {
  date: string; time: string; address: string; id: string; language: string;
  scale: number; x: number; y: number; logoSize: number; logoX: number; logoY: number;
  accent: string; text: string; opacity: number; vertical: boolean; hour12: boolean;
}

export function dimensions(photo: HTMLImageElement, rotation: number) {
  return rotation % 180 ? [photo.naturalHeight, photo.naturalWidth] : [photo.naturalWidth, photo.naturalHeight]
}

export function draw(canvas: HTMLCanvasElement, photo: HTMLImageElement, logo: HTMLImageElement | null, rotation: number, s: Settings, original = false, maxSize = Infinity) {
  const [width, height] = dimensions(photo, rotation)
  const ratio = Math.min(1, maxSize / Math.max(width, height))
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
  const c = canvas.getContext('2d')!
  c.scale(ratio, ratio)
  c.fillStyle = '#fff'; c.fillRect(0, 0, width, height)
  c.save(); c.translate(width / 2, height / 2); c.rotate(rotation * Math.PI / 180)
  c.drawImage(photo, -photo.naturalWidth / 2, -photo.naturalHeight / 2); c.restore()
  if (original) return
  const unit = Math.min(width, height) / 1200
  const margin = unit * 28
  if (logo) {
    const side = Math.min(width, height) * s.logoSize / 100
    const fit = side / Math.max(logo.naturalWidth, logo.naturalHeight)
    const lw = logo.naturalWidth * fit, lh = logo.naturalHeight * fit
    c.drawImage(logo, margin + (width - lw - margin * 2) * s.logoX / 100, margin + (height - lh - margin * 2) * s.logoY / 100, lw, lh)
  }
  const landscape = width > height
  const blockWidth = Math.min(width - margin * 2, (landscape ? width * .72 : width * .88))
  const font = 42
  let u = unit * s.scale / 100
  const lines: string[] = []
  c.font = `${font * u}px Arial`
  for (const paragraph of s.address.split('\n')) {
    let line = ''
    for (const char of paragraph) {
      if (line && c.measureText(line + char).width > Math.min(blockWidth, 1060 * u) - 50 * u) { lines.push(line.trim()); line = '' }
      line += char
    }
    lines.push(line.trim())
  }
  const blockHeight = 305 + lines.length * 53
  u = Math.min(u, (height * .68) / blockHeight)
  const bw = Math.min(blockWidth, 1060 * u)
  const bh = blockHeight * u
  const x = margin + Math.max(0, width - bw - margin * 2) * s.x / 100
  const y = margin + Math.max(0, height - bh - margin * 2) * s.y / 100
  c.save(); c.translate(x, y); c.scale(u, u)
  c.fillStyle = `rgba(15,24,28,${s.opacity / 100})`
  c.beginPath(); c.roundRect(0, 0, s.hour12 ? 455 : 335, 118, 12); c.fill()
  const [hours, minutes] = s.time.split(':')
  const h = Number(hours)
  const time = s.hour12 ? `${h % 12 || 12}:${minutes || '00'} ${h >= 12 ? 'PM' : 'AM'}` : s.time || '--:--'
  c.fillStyle = '#dceacb'; c.font = '76px "Arial Narrow", Arial'; c.fillText(time, 22, 88, s.hour12 ? 350 : 240)
  c.save(); c.translate(s.hour12 ? 400 : 287, 50); c.fillStyle = '#13bb68'
  c.beginPath(); c.arc(0, 0, 22, Math.PI, 0); c.quadraticCurveTo(25, 17, 0, 47); c.quadraticCurveTo(-25, 17, -22, 0); c.fill()
  c.fillStyle = '#152126'; c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * 2); c.fill(); c.restore()
  c.fillStyle = s.accent; c.fillRect(0, 158, 8, blockHeight - 158)
  c.fillStyle = s.text; c.shadowColor = '#000'; c.shadowBlur = 4; c.shadowOffsetY = 1
  c.font = `${font}px Arial`
  const date = s.date ? new Date(`${s.date}T12:00:00`) : null
  const dateText = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(s.language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Pilih tanggal'
  c.fillText(dateText, 34, 207, bw / u - 40)
  lines.forEach((line, i) => c.fillText(line, 34, 286 + i * 53, bw / u - 40))
  c.font = '30px Arial'; c.fillText(`ID Foto: ${s.id}`, 34, blockHeight - 8, bw / u - 40)
  c.restore()
  if (s.vertical && s.id) {
    c.save(); c.translate(width - margin / 2, height * .6); c.rotate(-Math.PI / 2)
    c.font = `${unit * 23}px Arial`; c.fillStyle = s.text; c.shadowColor = '#000'; c.shadowBlur = unit * 3
    c.fillText(s.id, 0, 0, height * .5); c.restore()
  }
}
