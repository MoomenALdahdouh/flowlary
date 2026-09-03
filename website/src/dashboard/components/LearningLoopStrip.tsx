import { useMessages } from '../../i18n/index.tsx'

export function LearningLoopStrip() {
  const copy = useMessages().dashboard.learningLoop
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
