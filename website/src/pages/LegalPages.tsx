import { Link } from 'react-router-dom'
import { CookiesShowcase } from '../components/cookies/CookiesShowcase.tsx'
import { LegalDocument } from '../components/legal/LegalDocument.tsx'
import { LegalPageShell } from '../components/legal/LegalPageShell.tsx'
import { legalLocaleNote, legalPrivacy, legalTerms } from '../content/legal/index.ts'
import { useI18n, useMessages } from '../i18n/index.tsx'

export function PrivacyPage() {
  const t = useMessages()
  const { locale } = useI18n()
  const doc = legalPrivacy(locale)

  return (
    <LegalPageShell
      kicker={t.legal.kicker}
      title={t.legal.privacyTitle}
      titleHighlight={t.legal.privacyTitleHighlight}
      lead={t.legal.privacyLead}
      effectiveIso={doc.effectiveIso}
      effectiveLabel={doc.effectiveLabel}
      effectiveLabelText={t.legal.effective}
    >
      <LegalDocument
        doc={doc}
        localeNote={legalLocaleNote(locale, t.legal.englishControlling, t.legal.arabicControlling)}
        related={[
          { to: '/terms', label: t.nav.terms },
          { to: '/cookies', label: t.nav.cookies },
          { to: '/contact', label: t.nav.contact },
        ]}
      />
    </LegalPageShell>
  )
}

export function TermsPage() {
  const t = useMessages()
  const { locale } = useI18n()
  const doc = legalTerms(locale)

  return (
    <LegalPageShell
      kicker={t.legal.kicker}
      title={t.legal.termsTitle}
      titleHighlight={t.legal.termsTitleHighlight}
      lead={t.legal.termsLead}
      effectiveIso={doc.effectiveIso}
      effectiveLabel={doc.effectiveLabel}
      effectiveLabelText={t.legal.effective}
    >
      <LegalDocument
        doc={doc}
        localeNote={legalLocaleNote(locale, t.legal.englishControlling, t.legal.arabicControlling)}
        related={[
          { to: '/privacy', label: t.nav.privacy },
          { to: '/cookies', label: t.nav.cookies },
          { to: '/contact', label: t.nav.contact },
        ]}
      />
    </LegalPageShell>
  )
}

export function CookiesPage() {
  return <CookiesShowcase />
}

export function PrivacyRelatedLinks() {
  const t = useMessages()
  return (
    <p className="legal-related">
      <Link to="/terms">{t.nav.terms}</Link>
    </p>
  )
}
