import { FLOWLARY_PRICING } from '@flowlary/shared'
import { Button } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'
import { emitPricingEvent } from '../../lib/pricingEvents.ts'

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.2 6.4 11l6.1-6.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type StudentProgramSectionProps = {
  signedIn: boolean
}

export function StudentProgramSection({ signedIn }: StudentProgramSectionProps) {
  const t = useMessages()
  const s = t.pricing.student
  const vars = { count: FLOWLARY_PRICING.proDailyCredits }
  const verifyHref = signedIn ? '/account?student=1' : '/account?mode=register&intent=student'

  return (
    <Reveal>
      <section id="students" className="pr-surface pr-student" aria-labelledby="pr-student-title">
        <div className="pr-student-copy">
          <p className="pr-plan-kicker">{s.kicker}</p>
          <h2 id="pr-student-title">{s.title}</h2>
          <p className="pr-card-body">{s.body}</p>
          <p className="pr-student-lead">{s.lead}</p>
          <ul className="pr-student-list">
            {s.items.map((item) => (
              <li key={item}>
                <CheckIcon />
                <span>{fill(item, vars)}</span>
              </li>
            ))}
          </ul>
          <p className="pr-student-note">{s.noCard}</p>
        </div>
        <div className="pr-student-actions">
          <Button
            to={verifyHref}
            className="pr-card-btn"
            onClick={() => emitPricingEvent('student_cta_click')}
          >
            {s.cta}
          </Button>
          <Button variant="secondary" to="#pr-compare" className="pr-card-btn">
            {s.secondary}
          </Button>
          <p className="pr-card-note">{s.accountNote}</p>
        </div>
      </section>
    </Reveal>
  )
}
