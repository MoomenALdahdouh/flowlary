import { useState } from 'react';
import { Mail, MessageSquare, Check, Clock, MapPin } from 'lucide-react';
import PageHeader from '@/bolt/components/ui/PageHeader';
import CTASection from '@/bolt/components/ui/CTASection';

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      <PageHeader
        label="Contact"
        title="Get in touch"
        subtitle="Questions, partnership ideas, student program applications, or just want to say something. We read everything and respond within one business day."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Contact' }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <div className="grid gap-12 lg:grid-cols-3">
            {/* Info */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-6">
                <Mail className="mb-3 h-6 w-6 text-sky-500 dark:text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Email</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500">hello@flowlary.com</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-6">
                <Clock className="mb-3 h-6 w-6 text-sky-500 dark:text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Response time</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500">Within one business day</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-6">
                <MessageSquare className="mb-3 h-6 w-6 text-sky-500 dark:text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Student program</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500">Mention your school and we will guide you through verification.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-6">
                <MapPin className="mb-3 h-6 w-6 text-sky-500 dark:text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Location</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500">Remote team, building for bilingual writers worldwide.</p>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-2">
              {submitted ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-green-200 dark:border-green-500/30 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10/50 p-12 text-center">
                  <Check className="mb-4 h-12 w-12 text-green-500" />
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Message sent</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500">
                    Thank you for reaching out. We will get back to you within one business day.
                  </p>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                    className="btn-secondary mt-6"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-8">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-slate-500">Name</label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 outline-none transition-colors focus:border-sky-300 focus:bg-white dark:bg-slate-900 dark:bg-slate-950 focus:ring-2 focus:ring-sky-100"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-slate-500">Email</label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 outline-none transition-colors focus:border-sky-300 focus:bg-white dark:bg-slate-900 dark:bg-slate-950 focus:ring-2 focus:ring-sky-100"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-slate-500">Subject</label>
                    <input
                      type="text"
                      required
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 outline-none transition-colors focus:border-sky-300 focus:bg-white dark:bg-slate-900 dark:bg-slate-950 focus:ring-2 focus:ring-sky-100"
                      placeholder="What is this about?"
                    />
                  </div>
                  <div className="mt-4">
                    <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-slate-500">Message</label>
                    <textarea
                      required
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      rows={6}
                      className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 outline-none transition-colors focus:border-sky-300 focus:bg-white dark:bg-slate-900 dark:bg-slate-950 focus:ring-2 focus:ring-sky-100"
                      placeholder="Tell us what you need..."
                    />
                  </div>
                  <button type="submit" className="btn-primary mt-6 w-full">
                    Send message
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
