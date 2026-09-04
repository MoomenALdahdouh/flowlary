# Website UI releases

Two Bolt mockups were compared on 2026-09-04:

| | Zip A (`project-bolt-sb1-5awdsawk`) | Zip B (`project-bolt-sb1-gtcfhgf4`) |
|---|---|---|
| Palette | Teal + amber | Sky + teal |
| Hero | Centered headline, no live field | Split copy + Gmail keyboard-repair demo |
| Auth | Tabs inside a marketing split | Centered card, icon fields, install fallback |
| Coverage | Full mock of website + extension chrome | Marketing site + dedicated sign-in/up pages |

**Shipped look:** Zip B hero and sign-in/up, Zip A bilingual page coverage, wired to the real Flowlary routes, i18n, account API, and dashboard. No mock billing or fake review counts.

## Rollback to the previous website UI

Committed snapshot (does not include uncommitted local work from the same day):

```bash
git checkout website-ui-classic -- website/
```

Inspect without changing files:

```bash
git show website-ui-classic:website/src/pages/Home.tsx
```

Also available: tag `website-ui-bolt` (this look), `website-ui-classic` (previous), `website-2.0`, and `v1.3.0`.

## Forward

The Bolt-inspired overlay lives in `website/src/styles/bolt-release.css` (imported last from `global.css`).
