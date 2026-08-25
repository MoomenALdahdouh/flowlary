import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

const nav = [
  { href: "#verdict", label: "Verdict" },
  { href: "#sources", label: "What I could read" },
  { href: "#ewa", label: "Writing Assistant" },
  { href: "#missing", label: "The other two" },
  { href: "#conflicts", label: "Merge conflicts" },
  { href: "#plan", label: "Recommended plan" },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-[#f4f1ea]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              ZAIXOS · 25 Aug 2026
            </p>
            <p className="text-sm font-semibold text-zinc-900">Chrome extension merge check</p>
          </div>
          <nav className="flex flex-wrap gap-2 text-xs text-zinc-600">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full bg-white px-3 py-1 ring-1 ring-zinc-200 hover:bg-zinc-50"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="report-prose mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <section id="verdict" className="mb-12">
          <Badge tone="warn">Conditional — do not merge all three as-is</Badge>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            You can merge the writing tools. You should not fold all three products into one extension until the other two codebases are in the same repo.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
            This cloud session could fully audit only{" "}
            <strong className="font-medium text-zinc-800">English Writing Assistant</strong>{" "}
            (public GitHub).{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-[13px] ring-1 ring-zinc-200">
              ai-writing-translator
            </code>{" "}
            and{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-[13px] ring-1 ring-zinc-200">
              autofix-layout
            </code>{" "}
            are local folders on your machine and are not on public GitHub, Origin, or zaixos.com. A
            merge decision for those two is inferred from product shape, not from their source.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <Badge tone="good">Merge candidate</Badge>
                <CardTitle className="mt-2">Writing Assistant + Translator</CardTitle>
              </CardHeader>
              <CardBody>
                Same job: help someone type on the web. Same Chrome MV3 surface (content script on
                text fields, popup, Groq BYOK). English-only detection in the assistant is the main
                product conflict — solve it with modes, not a third extension.
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <Badge tone="warn">Keep separate unless it is UI glue</Badge>
                <CardTitle className="mt-2">Autofix Layout</CardTitle>
              </CardHeader>
              <CardBody>
                If this is RTL/page-layout repair or a general CSS fixer, Chrome Web Store
                single-purpose rules and a different DOM job argue for a separate listing. If it
                only positions the correction/translation overlay, fold it into the writing
                extension as a library, not a product.
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <Badge tone="info">Already a fourth product</Badge>
                <CardTitle className="mt-2">Do not mix in ACF</CardTitle>
              </CardHeader>
              <CardBody>
                ZAIXOS already ships Adaptive Content Filter as a privacy-first filter extension.
                That is a different purpose (blur/hide content). Do not combine it with writing
                tools.
              </CardBody>
            </Card>
          </div>
        </section>

        <section id="sources" className="mb-12">
          <h2 className="text-xl font-semibold text-zinc-900">What I could actually read</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Paths you named:{" "}
            <code className="rounded bg-white px-1 py-0.5 text-[13px] ring-1 ring-zinc-200">
              Moomen/Projects/ai-writing-translator
            </code>
            ,{" "}
            <code className="rounded bg-white px-1 py-0.5 text-[13px] ring-1 ring-zinc-200">
              Moomen/Projects/autofix-layout
            </code>
            ,{" "}
            <code className="rounded bg-white px-1 py-0.5 text-[13px] ring-1 ring-zinc-200">
              Moomen/CursorProjects/english-writing-assistant
            </code>
            . This agent runs on an empty Origin repo, so those disks were not mounted.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                <tr>
                  <td className="px-4 py-3 font-medium">github.com/MoomenALdahdouh/english-writing-assistant</td>
                  <td className="px-4 py-3">
                    Cloned and reviewed. Chrome MV3, TypeScript workspaces, Groq BYOK, v1.3.13, last
                    push 16 Aug 2026. Site listed as writing.zaixos.com.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">github.com/MoomenALdahdouh/ai-writing-translator</td>
                  <td className="px-4 py-3">404. Not in the public repo list (7 public repos).</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">github.com/MoomenALdahdouh/autofix-layout</td>
                  <td className="px-4 py-3">404. Same — unpublished / local only.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">github.com/ZAIXOS</td>
                  <td className="px-4 py-3">Org exists (zaixos.com). 0 public repositories.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">zaixos.com/products</td>
                  <td className="px-4 py-3">
                    Clinic OS, ZAIXOS Voice, Adaptive Content Filter. Writing Assistant and the
                    other two extensions are not listed.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">writing.zaixos.com</td>
                  <td className="px-4 py-3">
                    Did not return a page (empty response). Matches STORE.md: landing is not fully
                    live yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="ewa" className="mb-12">
          <h2 className="text-xl font-semibold text-zinc-900">English Writing Assistant — deep check</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            This is a real, relatively complete Chrome extension, not a stub. It is the natural
            merge host if you unify writing products.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Stack</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="list-disc space-y-1 pl-4">
                  <li>Manifest V3 via @crxjs/vite-plugin</li>
                  <li>npm workspaces: extension, optional Hono backend, @ewa/shared</li>
                  <li>React 19 popup, TypeScript 5, Vitest + Playwright</li>
                  <li>~49 TS/TSX files, 17 unit/e2e tests</li>
                  <li>Permissions: storage + Groq/API hosts; content scripts on all http(s)</li>
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Runtime shape</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="list-disc space-y-1 pl-4">
                  <li>Content script attaches to textarea / text input / contenteditable</li>
                  <li>Skips passwords, code editors (Monaco, CodeMirror, Ace)</li>
                  <li>Service worker: cache, abort, history, Groq or local /api/correct</li>
                  <li>Settings in chrome.storage.sync; API key in local only</li>
                  <li>Correction card in Shadow DOM, positioned under the field</li>
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Product rules that affect a merge</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="list-disc space-y-1 pl-4">
                  <li>English-only: non-English writing is skipped on purpose</li>
                  <li>Fields over 250 characters: no UI, no API</li>
                  <li>Two modes: suggestion box vs direct in-place rewrite</li>
                  <li>Google Docs / canvas editors: documented as unsupported</li>
                  <li>Cross-origin iframes: cannot inject</li>
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Shared pieces a translator would reuse</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    <code>InputAdapter</code> (textarea / input / contenteditable)
                  </li>
                  <li>Debounce + IME composition handling</li>
                  <li>Groq chat JSON path and key storage</li>
                  <li>Popup consent + history pattern</li>
                  <li>Host-style matching for the overlay</li>
                </ul>
              </CardBody>
            </Card>
          </div>
        </section>

        <section id="missing" className="mb-12">
          <h2 className="text-xl font-semibold text-zinc-900">The two unpublished extensions</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Without source I will not invent file lists. These are the merge-relevant questions the
            local repos must answer.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <Badge tone="info">Inferred</Badge>
                <CardTitle className="mt-2">ai-writing-translator</CardTitle>
              </CardHeader>
              <CardBody>
                <p>
                  Likely a Chrome MV3 writing/translate tool aimed at the same fields as the
                  assistant (you keep a separate Projects folder for it). If that is true, it
                  duplicates adapters, popup, key handling, and content-script injection.
                </p>
                <p className="mt-3 font-medium text-zinc-800">Must confirm in the repo:</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  <li>Does it translate the page, the selection, or the active input?</li>
                  <li>Same Groq key / same model, or a different provider?</li>
                  <li>Does it replace text or show a bilingual overlay?</li>
                  <li>Storage key prefix (collision with ewa_settings)?</li>
                  <li>Manifest permissions beyond storage + api.groq.com?</li>
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <Badge tone="warn">Highest uncertainty</Badge>
                <CardTitle className="mt-2">autofix-layout</CardTitle>
              </CardHeader>
              <CardBody>
                <p>
                  The name does not match a writing assistant. It may be (a) overlay positioning
                  for mixed LTR/RTL pages, (b) a page-wide RTL/layout fixer, or (c) a CSS/layout
                  debug tool. (a) belongs inside the writing extension. (b) and (c) are a different
                  Chrome Web Store purpose.
                </p>
                <p className="mt-3 font-medium text-zinc-800">Must confirm in the repo:</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  <li>Does it mutate arbitrary page CSS, or only your overlay?</li>
                  <li>Does it run on every site continuously?</li>
                  <li>Extra permissions: scripting, tabs, debugger, webNavigation?</li>
                  <li>Is it Chrome, VS Code, or a Node library?</li>
                </ul>
              </CardBody>
            </Card>
          </div>
        </section>

        <section id="conflicts" className="mb-12">
          <h2 className="text-xl font-semibold text-zinc-900">Conflicts if you ship one combined extension</h2>
          <ol className="mt-4 space-y-4 text-sm leading-6 text-zinc-700">
            <li className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="font-semibold text-zinc-900">1. English-only vs translate</p>
              <p className="mt-1 text-zinc-600">
                The assistant’s language detector refuses non-English text. A translator exists to
                handle that text. A naive merge would make one feature disable the other. The
                correct design is a pipeline: detect language → Correct (English) or Translate
                (other) → optional “translate then polish English”.
              </p>
            </li>
            <li className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="font-semibold text-zinc-900">2. Three content scripts on every page</p>
              <p className="mt-1 text-zinc-600">
                All three would likely inject on http://*/* and https://*/*. Overlays, debounce
                timers, and MutationObservers will fight: double API calls, stacked cards, broken
                cursor mapping. Merge means one content-script orchestrator, not three copies.
              </p>
            </li>
            <li className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="font-semibold text-zinc-900">3. Chrome Web Store single purpose</p>
              <p className="mt-1 text-zinc-600">
                Grammar + translation in the field you are typing is one purpose (“writing help”).
                Filtering the web (ACF) is another. Auto-fixing site layout/CSS is a third. Combining
                unrelated purposes is a common rejection reason. Keep layout-as-product separate.
              </p>
            </li>
            <li className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="font-semibold text-zinc-900">4. Storage, IDs, and listings</p>
              <p className="mt-1 text-zinc-600">
                Assistant already uses ewa_settings / ewa_groq_api_key / ewa_history. A merge needs
                one settings schema and one Groq key. Chrome cannot merge three store listings;
                users would install a new ID. Direct-edit vs translate-replace can clobber the same
                field if both run.
              </p>
            </li>
            <li className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="font-semibold text-zinc-900">5. Hosted API vs BYOK</p>
              <p className="mt-1 text-zinc-600">
                STORE.md still describes writing-api.zaixos.com; the live code prefers the user’s
                Groq key and only uses a local backend when unpacked. A merged product should pick
                one story (BYOK, hosted, or both) before another extension copies the old backend
                path.
              </p>
            </li>
          </ol>
        </section>

        <section id="plan" className="mb-16">
          <h2 className="text-xl font-semibold text-zinc-900">Recommended plan</h2>
          <div className="mt-4 space-y-3">
            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardHeader>
                <Badge tone="good">Do this</Badge>
                <CardTitle className="mt-2">One writing extension with modes</CardTitle>
              </CardHeader>
              <CardBody>
                Host: english-writing-assistant. Add Translate as a mode next to Box / Direct. Share
                adapters, debounce, Groq client, consent, and the correction card. Namespaced
                prompts: correct vs translate. One storage prefix, one popup, one store listing
                (“ZAIXOS Writing”).
              </CardBody>
            </Card>
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader>
                <Badge tone="warn">Do this only if true</Badge>
                <CardTitle className="mt-2">Absorb autofix-layout as overlay code</CardTitle>
              </CardHeader>
              <CardBody>
                If the project only keeps the suggestion row aligned on RTL sites, mixed fonts, or
                transformed parents, move that code into CorrectionCard / hostStyleAdapter. Do not
                give users a third toggle. If it rewrites host-page layout, ship it as its own
                extension (or drop it).
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <Badge tone="neutral">To finish the audit</Badge>
                <CardTitle className="mt-2">Attach the two local repos</CardTitle>
              </CardHeader>
              <CardBody>
                Push ai-writing-translator and autofix-layout to GitHub (private is fine) or start a
                new agent from those folders. I need each manifest.json, content-script entry, and
                README. Until then, treating all three as one Chrome package is a guess, not a
                merge.
              </CardBody>
            </Card>
          </div>

          <div className="mt-8 rounded-2xl bg-zinc-900 px-5 py-6 text-sm leading-6 text-zinc-200">
            <p className="font-semibold text-white">Bottom line</p>
            <p className="mt-2">
              Technically: yes, the writing assistant is built to absorb a translator. Product and
              store policy: merge writing + translate; keep layout-as-product and ACF out.
              Operationally: I could not certify translator or autofix-layout because those sources
              never reached this workspace.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
