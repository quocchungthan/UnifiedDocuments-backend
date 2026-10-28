import type { EntryCatalog } from '../contracts/entry';

export const chessMessages: EntryCatalog = {
  en: {
    title: 'Chinese Chess Lovers',
    heading: 'Every move tells a story.',
    introduction: 'A place for Xiangqi games, players, and analysis.',
    emptyHeading: 'No game connected',
    emptyDescription: 'The board, rooms, and game services are not connected in this entry yet.',
    areas: ['Xiangqi games', 'Game analysis'],
  },
  vi: {
    title: 'Kỳ Hội',
    heading: 'Mỗi nước đi là một câu chuyện.',
    introduction: 'Không gian dành cho ván cờ tướng, kỳ thủ và phân tích.',
    emptyHeading: 'Chưa kết nối ván cờ',
    emptyDescription: 'Bàn cờ, phòng chơi và dịch vụ ván cờ chưa được kết nối trong giao diện này.',
    areas: ['Ván cờ tướng', 'Phân tích ván cờ'],
  },
};
