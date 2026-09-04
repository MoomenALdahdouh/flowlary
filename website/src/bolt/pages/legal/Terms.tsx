import PageHeader from '@/bolt/components/ui/PageHeader';

export default function Terms() {
  return (
    <>
      <PageHeader
        label="Legal"
        title="Terms of Service"
        subtitle="Last updated: September 2026"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Terms' }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-3xl prose-flow">
            <h2>Acceptance of terms</h2>
            <p>
              By installing the Flowlary Chrome extension, creating an account, or using any Flowlary service, you agree to these terms. If you do not agree, please do not use Flowlary.
            </p>

            <h2>What Flowlary is</h2>
            <p>
              Flowlary is a Chrome writing companion that offers keyboard layout repair, English writing suggestions, translation, and related features. It is a tool to assist your writing — not a guarantee of correctness. You are responsible for the content you write.
            </p>

            <h2>Your account</h2>
            <p>
              You must provide accurate information when creating an account. You are responsible for keeping your password secure and for all activity under your account.
            </p>

            <h2>Acceptable use</h2>
            <ul>
              <li>Do not use Flowlary to produce harmful, abusive, or illegal content.</li>
              <li>Do not attempt to reverse-engineer, decompile, or extract the underlying models.</li>
              <li>Do not abuse the service by circumventing daily limits or automated restrictions.</li>
              <li>Do not resell or redistribute Flowlary as a service without permission.</li>
            </ul>

            <h2>Free and Pro plans</h2>
            <p>
              The Free plan is available at no cost with daily allowances. The Pro plan is a paid subscription billed monthly or yearly. The student program offers Pro-level access to eligible students for one year at no cost.
            </p>

            <h2>Subscriptions and billing</h2>
            <p>
              Pro subscriptions renew automatically until cancelled. You can cancel any time from your account settings. Cancellation takes effect at the end of your current billing period — no partial refunds unless you cancel within the first 14 days.
            </p>

            <h2>One writing check</h2>
            <p>
              A "writing check" is defined as one successful analysis of your text, regardless of how many suggestions are returned. Daily limits apply to AI-powered checks only. Keyboard layout repair and the Speed Box are unlimited on all plans.
            </p>

            <h2>No warranty</h2>
            <p>
              Flowlary is provided "as is" without warranties of any kind. We do not guarantee that suggestions are correct, that the service will be uninterrupted, or that it will meet your specific needs. You review all suggestions before applying them.
            </p>

            <h2>Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Flowlary's liability is limited to the amount you paid in the preceding 12 months, or $50, whichever is greater. We are not liable for indirect or consequential damages.
            </p>

            <h2>Changes to terms</h2>
            <p>
              We may update these terms as the service evolves. We will notify you of significant changes by email and post the updated terms here with a new date.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about these terms? Email us at legal@flowlary.com or visit our <a href="/contact" className="text-sky-600 dark:text-sky-400 hover:underline">Contact page</a>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
