import { Shield, Lock, Eye, Server, FileText } from 'lucide-react';
import PageHeader from '@/bolt/components/ui/PageHeader';

export default function Privacy() {
  return (
    <>
      <PageHeader
        label="Legal"
        title="Privacy Policy"
        subtitle="Last updated: September 2026"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Privacy' }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-3xl prose-flow">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Lock, title: 'Local-first', text: 'Keyboard repair runs in your browser' },
                { icon: Server, title: 'Minimal data', text: 'We only process what is needed' },
                { icon: Eye, title: 'No tracking', text: 'We do not sell or share your data' },
                { icon: Shield, title: 'Your control', text: 'Delete your data any time' },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-5">
                  <item.icon className="mb-3 h-6 w-6 text-sky-500 dark:text-sky-400" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>

            <h2 className="mt-12">Overview</h2>
            <p>
              Flowlary is a Chrome writing companion for bilingual writers. We take a minimal-data approach: we collect only what is necessary to provide the service, and we are transparent about what that means.
            </p>

            <h2>What runs locally</h2>
            <p>
              Keyboard layout repair and the Speed Box run entirely in your browser. The text you type is analyzed locally and never sent to our servers for these features. Your keyboard input for layout repair stays on your device.
            </p>

            <h2>What we process on our servers</h2>
            <p>
              AI-powered features — English writing help, translation, and live translation — require sending the relevant text to our servers for analysis. We process the text to generate suggestions or translations and return the result. We do not store the text beyond the time needed to process your request (typically under a few seconds).
            </p>

            <h2>Account data</h2>
            <p>
              If you create an account, we store your email address and account preferences. Your progress data (practice results, patterns, reports) is linked to your account and visible only to you.
            </p>

            <h2>What we do not do</h2>
            <ul>
              <li>We do not sell your data to third parties.</li>
              <li>We do not share your data for advertising purposes.</li>
              <li>We do not train AI models on your personal text without consent.</li>
              <li>We do not track your activity across other websites.</li>
            </ul>

            <h2>Cookies</h2>
            <p>
              We use essential cookies to keep you signed in and remember your preferences. We do not use advertising or tracking cookies. See our <a href="/cookies" className="text-sky-600 dark:text-sky-400 hover:underline">Cookies page</a> for details.
            </p>

            <h2>Your rights</h2>
            <p>
              You can request a copy of your data, request deletion of your account and associated data, or export your progress at any time. Contact us at privacy@flowlary.com to exercise these rights.
            </p>

            <h2>Children's privacy</h2>
            <p>
              Flowlary is not designed for children under 13. We do not knowingly collect data from children under 13. If you believe a child has provided us with personal data, contact us and we will delete it.
            </p>

            <h2>Changes to this policy</h2>
            <p>
              We may update this policy as Flowlary evolves. We will notify you of significant changes by email and post the updated policy here with a new date.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about privacy? Email us at privacy@flowlary.com or visit our <a href="/contact" className="text-sky-600 dark:text-sky-400 hover:underline">Contact page</a>.
            </p>

            <div className="mt-12 flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 p-5">
              <FileText className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                This is a summary of our privacy practices. For legal inquiries, contact privacy@flowlary.com.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
