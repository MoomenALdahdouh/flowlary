import { t } from '../popup/i18n/index.ts'
import type { HelpStyle } from '../core/state/StateManager.ts'

type ApplyHowSwitchProps = {
  value: HelpStyle
  disabled?: boolean
  onChange: (next: HelpStyle) => void
}

export function ApplyHowSwitch({ value, disabled, onChange }: ApplyHowSwitchProps) {
  const options: Array<{ id: HelpStyle; title: string; desc: string }> = [
    {
      id: 'auto',
      title: t('settings.directEdit'),
      desc: t('assistant.styleAutoDesc'),
    },
    {
      id: 'suggestions',
      title: t('settings.suggestionCard'),
      desc: t('assistant.styleBoxDesc'),
    },
    {
      id: 'shortcuts_only',
      title: t('assistant.style.shortcuts_only'),
      desc: t('assistant.styleShortcutsDesc'),
    },
  ]

  return (
    <div className="fl-mode-switch is-triple" role="radiogroup" aria-label={t('assistant.helpStyleLabel')}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={value === option.id ? 'is-active' : ''}
          disabled={disabled}
          onClick={() => onChange(option.id)}
        >
          <span className="fl-mode-title">{option.title}</span>
          <span className="fl-mode-desc">{option.desc}</span>
        </button>
      ))}
    </div>
  )
}
