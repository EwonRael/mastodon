import type { List } from 'immutable';

import type { CustomEmoji } from '../models/custom_emoji';
import type { Status } from '../models/status';
import { containsHighlightTerm } from '../utils/search_highlight';

import { EmojiHTML } from './emoji/html';
import { getStatusContent } from './status_content';
import { StatusBanner, BannerVariant } from './status_banner';

export const ContentWarning: React.FC<{
  status: Status;
  expanded?: boolean;
  onClick?: () => void;
  highlightTerms?: string[];
}> = ({ status, expanded, onClick, highlightTerms }) => {
  const hasSpoiler = !!status.get('spoiler_text');
  if (!hasSpoiler) {
    return null;
  }

  const text =
    status.getIn(['translation', 'spoilerHtml']) || status.get('spoilerHtml');
  if (typeof text !== 'string' || text.length === 0) {
    return null;
  }

  const hasHiddenMatch = !expanded && containsHighlightTerm(getStatusContent(status), highlightTerms);

  return (
    <StatusBanner
      expanded={expanded}
      onClick={onClick}
      variant={BannerVariant.Warning}
      hasHighlightMatch={hasHiddenMatch}
    >
      <EmojiHTML
        as='span'
        htmlString={text}
        extraEmojis={status.get('emojis') as List<CustomEmoji>}
      />
    </StatusBanner>
  );
};