/* crazygames.js — SameGame · Grid Protocol — CrazyGames SDK v3 래퍼
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

  let _sdk            = null;  // CrazyGames.SDK 인스턴스
  let _ready          = false; // init() 완료 여부
  let _gameplayActive = false; // 이중 호출 방지용 상태

  // ── SDK 스크립트 동적 삽입 ──────────────────────────────────────
  function _loadSdkScript() {
    return new Promise(function(resolve) {
      // 이미 로드된 경우 즉시 resolve
      if (global.CrazyGames && global.CrazyGames.SDK) {
        return resolve(true);
      }
      var s    = document.createElement('script');
      s.src    = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
      s.onload  = function() { resolve(true);  };
      s.onerror = function() { resolve(false); };
      document.head.appendChild(s);
    });
  }

  // ── 초기화 ─────────────────────────────────────────────────────
  async function init() {
    // ① 비-CrazyGames 호스트면 SDK 로드 자체를 건너뜀.
    //    (init 후 SDK 내부 background promise 가 sdkDisabled 를 throw 하는 것을
    //     호출 시점이 아닌 호스트 시점에서 차단)
    var host = (typeof location !== 'undefined') ? location.hostname : '';
    var isCG = host === 'crazygames.com'
            || host.endsWith('.crazygames.com')
            || host.endsWith('.crazygames.io');

    if (!isCG) {
      console.debug('[SG.CG] non-CrazyGames host (' + (host || 'unknown') + ') — SDK init skipped');
      return false;
    }

    // ② 원격 환경: SDK 동적 로드
    var loaded = await _loadSdkScript();
    if (!loaded) {
      console.warn('[SG.CG] SDK 스크립트 로드 실패');
      return false;
    }

    var cgns = global.CrazyGames;
    if (!cgns || !cgns.SDK) {
      console.log('[SG.CG] window.CrazyGames.SDK 없음 — no-op 모드');
      return false;
    }

    // ③ SDK 초기화 (비CG 도메인이면 sdkDisabled 예외 → catch → no-op)
    try {
      _sdk   = cgns.SDK;
      await _sdk.init();
      _ready = true;
      console.log('[SG.CG] SDK v3 초기화 완료');
      return true;
    } catch (e) {
      // sdkDisabled: CrazyGames 플랫폼이 아닌 도메인
      console.log('[SG.CG] SDK 비활성화 (' + (e.code || e.message || e) + ') — no-op 모드');
      return false;
    }
  }

  /** CrazyGames 플랫폼 여부 */
  function isAvailable() { return _ready; }

  // ── 로딩 추적 ──────────────────────────────────────────────────
  function loadingStart() {
    if (!_ready) return;
    _sdk.game.loadingStart();
  }

  function loadingStop() {
    if (!_ready) return;
    _sdk.game.loadingStop();
  }

  // ── 게임플레이 추적 (중복 호출 방지) ───────────────────────────
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

  // ── 미드게임 광고 (레벨 클리어 → 다음 레벨 전) ────────────────
  // 광고가 끝날 때까지 await → 이후 게임 재개
  async function requestMidgameAd() {
    if (!_ready) return;
    gameplayStop();
    try {
      await _sdk.ad.requestAd('midgame');
    } catch (e) {
      // 광고 없음 / 차단 / 실패 → 계속 진행
    }
    // 주의: gameplayStart()는 호출 측(startLevel)에서 수행
  }

  // ── 보상형 광고 (daily.html 재도전) ───────────────────────────
  // Returns: Promise<{ granted: boolean }>
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

  // ── 배너 광고 (CrazyGames SDK v3에는 별도 배너 API 없음 → no-op) ─
  function showBanner() { /* CrazyGames: no-op */ }
  function hideBanner()  { /* CrazyGames: no-op */ }

  SG.CG = {
    init, isAvailable,
    loadingStart, loadingStop,
    gameplayStart, gameplayStop,
    requestMidgameAd, requestRewardedAd,
    showBanner, hideBanner,
  };

})(typeof window !== 'undefined' ? window : global);
