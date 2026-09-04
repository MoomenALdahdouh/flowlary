export type BlogStory = {
  title: string
  excerpt: string
  sections: readonly { heading: string; paragraphs: readonly string[] }[]
}

export const blogStoriesEn = {
  'wrong-keyboard-gibberish': {
    title: 'The half-second heartbreak of the wrong keyboard',
    excerpt:
      'You were typing Arabic. The keyboard was still English. The letters look like a password. This is not a spelling problem — and it should not cost you the sentence.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'You look up from the field and the line is garbage. Not a typo. Not a weak word. A whole phrase rendered in the wrong alphabet because the layout never switched. You delete, tap the language key, retype, and hope the thought is still there. Ten seconds. Sometimes more. The original sentence is gone.',
          'If you live in Arabic and English, this is not rare. It is a daily tax. Chat, email, a form on a university portal, a comment on LinkedIn. The mind is already in the next clause. The fingers were honest. The keyboard was not.',
        ],
      },
      {
        heading: 'Spellcheck cannot see this',
        paragraphs: [
          'Ordinary spellcheck looks at letters and asks whether they form a dictionary word. Wrong-layout text often does form “words” — just in the other language’s keyboard map. English keys produce strings that look like Latin gibberish. Arabic keys produce strings that look like Arabic gibberish. Neither is a misspelling of what you meant.',
          'That is why pasting into a grammar site rarely helps. The tool tries to “fix English” that was never English. You still have to reconstruct the sentence from memory. The break is in the layout, not in your vocabulary.',
        ],
      },
      {
        heading: 'Repair belongs in the field',
        paragraphs: [
          'The useful move is to map the keys back: the physical buttons you pressed, under the layout you intended. Flowlary’s keyboard repair does that in the field you are already in. You review the repaired line. You accept it with a shortcut, or you dismiss it.',
          'Nothing is rewritten behind your back. The original text stays until you choose. That matters when the field is a live chat, a grading form, or a message you almost sent.',
        ],
      },
      {
        heading: 'What this is not',
        paragraphs: [
          'Keyboard repair is not a promise that every mixed string will decode perfectly. Short fragments, passwords, and code should stay untouched. If two layouts could both be plausible, Flowlary should not silently pick one and call it done.',
          'When more than one repair looks reasonable, Speed Box is the honest overlay: a few options, a number key, or close. Fast when the mapping is obvious. A choice when it is not.',
        ],
      },
      {
        heading: 'Keep the sentence',
        paragraphs: [
          'The product goal is small and stubborn: you should not lose the thought because the OS language key lagged. Help sits next to the caret. You stay in Gmail, Docs, WhatsApp Web, or whichever page you were already writing in.',
          'That is the whole story. Not a new editor. Not a second tab. The half-second heartbreak should end in the same field where it started.',
        ],
      },
    ],
  },
  'writing-arabic-english-same-field': {
    title: 'Arabic and English in the same field',
    excerpt:
      'Two languages, one mind, often one sentence. Writing tools should not send you to another tab every time the script changes.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Bilingual writing is not two separate jobs. You draft a greeting in Arabic, drop an English term of art, switch back. You quote a professor in English and answer in Arabic. The field is one box. The thought is one thread.',
          'Most writing products still assume a monolingual document. Paste here to check English. Open another site to translate. A third window if the keyboard went wrong. By the time you return, the tone of the message has cooled.',
        ],
      },
      {
        heading: 'The cost of leaving the page',
        paragraphs: [
          'Every extra surface is a chance to over-edit. You polish a paragraph in a grammar box until it sounds like a press release, then paste it into a WhatsApp chat where it does not belong. Or you translate a whole block when you only needed one clause.',
          'Flowlary is built as a Chrome companion for the page you already use. Suggestions appear on the text you typed. Translation runs when you ask. Live translation stays off unless you turn it on. The field does not get replaced by a dashboard.',
        ],
      },
      {
        heading: 'Mixed script is normal',
        paragraphs: [
          'A line can hold an Arabic verb and an English product name. Repair and review have to respect that mix. Blind “make this English” is the wrong default. So is stripping Latin letters from an Arabic message because a detector got nervous.',
          'You remain the editor. Accept a suggestion, skip it, or close the card. The companion should not flatten your bilingual voice into one language because that is easier to score.',
        ],
      },
      {
        heading: 'Where it actually runs',
        paragraphs: [
          'Flowlary works in most web text fields through the Chrome extension: Gmail, Google Docs, WhatsApp Web, LinkedIn, and many university portals. It does not run in the Chrome address bar, browser settings pages, or desktop apps outside the browser. That limit is real. We would rather say it than pretend we are a system-wide keyboard.',
          'If you write in those web fields all day, staying there is the feature. The languages can share the box. The help should too.',
        ],
      },
      {
        heading: 'One mind, one field',
        paragraphs: [
          'The writing life between Arabic and English is already enough work. The tool’s job is not to split it into products. It is to sit still while you switch scripts, then offer a repair or a suggestion you can still refuse.',
          'When that holds, the field feels like yours again. Not a pipeline. A place to finish the sentence.',
        ],
      },
    ],
  },
  'help-not-rewrite': {
    title: 'Help, not rewrite',
    excerpt:
      'A tool that silently replaces your sentence is writing for you. Flowlary shows the change. You review. You choose. We will not claim perfect English.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Silent rewrite trains a bad habit. You stop reading your own line. You tap send on something you did not quite write. Over time the voice in the field becomes the model’s average, not yours.',
          'Flowlary is designed the other way: a suggestion you can see, next to the words you typed. Apply, skip, or dismiss. The last word stays with the person whose name is on the email.',
        ],
      },
      {
        heading: 'Review is the product',
        paragraphs: [
          'English help in Flowlary is spelling, grammar, and wording you can inspect. It is not a guarantee that the result is native, academic, or “perfect.” Those words sell well. They are not true of any assistant we will ship.',
          'If a suggestion would change meaning, you should feel that before it lands. If you meant a slightly odd phrase on purpose, you should be able to keep it. Help that cannot be refused is not help.',
        ],
      },
      {
        heading: 'What we will not do',
        paragraphs: [
          'We will not auto-apply a full rewrite of your paragraph because a model is confident. We will not hide the diff. We will not tell you the output is publication-ready when it is a suggestion.',
          'We also will not pretend bilingual writers need to sound like a style guide from another country. Communication first. Clarity when you ask for it. Your register, when you protect it.',
        ],
      },
      {
        heading: 'Learning without a lecture',
        paragraphs: [
          'When you accept or reject a correction, Flowlary can remember patterns over time — if you use an account and learning features. That is practice from real writing, not a quiz you did not ask for in the middle of a chat.',
          'The dashboard is for people who want that loop. The field is still the field. A suggestion card should not become a classroom the moment you try to send a message.',
        ],
      },
      {
        heading: 'Trust is slow on purpose',
        paragraphs: [
          'Writers who switch languages all day have been burned by tools that “fixed” a name, a verse, or a joke. So the bar is conservative: show the change, keep the original until you confirm, stay in the page.',
          'Help, not rewrite. If that sentence is the whole philosophy, the rest of the product has to obey it.',
        ],
      },
    ],
  },
  'live-translation-when-to-use': {
    title: 'Live translation: when to use it — and when to turn it off',
    excerpt:
      'English under your Arabic can help you draft for an English reader. It can also get in the way. The feature stays off until you ask for it.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Live translation in Flowlary follows Arabic as you type and can show English alongside. It is optional. Off is the default. That is not a buried setting we hope you never find. It is the honest default for people who already write both languages.',
          'Turn it on when you are composing in Arabic and the person on the other side needs English — a professor, a client, a form that only accepts Latin script. Turn it off when you are chatting, thinking, or already mixing freely.',
        ],
      },
      {
        heading: 'Drafting is not sending',
        paragraphs: [
          'A live English line is a draft aid. It is not a certified translation, a legal rendering, or a promise that names and technical terms survived. Read it. Edit the field. Then send the language you actually intend.',
          'If you only needed one sentence translated, a one-shot translate on selected text is often calmer than a ribbon that updates on every keystroke.',
        ],
      },
      {
        heading: 'When it gets noisy',
        paragraphs: [
          'Live English under a fast Arabic chat can pull your eyes down on every word. That is useful in a slow email. It is noise in a group thread. The shortcut exists so you can kill it without hunting a menu.',
          'If the overlay covers the text you are typing, that is a bug in the experience, not a reason to “get used to it.” Speed Box and cards should stay small. Live translation should stay a companion line, not a second document.',
        ],
      },
      {
        heading: 'One-shot versus live',
        paragraphs: [
          'Use on-demand translation when the block is done and you want an English version to paste or compare. Use live translation when you are still forming the Arabic and want a running English sketch.',
          'Both respect the same rule: nothing is applied to the field unless you choose it. Translation is not a silent replace of your Arabic.',
        ],
      },
      {
        heading: 'Your choice, one shortcut',
        paragraphs: [
          'Bilingual work changes through the day. Morning lecture notes. Afternoon English report. Evening family chat. The same person should not be stuck with a feature that was perfect at noon.',
          'Keep live translation for the hour you need it. Turn it off when you do not. The field stays yours either way.',
        ],
      },
    ],
  },
  'speed-box-story': {
    title: 'Why Speed Box exists',
    excerpt:
      'Auto-fix is often right. When two repairs both look plausible, a tiny overlay with numbered choices is more honest than a silent pick.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Keyboard repair is usually a single mapping. You pressed English keys, you meant Arabic — or the reverse. The companion can show one repaired line and you accept it.',
          'Sometimes the fragment is short, mixed, or ambiguous. Two layouts could explain the same keys. A confident auto-apply would be a guess dressed as a feature.',
        ],
      },
      {
        heading: 'A small box, not a modal',
        paragraphs: [
          'Speed Box is a compact overlay near the field: a few candidates, pick with a number, apply or copy, or close. It should not cover the paragraph you are editing. It should not steal the whole page.',
          'The point is speed with a safety net. Fast when you already know which option is yours. Visible when the model should not choose for you.',
        ],
      },
      {
        heading: 'Apply or copy',
        paragraphs: [
          'Some fields are fragile. A learning portal, a comment box with a character limit, a site that fights extensions. Copy lets you paste on your terms. Apply writes when the field allows it.',
          'You stay the operator. Speed Box is a picker, not a demon that types while you look away.',
        ],
      },
      {
        heading: 'How it fits the other tools',
        paragraphs: [
          'Instant repair still handles the obvious layout mistakes. English suggestions still wait for review. Translation still waits for a shortcut. Speed Box is the extra lane for “I need to see the options.”',
          'If everything were a card, the page would feel busy. If everything were auto, trust would collapse on the first bad guess. The box is the middle.',
        ],
      },
      {
        heading: 'Close it and keep writing',
        paragraphs: [
          'The most important button is still dismiss. Wrong overlay, wrong moment, you were in the middle of a word — gone. The original text remains.',
          'That is why Speed Box exists: not to look clever, but to keep repair honest when the mapping is not unique.',
        ],
      },
    ],
  },
  'bilingual-writing-tips': {
    title: 'Seven small habits for smoother bilingual writing',
    excerpt:
      'Not everything needs a product. A few habits — plus help that stays in the field — go further than another grammar tab.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Tools help. Habits keep you from needing them on every keystroke. These seven are the ones bilingual writers tell us they actually keep, whether or not Flowlary is installed.',
          'None of them require perfect English. They require finishing the message you meant to send.',
        ],
      },
      {
        heading: '1. Learn the layout switch by feel',
        paragraphs: [
          'Put the OS language key where your thumb already rests. Practice the switch without looking. Most “gibberish” minutes are a lag between intention and the keyboard state.',
          'When the switch still fails — and it will — repair in the field beats reconstructing the line from a screenshot of your own chat.',
        ],
      },
      {
        heading: '2. Write the thought first',
        paragraphs: [
          'Do not open a translator in the first sentence. Get the meaning down in the language that is moving. Then translate or polish the part that must travel.',
          'Premature English often kills the Arabic rhythm you needed. Premature Arabic polish can hide that the English reader still needs a different structure.',
        ],
      },
      {
        heading: '3. Keep names and terms stable',
        paragraphs: [
          'Product names, people, course codes, and verses should survive the pass. If a helper rewrites them, reject it. Consistency is clearer than a “more natural” substitution.',
          'Flowlary’s review step exists for this. Use it. A confident model is still a model.',
        ],
      },
      {
        heading: '4. Stay in the field you will send from',
        paragraphs: [
          'Drafting in a separate grammar site and pasting back is how tone dies. Help that sits in Gmail or Docs keeps the register of that place.',
          'If the site is hostile to extensions, copy from Speed Box rather than fighting the page. The habit is still: do not build a second home for the paragraph.',
        ],
      },
      {
        heading: '5. Use live translation as a sketch',
        paragraphs: [
          'If you turn live English on, treat it as a running draft, not a caption you will ship unread. Pause. Read both lines. Then send one.',
          'If it distracts, turn it off. Optional means optional.',
        ],
      },
      {
        heading: '6. Read once before send',
        paragraphs: [
          'One pass for meaning, not for prestige. Did you answer the question? Did a layout glitch survive? Did a suggestion change a number or a date?',
          'Perfection is a stall. Communication is the job.',
        ],
      },
      {
        heading: '7. Let practice happen later',
        paragraphs: [
          'If you care about improving English over months, review accepted corrections in the dashboard when you are not in a live chat. Do not turn every WhatsApp into a lesson.',
          'The field is for sending. The lab and progress views are for people who want the longer loop. Keep them in their hours.',
        ],
      },
    ],
  },
  'stay-in-the-inbox': {
    title: 'Finish the email in the inbox',
    excerpt:
      'Gmail, Docs, and WhatsApp Web are where the writing already happens. A companion that makes you leave those pages is solving the wrong problem.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'The message is already in Gmail. The comment is already in the doc. The reply is already in WhatsApp Web. Opening a new tab to “fix writing” feels productive. It is usually a delay dressed as quality.',
          'Flowlary is a Chrome extension on purpose. The job is to sit in those fields: wrong-keyboard repair, English suggestions you review, translation when you ask. Not a second editor that becomes the real place you write.',
        ],
      },
      {
        heading: 'Why paste-back fails',
        paragraphs: [
          'You copy a paragraph out, run it through a checker, copy it back. Formatting shifts. A tracking pixel in an email client gets nervous. A form loses focus and drops your draft. Or you polish until the voice no longer matches the thread above.',
          'In-field help keeps the same box, the same thread, the same send button. You see the suggestion on the words that will actually go out.',
        ],
      },
      {
        heading: 'What “in the field” cannot cover',
        paragraphs: [
          'Native desktop Word, some heavily locked exam browsers, the Chrome omnibox, and OS-level fields are outside the extension. If you live there, Flowlary will not follow you, and we will not advertise that it does.',
          'Honesty here is part of the product. Writers plan their day around real surfaces, not a slogan.',
        ],
      },
      {
        heading: 'Shortcuts instead of hunting',
        paragraphs: [
          'When help is in the page, it still has to be reachable without a treasure hunt. Popup for status. Shortcuts for repair, suggest, translate. Speed Box when you need to pick. Cards you can dismiss with the keyboard.',
          'If you must mouse across the screen to accept every fix, you will turn the companion off. Speed is respect for the inbox.',
        ],
      },
      {
        heading: 'Send from the same place',
        paragraphs: [
          'The test is simple: did you finish the email where it started? If yes, the companion did its job even if you rejected half the suggestions.',
          'Leaving the inbox to become a better writer is a different afternoon. Sending the mail is this one.',
        ],
      },
    ],
  },
  'what-flowlary-will-not-claim': {
    title: 'What Flowlary will not claim',
    excerpt:
      'No perfect English. No silent full rewrites. No system-wide magic outside Chrome. The stories on this site should match the product you can actually use.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'Marketing pages like to promise transformation. Bilingual writers have heard it. We would rather list the refusals. They are how you know the rest of the site is not theatre.',
          'Flowlary is a Chrome writing companion for Arabic and English. It helps in the field. You review before anything is applied. That is the claim. Here is what sits outside it.',
        ],
      },
      {
        heading: 'Not perfect English',
        paragraphs: [
          'Suggestions can be wrong, stiff, or too eager. They can miss dialect, humour, and technical register. Use them as a second pair of eyes, not as a certificate.',
          'If a page on this site ever sounds like we guaranteed native prose, that page is out of date. Tell us on Feedback. We will fix the copy.',
        ],
      },
      {
        heading: 'Not a silent author',
        paragraphs: [
          'We will not ship a mode that rewrites your whole message without a review step and call it intelligence. Help that you cannot see is someone else speaking in your name.',
          'Apply is a decision. Dismiss is a decision. Both are first-class.',
        ],
      },
      {
        heading: 'Not everywhere you type',
        paragraphs: [
          'The extension reaches most web fields. It does not replace the operating system keyboard. It does not live in every native app. Live translation is off until you enable it. The Chrome Web Store listing is published when it is published — we do not invent a store URL on the site.',
          'Limits are not a footnote. They are how you decide whether Flowlary fits the way you already work.',
        ],
      },
      {
        heading: 'The stories should stay true',
        paragraphs: [
          'This blog exists so the product has a human pace: wrong keyboard, mixed field, optional translation, Speed Box, habits, inbox, honesty. If a story ever outruns the software, the story is the thing that changes.',
          'Write where you are. Review what we offer. Keep the sentence that is yours.',
        ],
      },
    ],
  },
} as const satisfies Record<string, BlogStory>

export const blogStoriesAr = {
  'wrong-keyboard-gibberish': {
    title: 'لحظة لوحة المفاتيح الغلط',
    excerpt:
      'كنت تكتب عربياً. اللوحة ما زالت إنجليزية. الحروف تشبه كلمة مرور. هذه ليست غلطة إملاء — ولا يجب أن تكلّفك الجملة.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'ترفع نظرك من الحقل فترى سطراً بلا معنى. ليس خطأً مطبعياً. ليست كلمة ضعيفة. عبارة كاملة ظهرت بأبجدية غلط لأن التخطيط لم يتبدّل. تحذف، تضغط مفتاح اللغة، تعيد الكتابة، وتأمل أن الفكرة ما زالت هناك. عشر ثوان. أحياناً أكثر. الجملة الأصلية ذهبت.',
          'إن عشت بالعربية والإنجليزية فهذا ليس نادراً. إنه ضريبة يومية. دردشة، بريد، نموذج في بوابة جامعة، تعليق على لنكدإن. العقل في الجملة التالية. الأصابع صادقة. اللوحة ليست كذلك.',
        ],
      },
      {
        heading: 'التدقيق الإملائي لا يرى هذا',
        paragraphs: [
          'التدقيق العادي ينظر إلى الحروف ويسأل هل تكوّن كلمة في المعجم. نص التخطيط الغلط غالباً يكوّن «كلمات» — لكن وفق خريطة لوحة اللغة الأخرى. مفاتيح إنجليزية تنتج رطاناً لاتينياً. مفاتيح عربية تنتج رطاناً عربياً. لا هذا ولا ذاك إملاء خاطئ لما قصدت.',
          'لذلك اللصق في موقع نحو نادراً ما ينفع. الأداة تحاول «إصلاح إنجليزية» لم تكن إنجليزية. ما زلت تعيد بناء الجملة من الذاكرة. الكسر في التخطيط، لا في حصيلتك.',
        ],
      },
      {
        heading: 'الإصلاح مكانه الحقل',
        paragraphs: [
          'الحركة المفيدة هي إعادة تعيين المفاتيح: الأزرار التي ضغطت عليها، تحت التخطيط الذي أردته. إصلاح اللوحة في فلو لاري يفعل ذلك في الحقل الذي أنت فيه. تراجع السطر المُصلَح. تقبله باختصار، أو ترفضه.',
          'لا شيء يُعاد كتابته من وراء ظهرك. النص الأصلي يبقى حتى تختار. هذا مهم حين يكون الحقل دردشة حيّة أو نموذجاً للدرجات أو رسالة أوشكت على إرسالها.',
        ],
      },
      {
        heading: 'ما ليس هذا',
        paragraphs: [
          'إصلاح اللوحة ليس وعداً بأن كل سلسلة مختلطة ستُفكّ بشكل كامل. المقاطع القصيرة وكلمات المرور والشيفرة يجب أن تُترك. إذا بدا تخطيطان معقولين، لا يجوز لفلو لاري أن يختار بصمت ويسمّي ذلك إنجازاً.',
          'عندما يبدو أكثر من إصلاح معقولاً، صندوق السرعة هو الطبقة الصادقة: خيارات قليلة، مفتاح رقم، أو إغلاق. سريع حين يكون التعيين واضحاً. اختيار حين لا يكون.',
        ],
      },
      {
        heading: 'أبقِ الجملة',
        paragraphs: [
          'هدف المنتج صغير وعنيد: لا تفقد الفكرة لأن مفتاح لغة النظام تأخّر. المساعدة بجانب المؤشر. تبقى في جيميل أو المستندات أو واتساب ويب أو أي صفحة كنت تكتب فيها.',
          'هذه القصة كلها. ليست محرراً جديداً. ليست تبويباً ثانياً. يجب أن تنتهي لحظة القلب المكسور في الحقل نفسه الذي بدأت فيه.',
        ],
      },
    ],
  },
  'writing-arabic-english-same-field': {
    title: 'العربية والإنجليزية في الحقل نفسه',
    excerpt: 'لغتان، عقل واحد، وغالباً جملة واحدة. أدوات الكتابة لا يجب أن تبعثك إلى تبويب آخر كلما تبدّل الخط.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'الكتابة بلغتين ليست مهمتين منفصلتين. تكتب تحية بالعربية، تُسقط مصطلحاً إنجليزياً، ثم تعود. تقتبس أستاذاً بالإنجليزية وتجيب بالعربية. الحقل صندوق واحد. الفكرة خيط واحد.',
          'معظم منتجات الكتابة ما زالت تفترض مستنداً بلغة واحدة. الصق هنا لتدقيق الإنجليزية. افتح موقعاً آخر للترجمة. نافذة ثالثة إن غلبت اللوحة. حين تعود، برد نبرة الرسالة.',
        ],
      },
      {
        heading: 'ثمن مغادرة الصفحة',
        paragraphs: [
          'كل سطح إضافي فرصة للمبالغة في التحرير. تصقل فقرة في صندوق نحو حتى تصير بياناً صحفياً، ثم تلصقها في واتساب حيث لا تنتمي. أو تترجم كتلة كاملة وأنت تحتاج جملة واحدة.',
          'فلو لاري مبني كرفيق كروم للصفحة التي تستخدمها. الاقتراحات على النص الذي كتبته. الترجمة عندما تطلب. الترجمة المباشرة مغلقة حتى تشغّلها. الحقل لا يُستبدل بلوحة تحكم.',
        ],
      },
      {
        heading: 'اختلاط الخط طبيعي',
        paragraphs: [
          'قد يحمل السطر فعلاً عربياً واسم منتج إنجليزي. الإصلاح والمراجعة يجب أن يحترما هذا الخلط. «اجعل هذا إنجليزياً» الأعمى افتراض غلط. وكذلك حذف الحروف اللاتينية من رسالة عربية لأن كاشفاً توتّر.',
          'أنت المحرّر. تقبل اقتراحاً، تتجاوزه، أو تغلق البطاقة. لا يجوز للرفيق أن يسطح صوتك ثنائي اللغة لأن ذلك أسهل في التقييم.',
        ],
      },
      {
        heading: 'أين يعمل فعلاً',
        paragraphs: [
          'يعمل فلو لاري في معظم حقول الويب عبر إضافة كروم: جيميل ومستندات غوغل وواتساب ويب ولنكدإن وكثير من بوابات الجامعات. لا يعمل في شريط عنوان كروم ولا صفحات إعدادات المتصفح ولا تطبيقات سطح المكتب خارج المتصفح. هذا حد حقيقي. نفضّل قوله على التظاهر بأننا لوحة نظام.',
          'إن كنت تكتب في تلك الحقول طوال اليوم، البقاء هناك هو الميزة. يمكن للغتين أن تتشاركا الصندوق. والمساعدة أيضاً.',
        ],
      },
      {
        heading: 'عقل واحد، حقل واحد',
        paragraphs: [
          'حياة الكتابة بين العربية والإنجليزية عمل كافٍ. مهمة الأداة ليست تقسيمه إلى منتجات. مهمتها أن تجلس ساكنة وأنت تبدّل الخط، ثم تعرض إصلاحاً أو اقتراحاً يمكنك رفضه.',
          'حين يثبت ذلك، يعود الحقل لك. ليس أنبوباً. مكاناً تُنهي فيه الجملة.',
        ],
      },
    ],
  },
  'help-not-rewrite': {
    title: 'مساعدة، لا إعادة كتابة',
    excerpt:
      'أداة تستبدل جملتك بصمت تكتب عنك. فلو لاري يعرض التغيير. أنت تراجع. أنت تختار. لن ندّعي إنجليزية كاملة.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'إعادة الكتابة الصامتة تعلّم عادة سيئة. تتوقف عن قراءة سطرك. تضغط إرسال على شيء لم تكتبه تماماً. مع الوقت يصير الصوت في الحقل متوسط النموذج، لا صوتك.',
          'فلو لاري مصمم بالعكس: اقتراح تراه، بجانب الكلمات التي كتبتها. تطبيق، تجاوز، أو رفض. الكلمة الأخيرة لمن اسمه على الرسالة.',
        ],
      },
      {
        heading: 'المراجعة هي المنتج',
        paragraphs: [
          'مساعدة الإنجليزية في فلو لاري إملاء ونحو وصياغة يمكن فحصها. ليست ضماناً أن النتيجة أصلية أو أكاديمية أو «كاملة». تلك الكلمات تُباع جيداً. وهي ليست صادقة لأي مساعد سنطرحه.',
          'إن كان الاقتراح سيغيّر المعنى، يجب أن تشعر بذلك قبل أن يقع. إن قصدت عبارة غريبة قليلاً عن عمد، يجب أن تستطيع الإبقاء عليها. مساعدة لا تُرفض ليست مساعدة.',
        ],
      },
      {
        heading: 'ما لن نفعله',
        paragraphs: [
          'لن نطبّق تلقائياً إعادة كتابة كاملة لفقرتك لأن نموذجاً واثق. لن نخفي الفرق. لن نقول إن المخرج جاهز للنشر وهو اقتراح.',
          'ولن نتظاهر بأن الكتّاب ثنائيي اللغة يحتاجون أن يبدوا كدليل أسلوب من بلد آخر. التواصل أولاً. الوضوح حين تطلبه. سجلّك، حين تحميه.',
        ],
      },
      {
        heading: 'تعلّم بلا محاضرة',
        paragraphs: [
          'عندما تقبل تصحيحاً أو ترفضه، يمكن لفلو لاري أن يتذكّر أنماطاً مع الوقت — إن استخدمت حساباً وميزات التعلّم. هذا تمرين من كتابة حقيقية، لا اختباراً لم تطلبه في وسط دردشة.',
          'لوحة التقدّم لمن يريد هذه الحلقة. الحقل يبقى الحقل. بطاقة اقتراح لا يجب أن تصير صفّاً دراسياً لحظة إرسال رسالة.',
        ],
      },
      {
        heading: 'الثقة بطيئة عن قصد',
        paragraphs: [
          'من يبدّلون اللغات طوال اليوم احترقوا بأدوات «أصلحت» اسماً أو آية أو نكتة. لذلك الشريط محافظ: اعرض التغيير، أبقِ الأصل حتى تؤكد، ابقَ في الصفحة.',
          'مساعدة، لا إعادة كتابة. إن كانت هذه الجملة كل الفلسفة، فعلى بقية المنتج أن تطيعها.',
        ],
      },
    ],
  },
  'live-translation-when-to-use': {
    title: 'الترجمة المباشرة: متى تستخدمها — ومتى توقفها',
    excerpt:
      'الإنجليزية تحت عربيتك قد تساعدك على الصياغة لقارئ إنجليزي. وقد تعيق. الميزة مغلقة حتى تطلبها.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'الترجمة المباشرة في فلو لاري تتبع العربية وأنت تكتب ويمكن أن تعرض إنجليزية إلى جانبها. اختيارية. الإغلاق هو الافتراضي. هذا ليس إعداداً مدفوناً نأمل ألا تجده. إنه الافتراض الصادق لمن يكتب اللغتين أصلاً.',
          'شغّلها عندما تصوغ بالعربية والطرف الآخر يحتاج إنجليزية — أستاذ، عميل، نموذج لا يقبل إلا حروفاً لاتينية. أوقفها عندما تدردش أو تفكّر أو تخلط بحرية.',
        ],
      },
      {
        heading: 'الصياغة ليست الإرسال',
        paragraphs: [
          'سطر إنجليزي مباشر أداة مسودة. ليست ترجمة معتمدة ولا صياغة قانونية ولا وعداً بأن الأسماء والمصطلحات نجت. اقرأه. حرّر الحقل. ثم أرسل اللغة التي تقصدها فعلاً.',
          'إن احتجت ترجمة جملة واحدة، ترجمة فورية على نص محدد غالباً أهدأ من شريط يتحدّث مع كل ضغطة.',
        ],
      },
      {
        heading: 'حين تصير ضجيجاً',
        paragraphs: [
          'إنجليزية مباشرة تحت دردشة عربية سريعة قد تجذب عينيك إلى الأسفل مع كل كلمة. هذا مفيد في بريد بطيء. وهو ضجيج في مجموعة. الاختصار موجود لتغلقها دون البحث في قائمة.',
          'إن غطّى الشريط النص الذي تكتبه، فهذا خلل في التجربة، لا سبباً «للاعتياد». صندوق السرعة والبطاقات يجب أن تبقى صغيرة. الترجمة المباشرة سطر رفيق، لا مستنداً ثانياً.',
        ],
      },
      {
        heading: 'فورية مقابل مباشرة',
        paragraphs: [
          'استخدم الترجمة عند الطلب حين تنتهي الكتلة وتريد نسخة إنجليزية للصق أو المقارنة. استخدم المباشرة حين ما زلت تشكّل العربية وتريد مسودة إنجليزية تجري.',
          'كلاهما يحترم القاعدة نفسها: لا شيء يُطبَّق على الحقل إلا إذا اخترت. الترجمة ليست استبدالاً صامتاً لعربيتك.',
        ],
      },
      {
        heading: 'قرارك، اختصار واحد',
        paragraphs: [
          'العمل بلغتين يتغيّر خلال اليوم. ملاحظات محاضرة صباحاً. تقرير إنجليزي بعد الظهر. دردشة عائلية مساء. الشخص نفسه لا يجب أن يُحبس في ميزة كانت مثالية ظهراً.',
          'أبقِ الترجمة المباشرة للساعة التي تحتاجها. أوقفها حين لا تحتاج. الحقل لك في الحالين.',
        ],
      },
    ],
  },
  'speed-box-story': {
    title: 'لماذا يوجد صندوق السرعة',
    excerpt: 'الإصلاح التلقائي غالباً صحيح. حين يبدو إصلاحان معقولين، صندوق صغير بأرقام أصدق من اختيار صامت.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'إصلاح اللوحة غالباً تعيين واحد. ضغطت مفاتيح إنجليزية وأردت عربية — أو العكس. يمكن للرفيق أن يعرض سطراً مُصلَحاً واحداً وتقبله.',
          'أحياناً المقطع قصير أو مختلط أو ملتبس. قد يفسّر تخطيطان المفاتيح نفسها. التطبيق التلقائي الواثق سيكون تخميناً متخفّياً في ميزة.',
        ],
      },
      {
        heading: 'صندوق صغير، لا نافذة ثقيلة',
        paragraphs: [
          'صندوق السرعة طبقة مضغوطة قرب الحقل: مرشحون قليلون، اختيار برقم، تطبيق أو نسخ، أو إغلاق. لا يجب أن يغطي الفقرة التي تحرّرها. لا يجب أن يسرق الصفحة.',
          'الهدف سرعة مع شبكة أمان. سريع حين تعرف أي خيار لك. ظاهر حين لا يجب أن يختار النموذج عنك.',
        ],
      },
      {
        heading: 'طبّق أو انسخ',
        paragraphs: [
          'بعض الحقول هشّة. بوابة تعليم، صندوق تعليق بحد أحرف، موقع يقاوم الإضافات. النسخ يدعك تلصق بشروطك. التطبيق يكتب حين يسمح الحقل.',
          'أنت المشغّل. الصندوق منتقي، لا شيطان يكتب وأنت تنظر بعيداً.',
        ],
      },
      {
        heading: 'كيف ينسجم مع الأدوات الأخرى',
        paragraphs: [
          'الإصلاح الفوري ما زال يعالج أخطاء التخطيط الواضحة. اقتراحات الإنجليزية ما زالت تنتظر المراجعة. الترجمة ما زالت تنتظر اختصاراً. صندوق السرعة هو المسار الإضافي لـ«أحتاج أن أرى الخيارات».',
          'لو كان كل شيء بطاقة لبدت الصفحة مزدحمة. ولو كان كل شيء تلقائياً لانهارت الثقة من أول تخمين سيئ. الصندوق هو الوسط.',
        ],
      },
      {
        heading: 'أغلقه وأكمل الكتابة',
        paragraphs: [
          'أهم زر ما زال الرفض. طبقة غلط، لحظة غلط، كنت في وسط كلمة — اختفت. النص الأصلي يبقى.',
          'لهذا يوجد صندوق السرعة: ليس ليبدو ذكياً، بل ليبقى الإصلاح صادقاً حين لا يكون التعيين وحيداً.',
        ],
      },
    ],
  },
  'bilingual-writing-tips': {
    title: 'سبع عادات صغيرة لكتابة أسلس بلغتين',
    excerpt: 'ليس كل شيء يحتاج منتجاً. عادات قليلة — مع مساعدة تبقى في الحقل — أبعد أثراً من تبويب نحو جديد.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'الأدوات تساعد. العادات تمنعك من الحاجة إليها مع كل ضغطة. هذه السبع ما يخبرنا الكتّاب ثنائيو اللغة أنهم يحافظون عليها فعلاً، سواء ثُبّت فلو لاري أم لا.',
          'لا واحدة منها تتطلب إنجليزية كاملة. تتطلب إنهاء الرسالة التي قصدت إرسالها.',
        ],
      },
      {
        heading: '١. تعلّم تبديل التخطيط باللمس',
        paragraphs: [
          'ضع مفتاح لغة النظام حيث يستريح إبهامك. تمرّن على التبديل دون نظر. معظم دقائق «الرطانة» تأخير بين القصد وحالة اللوحة.',
          'حين يفشل التبديل بعد — وسيفشل — الإصلاح في الحقل خير من إعادة بناء السطر من لقطة لدرشاتك.',
        ],
      },
      {
        heading: '٢. اكتب الفكرة أولاً',
        paragraphs: [
          'لا تفتح مترجماً في الجملة الأولى. أنزل المعنى باللغة التي تتحرّك. ثم ترجم أو صقل الجزء الذي يجب أن يسافر.',
          'الإنجليزية المبكرة غالباً تقتل إيقاع العربية الذي احتجته. والصقل العربي المبكر قد يخفي أن القارئ الإنجليزي ما زال يحتاج بنية أخرى.',
        ],
      },
      {
        heading: '٣. أبقِ الأسماء والمصطلحات ثابتة',
        paragraphs: [
          'أسماء المنتجات والأشخاص ورموز المقررات والآيات يجب أن تنجو من المرور. إن أعاد مساعد كتابتها، ارفض. الثبات أوضح من استبدال «أكثر طبيعية».',
          'خطوة المراجعة في فلو لاري موجودة لهذا. استخدمها. النموذج الواثق ما زال نموذجاً.',
        ],
      },
      {
        heading: '٤. ابقَ في الحقل الذي سترسل منه',
        paragraphs: [
          'الصياغة في موقع نحو منفصل ثم اللصق عودة هي كيف تموت النبرة. المساعدة في جيميل أو المستندات تحفظ سجلّ ذلك المكان.',
          'إن عادى الموقع الإضافات، انسخ من صندوق السرعة بدل محاربة الصفحة. العادة تبقى: لا تبنِ بيتاً ثانياً للفقرة.',
        ],
      },
      {
        heading: '٥. عامل الترجمة المباشرة كمسودة',
        paragraphs: [
          'إن شغّلت الإنجليزية المباشرة، عاملها كمسودة جارية، لا كتعليق سترسله دون قراءة. توقف. اقرأ السطرين. ثم أرسل واحداً.',
          'إن شوّشتك، أوقفها. اختياري يعني اختياري.',
        ],
      },
      {
        heading: '٦. اقرأ مرة قبل الإرسال',
        paragraphs: [
          'مرور واحد للمعنى، لا للمكانة. هل أجبت السؤال؟ هل نجا خلل تخطيط؟ هل غيّر اقتراح رقماً أو تاريخاً؟',
          'الكمال مماطلة. التواصل هو العمل.',
        ],
      },
      {
        heading: '٧. دع التمرين لوقت لاحق',
        paragraphs: [
          'إن كنت تهتم بتحسين الإنجليزية على أشهر، راجع التصحيحات المقبولة في اللوحة حين لا تكون في دردشة حيّة. لا تحوّل كل واتساب إلى درس.',
          'الحقل للإرسال. المختبر وواجهات التقدّم لمن يريد الحلقة الأطول. أبقها في ساعاتهم.',
        ],
      },
    ],
  },
  'stay-in-the-inbox': {
    title: 'أنهِ الرسالة في صندوق الوارد',
    excerpt:
      'جيميل والمستندات وواتساب ويب هي حيث الكتابة تحدث أصلاً. رفيق يجبرك على مغادرة تلك الصفحات يحل المشكلة الغلط.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'الرسالة أصلاً في جيميل. التعليق أصلاً في المستند. الرد أصلاً في واتساب ويب. فتح تبويب جديد «لإصلاح الكتابة» يبدو منتجاً. غالباً تأخير متخفٍّ في جودة.',
          'فلو لاري إضافة كروم عن قصد. المهمة الجلوس في تلك الحقول: إصلاح اللوحة الغلط، اقتراحات إنجليزية تراجعها، ترجمة عندما تطلب. ليس محرراً ثانياً يصير المكان الحقيقي الذي تكتب فيه.',
        ],
      },
      {
        heading: 'لماذا يفشل اللصق ذهاباً وإياباً',
        paragraphs: [
          'تنسخ فقرة، تمرّرها على مدقّق، تلصقها. تتزحزح التنسيقات. تتوتر بكسل تتبع في عميل بريد. يفقد نموذج التركيز ويسقط مسودتك. أو تصقل حتى لا تعود النبرة تطابق الخيط فوق.',
          'المساعدة في الحقل تبقي الصندوق نفسه والخيط نفسه وزر الإرسال نفسه. ترى الاقتراح على الكلمات التي ستخرج فعلاً.',
        ],
      },
      {
        heading: 'ما لا يغطيه «في الحقل»',
        paragraphs: [
          'وورد الأصلي على سطح المكتب، وبعض متصفحات الامتحان المغلقة، وصندوق عنوان كروم، وحقول نظام التشغيل خارج الإضافة. إن عشت هناك فلن يتبعك فلو لاري، ولن نعلن أنه يفعل.',
          'الصدق هنا جزء من المنتج. الكتّاب يخططون يومهم على سطوح حقيقية، لا شعار.',
        ],
      },
      {
        heading: 'اختصارات بدل البحث',
        paragraphs: [
          'حين تكون المساعدة في الصفحة، ما زال يجب الوصول إليها دون كنز مخفي. النافذة للحالة. اختصارات للإصلاح والاقتراح والترجمة. صندوق السرعة حين تحتاج الاختيار. بطاقات ترفضها من لوحة المفاتيح.',
          'إن اضطررت لتحريك الفأرة عبر الشاشة لقبول كل إصلاح، ستغلق الرفيق. السرعة احترام لصندوق الوارد.',
        ],
      },
      {
        heading: 'أرسل من المكان نفسه',
        paragraphs: [
          'الاختبار بسيط: هل أنهيت الرسالة حيث بدأت؟ إن نعم، أدى الرفيق عمله حتى لو رفضت نصف الاقتراحات.',
          'مغادرة الوارد لتصير كاتباً أفضل بعد ظهر آخر. إرسال البريد هو هذا.',
        ],
      },
    ],
  },
  'what-flowlary-will-not-claim': {
    title: 'ما لن يدّعيه فلو لاري',
    excerpt:
      'لا إنجليزية كاملة. لا إعادة كتابة صامتة لكل الرسالة. لا سحر على مستوى النظام خارج كروم. قصص هذا الموقع يجب أن تطابق المنتج الذي يمكنك استخدامه.',
    sections: [
      {
        heading: '',
        paragraphs: [
          'صفحات التسويق تحب وعد التحوّل. الكتّاب ثنائيو اللغة سمعوا ذلك. نفضّل سرد الرفض. هكذا تعرف أن بقية الموقع ليست مسرحاً.',
          'فلو لاري رفيق كتابة في كروم للعربية والإنجليزية. يساعد في الحقل. تراجع قبل أن يُطبَّق شيء. هذا الادعاء. وهذا ما يقع خارجه.',
        ],
      },
      {
        heading: 'ليست إنجليزية كاملة',
        paragraphs: [
          'الاقتراحات قد تخطئ أو تتصلّب أو تتحمّس زيادة. قد تفوت اللهجة والفكاهة والسجل التقني. عاملها كعين ثانية، لا كشهادة.',
          'إن بدت صفحة في هذا الموقع وكأننا نضمن نثراً أصلياً، فالصفحة قديمة. أخبرنا من الملاحظات. سنصلح النص.',
        ],
      },
      {
        heading: 'ليس مؤلفاً صامتاً',
        paragraphs: [
          'لن نطرح وضعاً يعيد كتابة رسالتك كلها بلا مراجعة ونسمّيه ذكاء. مساعدة لا تراها هي شخص آخر يتكلم باسمك.',
          'التطبيق قرار. الرفض قرار. كلاهما درجة أولى.',
        ],
      },
      {
        heading: 'ليس في كل مكان تكتب فيه',
        paragraphs: [
          'تصل الإضافة إلى معظم حقول الويب. لا تستبدل لوحة نظام التشغيل. لا تعيش في كل تطبيق أصلي. الترجمة المباشرة مغلقة حتى تشغّلها. إدراج متجر كروم يُنشر حين يُنشر — لا نخترع رابط متجر على الموقع.',
          'الحدود ليست حاشية. هي كيف تقرر إن كان فلو لاري يناسب طريقة عملك أصلاً.',
        ],
      },
      {
        heading: 'يجب أن تبقى القصص صادقة',
        paragraphs: [
          'هذه المدونة موجودة ليمشي المنتج بخطوة بشرية: اللوحة الغلط، الحقل المختلط، ترجمة اختيارية، صندوق السرعة، عادات، الوارد، الصدق. إن سبقت قصة البرنامج، فالقصة هي ما يتغيّر.',
          'اكتب حيث أنت. راجع ما نعرضه. أبقِ الجملة التي لك.',
        ],
      },
    ],
  },
} as const satisfies { readonly [K in keyof typeof blogStoriesEn]: BlogStory }
