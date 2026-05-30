/**
 * Email job processor for BullMQ.
 *
 * Sends emails to the correct recipient using the specified template and locale.
 * Supports templates: application_confirmation, draft_saved, account_update.
 *
 * Validates: Requirement 8.2
 */
import nodemailer from "nodemailer"
import type { Job } from "bullmq"

import type { EmailJob } from "../types"

/**
 * Supported email templates with their subject lines per locale.
 */
const TEMPLATE_SUBJECTS: Record<
  EmailJob["template"],
  Record<string, string>
> = {
  application_confirmation: {
    en: "Application Confirmation",
    es: "Confirmación de solicitud",
    zh: "申请确认",
    tl: "Kumpirmasyon ng Aplikasyon",
  },
  draft_saved: {
    en: "Your Draft Has Been Saved",
    es: "Su borrador ha sido guardado",
    zh: "您的草稿已保存",
    tl: "Nai-save ang Iyong Draft",
  },
  account_update: {
    en: "Account Update",
    es: "Actualización de cuenta",
    zh: "账户更新",
    tl: "Update sa Account",
  },
}

/** Default locale fallback */
const DEFAULT_LOCALE = "en"

/**
 * Get the subject line for a given template and locale.
 */
export function getSubjectForTemplate(
  template: EmailJob["template"],
  locale: string
): string {
  const subjects = TEMPLATE_SUBJECTS[template]
  return subjects[locale] ?? subjects[DEFAULT_LOCALE]
}

/**
 * Create a nodemailer transporter from environment configuration.
 * Uses SMTP settings from environment variables.
 */
export function createTransport(): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS ?? "",
        }
      : undefined,
  })
}

/** Singleton transporter instance (lazy-initialized) */
let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = createTransport()
  }
  return transporter
}

/**
 * Allow injecting a custom transporter (useful for testing).
 */
export function setTransporter(t: nodemailer.Transporter | null): void {
  transporter = t
}

/**
 * Build the email body for a given template, locale, and data.
 * Returns both plain text and HTML versions.
 */
export function buildEmailBody(
  template: EmailJob["template"],
  locale: string,
  data: Record<string, unknown>
): { text: string; html: string } {
  // Template rendering: produces a simple structured email body.
  // In production this would use a full template engine (e.g., mjml, react-email).
  const greeting = locale === "es"
    ? "Hola"
    : locale === "zh"
      ? "您好"
      : locale === "tl"
        ? "Kumusta"
        : "Hello"

  const dataEntries = Object.entries(data)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n")

  const text = `${greeting},\n\n${getSubjectForTemplate(template, locale)}\n\n${dataEntries}`

  const htmlDataEntries = Object.entries(data)
    .map(([key, value]) => `<li><strong>${key}:</strong> ${String(value)}</li>`)
    .join("")

  const html = `<p>${greeting},</p><h2>${getSubjectForTemplate(template, locale)}</h2><ul>${htmlDataEntries}</ul>`

  return { text, html }
}

/**
 * Process an email job: sends the email to the recipient using
 * the specified template and locale.
 *
 * This is the processor function passed to createEmailWorker().
 */
export async function processEmailJob(job: Job<EmailJob>): Promise<void> {
  const { template, recipient, locale, data } = job.data

  const subject = getSubjectForTemplate(template, locale)
  const { text, html } = buildEmailBody(template, locale, data)

  const mailer = getTransporter()

  await mailer.sendMail({
    from: process.env.EMAIL_FROM ?? "noreply@housing.sfgov.org",
    to: recipient,
    subject,
    text,
    html,
  })
}
