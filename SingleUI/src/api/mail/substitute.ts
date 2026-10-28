import {
  type MailDraft,
  type MailFolder,
  type MailMessage,
  type MailSession,
  type MailSummary,
  mailMessage,
  mailSummary,
} from '../../contracts/mail';
import type { SourceScenario } from '../../contracts/service-source';
import { scenarioResult } from '../substitution/source';
import type { MailApi } from './client';

const sampleSession: MailSession = {
  domain: 'mailbox.local',
  email: 'reader@example.invalid',
  csrf: '',
  oauthConfigured: false,
  mailboxes: [],
  authErrors: [],
};
const sampleInbox: MailMessage[] = [
  {
    uid: 42,
    subject: 'A few notes from the design review',
    sender: 'Maya Chen <maya@example.invalid>',
    to: 'reader@example.invalid',
    date: '2026-10-22T09:42:00.000Z',
    unread: true,
    threadCount: 3,
    snippet: 'The revised navigation reads much more clearly. I left two small notes…',
    attachments: ['review-notes.pdf'],
    body: 'The revised navigation reads much more clearly.\n\nI left two small notes in the review. The first is about keyboard focus; the second is a small copy edit for the empty state.\n\nThanks,\nMaya',
  },
  {
    uid: 41,
    subject: 'Friday check-in',
    sender: 'Noah Williams <noah@example.invalid>',
    to: 'reader@example.invalid',
    date: '2026-10-22T07:18:00.000Z',
    unread: true,
    snippet: 'Are you free to walk through the latest prototype this afternoon?',
    attachments: [],
    body: 'Are you free to walk through the latest prototype this afternoon? I can bring the updated flow and a short list of questions.\n\nNoah',
  },
  {
    uid: 40,
    subject: 'Re: Welcome aboard',
    sender: 'Ari Patel <ari@example.invalid>',
    to: 'reader@example.invalid',
    date: '2026-10-21T16:04:00.000Z',
    unread: false,
    snippet: 'I have shared the project folder and the first-week outline.',
    attachments: [],
    body: 'I have shared the project folder and the first-week outline. Let me know if you need anything before Monday.\n\nAri',
  },
  {
    uid: 39,
    subject: 'Receipt for your subscription',
    sender: 'Billing <billing@example.invalid>',
    to: 'reader@example.invalid',
    date: '2026-10-20T12:30:00.000Z',
    unread: false,
    snippet: 'Your October receipt is ready to view.',
    attachments: ['receipt-oct.pdf'],
    body: 'Your October receipt is ready to view.\n\nThis message is a local interface sample.',
  },
];
const localStorageKey = 'emfc-mail-local-saved-v1';

/** Sample mailbox and local-only saved messages. No network requests are made. */
export class MailSubstitute implements MailApi {
  private local: MailMessage[] = [];
  private nextUid = 1000;
  private signedOut = false;

  constructor(private readonly scenario: SourceScenario) {
    try {
      const saved: unknown = JSON.parse(globalThis.localStorage?.getItem(localStorageKey) ?? '[]');
      this.local = mailMessage.array().parse(saved);
      this.nextUid = Math.max(1000, ...this.local.map((message) => message.uid + 1));
    } catch {
      this.local = [];
    }
  }

  session() {
    return scenarioResult('mail', this.scenario, {
      default: () => this.signedOut ? { ...sampleSession, email: null } : sampleSession,
      empty: () => this.signedOut ? { ...sampleSession, email: null } : sampleSession,
      'signed-out': () => ({ ...sampleSession, email: null }),
    });
  }

  list(folder: MailFolder, page: number) {
    return scenarioResult('mail', this.scenario, {
      default: () => ({
        messages: (folder === 'inbox' ? sampleInbox : this.local).map((message) => mailSummary.parse({ ...message, attachmentCount: message.attachments.length })),
        more: false,
      }),
      empty: () => ({ messages: [], more: false }),
      'signed-out': () => ({ messages: [], more: false }),
    }).then((result) => {
      void page;
      return result;
    });
  }

  message(folder: MailFolder, uid: number) {
    return scenarioResult('mail', this.scenario, {
      default: () => {
        const found = (folder === 'inbox' ? sampleInbox : this.local).find((item) => item.uid === uid);
        if (!found) throw new Error('That local message is no longer available.');
        return found;
      },
      empty: () => {
        throw new Error('There are no local messages to open.');
      },
    });
  }

  send(draft: MailDraft) {
    return scenarioResult('mail', this.scenario, {
      default: () => {
        const now = new Date().toISOString();
        const saved = mailMessage.parse({
          uid: this.nextUid++,
          subject: draft.subject.trim(),
          sender: sampleSession.email!,
          to: draft.to.trim(),
          date: now,
          unread: false,
          snippet: draft.body.trim().replace(/\s+/g, ' ').slice(0, 140),
          body: draft.body,
          attachments: [],
        });
        this.local = [saved, ...this.local];
        try {
          globalThis.localStorage?.setItem(localStorageKey, JSON.stringify(this.local));
        } catch {
          throw new Error('This browser could not save the local message.');
        }
        return { accepted: true as const, saved: true, local: true };
      },
    });
  }

  async logout() {
    return scenarioResult('mail', this.scenario, {
      default: () => {
        this.signedOut = true;
      },
    });
  }
}
