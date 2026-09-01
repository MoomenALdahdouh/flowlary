# Flowlary — Phase 1A  
## Product Positioning + UX + Design Direction

**Document status:** RESEARCH / ANALYSIS / SPECIFICATION ONLY  
**Date:** 2026-08-30  
**Prerequisite:** `FLLOWLARY_PHASE_0_BASELINE.md`  
**Code changes in this phase:** NONE (this markdown file only)

**Label legend:**

| Label | Meaning |
|-------|---------|
| **VERIFIED FACT** | Confirmed in Phase 0 / repository |
| **INFERENCE** | Reasonable conclusion from product structure |
| **RECOMMENDATION** | Proposed direction for later phases — **not implemented** |
| **UNKNOWN / NOT VERIFIED** | Needs confirmation before implementation |

---

## 1. Executive Summary

Flowlary already works as a multi-surface writing companion: Chrome extension (everywhere writing), website (marketing + Writing Lab + account/learning), and server-backed AI, billing, and learning (**VERIFIED FACT**).

The product’s unique combination is not “another grammar AI.” It is:

1. **Help in the field you already use** (correction, translation, layout, Speed Box)  
2. **Without forcing a separate editor** for everyday writing  
3. **With a learning loop** that turns real corrections into practice, progress, and reports  

**RECOMMENDATION — positioning:**  
**Writing + learning companion** — lead with *flow / stay in one tool*, deepen with *your writing becomes your English lesson*.

**RECOMMENDATION — narrative IA:** Adopt **WRITE → COMMUNICATE → LEARN** as the primary story model across marketing and product chrome (not as new features).

**RECOMMENDATION — visual direction:** Evolve Snow (keep blue mark + light/dark), **reduce** glass/pills/atmosphere, prefer calm solid surfaces, one dominant action per surface, shared primitives across web + extension — **same mental model, different context**.

**Do not** merge dashboards into one codebase in early redesign phases. Align design language first.

---

## 2. Product Positioning

### 2.1 What Flowlary is — RECOMMENDATION grounded in VERIFIED FACT

**Flowlary is a Chrome writing companion that helps people write clearly, communicate across languages and keyboards, and improve English from the writing they already do.**

It is not only a corrector, not only a translator, not only an English course.

### 2.2 Problem it solves — VERIFIED FACT + RECOMMENDATION

**Problem:** Writing breaks down through constant small frictions — grammar slips, language switching, wrong keyboard layout, and tool-hopping (Phase 0 / current home copy).

**Outcome users want:** Stay in flow; send clearer English; communicate without leaving the page; gradually make fewer of the *same* mistakes.

### 2.3 Who it is primarily for — RECOMMENDATION

Primary niche (aligned with student offer + bilingual layout reality):

- International students and ESL/EFL learners  
- University students writing English academically and socially  
- Young professionals / remote workers writing English daily  
- People who switch languages and keyboard layouts (especially Arabic ↔ English)

Secondary: general Chrome writers who want one companion instead of three tools.

**Not primary:** children’s edtech; enterprise admin platforms; “AI startup” spectacle buyers.

### 2.4 Positioning options evaluated

| Option | Fit | Verdict |
|--------|-----|---------|
| AI writing assistant | Partial — correction exists, but underplays layout/translation/learning | Too generic; competitors own this frame |
| English learning companion | Strong depth — Lab, practice, coach, reports | Too narrow for first second; hides “everywhere write” |
| Communication assistant | Strong for translate/layout | Underplays English improvement loop |
| Personal English improvement system | Accurate for LEARN | Sounds like LMS; not Chrome companion |
| **Writing + learning companion** | Matches full capability set | **Recommended** |

### 2.5 Strongest positioning — RECOMMENDATION

**Primary:** Writing companion that keeps you in flow.  
**Differentiator:** Learning from *your* writing (recurring patterns → explain → practice → progress).  
**Proof:** Works in ordinary web fields + honest privacy/safety.

**Emotional feeling:** Calm confidence. Helpful intelligence. Trustworthy. Human. Premium but accessible.

**Should NOT feel like:** Generic purple AI SaaS; Grammarly clone messaging; children’s app; noisy analytics dashboard; enterprise control panel; hype “revolutionary AI.”

**Visual category:** Modern consumer productivity software with a personal learning layer — closer to a thoughtful writing tool than an AI landing-page template.

### 2.6 One-line and supporting lines — RECOMMENDATION

| Role | Line |
|------|------|
| Brand idea | Everything you need to write, in one flow. |
| Problem | Stop switching between writing tools. |
| Companion | Your writing companion, everywhere you write. |
| Learning | Your writing becomes your English lesson. |
| Free proof | 500 AI writing checks every day — free. |
| Student | Get Pro free for 12 months with academic email verification. |

**Current tension — VERIFIED FACT:** Hero copy is learning-first (“Learn English through your writing”) while product proof and SEO historically emphasized in-page flow. Phase 1A recommends **flow-first, learn-second** in the first viewport.

---

## 3. Core Product Narrative

### 3.1 Decision — RECOMMENDATION

**Yes: WRITE / COMMUNICATE / LEARN should become the primary information architecture for storytelling and product chrome.**

**Why:** It maps 1:1 to implemented capabilities (Phase 0 Appendix A), creates progressive disclosure, and prevents feature-grid equality (Speed Box ≠ Writing Correction ≠ Learning Coach).

It is a **narrative and hierarchy model**, not a demand for new routes or features.

### 3.2 Layer definitions

| Layer | User question | Capabilities (existing) | Prominence |
|-------|---------------|-------------------------|------------|
| **WRITE** | “Help me write better English here.” | Correction, spelling/grammar/wording, explanations, Writing Lab | Primary |
| **COMMUNICATE** | “Help me get the words across.” | Translation, live translation, keyboard layout, Speed Box | Secondary |
| **LEARN** | “Help me improve over time.” | Events, patterns, practice, progress, reports, coach, daily brief | Deep differentiator |

### 3.3 How the three appear across surfaces — RECOMMENDATION

| Surface | WRITE | COMMUNICATE | LEARN |
|---------|-------|-------------|-------|
| **Homepage** | Hero outcome + correction demo | Dedicated section after write | Major story section (not buried) |
| **Nav** | Via Features / product | Via Features | Via Features depth + Account when signed in; Student near Pricing |
| **Feature pages** | Writing correction page lead | Translation / live / layout / Speed Box | Cross-links to learning outcomes where honest |
| **Dashboard** | Writing Lab CTA + recent writing-derived insights | Light (status only if relevant) | Dominant: brief, practice, progress, report, coach |
| **Extension popup** | Correct action + correction toggle | Translate + layout + Speed Box hints | Soft: “patterns” / open dashboard — not full LMS in popup |
| **In-page** | Correction cards / direct edit | Translate/layout overlays, Speed Box | Recurring hint only when earned |
| **Onboarding / First Win** | Optional second path | **Layout fix first win** (already exists) | Invite after first value |
| **Pricing** | Free AI checks usefulness | Local tools unlimited narrative | Pro depth: coach, reports, practice depth |

### 3.4 Alternative considered and rejected

“Feature-first IA” (Correction | Translation | Layout | Learning as equal peers) — **rejected** because it flattens differentiation and matches the current cognitive overload risk.

---

## 4. Target Users

### A. New visitor

| | |
|--|--|
| **Primary goal** | Understand what Flowlary is and whether to install |
| **Most important action** | Get Flowlary (install) or see realistic demo |
| **Need** | Problem → solution → proof → CTA in seconds |
| **Do not need** | Webhook language, BYOK, full feature matrix, charts |
| **Confusion** | “Is this a website editor or a Chrome tool?” |
| **Ideal CTA** | Get Flowlary — Free |
| **Next step** | Install → First Win |

### B. New registered user

| | |
|--|--|
| **Primary goal** | Activate account, understand trial, verify email |
| **Most important action** | Verify email; optionally connect extension |
| **Need** | Plan status, trial days, daily checks, “what’s next” |
| **Do not need** | Full report empty states as “insights” |
| **Confusion** | Website vs extension account sameness |
| **Ideal CTA** | Install / open extension; try Writing Lab once |
| **Next step** | First real correction in Chrome |

### C. First-time extension user

| | |
|--|--|
| **Primary goal** | Feel value in &lt; 1 minute |
| **Most important action** | Fix Layout or run a clear correction |
| **Need** | One primary action; shortcut hint; skip path |
| **Do not need** | Full settings tour; billing essay |
| **Confusion** | “Nothing happens” on unsupported fields |
| **Ideal CTA** | Try Fix Layout (existing First Win) |
| **Next step** | Soft sign-in; open dashboard later |

### D. Returning user

| | |
|--|--|
| **Primary goal** | Write with help available; resume learning |
| **Most important action** | Continue writing with controls ready |
| **Need** | Status (paused/site), usage if relevant, open dashboard |
| **Do not need** | Re-onboarding |
| **Confusion** | Credits exhausted vs product broken |
| **Ideal CTA** | Context-dependent (retry / practice / upgrade) |
| **Next step** | Write or practice one pattern |

### E. Active learner

| | |
|--|--|
| **Primary goal** | Reduce recurring mistakes |
| **Most important action** | Practice recommended pattern |
| **Need** | Clear “focus today,” explanation, practice CTA |
| **Do not need** | 27 charts |
| **Confusion** | Fake-feeling metrics |
| **Ideal CTA** | Practice this pattern |
| **Next step** | Write again in the wild |

### F. Pro user

| | |
|--|--|
| **Primary goal** | Full capacity + depth features |
| **Most important action** | Use coach/reports/practice without friction |
| **Need** | Clear Pro state; billing manage; export |
| **Do not need** | Constant upgrade prompts |
| **Confusion** | Soft monthly cap vs daily limit |
| **Ideal CTA** | Manage billing (when needed) |
| **Next step** | Deepen learning loop |

### G. Student user

| | |
|--|--|
| **Primary goal** | Get/keep Pro via academic email verification |
| **Most important action** | Verify academic email |
| **Need** | Honest verification rules; expiry clarity |
| **Do not need** | Claims of “enrollment identity” beyond what backend does |
| **Confusion** | Academic email vs enrollment review path |
| **Ideal CTA** | Verify academic email |
| **Next step** | Use Pro depth; know what happens after 12 months |

---

## 5. Information Architecture

### 5.1 Current IA — VERIFIED FACT (Phase 0)

**Website nav:** Writing Lab · Features · How it works (`/#how`) · Pricing · About · Support (+ Account, Get Flowlary)  
**Account sections:** overview · practice · progress · report · settings · account  
**Extension popup:** First Win or Home (toggles, actions, usage, status)  
**Extension dashboard:** parallel learning panels + history/layout practice  

### 5.2 Proposed primary navigation — RECOMMENDATION

| Item | Destination | Notes |
|------|-------------|-------|
| Features | `/features` | Organized under WRITE / COMMUNICATE internally |
| How it works | `/guide` **or** `/#how` (pick one primary; avoid dual “how”) | Prefer durable `/guide` + home summary |
| Pricing | `/pricing` | Includes Free/Trial/Pro |
| Student | `/pricing#students` | Visible for niche; not a new business route |
| About | `/about` | |
| Support | `/support` | Install + help |

**Utilities:** Account · Locale · Theme · **Get Flowlary** (primary CTA)

**Demote from primary nav:** Writing Lab (keep as homepage section + dashboard entry — not a peer that steals “install” hierarchy).

### 5.3 Secondary / footer — RECOMMENDATION

Product (features, guide, pricing, student) · Account · Legal · Support · Blog only if content exists (otherwise hide or “Coming later” without fake posts).

### 5.4 Dashboard information hierarchy — RECOMMENDATION

1. **What should I do now?** (daily brief / recommended practice)  
2. **Coach insight** (short)  
3. **Write** (Writing Lab / extension connected)  
4. **Progress snapshot** (one useful signal)  
5. **Report** (progressive disclosure)  
6. Account / billing / settings  

### 5.5 Extension hierarchy — RECOMMENDATION

**Popup:** Status → primary actions (Correct / Translate / Fix layout) → feature toggles → usage if non-healthy → open dashboard  
**Dashboard:** Learning depth + history + settings + account  
**In-page:** Ephemeral assist UI only  

### 5.6 Settings hierarchy — RECOMMENDATION

Global pause / site controls → feature modes → language pairs → privacy/data → learning preferences → account/billing links  

### 5.7 Learning hierarchy — RECOMMENDATION

Focus today → Practice → Patterns → Progress → Report → Coach (assist, not replace focus)

**No new functionality invented** — reorder and emphasize existing modules.

---

## 6. Dashboard Strategy

### 6.1 Options

| Option | Verdict |
|--------|---------|
| A. Remain separate implementations forever with divergent UI | Reject — brand fracture |
| B. Share design language only | Necessary but incomplete alone |
| C. Converge into one conceptual system | **Yes — mental model** |
| D. Different density, shared primitives | **Yes — execution** |

### 6.2 Recommendation — RECOMMENDATION

**C + D:** One conceptual Flowlary learning home; **two implementations** for now (web under `/account`, extension options page).

| Dimension | Approach |
|-----------|----------|
| Visual language | Shared tokens, buttons, cards, section headers, empty/error states |
| Information density | Extension dashboard can be slightly denser; web slightly more spacious |
| Section model | Same names: Overview, Practice, Progress, Report, Settings, Account |
| Data | Keep existing sync/API contracts (**do not merge stores** in UI phases) |
| Code merge | **Not recommended** until design system stabilizes; high risk, low early ROI |

**Goal phrase:** *Same product. Same mental model. Same design language. Different context.*

---

## 7. Extension Strategy

### 7.1 Role — RECOMMENDATION

The extension is the **primary product**. The website markets, accounts, bills, and offers Writing Lab + learning mirror. The popup is a **cockpit**, not a second marketing site.

### 7.2 Popup — what is immediate

**Visible immediately:**

- Brand + global active/paused state  
- One primary “do something now” cluster: Correct · Translate · Fix layout  
- Feature on/off for core modes  
- Clear domain/field readiness when blocked  

**Secondary:**

- Mode switches (box/direct)  
- Language pair summary  
- Live translation (off-by-default messaging)  
- Speed Box hint / shortcut  

**Behind interaction / progressive:**

- Full learning analytics  
- Billing management  
- Deep settings  
- History  

### 7.3 First Win — RECOMMENDATION

Keep **fast path to Fix Layout** (existing). Avoid multi-step tours. After success: soft invite to sign in / enable correction — never block value.

### 7.4 In-page vs popup vs dashboard

| Belongs | Surface |
|---------|---------|
| Correction cards, apply/dismiss, short explanations | In-page |
| Speed Box overlay | In-page |
| Toggles, shortcuts, usage warnings, pause | Popup |
| Practice, progress, reports, history, data controls | Dashboard |
| Auth/billing deep work | Website account (extension links out) |

### 7.5 Usage & entitlement — RECOMMENDATION

When credits healthy: quiet.  
When low/exhausted: calm card — writing still works; local tools remain; AI resets per system rules; upgrade optional.  
Never imply the product is “broken.”

### 7.6 Learning feedback in extension — RECOMMENDATION

Lightweight only (e.g., “You’ve seen this pattern before”) → dashboard for practice. Popup is not a classroom.

### 7.7 Visual continuity — RECOMMENDATION

Same accent, radii scale, button anatomy, status colors, typography roles as website — scaled to ~360px width.

---

## 8. Visual Brand Direction

### 8.1 Evaluation of current elements

| Element | Decision | Concrete direction |
|---------|----------|-------------------|
| Blue accent / mark | **KEEP** | Primary brand; mark is coherent (`FLOWLARY_MARK`) |
| Light/dark themes | **KEEP** | Essential; marketing default may prefer light |
| Frost glass on chrome | **REDUCE** | Header/mobile sheet only; lower blur |
| Atmospheric gradients | **REDUCE** | One subtle wash max per page; no stacked glow |
| Pills (`999px`) | **REDUCE** | Buttons use intentional radius (e.g. lg), not stadium everywhere |
| Rounded cards | **EVOLVE** | Fewer cards; use when grouping interaction or plan choice |
| Heavy shadows | **REDUCE** | Soft elevation; no multi-layer glow stacks |
| Glass on product content | **REMOVE** (mostly) | Demos, Lab, dashboards → solid surfaces |
| Accent glow | **REDUCE** | Focus rings yes; ambient glow rare |

### 8.2 Personality — RECOMMENDATION

Calm · Intelligent · Friendly · Confident · Trustworthy · Premium-accessible · Human  

### 8.3 Concrete visual rules

| Topic | Direction |
|-------|-----------|
| **Surface philosophy** | Solid, quiet surfaces; glass reserved for floating chrome |
| **Contrast** | Strong text hierarchy; muted secondary; never low-contrast glass text |
| **Hierarchy** | One focal band per viewport; accent reserved for primary action + brand |
| **Density** | Marketing: airy. Dashboard: medium. Popup: compact but not cramped |
| **Whitespace** | Intentional section rhythm; avoid empty “luxury void” without content structure |
| **Borders** | Prefer hairline borders over shadows for cards |
| **Shadows** | Rare; overlays and sticky chrome only |
| **Blur** | Header/overlay ≤ current mid glass; never on dense forms |
| **Gradients** | Background atmosphere only; no gradient buttons as default |
| **Accent usage** | CTAs, links, focus, key status — not decorative fills |
| **Cards** | Interaction containers / plan choice / grouped settings — not every paragraph |
| **Iconography** | Simple line/geometric; consistent stroke; no emoji as UI |
| **Illustration** | Prefer **real product frames** (browser/field/popup) over abstract AI art |
| **Motion** | State and feedback only (see §14) |

---

## 9. Design Principles

1. **Flow before features** — First explain staying in one writing flow; features support that story.  
2. **Functionality before decoration** — If removing glass/glow/pill doesn’t hurt understanding, remove it.  
3. **One dominant action per surface** — Header: Get Flowlary. Popup: act on text. Overview: what to do today.  
4. **Progressive disclosure** — Depth (reports, modes, billing detail) on demand.  
5. **WRITE → COMMUNICATE → LEARN** — Never present all capabilities as equal tiles by default.  
6. **AI is assistive, not theatrical** — No fake “thinking universe”; clear working/success/error.  
7. **Learning feels useful, not academic** — Patterns and next practice beat chart walls.  
8. **Same product everywhere** — Web and extension share language, color roles, and component anatomy.  
9. **Honesty over hype** — Academic email verification, credit limits, privacy — accurate wording.  
10. **Calm confidence** — Quiet UI; urgency only for real blockers (auth, exhausted AI, unsupported field).  
11. **Accessibility is part of quality** — Focus, contrast, reduced motion, RTL are release criteria.  
12. **Protect the engine** — Visual change never bargains with auth, credits, billing, DOM safety, or API contracts.

---

## 10. Typography Strategy

### 10.1 Current — VERIFIED FACT

System stacks (Segoe / SF); RTL swaps to SF Arabic / Geeza / Tahoma; no marketing webfont; Noto Arabic for PDF export only.

### 10.2 Requirements — RECOMMENDATION

| Role | Requirement |
|------|-------------|
| Display | Distinctive but restrained; used sparingly on marketing heroes |
| Headings | Clear weight ladder; consistent line-height; no oversized empty heroes |
| Body | Highly readable 16px-class base on web; slightly smaller in popup |
| Labels | Small caps or medium weight labels — consistent kicker pattern |
| Numbers | Tabular lining for credits, prices, progress counts |
| Technical | Mono only for rare code/debug — not marketing |
| English | One product sans for UI; optional display for marketing only |
| Arabic | **First-class:** dedicated Arabic UI font (e.g. Noto Sans Arabic or equal), matched x-height/weight to Latin as far as practical |
| RTL | Mirrored layout; do not mirror directional icons incorrectly; demos labeled when content is LTR |

**Strategy:** Prefer **one Latin UI family + one Arabic UI family** loaded as subsets; keep system fallbacks. Do **not** implement in 1A.

**UNKNOWN:** Final font license/file choices — decide in Phase 1B/token phase.

---

## 11. Color Strategy

### 11.1 Keep blue as primary? — RECOMMENDATION

**Yes — evolve, don’t replace.**

**Why:** Mark, tokens, icons, and recognition already use blue (`#5b8cff` / `#315fd6` — **VERIFIED FACT**). Replacing hue now costs identity without fixing hierarchy problems. Evolve by **reducing blue glow**, tightening neutrals, and reserving blue for actions/brand.

### 11.2 Role model — RECOMMENDATION (no new hex mandate in 1A)

| Role | Purpose |
|------|---------|
| Brand / accent | Primary CTA, logo field, key links, focus |
| Accent soft | Selected nav, subtle highlights |
| Page background | Calm neutral (light) / deep neutral (dark) |
| Elevated surface | Forms, cards, demos, panels |
| Text primary / secondary / faint | Strict hierarchy |
| Border subtle / strong | Structure without heavy shadow |
| Success | Applied corrections, verified, healthy usage |
| Warning | Low credits, trial ending, soft caps |
| Error | Auth failure, AI unavailable, destructive |
| Learning states | Pattern categories (existing teach colors — evolve for contrast) |
| AI states | Working / ready / blocked — distinct from learning teach colors |
| Interactive | Hover/pressed/disabled — tokenized |

**Phase 1B** may propose refined hex values mapped onto existing `--fl-*` names to minimize churn.

---

## 12. Component Philosophy

### 12.1 Hierarchy — RECOMMENDATION

```
FOUNDATION (tokens: color, type, space, radius, elevation, motion)
  → PRIMITIVES (Button, IconButton, Input, Label, Checkbox, Toggle, Link)
  → COMPONENTS (Badge, Alert, Card, Tabs, Modal, Tooltip, EmptyState, Spinner)
  → PATTERNS (PageHeader, SectionHeader, PlanCard, UsageCallout, FAQ, Nav)
  → PAGE SECTIONS (Hero, FeatureBlock, LearnLoop, PricingGrid)
  → SURFACES (Marketing page, Account shell, Popup shell, Dashboard shell)
```

### 12.2 Current components disposition

| Item | Disposition |
|------|-------------|
| `Button` / `GetFlowlaryButton` | **EVOLVE** — unify variants; keep destination logic |
| `Badge` | **EVOLVE** |
| `Card` | **EVOLVE** — stricter when-to-use |
| `PageHero` | **EVOLVE** |
| `FactGrid` | **KEEP** or merge into Section pattern |
| `Logo` / `ThemeToggle` | **KEEP** |
| `Reveal` / `SectionLabel` | **EVOLVE** — motion + label consistency |
| Local `.pr-card-btn`, `.fl-action-btn`, `.wd-*` buttons | **MERGE** toward primitives over time |
| Local pills / chips | **MERGE** / **REDUCE** |
| Dashboard web vs extension cards | **EVOLVE** toward shared pattern names |
| `CapabilitySections` | **KEEP file** until Home rewrite; then **use or deprecate** intentionally |

**Do not** build a second component library or add a CSS framework in early phases.

---

## 13. Surface / Card / Glass Strategy

### 13.1 Elevation model — RECOMMENDATION

| Level | Name | Use |
|-------|------|-----|
| **0** | Page canvas | Background; minimal atmosphere |
| **1** | Surface | Main content regions, Lab, demo stage, dashboard panels |
| **2** | Elevated | Dropdowns, sticky header (light elevation), pricing highlight |
| **3** | Overlay | Mobile nav, Speed Box, modal/dialog, toast |

### 13.2 Glass rules

| Appropriate | Not appropriate |
|-------------|-----------------|
| Top marketing header (reduced) | Form interiors |
| Mobile nav sheet (reduced) | Dashboard data panels |
| Rare floating chrome | Long scrolling content cards |

### 13.3 Cards

- **Use** for plans, interactive groups, discrete settings clusters, popup sections.  
- **Avoid** wrapping every marketing paragraph.  
- **Prefer** border + surface color over shadow + blur.

### 13.4 Borders vs elevation

Default structure = border. Elevation = temporary layers and emphasis (Pro plan, overlays).

---

## 14. Motion Strategy

| Context | Direction |
|---------|-----------|
| Page transitions | Minimal; prefer instant route change + optional short fade on marketing only |
| Hover | 100–180ms ease; 1px lift max on interactive cards; none on dense tables |
| Focus | High-contrast ring; never rely on color alone |
| Loading | Inline spinner/skeleton; label “Working…” for AI |
| AI processing | Deterministic status text; no looping particle theater |
| Success | Brief check/confirm; don’t block |
| Error | Persist until dismissed/retry; announce to AT |
| Learning progress | Soft value change; no celebratory spam |
| Extension | Snappy; respect popup lifetime |
| Reduced motion | Honor `prefers-reduced-motion` (already baseline — **VERIFIED FACT**) |

**Principle:** Motion explains state change — never decorates emptiness.

---

## 15. Responsive Strategy

| Viewport | Behavior |
|----------|----------|
| **Desktop** | Two-column heroes; side-by-side plans; Lab/demo as stage |
| **Tablet** | Stack stages under copy; keep primary CTA sticky in header |
| **Mobile** | Single column; collapse nav to existing dialog pattern; pricing cards stack; Student block full-width; reduce demo chrome |
| **Popup (~360px)** | Vertical stack; primary actions first; no marketing prose |

**Hierarchy changes at small sizes:** Demo secondary to CTA; trust bullets → short list; charts → summary metrics first.

Do not “shrink desktop.” Re-prioritize.

---

## 16. Accessibility Strategy

Non-negotiables for redesign phases:

- Keyboard operability for all primary flows  
- Visible `:focus-visible`  
- Contrast meeting WCAG AA for text/UI  
- `prefers-reduced-motion` respected  
- Semantic headings/landmarks; skip link retained  
- Form errors associated and announced  
- Meaningful button names (not icon-only without label)  
- Touch targets adequate on mobile/popup  
- RTL layout intentional; Arabic typography first-class  
- Localization via existing i18n — no hardcoded English in new UI  

Build on Phase 0 a11y baseline (`a11y.css`, skip link, mobile focus trap — **VERIFIED FACT**).

---

## 17. Content / UX Writing

### 17.1 Voice — RECOMMENDATION

| Context | Voice |
|---------|-------|
| Brand | Clear, calm, specific, human |
| CTA | Action + outcome (“Get Flowlary — Free”, “Try Fix Layout”) |
| Error | Cause + next step + retry when possible |
| AI | Assistive (“Checking your writing…”) — not mystical |
| Learning | Practical coach (“Practice articles next”) — not school grades theater |
| Empty | Honest (“Not enough writing yet to find patterns”) |
| Billing | Plain + accurate; server-confirmed Pro; no fear |

### 17.2 Terminology rules

| Prefer | Avoid |
|--------|-------|
| AI writing checks | Vague “AI credits” without definition on first mention |
| Academic email verification | “Proof of enrollment” / “verified student identity” unless true |
| Pause Flowlary | Scary “disable forever” language |
| Local tools still work | “Product locked” when AI exhausted |
| Simulated demo | Presenting demo metrics as personal data |

### 17.3 Problematic / legacy terminology to retire in copy passes — INFERENCE from Phase 0 drift

- Over-technical webhook/API explanations in primary auth hero  
- “Managed AI / BYOK” in consumer pricing first screen  
- Inflated AI marketing adjectives  
- Dual outdated pricing language in old screenshots (ignore shots; trust `FLOWLARY_PRICING`)

**Do not rewrite every string in 1A** — apply rules in later copy phases.

---

## 18. Homepage Strategy

### 18.1 Ideal narrative — RECOMMENDATION (minimum effective)

| # | Section | Job |
|---|---------|-----|
| 1 | **Hero** | Problem + Flowlary solution + primary/secondary CTA + realistic product proof |
| 2 | **Product demonstration** | Sequence: write → correct → translate/layout → learn signal (simulated, labeled) |
| 3 | **Core value** | “One tool. Your entire writing flow.” |
| 4 | **WRITE** | Correction + explanations |
| 5 | **COMMUNICATE** | Translation + layout + Speed Box (compact) |
| 6 | **LEARN** | Recurring patterns → practice → progress (major differentiator) |
| 7 | **How it works** | Install → write → improve (short) |
| 8 | **Trust / privacy** | Safety fields, honest AI transmission |
| 9 | **Plans transition** | Free useful + Student + link to Pricing |
| 10 | **Final CTA** | Single close |

FAQ can live on Pricing/Support to reduce home length.

### 18.2 Hero specifics — RECOMMENDATION

- Lead with flow/problem, not LMS framing  
- Primary: Get Flowlary — Free  
- Secondary: See how it works → `#try-flowlary` or demo  
- Proof: product interaction (browser field / popup), not abstract art  
- Writing Lab: valuable **try-now** but should not monopolize first viewport on mobile; consider Lab as adjacent “Try on the web” after or beside demo  

### 18.3 Remove / demote for cognitive load — RECOMMENDATION

- Competing long section stacks that repeat “capabilities”  
- Unused dual demos without role clarity (playground vs Lab — assign roles)  
- Control/popup philosophy sections if they dilute LEARN story (merge or shorten)  
- Orphan capability modules not in the narrative  
- Nav emphasis on Writing Lab over install  

---

## 19. Dashboard Home Strategy

**Question to answer:** “What should I do today?”

### Recommended Overview order — RECOMMENDATION

1. **Daily brief** (focus + why)  
2. **Primary CTA** — Practice recommended pattern **or** Write (Lab/extension) if no pattern yet  
3. **Coach** — short, actionable  
4. **Extension status** — connected / not detected (one line + action)  
5. **Progress snapshot** — one or two signals, not a chart gallery  
6. Links to Report / full Progress  

**Avoid:** Equal-weight card walls; decorative charts; billing noise unless action required.

---

## 20. Design System Migration Strategy

**Do not rewrite the frontend.** Evolve tokens and primitives; restyle surfaces in order.

### Phase A — Foundation

| | |
|--|--|
| **Changes** | Evolve `--fl-*` tokens (radii, elevation, glass intensity, type roles); document usage; optional font strategy decision |
| **Untouched** | Backend, APIs, billing, engines, commercial constants |
| **Can break** | Visual regressions globally |
| **Verify** | Visual spot-check light/dark; `test:web`; extension smoke; no logic diffs |

### Phase B — Shared primitives

| | |
|--|--|
| **Changes** | Evolve `Button`, form controls, Alert, EmptyState, SectionHeader toward one anatomy; map extension classes to same tokens |
| **Untouched** | Click handlers, routes, Paddle |
| **Can break** | CTA tests / class assumptions |
| **Verify** | `test:web` buttons/routes; popup manual |

### Phase C — Marketing surfaces

| | |
|--|--|
| **Changes** | Home, Features, Guide, About, Support, Pricing presentation + IA/nav copy |
| **Untouched** | Checkout math, student API |
| **Can break** | SEO/demo tests, hash links |
| **Verify** | `test:web`; manual mobile/RTL; pricing amounts unchanged |

### Phase D — Account / dashboard

| | |
|--|--|
| **Changes** | Auth layout chrome; Overview hierarchy; shared dashboard patterns |
| **Untouched** | `client.ts` contracts, billing methods, learning compute |
| **Can break** | Account tests; session bridge if markup wraps incorrectly |
| **Verify** | Account tests; manual login/register; bridge still syncs |

### Phase E — Extension

| | |
|--|--|
| **Changes** | Popup, First Win chrome, usage/error presentation, dashboard CSS alignment |
| **Untouched** | DOM core, background AI, storage schemas, bridge protocol |
| **Can break** | Popup tests; messaging if structure ripped carelessly |
| **Verify** | Extension unit/integration; First Win manual; `build:release` |

### Phase F — Cleanup

| | |
|--|--|
| **Changes** | Remove dead CSS, unused marketing components, consolidate duplicate button classes |
| **Untouched** | Protected logic |
| **Can break** | Stray selectors |
| **Verify** | Full test suites + builds |

**Pre-condition — RECOMMENDATION:** Triage Phase 0 WL-1 extension test failure before large learning UI edits.

---

## 21. Success Criteria

Checklist for declaring redesign phases successful:

- [ ] Web + extension recognizable as one product (color, type roles, button anatomy, status language)  
- [ ] Fewer ad-hoc button/card variants (measurable consolidation over time)  
- [ ] Nav matches proposed IA (Student visible; Writing Lab demoted from primary peer)  
- [ ] WRITE / COMMUNICATE / LEARN readable on Home without feature-grid equality  
- [ ] Overview answers “what should I do today?” above the fold  
- [ ] No change to pricing amounts, credit limits, entitlement rules, API contracts  
- [ ] Auth, billing, student, bridge flows still work  
- [ ] `npm run test -w @flowlary/shared`, `test:web`, backend tests green  
- [ ] Extension tests green (including prior WL-1 issue resolved or waived with cause)  
- [ ] `build:web` and `build:release` green  
- [ ] Mobile + popup usable without horizontal overflow  
- [ ] RTL Arabic intentional (layout + type)  
- [ ] Focus visible; reduced motion respected  
- [ ] No fake metrics; demos labeled simulated where applicable  
- [ ] Commercial copy remains honest (academic email verification, server-confirmed Pro)

---

## 22. Design Red Flags

Avoid:

- Excessive glass, blur, glow, stacked gradients  
- Stadium pills on every chip/button  
- Animation for decoration  
- Dashboard clutter / chart vanity  
- Giant meaningless hero headlines  
- Generic AI aesthetics (purple nebula, robot mascots)  
- Fake social proof, fake metrics, invented awards  
- Competitor-comparison superiority claims  
- Changing product semantics to fit a layout  
- Redesigning backend, APIs, auth, billing, credits, DOM engines “while we’re here”  
- Merging dual dashboards’ data layers early  
- Hiding Free value to force upgrades  
- Claiming enrollment identity beyond academic email (+ optional review as actually implemented)  
- Hardcoding English in components  
- Shipping visual changes without running the Phase 0 test commands  

---

## 23. Recommended Phase 1B

**Phase 1B — Design tokens + primitive specification (still docs-first or minimal token-only if approved)**

Deliverables for 1B (upon approval):

1. Frozen positioning + IA decisions from this doc (checklist sign-off)  
2. Proposed token diff against current `--fl-*` (KEEP/RENAME/ADD) with example surfaces  
3. Primitive inventory: Button/Input/Alert/EmptyState/SectionHeader specs (anatomy, states)  
4. Glass/elevation level mapping to CSS variables  
5. Typography pairing proposal (Latin + Arabic) with loading strategy  
6. Explicit non-goals (no Home rewrite yet unless separately approved)  
7. Verification plan tied to Phase 0 commands  

**Do not start Phase 1B automatically.**

---

## Appendix — Decision summary for stakeholders

| Decision | Recommendation |
|----------|----------------|
| Positioning | Writing + learning companion; flow-first |
| Narrative | WRITE / COMMUNICATE / LEARN |
| Dashboards | Same mental model + design language; keep separate implementations for now |
| Extension | First-class cockpit; learning depth in dashboard |
| Brand color | Keep blue; reduce glow |
| Glass | Reduce; solid product surfaces |
| Migration | A→F foundation-first; no full rewrite |

---

*End of Phase 1A. Awaiting approval before Phase 1B or any implementation.*
