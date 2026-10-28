import type { MessageCatalog } from './localization';

export const productionCoreMessages = {
  en: {
    title: 'Production Core Aids',
    subtitle: 'Dependency & tool watch',
    overview: 'Dependency health',
    skip: 'Skip to content',
    loading: 'Loading service health',
    groupLabel: 'Service groups',
    service: 'service',
    services: 'services',
    refresh: 'Refresh checks',
    refreshing: 'Refreshing checks',
    lastChecked: 'Last updated',
    polling: 'Local sample refreshes every 4 seconds',
    livePolling: 'Checks update automatically',
    allTargets: 'Monitored services',
    healthy: 'Healthy',
    attention: 'Needs attention',
    availability: 'Healthy share',
    http: 'HTTP',
    tcp: 'TCP',
    online: 'Healthy',
    offline: 'Needs attention',
    latency: 'Latency',
    checked: 'Checked',
    noTargets: 'No services configured',
    noTargetsHint: 'Add service targets to the local monitor to see health here.',
    loadFailure: 'Could not load service checks',
    retry: 'Retry checks',
    localService: 'Local monitoring service',
    localServiceHint:
      'Start the local service at http://localhost:5311 to restore live health checks.',
    localDataNote: 'Example health data · stays in this browser',
    liveDataNote: 'Live health checks from your local service',
    unavailable: 'Status unavailable',
  },
  vi: {
    title: 'Production Core Aids',
    subtitle: 'Theo dõi phụ thuộc và công cụ',
    overview: 'Tình trạng dịch vụ',
    skip: 'Bỏ qua đến nội dung',
    loading: 'Đang tải tình trạng dịch vụ',
    groupLabel: 'Nhóm dịch vụ',
    service: 'dịch vụ',
    services: 'dịch vụ',
    refresh: 'Kiểm tra lại',
    refreshing: 'Đang kiểm tra',
    lastChecked: 'Cập nhật gần nhất',
    polling: 'Làm mới dữ liệu mẫu mỗi 4 giây',
    livePolling: 'Tình trạng được cập nhật tự động',
    allTargets: 'Dịch vụ đang theo dõi',
    healthy: 'Khỏe mạnh',
    attention: 'Cần chú ý',
    availability: 'Tỷ lệ khỏe mạnh',
    http: 'HTTP',
    tcp: 'TCP',
    online: 'Khỏe mạnh',
    offline: 'Cần chú ý',
    latency: 'Độ trễ',
    checked: 'Đã kiểm tra',
    noTargets: 'Chưa cấu hình dịch vụ',
    noTargetsHint: 'Thêm mục tiêu dịch vụ vào trình theo dõi cục bộ để xem tình trạng tại đây.',
    loadFailure: 'Không thể tải kết quả kiểm tra',
    retry: 'Thử kiểm tra lại',
    localService: 'Dịch vụ giám sát cục bộ',
    localServiceHint:
      'Khởi động dịch vụ cục bộ tại http://localhost:5311 để khôi phục kiểm tra trực tiếp.',
    localDataNote: 'Dữ liệu tình trạng mẫu · chỉ trong trình duyệt này',
    liveDataNote: 'Kiểm tra trực tiếp từ dịch vụ cục bộ của bạn',
    unavailable: 'Không có trạng thái',
  },
} as const satisfies MessageCatalog<
  | 'title'
  | 'subtitle'
  | 'overview'
  | 'skip'
  | 'loading'
  | 'groupLabel'
  | 'service'
  | 'services'
  | 'refresh'
  | 'refreshing'
  | 'lastChecked'
  | 'polling'
  | 'livePolling'
  | 'allTargets'
  | 'healthy'
  | 'attention'
  | 'availability'
  | 'http'
  | 'tcp'
  | 'online'
  | 'offline'
  | 'latency'
  | 'checked'
  | 'noTargets'
  | 'noTargetsHint'
  | 'loadFailure'
  | 'retry'
  | 'localService'
  | 'localServiceHint'
  | 'localDataNote'
  | 'liveDataNote'
  | 'unavailable'
>;
