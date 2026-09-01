import { createConnection } from 'node:net'
import type { AppConfig } from '../config/env.ts'

export type SendEmailResult = { ok: true } | { ok: false; reason: 'not_configured' | 'send_failed' }

type EmailPayload = {
  to: string
  subject: string
  text: string
  html: string
}

let testSender: ((payload: EmailPayload) => Promise<SendEmailResult>) | null = null

export function setEmailSenderForTests(
  sender: ((payload: EmailPayload) => Promise<SendEmailResult>) | null,
): void {
  testSender = sender
}

function isEmailConfigured(config: AppConfig): boolean {
  return Boolean(config.smtpHost.trim())
}

function encodeSmtpAddress(value: string): string {
  return value.replace(/[\r\n]/g, '')
}

/** Minimal SMTP client for Mailpit (dev) and production SMTP relays. */
async function sendViaSmtp(config: AppConfig, payload: EmailPayload): Promise<SendEmailResult> {
  if (!isEmailConfigured(config)) return { ok: false, reason: 'not_configured' }

  const host = config.smtpHost.trim()
  const port = config.smtpPort
  const from = encodeSmtpAddress(config.emailFrom)
  const to = encodeSmtpAddress(payload.to)
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSmtpAddress(payload.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    payload.html,
  ].join('\r\n')

  return new Promise((resolve) => {
    const socket = createConnection({ host, port })
    let step = 0
    let buffer = ''

    const fail = () => {
      socket.destroy()
      resolve({ ok: false, reason: 'send_failed' })
    }

    const commands = [`EHLO flowlary\r\n`, `MAIL FROM:<${from.match(/<([^>]+)>/)?.[1] ?? from}>\r\n`, `RCPT TO:<${to}>\r\n`, `DATA\r\n`, `${message}\r\n.\r\n`, `QUIT\r\n`]

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      if (!buffer.includes('\r\n')) return
      const line = buffer
      buffer = ''
      if (!/^\d{3}/.test(line)) return fail()
      const code = Number(line.slice(0, 3))
      if (code >= 400) return fail()
      if (step >= commands.length) {
        socket.end()
        resolve({ ok: true })
        return
      }
      socket.write(commands[step]!)
      step += 1
    })

    socket.on('error', fail)
    socket.setTimeout(10_000, fail)
  })
}

export async function sendVerificationEmail(
  config: AppConfig,
  email: string,
  verificationUrl: string,
): Promise<SendEmailResult> {
  const safeUrl = verificationUrl.replace(/[\r\n]/g, '')
  const payload: EmailPayload = {
    to: email,
    subject: 'Verify your Flowlary account',
    text: `Welcome to Flowlary.\n\nVerify your email address to activate your account:\n\n${safeUrl}\n\nThis link expires in 24 hours.\n\nIf you did not create this account, you can ignore this email.`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111;line-height:1.5">
<p style="margin:0 0 24px;font-size:18px;font-weight:700;letter-spacing:-0.02em">Flowlary</p>
<h1 style="font-size:22px;font-weight:600;margin:0 0 12px;letter-spacing:-0.02em">Verify your email</h1>
<p style="margin:0 0 20px;color:#333">Welcome to Flowlary. Confirm your email address to activate your account and start writing.</p>
<p style="margin:0 0 24px">
<a href="${safeUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px">Verify email</a>
</p>
<p style="margin:0 0 12px;color:#555;font-size:14px">This link expires in 24 hours.</p>
<p style="margin:0 0 8px;color:#777;font-size:13px">If the button does not work, copy this URL into your browser:</p>
<p style="margin:0 0 20px;font-size:13px;word-break:break-all;color:#444">${safeUrl}</p>
<p style="margin:0;color:#999;font-size:13px">If you did not create this account, you can safely ignore this email.</p>
</div>`,
  }

  if (testSender) return testSender(payload)
  return sendViaSmtp(config, payload)
}

export async function sendPasswordResetEmail(
  config: AppConfig,
  input: { to: string; maskedEmail: string; resetUrl: string },
): Promise<SendEmailResult> {
  const safeUrl = input.resetUrl.replace(/[\r\n]/g, '')
  const payload: EmailPayload = {
    to: input.to,
    subject: 'Reset your Flowlary password',
    text: `Reset your Flowlary password for ${input.maskedEmail}:\n\n${safeUrl}\n\nThis link expires in 1 hour.`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111;line-height:1.5">
<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">Reset your password</h1>
<p style="margin:0 0 20px;color:#333">We received a request to reset the password for ${input.maskedEmail}.</p>
<p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Choose a new password</a></p>
<p style="margin:0;color:#777;font-size:13px">This link expires in 1 hour. If you did not request this, ignore this email.</p>
</div>`,
  }
  if (testSender) return testSender(payload)
  return sendViaSmtp(config, payload)
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const visible = local.slice(0, 1)
  return `${visible}***@${domain}`
}

type SupportTicketEmailView = { displayNumber: string; subject: string; id: string }

function supportTicketUrl(config: AppConfig, ticketId: string): string {
  return `${config.webOrigin.replace(/\/$/, '')}/account/support?ticket=${encodeURIComponent(ticketId)}`
}

function supportEmailShell(title: string, bodyHtml: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111;line-height:1.5">
<p style="margin:0 0 24px;font-size:18px;font-weight:700;letter-spacing:-0.02em">Flowlary</p>
<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${title}</h1>
${bodyHtml}
</div>`
}

export async function sendSupportTicketCreatedEmail(
  config: AppConfig,
  to: string,
  ticket: SupportTicketEmailView,
): Promise<SendEmailResult> {
  const url = supportTicketUrl(config, ticket.id)
  const payload: EmailPayload = {
    to,
    subject: 'We received your Flowlary support request',
    text: `We received your support request #${ticket.displayNumber}.\n\nSubject: ${ticket.subject}\n\nView your request: ${url}`,
    html: supportEmailShell(
      'Support request received',
      `<p style="margin:0 0 12px;color:#333">We received your support request <strong>#${ticket.displayNumber}</strong>.</p>
<p style="margin:0 0 20px;color:#555">Subject: ${ticket.subject}</p>
<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View your request</a></p>
<p style="margin:0;color:#777;font-size:13px">We usually reply within 24 hours.</p>`,
    ),
  }
  if (testSender) return testSender(payload)
  return sendViaSmtp(config, payload)
}

export async function sendSupportTicketReplyEmail(
  config: AppConfig,
  to: string,
  ticket: SupportTicketEmailView,
): Promise<SendEmailResult> {
  const url = supportTicketUrl(config, ticket.id)
  const payload: EmailPayload = {
    to,
    subject: 'Flowlary Support replied to your request',
    text: `Flowlary Support replied to request #${ticket.displayNumber}.\n\nSign in to view the conversation: ${url}`,
    html: supportEmailShell(
      'Support replied',
      `<p style="margin:0 0 12px;color:#333">Flowlary Support replied to your request <strong>#${ticket.displayNumber}</strong>.</p>
<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View conversation</a></p>
<p style="margin:0;color:#777;font-size:13px">Sign in to Flowlary to read the reply. We never include private writing in email.</p>`,
    ),
  }
  if (testSender) return testSender(payload)
  return sendViaSmtp(config, payload)
}

export async function sendSupportTicketResolvedEmail(
  config: AppConfig,
  to: string,
  ticket: SupportTicketEmailView,
): Promise<SendEmailResult> {
  const url = supportTicketUrl(config, ticket.id)
  const payload: EmailPayload = {
    to,
    subject: 'Your Flowlary support request was resolved',
    text: `Your support request #${ticket.displayNumber} was marked resolved.\n\nView details: ${url}`,
    html: supportEmailShell(
      'Request resolved',
      `<p style="margin:0 0 12px;color:#333">Your support request <strong>#${ticket.displayNumber}</strong> was marked resolved.</p>
<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View request</a></p>
<p style="margin:0;color:#777;font-size:13px">If you still need help, you can reply from your account.</p>`,
    ),
  }
  if (testSender) return testSender(payload)
  return sendViaSmtp(config, payload)
}

export async function sendSupportOperatorNotificationEmail(
  config: AppConfig,
  userEmail: string,
  ticket: SupportTicketEmailView,
  kind: 'created' | 'reply',
): Promise<SendEmailResult> {
  const operator = config.feedbackAdminEmails[0]
  if (!operator) return { ok: false, reason: 'not_configured' }
  const payload: EmailPayload = {
    to: operator,
    subject: kind === 'created' ? `New support ticket #${ticket.displayNumber}` : `Support ticket #${ticket.displayNumber} updated`,
    text: `User: ${maskEmail(userEmail)}\nTicket #${ticket.displayNumber}\nSubject: ${ticket.subject}`,
    html: supportEmailShell(
      kind === 'created' ? 'New support ticket' : 'Support ticket updated',
      `<p style="margin:0 0 12px;color:#333">From ${maskEmail(userEmail)}</p>
<p style="margin:0 0 8px;color:#555"><strong>#${ticket.displayNumber}</strong> — ${ticket.subject}</p>`,
    ),
  }
  if (testSender) return testSender(payload)
  return sendViaSmtp(config, payload)
}
