import { Injectable } from '@angular/core';
import {
  mailMessage,
  mailPage,
  mailSendResult,
  mailSession,
  type MailDraft,
  type MailFolder,
  type MailMessage,
  type MailSession,
  type MailSummary,
} from '../../contracts/mail';
import { requestJson, requestOk } from '../http/request';

export interface MailApi {
  session(): Promise<MailSession>;
  list(folder: MailFolder, page: number): Promise<{ messages: MailSummary[]; more: boolean }>;
  message(folder: MailFolder, uid: number): Promise<MailMessage>;
  send(draft: MailDraft, csrf: string): Promise<{ accepted: true; saved: boolean; local?: boolean }>;
  logout(csrf: string): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class MailClient implements MailApi {
  session() {
    return requestJson('mail', '/api/mail/session', mailSession, { credentials: 'same-origin' });
  }
  list(folder: MailFolder, page: number) {
    return requestJson(
      'mail',
      `/api/mail/messages?folder=${encodeURIComponent(folder)}&page=${page}`,
      mailPage,
      { credentials: 'same-origin' },
    );
  }
  message(folder: MailFolder, uid: number) {
    return requestJson(
      'mail',
      `/api/mail/messages/${uid}?folder=${encodeURIComponent(folder)}`,
      mailMessage,
      { credentials: 'same-origin' },
    );
  }
  send(draft: MailDraft, csrf: string) {
    return requestJson('mail', '/api/mail/compose', mailSendResult, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...draft, csrf }).toString(),
    });
  }
  async logout(csrf: string) {
    await requestOk('mail', '/api/mail/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrf }).toString(),
    });
  }
}
