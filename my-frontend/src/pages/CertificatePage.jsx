import { useEffect, useMemo, useRef, useState } from 'react'
import Certificate from '../components/Certificate.jsx'
import { EVENT } from '../config'
import { lookupCertificate } from '../lib/api.js'
import {
  certificateQrUrl,
  downloadBlob,
  makeQrDataUrl,
  recallCertificate,
  rememberCertificate,
  renderCertificatePng,
} from '../lib/certificate.js'

export default function CertificatePage({
  certId,
  preview,
  fromForm = false,
  saveStatus,
  saveError,
  onBack,
}) {
  const [lookedUp, setLookedUp] = useState(null)
  const [lookupStatus, setLookupStatus] = useState('idle')

  const certificate = useMemo(() => {
    if (preview?.fullName) return preview
    if (lookedUp?.fullName && lookedUp.id === certId) return lookedUp
    const cached = recallCertificate(certId)
    if (cached?.fullName) return cached
    return preview || lookedUp || cached || (certId ? { id: certId, fullName: '', issuedAt: '' } : null)
  }, [certId, preview, lookedUp])

  const certRef = useRef(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [pngBlob, setPngBlob] = useState(null)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  const canShow = Boolean(certificate?.fullName)
  const viewUrl = certificate?.fullName ? certificateQrUrl(certificate) : ''

  useEffect(() => {
    if (preview?.fullName || !certId) return
    const cached = recallCertificate(certId)
    if (cached?.fullName) return
    let cancelled = false
    setLookupStatus('loading')
    lookupCertificate(certId)
      .then((found) => {
        if (cancelled) return
        if (found?.fullName) {
          rememberCertificate(found)
          setLookedUp(found)
          setLookupStatus('found')
        } else {
          setLookupStatus('missing')
        }
      })
      .catch(() => {
        if (!cancelled) setLookupStatus('missing')
      })
    return () => {
      cancelled = true
    }
  }, [certId, preview])

  useEffect(() => {
    if (!certificate?.fullName || !certificate.id) return
    rememberCertificate({ ...certificate, verifyUrl: viewUrl })
    let cancelled = false
    setPngBlob(null)
    makeQrDataUrl(viewUrl)
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch((qrError) => {
        if (!cancelled) setError(qrError.message)
      })
    return () => {
      cancelled = true
    }
  }, [certificate, viewUrl])

  useEffect(() => {
    if (!certificate?.fullName || !qrDataUrl || !certRef.current) return
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      renderCertificatePng(certRef.current, certificate, qrDataUrl)
        .then((blob) => {
          if (!cancelled) setPngBlob(blob)
        })
        .catch((pngError) => {
          if (!cancelled) setError(pngError.message)
        })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [certificate, qrDataUrl])

  async function handleDownload() {
    if (!certificate?.id) return
    setError('')
    setDownloading(true)
    try {
      const blob =
        pngBlob || (await renderCertificatePng(certRef.current, certificate, qrDataUrl))
      const safeName = String(certificate.fullName || 'certificate')
        .trim()
        .replace(/[^\w]+/g, '-')
        .replace(/^-|-$/g, '')
      downloadBlob(blob, `${certificate.id}-${safeName || 'certificate'}.png`)
    } catch (downloadError) {
      setError(downloadError.message || 'Could not download the PNG. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  if (!canShow) {
    return (
      <main className="page">
        <div className="card">
          <p className="eyebrow">Mental Health Summit</p>
          <h1>{lookupStatus === 'loading' ? 'Opening certificate…' : 'Certificate not found'}</h1>
          <p className="lede">
            {lookupStatus === 'loading'
              ? 'Loading this e-certificate from the summit records.'
              : error ||
                'This link is missing certificate details. Scan the QR code on the e-certificate or submit the feedback form again.'}
          </p>
          {fromForm && onBack ? (
            <button type="button" onClick={onBack}>
              Back to feedback form
            </button>
          ) : null}
        </div>
      </main>
    )
  }

  return (
    <main className="page certificate-page">
      <header className="hero-card compact">
        <p className="eyebrow">BAGONG CABUYAO MENTAL HEALTH AND WELLNESS SUMMIT</p>
        <h1>Certificate of Attendance</h1>
        <p className="lede">
          {fromForm
            ? 'Download a PNG to keep a copy. Scanning the QR code later opens a download-only certificate page.'
            : 'This is the official e-certificate for this mental health and wellnes summit. You can download the PNG copy here.'}
        </p>
        {saveStatus === 'saving' ? (
          <p className="note">Saving your feedback in the background…</p>
        ) : null}
        {saveStatus === 'error' ? (
          <p className="error">
            {saveError || 'Your certificate is ready, but feedback could not be saved. Please submit again.'}
          </p>
        ) : null}
      </header>

      <Certificate ref={certRef} certificate={certificate} qrDataUrl={qrDataUrl} />

      {error ? <p className="error">{error}</p> : null}

      <div className="actions">
        <button type="button" onClick={handleDownload} disabled={downloading || !qrDataUrl}>
          {downloading ? 'Preparing PNG…' : 'Download certificate'}
        </button>
        {fromForm && onBack ? (
          <button type="button" className="secondary" onClick={onBack}>
            Submit another response
          </button>
        ) : null}
      </div>
      <footer className="site-footer">
        <img className="partner-logo" src={EVENT.partnerLogo.src} alt={EVENT.partnerLogo.alt} />
        <p>Bagong Cabuyao Mental Health and Wellness Summit</p>
      </footer>
    </main>
  )
}
