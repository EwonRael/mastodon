import { createSelector } from '@reduxjs/toolkit';
import { Map as ImmutableMap, List as ImmutableList } from 'immutable';
import { connect } from 'react-redux';

import { debounce } from 'lodash';

import { fetchStatus } from '@/mastodon/actions/statuses';
import { scrollTopTimeline, loadPending } from '@/mastodon/actions/timelines';
import { isNonStatusId } from '@/mastodon/actions/timelines_typed';
import StatusList from '@/mastodon/components/status_list';
import { me } from '@/mastodon/initial_state';
import { groupHomeReplies } from '@/mastodon/utils/group_replies';

const makeGetStatusIds = (pending = false) => createSelector([
  (state, { type }) => state.getIn(['settings', type], ImmutableMap()),
  (state, { type, maxItems }) => {
    const items = state.getIn(['timelines', type, pending ? 'pendingItems' : 'items'], ImmutableList());

    if (maxItems) {
      return items.take(maxItems);
    }

    return items;
  },
  (state)           => state.get('statuses'),
], (columnSettings, statusIds, statuses) => {
  return statusIds.filter(id => {
    if (isNonStatusId(id)) return true;

    const statusForId = statuses.get(id);

    if (statusForId.get('account') === me) return true;

    if (columnSettings.getIn(['shows', 'reblog']) === false && statusForId.get('reblog') !== null) {
      return false;
    }

    if (columnSettings.getIn(['shows', 'reply']) === false && statusForId.get('in_reply_to_id') !== null && statusForId.get('in_reply_to_account_id') !== me) {
      return false;
    }

    if (columnSettings.getIn(['shows', 'quote']) === false && statusForId.get('quote') !== null) {
      return false;
    }

    return true;
  });
});

// Only the Home timeline nests replies under their parent post; every other
// timeline (public, hashtag, lists, profiles, bookmarks, favourites, etc.)
// keeps receiving statusIds completely unchanged.
const makeGetGroupedHomeStatusIds = () => createSelector([
  (state, statusIds) => statusIds,
  (state)             => state.get('statuses'),
], (statusIds, statuses) => groupHomeReplies(statusIds, statuses));

const makeMapStateToProps = () => {
  const getStatusIds = makeGetStatusIds();
  const getPendingStatusIds = makeGetStatusIds(true);
  const getGroupedHomeStatusIds = makeGetGroupedHomeStatusIds();

  /**
   * @param {import('mastodon/store').RootState} state
   * @param {Object} props
   * @param {string} props.timelineId
   * @param {boolean} [props.initialLoadingState]
   * @param {number} [props.maxItems]
   */
  const mapStateToProps = (state, { timelineId, initialLoadingState = true, maxItems }) => {
    const filteredStatusIds = getStatusIds(state, { type: timelineId, maxItems });

    let statusIds = filteredStatusIds;
    let replyRootMap;
    let missingParentIds;

    if (timelineId === 'home') {
      const grouped = getGroupedHomeStatusIds(state, filteredStatusIds);
      statusIds = grouped.orderedIds;
      replyRootMap = Object.fromEntries(grouped.rootIdFor);
      missingParentIds = grouped.missingParentIds;
    }

    return {
      statusIds,
      replyRootMap,
      missingParentIds,
      lastId:    state.getIn(['timelines', timelineId, 'items'])?.last(),
      isLoading: state.getIn(['timelines', timelineId, 'isLoading'], initialLoadingState),
      isPartial: state.getIn(['timelines', timelineId, 'isPartial'], false),
      hasMore:   state.getIn(['timelines', timelineId, 'hasMore']),
      numPending: getPendingStatusIds(state, { type: timelineId }).size,
    };
  };

  return mapStateToProps;
};

const mapDispatchToProps = (dispatch, { timelineId }) => ({

  onScrollToTop: debounce(() => {
    dispatch(scrollTopTimeline(timelineId, true));
  }, 100),

  onScroll: debounce(() => {
    dispatch(scrollTopTimeline(timelineId, false));
  }, 100),

  onLoadPending: () => dispatch(loadPending(timelineId)),

  // Home-only: pulls in a reply's parent post so it can be nested under it,
  // even when that parent isn't (yet, or ever going to be) part of Home's
  // own paginated `items` window — see group_replies.ts.
  onFetchMissingParent: (id) => dispatch(fetchStatus(id, { alsoFetchContext: false })),

});

export default connect(makeMapStateToProps, mapDispatchToProps)(StatusList);