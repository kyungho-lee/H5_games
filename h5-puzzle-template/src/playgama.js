/* playgama.js — H5 Puzzle Template — Playgama Bridge SDK wrapper
   ═══════════════════════════════════════════════════════════════════
   Playgama Bridge SDK v1 래퍼.
   CrazyGames SDK와 동일한 SG.CG 인터페이스를 공유합니다:
     · CrazyGames SDK가 활성화된 경우 → Playgama 로드 생략 (CG 우선)
     · Playgama 플랫폼 감지 시        → SG.CG 메서드를 Playgama로 패치
     · file:// / localhost            → 로드 생략, no-op 모드

   ┌─────────────────────────────────────────────────────────────────┐
   │  CG 활성화  →  Playgama 생략           (CG 우선)               │
   │  Playgama   →  Bridge 로드 → SG.CG 패치                        │
   │  file://    →  SDK 로드 생략 (no-op)                           │
   └─────────────────────────────────────────────────────────────────┘

   ★ TODO: _HOF_LB_ID 를 Playgama 게임 등록 후 발급받은 리더보드 ID로 교체
*/
(function (global) {
  'use strict';

  const SG = global.SG = global.SG || {};

  // ── 중복 patch 가드 ─────────────────────────────────────────────
  if (SG.CG && SG.CG.requestRewardedAd && SG.CG.requestRewardedAd.__SG_PG_PATCHED__) {
    var _existingPlatform = SG.CG.requestRewardedAd.__SG_PG_PLATFORM__;
    if (_existingPlatform === 'qa_tool' || _existingPlatform === 'mock') {
      console.log('[SG.PG] SG.CG already patched by qa_tool/mock — skipping duplicate IIFE');
      return;
    }
    console.log('[SG.PG] overriding previous patch (platform: ' + _existingPlatform + ')');
  }

  // ── 디버그 로그 게이트: ?dev 또는 localStorage('sg_dev') = '1' ────
  const _DEV = ((typeof location !== 'undefined') &&
                new URLSearchParams(location.search).has('dev'))
            || ((typeof localStorage !== 'undefined') &&
                localStorage.getItem('sg_dev') === '1');
  function dlog() { if (_DEV) console.log.apply(console, arguments); }

  let _ready  = false;
  let _bridge = null;

  function isAvailable() { return _ready; }

  function _loadSdkScript() {
    return new Promise(function (resolve) {
      var src = 'https://bridge.playgama.com/v1/stable/playgama-bridge.js';
      if (document.querySelector('script[src="' + src + '"]')) return resolve(true);
      var s    = document.createElement('script');
      s.src    = src;
      s.onload  = function () { resolve(true);  };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (_ready) { dlog('[SG.PG] init() already completed — skip'); return true; }
    if (SG.CG && SG.CG.requestRewardedAd && SG.CG.requestRewardedAd.__SG_PG_PATCHED__) {
      console.log('[SG.PG] SG.CG already patched by another instance — skip init');
      _ready = true;
      return true;
    }

    var proto = typeof location !== 'undefined' ? location.protocol : '';
    var host  = typeof location !== 'undefined' ? location.hostname  : '';

    if (proto === 'file:') {
      console.log('[SG.PG] file:// — Playgama Bridge skipped (CORS)');
      return false;
    }

    var bridgePreloaded = typeof global.bridge !== 'undefined'
                          && typeof global.bridge.initialize === 'function';

    if (!bridgePreloaded) {
      var isLocal = host === '' || host === 'localhost' || host === '127.0.0.1';
      if (SG.CG && typeof SG.CG.isAvailable === 'function' && SG.CG.isAvailable()) {
        console.log('[SG.PG] CrazyGames SDK active — Playgama Bridge skipped');
        return false;
      }
      if (isLocal) {
        console.log('[SG.PG] Local env — Playgama Bridge skipped (no-op mode)');
        return false;
      }
      var loaded = await _loadSdkScript();
      if (!loaded) { console.warn('[SG.PG] Bridge script load failed'); return false; }
    } else {
      console.log('[SG.PG] Bridge preloaded via static <script> tag');
    }

    try {
      _bridge = global.bridge;
      if (!_bridge || typeof _bridge.initialize !== 'function') {
        console.warn('[SG.PG] window.bridge not found');
        return false;
      }

      await _bridge.initialize();
      _ready = true;
      var isMockPlatform = _bridge.platform.id === 'mock' || _bridge.platform.id === 'qa_tool';
      console.log('[SG.PG] Bridge initialized · platform:', _bridge.platform.id);

      var _interDelay = isMockPlatform ? 0 : 60;
      try { _bridge.advertisement.setMinimumDelayBetweenInterstitial(_interDelay); } catch (e) {}

      try {
        _bridge.platform.on('audioStateChanged', function (isEnabled) {
          if (typeof SG.PG._onAudioStateChanged === 'function') SG.PG._onAudioStateChanged(isEnabled);
        });
      } catch (e) {}

      try {
        _bridge.platform.on('pauseStateChanged', function (isPaused) {
          if (typeof SG.PG._onPauseStateChanged === 'function') SG.PG._onPauseStateChanged(isPaused);
        });
      } catch (e) {}

      _patchCG();
      return true;
    } catch (e) {
      console.warn('[SG.PG] Bridge init failed:', e);
      return false;
    }
  }

  function _patchCG() {
    if (!SG.CG) { console.warn('[SG.PG] SG.CG not found — patch skipped'); return; }

    SG.CG.loadingStart = function () {};
    SG.CG.loadingStop  = function () {
      if (_bridge) try { _bridge.platform.sendMessage('game_ready'); } catch (e) {}
    };
    SG.CG.gameplayStart = function () {};
    SG.CG.gameplayStop  = function () {};

    SG.CG.requestMidgameAd = async function () {
      console.log('[PG.inter] called — ready:', _ready, '| platform:', _bridge && _bridge.platform.id);
      if (!_ready || !_bridge) { console.warn('[PG.inter] not ready — skipped'); return; }
      var isMock = _bridge.platform.id === 'mock' || _bridge.platform.id === 'qa_tool';
      return new Promise(function (resolve) {
        var done = false, timeout = null;
        function finish() {
          if (done) return; done = true; clearTimeout(timeout); resolve();
        }
        function onState(state) {
          console.log('[PG.inter] state:', state);
          if (state === 'closed' || state === 'failed') {
            try { _bridge.advertisement.off(evInter, onState); } catch (e) {}
            finish();
          }
        }
        var evInter = (_bridge.EVENT_NAME && _bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED)
                      || 'interstitialStateChanged';
        _bridge.advertisement.on(evInter, onState);
        timeout = setTimeout(function () {
          try { _bridge.advertisement.off(evInter, onState); } catch (e) {}
          finish();
        }, 15000);
        console.log('[PG.inter] calling showInterstitial — isMock:', isMock);
        Promise.resolve(_bridge.advertisement.showInterstitial('level_complete'))
          .catch(function (e) {
            console.warn('[PG.inter] showInterstitial threw:', e);
            try { _bridge.advertisement.off(evInter, onState); } catch (e2) {}
            finish();
          });
      });
    };

    SG.CG.requestRewardedAd = async function (placementId) {
      console.log('[PG.rewarded] called — ready:', _ready, '| platform:', _bridge && _bridge.platform.id);
      if (!_ready || !_bridge) { console.warn('[PG.rewarded] not ready — granted:false'); return { granted: false }; }
      var isMockR = _bridge.platform.id === 'mock' || _bridge.platform.id === 'qa_tool';
      var pid = placementId || 'retry_reward';
      return new Promise(function (resolve) {
        var granted = false, done = false, sawFailed = false, timeout = null;
        function finish() {
          if (done) return; done = true; clearTimeout(timeout);
          if (!granted && !isMockR && sawFailed && SG.Notify) {
            SG.Notify.error('AD_REWARDED', { retry: function () { SG.CG.requestRewardedAd(pid); } });
          }
          resolve({ granted });
        }
        function onState(state) {
          console.log('[PG.rewarded] state:', state, '| done:', done);
          if (state === 'rewarded') { granted = true; }
          if (state === 'closed' || state === 'failed') {
            try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
            if (state === 'failed') sawFailed = true;
            finish();
          }
        }
        var evRew = (_bridge.EVENT_NAME && _bridge.EVENT_NAME.REWARDED_STATE_CHANGED)
                    || 'rewardedStateChanged';
        _bridge.advertisement.on(evRew, onState);
        timeout = setTimeout(function () {
          sawFailed = true;
          try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
          finish();
        }, 15000);
        console.log('[PG.rewarded] calling showRewarded, pid:', pid);
        Promise.resolve(_bridge.advertisement.showRewarded(pid))
          .catch(function (e) {
            console.warn('[PG.rewarded] showRewarded threw:', e);
            try { _bridge.advertisement.off(evRew, onState); } catch (e2) {}
            finish();
          });
      });
    };

    SG.CG.showBanner = async function () {
      if (!_ready || !_bridge) return;
      if (!_bridge.advertisement.isBannerSupported) return;
      try { await _bridge.advertisement.showBanner(); } catch (e) {}
    };
    SG.CG.hideBanner = async function () {
      if (!_ready || !_bridge) return;
      try { await _bridge.advertisement.hideBanner(); } catch (e) {}
    };

    SG.CG.isAvailable = function () { return true; };

    var _pid = _bridge.platform.id;
    SG.CG.requestRewardedAd.__SG_PG_PATCHED__  = true;
    SG.CG.requestRewardedAd.__SG_PG_PLATFORM__ = _pid;
    SG.CG.requestMidgameAd.__SG_PG_PATCHED__   = true;
    SG.CG.requestMidgameAd.__SG_PG_PLATFORM__  = _pid;
    console.log('[SG.PG] SG.CG methods patched to use Playgama Bridge');
  }

  async function storageGet(keys) {
    if (!_ready || !_bridge) return {};
    try { return await _bridge.storage.get(keys); } catch (e) { return {}; }
  }
  async function storageSet(data) {
    if (!_ready || !_bridge) return false;
    try { await _bridge.storage.set(data); return true; } catch (e) { return false; }
  }

  function platformId()       { return (_ready && _bridge) ? _bridge.platform.id : 'unknown'; }
  function platformLanguage() { return (_ready && _bridge) ? (_bridge.platform.language || 'en') : 'en'; }

  // ── TODO: Playgama 게임 등록 후 리더보드 ID로 교체 ───────────────
  var _HOF_LB_ID = 'YOUR_GAME_ID_rank';

  function lbGetType() {
    if (!_ready || !_bridge || !_bridge.leaderboards) return 'not_available';
    return _bridge.leaderboards.type || 'not_available';
  }
  function lbSubmit(score) {
    if (!_ready || !_bridge || !_bridge.leaderboards) return Promise.resolve();
    if (lbGetType() === 'not_available') return Promise.resolve();
    return Promise.resolve(_bridge.leaderboards.setScore(_HOF_LB_ID, score))
      .catch(function (e) { console.warn('[SG.PG.lb] setScore failed:', e); });
  }
  function lbGetEntries() {
    if (!_ready || !_bridge || !_bridge.leaderboards) return Promise.resolve(null);
    if (lbGetType() !== 'in_game') return Promise.resolve(null);
    return Promise.resolve(_bridge.leaderboards.getEntries(_HOF_LB_ID))
      .catch(function (e) { console.warn('[SG.PG.lb] getEntries failed:', e); return null; });
  }

  SG.PG = {
    init,
    isAvailable,
    storageGet,
    storageSet,
    platformId,
    platformLanguage,
    leaderboard: {
      getType:    lbGetType,
      submit:     lbSubmit,
      getEntries: lbGetEntries,
    },
    _onAudioStateChanged: null,
    _onPauseStateChanged: null,
  };

})(typeof window !== 'undefined' ? window : global);
