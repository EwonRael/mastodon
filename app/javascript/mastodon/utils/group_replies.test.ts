import { List, Map as ImmutableMap, fromJS } from 'immutable';

import { TIMELINE_GAP } from 'mastodon/actions/timelines';
import type { Status } from 'mastodon/models/status';

import { groupHomeReplies, isNestedReply } from './group_replies';

const status = (
  id: string,
  inReplyToId: string | null = null,
  reblog: string | null = null,
) => fromJS({ id, in_reply_to_id: inReplyToId, reblog }) as unknown as Status;

const statusesFrom = (list: Status[]) =>
  ImmutableMap(list.map((s) => [s.get('id') as string, s]));

describe('groupHomeReplies', () => {
  test('a reply nests directly under its parent', () => {
    // Home is newest-first: the reply (b) appears before its parent (a).
    const statusIds = List(['b', 'a']);
    const statuses = statusesFrom([status('a'), status('b', 'a')]);

    const { orderedIds, rootIdFor } = groupHomeReplies(statusIds, statuses);

    expect(orderedIds.toArray()).toEqual(['a', 'b']);
    expect(isNestedReply(rootIdFor, 'a')).toBe(false);
    expect(isNestedReply(rootIdFor, 'b')).toBe(true);
    expect(rootIdFor.get('b')).toBe('a');
  });

  test('sibling replies to the same root nest and display oldest-first', () => {
    // Scan order (newest-first): c (newest reply), b (older reply), a (root, oldest overall)
    const statusIds = List(['c', 'b', 'a']);
    const statuses = statusesFrom([
      status('a'),
      status('b', 'a'),
      status('c', 'a'),
    ]);

    const { orderedIds, rootIdFor } = groupHomeReplies(statusIds, statuses);

    expect(orderedIds.toArray()).toEqual(['a', 'b', 'c']);
    expect(rootIdFor.get('b')).toBe('a');
    expect(rootIdFor.get('c')).toBe('a');
  });

  test('a reply to a reply nests two levels under the same root', () => {
    const statusIds = List(['c', 'b', 'a']);
    const statuses = statusesFrom([
      status('a'),
      status('b', 'a'),
      status('c', 'b'),
    ]);

    const { orderedIds, rootIdFor } = groupHomeReplies(statusIds, statuses);

    expect(orderedIds.toArray()).toEqual(['a', 'b', 'c']);
    expect(rootIdFor.get('c')).toBe('a');
  });

  test('a reply whose parent is outside the loaded window but already known nests as a virtual root', () => {
    // 'a' isn't in statusIds (e.g. it's older than what Home has paginated
    // in), but its data is already in `statuses` (e.g. fetched earlier after
    // showing up in missingParentIds). It should still be spliced in above 'b'.
    const statusIds = List(['b']);
    const statuses = statusesFrom([status('a'), status('b', 'a')]);

    const { orderedIds, rootIdFor, missingParentIds } = groupHomeReplies(statusIds, statuses);

    expect(orderedIds.toArray()).toEqual(['a', 'b']);
    expect(isNestedReply(rootIdFor, 'b')).toBe(true);
    expect(rootIdFor.get('b')).toBe('a');
    expect(missingParentIds.size).toBe(0);
  });

  test('a reply whose parent is neither loaded nor known stays top-level and is reported as missing', () => {
    const statusIds = List(['b']);
    const statuses = statusesFrom([status('b', 'a')]); // 'a' isn't known anywhere

    const { orderedIds, rootIdFor, missingParentIds } = groupHomeReplies(statusIds, statuses);

    expect(orderedIds.toArray()).toEqual(['b']);
    expect(isNestedReply(rootIdFor, 'b')).toBe(false);
    expect(missingParentIds.has('a')).toBe(true);
  });

  test('a virtual root with multiple loaded children is only emitted once, at the oldest child\'s slot', () => {
    const statusIds = List(['c', 'b']); // 'a' (their shared parent) isn't loaded
    const statuses = statusesFrom([status('a'), status('b', 'a'), status('c', 'a')]);

    const { orderedIds, rootIdFor } = groupHomeReplies(statusIds, statuses);

    expect(orderedIds.toArray()).toEqual(['a', 'b', 'c']);
    expect(rootIdFor.get('b')).toBe('a');
    expect(rootIdFor.get('c')).toBe('a');
  });

  test('boosts are never nested and never claim children', () => {
    const statusIds = List(['c', 'b', 'a']);
    const statuses = statusesFrom([
      status('a'),
      status('b', null, 'a'), // b boosts a
      status('c', 'b'), // c replies to the boost wrapper itself
    ]);

    const { orderedIds, rootIdFor } = groupHomeReplies(statusIds, statuses);

    // b is a reblog, so it's never treated as a valid parent for c;
    // both b and c fall back to standalone top-level entries.
    expect(orderedIds.toArray()).toEqual(['c', 'b', 'a']);
    expect(isNestedReply(rootIdFor, 'b')).toBe(false);
    expect(isNestedReply(rootIdFor, 'c')).toBe(false);
  });

  test('a streamed-in reply ends up nested instead of showing first', () => {
    // Simulates TIMELINE_UPDATE unshifting a brand new reply onto the top.
    const statusIds = List(['newReply', 'a', 'unrelated']);
    const statuses = statusesFrom([
      status('a'),
      status('unrelated'),
      status('newReply', 'a'),
    ]);

    const { orderedIds, rootIdFor } = groupHomeReplies(statusIds, statuses);

    expect(orderedIds.toArray()).toEqual(['a', 'newReply', 'unrelated']);
    expect(rootIdFor.get('newReply')).toBe('a');
  });

  test('sentinel markers are emitted at the point they are first reached', () => {
    const statusIds = List(['b', TIMELINE_GAP, 'a']);
    const statuses = statusesFrom([status('a'), status('b', 'a')]);

    const { orderedIds } = groupHomeReplies(statusIds, statuses);

    // 'b' is claimed as a child of 'a' (regardless of gap position, since
    // parent/child resolution isn't gap-aware) and skipped when the scan
    // reaches it; the gap sentinel is emitted immediately since it's not
    // claimed by anything; 'a' is then emitted along with its child 'b'.
    // Known, accepted tradeoff: a gap's pagination cursor is whatever id
    // ends up adjacent to it post-reorder, which may not be the exact
    // chronological boundary — worst case is a redundant/overlapping
    // "load more" fetch next time that gap is filled, which existing
    // dedup logic in the timelines reducer already handles safely.
    expect(orderedIds.toArray()).toEqual([TIMELINE_GAP, 'a', 'b']);
  });
});
