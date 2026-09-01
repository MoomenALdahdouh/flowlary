# Flowlary Phase 1E — Arabic Product Localization & Copy Quality

**Date:** 2026-08-30  
**Scope:** Arabic product language, UX copy, terminology consistency, diacritics policy, dashboard Arabic gap  
**Out of scope (unchanged):** UI design, routes, APIs, billing logic, extension engines, English copy

---

## 1. Arabic Localization Problems Found

### Structural / architecture

| Problem | Severity | Notes |
|---------|----------|-------|
| Website dashboard used `dashboard: en.dashboard` | **Critical** | Arabic UI shell with English dashboard copy |
| Extension Arabic catalog was partial (~40% keys) | **High** | Many popup/dashboard strings fell back to English |
| Two independent Arabic catalogs (website + extension) | **Medium** | Terminology drift (tagline, nav labels, learning terms) |
| Website vs extension locale not synced | **Medium** | Pre-existing; documented, not changed in this phase |
| Web learning coach hardcoded `locale="en"` | **Medium** | Pre-existing; AI output stays English when UI is Arabic |

### Copy quality

| Problem | Examples found |
|---------|----------------|
| Literal “flow” translation | «ابق في التدflowق»، «حافظ على تدflowقك»، «تدflowق واحد للكتابة» |
| English-structure learning headlines | «كتابتك تصبح درساً في الإنجليزية»، «كتابتك تصبح درسك الإنجليزي المخصص» |
| Awkward product CTAs | «احصل على Flowlary» |
| Technical / documentation tone | «الذكاء المُدار»، «يتم تنفيذ» patterns in status copy |
| Inconsistent feature term | Mixed **المزايا** vs **الميزات** |
| Inconsistent learning term | Mixed **تعلّم** (with shadda) vs **التعلم** |
| Unnecessary harakat / tashkīl | Widespread in both catalogs (425+ instances in website alone) |
| Developer messages in extension UI | English `npm run dev:api` in `system.serviceUnavailableDesc` (English fallback path) |

### Typography / RTL

- RTL configuration was already correct (`html[dir='rtl']`, shared tokens, Arabic font stack).
- No RTL logic changes were required for this phase.
- Mixed-direction strings like `العربية ← الإنجليزية` were preserved where already correct.

---

## 2. Terminology Decisions

| Concept | Arabic term | Rationale |
|---------|-------------|-----------|
| Features (product) | **المزايا** | Modern SaaS convention; unified across nav, pages, extension |
| Home (nav) | **الرئيسية** | Standard product nav |
| Practice | **التدريب** | Clear learning-product language (extension had «التمرين») |
| Progress | **التقدم** | Natural, consistent |
| Report | **التقرير** | Shorter than «تقرير التعلم» in nav contexts |
| Recurring patterns | **الأخطاء المتكررة** | User-facing meaning over literal «أنmاط متكررة» |
| Areas to improve | **جوانب تحتاج تحسين** | Human dashboard language |
| Writing Lab | **مساحة الكتابة** | Less clinical than «مختبر الكتابة» |
| Learning (noun) | **التعلم** | One spelling, no shadda |
| Correction | **تصحيح / تصحيح الكتابة** | Context-dependent |
| Translation | **الترجمة** | |
| Live translation | **الترجمة الفورية / المباشرة** | «الفورية» in compact UI |
| Keyboard layout | **تخطيط لوحة المفاتيح** | Established product term |
| Speed Box | **صندوق السرعة** | Brand-adjacent, kept |
| Apply (suggestion) | **اعتماد** | Natural button label vs mechanical «تطبيق» |
| Primary CTA | **ابدأ مع Flowlary** | Product tone vs «احصل على» |
| AI checks | **فحص كتابة** / **فحوصات الكتابة** | Existing pricing terminology retained |
| Coach | **مدرب التعلم** | No literal «coaching» loanword in UI |

**Policy:** No harakat (َ ِ ُ ً ٍ ٌ ْ ّ) in normal UI/marketing copy.

---

## 3. Marketing Copy Changes (Website)

Key rewrites in `marketingHome`, legacy `home`, `featuresPage`, `about`, `footer`:

| Area | Before (representative) | After |
|------|-------------------------|-------|
| Hero title | «اكتب أينما كنت. وحافظ على تدflowقك.» | «اكتب أينما كنت. واصل دون انقطاع.» |
| Learn section | «كتابتك تصبح درساً في الإنجليزية.» | «حوّل كتابتك اليومية إلى فرصة للتحسن.» |
| Learn lead | Mechanical list of features | «Flowlary يلاحظ الأخطاء المتكررة…» |
| Footer tagline | «ابق في التدflowق» | «واصل دون انقطاع» |
| Communicate | «بدّل اللغة، لا الأداة» | «بدّل اللغة دون مغادرة ما تعمل عليه» |
| Why Flowlary | «داخل تدflowق كتابتك» | «ضمن سياق كتابتك» |
| Home hero note | «كتابتك تصبح درسك الإنجليزي المخصص» | «Flowlary يتعلم من أخطائك المتكررة…» |
| Primary CTA | «احصل على Flowlary» | «ابدأ مع Flowlary» |
| Brand tagline | «رفيقك للكتابة بالذكاء الاصطناعي» | «رفيقك الذكي للكتابة والتعلم» |

---

## 4. UI Copy Changes (Website)

- **Navigation:** `writingLab` → «مساحة الكتابة»
- **Account:** welcome/create leads rewritten to learning-product tone
- **Features terminology:** 13× «الميزات» → «المزايا»
- **Popup preview:** «الذكاء المُدار» → «Flowlary AI جاهز»
- **Guide/support install references:** aligned to «ابدأ مع Flowlary»
- **Global:** all Arabic diacritics removed from `website/src/i18n/ar.ts`

---

## 5. Extension Copy Changes

Expanded and rewrote `extension/src/popup/i18n/ar.ts`:

| Surface | Changes |
|---------|---------|
| Nav | «التمرين» → «التدريب»، «تقرير التعلم» → «التقرير» |
| Popup features | Full Arabic labels for correction, translation, live, layout |
| System status | «الخدمة غير متاحة» — **removed** developer `npm run dev:api` from Arabic override |
| Usage UX | «تعذر الاتصال بـ Flowlary AI» instead of «تعذر الوصول» |
| Learning report | «الأخطاء المتكررة»، «جوانب تحتاج تحسين» |
| Card actions | «اعتماد» / «تجاهل» |
| Activity, shortcuts, readiness, master toggle | New Arabic overrides added |
| Brand tagline | Aligned with website |

---

## 6. Dashboard Copy Changes

**Website dashboard** — replaced `dashboard: en.dashboard` with full Arabic section (~115 keys):

- Nav: الرئيسية، التدريب، التقدم، التقرير، الإعدادات، الحساب
- Overview: «مركز التعلم»
- Progress: «الأخطاء المتكررة»
- Report: «جوانب تحتاج تحسين»، «نقاط القوة»
- Practice/settings/coach/brief: natural learning-product Arabic

**Extension dashboard** — uses same extension i18n catalog; nav and panel leads updated in `ar.ts`.

---

## 7. Typography / RTL Fixes

- **No CSS or layout changes** in this phase.
- Verified existing RTL stack: `uiLocales.ts`, `applyDocumentLocale()`, `html[dir='rtl']` styles, `--fl-font-arabic`.
- Preserved intentional mixed strings: `Flowlary AI`, `Pro`, `Chrome`, `العربية ← الإنجليزية`.
- Removed all harakat from user-facing Arabic strings in both catalogs.

---

## 8. Files Changed

| File | Change |
|------|--------|
| `website/src/i18n/ar.ts` | Major Arabic copy rewrite, dashboard translation, diacritics removal, terminology |
| `extension/src/popup/i18n/ar.ts` | Expanded overrides, copy quality, diacritics removal, system message fix |
| `tests/unit/extension/i18n.test.ts` | Updated expected summary string (no harakat) |
| `docs/design/FLLOWLARY_PHASE_1E_ARABIC_LOCALIZATION.md` | This report |

---

## 9. Files Intentionally Not Changed

- `website/src/i18n/en.ts` and all other locale files
- RTL/CSS (`global.css`, `tokens.css`, `dashboard.css`, etc.)
- Demo sample Arabic in playground components (intentional demo content)
- `packages/shared/src/explanation/staticRuleLocales.ts` (AI explanation static rules)
- Backend providers (dynamic AI Arabic generation)
- Website dashboard components (`locale="en"` on coach — requires product/AI decision)
- `extension/src/features/shared/cardStrings.ts` (already delegates to i18n for `ar`)
- SEO `og:locale` hardcoding

---

## 10. Tests

| Test | Result |
|------|--------|
| `website/src/__tests__/i18n.test.ts` | **Pass** (5/5) — Arabic catalog complete, RTL, shape mirrors English |
| `tests/unit/extension/i18n.test.ts` | **Pass** (6/6) — merge, fallback, RTL direction |
| Extension build (`npm run build:ext`) | **Pass** |
| Website build (`npm run build:web`) | **Fail** — pre-existing TS error unrelated to i18n: `PricingShowcase.tsx` / `studentProActive` on `WebAccountView` |

---

## 11. Build Result

```
Extension: ✓ built successfully
Website:   ✗ tsc error in PricingShowcase.tsx (pre-existing, not introduced by Phase 1E)
i18n TS:   ✓ ar.ts compiles; catalog shape valid per tests
```

---

## 12. Remaining Arabic Localization Debt

| Item | Priority | Blocker |
|------|----------|---------|
| Extension ~50% keys still English fallback | High | Needs continued catalog expansion |
| Website/extension locale preference sync | Medium | Product decision + storage architecture |
| Web dashboard AI coach Arabic output | Medium | Component passes `locale="en"`; AI provider locale wiring |
| Learning report AI narration in Arabic | Medium | Backend + entitlement; not string-only |
| `staticRuleLocales.ts` Arabic explanations | Low | Mixed EN loanwords in some rules |
| Legal pages English-controlling notice | Low | By design until legal review |
| Persian (`fa`) shell uses Arabic script — separate QA | Low | Not Arabic product language |
| Shared `@flowlary/i18n` package to dedupe catalogs | Low | Architecture refactor — out of Phase 1E scope |
| Visual QA at 1440/1024/768/390 RTL light/dark | Medium | Manual browser pass recommended |
| Occasional «احصل على Pro» CTAs | Low | Acceptable for upgrade context; primary install CTA fixed |

---

## Appendix: BEFORE → AFTER Examples

### Marketing hero
- **Before:** «اكتب أينما كنت. وحافظ على تدflowقك.»
- **After:** «اكتب أينما كنت. واصل دون انقطاع.»

### Learning narrative
- **Before:** «كتابتك تصبح درساً في الإنجليزية.»
- **After:** «حوّل كتابتك اليومية إلى فرصة للتحسن.»

### Primary CTA
- **Before:** «احصل على Flowlary»
- **After:** «ابدأ مع Flowlary»

### Footer
- **Before:** «اكتب بوضوح. ابق في التدflowق.»
- **After:** «اكتب بوضوح. واصل دون انقطاع.»

### Extension service status
- **Before (EN fallback):** «Run npm run dev:api…»
- **After:** «Flowlary AI غير متاح مؤقتاً. حاول مرة أخرى بعد قليل.»

### Dashboard recurring patterns
- **Before (EN):** «Recurring patterns»
- **After:** «الأخطاء المتكررة»

### Harakat policy
- **Before:** «تعلّم الإنجليزية»، «جارٍ التحليل…»، «الملخّص»
- **After:** «تعلم الإنجليزية»، «جاري التحليل…»، «الملخص»

---

**Phase 1E complete.** No Phase 1F work started.
