const FENCE = /^```[\s\S]*```$/m

export function isInsideMarkdownCode(text: string, offset: number): boolean {
  const before = text.slice(0, offset)
  const fenceOpens = (before.match(/```/g) ?? []).length
  return fenceOpens % 2 === 1
}

export function looksLikeMarkdownFence(text: string): boolean {
  return FENCE.test(text.trim())
}
