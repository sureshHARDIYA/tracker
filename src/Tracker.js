import Fingerprint2 from '@fingerprintjs/fingerprintjs';
import uuidv4 from 'uuid/dist/esm-browser/v4';

import MediaTracker from './MediaTracker';

const ATTR_NAMESPACE = 'data-tracker';
const ATTR_CLICK = `${ATTR_NAMESPACE}-click`;
const ATTR_MEDIA = `${ATTR_NAMESPACE}-media`;

const SENDING_DELAY = 2000;
const LOCAL_STORAGE_USER_ID_KEY = 'trackerUserId';

export default class Tracker {
  constructor() {
    // Bind methods context
    this.globalOnClick = this.globalOnClick.bind(this);
    this.trackEvent = this.trackEvent.bind(this);
  }

  init(params = {}) {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.key = params.key;
    this.endpoint = params.endpoint;

    this.userId = null;
    this.sessionId = uuidv4().replace(/-/g, '');
    this.events = [];
    this.mediaTrackers = [];

    this.isTrackingClick = false;
    this.isPageBlured = false;
    this.sendEventsTimeout = 0;

    this.pageViewedAt = Date.now();
    this.pageBluredAt = 0;
    this.offFocusDuration = 0;

    window.addEventListener('beforeunload', () => {
      this.mediaTrackers.forEach(({ tracker }) => {
        tracker.interrupt();
      });
      this.trackPageLeave();
      this.sendEvents();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.isPageBlured) {
        this.isPageBlured = true;
        this.pageBluredAt = Date.now();
        this.trackEvent('pageBlur', '');
        return;
      }

      if (!document.hidden && this.isPageBlured) {
        this.offFocusDuration += Date.now() - this.pageBluredAt;
        this.isPageBlured = false;
        this.pageBluredAt = 0;
        this.trackEvent('pageFocus', '');
      }
    });

    if (params && params.autoBind) {
      this.setupClickEventTracking();
      this.setupMediaEventsTracking();
      this.trackPageView('', {
        from: document.referrer,
      });
    }

    this.identifyUser();
  }

  identifyUser() {
    this.userId = window.localStorage.getItem(LOCAL_STORAGE_USER_ID_KEY);
    if (this.userId) {
      this.sendEvents();
      return;
    }

    window.requestIdleCallback(() => {
      Fingerprint2.get((components) => {
        const values = components.map((component) => component.value);
        this.userId = Fingerprint2.x64hash128(values.join(''), 31);
        window.localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, this.userId);
        this.sendEvents();
      }, 5000);
    });
  }

  trackEvent(event, name, data, eventUrl) {
    this.events.push({
      event,
      name,
      time: Date.now(),
      url: eventUrl || document.location.href,
      data,
    });
    this.scheduleSendEvents();
  }

  trackPageView(name, data, eventUrl) {
    this.isPageBlured = false;
    this.pageViewedAt = Date.now();
    this.offFocusDuration = 0;
    this.trackEvent('pageView', name, data, eventUrl);
  }

  trackPageLeave(name, data, eventUrl) {
    this.trackEvent('pageLeave', name, {
      ...data,
      sessionDuration: Date.now() - this.pageViewedAt,
      offFocusDuration: this.offFocusDuration,
    }, eventUrl);
    this.isPageBlured = false;
    this.pageViewedAt = 0;
    this.offFocusDuration = 0;
  }

  scheduleSendEvents() {
    clearTimeout(this.sendEventsTimeout);
    this.sendEventsTimeout = setTimeout(() => {
      this.sendEvents();
    }, SENDING_DELAY);
  }

  sendEvents() {
    clearTimeout(this.sendEventsTimeout);

    if (!this.userId) return; // don't send if user id is not defined yet
    if (!this.events.length) return;

    if (!this.endpoint) {
      console.warn('Endpoint is not set');
    } else {
      const payload = JSON.stringify({
        events: this.events,
        key: this.key,
        userId: this.userId,
        sessionId: this.sessionId,
      });

      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.endpoint);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload);

      xhr.onerror = () => { /* do nothing */ };
    }

    this.events = [];
  }

  setupClickEventTracking() {
    // Use delegated click event handler only if trackable element exists in the DOM
    const isTrackingClick = this.isTrackingClick;
    this.isTrackingClick = !!document.querySelector(`[${ATTR_CLICK}]`);

    if (isTrackingClick && !this.isTrackingClick) {
      document.removeEventListener('click', this.globalOnClick);
      return;
    }

    if (!isTrackingClick && this.isTrackingClick) {
      document.addEventListener('click', this.globalOnClick);
    }
  }

  globalOnClick(e) {
    if (!this.isTrackingClick) return;

    let target = e.target;
    while (target !== document.documentElement) {
      const config = target.getAttribute(ATTR_CLICK);
      if (config) {
        try {
          const { name, data } = JSON.parse(config);
          if (name) {
            this.trackEvent('click', name.toString(), data);
          }
        } catch (err) {
          console.warn(`Invalid data-tracker-click attribute value: "${config}"`);
        }
      }

      target = target.parentNode;
    }
  }

  bindMediaTracking(el, name, data) {
    const isVideo = el.tagName === 'VIDEO';
    const isAudio = el.tagName === 'AUDIO';

    if (!isVideo && !isAudio) {
      console.warn('Invalid media element: should be <video> or <audio>');
      return;
    }

    // Prevent double init
    if (this.mediaTrackers.some((entry) => entry.el === el)) return;

    const type = isVideo ? 'video' : 'audio';

    const mediaTracker = new MediaTracker(el, {
      onPlay: ({ time }) => {
        this.trackEvent(`${type}:play`, name, { ...data, time });
      },
      onPause: ({ time }) => {
        this.trackEvent(`${type}:pause`, name, { ...data, time });
      },
      onEnded: () => {
        this.trackEvent(`${type}:ended`, name, { ...data });
      },
      onInterrupted: ({ time }) => {
        this.trackEvent(`${type}:interrupted`, name, { ...data, time });
      },
    });

    this.mediaTrackers.push({ el, tracker: mediaTracker });
  }

  setupMediaEventsTracking() {
    const els = document.body.querySelectorAll(`[${ATTR_MEDIA}]`);

    Array.prototype.forEach.call(els, (el) => {
      let name = '';
      let data = {};

      let config = el.getAttribute(ATTR_MEDIA);
      try {
        if (config) {
          config = JSON.parse(config);
          if (config.name) name = config.name.toString();
          if (typeof config.data === 'object') data = { ...config.data };
        }
      } catch (err) {
        console.warn(`Invalid data-tracker-media attribute value: "${config}"`);
      }

      this.bindMediaTracking(el, name, data);
    });
  }
}
