/** Pick the last section whose top has crossed the sticky-header offset. */
export function resolveActiveSectionId(
  ids: readonly string[],
  getTop: (id: string) => number | null,
  offsetPx: number,
): string {
  let current = ''
  for (const id of ids) {
    const top = getTop(id)
    if (top == null) continue
    if (!current) current = id
    if (top - offsetPx <= 0) current = id
  }
  return current
}
