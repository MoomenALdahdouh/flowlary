export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }

export type LegalSection = {
  id: string
  title: string
  blocks: LegalBlock[]
}

export type LegalDocumentContent = {
  effectiveIso: string
  effectiveLabel: string
  intro: LegalBlock[]
  sections: LegalSection[]
  relatedLabel: string
}

export type ContactChannel = {
  id: string
  title: string
  body: string
  href: string
  linkLabel: string
}

export type ContactPageContent = {
  title: string
  lead: string
  note: string
  channels: ContactChannel[]
  safetyTitle: string
  safetyItems: string[]
}
