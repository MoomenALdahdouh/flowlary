export type LogFields = Record<string, string | number | boolean | undefined | null>

export function logInfo(event: string, fields: LogFields = {}): void {
  console.info(JSON.stringify({ level: 'info', event, ...fields, ts: Date.now() }))
}

export function logWarn(event: string, fields: LogFields = {}): void {
  console.warn(JSON.stringify({ level: 'warn', event, ...fields, ts: Date.now() }))
}

export function logError(event: string, fields: LogFields = {}): void {
  console.error(JSON.stringify({ level: 'error', event, ...fields, ts: Date.now() }))
}
