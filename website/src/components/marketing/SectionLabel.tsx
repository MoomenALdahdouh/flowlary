export function SectionLabel({
  children,
  tone = 'default',
}: {
  children: string
  tone?: 'default' | 'accent' | 'muted'
}) {
  return <p className={`hp-label tone-${tone}`}>{children}</p>
}
