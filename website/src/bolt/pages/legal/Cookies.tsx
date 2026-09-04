import PageHeader from '@/bolt/components/ui/PageHeader';

export default function Cookies() {
  return (
    <>
      <PageHeader
        label="Legal"
        title="Cookies Policy"
        subtitle="Last updated: September 2026"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Cookies' }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-3xl prose-flow">
            <h2>Our approach to cookies</h2>
            <p>
              We use cookies minimally. We do not use advertising cookies, tracking cookies, or third-party analytics that profile you across the web. Here is exactly what we use and why.
            </p>

            <h2>Essential cookies</h2>
            <p>
              These cookies keep you signed in and remember your preferences. Without them, Flowlary cannot function as a signed-in service.
            </p>
            <ul>
              <li><strong>Session cookie:</strong> Keeps you signed in between page loads. Deleted when you close your browser.</li>
              <li><strong>Preference cookie:</strong> Remembers your settings (theme, feature toggles). Persists for 30 days.</li>
              <li><strong>CSRF token:</strong> Protects forms from cross-site request forgery. Deleted when you close your browser.</li>
            </ul>

            <h2>What we do not use</h2>
            <ul>
              <li>No advertising cookies (Google Ads, Facebook Pixel, etc.)</li>
              <li>No cross-site tracking cookies</li>
              <li>No third-party analytics that profile you</li>
              <li>No fingerprinting technologies</li>
            </ul>

            <h2>Managing cookies</h2>
            <p>
              You can clear cookies in your browser settings at any time. Clearing cookies will sign you out and reset your preferences. Essential cookies cannot be disabled if you want to use signed-in features.
            </p>

            <h2>Chrome extension storage</h2>
            <p>
              The Flowlary Chrome extension uses Chrome's local storage to save your per-site preferences and settings. This data stays on your device and is not transmitted to our servers unless you choose to sync your account.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about cookies? Email us at privacy@flowlary.com or visit our <a href="/contact" className="text-sky-600 dark:text-sky-400 hover:underline">Contact page</a>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
