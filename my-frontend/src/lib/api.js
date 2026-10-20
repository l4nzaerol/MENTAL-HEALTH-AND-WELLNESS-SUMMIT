import { APPS_SCRIPT_URL } from '../config'
import { buildCertificateViewUrl, makeCertId } from './certificate.js'

const STORAGE_KEY = 'mhs-submissions-v1'
const MAX_ATTEMPTS = 8

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function writeLocal(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

function toCertificate(row) {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    issuedAt: row.issuedAt,
    verifyUrl: row.verifyUrl,
  }
}

async function submitLocal(payload) {
  const rows = readLocal()
  const email = payload.email.toLowerCase().trim()
  const existing = rows.find((row) => row.email === email)
  if (existing) {
    return { ok: true, duplicate: true, certificate: toCertificate(existing), demo: true }
  }

  const id = payload.certificateId || makeCertId()
  const issuedAt = payload.issuedAt || new Date().toISOString()
  const row = {
    ...payload,
    email,
    id,
    issuedAt,
    verifyUrl: buildCertificateViewUrl({ id, fullName: payload.fullName, issuedAt }),
  }
  rows.push(row)
  writeLocal(rows)
  return { ok: true, duplicate: false, certificate: toCertificate(row), demo: true }
}

function sheetPayload(payload) {
  const answers = payload.speakerAnswers || {}
  return {
    ...payload,
    action: payload.action || 'submit',
    fullName: payload.fullName,
    name: payload.fullName,
    email: payload.email,
    address: payload.address,
    age: payload.age,
    organization: payload.organization,
    school: payload.organization,
    speakerAnswers: answers,
    speakerKnowledge: answers.knowledge,
    speakerClarity: answers.clarity,
    speakerEngaging: answers.engaging,
    speakerExamples: answers.examples,
    speakerParticipation: answers.participation,
    speakerProfessional: answers.professional,
    speakerQuestions: answers.questions,
    speakerOverall: answers.overall,
    speakerComments: answers.comments || '',
    speakersOverall: payload.speakersOverall || answers.overall,
    venueRating: payload.venueRating,
    venueComment: payload.venueComment || '',
    seminarRating: payload.seminarRating,
    seminarComments: payload.seminarComments || '',
  }
}

async function postWithRetry(payload) {
  let lastError = null
  const body = JSON.stringify(sheetPayload(payload))

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        redirect: 'follow',
      })

      if (response.status === 429 || response.status >= 500) {
        throw new Error('busy')
      }

      const data = await response.json()
      if (data.error === 'busy' || data.error === 'lock') {
        throw new Error('busy')
      }
      if (data.error) {
        throw new Error(data.error)
      }
      return data
    } catch (error) {
      lastError = error
      const wait = Math.min(12000, 400 * 2 ** attempt) + Math.floor(Math.random() * 400)
      await sleep(wait)
    }
  }

  throw lastError || new Error('Could not save your feedback. Please try again.')
}

function certificateFromLookup(data, certId) {
  if (!data?.ok || !data.certificate?.fullName) return null
  return {
    id: data.certificate.id || certId,
    fullName: data.certificate.fullName,
    email: data.certificate.email || '',
    issuedAt: data.certificate.issuedAt || '',
    verifyUrl: buildCertificateViewUrl({
      id: data.certificate.id || certId,
      fullName: data.certificate.fullName,
      issuedAt: data.certificate.issuedAt,
    }),
  }
}

export async function lookupCertificate(id) {
  const certId = String(id || '').trim()
  if (!certId) return null

  if (!APPS_SCRIPT_URL) {
    const rows = readLocal()
    const match = rows.find((row) => String(row.id).toLowerCase() === certId.toLowerCase())
    return match ? toCertificate(match) : null
  }

  const data = await postWithRetry({ action: 'lookup', certificateId: certId, id: certId })
  return certificateFromLookup(data, certId)
}

export async function submitFeedback(payload) {
  if (!APPS_SCRIPT_URL) {
    return submitLocal(payload)
  }
  const data = await postWithRetry(payload)
  if (!data?.ok || !data.certificate?.id) {
    throw new Error(data?.error || 'Could not save your feedback to the spreadsheet.')
  }
  return data
}
