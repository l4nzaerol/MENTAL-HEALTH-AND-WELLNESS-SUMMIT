import { useEffect, useState } from 'react'
import FeedbackForm from './pages/FeedbackForm.jsx'
import CertificatePage from './pages/CertificatePage.jsx'
import {
  certificatePath,
  parseCertificateLocation,
  rememberCertificate,
  siteBasePath,
} from './lib/certificate.js'
import './App.css'

function readRoute() {
  return parseCertificateLocation(window.location.search, window.location.hash, window.location.pathname)
}

function formHomePath() {
  return siteBasePath() || '/'
}

function openCertificate(certificate) {
  const next = {
    ...certificate,
  }
  rememberCertificate(next)
  const nextUrl = certificatePath(next)
  const current = `${window.location.pathname}${window.location.search}`
  if (current !== nextUrl) {
    window.history.pushState({ cert: next.id, access: 'issued' }, '', nextUrl)
  }
  return next
}

export default function App() {
  const [route, setRoute] = useState(() => readRoute())
  const [issued, setIssued] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    const onRouteChange = () => {
      const next = readRoute()
      setRoute(next)
      if (next.name !== 'certificate') {
        setIssued(null)
        setSaveStatus('idle')
        setSaveError('')
      }
    }
    window.addEventListener('popstate', onRouteChange)
    window.addEventListener('hashchange', onRouteChange)
    return () => {
      window.removeEventListener('popstate', onRouteChange)
      window.removeEventListener('hashchange', onRouteChange)
    }
  }, [])

  function handleIssued(certificate, savePromise) {
    const next = openCertificate(certificate)
    setIssued(next)
    setRoute({ ...readRoute(), access: 'issued' })
    if (!savePromise) return
    setSaveStatus('saving')
    setSaveError('')
    savePromise
      .then((result) => {
        if (!result?.ok || !result.certificate) {
          throw new Error(result?.error || 'Could not save your feedback.')
        }
        const saved = openCertificate(result.certificate)
        setIssued(saved)
        setRoute({ ...readRoute(), access: 'issued' })
        setSaveStatus('saved')
      })
      .catch((error) => {
        setSaveStatus('error')
        setSaveError(error.message || 'Could not save your feedback. Please try again.')
      })
  }

  function goHome() {
    window.history.pushState({}, '', formHomePath())
    setIssued(null)
    setSaveStatus('idle')
    setSaveError('')
    setRoute({ name: 'form', id: null, preview: null, access: 'form' })
  }

  if (route.name === 'certificate') {
    const preview =
      issued && issued.id === route.id
        ? issued
        : route.preview && route.preview.id === route.id
          ? route.preview
          : null
    const fromForm = Boolean(issued && issued.id === route.id)
    return (
      <CertificatePage
        certId={route.id}
        preview={preview}
        fromForm={fromForm}
        saveStatus={fromForm ? saveStatus : 'idle'}
        saveError={fromForm ? saveError : ''}
        onBack={fromForm ? goHome : null}
      />
    )
  }

  return <FeedbackForm onIssued={handleIssued} />
}
