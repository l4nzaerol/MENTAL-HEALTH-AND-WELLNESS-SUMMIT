import { CERT_TEMPLATE_SRC, PUBLIC_BASE_URL } from '../config'

const CACHE_KEY = 'mhs-cert-view-v1'
const CERT_WIDTH = 2000
const CERT_HEIGHT = 1414
const PNG_SCALE = 1

function isLocalHost(value) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(String(value || ''))
}

function isAppsScriptUrl(value) {
  return /script\.google\.com/i.test(String(value || ''))
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '')
}

export function getPublicSiteBase() {
  const env = stripTrailingSlash(PUBLIC_BASE_URL)
  if (env && !isAppsScriptUrl(env)) {
    if (!isLocalHost(env) || (typeof window !== 'undefined' && isLocalHost(window.location.origin))) {
      return env
    }
  }

  if (typeof window !== 'undefined' && !isAppsScriptUrl(window.location.origin)) {
    const basePath = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '')
    return stripTrailingSlash(`${window.location.origin}${basePath}`)
  }

  return env
}

export function formatCertificateName(fullName) {
  return String(fullName || '').trim().toLocaleUpperCase()
}

export function makeCertId() {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  return `MHS-${rand}`
}

export function issueCertificate({ fullName, email, id, issuedAt }) {
  const certificate = {
    id: id || makeCertId(),
    fullName: String(fullName || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    issuedAt: issuedAt || new Date().toISOString(),
  }
  certificate.verifyUrl = buildCertificateViewUrl(certificate)
  return certificate
}

export function siteBasePath() {
  const basePath = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return basePath
}

function certFilePath(id) {
  return `/c/${encodeURIComponent(id || '')}`
}

export function certificatePath({ id, fullName, issuedAt }) {
  const params = new URLSearchParams()
  if (fullName) params.set('n', fullName)
  if (issuedAt) params.set('t', issuedAt)
  const query = params.toString()
  const path = `${siteBasePath()}${certFilePath(id)}`
  return query ? `${path}?${query}` : path
}

export function buildCertificateViewQuery({ id, fullName, issuedAt }) {
  const params = new URLSearchParams()
  if (id) params.set('cert', id)
  if (fullName) params.set('n', fullName)
  if (issuedAt) params.set('t', issuedAt)
  return params.toString()
}

export function buildLocalCertificateHash({ id, fullName, issuedAt }) {
  const params = new URLSearchParams()
  if (fullName) params.set('n', fullName)
  if (issuedAt) params.set('t', issuedAt)
  const query = params.toString()
  const path = certFilePath(id)
  return query ? `${path}?${query}` : path
}

export function buildCertificateViewUrl({ id, fullName, issuedAt }) {
  const base = getPublicSiteBase()
  const path = buildLocalCertificateHash({ id, fullName, issuedAt })
  if (!base) return `${siteBasePath()}${path}`
  return `${base}${path}`
}

export function certificateQrUrl(certificate) {
  return buildCertificateViewUrl(certificate || {})
}

function emptyRoute() {
  return { name: 'form', id: null, preview: null, access: 'form' }
}

function previewFromParams(id, fullName, issuedAt, access = 'scan') {
  if (!id) return emptyRoute()
  return {
    name: 'certificate',
    id,
    access,
    preview: fullName
      ? {
          id,
          fullName,
          email: '',
          issuedAt: issuedAt || '',
          verifyUrl: buildCertificateViewUrl({ id, fullName, issuedAt }),
        }
      : null,
  }
}

function idFromCertPath(pathname) {
  const path = String(pathname || '')
  const match = path.match(/\/c\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : ''
}

export function parseCertificateHash(hash) {
  const raw = String(hash || '').replace(/^#/, '')
  const queryIndex = raw.indexOf('?')
  const path = queryIndex === -1 ? raw : raw.slice(0, queryIndex)
  const query = new URLSearchParams(queryIndex === -1 ? '' : raw.slice(queryIndex + 1))
  const match = path.match(/^\/c\/([^/]+)/)
  if (!match) return emptyRoute()
  return previewFromParams(decodeURIComponent(match[1]), query.get('n') || '', query.get('t') || '', 'scan')
}

export function parseCertificateLocation(search, hash, pathname) {
  const query = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  const pathId = idFromCertPath(pathname)
  const queryId = query.get('cert') || query.get('c') || query.get('id') || ''
  const id = pathId || queryId
  if (id) {
    return previewFromParams(
      id,
      query.get('n') || query.get('name') || '',
      query.get('t') || '',
      'scan',
    )
  }
  return parseCertificateHash(hash)
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function rememberCertificate(certificate) {
  if (!certificate?.id || typeof localStorage === 'undefined') return
  const all = readCache()
  all[certificate.id] = {
    id: certificate.id,
    fullName: certificate.fullName,
    email: certificate.email || '',
    issuedAt: certificate.issuedAt || '',
    verifyUrl: certificate.verifyUrl || buildCertificateViewUrl(certificate),
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(all))
}

export function recallCertificate(id) {
  if (!id || typeof localStorage === 'undefined') return null
  return readCache()[id] || null
}

export function formatIssuedAt(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export async function makeQrDataUrl(text) {
  const QRCode = (await import('qrcode')).default
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: 'M',
    color: { dark: '#1b2744', light: '#ffffff' },
  })
}

let templatePromise

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load certificate artwork'))
    image.src = src
  })
}

function loadTemplate() {
  if (!templatePromise) {
    templatePromise = loadImage(CERT_TEMPLATE_SRC)
  }
  return templatePromise
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/)
  const lines = []
  let line = ''
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  })
  if (line) lines.push(line)
  return lines
}

function boxOnCanvas(el, root) {
  const box = el.getBoundingClientRect()
  return {
    x: ((box.left - root.left) / root.width) * CERT_WIDTH,
    y: ((box.top - root.top) / root.height) * CERT_HEIGHT,
    w: (box.width / root.width) * CERT_WIDTH,
    h: (box.height / root.height) * CERT_HEIGHT,
  }
}

function drawNameFromCss(ctx, certEl, certificate, root) {
  const nameEl = certEl.querySelector('.certificate-name')
  const textEl = certEl.querySelector('.certificate-name-text')
  if (!nameEl) return

  const nameStyle = getComputedStyle(nameEl)
  const textStyle = textEl ? getComputedStyle(textEl) : nameStyle
  const box = boxOnCanvas(nameEl, root)
  const size = parseFloat(nameStyle.fontSize) * (CERT_WIDTH / root.width)
  const letterSpacing = nameStyle.letterSpacing === 'normal' ? 0 : parseFloat(nameStyle.letterSpacing) * (CERT_WIDTH / root.width)
  const font = `${nameStyle.fontStyle} ${nameStyle.fontWeight} ${size}px ${nameStyle.fontFamily}`
  ctx.font = font
  if (letterSpacing) ctx.letterSpacing = `${letterSpacing}px`
  const lines = wrapText(ctx, formatCertificateName(certificate.fullName), box.w)
  const lineHeight = size * (parseFloat(nameStyle.lineHeight) ? parseFloat(nameStyle.lineHeight) / parseFloat(nameStyle.fontSize) : 1.18)
  const startY = box.y + box.h / 2 - ((lines.length - 1) * lineHeight) / 2
  const centerX = box.x + box.w / 2
  const underline = Math.max(1, parseFloat(textStyle.borderBottomWidth) * (CERT_HEIGHT / root.height) || size * 0.045)
  const padX = parseFloat(textStyle.paddingLeft) * (CERT_WIDTH / root.width) || size * 0.2

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = nameStyle.color || '#1b2744'
  ctx.strokeStyle = nameStyle.color || '#1b2744'
  ctx.lineWidth = underline
  ctx.lineCap = 'round'
  lines.forEach((line, index) => {
    const y = startY + index * lineHeight
    ctx.fillText(line, centerX, y)
    const width = ctx.measureText(line).width
    const underlineY = y + size * 0.46
    ctx.beginPath()
    ctx.moveTo(centerX - width / 2 - padX, underlineY)
    ctx.lineTo(centerX + width / 2 + padX, underlineY)
    ctx.stroke()
  })
}

export async function renderCertificatePng(certEl, certificate, qrDataUrl) {
  if (!certEl) {
    throw new Error('Certificate preview is not ready yet.')
  }

  const [template, qrImage] = await Promise.all([
    loadTemplate(),
    qrDataUrl ? loadImage(qrDataUrl) : Promise.resolve(null),
  ])

  const root = certEl.getBoundingClientRect()
  if (!root.width || !root.height) {
    throw new Error('Certificate preview is not ready yet.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = CERT_WIDTH * PNG_SCALE
  canvas.height = CERT_HEIGHT * PNG_SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(PNG_SCALE, PNG_SCALE)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(template, 0, 0, CERT_WIDTH, CERT_HEIGHT)

  drawNameFromCss(ctx, certEl, certificate, root)

  const qrEl = certEl.querySelector('.certificate-qr')
  if (qrImage && qrEl) {
    const qrBox = boxOnCanvas(qrEl, root)
    const qrStyle = getComputedStyle(qrEl)
    const padX = parseFloat(qrStyle.paddingLeft) * (CERT_WIDTH / root.width)
    const padY = parseFloat(qrStyle.paddingTop) * (CERT_HEIGHT / root.height)
    ctx.fillStyle = qrStyle.backgroundColor || '#ffffff'
    ctx.fillRect(qrBox.x, qrBox.y, qrBox.w, qrBox.h)
    ctx.drawImage(
      qrImage,
      qrBox.x + padX,
      qrBox.y + padY,
      Math.max(1, qrBox.w - padX * 2),
      Math.max(1, qrBox.h - padY * 2),
    )
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not create the PNG.'))
          return
        }
        resolve(blob)
      },
      'image/png',
    )
  })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
