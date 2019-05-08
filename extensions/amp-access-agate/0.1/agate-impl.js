/**
 * Copyright 2016 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {CSS} from '../../../build/amp-access-agate-0.1.css';
import {Services} from '../../../src/services';
import {dev, user, userAssert} from '../../../src/log';
import {dict} from '../../../src/utils/object';
import {getMode} from '../../../src/mode';
import {installStylesForDoc} from '../../../src/style-installer';
import {listen} from '../../../src/event-helper';
import {removeChildren} from '../../../src/dom';
import {htmlFor, htmlRefs} from '../../../src/static-template';
import {createShadowRoot} from '../../../src/shadow-embed';

const TAG = 'amp-access-agate';
//const BASE_URL = 'http://localhost:8002';
const BASE_URL = 'https://evening-springs-39131.herokuapp.com';


const AUTHORIZATION_TIMEOUT = 3000;
const LOGIN_URL = `${BASE_URL}/account/login?rid=READER_ID&url=CANONICAL_URL`;
const LOGOUT_URL = `${BASE_URL}/account/logout?rid=READER_ID&url=CANONICAL_URL`;
const AUTHORIZATION_URL = `${BASE_URL}/api/authorization?rid=READER_ID&url=CANONICAL_URL`;
const ACCOUNT_URL = 'https://account-staging.agate.io/my-agate/account';



/**
 * @implements {../../amp-access/0.1/access-vendor.AccessVendor}
 */
export class AgateVendor {

  /**
   * @param {!../../amp-access/0.1/amp-access.AccessService} accessService
   * @param {!../../amp-access/0.1/amp-access-source.AccessSource} accessSource
   */
  constructor(accessService, accessSource) {


    /** @const */
    this.ampdoc = accessService.ampdoc;

    /** @const @private {!../../amp-access/0.1/amp-access-source.AccessSource} */
    this.accessSource_ = accessSource;

    /** @private @const {!../../../src/service/viewport/viewport-impl.Viewport} */
    this.viewport_ = Services.viewportForDoc(this.ampdoc);

    /** @const @private {!../../../src/service/xhr-impl.Xhr} */
    this.xhr_ = Services.xhrFor(this.ampdoc.win);

    /** @const @private {!../../../src/service/timer-impl.Timer} */
    this.timer_ = Services.timerFor(this.ampdoc.win);

    /** @const @private {!../../../src/service/vsync-impl.Vsync} */
    this.vsync_ = Services.vsyncFor(this.ampdoc.win);

     /** @private {boolean} */
     this.containerEmpty_ = true;

     /** @private {?Node} */
     this.innerContainer_ = null;

    /** @const @private {!Array<function()>} */
    this.listeners_ = [];
    this.addFont_("https://fonts.googleapis.com/css?family=Source+Sans+Pro");
    
  }

  /**
   * @return {!Promise<!JsonObject>}
   */
  authorize() {
    return this.getLoginStatus_()
        .then(authentication => {
          this.emptyContainer_().then(this.renderUI.bind(this, authentication));
          return authentication;
        });
  }

  /**
   * @return {!Promise<Object>}
   * @private
   */
  getLoginStatus_() {
    const urlPromise = this.accessSource_.buildUrl(
      AUTHORIZATION_URL, false);
    return urlPromise.then(url => {
      return this.accessSource_.getLoginUrl(url);
    }).then(url => {
      dev().info(TAG, 'Authorization URL: ', url);
      return this.timer_.timeoutPromise(
        AUTHORIZATION_TIMEOUT,
        this.xhr_.fetchJson(url, {
        credentials: 'include',
        }
      )).then(res => res.json());
    });
  }

  /**
   * @param {url} name
   * @private
   */
  addFont_(url){
    // Install fonts.
    const style = this.createElement_('link');
    style.href= url;
    style.rel = "stylesheet";
    this.ampdoc.win.document.head.append(style);
  }

  /**
   * @param {string} name
   * @return {!Element}
   * @private
   */
  createElement_(name) {
    return this.ampdoc.win.document.createElement(name);
  }


    /**
   * @return {!Element}
   * @private
   */
  getContainer_() {
    const id = TAG + '-dialog';
    const dialogContainer = this.ampdoc.getElementById(id);
    return user().assertElement(
        dialogContainer,
        'No element found with id ' + id
    );
  }

    /**
   * @private
   * @return {!Promise}
   */
  emptyContainer_() {
    // no need to do all of this if the container is already empty
    if (this.containerEmpty_) {
      return Promise.resolve();
    }
   this.removeListeners();
    return this.vsync_.mutatePromise(() => {
      this.containerEmpty_ = true;
      this.innerContainer_ = null;
      removeChildren(this.getContainer_());
     
    });
  }
  /**
   * @private
   * @param {?Function}  listener
   *  
   */
  addListener_(listener) {
    this.listeners_.push(listener);
  }

  /**
   * @private
   * @param {?Function}  listener
   *  
   */
  removeListeners(listener) {
    let unlistener;
    while ((unlistener = this.listeners_.shift())) {
      unlistener();
    }
  }

   /**
    *  /**
   * @param {!JsonObject} authentication
   * @private
   */
  renderUI(authentication) {
    console.log(authentication);
    const dialogContainer = createShadowRoot(this.getContainer_());
    const style = self.document.createElement('style');
    style.textContent = CSS;
    dialogContainer.appendChild(style);
    this.innerContainer_ = this.createElement_('div');
    this.innerContainer_.className = TAG + '-container';
    const main = this.createElement_('main');
    main.className = TAG + '__main';
    if(authentication.wallet) {
      main.append(this.renderLoggedInUI_(authentication));
    }else{
      main.append(this.renderLoggedOutUI_(authentication));
    }
    this.innerContainer_.append(main);
    this.innerContainer_.append(this.renderFooter_(authentication));
    this.containerEmpty_ = false;
    dialogContainer.appendChild(this.innerContainer_);
  }

  /**
   * @return {!Element}
   * @private
   */
  renderFooter_(authentication){
    const {user} = authentication;
    const html = htmlFor(this.createElement_('div'));
    const element =
        html`
        <footer class="amp-access-agate__footer">
          <a href="http://www.agate.one/"  target="blank" class="amp-access-agate__footer__brand">agate</a>
          <a ref="account" target="blank" class="amp-access-agate__footer__account">My Account</a>
        </footer>`;
    const {account} =  htmlRefs(element);
    if(user) {
      account.href = `${ACCOUNT_URL}?jwt_token=${user.jwt_token}`;
    }else {
      account.remove();
    }
    return element;
  }


  /**
   * @return {!Element}
   * @private
   */
  renderLoggedInUI_(authentication){
    const {wallet} = authentication;
    const html = htmlFor(this.createElement_('div'));
    const element =
        html`
        <section>
            <section class="amp-access-agate__balance">
              <h1 class="amp-access-agate__balance__title">Your Wallet balance:</h1>
              <p class="amp-access-agate__balance__amount" ref="balance" class="" />
            </section>
            <section class="amp-access-agate__gauge">
              <p><span ref="remainingUntilFree"></span>  until free</p>
            </section>
            <button class='amp-access-agate-button' role="button" ref="buttonLogout">Logout</button>
            <section ref="warning" class="amp-access-agate__warning">
              <p ref="warningText"  class="amp-access-agate__warning__text"></p>
             </section>
        </section>`;

    const {
      buttonLogout, 
      remainingUntilFree, 
      balance, 
      warning,
      warningText
    } =  htmlRefs(element);
    balance.textContent = wallet.balance;
    remainingUntilFree.textContent = wallet.remainingUntilFree;
    
    if(authentication.warning) {
      warningText.textContent = authentication.warning;
    }else{
      warning.remove();
    }

    const listener = listen(buttonLogout, 'click', ev => {
      this.handleLogin_(ev, LOGOUT_URL);
    });
    this.addListener_(listener);
    return element;
  }

  /**
   * @return {!Element}
   * @private
   */
  renderLoggedOutUI_(authentication){
    const html = htmlFor(this.createElement_('div'));
    const element =
        html`
        <section class="amp-access-agate__notice">
            <p> We recently ditched banner ads on our site in favour of a more sustainable, less intrusive solution.</p> 
            <p>Just create a wallet with our payment partner Agate and you'll be good to go.</p>
            <p>
            Pay <span ref="articleCost"></span> per article, no more that <span ref="capCost"></span> per week</p>
            <button class='amp-access-agate-button' role="button" ref="buttonLogin">Pay per article</button>
        </section>`;

    const {buttonLogin, articleCost, capCost} =  htmlRefs(element);
    capCost.textContent = authentication.publisher.cap_cost;
    articleCost.textContent = authentication.publisher.article_cost;
    const listener = listen(buttonLogin, 'click', ev => {
      this.handleLogin_(ev, LOGIN_URL);
    });
    this.addListener_(listener);
    return element;
  }

  /**
   * @param {!Event} ev
   * @private
   */
  handleLogin_(ev, loginURL) {
    ev.preventDefault();
    const urlPromise = this.accessSource_.buildUrl(
        loginURL, /* useAuthData */ false);
    return urlPromise.then(url => {
      dev().fine(TAG, 'LOGIN URL: ', url);
      this.accessSource_.loginWithUrl(url);
    });
  }
  /**
   * @return {!Promise}
   */
  pingback() {
    return Promise.resolve();
  }
}
