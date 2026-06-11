/* crazygames.js — H5 Puzzle Template — CrazyGames SDK v3 래퍼
   ═══════════════════════════════════════════════════════════════════
   SDK를 정적 <script> 태그로 넣지 않고, 도메인 확인 후 동적 로드합니다.

   ┌─────────────────────────────────────────────────────────────────┐
   │  file:// / localhost  →  SDK 로드 자체를 생략  →  에러 없음     │
   │  HTTPS (CG 도메인)    →  SDK 로드 → init() 성공 → _ready=true  │
   │  HTTPS (비CG 도메인)  →  SDK 로드 → sdkDisabled catch → no-op  │
   └─────────────────────────────────────────────────────────────────┘

   SG.CG 공개 API:
     await SG.CG.init()               → 한 번만 호출 (boot IIFE 내)
     SG.CG.isAvailable()              → CrazyGames 플랫폼 여부
     SG.CG.loadingStart/Stop()        → 에셋 로딩 추적
     SG.CG.gameplayStart/Stop()       → 게임플레이 추적
     await SG.CG.requestMidgameAd()   → 레벨 간 광고 (완료 대기)
     await SG.CG.requestRewardedAd()  → 보상형 광고 → { granted: bool }
*/
(function (global) {
  'use strict';

  const SG = global.SG = global.SG || {};

  let _sdk            = null;
  let _ready          = false;
  let _gameplayActive = false;

  function _loadSdkScript() {
    return new Promise(function(resolve) {
      if (global.CrazyGames && global.CrazyGames.SDK) return resolve(true);
      var s    = document.createElement('script');
      s.src    = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
      s.onload  = function() { resolve(true);  };
      s.onerror = function() { resolve(false); };
      document.head.appendChild(s);
    });
  }

  async function init() {
    var host = (typeof location !== 'undefined') ? location.hostname : '';
    var isCG = host === 'crazygames.com'
            || host.endsWith('.crazygames.com')
            || host.endsWith('.crazygames.io');
    if (!isCG) {
      console.debug('[SG.CG] non-CrazyGames host (' + (host || 'unknown') + ') — SDK init skipped');
      return false;
    }
    var loaded = await _loadSdkScript();
    if (!loaded) { console.warn('[SG.CG] SDK 스크립트 로드 실패'); return false; }
    var cgns = global.CrazyGames;
    if (!cgns || !cgns.SDK) { console.log('[SG.CG] window.CrazyGames.SDK 없음 — no-op'); return false; }
    try {
      _sdk   = cgns.SDK;
      await _sdk.init();
      _ready = true;
      console.log('[SG.CG] SDK v3 초기화 완료');
      return true;
    } catch (e) {
      console.log('[SG.CG] SDK 비활성화 (' + (e.code || e.message || e) + ') — no-op');
      return false;
    }
  }

  function isAvailable() { return _ready; }

  function loadingStart() { if (_ready) _sdk.game.loadingStart(); }
  function loadingStop()  { if (_ready) _sdk.game.loadingStop();  }

  function gameplayStart() {
    if (!_ready || _gameplayActive) return;
    _gameplayActive = true;
    _sdk.game.gameplayStart();
  }
  function gameplayStop() {
    if (!_ready || !_gameplayActive) return;
    _gameplayActive = false;
    _sdk.game.gameplayStop();
  }

  async function requestMidgameAd() {
    if (!_ready) return;
    gameplayStop();
    try { await _sdk.ad.requestAd('midgame'); } catch (e) {}
  }

  function requestRewardedAd() {
    if (!_ready) return Promise.resolve({ granted: false });
    gameplayStop();
    return new Promise(function(resolve) {
      _sdk.ad.requestAd('rewarded', {
        adStarted:  function() {},
        adFinished: function() { resolve({ granted: true  }); },
        adError:    function() { resolve({ granted: false }); },
      }).catch(function() { resolve({ granted: false }); });
    });
  }

  function showBanner() {}
  function hideBanner()  {}

  SG.CG = {
    init, isAvailable,
    loadingStart, loadingStop,
    gameplayStart, gameplayStop,
    requestMidgameAd, requestRewardedAd,
    showBanner, hideBanner,
  };

})(typeof window !== 'undefined' ? window : global);
