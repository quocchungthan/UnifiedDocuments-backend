import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { useMessages } from '../i18n/localization';
import { CodeBlock } from './code-block';

const messages = {
  en: {
    title: 'Connect your local service',
    install: 'Install the .NET 10 SDK',
    source: 'Source and setup instructions',
    run: 'Run from your service checkout and keep the terminal open:',
    permission: 'Allow local network access for this site in your browser. If denied earlier, change the site permission and retry. Do not disable browser security.',
    private: 'Private repositories require an authorized GitHub account. No local data is uploaded to this static host.',
    retry: 'Retry connection',
  },
  vi: {
    title: 'Kết nối dịch vụ cục bộ',
    install: 'Cài .NET 10 SDK',
    source: 'Mã nguồn và hướng dẫn cài đặt',
    run: 'Chạy trong thư mục mã nguồn dịch vụ và giữ cửa sổ dòng lệnh mở:',
    permission: 'Cho phép trang này truy cập mạng cục bộ trong trình duyệt. Nếu đã từ chối, đổi quyền của trang rồi thử lại. Không tắt bảo mật trình duyệt.',
    private: 'Kho riêng tư cần tài khoản GitHub được cấp quyền. Không tải dữ liệu cục bộ lên trang tĩnh này.',
    retry: 'Thử kết nối lại',
  },
} as const;

@Component({
  selector: 'emfc-local-service-guide',
  imports: [CodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="panel" [attr.aria-label]="m().title">
    <h2>{{ m().title }}</h2>
    <p><a href="https://dotnet.microsoft.com/download/dotnet/10.0" target="_blank" rel="noreferrer">{{ m().install }}</a>
      · <a [href]="sourceUrl()" target="_blank" rel="noreferrer">{{ m().source }}</a></p>
    <p>{{ m().run }}</p>
    <emfc-code-block [code]="command()" language="shell" [wrap]="true" />
    <emfc-code-block [code]="origin()" label="URL" [wrap]="true" />
    <p>{{ m().permission }}</p><p class="muted">{{ m().private }}</p>
    <button type="button" class="button button--secondary" [disabled]="busy()" (click)="retry.emit()">{{ m().retry }}</button>
  </section>`,
  styles: [`
    :host { display: block; margin-block: var(--emfc-space-4); }
    h2 { font-size: var(--emfc-text-lg); margin: 0; }
    pre { max-width: 100%; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    p { margin: 0; overflow-wrap: anywhere; }
    button { justify-self: start; }
    /* Keep inherited text, links and focus paired with shared surface roles. */
    section { display: grid; gap: var(--emfc-space-3); padding: var(--emfc-space-6);
      color: var(--emfc-ink); background: var(--emfc-surface); }
  `],
})
export class LocalServiceGuide {
  readonly sourceUrl = input.required<string>();
  readonly command = input.required<string>();
  readonly origin = input.required<string>();
  readonly busy = input(false);
  readonly retry = output<void>();
  protected readonly m = useMessages(messages);
}
