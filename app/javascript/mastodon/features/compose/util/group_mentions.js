// Tin Can Phone Club: named group mentions available for autocomplete while
// composing. Must stay in sync with the GROUPS constant in
// app/services/process_mentions_service.rb -- that's what actually decides
// who gets notified, this is just the autosuggest popup shown while typing.
export const GROUP_MENTIONS = [
  { name: 'all', label: 'All', description: 'This targets the whole family' },
  { name: 'kids', label: 'Kids', description: 'Owen, Leo, Chloe, and Warwick' },
  { name: 'sickysisters', label: 'Sicky Sisters', description: 'Chloe and Leo' },
  { name: 'fossils', label: 'Fossils', description: 'Baba and Grampy' },
];

export const matchGroupMentions = token => {
  const prefix = token.slice(1).toLowerCase();
  return GROUP_MENTIONS.filter(group => group.name.startsWith(prefix));
};
