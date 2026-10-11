const URL_PATTERN = /https?:\/\/[^\s<>()]+/gu;
const TRAILING_PUNCTUATION = /[.,!?;:\]\[}\u3001\u3002！？）」』】]+$/u;

export type ParsedCaptureMessage = {
  urls: string[];
  note: string | null;
};

export function parseCaptureMessage(text: string): ParsedCaptureMessage {
  const urls = [...text.matchAll(URL_PATTERN)]
    .map((match) => match[0].replace(TRAILING_PUNCTUATION, ''))
    .filter((url, index, all) => all.indexOf(url) === index);
  const note = text
    .replace(URL_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 4_000);
  return { urls, note: note === '' ? null : note };
}

