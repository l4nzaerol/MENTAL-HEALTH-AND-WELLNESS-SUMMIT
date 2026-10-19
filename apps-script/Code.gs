const SPREADSHEET_ID = '1SLDoqGkR71wf2pnH5qvMxlwUyzKjOkqg9Vv7cL64fc0'
const SHEET_NAME = 'Submissions'
// Live website that shows certificates when a QR code is scanned (no trailing slash).
// Also stored as script property PUBLIC_SITE_URL. The frontend origin from each
// submission is used when this is left blank.
const PUBLIC_SITE_URL = 'https://mental-health-summit.vercel.app'
const SPEAKER_IDS = ['speaker-1', 'speaker-2', 'speaker-3', 'speaker-4']
const SPEAKER_QUESTIONS = [
  { id: 'knowledge', header: 'The guest speakers demonstrated good knowledge of the topic.' },
  { id: 'clarity', header: 'The guest speakers presented the topic clearly and effectively.' },
  { id: 'engaging', header: "The guest speakers were engaging and able to maintain the participants' attention." },
  { id: 'examples', header: 'The guest speakers provided relevant examples and practical insights.' },
  { id: 'participation', header: 'The guest speakers encouraged participation and interaction.' },
  { id: 'professional', header: 'The guest speakers were professional and respectful throughout the seminar.' },
  { id: 'questions', header: 'The guest speakers were able to address questions appropriately.' },
  { id: 'overall', header: "Overall, I am satisfied with the guest speakers' presentations." },
]

const LEGACY_SPEAKER_HEADERS = {
  knowledge: 'Demonstrated good knowledge of the topic',
  clarity: 'Presented the topic clearly and effectively',
  engaging: 'Was engaging and maintained attention',
  examples: 'Provided relevant examples and practical insights',
  participation: 'Encouraged participation and interaction',
  professional: 'Was professional and respectful throughout the seminar',
  questions: 'Addressed questions appropriately',
  overall: 'Overall satisfaction with the presentations',
}

const LEGACY_HEADERS = [
  'Timestamp',
  'CertificateId',
  'FullName',
  'Email',
  'Organization',
  'VenueRating',
  'VenueComment',
  'SpeakersOverall',
  'SpeakerRatings',
  'SeminarRating',
  'SeminarComments',
  'IdempotencyKey',
  'VerifyUrl',
]

function speakerSheetHeader_(id) {
  for (let i = 0; i < SPEAKER_QUESTIONS.length; i += 1) {
    if (SPEAKER_QUESTIONS[i].id === id) return 'Speakers | ' + SPEAKER_QUESTIONS[i].header
  }
  return ''
}

const HEADER_ALIASES = {
  Name: 'FullName',
  'Full Name': 'FullName',
  'Email Address': 'Email',
  School: 'School / organization',
  Organization: 'School / organization',
  'School/Organization': 'School / organization',
  VenueRating: 'Venue | Rating',
  VenueComment: 'Venue | Comments',
  SpeakersOverall: speakerSheetHeader_('overall'),
  'Overall speakers | Rating': speakerSheetHeader_('overall'),
  'Speaker 1 | Overall satisfaction with the presentation': speakerSheetHeader_('overall'),
  'Speakers | Overall satisfaction with the presentations': speakerSheetHeader_('overall'),
  'Speaker 1 | Comments': 'Speakers | Comments',
  SeminarRating: 'Entire summit | Rating',
  SeminarComments: 'Entire summit | Comments',
}

;(function addLegacySpeakerAliases_() {
  for (let q = 0; q < SPEAKER_QUESTIONS.length; q += 1) {
    const id = SPEAKER_QUESTIONS[q].id
    const header = SPEAKER_QUESTIONS[q].header
    const shortHeader = LEGACY_SPEAKER_HEADERS[id]
    HEADER_ALIASES['Speaker 1 | ' + header] = 'Speakers | ' + header
    if (shortHeader) {
      HEADER_ALIASES['Speaker 1 | ' + shortHeader] = 'Speakers | ' + header
      HEADER_ALIASES['Speakers | ' + shortHeader] = 'Speakers | ' + header
    }
  }
})()

function speakerQuestionHeaders_() {
  const headers = []
  for (let q = 0; q < SPEAKER_QUESTIONS.length; q += 1) {
    headers.push('Speakers | ' + SPEAKER_QUESTIONS[q].header)
  }
  headers.push('Speakers | Comments')
  return headers
}

function asRating_(value) {
  if (value === '' || value === null || value === undefined) return ''
  const n = Number(value)
  if (n >= 1 && n <= 5) return n
  return value
}

function generalSpeakerBlock_(payload) {
  const answers = payload.speakerAnswers || {}
  if (
    answers.knowledge ||
    answers.clarity ||
    answers.overall ||
    answers.comments ||
    answers.engaging
  ) {
    return answers
  }
  return answers['speaker-1'] || {}
}

function speakerAnswerValues_(payload) {
  const block = generalSpeakerBlock_(payload)
  const legacyRatings = payload.speakerRatings || {}
  const values = []
  for (let q = 0; q < SPEAKER_QUESTIONS.length; q += 1) {
    let score = block[SPEAKER_QUESTIONS[q].id]
    if (!score && SPEAKER_QUESTIONS[q].id === 'overall') {
      score = payload.speakersOverall || legacyRatings['speaker-1']
    }
    values.push(asRating_(score))
  }
  values.push(block.comments || '')
  return values
}

const HEADERS = [
  'Timestamp',
  'CertificateId',
  'FullName',
  'Email',
  'Address',
  'Age',
  'School / organization',
]
  .concat(speakerQuestionHeaders_())
  .concat([
    'Venue | Rating',
    'Venue | Comments',
    'Entire summit | Rating',
    'Entire summit | Comments',
    'IdempotencyKey',
    'VerifyUrl',
  ])

const EMAIL_INDEX = HEADERS.indexOf('Email')
const CERT_ID_INDEX = HEADERS.indexOf('CertificateId')
const ADDRESS_INDEX = HEADERS.indexOf('Address')
const AGE_INDEX = HEADERS.indexOf('Age')
const ORG_INDEX = HEADERS.indexOf('School / organization')
const VENUE_RATING_INDEX = HEADERS.indexOf('Venue | Rating')
const VENUE_COMMENT_INDEX = HEADERS.indexOf('Venue | Comments')
const SUMMIT_RATING_INDEX = HEADERS.indexOf('Entire summit | Rating')
const SUMMIT_COMMENT_INDEX = HEADERS.indexOf('Entire summit | Comments')
const VERIFY_URL_INDEX = HEADERS.indexOf('VerifyUrl')
const IDEMPOTENCY_INDEX = HEADERS.indexOf('IdempotencyKey')

function doGet(e) {
  const params = (e && e.parameter) || {}
  if (params.action === 'lookup') {
    return lookupCertificateJson_(params)
  }
  if (params.view === 'cert' || params.view === 'certificate' || params.cert || params.id || params.c) {
    return renderPublicCertificate_(params)
  }
  try {
    ensureHeaders_(getSheet_())
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) })
  }
  return json_({
    ok: true,
    service: 'Mental Health Summit feedback',
  })
}

function doPost(e) {
  try {
    const raw = parseJsonBody_(e)
    if (String(raw.action || '').toLowerCase() === 'lookup') {
      return lookupCertificateJson_({
        id: raw.certificateId || raw.id || raw.cert || raw.c,
      })
    }
    const payload = validateSubmission_(raw)
    const result = submitFeedback_(payload)
    return json_(result)
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) })
  }
}

function setupSummitSheet() {
  const sheet = getSheet_()
  realignSheet_(sheet)
}

function repairColumnAlignment() {
  setupSummitSheet()
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() < 1) {
    writeCanonicalLayout_(sheet, [HEADERS])
    return
  }
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS.length)
  const lastRow = sheet.getLastRow()
  const existing = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(function (value) {
      return String(value || '').trim()
    })
  if (!headersMatch_(existing) || dataLooksMisaligned_(sheet, existing)) {
    realignSheet_(sheet)
    return
  }
  trimExtraColumns_(sheet)
  if (lastRow === 1 && lastCol < HEADERS.length) {
    writeCanonicalLayout_(sheet, [HEADERS])
  }
}

function dataLooksMisaligned_(sheet, headers) {
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return isLegacyHeaderRow_(headers)
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS.length, LEGACY_HEADERS.length)
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
  for (let i = 0; i < rows.length; i += 1) {
    if (isEmptyRow_(rows[i])) continue
    if (
      isLegacyDataRow_(rows[i]) ||
      isShiftedMissingAddressAge_(rows[i]) ||
      isAgeStoredInVenueRating_(rows[i]) ||
      hasRatingInMetaColumns_(rows[i])
    ) {
      return true
    }
  }
  return false
}

function realignSheet_(sheet) {
  const needed = HEADERS.length
  if (sheet.getMaxColumns() < needed) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), needed - sheet.getMaxColumns())
  }

  const lastRow = sheet.getLastRow()
  const lastCol = Math.max(sheet.getLastColumn(), needed, LEGACY_HEADERS.length)

  if (lastRow < 1) {
    writeCanonicalLayout_(sheet, [HEADERS])
    return
  }

  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues()
  const existingHeaders = data[0].map(function (value) {
    return String(value || '').trim()
  })

  const out = [HEADERS]
  for (let r = 1; r < data.length; r += 1) {
    const row = data[r]
    if (isEmptyRow_(row)) continue
    out.push(canonicalRowFromExisting_(row, existingHeaders))
  }

  sheet.getRange(1, 1, lastRow, lastCol).clearContent()
  writeCanonicalLayout_(sheet, out)
}

function writeCanonicalLayout_(sheet, rows) {
  const needed = HEADERS.length
  if (sheet.getMaxColumns() < needed) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), needed - sheet.getMaxColumns())
  }
  sheet.getRange(1, 1, rows.length, needed).setValues(rows)
  trimExtraColumns_(sheet)
  formatSheet_(sheet)
}

function trimExtraColumns_(sheet) {
  const extra = sheet.getMaxColumns() - HEADERS.length
  if (extra > 0) sheet.deleteColumns(HEADERS.length + 1, extra)
}

function formatSheet_(sheet) {
  const needed = HEADERS.length
  sheet.setFrozenRows(1)
  sheet.setFrozenColumns(HEADERS.indexOf('School / organization') + 1)
  const headerRange = sheet.getRange(1, 1, 1, needed)
  headerRange.setWrap(true).setFontWeight('bold').setVerticalAlignment('middle')
  sheet.setRowHeight(1, 64)

  for (let i = 0; i < HEADERS.length; i += 1) {
    const header = HEADERS[i]
    if (header === 'Timestamp') sheet.setColumnWidth(i + 1, 160)
    else if (header === 'CertificateId') sheet.setColumnWidth(i + 1, 150)
    else if (header === 'FullName') sheet.setColumnWidth(i + 1, 180)
    else if (header === 'Email') sheet.setColumnWidth(i + 1, 220)
    else if (header === 'Address') sheet.setColumnWidth(i + 1, 220)
    else if (header === 'Age') sheet.setColumnWidth(i + 1, 70)
    else if (header === 'School / organization') sheet.setColumnWidth(i + 1, 180)
    else if (header.indexOf('Comments') !== -1) sheet.setColumnWidth(i + 1, 240)
    else if (header === 'VerifyUrl') sheet.setColumnWidth(i + 1, 220)
    else sheet.setColumnWidth(i + 1, 140)
  }

  const lastRow = Math.max(sheet.getLastRow(), 2)
  sheet.getRange(2, 1, lastRow, needed).setWrap(true).setVerticalAlignment('top')
}

function hasExtraHeaders_(existing) {
  for (let i = HEADERS.length; i < existing.length; i += 1) {
    if (String(existing[i] || '').trim()) return true
  }
  return false
}

function headersMatch_(existing) {
  if (!existing || existing.length < HEADERS.length) return false
  for (let i = 0; i < HEADERS.length; i += 1) {
    if (String(existing[i] || '').trim() !== HEADERS[i]) return false
  }
  return !hasExtraHeaders_(existing)
}

function isEmptyRow_(row) {
  for (let i = 0; i < row.length; i += 1) {
    if (row[i] !== '' && row[i] !== null && row[i] !== undefined) return false
  }
  return true
}

function isLegacyHeaderRow_(headers) {
  const eighth = String(headers[8] || '')
  const fifth = String(headers[4] || '')
  const sixth = String(headers[5] || '')
  if (eighth === 'SpeakerRatings' || (fifth === 'Organization' && sixth === 'VenueRating')) {
    return true
  }
  for (let i = 0; i < headers.length; i += 1) {
    const name = String(headers[i] || '')
    if (/^Speaker [1-4] \|/.test(name) || name.indexOf('Overall speakers') === 0) return true
  }
  return false
}

function lastFilledIndex_(row) {
  for (let i = row.length - 1; i >= 0; i -= 1) {
    if (row[i] !== '' && row[i] !== null && row[i] !== undefined) return i
  }
  return -1
}

function looksLikeEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function looksLikeCert_(value) {
  return /^MHS-/i.test(String(value || '').trim())
}

function looksLikeAge_(value) {
  if (value === '' || value === null || value === undefined) return false
  const n = Number(value)
  return n === Math.floor(n) && n >= 1 && n <= 120
}

function looksLikeRating_(value) {
  const n = Number(value)
  return value !== '' && value !== null && value !== undefined && n >= 1 && n <= 5 && n === Math.floor(n)
}

function looksLikeUrl_(value) {
  const text = String(value || '')
  return text.indexOf('script.google.com') !== -1 || text.indexOf('http') === 0
}

function looksLikeUuid_(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim())
}

function isLegacyDataRow_(row) {
  const ratings = String(row[8] || '').trim()
  if (ratings.charAt(0) === '{' && ratings.indexOf('speaker-') !== -1) return true
  const verify = String(row[12] || '')
  return verify.indexOf('script.google.com') !== -1 && lastFilledIndex_(row) <= LEGACY_HEADERS.length - 1
}

function isShiftedMissingAddressAge_(row) {
  if (!looksLikeCert_(row[CERT_ID_INDEX]) || !looksLikeEmail_(row[EMAIL_INDEX])) return false
  const ageCell = row[AGE_INDEX]
  const orgCell = row[ORG_INDEX]
  const verifyHere = row[VERIFY_URL_INDEX]
  const verifyShifted = row[VERIFY_URL_INDEX - 2]
  const aligned =
    looksLikeAge_(ageCell) &&
    String(orgCell || '').trim() !== '' &&
    !looksLikeRating_(orgCell) &&
    (looksLikeUrl_(verifyHere) || looksLikeUuid_(row[IDEMPOTENCY_INDEX]))
  if (aligned) return false
  if (looksLikeRating_(ageCell) && looksLikeRating_(orgCell)) return true
  if (looksLikeUrl_(verifyShifted) && !looksLikeUrl_(verifyHere)) return true
  if (looksLikeUuid_(row[IDEMPOTENCY_INDEX - 2]) && !looksLikeUuid_(row[IDEMPOTENCY_INDEX])) return true
  return false
}

function isBlank_(value) {
  return value === '' || value === null || value === undefined
}

function isAgeStoredInVenueRating_(row) {
  if (!looksLikeCert_(row[CERT_ID_INDEX]) || !looksLikeEmail_(row[EMAIL_INDEX])) return false
  if (String(row[ADDRESS_INDEX] || '').trim()) return false
  if (looksLikeAge_(row[AGE_INDEX]) && !looksLikeRating_(row[AGE_INDEX])) return false
  if (!String(row[ORG_INDEX] || '').trim()) return false
  return looksLikeAge_(row[VENUE_RATING_INDEX]) && !looksLikeRating_(row[VENUE_RATING_INDEX])
}

function hasRatingInMetaColumns_(row) {
  return looksLikeRating_(row[IDEMPOTENCY_INDEX]) || looksLikeRating_(row[VERIFY_URL_INDEX])
}

function canonicalHeaderName_(name) {
  const trimmed = String(name || '')
    .trim()
    .replace(/\s*\|\s*/g, ' | ')
  return HEADER_ALIASES[trimmed] || trimmed
}

function emptyRecord_() {
  const record = {}
  for (let i = 0; i < HEADERS.length; i += 1) {
    record[HEADERS[i]] = ''
  }
  return record
}

function canonicalRowFromExisting_(row, headers) {
  return recordToCanonicalValues_(inferRecordFromRow_(row, headers))
}

function inferRecordFromRow_(row, headers) {
  if (isLegacyDataRow_(row) || isLegacyHeaderRow_(headers)) {
    return sanitizeRecord_(recordFromLegacyRow_(row))
  }
  if (isAgeStoredInVenueRating_(row)) {
    return sanitizeRecord_(recordFromAgeInVenueColumns_(row))
  }
  if (isShiftedMissingAddressAge_(row)) {
    return sanitizeRecord_(recordFromShiftedAddressAge_(row))
  }

  const record = emptyRecord_()
  for (let i = 0; i < headers.length; i += 1) {
    const canonical = canonicalHeaderName_(headers[i])
    if (!canonical) continue
    if (row[i] === '' || row[i] === null || row[i] === undefined) continue
    record[canonical] = row[i]
  }

  if (!looksLikeEmail_(record.Email) || !looksLikeCert_(record.CertificateId)) {
    const recovered = recoverMisalignedRow_(row)
    if (recovered) return sanitizeRecord_(recovered)
  }

  applyLegacySpeakerRatingsToRecord_(record, record.SpeakerRatings)
  return sanitizeRecord_(record)
}

function recordFromLegacyRow_(row) {
  const record = emptyRecord_()
  for (let i = 0; i < LEGACY_HEADERS.length; i += 1) {
    record[LEGACY_HEADERS[i]] = row[i]
  }
  record.Address = record.Address || ''
  record.Age = record.Age || ''
  record['Venue | Rating'] = record['Venue | Rating'] || record.VenueRating || ''
  record['Venue | Comments'] = record['Venue | Comments'] || record.VenueComment || ''
  record[speakerSheetHeader_('overall')] =
    record[speakerSheetHeader_('overall')] ||
    record['Overall speakers | Rating'] ||
    record.SpeakersOverall ||
    ''
  record['Entire summit | Rating'] = record['Entire summit | Rating'] || record.SeminarRating || ''
  record['Entire summit | Comments'] = record['Entire summit | Comments'] || record.SeminarComments || ''
  applyLegacySpeakerRatingsToRecord_(record, record.SpeakerRatings)
  return record
}

function recordFromAgeInVenueColumns_(row) {
  const record = emptyRecord_()
  record.Timestamp = row[0]
  record.CertificateId = row[1]
  record.FullName = row[2]
  record.Email = row[3]
  record.Address = String(row[ORG_INDEX] || '').trim()
  record.Age = Number(row[VENUE_RATING_INDEX])
  record['School / organization'] = String(row[VENUE_COMMENT_INDEX] || '').trim()

  for (let i = ORG_INDEX + 1; i < VENUE_RATING_INDEX; i += 1) {
    record[HEADERS[i]] = row[i]
  }

  const summitRating = row[SUMMIT_RATING_INDEX]
  const summitComments = row[SUMMIT_COMMENT_INDEX]
  if (looksLikeRating_(summitRating)) record['Entire summit | Rating'] = asRating_(summitRating)
  if (!isBlank_(summitComments) && !looksLikeRating_(summitComments) && !looksLikeUuid_(summitComments)) {
    record['Entire summit | Comments'] = summitComments
  }
  if (looksLikeUuid_(row[IDEMPOTENCY_INDEX])) record.IdempotencyKey = row[IDEMPOTENCY_INDEX]
  if (looksLikeUrl_(row[VERIFY_URL_INDEX])) record.VerifyUrl = row[VERIFY_URL_INDEX]
  return record
}

function sanitizeRecord_(record) {
  const overallHeader = speakerSheetHeader_('overall')
  if (record[overallHeader] === '' || record[overallHeader] == null) {
    record[overallHeader] = record.SpeakersOverall || ''
  }
  if (record['School / organization'] === '' || record['School / organization'] == null) {
    record['School / organization'] = record.Organization || ''
  }
  if (!looksLikeUuid_(record.IdempotencyKey)) record.IdempotencyKey = ''
  if (!looksLikeUrl_(record.VerifyUrl)) record.VerifyUrl = ''
  if (looksLikeRating_(record['Entire summit | Comments'])) record['Entire summit | Comments'] = ''
  if (looksLikeRating_(record['Venue | Comments'])) record['Venue | Comments'] = ''
  applyLegacySpeakerRatingsToRecord_(record, record.SpeakerRatings)
  return record
}

function recordFromShiftedAddressAge_(row) {
  const record = emptyRecord_()
  record.Timestamp = row[0]
  record.CertificateId = row[1]
  record.FullName = row[2]
  record.Email = row[3]
  record.Address = ''
  record.Age = ''
  record['School / organization'] = row[4]
  const restHeaders = HEADERS.slice(ORG_INDEX + 1)
  for (let i = 0; i < restHeaders.length; i += 1) {
    record[restHeaders[i]] = row[5 + i]
  }
  applyLegacySpeakerRatingsToRecord_(record, row[8])
  return record
}

function recoverMisalignedRow_(row) {
  const record = emptyRecord_()
  let foundEmail = false
  let foundCert = false
  for (let i = 0; i < row.length; i += 1) {
    const value = row[i]
    if (!foundCert && looksLikeCert_(value)) {
      record.CertificateId = String(value).trim()
      foundCert = true
      continue
    }
    if (!foundEmail && looksLikeEmail_(value)) {
      record.Email = String(value).trim().toLowerCase()
      foundEmail = true
      continue
    }
    if (!record.VerifyUrl && looksLikeUrl_(value) && String(value).indexOf('script.google.com') !== -1) {
      record.VerifyUrl = String(value).trim()
      continue
    }
    if (!record.IdempotencyKey && looksLikeUuid_(value)) {
      record.IdempotencyKey = String(value).trim()
      continue
    }
    if (!record.Timestamp && value instanceof Date) {
      record.Timestamp = value
    }
  }
  if (looksLikeCert_(row[1]) && looksLikeEmail_(row[3])) {
    record.Timestamp = record.Timestamp || row[0]
    record.CertificateId = row[1]
    record.FullName = row[2]
    record.Email = row[3]
    if (looksLikeAge_(row[5]) && !looksLikeRating_(row[6])) {
      record.Address = row[4]
      record.Age = row[5]
      record['School / organization'] = row[6]
    } else {
      record['School / organization'] = row[4]
    }
  }
  if (!foundEmail && !foundCert) return null
  applyLegacySpeakerRatingsToRecord_(record, row[8])
  return record
}

function recordToCanonicalValues_(record) {
  const values = HEADERS.map(function (header) {
    const value = record[header]
    if (value === 0) return 0
    return value === null || value === undefined ? '' : value
  })

  const mappedLegacy = {
    'Venue | Rating': record.VenueRating,
    'Venue | Comments': record.VenueComment,
    [speakerSheetHeader_('overall')]: record.SpeakersOverall,
    'Entire summit | Rating': record.SeminarRating,
    'Entire summit | Comments': record.SeminarComments,
  }
  Object.keys(mappedLegacy).forEach(function (header) {
    const idx = HEADERS.indexOf(header)
    if (idx >= 0 && (values[idx] === '' || values[idx] == null) && mappedLegacy[header] != null && mappedLegacy[header] !== '') {
      values[idx] = mappedLegacy[header]
    }
  })

  applyLegacySpeakerRatings_(values, record.SpeakerRatings)
  return padRow_(values)
}

function firstLegacySpeakerRating_(parsed) {
  if (!parsed) return ''
  for (let i = 0; i < SPEAKER_IDS.length; i += 1) {
    if (parsed[SPEAKER_IDS[i]]) return parsed[SPEAKER_IDS[i]]
  }
  return ''
}

function applyLegacySpeakerRatingsToRecord_(record, json) {
  const rating = firstLegacySpeakerRating_(parseSpeakerRatings_(json))
  if (!rating) return
  const header = speakerSheetHeader_('overall')
  if (!record[header]) record[header] = rating
}

function applyLegacySpeakerRatings_(values, json) {
  const rating = firstLegacySpeakerRating_(parseSpeakerRatings_(json))
  if (!rating) return
  const header = speakerSheetHeader_('overall')
  const idx = HEADERS.indexOf(header)
  if (idx >= 0 && (values[idx] === '' || values[idx] == null)) {
    values[idx] = rating
  }
}

function parseSpeakerRatings_(json) {
  if (!json) return null
  let parsed = json
  if (typeof json === 'string') {
    const text = json.trim()
    if (!text) return null
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      return null
    }
  }
  if (!parsed || typeof parsed !== 'object') return null
  return parsed
}

function padRow_(row) {
  const next = row.slice()
  while (next.length < HEADERS.length) next.push('')
  return next.slice(0, HEADERS.length)
}

function buildSubmissionRecord_(payload, certId, now, verifyUrl) {
  const record = emptyRecord_()
  record.Timestamp = now
  record.CertificateId = certId
  record.FullName = String(payload.fullName).trim()
  record.Email = String(payload.email).toLowerCase().trim()
  record.Address = String(payload.address).trim()
  record.Age = payload.age
  record['School / organization'] = String(payload.organization).trim()
  record['Venue | Rating'] = asRating_(payload.venueRating)
  record['Venue | Comments'] = payload.venueComment || ''
  record['Entire summit | Rating'] = asRating_(payload.seminarRating)
  record['Entire summit | Comments'] = payload.seminarComments || ''
  record.IdempotencyKey = payload.idempotencyKey || ''
  record.VerifyUrl = verifyUrl

  const answers = speakerAnswerValues_(payload)
  const speakerHeaders = speakerQuestionHeaders_()
  for (let i = 0; i < speakerHeaders.length; i += 1) {
    record[speakerHeaders[i]] = answers[i]
  }
  return record
}

function rowFromRecord_(record, headers) {
  const names = headers && headers.length ? headers : HEADERS
  return names.map(function (header) {
    const key = canonicalHeaderName_(header) || header
    const value = record[key]
    if (value === 0) return 0
    return value === null || value === undefined ? '' : value
  })
}

function sheetHeaderNames_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS.length)
  if (sheet.getLastRow() < 1) return HEADERS.slice()
  return sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(function (value) {
      return String(value || '').trim()
    })
}

function columnForHeader_(headers, name) {
  for (let i = 0; i < headers.length; i += 1) {
    if (canonicalHeaderName_(headers[i]) === name) return i + 1
  }
  const fallback = HEADERS.indexOf(name)
  return fallback >= 0 ? fallback + 1 : 0
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Mental Health Summit')
    .addItem('Setup submissions sheet', 'setupSummitSheet')
    .addItem('Repair column alignment', 'repairColumnAlignment')
    .addToUi()
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Empty request')
  }
  return JSON.parse(e.postData.contents)
}

function parsePayload_(e) {
  return validateSubmission_(parseJsonBody_(e))
}

function validateSubmission_(payload) {
  const next = payload || {}
  const fullName = String(next.fullName || '').trim()
  const email = String(next.email || '').trim()
  const address = String(next.address || '').trim()
  const organization = String(next.organization || '').trim()
  const age = Number(next.age)
  if (!fullName || !email) {
    throw new Error('Name and email are required')
  }
  if (!address) {
    throw new Error('Address is required')
  }
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    throw new Error('Age is required')
  }
  if (!organization) {
    throw new Error('School or organization is required')
  }
  next.fullName = fullName
  next.email = email
  next.address = address
  next.age = age
  next.organization = organization
  return next
}

function submitFeedback_(payload) {
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(25000)) {
    return { ok: false, error: 'lock' }
  }

  try {
    const sheet = getSheet_()
    ensureHeaders_(sheet)
    const headers = sheetHeaderNames_(sheet)
    const emailCol = columnForHeader_(headers, 'Email')
    const idempCol = columnForHeader_(headers, 'IdempotencyKey')
    const email = String(payload.email).toLowerCase().trim()
    const existing = findRow_(sheet, emailCol, email) || findRow_(sheet, idempCol, payload.idempotencyKey)
    if (existing) {
      const certificate = rowToCertificate_(existing, headers)
      certificate.verifyUrl = browserVerifyUrl_(payload, certificate.id, certificate.issuedAt)
      return { ok: true, duplicate: true, certificate: certificate }
    }

    const certId = looksLikeCert_(payload.certificateId)
      ? String(payload.certificateId).trim()
      : generateCertId_()
    const now = payload.issuedAt ? new Date(payload.issuedAt) : new Date()
    const issuedAt = isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString()
    const stamp = isNaN(now.getTime()) ? new Date() : now
    const verifyUrl = browserVerifyUrl_(payload, certId, issuedAt)
    const record = buildSubmissionRecord_(payload, certId, stamp, verifyUrl)
    const row = rowFromRecord_(record, HEADERS)
    const width = HEADERS.length
    if (sheet.getMaxColumns() < width) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns())
    }
    const nextRow = Math.max(sheet.getLastRow() + 1, 2)
    sheet.getRange(nextRow, 1, 1, row.length).setValues([row])
    SpreadsheetApp.flush()

    return {
      ok: true,
      duplicate: false,
      certificate: {
        id: certId,
        fullName: String(payload.fullName).trim(),
        email: email,
        issuedAt: issuedAt,
        verifyUrl: verifyUrl,
      },
    }
  } finally {
    lock.releaseLock()
  }
}

function getSpreadsheet_() {
  const active = SpreadsheetApp.getActive()
  if (active && active.getId() === SPREADSHEET_ID) return active
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID)
  } catch (error) {
    if (active) return active
    throw new Error(
      'Could not open the submissions spreadsheet. Bind this script to https://docs.google.com/spreadsheets/d/' +
        SPREADSHEET_ID +
        '/edit',
    )
  }
}

function getSheet_() {
  const ss = getSpreadsheet_()
  let sheet = ss.getSheetByName(SHEET_NAME)
  if (!sheet) sheet = findSubmissionsSheet_(ss)
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME)
    writeCanonicalLayout_(sheet, [HEADERS])
  }
  return sheet
}

function findSubmissionsSheet_(ss) {
  const sheets = ss.getSheets()
  for (let i = 0; i < sheets.length; i += 1) {
    const candidate = sheets[i]
    if (candidate.getLastRow() < 1 || candidate.getLastColumn() < 1) continue
    const headers = candidate
      .getRange(1, 1, 1, candidate.getLastColumn())
      .getValues()[0]
      .map(function (value) {
        return canonicalHeaderName_(value)
      })
    if (headers.indexOf('CertificateId') !== -1 || headers.indexOf('FullName') !== -1) {
      if (candidate.getName() !== SHEET_NAME) {
        try {
          candidate.setName(SHEET_NAME)
        } catch (error) {
          // Keep the existing tab name if renaming is blocked.
        }
      }
      return candidate
    }
  }
  return sheets.length === 1 ? sheets[0] : null
}

function findRow_(sheet, column, value) {
  if (!value || !column) return null
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return null
  const needle = String(value).toLowerCase()
  const values = sheet.getRange(2, column, lastRow - 1, 1).getValues()
  const width = Math.max(sheet.getLastColumn(), HEADERS.length)
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0]).toLowerCase() === needle) {
      return sheet.getRange(i + 2, 1, 1, width).getValues()[0]
    }
  }
  return null
}

function rowToCertificate_(row, headers) {
  const names = headers && headers.length ? headers : HEADERS
  const issued = row[0] instanceof Date ? row[0].toISOString() : String(row[0] || '')
  return {
    id: String(row[Math.max(columnForHeader_(names, 'CertificateId') - 1, 0)] || ''),
    fullName: String(row[Math.max(columnForHeader_(names, 'FullName') - 1, 0)] || ''),
    email: String(row[Math.max(columnForHeader_(names, 'Email') - 1, 0)] || ''),
    issuedAt: issued,
    verifyUrl: String(row[Math.max(columnForHeader_(names, 'VerifyUrl') - 1, 0)] || ''),
  }
}

function isLocalHost_(value) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(String(value || ''))
}

function isAppsScriptUrl_(value) {
  return /script\.google\.com/i.test(String(value || ''))
}

function publicSiteBase_() {
  const fromConst = String(PUBLIC_SITE_URL || '')
    .trim()
    .replace(/\/$/, '')
  if (fromConst && !isAppsScriptUrl_(fromConst)) return fromConst
  try {
    const fromProps = String(PropertiesService.getScriptProperties().getProperty('PUBLIC_SITE_URL') || '')
      .trim()
      .replace(/\/$/, '')
    if (fromProps && !isAppsScriptUrl_(fromProps)) return fromProps
  } catch (error) {
    // Script properties are optional.
  }
  return ''
}

function siteCertUrl_(base, certId, fullName, issuedAt) {
  const query = []
  if (fullName) query.push('n=' + encodeURIComponent(fullName))
  if (issuedAt) query.push('t=' + encodeURIComponent(issuedAt))
  return (
    String(base || '').replace(/\/$/, '') +
    '/c/' +
    encodeURIComponent(certId || '') +
    (query.length ? '?' + query.join('&') : '')
  )
}

function browserVerifyUrl_(payload, certId, issuedAt) {
  const fromPayload = String(payload.publicBaseUrl || payload.verifyBaseUrl || '')
    .trim()
    .replace(/\/$/, '')
  let base = ''
  if (fromPayload && !isAppsScriptUrl_(fromPayload) && !isLocalHost_(fromPayload)) {
    base = fromPayload
  } else if (publicSiteBase_()) {
    base = publicSiteBase_()
  } else if (fromPayload && !isAppsScriptUrl_(fromPayload)) {
    base = fromPayload
  }
  if (base) return siteCertUrl_(base, certId, payload.fullName, issuedAt)
  const service = String(ScriptApp.getService().getUrl() || '').replace(/\/$/, '')
  return (
    service +
    '?view=cert&id=' +
    encodeURIComponent(certId) +
    '&n=' +
    encodeURIComponent(String(payload.fullName || '')) +
    '&t=' +
    encodeURIComponent(issuedAt || '')
  )
}

function lookupCertificateJson_(params) {
  try {
    const id = String(params.id || params.cert || params.c || '').trim()
    if (!looksLikeCert_(id)) {
      return json_({ ok: false, error: 'Certificate not found' })
    }
    const sheet = getSheet_()
    const headers = sheetHeaderNames_(sheet)
    const idCol = columnForHeader_(headers, 'CertificateId')
    const row = findRow_(sheet, idCol, id)
    if (!row) return json_({ ok: false, error: 'Certificate not found' })
    const certificate = rowToCertificate_(row, headers)
    return json_({
      ok: true,
      certificate: {
        id: certificate.id,
        fullName: certificate.fullName,
        issuedAt: certificate.issuedAt,
      },
    })
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) })
  }
}

function redirectPage_(url) {
  const safeJson = JSON.stringify(String(url || ''))
  const safeText = String(url || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
  return (
    '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta http-equiv="refresh" content="0;url=' +
    safeText +
    '">' +
    '<title>Certificate of participation</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f6f2;color:#143d38;font-family:"Segoe UI",system-ui,sans-serif}p{padding:24px}</style>' +
    '</head><body><p>Opening your certificate…</p>' +
    '<script>location.replace(' +
    safeJson +
    ')</script></body></html>'
  )
}

function renderPublicCertificate_(params) {
  const id = String(params.id || params.c || params.cert || '').trim()
  let fullName = String(params.n || params.name || '').trim()
  let issuedAt = String(params.t || '').trim()
  let storedUrl = ''

  if (id) {
    try {
      const sheet = getSheet_()
      const headers = sheetHeaderNames_(sheet)
      const idCol = columnForHeader_(headers, 'CertificateId')
      const row = findRow_(sheet, idCol, id)
      if (row) {
        const cert = rowToCertificate_(row, headers)
        storedUrl = String(cert.verifyUrl || '')
        if (!fullName) fullName = String(cert.fullName || '').trim()
        if (!issuedAt) issuedAt = String(cert.issuedAt || '').trim()
      }
    } catch (error) {
      // Fall back to the URL parameters when the sheet is unavailable.
    }
  }

  let dest = ''
  if (storedUrl && !isAppsScriptUrl_(storedUrl) && !isLocalHost_(storedUrl)) {
    dest = storedUrl
  } else if (publicSiteBase_()) {
    dest = siteCertUrl_(publicSiteBase_(), id, fullName, issuedAt)
  } else if (fullName) {
    dest = siteCertUrl_(publicSiteBase_() || '', id, fullName, issuedAt)
    if (!publicSiteBase_()) dest = ''
  }

  if (dest) {
    return HtmlService.createHtmlOutput(redirectPage_(dest))
      .setTitle('Certificate of participation')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
  }

  const template = HtmlService.createTemplateFromFile('Certificate')
  template.cert = {
    id: id,
    fullName: fullName,
    issuedAt: issuedAt,
  }
  template.verifyUrl = siteCertUrl_(publicSiteBase_() || ScriptApp.getService().getUrl(), id, fullName, issuedAt)
  template.ok = Boolean(id && fullName)
  template.error = template.ok
    ? ''
    : 'This certificate link is missing a name. Scan the QR code printed on the e-certificate.'
  return template
    .evaluate()
    .setTitle('Certificate of participation')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
}

function generateCertId_() {
  return 'MHS-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase()
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent()
}
