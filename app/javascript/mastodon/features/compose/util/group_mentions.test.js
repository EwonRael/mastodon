import { GROUP_MENTIONS, matchGroupMentions } from './group_mentions';

describe('matchGroupMentions', () => {
  test('matches a group by prefix, case-insensitively', () => {
    expect(matchGroupMentions('@Al').map(g => g.name)).toEqual(['all']);
    expect(matchGroupMentions('@ki').map(g => g.name)).toEqual(['kids']);
  });

  test('matches nothing for an unrelated prefix', () => {
    expect(matchGroupMentions('@xyz')).toEqual([]);
  });

  test('every group has a name, label, and description', () => {
    GROUP_MENTIONS.forEach(group => {
      expect(group.name).toBeTruthy();
      expect(group.label).toBeTruthy();
      expect(group.description).toBeTruthy();
    });
  });
});
