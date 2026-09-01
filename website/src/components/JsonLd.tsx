import { SITE_NAME, SITE_URL } from '../config.ts'

const GRAPH = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      applicationCategory: 'BrowserApplication',
      operatingSystem: 'Google Chrome',
      url: SITE_URL,
      isAccessibleForFree: true,
      description:
        'Chrome writing companion for English correction, translation, keyboard-layout fixes, and Speed Box.',
      publisher: { '@id': `${SITE_URL}/#organization` },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: 'en',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

export function structuredDataJson(): string {
  return JSON.stringify(GRAPH)
}
