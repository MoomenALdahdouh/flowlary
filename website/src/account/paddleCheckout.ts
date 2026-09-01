let paddleReady: Promise<void> | null = null

export async function openPaddleCheckout(input: {
  transactionId: string
  clientToken: string
  environment: 'sandbox' | 'production'
  successUrl: string
  customerEmail?: string | null
}): Promise<boolean> {
  const { initializePaddle } = await import('@paddle/paddle-js')
  if (!paddleReady) {
    paddleReady = initializePaddle({
      token: input.clientToken,
      environment: input.environment,
    }).then((instance) => {
      if (!instance) throw new Error('paddle_init_failed')
      ;(globalThis as { __flowlaryPaddle?: typeof instance }).__flowlaryPaddle = instance
    })
  }
  try {
    await paddleReady
  } catch {
    paddleReady = null
    return false
  }
  const paddle = (globalThis as { __flowlaryPaddle?: { Checkout: { open: (opts: unknown) => void } } })
    .__flowlaryPaddle
  if (!paddle) return false
  paddle.Checkout.open({
    transactionId: input.transactionId,
    customer: input.customerEmail ? { email: input.customerEmail } : undefined,
    settings: {
      successUrl: input.successUrl,
      variant: 'one-page',
      allowLogout: false,
    },
  })
  return true
}
