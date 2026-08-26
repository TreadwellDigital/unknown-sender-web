/* ============================================================
   Unknown Sender — cookie consent banner
   Pairs with the Consent Mode v2 default-deny snippet in <head>.
   On user choice:
     • Persists the decision in localStorage
     • Calls gtag('consent', 'update', ...) so Google tags react
     • Pushes a `consent_update` event to dataLayer so GTM can
       trigger non-Google marketing tags (Meta Pixel, TikTok, etc.)
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'us_consent_v1';
  var ACCENT = '#E11414';

  // --------------------------------------------------------
  // Storage
  // --------------------------------------------------------
  function loadConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function saveConsent(consent) {
    var payload = {
      analytics: !!consent.analytics,
      marketing: !!consent.marketing,
      timestamp: Date.now(),
      version: 1
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (e) {}
    applyConsent(payload);
    closeBanner();
  }

  // --------------------------------------------------------
  // Push consent state to gtag + dataLayer
  // --------------------------------------------------------
  function applyConsent(consent) {
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }

    gtag('consent', 'update', {
      ad_storage:         consent.marketing ? 'granted' : 'denied',
      ad_user_data:       consent.marketing ? 'granted' : 'denied',
      ad_personalization: consent.marketing ? 'granted' : 'denied',
      analytics_storage:  consent.analytics ? 'granted' : 'denied'
    });

    // Generic event so GTM can trigger non-Google tags conditionally
    window.dataLayer.push({
      event: 'consent_update',
      consent: {
        analytics: !!consent.analytics,
        marketing: !!consent.marketing
      }
    });
  }

  // --------------------------------------------------------
  // Styles
  // --------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('us-cb-styles')) return;
    var css = ''
      + '#us-cb {'
      + '  position: fixed; bottom: 20px; left: 20px; right: 20px;'
      + '  max-width: 460px; z-index: 9999;'
      + '  background: rgba(8,8,8,0.96);'
      + '  border: 1px solid rgba(255,255,255,0.12);'
      + '  border-radius: 12px; padding: 22px 22px 20px;'
      + '  color: #f5f5f5;'
      + '  font-family: "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;'
      + '  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);'
      + '  box-shadow: 0 12px 48px rgba(0,0,0,0.6);'
      + '  animation: us-cb-rise .5s ease;'
      + '}'
      + '@keyframes us-cb-rise { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }'
      + '#us-cb .us-cb-eye {'
      + '  font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;'
      + '  font-size: 10.5px; letter-spacing: .22em; color: #8a8a8a;'
      + '  text-transform: uppercase; margin-bottom: 10px;'
      + '  display: flex; align-items: center; gap: 8px;'
      + '}'
      + '#us-cb .us-cb-eye::before {'
      + '  content: ""; width: 6px; height: 6px; border-radius: 50%;'
      + '  background: ' + ACCENT + '; box-shadow: 0 0 8px rgba(225,20,20,.5);'
      + '}'
      + '#us-cb h3 { font-size: 16px; font-weight: 600; margin: 0 0 8px; line-height: 1.3; }'
      + '#us-cb p { font-size: 13.5px; line-height: 1.5; color: #cfcfcf; margin: 0 0 16px; }'
      + '#us-cb p a { color: #f5f5f5; text-decoration: underline; text-decoration-color: rgba(255,255,255,0.3); text-underline-offset: 2px; }'
      + '#us-cb p a:hover { text-decoration-color: ' + ACCENT + '; }'
      + '#us-cb .us-cb-actions { display: flex; gap: 8px; flex-wrap: wrap; }'
      + '#us-cb button {'
      + '  flex: 1; min-width: 110px; padding: 11px 14px; cursor: pointer;'
      + '  border: 1px solid rgba(255,255,255,0.15);'
      + '  background: rgba(255,255,255,0.04); color: #f5f5f5;'
      + '  font-family: inherit; font-size: 12.5px; font-weight: 500;'
      + '  letter-spacing: .04em; border-radius: 8px;'
      + '  transition: background .2s, border-color .2s;'
      + '}'
      + '#us-cb button:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.25); }'
      + '#us-cb button.us-cb-primary { background: ' + ACCENT + '; border-color: ' + ACCENT + '; color: #fff; font-weight: 600; }'
      + '#us-cb button.us-cb-primary:hover { background: #ff1a1a; border-color: #ff1a1a; }'
      + '#us-cb .us-cb-customize-btn {'
      + '  background: transparent; border: none; color: #8a8a8a;'
      + '  text-decoration: underline; text-underline-offset: 3px;'
      + '  padding: 0; font-size: 11.5px; margin-top: 12px;'
      + '  cursor: pointer; min-width: 0; flex: 0 0 auto;'
      + '}'
      + '#us-cb .us-cb-customize-btn:hover { color: #f5f5f5; background: transparent; }'
      + '#us-cb .us-cb-custom { display: none; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08); }'
      + '#us-cb .us-cb-custom.show { display: block; }'
      + '#us-cb .us-cb-cat { display: flex; align-items: flex-start; gap: 12px; padding: 8px 0; }'
      + '#us-cb .us-cb-cat label { flex: 1; font-size: 13px; line-height: 1.4; cursor: pointer; }'
      + '#us-cb .us-cb-cat small { display: block; color: #8a8a8a; font-size: 11.5px; margin-top: 2px; line-height: 1.4; }'
      + '#us-cb .us-cb-cat input[type="checkbox"] { margin-top: 3px; accent-color: ' + ACCENT + '; }'
      + '#us-cb .us-cb-cat input[type="checkbox"]:disabled { opacity: .5; }'
      + '@media (max-width: 520px) {'
      + '  #us-cb { bottom: 12px; left: 12px; right: 12px; padding: 18px 16px 16px; }'
      + '  #us-cb button { font-size: 12px; }'
      + '}';

    var style = document.createElement('style');
    style.id = 'us-cb-styles';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  // --------------------------------------------------------
  // Banner DOM
  // --------------------------------------------------------
  function buildBanner(prefill) {
    closeBanner(); // ensure only one in DOM at a time

    var banner = document.createElement('div');
    banner.id = 'us-cb';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie preferences');
    banner.innerHTML = ''
      + '<div class="us-cb-eye">Notice</div>'
      + '<h3>Cookies, briefly.</h3>'
      + '<p>We use a few cookies to understand how the site is used and to help us reach the right people. You’re in control. See our <a href="privacy.html">privacy policy</a> for the detail.</p>'
      + '<div class="us-cb-actions">'
      + '  <button type="button" class="us-cb-reject">Reject all</button>'
      + '  <button type="button" class="us-cb-primary us-cb-accept">Accept all</button>'
      + '</div>'
      + '<button type="button" class="us-cb-customize-btn">Customise</button>'
      + '<div class="us-cb-custom">'
      + '  <div class="us-cb-cat">'
      + '    <input type="checkbox" id="us-cb-nec" checked disabled />'
      + '    <label for="us-cb-nec">Necessary<small>Required for the site to work, e.g. remembering this choice. Always on.</small></label>'
      + '  </div>'
      + '  <div class="us-cb-cat">'
      + '    <input type="checkbox" id="us-cb-an" />'
      + '    <label for="us-cb-an">Analytics<small>Anonymous traffic stats so we know what’s working. Google Analytics 4.</small></label>'
      + '  </div>'
      + '  <div class="us-cb-cat">'
      + '    <input type="checkbox" id="us-cb-mk" />'
      + '    <label for="us-cb-mk">Marketing<small>Lets us reach people with similar interests via ads. Google Ads and similar.</small></label>'
      + '  </div>'
      + '  <div class="us-cb-actions" style="margin-top:14px;">'
      + '    <button type="button" class="us-cb-primary us-cb-save">Save choices</button>'
      + '  </div>'
      + '</div>';

    document.body.appendChild(banner);

    if (prefill) {
      banner.querySelector('.us-cb-custom').classList.add('show');
      banner.querySelector('#us-cb-an').checked = !!prefill.analytics;
      banner.querySelector('#us-cb-mk').checked = !!prefill.marketing;
    }

    banner.querySelector('.us-cb-accept').addEventListener('click', function () {
      saveConsent({ analytics: true, marketing: true });
    });
    banner.querySelector('.us-cb-reject').addEventListener('click', function () {
      saveConsent({ analytics: false, marketing: false });
    });
    banner.querySelector('.us-cb-customize-btn').addEventListener('click', function () {
      banner.querySelector('.us-cb-custom').classList.toggle('show');
    });
    banner.querySelector('.us-cb-save').addEventListener('click', function () {
      saveConsent({
        analytics: banner.querySelector('#us-cb-an').checked,
        marketing: banner.querySelector('#us-cb-mk').checked
      });
    });
  }

  function closeBanner() {
    var existing = document.getElementById('us-cb');
    if (existing) existing.parentNode.removeChild(existing);
  }

  // --------------------------------------------------------
  // Public API
  // --------------------------------------------------------
  window.openCookiePreferences = function () {
    injectStyles();
    var existing = loadConsent();
    buildBanner(existing || { analytics: false, marketing: false });
  };

  function wireUpLinks() {
    var links = document.querySelectorAll('[data-cookie-prefs]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function (e) {
        e.preventDefault();
        window.openCookiePreferences();
      });
    }
  }

  // --------------------------------------------------------
  // Init
  // --------------------------------------------------------
  function init() {
    injectStyles();
    wireUpLinks();
    var existing = loadConsent();
    if (existing) {
      // Returning visitor — replay their stored choice to gtag/dataLayer
      applyConsent(existing);
    } else {
      // First visit — show the banner
      buildBanner(null);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
