import React from 'react';
import PropTypes from 'prop-types';
import ReactSwipeableViews from 'react-swipeable-views';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { FormattedMessage } from 'react-intl';
import { closeOnboarding } from '../../actions/onboarding';
import screenHello from '../../../images/screen_hello.svg';
import screenFederation from '../../../images/screen_federation.svg';
import screenInteractions from '../../../images/screen_interactions.svg';
import logoTransparent from '../../../images/logo_transparent.svg';
import { disableSwiping } from 'mastodon/initial_state';

const FrameWelcome = ({ domain, onNext }) => (
  <div className='introduction__frame'>
    <div className='introduction__illustration' style={{ background: `url(${logoTransparent}) no-repeat center center / auto 80%` }}>
      <img src={screenHello} alt='' />
    </div>

    <div className='introduction__text introduction__text--centered'>
      <h3><FormattedMessage id='introduction.welcome.headline' defaultMessage='Welcome to the Tin Can Phone Club!' /></h3>
      <p><FormattedMessage id='introduction.welcome.text' defaultMessage="A tin can phone is an amateur facsimile of something for which there exists a much more effective corporate version. In that vein, the Tin Can Phone Club is an amateur version of a social media service such as twitter. This site is build and maintained for friends and family by Owen Earl, and while it doesn't have all the bells and whistles of a proper social media service, it does have a great deal of love." values={{ domain: <code>{domain}</code> }} /></p>
    </div>

    <div className='introduction__action'>
      <button className='button' onClick={onNext}><FormattedMessage id='introduction.welcome.action' defaultMessage="Let's go!" /></button>
    </div>
  </div>
);

FrameWelcome.propTypes = {
  domain: PropTypes.string.isRequired,
  onNext: PropTypes.func.isRequired,
};

const FrameFederation = ({ onNext }) => (
  <div className='introduction__frame'>
    <div className='introduction__illustration'>
      <img src={screenFederation} alt='' />
    </div>

    <div className='introduction__text introduction__text--columnized'>
      <div>
        <h3><FormattedMessage id='introduction.federation.home.headline' defaultMessage='Home' /></h3>
        <p><FormattedMessage id='introduction.federation.home.text' defaultMessage='Only posts from people you follow will appear in your home feed. You can follow anyone here.' /></p>
      </div>

      <div>
        <h3><FormattedMessage id='introduction.federation.local.headline' defaultMessage='Local' /></h3>
        <p><FormattedMessage id='introduction.federation.local.text' defaultMessage='Here you will find posts from everyone who has signed up for the Tin Can Phone Club.' /></p>
      </div>

      <div>
        <h3><FormattedMessage id='introduction.federation.federated.headline' defaultMessage='Global' /></h3>
        <p><FormattedMessage id='introduction.federation.federated.text' defaultMessage='There are other people running similar sites to the Tin Can Phone Club. People of interest from sister sites will appear in this section.' /></p>
      </div>
    </div>

    <div className='introduction__action'>
      <button className='button' onClick={onNext}><FormattedMessage id='introduction.federation.action' defaultMessage='Next' /></button>
    </div>
  </div>
);

FrameFederation.propTypes = {
  onNext: PropTypes.func.isRequired,
};

const FrameInteractions = ({ onNext }) => (
  <div className='introduction__frame'>
    <div className='introduction__illustration'>
      <img src={screenInteractions} alt='' />
    </div>

    <div className='introduction__text introduction__text--columnized'>
      <div>
        <h3><FormattedMessage id='introduction.interactions.reply.headline' defaultMessage='Reply' /></h3>
        <p><FormattedMessage id='introduction.interactions.reply.text' defaultMessage="You can reply to other people's and your own posts, which will chain them together in a conversation." /></p>
      </div>

      <div>
        <h3><FormattedMessage id='introduction.interactions.reblog.headline' defaultMessage='Boost' /></h3>
        <p><FormattedMessage id='introduction.interactions.reblog.text' defaultMessage="You can share other people's posts with your followers by boosting them." /></p>
      </div>

      <div>
        <h3><FormattedMessage id='introduction.interactions.favourite.headline' defaultMessage='Favourite' /></h3>
        <p><FormattedMessage id='introduction.interactions.favourite.text' defaultMessage='You can save a post for later, and let the author know that you liked it, by favouriting it.' /></p>
      </div>
    </div>

    <div className='introduction__action'>
      <button className='button' onClick={onNext}><FormattedMessage id='introduction.interactions.action' defaultMessage='Finish toot-orial!' /></button>
    </div>
  </div>
);

FrameInteractions.propTypes = {
  onNext: PropTypes.func.isRequired,
};

export default @connect(state => ({ domain: state.getIn(['meta', 'domain']) }))
class Introduction extends React.PureComponent {

  static propTypes = {
    domain: PropTypes.string.isRequired,
    dispatch: PropTypes.func.isRequired,
  };

  state = {
    currentIndex: 0,
  };

  componentWillMount () {
    this.pages = [
      <FrameWelcome domain={this.props.domain} onNext={this.handleNext} />,
      <FrameFederation onNext={this.handleNext} />,
      <FrameInteractions onNext={this.handleFinish} />,
    ];
  }

  componentDidMount() {
    window.addEventListener('keyup', this.handleKeyUp);
  }

  componentWillUnmount() {
    window.addEventListener('keyup', this.handleKeyUp);
  }

  handleDot = (e) => {
    const i = Number(e.currentTarget.getAttribute('data-index'));
    e.preventDefault();
    this.setState({ currentIndex: i });
  }

  handlePrev = () => {
    this.setState(({ currentIndex }) => ({
      currentIndex: Math.max(0, currentIndex - 1),
    }));
  }

  handleNext = () => {
    const { pages } = this;

    this.setState(({ currentIndex }) => ({
      currentIndex: Math.min(currentIndex + 1, pages.length - 1),
    }));
  }

  handleSwipe = (index) => {
    this.setState({ currentIndex: index });
  }

  handleFinish = () => {
    this.props.dispatch(closeOnboarding());
  }

  handleKeyUp = ({ key }) => {
    switch (key) {
    case 'ArrowLeft':
      this.handlePrev();
      break;
    case 'ArrowRight':
      this.handleNext();
      break;
    }
  }

  render () {
    const { currentIndex } = this.state;
    const { pages } = this;

    return (
      <div className='introduction'>
        <ReactSwipeableViews index={currentIndex} onChangeIndex={this.handleSwipe} disabled={disableSwiping} className='introduction__pager'>
          {pages.map((page, i) => (
            <div key={i} className={classNames('introduction__frame-wrapper', { 'active': i === currentIndex })}>{page}</div>
          ))}
        </ReactSwipeableViews>

        <div className='introduction__dots'>
          {pages.map((_, i) => (
            <div
              key={`dot-${i}`}
              role='button'
              tabIndex='0'
              data-index={i}
              onClick={this.handleDot}
              className={classNames('introduction__dot', { active: i === currentIndex })}
            />
          ))}
        </div>
      </div>
    );
  }

}
