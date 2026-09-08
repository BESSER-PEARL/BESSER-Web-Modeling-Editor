const DEFAULT_FONT_SIZE = 14;
const ELLIPSIS = '...';

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

const estimateCharsForWidth = (widthPx: number, fontSize: number): number => {
  // 0.58 is a pragmatic average glyph width factor for the default canvas font.
  const avgCharWidth = fontSize * 0.58;
  if (widthPx <= 0 || avgCharWidth <= 0) {
    return 0;
  }
  return Math.floor(widthPx / avgCharWidth);
};

export const truncateTextToWidth = (value: string, widthPx: number, fontSize = DEFAULT_FONT_SIZE): string => {
  const normalized = normalize(value || '');
  if (!normalized) {
    return '';
  }

  const maxChars = estimateCharsForWidth(widthPx, fontSize);
  if (maxChars <= ELLIPSIS.length) {
    return ELLIPSIS;
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars - ELLIPSIS.length)}${ELLIPSIS}`;
};

