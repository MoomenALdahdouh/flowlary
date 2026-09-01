/**
 * Fresh real-usage corpus. Do not reuse the project demo set
 * (اثممخ / حمثشسث / hello please / comming or not / انا قادم الان).
 *
 * Layout "typed" strings were produced with mapLayoutText from the live
 * en-US-qwerty ↔ ar-101 tables — the glyphs a user actually sees when
 * the OS keyboard is on the wrong layout.
 */

export const LAYOUT_EN_ON_AR = [
  { typed: 'فاشىنس سخ ةعؤا ', expected: /thanks so much/i },
  { typed: 'سثث غخع مشفثق ', expected: /see you later/i },
  { typed: 'لخخي ةخقىهىل ', expected: /good morning/i },
  { typed: 'ةثثفهىل سفشقفس سخخى ', expected: /meeting starts soon/i },
  { typed: 'فخةخققخص ةخقىهىل ', expected: /tomorrow morning/i },
  { typed: 'اشححغ لاهقفايشغ ', expected: /happy birthday/i },
  { typed: 'ؤشمم ةث فخىهلاف ', expected: /call me tonight/i },
] as const

export const LAYOUT_AR_ON_EN = [
  { typed: 'a;vh [.db ', expected: /شكرا جزيلا/ },
  { typed: 'wfhp hgodv ', expected: /صباح الخير/ },
  { typed: 'l,u] y]h ', expected: /موعد غدا/ },
  { typed: 'Hvh; lshx ', expected: /أراك مساء/ },
] as const

/** Local typo map — words that are not the usual hwo/teh/dont demos. */
export const LOCAL_ENGLISH_TYPOS = [
  { typed: 'I will recieve the parcel ', expected: /receive/i },
  { typed: 'Please seperate the files ', expected: /separate/i },
  { typed: 'This is definately ready ', expected: /definitely/i },
  { typed: 'We left becuase it rained ', expected: /because/i },
  { typed: 'The outage occured overnight ', expected: /occurred/i },
  { typed: 'Wait untill Friday ', expected: /until/i },
  { typed: 'She is my freind from school ', expected: /friend/i },
  { typed: 'There is alot of work ', expected: /a lot/i },
] as const

/** Intentional bilingual text that must not be remapped into garbage. */
export const MIXED_PRESERVE = [
  'راجع ملف README بعد الغداء ثم ارفع الـ invoice.',
  'ضع الـ token في env فقط ولا ترسله في Slack.',
  'The العميل asked for a refund on order 88421 today.',
] as const

/** Arabic source for live/shortcut translation — everyday office Arabic. */
export const TRANSLATE_ARABIC = [
  { source: 'أحتاج التقرير النهائي قبل الظهر. ', expectEnglish: /report|need|noon|afternoon|final/i },
  { source: 'هل يمكنك تأكيد الموعد يوم الخميس؟ ', expectEnglish: /confirm|thursday|appointment|meeting/i },
] as const

export const PROTECTED_IN_PROSE =
  'Ship the build to https://status.example.net and ping ops@contoso.test with ORDER-88421. '
