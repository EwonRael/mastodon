import PropTypes from 'prop-types';

// Tin Can Phone Club: autocomplete entry for a named group mention (@all,
// @kids, etc. -- see GROUP_MENTIONS). Mirrors AutosuggestAccount's markup
// and CSS classes so it looks like one of the popup's account rows, but
// shows a plain-language description in place of an @acct and a generic
// avatar in place of a profile picture, since a group isn't one account.
const AutosuggestGroup = ({ group }) => (
  <div className='autosuggest-account' title={`@${group.name}`}>
    <span className='account__avatar'>
      <img src='/avatars/original/missing.png' alt='' />
    </span>

    <div className='display-name'>
      <bdi><strong className='display-name__html'>{group.label}</strong></bdi>
      <span className='display-name__account'>{group.description}</span>
    </div>
  </div>
);

AutosuggestGroup.propTypes = {
  group: PropTypes.shape({
    name: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
  }).isRequired,
};

export default AutosuggestGroup;
