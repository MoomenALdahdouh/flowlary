# Chrome Web Store — Short Description (draft)

Fix keyboard layout mistakes, improve English writing, and translate text — safely, in one extension.

---

# Chrome Web Store — Full Description (draft)

**Flowlary** helps you write clearly across languages and keyboard layouts — without switching between multiple tools.

## Keyboard layout correction
Typed on the wrong keyboard layout? Flowlary detects common Arabic/English (and other layout) mistakes and fixes them locally when possible. Use **Ctrl/Cmd+Shift+P** for a manual fix, or open the **Speed Box** with **Ctrl/Cmd+Shift+L** for manual conversion.

## Writing correction
Improve English grammar and spelling with AI-assisted suggestions. You provide your own **Groq API key** (BYOK). Correction requests go directly from your browser to Groq — Flowlary does not receive your key on its servers.

## Translation
Translate what you're writing with **Ctrl/Cmd+Shift+,**. Optional **live translation** can be enabled in settings (off by default).

## Safety first
Flowlary skips password fields, payment fields, code editors, and other sensitive inputs. You can pause the extension globally or exclude specific websites.

## History
A local history of recent corrections, translations, and layout fixes (privacy-gated, deletable).

## What Flowlary is not
- Not a guarantee of perfect grammar or translation
- Not a zero-latency tool — AI features depend on network and provider speed
- Not fully offline — translation and optional classifier fallback use configured APIs; correction uses Groq when enabled

## Permissions
- **storage** — save your settings, history, and cache locally
- **activeTab** — run shortcuts on the page you're typing in
- **clipboardWrite** — copy Speed Box conversion results
- **Host access** — Groq (correction BYOK), and configured translation/classifier APIs over HTTPS

Category suggestion: **Productivity**

Language: English (UI); supports multiple writing/translation languages
