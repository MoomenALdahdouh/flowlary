import type { ContactPageContent, LegalDocumentContent } from './types.ts'

const EFFECTIVE_ISO = '2026-08-30'
const EFFECTIVE_LABEL = '30 August 2026'

export const privacyEn: LegalDocumentContent = {
  effectiveIso: EFFECTIVE_ISO,
  effectiveLabel: EFFECTIVE_LABEL,
  relatedLabel: 'Related:',
  intro: [
    {
      type: 'p',
      text: 'Flowlary is an independent writing companion product. This Privacy Policy describes how information is handled for the Flowlary marketing website (flowlary.com), the Flowlary Chrome extension, and the Flowlary API (api.flowlary.com) when you use managed AI features.',
    },
    {
      type: 'p',
      text: 'This policy is written to match the implemented product. It is not a legal certification and does not claim compliance with every jurisdiction.',
    },
  ],
  sections: [
    {
      id: 'scope',
      title: '1. Scope',
      blocks: [
        {
          type: 'p',
          text: 'This policy covers: (a) the public marketing website and optional account pages; (b) the Flowlary browser extension; and (c) the Flowlary API when the extension or website calls it for authentication, billing, learning sync, or managed AI.',
        },
      ],
    },
    {
      id: 'operator',
      title: '2. Who operates Flowlary',
      blocks: [
        {
          type: 'p',
          text: 'Flowlary is offered as an independent product at flowlary.com. The legal entity name, registered address, and data-protection contact details for the operator are not published in this repository and must be confirmed before treating this page as complete for regulatory filings.',
        },
      ],
    },
    {
      id: 'website',
      title: '3. Website',
      blocks: [
        {
          type: 'p',
          text: 'The marketing website is informational. You may create an account, manage billing when checkout is enabled, use the Writing Lab when signed in, and read product documentation.',
        },
        {
          type: 'ul',
          items: [
            'Theme preference (light or dark) may be stored in your browser so the site remembers your choice.',
            'Locale preference may be stored in your browser when you change language.',
            'Writing Lab AI use may require a per-account consent choice stored locally in your browser before text is sent for correction.',
            'We do not embed a third-party analytics or advertising SDK on this website in the current implementation.',
            'When you start checkout, Paddle (our payment partner) may set cookies or use similar storage on its own domains. Flowlary does not receive your full card number.',
          ],
        },
      ],
    },
    {
      id: 'extension',
      title: '4. Browser extension',
      blocks: [
        {
          type: 'p',
          text: 'The Flowlary extension runs in Chrome (and compatible Chromium browsers). A content script is injected on web pages so Flowlary can read and update text in editable fields when you invoke a feature or when an enabled feature runs after safety checks.',
        },
        {
          type: 'ul',
          items: [
            'Permissions declared: storage, activeTab, and clipboardWrite (for Speed Box copy).',
            'Host permission in release builds: https://api.flowlary.com/* for API calls.',
            'The extension does not declare tabs, scripting, or externally_connectable access.',
            'Flowlary reads focused field text only when a feature runs, not your full browsing history.',
          ],
        },
      ],
    },
    {
      id: 'account',
      title: '5. Account information',
      blocks: [
        {
          type: 'p',
          text: 'If you register, the Flowlary API stores account information needed to authenticate you and apply your plan.',
        },
        {
          type: 'ul',
          items: [
            'Email address and a password verifier (hashed; Flowlary does not store your plain-text password).',
            'Session identifiers: short-lived access tokens and longer-lived refresh tokens tied to device sessions.',
            'Extension install ID linked to your account when you sign in from the extension.',
            'Email verification and password-reset tokens (stored as hashes with expiry).',
            'Plan, trial status, daily AI writing-check counters, and capability flags.',
          ],
        },
      ],
    },
    {
      id: 'writing',
      title: '6. Writing content',
      blocks: [
        {
          type: 'p',
          text: 'Flowlary processes the text you type when you use writing assistance. This is central to the product and is not hidden.',
        },
        {
          type: 'ul',
          items: [
            'Correction: up to the last 2,000 characters of the active field (plus optional short context) are sent to api.flowlary.com when you use writing correction.',
            'Translation: the text you request to translate is sent to api.flowlary.com.',
            'Layout classification fallback: when local keyboard remapping cannot decide, a word and short context may be sent.',
            'Before network features run, Flowlary attempts to block password, OTP, payment, username, email, and URL fields; code editors; excluded sites; and high-risk tokens such as API keys.',
            'Safety heuristics are not perfect. Do not type secrets into fields you ask Flowlary to process.',
          ],
        },
      ],
    },
    {
      id: 'ai',
      title: '7. AI processing',
      blocks: [
        {
          type: 'p',
          text: 'Managed Flowlary AI features require a signed-in account. Text needed for a feature is transmitted from your browser to the Flowlary API over HTTPS, then processed using server-side AI infrastructure.',
        },
        {
          type: 'ul',
          items: [
            'Correction, translation, layout classification, explanation localization (Pro), learning coach narration (Pro), and learning report narration (Pro) may invoke managed AI providers through the backend.',
            'The backend currently routes work to Groq and, for translation, may use Google Cloud Translation when configured.',
            'Flowlary application logs and usage records are designed to store operation metadata (such as model, latency, and credit usage), not the writing text itself.',
            'We do not claim that third-party AI providers never retain data. Their handling is governed by their terms and our agreements with them.',
            'AI output can be wrong or incomplete. You remain responsible for reviewing important text.',
          ],
        },
      ],
    },
    {
      id: 'translation',
      title: '8. Translation',
      blocks: [
        {
          type: 'p',
          text: 'Translation requests include your text, source and target languages, and mode metadata. Routing depends on plan and server configuration: Google Cloud Translation may be used, with optional Groq refinement for some Pro requests. When Google is not configured, Groq may handle translation directly.',
        },
        {
          type: 'p',
          text: 'The server may keep an in-memory translation cache keyed by a hash of normalized text (not plaintext) for up to about one hour to reduce duplicate provider calls.',
        },
      ],
    },
    {
      id: 'learning',
      title: '9. Learning data',
      blocks: [
        {
          type: 'p',
          text: 'When you are signed in, Flowlary records learning signals from accepted corrections and layout fixes to help you track patterns and practice.',
        },
        {
          type: 'ul',
          items: [
            'Locally on your device: learning events, optional sample text, learning profile preferences, and practice session history under account-scoped extension storage.',
            'On Flowlary servers when signed in: learning events with original and corrected snippets (each up to 512 characters), category, action, timestamps, and sample metadata (word count and hash: not the full sample text). Up to 2,000 events per account.',
            'Learning profile and practice session aggregates may sync between your browser and the server.',
            'You can clear learning data locally from extension Settings → Data and delete server-side learning data with DELETE /api/learning/events when signed in.',
            'Pro AI learning coach and report narration send aggregated learning context to managed AI: not your full documents.',
          ],
        },
      ],
    },
    {
      id: 'local',
      title: '10. Local-only processing',
      blocks: [
        {
          type: 'ul',
          items: [
            'Keyboard layout remapping when local mapping is sufficient.',
            'Speed Box layout conversion mode (no network).',
            'Settings, pause state, site exclusions, and UI preferences.',
            'Bounded local activity log (up to 50 entries when privacy rules allow).',
            'AI response cache in extension storage (hashed keys; sensitive content excluded).',
          ],
        },
      ],
    },
    {
      id: 'billing',
      title: '11. Billing and subscriptions',
      blocks: [
        {
          type: 'p',
          text: 'Paid Pro access is handled by Paddle when checkout is enabled. Flowlary stores Paddle customer and subscription identifiers, subscription status, and billing period metadata needed to grant entitlement. Flowlary does not store your payment card number.',
        },
      ],
    },
    {
      id: 'student',
      title: '12. Student verification',
      blocks: [
        {
          type: 'p',
          text: 'The Student program verifies control of an academic email address. It does not verify active enrollment, identity documents, or ongoing student status unless separately stated in product copy.',
        },
        {
          type: 'ul',
          items: [
            'You submit an academic email address that matches accepted academic domains.',
            'A verification link is emailed through the configured SMTP service.',
            'Pending verification stores the academic email and a hashed token on the server.',
            'After confirmation, a student benefit record grants Pro-tier access for 12 months according to the current program rules.',
            'Each academic email reference can be linked to one account.',
          ],
        },
      ],
    },
    {
      id: 'storage',
      title: '13. Cookies and browser storage',
      blocks: [
        {
          type: 'p',
          text: 'Flowlary does not use a site-wide cookie consent banner in the current implementation because we do not run third-party analytics cookies on the marketing site. See the Cookie Policy for details on local storage, extension storage, and payment-partner cookies.',
        },
      ],
    },
    {
      id: 'sharing',
      title: '14. Data sharing',
      blocks: [
        {
          type: 'p',
          text: 'Flowlary does not sell your personal information in the current architecture. Data may be shared only as needed to operate the product:',
        },
        {
          type: 'ul',
          items: [
            'Groq, AI inference for correction, translation, layout classification, and some Pro learning features.',
            'Google Cloud Translation: translation when configured on the server.',
            'Paddle: payment processing and subscription management when you checkout.',
            'SMTP email infrastructure: transactional email (verification, password reset, student verification).',
            'Hosting/infrastructure providers that operate the servers where the API and website run (provider depends on deployment; confirm in operations documentation).',
          ],
        },
      ],
    },
    {
      id: 'security',
      title: '15. Security',
      blocks: [
        {
          type: 'p',
          text: 'Flowlary uses HTTPS for API communication in production release builds. Passwords are stored as password verifiers, not plain text. Session tokens are required for managed AI. We do not claim a specific certification (such as SOC 2 or ISO 27001) unless separately published.',
        },
      ],
    },
    {
      id: 'retention',
      title: '16. Retention',
      blocks: [
        {
          type: 'ul',
          items: [
            'Local extension data remains until you change settings, clear data, or uninstall the extension.',
            'Server account records persist while your account exists.',
            'Usage metadata records are bounded (currently up to 50,000 entries per store, FIFO trimmed).',
            'Learning events on the server are capped at 2,000 per account.',
            'Email verification and password-reset tokens expire and are cleared after use or expiry.',
            'Specific statutory retention periods for billing records have not been defined in this repository.',
          ],
        },
      ],
    },
    {
      id: 'choices',
      title: '17. Your choices and deletion',
      blocks: [
        {
          type: 'ul',
          items: [
            'Pause Flowlary globally or exclude specific sites.',
            'Disable live translation (off by default).',
            'Clear local activity, learning data, or reset all local extension data from Settings → Data.',
            'Delete server-side learning data when signed in (extension sync or API).',
            'Sign out to end the current session; logout removes the server session record.',
            'Uninstall the extension to remove extension-local storage from that browser.',
            'Full account deletion is not implemented as a self-service feature in the current API. Account deletion requests must be handled through operator confirmation when a privacy contact is published.',
          ],
        },
      ],
    },
    {
      id: 'transfers',
      title: '18. International transfers',
      blocks: [
        {
          type: 'p',
          text: 'Flowlary and its subprocessors may process data in countries other than yours. The legal mechanism for international transfers (for example, Standard Contractual Clauses) has not been documented in this repository.',
        },
      ],
    },
    {
      id: 'rights',
      title: '19. Your rights',
      blocks: [
        {
          type: 'p',
          text: 'Depending on where you live, you may have rights to access, correct, delete, or restrict processing of personal data. How to exercise those rights depends on the operator entity and applicable law. Use the Contact page to reach the appropriate channel once published.',
        },
      ],
    },
    {
      id: 'children',
      title: '20. Children',
      blocks: [
        {
          type: 'p',
          text: 'Flowlary is not directed at children. Do not use the product to process children’s personal data if you are not permitted to do so.',
        },
      ],
    },
    {
      id: 'changes',
      title: '21. Changes',
      blocks: [
        {
          type: 'p',
          text: 'We may update this policy as the product changes. The effective date at the top will change when we do. Material changes should appear here before they are relied on for store listings.',
        },
      ],
    },
    {
      id: 'contact',
      title: '22. Contact',
      blocks: [
        {
          type: 'p',
          text: 'Privacy questions: use the Contact page and choose Privacy requests. Product and billing help: Support and Account pages. Do not send passwords, API keys, or payment card numbers.',
        },
      ],
    },
  ],
}

export const termsEn: LegalDocumentContent = {
  effectiveIso: EFFECTIVE_ISO,
  effectiveLabel: EFFECTIVE_LABEL,
  relatedLabel: 'Related:',
  intro: [
    {
      type: 'p',
      text: 'These Terms of Service (“Terms”) govern your use of the Flowlary website (flowlary.com) and the Flowlary Chrome extension. By using Flowlary, you agree to these Terms.',
    },
    {
      type: 'p',
      text: 'These Terms describe the implemented product. They must be reviewed by qualified legal counsel before you treat them as a final contract.',
    },
  ],
  sections: [
    {
      id: 'agreement',
      title: '1. Agreement',
      blocks: [
        {
          type: 'p',
          text: 'If you do not agree to these Terms, do not use the website or extension.',
        },
      ],
    },
    {
      id: 'eligibility',
      title: '2. Eligibility',
      blocks: [
        {
          type: 'p',
          text: 'You must be able to form a binding contract where you live. Minimum age requirements have not been specified in this repository and should be confirmed by the operator.',
        },
      ],
    },
    {
      id: 'product',
      title: '3. The product',
      blocks: [
        {
          type: 'p',
          text: 'Flowlary is a writing companion for Chrome that can correct English writing, translate text, repair keyboard-layout mismatches, and help you learn from recurring writing patterns. Feature availability depends on your plan, extension version, and service availability.',
        },
      ],
    },
    {
      id: 'accounts',
      title: '4. Accounts',
      blocks: [
        {
          type: 'ul',
          items: [
            'You may register with email and password on the website or extension.',
            'You are responsible for keeping your credentials secure.',
            'The same account can be used on the website and extension.',
            'Email verification may be required before checkout or certain features.',
          ],
        },
      ],
    },
    {
      id: 'free',
      title: '5. Free plan',
      blocks: [
        {
          type: 'p',
          text: 'The Free plan includes local tools (such as keyboard layout repair and Speed Box) and a daily allowance of managed AI writing checks (currently 500 per day). Limits may change; the Pricing page reflects current values.',
        },
      ],
    },
    {
      id: 'trial',
      title: '6. Trial',
      blocks: [
        {
          type: 'p',
          text: 'New accounts may receive a Trial with higher daily AI writing checks (currently 1,000 per day) for 30 days without requiring a payment card. When Trial ends, your account returns to Free unless you subscribe to Pro.',
        },
      ],
    },
    {
      id: 'pro',
      title: '7. Pro subscription',
      blocks: [
        {
          type: 'p',
          text: 'Pro provides higher daily AI writing checks (currently 1,000 per day) and additional learning capabilities. Pro is billed at $4.99/month or $39/year when checkout is enabled. Pro access is granted only after server-side billing verification: completing checkout alone does not instantly grant Pro if verification is pending.',
        },
      ],
    },
    {
      id: 'student',
      title: '8. Student program',
      blocks: [
        {
          type: 'p',
          text: 'Eligible users may receive a Student benefit by verifying an academic email address. Verification confirms control of that email, not active enrollment or identity. The benefit lasts 12 months under current program rules and may be revoked if misused.',
        },
      ],
    },
    {
      id: 'billing',
      title: '9. Billing',
      blocks: [
        {
          type: 'ul',
          items: [
            'Payments are processed by Paddle when checkout is enabled.',
            'Flowlary does not store your payment card number.',
            'Subscription management and invoices are handled through Paddle’s customer portal when linked.',
            'Prices shown on the website are authoritative; client-side amounts are validated server-side.',
          ],
        },
      ],
    },
    {
      id: 'cancellation',
      title: '10. Cancellation',
      blocks: [
        {
          type: 'p',
          text: 'You may cancel Pro through the billing portal when available. If cancellation is scheduled for the end of the current billing period, Pro remains until that period ends.',
        },
      ],
    },
    {
      id: 'refunds',
      title: '11. Refunds',
      blocks: [
        {
          type: 'p',
          text: 'Refund rights depend on Paddle’s policies, applicable consumer law, and operator policy. A dedicated refund policy has not been published in this repository.',
        },
      ],
    },
    {
      id: 'limits',
      title: '12. Usage limits',
      blocks: [
        {
          type: 'p',
          text: 'AI writing checks, rate limits, and capability gates apply by plan. When daily checks are exhausted, managed AI features pause until the daily reset (00:00 UTC). Local tools continue.',
        },
      ],
    },
    {
      id: 'ai-output',
      title: '13. AI-generated output',
      blocks: [
        {
          type: 'p',
          text: 'Corrections, translations, and AI narrations are machine-generated and may be wrong, incomplete, or inappropriate. Flowlary is not professional legal, medical, or certified translation advice. You are responsible for text you send and publish.',
        },
      ],
    },
    {
      id: 'content',
      title: '14. Your content',
      blocks: [
        {
          type: 'p',
          text: 'You retain rights in writing you create. You grant Flowlary only the limited processing needed to provide features you invoke.',
        },
      ],
    },
    {
      id: 'prohibited',
      title: '15. Prohibited use',
      blocks: [
        {
          type: 'ul',
          items: [
            'Do not use Flowlary to process secrets, payment data, or information you are not allowed to share with a writing tool.',
            'Do not attempt to overload, probe, or disrupt api.flowlary.com.',
            'Do not misuse the Student program with non-academic emails or shared academic identities.',
            'Do not reverse-engineer or interfere with the service except as permitted by law.',
          ],
        },
      ],
    },
    {
      id: 'ip',
      title: '16. Intellectual property',
      blocks: [
        {
          type: 'p',
          text: 'Flowlary’s website, extension, branding, and documentation are protected by applicable intellectual property laws. Third-party marks (such as Chrome and Paddle) belong to their owners.',
        },
      ],
    },
    {
      id: 'third-parties',
      title: '17. Third-party services',
      blocks: [
        {
          type: 'p',
          text: 'Flowlary relies on third-party providers for AI, translation, email, payments, and hosting. Your use of those features may be subject to additional provider terms.',
        },
      ],
    },
    {
      id: 'availability',
      title: '18. Service availability',
      blocks: [
        {
          type: 'p',
          text: 'The website, API, and managed AI may be unavailable, slow, or change without notice. Beta or experimental features may behave differently from documented behavior.',
        },
      ],
    },
    {
      id: 'disclaimers',
      title: '19. Disclaimers',
      blocks: [
        {
          type: 'p',
          text: 'To the extent permitted by law, Flowlary is provided “as is” without warranties of any kind, including uninterrupted service or error-free AI output. Mandatory consumer rights in your country are not excluded where they cannot be waived.',
        },
      ],
    },
    {
      id: 'liability',
      title: '20. Limitation of liability',
      blocks: [
        {
          type: 'p',
          text: 'To the extent permitted by law, Flowlary is not liable for indirect, incidental, or consequential damages arising from use of the product. This limitation does not apply where prohibited by law.',
        },
      ],
    },
    {
      id: 'suspension',
      title: '21. Suspension and termination',
      blocks: [
        {
          type: 'p',
          text: 'We may suspend or terminate access for violation of these Terms, abuse, non-payment, or operational reasons. You may stop using Flowlary at any time by uninstalling the extension and ceasing use of the website.',
        },
      ],
    },
    {
      id: 'law',
      title: '22. Governing law',
      blocks: [
        {
          type: 'p',
          text: 'Governing law and venue are not specified in this version because the operating legal entity has not been confirmed in this repository.',
        },
      ],
    },
    {
      id: 'changes',
      title: '23. Changes',
      blocks: [
        {
          type: 'p',
          text: 'We may update these Terms. Continued use after the effective date of an update constitutes acceptance, except where local law requires additional notice or consent.',
        },
      ],
    },
    {
      id: 'contact',
      title: '24. Contact',
      blocks: [
        {
          type: 'p',
          text: 'Use the Contact page for support routing. Privacy questions are covered in the Privacy Policy.',
        },
      ],
    },
  ],
}

export const cookiesEn: LegalDocumentContent = {
  effectiveIso: EFFECTIVE_ISO,
  effectiveLabel: EFFECTIVE_LABEL,
  relatedLabel: 'Related:',
  intro: [
    {
      type: 'p',
      text: 'This page explains how Flowlary uses cookies and similar browser storage. Flowlary does not run third-party analytics cookies on the marketing website in the current implementation.',
    },
  ],
  sections: [
    {
      id: 'needed',
      title: '1. Is a separate cookie policy needed?',
      blocks: [
        {
          type: 'p',
          text: 'Flowlary uses essential browser storage for preferences and product function. We also describe extension storage here because store listings and privacy disclosures reference it. We do not show a cookie consent banner today because we do not use non-essential tracking cookies on the marketing site.',
        },
      ],
    },
    {
      id: 'website-storage',
      title: '2. Website storage',
      blocks: [
        {
          type: 'ul',
          items: [
            'flowlary-theme: remembers light or dark appearance.',
            'flowlary-locale: remembers your language choice when you change it.',
            'flowlary.web.account.{id}.ai.consent: stores your Writing Lab AI consent choice per account in localStorage.',
          ],
        },
      ],
    },
    {
      id: 'extension-storage',
      title: '3. Extension storage',
      blocks: [
        {
          type: 'p',
          text: 'The extension uses chrome.storage.local (not HTTP cookies) for settings, auth tokens, learning data, caches, and usage state. See the Privacy Policy for details.',
        },
      ],
    },
    {
      id: 'payment',
      title: '4. Payment partner cookies',
      blocks: [
        {
          type: 'p',
          text: 'When you open Paddle checkout or the customer portal, Paddle may set cookies or use similar technologies on its domains to process payments and prevent fraud. Flowlary does not control Paddle’s cookies.',
        },
      ],
    },
    {
      id: 'control',
      title: '5. Your controls',
      blocks: [
        {
          type: 'ul',
          items: [
            'Clear site data in your browser to reset theme and locale preferences.',
            'Clear extension data or uninstall the extension to reset extension storage.',
            'Use browser settings to block third-party cookies; checkout may require allowing Paddle domains.',
          ],
        },
      ],
    },
    {
      id: 'contact',
      title: '6. Contact',
      blocks: [
        {
          type: 'p',
          text: 'Questions about storage or privacy: Contact page → Privacy requests, or read the Privacy Policy.',
        },
      ],
    },
  ],
}

export const contactEn: ContactPageContent = {
  title: 'Contact Flowlary',
  lead: 'Choose the path that matches your question. Flowlary routes help by topic so you get the right information without exposing sensitive data.',
  note: 'Use the Contact page for privacy and legal requests. For product help, open Support or your account support requests page.',
  channels: [
    {
      id: 'getting-started',
      title: 'Getting started and installation',
      body: 'Install steps, first-run setup, and Chrome extension basics.',
      href: '/support#get-flowlary',
      linkLabel: 'Open installation help',
    },
    {
      id: 'product',
      title: 'Writing, translation, and tools',
      body: 'Correction, translation, keyboard layout, Speed Box, and AI usage limits.',
      href: '/support#writing-correction',
      linkLabel: 'Browse feature help',
    },
    {
      id: 'account',
      title: 'Account and sign-in',
      body: 'Registration, email verification, password reset, and extension sync.',
      href: '/account',
      linkLabel: 'Go to account',
    },
    {
      id: 'billing',
      title: 'Billing and Pro',
      body: 'Plans, Trial, Pro pricing, checkout, and subscription management when enabled.',
      href: '/pricing',
      linkLabel: 'View pricing and billing',
    },
    {
      id: 'student',
      title: 'Student program',
      body: 'Academic email verification and Student benefit rules.',
      href: '/pricing#students',
      linkLabel: 'Student program details',
    },
    {
      id: 'privacy',
      title: 'Privacy requests',
      body: 'How Flowlary handles writing text, learning data, and third-party processing.',
      href: '/privacy',
      linkLabel: 'Read privacy policy',
    },
    {
      id: 'legal',
      title: 'Legal and terms',
      body: 'Terms of Service, acceptable use, and commercial terms.',
      href: '/terms',
      linkLabel: 'Read terms of service',
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      body: 'Common issues, limits, and what to try next.',
      href: '/support#troubleshooting',
      linkLabel: 'Common issues',
    },
  ],
  safetyTitle: 'Please do not send',
  safetyItems: [
    'Passwords or one-time codes',
    'Payment card numbers',
    'Private API keys or Groq keys',
    'Full documents you are not comfortable sharing with a writing tool',
  ],
}
