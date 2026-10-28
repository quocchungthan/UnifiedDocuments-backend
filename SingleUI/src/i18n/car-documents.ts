import type { MessageCatalog } from './localization';

export const carDocumentMessages = {
  en: {
    title: 'Vehicle Documents',
    subtitle: 'One indexed view across dealership systems',
    skip: 'Skip to search',
    eyebrow: 'UNIFIED DOCUMENT VIEWER',
    heading: 'Find documents by VIN',
    intro: 'Search the indexed records for a vehicle identification number.',
    vinLabel: 'Vehicle identification number',
    placeholder: 'Enter 17-character VIN',
    vinHint: 'VINs use 17 characters and do not contain I, O or Q.',
    vinSuggestions: 'Indexed vehicle identification numbers',
    loadingIdentifiers: 'Loading indexed VINs',
    noIdentifierMatches: 'No matching indexed VINs',
    identifierFailure: 'Could not load VIN suggestions',
    search: 'Search VIN',
    searching: 'Searching',
    invalidVin: 'Enter a valid 17-character VIN with at least one letter and one number.',
    results: 'Search results',
    match: 'document found',
    matches: 'documents found',
    file: 'Document',
    source: 'Source system',
    reference: 'Business reference',
    modified: 'Last modified',
    actions: 'Actions',
    viewPrint: 'View / print',
    download: 'Download',
    notProvided: 'Not provided',
    noResults: 'No documents found for this VIN',
    noResultsHint: 'Try another VIN or check that the vehicle has been indexed.',
    loadFailure: 'Could not search vehicle documents',
    retry: 'Try again',
    uiCredit: 'UI inspiration from',
    reviewUnlinked: 'Review unlinked documents',
    loadingUnlinked: 'Loading unlinked documents',
    loadMore: 'Load more',
    moreFailure: 'Could not load the next page',
    documentsLoaded: 'documents loaded',
    allDocumentsLoaded: 'All unlinked documents loaded.',
    unlinkedResults: 'Unlinked documents',
    unlinkedHint: 'No VIN was detected in these indexed documents.',
    unlinkedFailure: 'Could not load unlinked documents',
    noUnlinked: 'No unlinked documents',
    noUnlinkedHint: 'All currently indexed documents have at least one detected VIN.',
  },
  vi: {
    title: 'Tài liệu xe',
    subtitle: 'Một danh sách tổng hợp từ các hệ thống đại lý',
    skip: 'Bỏ qua đến phần tìm kiếm',
    eyebrow: 'TRÌNH XEM TÀI LIỆU TỔNG HỢP',
    heading: 'Tìm tài liệu theo VIN',
    intro: 'Tìm hồ sơ đã lập chỉ mục theo mã nhận dạng xe.',
    vinLabel: 'Mã nhận dạng xe',
    placeholder: 'Nhập VIN gồm 17 ký tự',
    vinHint: 'VIN gồm 17 ký tự và không chứa I, O hoặc Q.',
    vinSuggestions: 'Mã VIN đã lập chỉ mục',
    loadingIdentifiers: 'Đang tải VIN đã lập chỉ mục',
    noIdentifierMatches: 'Không có VIN đã lập chỉ mục phù hợp',
    identifierFailure: 'Không thể tải gợi ý VIN',
    search: 'Tìm theo VIN',
    searching: 'Đang tìm',
    invalidVin: 'Nhập VIN hợp lệ gồm 17 ký tự, có ít nhất một chữ cái và một chữ số.',
    results: 'Kết quả tìm kiếm',
    match: 'tài liệu',
    matches: 'tài liệu',
    file: 'Tài liệu',
    source: 'Hệ thống nguồn',
    reference: 'Mã hồ sơ',
    modified: 'Sửa đổi lần cuối',
    actions: 'Thao tác',
    viewPrint: 'Xem / in',
    download: 'Tải xuống',
    notProvided: 'Không có thông tin',
    noResults: 'Không tìm thấy tài liệu cho VIN này',
    noResultsHint: 'Thử VIN khác hoặc kiểm tra xe đã được lập chỉ mục chưa.',
    loadFailure: 'Không thể tìm tài liệu xe',
    retry: 'Thử lại',
    uiCredit: 'Giao diện lấy cảm hứng từ',
    reviewUnlinked: 'Xem tài liệu chưa liên kết',
    loadingUnlinked: 'Đang tải tài liệu chưa liên kết',
    loadMore: 'Tải thêm',
    moreFailure: 'Không thể tải trang tiếp theo',
    documentsLoaded: 'tài liệu đã tải',
    allDocumentsLoaded: 'Đã tải tất cả tài liệu chưa liên kết.',
    unlinkedResults: 'Tài liệu chưa liên kết',
    unlinkedHint: 'Chưa phát hiện VIN trong các tài liệu đã lập chỉ mục này.',
    unlinkedFailure: 'Không thể tải tài liệu chưa liên kết',
    noUnlinked: 'Không có tài liệu chưa liên kết',
    noUnlinkedHint: 'Mọi tài liệu đã lập chỉ mục hiện có ít nhất một VIN được phát hiện.',
  },
} as const satisfies MessageCatalog<
  | 'title'
  | 'subtitle'
  | 'skip'
  | 'eyebrow'
  | 'heading'
  | 'intro'
  | 'vinLabel'
  | 'placeholder'
  | 'vinHint'
  | 'vinSuggestions'
  | 'loadingIdentifiers'
  | 'noIdentifierMatches'
  | 'identifierFailure'
  | 'search'
  | 'searching'
  | 'invalidVin'
  | 'results'
  | 'match'
  | 'matches'
  | 'file'
  | 'source'
  | 'reference'
  | 'modified'
  | 'actions'
  | 'viewPrint'
  | 'download'
  | 'notProvided'
  | 'noResults'
  | 'noResultsHint'
  | 'loadFailure'
  | 'retry'
  | 'uiCredit'
  | 'reviewUnlinked'
  | 'loadingUnlinked'
  | 'loadMore'
  | 'moreFailure'
  | 'documentsLoaded'
  | 'allDocumentsLoaded'
  | 'unlinkedResults'
  | 'unlinkedHint'
  | 'unlinkedFailure'
  | 'noUnlinked'
  | 'noUnlinkedHint'
>;