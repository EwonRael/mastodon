import { FormattedMessage } from 'react-intl';

import { createSelector } from '@reduxjs/toolkit';

import { animated, useSpring } from '@react-spring/web';

import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';
import type { RootState } from 'mastodon/store';

const selector = createSelector(
  (state: RootState) => state.compose.get('privacy') as string,
  (state: RootState) => !!state.accounts.getIn([me, 'locked']),
  (privacy, locked) => ({
    needsLockWarning: privacy === 'private' && !locked,
    directMessageWarning: privacy === 'direct',
  }),
);

export const Warning = () => {
  const { needsLockWarning, directMessageWarning } = useAppSelector(selector);
  if (needsLockWarning) {
    return (
      <WarningMessage>
        <FormattedMessage
          id='compose_form.lock_disclaimer'
          defaultMessage='Your account is not {locked}. Anyone can follow you to view your follower-only posts.'
          values={{
            locked: (
              <a href='/settings/privacy#account_unlocked'>
                <FormattedMessage
                  id='compose_form.lock_disclaimer.lock'
                  defaultMessage='locked'
                />
              </a>
            ),
          }}
        />
      </WarningMessage>
    );
  }

  if (directMessageWarning) {
    return (
      <WarningMessage>
        <FormattedMessage
          id='compose_form.encryption_warning'
          defaultMessage='Posts on Mastodon are not end-to-end encrypted. Do not share any dangerous information over Mastodon.'
        />{' '}
        <a
          href='https://docs.joinmastodon.org/user/posting/#private'
          rel='noreferrer'
          target='_blank'
        >
          <FormattedMessage
            id='compose_form.direct_message_warning_learn_more'
            defaultMessage='Learn more'
          />
        </a>
      </WarningMessage>
    );
  }

  return null;
};

export const WarningMessage: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const styles = useSpring({
    from: {
      opacity: 0,
      transform: 'scale(0.85, 0.75)',
    },
    to: {
      opacity: 1,
      transform: 'scale(1, 1)',
    },
  });
  return (
    <animated.div className='compose-form__warning' style={styles}>
      {children}
    </animated.div>
  );
};