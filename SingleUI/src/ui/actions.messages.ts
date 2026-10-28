import type { MessageCatalog } from '../i18n/localization';

export const actionMessages = {
  en: {
    close: 'Close',
    retry: 'Retry',
    search: 'Search',
    previous: 'Previous',
    next: 'Next',
    save: 'Save',
    cancel: 'Cancel',
    remove: 'Delete',
    copy: 'Copy',
    copied: 'Copied',
    skipToContent: 'Skip to content',
    notConnected: 'Not connected',
  },
  vi: {
    close: 'Đóng',
    retry: 'Thử lại',
    search: 'Tìm kiếm',
    previous: 'Trước',
    next: 'Tiếp',
    save: 'Lưu',
    cancel: 'Hủy',
    remove: 'Xóa',
    copy: 'Sao chép',
    copied: 'Đã sao chép',
    skipToContent: 'Chuyển đến nội dung',
    notConnected: 'Chưa kết nối',
  },
} satisfies MessageCatalog<string>;
