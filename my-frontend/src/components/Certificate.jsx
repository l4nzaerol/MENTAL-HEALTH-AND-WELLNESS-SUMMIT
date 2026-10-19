import { forwardRef } from 'react'
import { CERT_TEMPLATE_SRC } from '../config'
import { formatCertificateName } from '../lib/certificate'

const Certificate = forwardRef(function Certificate({ certificate, qrDataUrl }, ref) {
  return (
    <article ref={ref} className="certificate">
      <img
        className="certificate-bg"
        src={CERT_TEMPLATE_SRC}
        alt=""
        crossOrigin="anonymous"
      />
      <p className="certificate-name">
        <span className="certificate-name-text">{formatCertificateName(certificate.fullName)}</span>
      </p>
      {qrDataUrl ? (
        <img className="certificate-qr" src={qrDataUrl} alt="Certificate download QR code" />
      ) : (
        <div className="certificate-qr placeholder" />
      )}
    </article>
  )
})

export default Certificate
