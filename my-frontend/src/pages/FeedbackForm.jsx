import { useMemo, useState } from 'react'
import { AGREEMENT_LABELS, EVENT, SPEAKER_QUESTIONS, SPEAKERS } from '../config'
import StarRating from '../components/StarRating.jsx'
import { submitFeedback } from '../lib/api.js'
import { getPublicSiteBase, issueCertificate } from '../lib/certificate.js'

function emptySpeakerAnswers() {
  return {
    ...Object.fromEntries(SPEAKER_QUESTIONS.map((question) => [question.id, 0])),
    comments: '',
  }
}

const emptyForm = {
  fullName: '',
  email: '',
  address: '',
  age: '',
  organization: '',
  speakerAnswers: emptySpeakerAnswers(),
  venueRating: 0,
  venueComment: '',
  seminarRating: 0,
  seminarComments: '',
  consent: false,
}

export default function FeedbackForm({ onIssued }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateSpeakerAnswer(field, value) {
    setForm((current) => ({
      ...current,
      speakerAnswers: {
        ...current.speakerAnswers,
        [field]: value,
      },
    }))
  }

  function goToStep(next) {
    setError('')
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function personalDetailsError() {
    if (!form.fullName.trim() || !form.email.trim()) {
      return 'Name and email are required for your certificate.'
    }
    if (!form.address.trim()) {
      return 'Address is required.'
    }
    if (!form.age) {
      return 'Age is required.'
    }
    const age = Number(form.age)
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      return 'Please enter a valid age.'
    }
    if (!form.organization.trim()) {
      return 'School or organization is required.'
    }
    return ''
  }

  function handleNext(event) {
    event.preventDefault()
    const detailsError = personalDetailsError()
    if (detailsError) {
      setError(detailsError)
      return
    }
    goToStep(2)
  }

  function missingSpeakerAnswer() {
    return SPEAKER_QUESTIONS.some((question) => !form.speakerAnswers[question.id])
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const detailsError = personalDetailsError()
    if (detailsError) {
      setStep(1)
      setError(detailsError)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (missingSpeakerAnswer()) {
      setError('Please answer every general speakers feedback question.')
      return
    }
    if (!form.venueRating || !form.seminarRating) {
      setError('Please complete the ratings for the whole event.')
      return
    }
    if (!form.seminarComments.trim()) {
      setError('Please share comments about the whole event.')
      return
    }
    if (!form.consent) {
      setError('Please confirm that your name can appear on the certificate.')
      return
    }

    setStatus('submitting')
    const certificate = issueCertificate({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
    })
    const savePromise = submitFeedback({
      action: 'submit',
      idempotencyKey,
      certificateId: certificate.id,
      issuedAt: certificate.issuedAt,
      fullName: certificate.fullName,
      email: certificate.email,
      address: form.address.trim(),
      age: Number(form.age),
      organization: form.organization.trim(),
      speakerAnswers: form.speakerAnswers,
      venueRating: form.venueRating,
      venueComment: form.venueComment.trim(),
      speakersOverall: form.speakerAnswers.overall,
      seminarRating: form.seminarRating,
      seminarComments: form.seminarComments.trim(),
      publicBaseUrl: getPublicSiteBase(),
    })
    onIssued(certificate, savePromise)
  }

  const busy = status === 'submitting'

  return (
    <main className="page">
      <header className="hero-banner">
        <img src={EVENT.banner.src} alt={EVENT.banner.alt} />
      </header>

      <section className="intro">
        <p className="eyebrow">Mind check, kamusta ka?</p>
        <h1>A quiet space for your summit feedback</h1>
        <p className="lede">
          Share how the day felt, then receive your certificate of attendance. Take your time —
          every response helps the next gathering.
        </p>
      </section>

      <form className="card form" onSubmit={step === 1 ? handleNext : handleSubmit}>
        <ol className="form-steps" aria-label="Form progress">
          <li className={step === 1 ? 'current' : 'done'}>Your details</li>
          <li className={step === 2 ? 'current' : ''}>Feedback</li>
        </ol>

        {step === 1 ? (
          <section>
            <h2>Participant</h2>
            <p className="section-copy">
              All personal details are required: full name, email, address, age, and school or
              organization. Speaker and event questions are on the next page.
            </p>
            <div className="field-grid">
              <label>
                Full name (Name to appear on certificate)
                <input
                  value={form.fullName}
                  onChange={(event) => update('fullName', event.target.value)}
                  autoComplete="name"
                  required
                  placeholder="e.g. Juan dela Cruz"
                  maxLength={120}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                  autoComplete="email"
                  required
                  placeholder="cysdo@gmail.com"
                  maxLength={120}
                />
              </label>
              <label className="span-2">
                Address
                <input
                  value={form.address}
                  onChange={(event) => update('address', event.target.value)}
                  autoComplete="street-address"
                  required
                  maxLength={200}
                  placeholder="House/street, barangay, city"
                />
              </label>
              <label>
                Age
                <input
                  type="number"
                  min={1}
                  max={120}
                  step={1}
                  value={form.age}
                  onChange={(event) => update('age', event.target.value)}
                  required
                  placeholder="e.g. 18"
                />
              </label>
              <label>
                School / organization
                <input
                  value={form.organization}
                  onChange={(event) => update('organization', event.target.value)}
                  autoComplete="organization"
                  required
                  placeholder="e.g. Pamantasan ng Cabuyao"
                  maxLength={120}
                />
              </label>
            </div>
          </section>
        ) : (
          <>
            <section>
              <h2>Speakers</h2>
              <p className="section-copy">
                Four guest speakers presented at this summit. Rate the speakers as a group, not
                one by one.
              </p>
              <ul className="speaker-roster">
                {SPEAKERS.map((speaker, index) => (
                  <li key={speaker.id}>
                    <span className="speaker-index">{String(index + 1).padStart(2, '0')}</span>
                    <h3>{speaker.name}</h3>
                    <p className="topic">{speaker.topic}</p>
                  </li>
                ))}
              </ul>
              {SPEAKER_QUESTIONS.map((question) => (
                <label className="question-item" key={question.id}>
                  {question.text}
                  <StarRating
                    name={`speakers-${question.id}`}
                    value={form.speakerAnswers[question.id]}
                    onChange={(value) => updateSpeakerAnswer(question.id, value)}
                    labels={AGREEMENT_LABELS}
                  />
                </label>
              ))}
              <label>
                Comments about the speakers <span className="optional">(optional)</span>
                <textarea
                  value={form.speakerAnswers.comments}
                  onChange={(event) => updateSpeakerAnswer('comments', event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="What stood out, what you learned, or what could improve"
                />
              </label>
            </section>

            <section>
              <h2>Whole event</h2>
              <p className="section-copy">
                Share feedback on the venue and the summit as a whole.
              </p>
              <h3 className="subhead">{EVENT.venueName}</h3>
              <p className="section-copy">Accessibility, comfort, facilities, and overall setting.</p>
              <div className="rating-block">
                <StarRating
                  name="venueRating"
                  value={form.venueRating}
                  onChange={(value) => update('venueRating', value)}
                />
              </div>
              <label>
                Venue comments <span className="optional">(optional)</span>
                <textarea
                  value={form.venueComment}
                  onChange={(event) => update('venueComment', event.target.value)}
                  maxLength={1000}
                  rows={3}
                />
              </label>

              <h3 className="subhead">Entire summit</h3>
              <p className="section-copy">
                Program, organization, and whether this event should continue or change.
              </p>
              <div className="rating-block">
                <StarRating
                  name="seminarRating"
                  value={form.seminarRating}
                  onChange={(value) => update('seminarRating', value)}
                />
              </div>
              <label>
                Comments for the whole event
                <textarea
                  value={form.seminarComments}
                  onChange={(event) => update('seminarComments', event.target.value)}
                  maxLength={2000}
                  rows={5}
                  required
                />
              </label>
            </section>

            <label className="consent">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(event) => update('consent', event.target.checked)}
                required
              />
              I confirm that the name above can appear on my e-certificate.
            </label>
          </>
        )}

        {error ? <p className="error">{error}</p> : null}

        <div className="form-nav">
          {step === 2 ? (
            <button type="button" className="secondary" onClick={() => goToStep(1)} disabled={busy}>
              Back
            </button>
          ) : null}
          {step === 1 ? (
            <button type="submit">Continue to feedback</button>
          ) : (
            <button type="submit" disabled={busy}>
              {busy ? 'Opening certificate…' : 'Submit feedback and get certificate'}
            </button>
          )}
        </div>
        {busy ? <p className="note">Opening your e-certificate…</p> : null}
      </form>

      <footer className="site-footer">
        <img className="partner-logo" src={EVENT.partnerLogo.src} alt={EVENT.partnerLogo.alt} />
        <p>Bagong Cabuyao Mental Health and Wellness Summit</p>
      </footer>
    </main>
  )
}
