import { useMemo } from 'react';

import type { CustomEmojiMapArg } from '@/mastodon/features/emoji/types';
import type {
  OnAttributeHandler,
  OnElementHandler,
} from '@/mastodon/utils/html';
import { htmlStringToComponents } from '@/mastodon/utils/html';
import { polymorphicForwardRef } from '@/types/polymorphic';

import { AnimateEmojiProvider, CustomEmojiProvider } from './context';
import { textToEmojis } from './index';

export interface EmojiHTMLProps {
  htmlString: string;
  extraEmojis?: CustomEmojiMapArg;
  className?: string;
  onElement?: OnElementHandler;
  onAttribute?: OnAttributeHandler;
  onText?: (text: string) => React.ReactNode;
}

export const EmojiHTML = polymorphicForwardRef<'div', EmojiHTMLProps>(
  ({ extraEmojis, htmlString, onElement, onAttribute, onText = textToEmojis, ...props }, ref) => {
    const contents = useMemo(
      () =>
        htmlStringToComponents(htmlString, {
          onText,
          onElement,
          onAttribute,
        }),
      [htmlString, onAttribute, onElement, onText],
    );

    return (
      <CustomEmojiProvider emojis={extraEmojis}>
        <AnimateEmojiProvider {...props} ref={ref}>
          {contents}
        </AnimateEmojiProvider>
      </CustomEmojiProvider>
    );
  },
);
EmojiHTML.displayName = 'EmojiHTML';