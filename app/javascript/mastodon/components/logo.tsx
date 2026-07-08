import classNames from 'classnames';

import logo from '@/images/logo.svg';

// Tin Can Phone Club: using our custom logo image consistently for all three
// logo variants, rather than the upstream two-piece wordmark/icon SVG sprite
// (which encodes the default Mastodon mark as separate <symbol> definitions).

export const WordmarkLogo: React.FC = () => (
  <img src={logo} alt='Tin Can Phone Club' className='logo logo--wordmark' />
);

export const IconLogo: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src={logo}
    alt='Tin Can Phone Club'
    className={classNames('logo logo--icon', className)}
  />
);

export const SymbolLogo: React.FC = () => (
  <img src={logo} alt='Tin Can Phone Club' className='logo logo--icon' />
);
