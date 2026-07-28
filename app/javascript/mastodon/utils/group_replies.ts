import type { List, Map as ImmutableMap } from 'immutable';
import { List as ImmutableListCtor } from 'immutable';

import { isNonStatusId } from 'mastodon/actions/timelines_typed';
import type { Status } from 'mastodon/models/status';

export interface GroupedHomeReplies {
  orderedIds: List<string | null>;
  rootIdFor: Map<string, string>;
  /**
   * ids of parent statuses referenced by a loaded reply that this function
   * couldn't nest because their data isn't in `statuses` yet. The caller
   * should fetch these (e.g. via `fetchStatus`); once fetched, the next
   * recompute will pick them up as virtual parents (see below).
   */
  missingParentIds: Set<string>;
}

/**
 * Reorders a Home timeline's status id list so that replies are moved to sit
 * immediately after the post they're replying to (depth-first, siblings
 * oldest-first), instead of appearing as independent top-level entries.
 *
 * A reply's parent doesn't have to be part of the currently-loaded Home
 * `statusIds` window to be nested under — it only has to be present in
 * `statuses`. That covers two cases identically:
 *  - the parent is genuinely part of the loaded Home window ("real" parent).
 *  - the parent isn't part of Home's `items` at all (e.g. it's older than
 *    what's been paginated in so far), but its data was already fetched
 *    into the global `statuses` map some other way — most commonly because
 *    the caller fetched it on a previous pass after seeing it show up in
 *    `missingParentIds` below. This "virtual" parent is then spliced into
 *    `orderedIds` even though it isn't one of the ids the caller passed in.
 *
 * Only when the parent's data isn't available at all does a reply fall back
 * to standalone top-level display — and its parent id is reported via
 * `missingParentIds` so the caller can fetch it and try again.
 *
 * Known tradeoff: a TIMELINE_GAP sentinel's neighboring id may change as a
 * side effect of reordering, which could make its "load more between here"
 * pagination cursor point at a slightly different id than before. Worst
 * case is a redundant/overlapping fetch, which the timelines reducer's
 * existing overlap handling already dedupes safely.
 */
export const groupHomeReplies = (
  statusIds: List<string | null>,
  statuses: ImmutableMap<string, Status>,
): GroupedHomeReplies => {
  const idSet = new Set<string>();

  statusIds.forEach((id) => {
    if (!isNonStatusId(id) && id) idSet.add(id);
  });

  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  const virtualRoots = new Set<string>();
  const missingParentIds = new Set<string>();

  statusIds.forEach((id) => {
    if (isNonStatusId(id) || !id) return;

    const status = statuses.get(id);
    if (!status || status.get('reblog')) return;

    const replyToId = status.get('in_reply_to_id') as string | null;
    if (!replyToId) return;

    const parentStatus = statuses.get(replyToId);
    if (!parentStatus) {
      if (!idSet.has(replyToId)) missingParentIds.add(replyToId);
      return;
    }
    if (parentStatus.get('reblog')) return;

    if (!idSet.has(replyToId)) virtualRoots.add(replyToId);

    parentOf.set(id, replyToId);
    const siblings = childrenOf.get(replyToId);
    if (siblings) {
      siblings.push(id);
    } else {
      childrenOf.set(replyToId, [id]);
    }
  });

  const rootIdFor = new Map<string, string>();
  const orderedIds: (string | null)[] = [];

  const emitSubtree = (id: string, rootId: string) => {
    orderedIds.push(id);
    rootIdFor.set(id, rootId);

    const children = childrenOf.get(id);
    if (!children) return;

    // Children were collected in newest-first scan order; reverse so
    // siblings display oldest-first, the natural comment-thread reading
    // order (matching selectors/contexts.ts's getDescendantsIds).
    for (let i = children.length - 1; i >= 0; i--) {
      const childId = children[i];
      if (childId) emitSubtree(childId, rootId);
    }
  };

  // A virtual root has no slot of its own in `statusIds`, so it can't be
  // reached by the main scan below. Instead, trigger emission of the whole
  // virtual-root subtree at the point where its oldest loaded child would
  // otherwise have been reached (scan order is newest-first, so that's the
  // last entry collected for it) — the same relative slot a real in-window
  // parent naturally occupies with respect to its oldest child.
  const virtualRootTrigger = new Map<string, string>();
  virtualRoots.forEach((rootId) => {
    const children = childrenOf.get(rootId);
    const oldestChildId = children?.[children.length - 1];
    if (oldestChildId) virtualRootTrigger.set(oldestChildId, rootId);
  });

  statusIds.forEach((id) => {
    if (isNonStatusId(id) || !id) {
      orderedIds.push(id); // sentinel passthrough (e.g. TIMELINE_GAP is null)
      return;
    }

    const triggeredRootId = virtualRootTrigger.get(id);
    if (triggeredRootId) {
      emitSubtree(triggeredRootId, triggeredRootId);
      return;
    }

    if (parentOf.has(id)) return; // will be emitted under its parent instead

    emitSubtree(id, id);
  });

  return {
    orderedIds: ImmutableListCtor(orderedIds),
    rootIdFor,
    missingParentIds,
  };
};

export const isNestedReply = (
  rootIdFor: Map<string, string>,
  id: string | null,
): boolean => {
  if (!id) return false;
  const rootId = rootIdFor.get(id);
  return rootId !== undefined && rootId !== id;
};
