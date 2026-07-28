import { textToEmojis } from 'mastodon/components/emoji';

const escapeRegExp = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildHighlightPattern = (terms: string[] | undefined) => {
  if (!terms || terms.length === 0) {
    return null;
  }
  return new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
};

export const containsHighlightTerm = (text: string | undefined | null, terms: string[] | undefined) => {
  const pattern = buildHighlightPattern(terms);
  if (!pattern || !text) {
    return false;
  }
  pattern.lastIndex = 0;
  return pattern.test(text);
};

// Tokenizes text for emoji rendering (via textToEmojis), then wraps any
// occurrence of a search-matched term in <mark>, operating only on the
// already-safe plain-text segments (no dangerouslySetInnerHTML).
export const highlightSearchTerms = (text: string, terms: string[] | undefined): React.ReactNode => {
  const tokens = textToEmojis(text);
  const pattern = buildHighlightPattern(terms);

  if (!pattern) {
    return tokens;
  }

  let key = 0;

  return tokens.flatMap((token) => {
    if (typeof token !== 'string') {
      return [token];
    }

    return token
      .split(pattern)
      .filter((part) => part.length > 0)
      .map((part) => {
        pattern.lastIndex = 0;
        const isMatch = terms?.some((term) => term.toLowerCase() === part.toLowerCase());
        return isMatch ? <mark key={key++}>{part}</mark> : part;
      });
  });
};
