import { Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/index.tsx'
import { Layout } from './components/Layout.tsx'
import { HomePage } from './pages/Home.tsx'
import { FeaturesPage } from './pages/Features.tsx'
import { WritingCorrectionPage } from './pages/features/WritingCorrection.tsx'
import { TranslationPage } from './pages/features/Translation.tsx'
import { LiveTranslationPage } from './pages/features/LiveTranslation.tsx'
import { KeyboardLayoutPage } from './pages/features/KeyboardLayout.tsx'
import { SpeedBoxPage } from './pages/features/SpeedBox.tsx'
import { PricingPage } from './pages/Pricing.tsx'
import { AboutPage } from './pages/About.tsx'
import { CookiesPage } from './pages/LegalPages.tsx'
import { ContactPage } from './pages/Contact.tsx'
import { PrivacyPage } from './pages/Privacy.tsx'
import { TermsPage } from './pages/Terms.tsx'
import { SupportPage } from './pages/Support.tsx'
import { FeedbackPage } from './pages/Feedback.tsx'
import { FeedbackAdminPage } from './pages/admin/FeedbackAdmin.tsx'
import { SupportAdminPage } from './pages/admin/SupportAdmin.tsx'
import { AdminLayout } from './admin/AdminLayout.tsx'
import { AdminLoginPage } from './admin/AdminLoginPage.tsx'
import { AdminOverviewPage } from './admin/AdminOverviewPage.tsx'
import { AdminUsersPage } from './admin/AdminUsersPage.tsx'
import { AdminSubscriptionsPage } from './admin/AdminSubscriptionsPage.tsx'
import { AdminUsagePage } from './admin/AdminUsagePage.tsx'
import { AdminActivityPage } from './admin/AdminActivityPage.tsx'
import { AdminSettingsPage } from './admin/AdminSettingsPage.tsx'
import { GuidePage } from './pages/Guide.tsx'
import { BlogPage } from './pages/Blog.tsx'
import BlogPostPage from './bolt/pages/blog/BlogPost.tsx'
import { ProductPage } from './pages/Product.tsx'
import { TryPage } from './pages/Try.tsx'
import { LabPage } from './pages/Lab.tsx'
import { DashboardPage } from './pages/Dashboard.tsx'
import { DashboardSupportPage } from './pages/DashboardSupport.tsx'
import { AccountPage } from './pages/Account.tsx'
import { AccountSupportRedirect } from './components/AccountRedirects.tsx'
import { VerifyEmailPage } from './pages/VerifyEmail.tsx'
import { ForgotPasswordPage } from './pages/ForgotPassword.tsx'
import { ResetPasswordPage } from './pages/ResetPassword.tsx'
import { NotFoundPage } from './pages/NotFound.tsx'
import { ExtensionSessionSync } from './account/ExtensionSessionSync.tsx'
import { ThemeBoot } from './components/ThemeToggle.tsx'

export function App() {
  return (
    <I18nProvider>
      <ThemeBoot />
      <ExtensionSessionSync />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/product" element={<ProductPage />} />
          <Route path="/try" element={<TryPage />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/features/writing-correction" element={<WritingCorrectionPage />} />
          <Route path="/features/translation" element={<TranslationPage />} />
          <Route path="/features/live-translation" element={<LiveTranslationPage />} />
          <Route path="/features/keyboard-layout" element={<KeyboardLayoutPage />} />
          <Route path="/features/speed-box" element={<SpeedBoxPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUsersPage />} />
            <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="usage" element={<AdminUsagePage />} />
            <Route path="support" element={<SupportAdminPage />} />
            <Route path="activity" element={<AdminActivityPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="feedback" element={<FeedbackAdminPage />} />
            <Route path="growth" element={<Navigate to="/admin/settings" replace />} />
          </Route>
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/support" element={<DashboardSupportPage />} />
          <Route path="/account/support" element={<AccountSupportRedirect />} />
          <Route path="/account/verify-email" element={<VerifyEmailPage />} />
          <Route path="/account/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/account/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </I18nProvider>
  )
}
