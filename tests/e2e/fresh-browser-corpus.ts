/**
 * Independent browser corpus (2026-09-01).
 * Not the demo set (اثممخ / hello please) and not real-usage-examples.ts.
 * Layout "typed" values come from mapLayoutText(en-US-qwerty ↔ ar-101).
 */

export const LAYOUT_EN_TYPED_ON_AR = [
  { typed: 'صثثنثىي حمشىس مخخن لخخي ', expected: /weekend plans look good/i },
  { typed: 'بخقلخف ةغ حشسسصخقي ', expected: /forgot my password/i },
  { typed: 'معىؤا هس شف ىخخى ', expected: /lunch is at noon/i },
  { typed: 'صاثقث هس فاث شهقحخقف ', expected: /where is the airport/i },
] as const

export const LAYOUT_AR_TYPED_ON_EN = [
  { typed: "Hdk hgl'hv ", expected: /أين المطار/ },
  { typed: 'a;vh gglshu]m ', expected: /شكرا للمساعدة/ },
  { typed: 'Ygn hggrhx ', expected: /إلى اللقاء/ },
  { typed: ';l hgshum ', expected: /كم الساعة/ },
] as const

export const ENGLISH_WRITING_ERRORS = [
  { typed: 'I told thier manager already ', expected: /their/i },
  { typed: 'waht time should we leave ', expected: /what/i },
  { typed: 'Come wiht the spare keys ', expected: /with/i },
  { typed: 'youre late for the briefing ', expected: /you.re/i },
  { typed: 'They didnt close the ticket ', expected: /didn.t/i },
  { typed: 'The lighting looks wierd tonight ', expected: /weird/i },
  { typed: 'This door doesnt latch ', expected: /doesn.t/i },
] as const

export const MIXED_LEAVE_ALONE = [
  'ارفع الـ changelog قبل الـ release.',
  'The محاسب wants the spreadsheet tonight.',
  'ضع الـ webhook على staging فقط.',
] as const

export const TRANSLATE_OFFICE_AR = [
  { source: 'الرجاء إرسال الفاتورة اليوم. ', expectEnglish: /invoice|send|today|please|bill/i },
  { source: 'سأتأخر عن الاجتماع نصف ساعة. ', expectEnglish: /late|meeting|hour|half|delay/i },
] as const

export const PROTECTED_PROSE =
  'Ping billing@northwind.test and open https://pay.northwind.test/invoices/992 after SKU-44108. '
