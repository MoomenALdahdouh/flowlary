export type GoldenCase = {
  id: string
  input: string
  group: string
  expect: {
    roles?: string[]
    hasIntent?: string
    hasRole?: string
    forbiddenAction?: string
    action?: string
    hasHypIntent?: string
    notArabizi?: boolean
    arabizi?: boolean
    protected?: boolean
  }
}

export const GOLDEN_INTENT_CASES: GoldenCase[] = [
  { id: 'ar-1', input: 'مرحبا كيف حالك؟', group: 'arabic', expect: { hasRole: 'arabic_prose', forbiddenAction: 'translation' } },
  { id: 'ar-2', input: 'أريد إرسال هذا البريد غدًا.', group: 'arabic', expect: { hasRole: 'arabic_prose' } },
  { id: 'ar-3', input: 'نثغ', group: 'layout', expect: { forbiddenAction: 'english_correction' } },
  { id: 'en-1', input: 'hello how are you', group: 'english', expect: { hasRole: 'english_prose', forbiddenAction: 'layout_fix' } },
  { id: 'en-2', input: 'how i can make this api', group: 'english', expect: { hasRole: 'english_prose' } },
  { id: 'en-3', input: 'design engain', group: 'spelling', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'en-4', input: 'I dont know', group: 'spelling', expect: { hasHypIntent: 'fix_english' } },
  { id: 'mix-1', input: 'أنا عملت deploy لكن فيه error', group: 'mixed', expect: { hasRole: 'arabic_prose' } },
  { id: 'mix-2', input: 'أريد API key من GitHub', group: 'mixed', expect: { hasRole: 'identifier' } },
  { id: 'mix-3', input: 'هذا التصميم جيد جدًا، but I need a small change', group: 'mixed', expect: { hasRole: 'arabic_prose' } },
  { id: 'mix-4', input: 'هل يمكن إصلاح الـ API؟', group: 'mixed', expect: { hasRole: 'identifier' } },
  { id: 'mix-5', input: 'يعني اريد تحسين ui ux', group: 'mixed', expect: { hasRole: 'technical_token' } },
  { id: 'tech-1', input: 'ui ux', group: 'technical', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'tech-2', input: 'UI UX', group: 'technical', expect: { hasRole: 'identifier' } },
  { id: 'tech-3', input: 'API', group: 'technical', expect: { hasRole: 'identifier' } },
  { id: 'tech-4', input: 'Api', group: 'technical', expect: { forbiddenAction: 'english_correction' } },
  { id: 'tech-5', input: 'Python + Laravel', group: 'technical', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'tech-6', input: 'GitHub', group: 'technical', expect: { hasRole: 'identifier' } },
  { id: 'tech-7', input: 'github', group: 'technical', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'tech-8', input: 'GITHUB', group: 'technical', expect: { hasRole: 'identifier' } },
  { id: 'tech-9', input: 'GraphQL', group: 'technical', expect: { hasRole: 'identifier' } },
  { id: 'tech-10', input: 'localhost', group: 'technical', expect: { hasRole: 'technical_token' } },
  { id: 'tech-11', input: 'npm', group: 'technical', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'tech-12', input: 'composer', group: 'technical', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'tech-13', input: 'FastAPI', group: 'technical', expect: { hasRole: 'identifier' } },
  { id: 'tech-14', input: 'PostgreSQL', group: 'technical', expect: { hasRole: 'identifier' } },
  { id: 'tech-15', input: 'SDK', group: 'technical', expect: { hasRole: 'identifier' } },
  { id: 'tech-16', input: 'LLM', group: 'technical', expect: { hasRole: 'identifier' } },
  { id: 'tech-17', input: 'RAG', group: 'technical', expect: { hasRole: 'identifier' } },
  { id: 'tech-18', input: 'deploy', group: 'technical', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'prot-1', input: 'https://example.com/api/v1', group: 'protected', expect: { protected: true, hasRole: 'url' } },
  { id: 'prot-2', input: 'user@example.com', group: 'protected', expect: { hasRole: 'email' } },
  { id: 'prot-3', input: 'file.txt', group: 'protected', expect: { hasRole: 'identifier' } },
  { id: 'prot-4', input: 'userName', group: 'protected', expect: { hasRole: 'identifier' } },
  { id: 'prot-5', input: 'user_name', group: 'protected', expect: { hasRole: 'identifier' } },
  { id: 'prot-6', input: 'v1.2.3', group: 'protected', expect: { hasRole: 'identifier' } },
  { id: 'prot-7', input: 'sk-abcdefghijklmnopqrstuv', group: 'protected', expect: { protected: true } },
  { id: 'arab-1', input: 'mar7aba', group: 'arabizi', expect: { arabizi: true } },
  { id: 'arab-2', input: 'keefak', group: 'arabizi', expect: { forbiddenAction: 'english_correction' } },
  { id: 'arab-3', input: 'inshallah', group: 'arabizi', expect: { forbiddenAction: 'english_correction' } },
  { id: 'arab-4', input: 'shukran', group: 'arabizi', expect: { forbiddenAction: 'english_correction' } },
  { id: 'arab-5', input: 'agent007', group: 'arabizi', expect: { notArabizi: true } },
  { id: 'arab-6', input: 'l33t', group: 'arabizi', expect: { notArabizi: true } },
  { id: 'num-1', input: '123', group: 'numbers', expect: { hasRole: 'number' } },
  { id: 'num-2', input: '2026', group: 'numbers', expect: { hasRole: 'number' } },
  { id: 'num-3', input: '100%', group: 'numbers', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'num-4', input: '$100', group: 'numbers', expect: { forbiddenAction: 'english_correction' } },
  { id: 'sym-1', input: 'UI/UX', group: 'symbols', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'sym-2', input: 'API-key', group: 'symbols', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'sym-3', input: 'مرحبا؟', group: 'symbols', expect: { hasRole: 'arabic_prose' } },
  { id: 'sym-4', input: 'hello؟', group: 'symbols', expect: { forbiddenAction: 'translation' } },
  { id: 'cap-1', input: 'ui', group: 'caps', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'cap-2', input: 'Ui', group: 'caps', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'layout-1', input: 'hsjo]lj', group: 'layout', expect: { hasHypIntent: 'fix_layout' } },
  { id: 'layout-2', input: 'hello hsjo]lj', group: 'layout', expect: { hasHypIntent: 'fix_layout' } },
  { id: 'name-1', input: 'Ahmed', group: 'names', expect: { forbiddenAction: 'english_correction' } },
  { id: 'name-2', input: 'أحمد', group: 'names', expect: { hasRole: 'arabic_prose' } },
  { id: 'mix-6', input: 'Python و Laravel معا', group: 'mixed', expect: { hasRole: 'arabic_prose' } },
  { id: 'mix-7', input: 'ok شكرا', group: 'mixed', expect: { hasRole: 'arabic_prose' } },
  { id: 'mix-8', input: 'error في السيرفر', group: 'mixed', expect: { hasRole: 'arabic_prose' } },
  { id: 'mix-9', input: 'chrome جيد', group: 'mixed', expect: { forbiddenAction: 'translation' } },
  { id: 'mix-10', input: 'git push ثم راجع', group: 'mixed', expect: { hasRole: 'arabic_prose' } },
  { id: 'en-5', input: 'please send the file', group: 'english', expect: { hasRole: 'english_prose' } },
  { id: 'en-6', input: 'teh cat', group: 'spelling', expect: { hasHypIntent: 'fix_english' } },
  { id: 'en-7', input: 'recieve this', group: 'spelling', expect: { hasHypIntent: 'fix_english' } },
  { id: 'ar-4', input: 'السلام عليكم', group: 'arabic', expect: { hasRole: 'arabic_prose' } },
  { id: 'ar-5', input: 'هل هذه الأداة جاهزة', group: 'arabic', expect: { hasRole: 'arabic_prose' } },
  { id: 'code-1', input: 'const userName = 1', group: 'code', expect: { hasRole: 'identifier' } },
  { id: 'code-2', input: 'npm install', group: 'code', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'url-1', input: 'www.example.com/path', group: 'protected', expect: { hasRole: 'url' } },
  { id: 'ip-1', input: '127.0.0.1', group: 'protected', expect: { forbiddenAction: 'english_correction' } },
  { id: 'punct-1', input: 'Python + Laravel', group: 'symbols', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'punct-2', input: '3D', group: 'symbols', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'gpt', input: 'GPT-5.6', group: 'technical', expect: { forbiddenAction: 'layout_fix' } },
  { id: 'env', input: '.env', group: 'protected', expect: { forbiddenAction: 'english_correction' } },
]

const EXTRA_ARABIC = ['نعم', 'لا', 'من فضلك', 'شكرا جزيلا', 'صباح الخير', 'مساء الخير', 'أين الملف', 'متى الموعد', 'هذا صحيح', 'غير صحيح']
const EXTRA_ENGLISH = ['thanks', 'please wait', 'see you tomorrow', 'good morning', 'looks good', 'need a review', 'open the page', 'save the file', 'start the test', 'stop the build']
const EXTRA_TECH = ['json', 'html', 'css', 'docker', 'react', 'next', 'node', 'openai', 'rest', 'sql']
const EXTRA_MIX = ['فيه bug', 'عمل commit', 'افتح chrome', 'هذا json', 'استخدم react', 'عندي issue', 'فيه token', 'اضف url', 'هذا http', 'شغل docker']

for (const [index, input] of EXTRA_ARABIC.entries()) {
  GOLDEN_INTENT_CASES.push({ id: `ar-x-${index}`, input, group: 'arabic', expect: { hasRole: 'arabic_prose' } })
}
for (const [index, input] of EXTRA_ENGLISH.entries()) {
  GOLDEN_INTENT_CASES.push({ id: `en-x-${index}`, input, group: 'english', expect: { forbiddenAction: 'translation' } })
}
for (const [index, input] of EXTRA_TECH.entries()) {
  GOLDEN_INTENT_CASES.push({ id: `tech-x-${index}`, input, group: 'technical', expect: { forbiddenAction: 'layout_fix' } })
}
for (const [index, input] of EXTRA_MIX.entries()) {
  GOLDEN_INTENT_CASES.push({ id: `mix-x-${index}`, input, group: 'mixed', expect: { forbiddenAction: 'translation' } })
}
