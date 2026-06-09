/* playgama.js — SameGame · Grid Protocol — Playgama Bridge SDK wrapper
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
*/
(function (global) {
  'use strict';

  const SG = global.SG = global.SG || {};

  let _ready  = false;
  let _bridge = null;

  function isAvailable() { return _ready; }

  // ── SDK 스크립트 동적 로드 ─────────────────────────────────────
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

  // ── 초기화 ─────────────────────────────────────────────────────
  async function init() {
    var proto = typeof location !== 'undefined' ? location.protocol : '';
    var host  = typeof location !== 'undefined' ? location.hostname  : '';

    // file:// 환경: Bridge가 playgama-bridge-config.json을 fetch() 시도 →
    // CORS 정책으로 실패. initialize() 자체를 건너뜀.
    if (proto === 'file:') {
      console.log('[SG.PG] file:// — Playgama Bridge skipped (CORS)');
      return false;
    }

    // Bridge가 정적 <script> 태그로 이미 로드된 경우 → 도메인 체크/동적 로드 건너뜀
    var bridgePreloaded = typeof global.bridge !== 'undefined'
                          && typeof global.bridge.initialize === 'function';

    if (!bridgePreloaded) {
      var isLocal = host === '' || host === 'localhost' || host === '127.0.0.1';

      // CrazyGames가 이미 활성화 → Playgama 불필요
      if (SG.CG && typeof SG.CG.isAvailable === 'function' && SG.CG.isAvailable()) {
        console.log('[SG.PG] CrazyGames SDK active — Playgama Bridge skipped');
        return false;
      }

      if (isLocal) {
        console.log('[SG.PG] Local env — Playgama Bridge skipped (no-op mode)');
        return false;
      }

      var loaded = await _loadSdkScript();
      if (!loaded) {
        console.warn('[SG.PG] Bridge script load failed');
        return false;
      }
    } else {
      console.log('[SG.PG] Bridge preloaded via static <script> tag');
    }

    try {
      _bridge = global.bridge; // Playgama Bridge는 window.bridge 로 노출
      if (!_bridge || typeof _bridge.initialize !== 'function') {
        console.warn('[SG.PG] window.bridge not found');
        return false;
      }

      await _bridge.initialize();
      _ready = true;
      console.log('[SG.PG] Bridge initialized · platform:', _bridge.platform.id);

      // SDK 내장 인터스티셜 최소 간격 설정 (기본값 60초)
      // 게임 코드의 수동 타이머 대신 SDK가 쿨다운을 추적합니다.
      try { _bridge.advertisement.setMinimumDelayBetweenInterstitial(60); } catch (e) {}

      // ── 플랫폼 이벤트 — 오디오 상태 ─────────────────────────────
      // 인터스티셜·리워드 광고, 브라우저 탭 전환, 시스템 일시정지 등
      // 모든 케이스를 단일 핸들러로 처리합니다.
      // 게임 코드(index.html, endless.html)가 _onAudioStateChanged 를 등록하면
      // Bridge가 isEnabled 값을 전달합니다: true = 소리 ON / false = 뮤트.
      try {
        _bridge.platform.on('audioStateChanged', function (isEnabled) {
          if (typeof SG.PG._onAudioStateChanged === 'function') {
            SG.PG._onAudioStateChanged(isEnabled);
          }
        });
      } catch (e) {}

      // SG.CG 메서드를 Playgama 동작으로 교체
      _patchCG();
      return true;
    } catch (e) {
      console.warn('[SG.PG] Bridge init failed:', e);
      return false;
    }
  }

  // ── SG.CG 패치 (Playgama 활성화 시에만 호출) ──────────────────
  // 기존 게임 코드(samegame.html / daily.html)는 SG.CG.* 그대로 사용.
  // Playgama 플랫폼에서만 이 함수로 내부 구현을 교체합니다.
  function _patchCG() {
    if (!SG.CG) {
      console.warn('[SG.PG] SG.CG not found — patch skipped');
      return;
    }

    // ── loadingStart / loadingStop ──────────────────────────────
    SG.CG.loadingStart = function () {
      // Playgama는 game_ready 시점에 로딩 종료를 알림
      // loadingStart 는 no-op
    };

    SG.CG.loadingStop = function () {
      // 게임 에셋 로드 완료 → game_ready 전송
      if (_bridge) {
        try { _bridge.platform.sendMessage('game_ready'); } catch (e) { /* 무시 */ }
      }
    };

    // ── gameplayStart / gameplayStop ────────────────────────────
    SG.CG.gameplayStart = function () { /* Playgama는 별도 알림 없음 */ };
    SG.CG.gameplayStop  = function () { /* Playgama는 별도 알림 없음 */ };

    // ── 미드게임(인터스티셜) 광고 ───────────────────────────────
    // 레벨 클리어 직후 호출. 광고가 닫힐 때까지 await 로 대기.
    SG.CG.requestMidgameAd = async function () {
      if (!_ready || !_bridge) return;
      // 플랫폼이 인터스티셜을 지원하지 않으면 즉시 반환
      if (!_bridge.advertisement.isInterstitialSupported) return;
      // ※ mock 플랫폼 skip 제거: Playgama QA 검증기가 mock 모드로 실행되며
      //   showInterstitial() 호출을 가로채(intercept) 테스트합니다.
      //   15초 안전 타임아웃이 무한 대기를 방지합니다.

      return new Promise(function (resolve) {
        var done = false;
        var timeout = null;

        function finish() {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          // 오디오 복원은 플랫폼 audioStateChanged 이벤트가 자동 처리
          resolve();
        }

        // 상태 리스너: closed|failed → Promise resolve
        // 오디오 뮤트/복원은 platform.on('audioStateChanged') 핸들러가 담당
        function onState(state) {
          if (state === 'closed' || state === 'failed') {
            try { _bridge.advertisement.off('interstitialStateChanged', onState); } catch (e) {}
            finish();
          }
        }

        _bridge.advertisement.on('interstitialStateChanged', onState);

        // 15초 안전 타임아웃 (네트워크 문제 등)
        timeout = setTimeout(function () {
          try { _bridge.advertisement.off('interstitialStateChanged', onState); } catch (e) {}
          finish();
        }, 15000);

        // Promise.resolve() 래핑: mock 플랫폼에서 undefined 반환 시에도 안전
        Promise.resolve(_bridge.advertisement.showInterstitial('level_complete'))
          .catch(function () {
            try { _bridge.advertisement.off('interstitialStateChanged', onState); } catch (e) {}
            finish();
          });
      });
    };

    // ── 리워드 광고 ─────────────────────────────────────────────
    // 실패 재도전·보상 버튼에서 호출. { granted: bool } 반환.
    // placementId: 선택 파라미터 (기본값 'retry_reward')
    SG.CG.requestRewardedAd = async function (placementId) {
      console.log('[PG.rewarded] called — ready:', _ready, '| bridge:', !!_bridge,
                  '| isRewardedSupported:', _bridge && _bridge.advertisement.isRewardedSupported,
                  '| platform:', _bridge && _bridge.platform.id);
      if (!_ready || !_bridge) return { granted: false };
      // 플랫폼이 리워드 광고를 지원하지 않으면 즉시 반환
      if (!_bridge.advertisement.isRewardedSupported) {
        console.warn('[PG.rewarded] isRewardedSupported = false → skipped');
        return { granted: false };
      }
      // ※ mock 플랫폼 skip 제거: Playgama QA 검증기가 mock 모드로 실행되며
      //   showRewarded() 호출을 가로채(intercept) 테스트합니다.
      //   30초 안전 타임아웃이 무한 대기를 방지합니다.

      var pid = placementId || 'retry_reward';

      return new Promise(function (resolve) {
        var granted = false;
        var done    = false;
        var timeout = null;

        function finish() {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          // 오디오 복원은 플랫폼 audioStateChanged 이벤트가 자동 처리
          resolve({ granted });
        }

        // rewarded 상태에서만 보상 지급 (closed로 건너뛰면 granted = false 유지)
        // 오디오 뮤트/복원은 platform.on('audioStateChanged') 핸들러가 담당
        function onState(state) {
          if (state === 'rewarded') {
            granted = true;  // 시청 완료 → 보상 지급
          }
          if (state === 'closed' || state === 'failed') {
            try { _bridge.advertisement.off('rewardedStateChanged', onState); } catch (e) {}
            finish();
          }
        }

        _bridge.advertisement.on('rewardedStateChanged', onState);

        timeout = setTimeout(function () {
          try { _bridge.advertisement.off('rewardedStateChanged', onState); } catch (e) {}
          finish();
        }, 30000);

        // Promise.resolve() 래핑: mock 플랫폼에서 undefined 반환 시에도 안전
        Promise.resolve(_bridge.advertisement.showRewarded(pid))
          .catch(function () {
            try { _bridge.advertisement.off('rewardedStateChanged', onState); } catch (e) {}
            finish();
          });
      });
    };

    // ── 배너 광고 ────────────────────────────────────────────────
    // 유휴 화면(메뉴, 게임오버, 결과 등)에서 표시.
    // isBannerSupported 가 false인 플랫폼에서는 no-op.
    SG.CG.showBanner = async function () {
      if (!_ready || !_bridge) return;
      if (!_bridge.advertisement.isBannerSupported) return;
      try { await _bridge.advertisement.showBanner(); } catch (e) {}
    };

    SG.CG.hideBanner = async function () {
      if (!_ready || !_bridge) return;
      try { await _bridge.advertisement.hideBanner(); } catch (e) {}
    };

    // ── isAvailable override ────────────────────────────────────
    // SG.CG.isAvailable()이 true를 반환하도록 교체
    SG.CG.isAvailable = function () { return true; };

    // ── QA 테스트 패널 (mock 플랫폼 전용) ───────────────────────
    // Playgama QA 검증기는 mock 모드로 실행됩니다.
    // 이 패널은 QA 검증기가 광고 버튼에 쉽게 접근할 수 있도록
    // 모든 화면 위에 플로팅 버튼을 표시합니다.
    if (_bridge.platform.id === 'mock') {
      _showQaTestPanel();
    }

    console.log('[SG.PG] SG.CG methods patched to use Playgama Bridge');
  }

  // ── QA 테스트 패널 (mock 모드 전용, 내부 헬퍼) ──────────────────
  function _showQaTestPanel() {
    // 이미 패널이 있으면 중복 생성 방지
    if (document.getElementById('pg-qa-panel')) return;

    var panel = document.createElement('div');
    panel.id = 'pg-qa-panel';
    panel.style.cssText = [
      'position:fixed',
      'top:8px',
      'left:8px',
      'z-index:2147483647',
      'background:rgba(0,0,0,.88)',
      'color:#fff',
      'padding:10px 12px',
      'border-radius:8px',
      'font-size:12px',
      'font-family:monospace',
      'border:1px solid #ffe020',
      'pointer-events:auto',
    ].join(';');

    panel.innerHTML =
      '<div style="color:#ffe020;font-weight:bold;margin-bottom:8px">⚙ PLAYGAMA QA</div>'
      + '<button id="pg-qa-inter" style="display:block;width:100%;margin-bottom:5px;'
      +   'padding:5px 10px;background:#222;color:#fff;border:1px solid #555;'
      +   'border-radius:4px;cursor:pointer;font-size:12px">'
      +   '🎬 Test Interstitial</button>'
      + '<button id="pg-qa-reward" style="display:block;width:100%;'
      +   'padding:5px 10px;background:#222;color:#ffe020;border:1px solid #ffe020;'
      +   'border-radius:4px;cursor:pointer;font-size:12px">'
      +   '📺 Test Rewarded</button>';

    // DOM이 아직 없을 경우 DOMContentLoaded 이후 삽입
    function _attach() {
      if (document.body) {
        document.body.appendChild(panel);
        document.getElementById('pg-qa-inter').addEventListener('click', function () {
          console.log('[PG QA] Interstitial test triggered');
          SG.CG.requestMidgameAd();
        });
        document.getElementById('pg-qa-reward').addEventListener('click', function () {
          console.log('[PG QA] Rewarded test triggered');
          SG.CG.requestRewardedAd('score_double').then(function (r) {
            console.log('[PG QA] Rewarded result:', r);
          });
        });
      } else {
        document.addEventListener('DOMContentLoaded', _attach);
      }
    }
    _attach();
    console.log('[SG.PG] QA test panel attached (mock mode)');
  }

  // ── Bridge Storage 헬퍼 (선택 사용) ───────────────────────────
  // 기존 localStorage 대신 플랫폼 최적 저장소 사용.
  async function storageGet(keys) {
    if (!_ready || !_bridge) return {};
    try { return await _bridge.storage.get(keys); } catch (e) { return {}; }
  }

  async function storageSet(data) {
    if (!_ready || !_bridge) return false;
    try { await _bridge.storage.set(data); return true; } catch (e) { return false; }
  }

  // ── 플랫폼 정보 ────────────────────────────────────────────────
  function platformId() {
    return (_ready && _bridge) ? _bridge.platform.id : 'unknown';
  }

  function platformLanguage() {
    return (_ready && _bridge) ? (_bridge.platform.language || 'en') : 'en';
  }

  // ── SG.PG 즉시 노출 ────────────────────────────────────────────
  // _onAudioStateChanged(isEnabled: bool) :
  //   Bridge가 audioStateChanged 이벤트 발생 시 호출.
  //   isEnabled=false → 뮤트 / isEnabled=true → 음소거 해제.
  //   게임 코드(index.html, endless.html) 부팅 시 등록.
  SG.PG = {
    init,
    isAvailable,
    storageGet,
    storageSet,
    platformId,
    platformLanguage,
    _onAudioStateChanged: null,
  };

})(typeof window !== 'undefined' ? window : global);
