import { UI_LOCALE_OPTIONS } from '../i18n/types.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { t } from '../i18n/I18nProvider.tsx'
import type { UiLocale } from '../i18n/types.ts'

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()

  return (
    <label className="fl-lang-switcher">
      <span className="fl-sr-only">{t('settings.uiLanguage')}</span>
      <select
        aria-label={t('settings.uiLanguage')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as UiLocale)}
      >
        {UI_LOCALE_OPTIONS.map((item) => (
          <option key={item.code} value={item.code}>
            {item.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  )
}
