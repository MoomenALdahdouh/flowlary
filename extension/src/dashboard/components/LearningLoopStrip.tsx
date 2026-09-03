import { useI18n } from '../../popup/i18n/index.ts'

export function LearningLoopStrip() {
  const { messages } = useI18n()
  const copy = messages.dashboard.learningLoop

  return (
    <ol className="wd-learning-loop" aria-label={copy.aria}>
      {copy.steps.map((step, index) => (
        <li key={step.title}>
          <span className="wd-learning-loop-num">{index + 1}</span>
          <span className="wd-learning-loop-copy">
            <strong>{step.title}</strong>
            <span>{step.body}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
