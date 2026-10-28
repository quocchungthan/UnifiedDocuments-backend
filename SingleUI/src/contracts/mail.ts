import { z } from 'zod';

export type MailFolder = 'inbox' | 'sent';
export const mailSession = z.object({
  domain: z.string(),
  email: z.string().nullable(),
  csrf: z.string(),
  oauthConfigured: z.boolean(),
  mailboxes: z.array(z.string()).default([]),
  authErrors: z.array(z.string()).default([]),
});
export const mailSummary = z.object({
  uid: z.number().int().positive(),
  subject: z.string(),
  sender: z.string(),
  to: z.string(),
  date: z.string(),
  unread: z.boolean(),
  snippet: z.string().optional(),
  attachmentCount: z.number().int().nonnegative().optional(),
  threadCount: z.number().int().positive().optional(),
});
export const mailPage = z.object({
  messages: z.array(mailSummary),
  more: z.boolean(),
});
export const mailMessage = mailSummary.extend({
  body: z.string(),
  attachments: z.array(z.string()),
});
export const mailSendResult = z.object({
  accepted: z.literal(true),
  saved: z.boolean(),
});
export type MailSession = z.infer<typeof mailSession>;
export type MailSummary = z.infer<typeof mailSummary>;
export type MailMessage = z.infer<typeof mailMessage>;
export interface MailDraft {
  to: string;
  subject: string;
  body: string;
}
