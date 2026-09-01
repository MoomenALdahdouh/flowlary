export function deepMerge<T extends Record<string, unknown>>(base: T, overrides: Partial<T>): T {
  const result = { ...base }
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const overrideValue = overrides[key]
    const baseValue = base[key]
    if (
      overrideValue &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue) &&
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>,
      ) as T[keyof T]
    } else if (overrideValue !== undefined) {
      result[key] = overrideValue as T[keyof T]
    }
  }
  return result
}
