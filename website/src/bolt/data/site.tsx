import { Keyboard, PenLine, Languages, Zap, BookOpen, Box, LayoutGrid, FileText } from 'lucide-react';

export const NAV_LINKS = [
  { nav: 'features' as const, to: '/features' },
  { nav: 'howItWorks' as const, to: '/product' },
  { nav: 'try' as const, to: '/try' },
  { nav: 'pricing' as const, to: '/pricing' },
];

export const FEATURE_SLUGS = ['keyboard-layout', 'writing-correction', 'translation', 'live-translation', 'speed-box'] as const

export type FeatureSlug = (typeof FEATURE_SLUGS)[number]

export const SURFACE_IDS = ['website', 'try', 'lab', 'extension', 'popup', 'shortcuts', 'speedBox', 'dashboard'] as const

export type SurfaceId = (typeof SURFACE_IDS)[number]

export const FOOTER_LINKS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', to: '/product' },
      { label: 'Features', to: '/features' },
      { label: 'Try the demos', to: '/try' },
      { label: 'Writing Lab', to: '/lab' },
      { label: 'Install guide', to: '/guide' },
      { label: 'Pricing', to: '/pricing' },
    ],
  },
  {
    title: 'Features',
    links: [
      { label: 'Keyboard layout repair', to: '/features/keyboard-layout' },
      { label: 'English writing help', to: '/features/writing-correction' },
      { label: 'Translation', to: '/features/translation' },
      { label: 'Live translation', to: '/features/live-translation' },
      { label: 'Speed Box', to: '/features/speed-box' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Blog & stories', to: '/blog' },
      { label: 'Contact', to: '/contact' },
      { label: 'Feedback', to: '/feedback' },
      { label: 'Support', to: '/support' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', to: '/account' },
      { label: 'Create account', to: '/account?mode=register' },
      { label: 'Forgot password', to: '/account/forgot-password' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
      { label: 'Cookies', to: '/cookies' },
    ],
  },
];

export const FEATURES = [
  { slug: 'keyboard-layout' as const, icon: Keyboard, color: 'sky' },
  { slug: 'writing-correction' as const, icon: PenLine, color: 'teal' },
  { slug: 'translation' as const, icon: Languages, color: 'amber' },
  { slug: 'live-translation' as const, icon: Zap, color: 'rose' },
  { slug: 'speed-box' as const, icon: Box, color: 'violet' },
];

export const SURFACES = [
  { id: 'website' as const, icon: LayoutGrid },
  { id: 'try' as const, icon: BookOpen },
  { id: 'lab' as const, icon: PenLine },
  { id: 'extension' as const, icon: Box },
  { id: 'popup' as const, icon: FileText },
  { id: 'shortcuts' as const, icon: Zap },
  { id: 'speedBox' as const, icon: Keyboard },
  { id: 'dashboard' as const, icon: LayoutGrid },
];

export const TESTIMONIALS = [
  {
    name: 'Layla Mansour',
    role: 'Product manager, Dubai',
    quote: 'I switch between Arabic and English 50 times a day. Flowlary fixed the one thing that broke my flow every time — the keyboard was on the wrong layout. I just keep typing.',
    initials: 'LM',
  },
  {
    name: 'Omar Al-Rashid',
    role: 'Medical student, Cairo',
    quote: 'I write lecture notes in English but message my family in Arabic. Before Flowlary, I was pasting into a translator ten times an hour. Now the help is just there in the field.',
    initials: 'OR',
  },
  {
    name: 'Fatima Zahra',
    role: 'Freelance writer, Riyadh',
    quote: 'The English suggestions feel like a careful editor, not an autocorrect. I review, I choose, and my voice is still mine. That trust matters.',
    initials: 'FZ',
  },
  {
    name: 'Khalid Benali',
    role: 'Software engineer, Berlin',
    quote: 'Half my Slack messages are in Arabic, half in English. Flowlary keeps both flowing. The keyboard repair alone is worth it — the rest is a bonus.',
    initials: 'KB',
  },
  {
    name: 'Nour El-Hadi',
    role: 'PhD researcher, Amman',
    quote: 'I draft in English and translate key passages to Arabic for my advisor. Flowlary made that a shortcut instead of a context switch.',
    initials: 'NE',
  },
  {
    name: 'Yousef Tahir',
    role: 'Marketing lead, Doha',
    quote: 'Our team writes campaigns in both languages. Flowlary catches the small grammar slips that used to make us look careless. Calm, not pushy.',
    initials: 'YT',
  },
];

export const STATS = [
  { value: 'In the field', label: 'Help stays where you type' },
  { value: 'Arabic ↔ English', label: 'Built for bilingual writing' },
  { value: 'Chrome', label: 'Companion, not another tab' },
  { value: 'You decide', label: 'Review before anything is applied' },
];

export const BLOG_POSTS = [
  { slug: 'wrong-keyboard-gibberish' as const, date: '2026-08-12', minutes: 8, category: 'keyboard' as const, cover: '/blog/wrong-keyboard.jpg' },
  { slug: 'writing-arabic-english-same-field' as const, date: '2026-08-05', minutes: 8, category: 'life' as const, cover: '/blog/same-field.jpg' },
  { slug: 'help-not-rewrite' as const, date: '2026-07-22', minutes: 8, category: 'philosophy' as const, cover: '/blog/help-not-rewrite.jpg' },
  { slug: 'live-translation-when-to-use' as const, date: '2026-07-10', minutes: 7, category: 'features' as const, cover: '/blog/live-translation.jpg' },
  { slug: 'speed-box-story' as const, date: '2026-06-28', minutes: 7, category: 'philosophy' as const, cover: '/blog/speed-box.jpg' },
  { slug: 'bilingual-writing-tips' as const, date: '2026-06-15', minutes: 10, category: 'life' as const, cover: '/blog/bilingual-habits.jpg' },
  { slug: 'stay-in-the-inbox' as const, date: '2026-06-02', minutes: 8, category: 'life' as const, cover: '/blog/stay-in-inbox.jpg' },
  { slug: 'what-flowlary-will-not-claim' as const, date: '2026-05-20', minutes: 7, category: 'philosophy' as const, cover: '/blog/honest-limits.jpg' },
] as const

export type BlogPostMeta = (typeof BLOG_POSTS)[number]
export type BlogSlug = BlogPostMeta['slug']

export const FAQ_ITEMS = [
  {
    q: 'Does Flowlary work everywhere I type?',
    a: 'Flowlary works in most text fields on the web through its Chrome extension — including Gmail, Google Docs, WhatsApp Web, LinkedIn, and university portals. It does not work in browser settings pages, the Chrome address bar, or desktop apps outside the browser. We are honest about this: it is a Chrome extension, not a system-wide tool.',
  },
  {
    q: 'Does Flowlary produce perfect English?',
    a: 'No, and we will not claim it does. Flowlary offers suggestions you can review before applying. It catches spelling, grammar, and wording issues, but it is not a guarantee of perfect writing. You stay in control of what changes and what does not.',
  },
  {
    q: 'Does Flowlary replace my voice?',
    a: 'Never. Suggestions appear inline and you choose which to apply. Flowlary is designed to help, not rewrite. Your words remain yours.',
  },
  {
    q: 'Is live translation always on?',
    a: 'No. Live translation is off unless you explicitly turn it on. When enabled, it follows your Arabic as you type and shows English alongside. You can toggle it off at any time.',
  },
  {
    q: 'What is a "writing check"?',
    a: 'One writing check is one successful analysis of your text — even if several suggestions appear from that analysis. The free plan includes a generous daily allowance; Pro raises the daily limit and adds practice, progress, and reports.',
  },
  {
    q: 'What does the keyboard layout repair actually do?',
    a: 'When you type Arabic while the keyboard is set to English (or vice versa), Flowlary detects the resulting gibberish and repairs it into the correct language. You see the repair and can accept it with a keystroke.',
  },
  {
    q: 'Can I turn Flowlary off on certain sites?',
    a: 'Yes. The popup lets you turn help on or off per site. You decide where Flowlary appears and where it stays quiet.',
  },
  {
    q: 'Is my text sent to a server?',
    a: 'Keyboard layout repair runs locally. AI-powered features like English writing help and translation send the relevant text to our servers for analysis. We do not store your text beyond the time needed to process it. See our Privacy page for details.',
  },
  {
    q: 'Do you offer a student program?',
    a: 'Yes. Eligible students can get a year of Pro-level access at no cost. See the Pricing page for details and how to apply.',
  },
  {
    q: 'What languages does Flowlary support?',
    a: 'Flowlary is built for people who write in both Arabic and English. Keyboard layout repair handles Arabic↔English mix-ups. Translation works between Arabic and English. English writing help focuses on English text.',
  },
];

export const SUPPORT_ARTICLES = [
  { title: 'Installing the Chrome extension', category: 'Getting started', to: '/guide' },
  { title: 'Pinning Flowlary to your toolbar', category: 'Getting started', to: '/guide' },
  { title: 'Turning help on or off per site', category: 'Popup', to: '/product' },
  { title: 'Using keyboard shortcuts', category: 'Shortcuts', to: '/product' },
  { title: 'When auto-detection gets it wrong', category: 'Speed Box', to: '/features/speed-box' },
  { title: 'Understanding writing checks', category: 'Pricing', to: '/pricing' },
  { title: 'Turning live translation on or off', category: 'Features', to: '/features/live-translation' },
  { title: 'Managing your account', category: 'Account', to: '/account' },
  { title: 'Resetting your password', category: 'Account', to: '/account/forgot-password' },
  { title: 'Applying for the student program', category: 'Pricing', to: '/pricing' },
  { title: 'Privacy and data handling', category: 'Privacy', to: '/privacy' },
  { title: 'Reporting a bug or sending feedback', category: 'Feedback', to: '/feedback' },
];
