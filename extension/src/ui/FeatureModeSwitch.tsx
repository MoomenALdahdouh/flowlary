import { t } from '../popup/i18n/index.ts'

type FeatureModeSwitchProps = {
  ariaLabel: string
  mode: 'box' | 'direct'
  disabled?: boolean
  directDesc: string
  cardDesc: string
  onChange: (next: 'box' | 'direct') => void
}

export function FeatureModeSwitch({
  ariaLabel,
  mode,
  disabled,
  directDesc,
  cardDesc,
  onChange,
}: FeatureModeSwitchProps) {
  return (
    <div className="fl-mode-switch" role="radiogroup" aria-label={ariaLabel}>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'box'}
        className={mode === 'box' ? 'is-active' : ''}
        disabled={disabled}
        onClick={() => onChange('box')}
      >
        <span className="fl-mode-title">{t('settings.suggestionCard')}</span>
        <span className="fl-mode-desc">{cardDesc}</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'direct'}
        className={mode === 'direct' ? 'is-active' : ''}
        disabled={disabled}
        onClick={() => onChange('direct')}
      >
        <span className="fl-mode-title">{t('settings.directEdit')}</span>
        <span className="fl-mode-desc">{directDesc}</span>
      </button>
    </div>
  )
}
