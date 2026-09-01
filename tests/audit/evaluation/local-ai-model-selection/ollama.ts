/**
 * Evaluation-only Ollama client. Not imported by production.
 */
export type OllamaChatResult = {
  ok: boolean
  content: string
  latencyMs: number
  promptTokens: number
  completionTokens: number
  error?: string
}

export async function ollamaChat(options: {
  model: string
  system: string
  user: string
  timeoutMs?: number
}): Promise<OllamaChatResult> {
  const started = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000)
  try {
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        stream: false,
        format: 'json',
        think: false,
        keep_alive: '10m',
        options: {
          temperature: 0,
          num_predict: 220,
        },
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: options.user },
        ],
      }),
    })
    const latencyMs = performance.now() - started
    if (!response.ok) {
      return {
        ok: false,
        content: '',
        latencyMs,
        promptTokens: 0,
        completionTokens: 0,
        error: `http_${response.status}`,
      }
    }
    const body = await response.json() as {
      message?: { content?: string }
      prompt_eval_count?: number
      eval_count?: number
    }
    return {
      ok: true,
      content: body.message?.content ?? '',
      latencyMs,
      promptTokens: body.prompt_eval_count ?? 0,
      completionTokens: body.eval_count ?? 0,
    }
  } catch (error) {
    return {
      ok: false,
      content: '',
      latencyMs: performance.now() - started,
      promptTokens: 0,
      completionTokens: 0,
      error: error instanceof Error ? error.name : 'error',
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function ollamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) })
    return response.ok
  } catch {
    return false
  }
}

export async function ollamaModels(): Promise<string[]> {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) })
    if (!response.ok) return []
    const body = await response.json() as { models?: Array<{ name: string }> }
    return (body.models ?? []).map((item) => item.name)
  } catch {
    return []
  }
}
