import { Link } from 'react-router-dom'
import { PageHero } from '../components/Ui.tsx'
import { LegalDocument } from '../components/legal/LegalDocument.tsx'
import { legalCookies, legalLocaleNote, legalPrivacy, legalTerms } from '../content/legal/index.ts'
import { useI18n, useMessages } from '../i18n/index.tsx'

export function PrivacyPage() {
  const t = useMessages()
  const { locale } = useI18n()
  const doc = legalPrivacy(locale)

  return (
    <>
      <PageHero kicker={t.legal.kicker} title={t.legal.privacyTitle} lead={t.legal.privacyLead} />
      <LegalDocument
        doc={doc}
        localeNote={legalLocaleNote(locale, t.legal.englishControlling, t.legal.arabicControlling)}
        related={[
          { to: '/terms', label: t.nav.terms },
          { to: '/cookies', label: t.nav.cookies },
          { to: '/contact', label: t.nav.contact },
        ]}
      />
    </>
  )
}

export function TermsPage() {
  const t = useMessages()
  const { locale } = useI18n()
  const doc = legalTerms(locale)

  return (
    <>
      <PageHero kicker={t.legal.kicker} title={t.legal.termsTitle} lead={t.legal.termsLead} />
      <LegalDocument
        doc={doc}
        localeNote={legalLocaleNote(locale, t.legal.englishControlling, t.legal.arabicControlling)}
        related={[
          { to: '/privacy', label: t.nav.privacy },
          { to: '/contact', label: t.nav.contact },
        ]}
      />
    </>
  )
}

export function CookiesPage() {
  const t = useMessages()
  const { locale } = useI18n()
  const doc = legalCookies(locale)

  return (
    <>
      <PageHero kicker={t.legal.kicker} title={t.legal.cookiesTitle} lead={t.legal.cookiesLead} />
      <LegalDocument
        doc={doc}
        localeNote={legalLocaleNote(locale, t.legal.englishControlling, t.legal.arabicControlling)}
        related={[
          { to: '/privacy', label: t.nav.privacy },
          { to: '/terms', label: t.nav.terms },
        ]}
      />
    </>
  )
}

export function PrivacyRelatedLinks() {
  const t = useMessages()
  return (
    <p className="legal-related">
      <Link to="/terms">{t.nav.terms}</Link>
    </p>
  )
}
