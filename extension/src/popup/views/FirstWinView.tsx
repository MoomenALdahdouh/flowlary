import { useState } from 'react'
import { t } from '../i18n/index.ts'
import { getShortcutLabels } from '../shortcuts.ts'

export type FirstWinAnswers = {
  fixWrongTyping: boolean
  improveEnglishAuto: boolean
  arabicToEnglishMode: boolean
}

type FirstWinViewProps = {
  busy: boolean
  onSave: (answers: FirstWinAnswers) => void
  onSkip: () => void
}

export function FirstWinView({ busy, onSave, onSkip }: FirstWinViewProps) {
  const shortcuts = getShortcutLabels()
  const [fixWrongTyping, setFixWrongTyping] = useState(true)
  const [improveEnglishAuto, setImproveEnglishAuto] = useState(true)
  const [arabicToEnglishMode, setArabicToEnglishMode] = useState(false)

  return (
    <section className="fl-first-win" aria-labelledby="first-win-heading">
      <h2 id="first-win-heading" className="fl-first-win-title">
        {t('firstWin.title')}
      </h2>
      <p className="fl-first-win-lead">{t('firstWin.lead')}</p>
      <p className="fl-first-win-example">{t('firstWin.example')}</p>

      <fieldset className="fl-settings-fieldset">
        <legend>{t('firstWin.qLayout')}</legend>
        <label className="fl-first-win-choice">
          <input
            type="radio"
            name="fw-layout"
            checked={fixWrongTyping}
            onChange={() => setFixWrongTyping(true)}
          />
          {t('firstWin.yes')}
        </label>
        <label className="fl-first-win-choice">
          <input
            type="radio"
            name="fw-layout"
            checked={!fixWrongTyping}
            onChange={() => setFixWrongTyping(false)}
          />
          {t('firstWin.no')}
        </label>
      </fieldset>

      <fieldset className="fl-settings-fieldset">
        <legend>{t('firstWin.qEnglish')}</legend>
        <label className="fl-first-win-choice">
          <input
            type="radio"
            name="fw-en"
            checked={improveEnglishAuto}
            onChange={() => setImproveEnglishAuto(true)}
          />
          {t('firstWin.qEnglishAuto')}
        </label>
        <label className="fl-first-win-choice">
          <input
            type="radio"
            name="fw-en"
            checked={!improveEnglishAuto}
            onChange={() => setImproveEnglishAuto(false)}
          />
          {t('firstWin.qEnglishShortcut')}
        </label>
      </fieldset>

      <fieldset className="fl-settings-fieldset">
        <legend>{t('firstWin.qTranslate')}</legend>
        <label className="fl-first-win-choice">
          <input
            type="radio"
            name="fw-tr"
            checked={arabicToEnglishMode}
            onChange={() => setArabicToEnglishMode(true)}
          />
          {t('firstWin.yes')}
        </label>
        <label className="fl-first-win-choice">
          <input
            type="radio"
            name="fw-tr"
            checked={!arabicToEnglishMode}
            onChange={() => setArabicToEnglishMode(false)}
          />
          {t('firstWin.no')}
        </label>
      </fieldset>

      <button
        type="button"
        className="fl-action-btn fl-action-btn-primary fl-first-win-cta"
        disabled={busy}
        onClick={() => onSave({ fixWrongTyping, improveEnglishAuto, arabicToEnglishMode })}
      >
        {t('firstWin.save')}
      </button>

      <p className="fl-first-win-speedbox">
        {t('firstWin.speedBoxHint', { shortcut: shortcuts.speedBox })}
      </p>

      <button type="button" className="fl-link-btn fl-first-win-skip" onClick={onSkip}>
        {t('firstWin.skip')}
      </button>
    </section>
  )
}
