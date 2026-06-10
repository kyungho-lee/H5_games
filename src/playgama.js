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

      // SDK 내장 인터스티셜 최소 간격 설정
      // mock(QA): 0초 — 레벨마다 반복 호출 시 SDK가 무음 차단하지 않도록
      // 실서버:   60초 — 광고 과다 노출 방지
      var _interDelay = (_bridge.platform.id === 'mock') ? 0 : 60;
      try { _bridge.advertisement.setMinimumDelayBetweenInterstitial(_interDelay); } catch (e) {}

      // ── 플랫폼 이벤트 — 오디오 / 일시정지 상태 ────────────────────
      // 인터스티셜·리워드 광고, 브라우저 탭 전환, 시스템 일시정지 등
      // 모든 케이스를 단일 핸들러로 처리합니다. (docs 권장 방식)
      // 게임 코드(index.html, endless.html)가 _onAudioStateChanged 를 등록하면
      // Bridge가 isEnabled 값을 전달합니다: true = 소리 ON / false = 뮤트.
      try {
        _bridge.platform.on('audioStateChanged', function (isEnabled) {
          if (typeof SG.PG._onAudioStateChanged === 'function') {
            SG.PG._onAudioStateChanged(isEnabled);
          }
        });
      } catch (e) {}

      // pauseStateChanged: 광고·탭전환·시스템 일시정지 시 게임 pause/resume
      // isEnabled=false → pause / isEnabled=true → resume
      try {
        _bridge.platform.on('pauseStateChanged', function (isPaused) {
          if (typeof SG.PG._onPauseStateChanged === 'function') {
            SG.PG._onPauseStateChanged(isPaused);
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
      console.log('[PG.inter] called — ready:', _ready, '| bridge:', !!_bridge,
                  '| isInterstitialSupported:', _bridge && _bridge.advertisement.isInterstitialSupported,
                  '| platform:', _bridge && _bridge.platform.id);
      if (!_ready || !_bridge) return;
      // isInterstitialSupported: mock 모드에서 false일 수 있으므로 mock은 체크 건너뜀
      // (QA 검증기가 showInterstitial() 호출을 intercept하려면 반드시 호출되어야 함)
      var isMock = _bridge.platform.id === 'mock';
      if (!isMock && !_bridge.advertisement.isInterstitialSupported) {
        console.warn('[PG.inter] isInterstitialSupported = false → skipped');
        return;
      }

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
          console.log('[PG.inter] state:', state);
          if (state === 'closed') {
            try { _bridge.advertisement.off(evInter, onState); } catch (e) {}
            finish();
          }
          // mock 모드: failed 후 리스너 재등록 — QA의 closed 주입 확실히 수신
          // 실서버: failed 즉시 종료
          if (state === 'failed') {
            if (isMock) {
              try { _bridge.advertisement.off(evInter, onState); } catch (e) {}
              try { _bridge.advertisement.on(evInter, onState);  } catch (e) {}
            } else {
              try { _bridge.advertisement.off(evInter, onState); } catch (e) {}
              finish();
            }
          }
        }

        // SDK 상수 우선, 없으면 문자열 폴백
        var evInter = (_bridge.EVENT_NAME && _bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED)
                      || 'interstitialStateChanged';
        _bridge.advertisement.on(evInter, onState);

        // mock 모드: 3초 (인터스티셜은 빠르게 통과, QA 타이밍 블록 방지) / 실서버: 15초
        var _interTimeout = isMock ? 3000 : 15000;
        timeout = setTimeout(function () {
          try { _bridge.advertisement.off(evInter, onState); } catch (e) {}
          finish();
        }, _interTimeout);

        // Promise.resolve() 래핑: mock 플랫폼에서 undefined 반환 시에도 안전
        Promise.resolve(_bridge.advertisement.showInterstitial('level_complete'))
          .catch(function () {
            try { _bridge.advertisement.off(evInter, onState); } catch (e) {}
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
      // isRewardedSupported: mock 모드에서 false일 수 있으므로 mock은 체크 건너뜀
      // (QA 검증기가 showRewarded() 호출을 intercept하려면 반드시 호출되어야 함)
      var isMockR = _bridge.platform.id === 'mock';
      if (!isMockR && !_bridge.advertisement.isRewardedSupported) {
        console.warn('[PG.rewarded] isRewardedSupported = false → skipped');
        return { granted: false };
      }

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
          console.log('[PG.rewarded] state:', state);
          if (state === 'rewarded') {
            // docs: rewarded 상태에서 rewardedPlacement 를 읽어 보상 종류 확인
            var placement = '';
            try { placement = _bridge.advertisement.rewardedPlacement || pid; } catch (e) { placement = pid; }
            console.log('[PG.rewarded] placement:', placement);
            granted = true;  // 시청 완료 → 보상 지급
          }
          if (state === 'closed') {
            try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
            finish();
          }
          // mock 모드: Bridge가 failed 후 리스너를 내부 제거할 수 있음.
          // off→on 으로 재등록해서 QA의 rewarded→closed 주입을 확실히 수신.
          // 실서버: failed 즉시 종료.
          if (state === 'failed') {
            if (isMockR) {
              try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
              try { _bridge.advertisement.on(evRew, onState);  } catch (e) {}
              // finish() 호출 안 함 — 30s 타임아웃 또는 QA 주입 대기
            } else {
              try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
              finish();
            }
          }
        }

        // SDK 상수 우선, 없으면 문자열 폴백
        var evRew = (_bridge.EVENT_NAME && _bridge.EVENT_NAME.REWARDED_STATE_CHANGED)
                    || 'rewardedStateChanged';
        _bridge.advertisement.on(evRew, onState);

        // mock 모드: 30초 (QA 검증기 상호작용 대기) / 실서버: 15초
        var _rewardTimeout = isMockR ? 30000 : 15000;
        timeout = setTimeout(function () {
          try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
          finish();
        }, _rewardTimeout);

        // Promise.resolve() 래핑: mock 플랫폼에서 undefined 반환 시에도 안전
        Promise.resolve(_bridge.advertisement.showRewarded(pid))
          .catch(function () {
            try { _bridge.advertisement.off(evRew, onState); } catch (e) {}
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

    console.log('[SG.PG] SG.CG methods patched to use Playgama Bridge');
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
    _onAudioStateChanged:  null,  // 게임 코드에서 등록: isEnabled=false → 뮤트
    _onPauseStateChanged:  null,  // 게임 코드에서 등록: isPaused=true → 일시정지
  };

})(typeof window !== 'undefined' ? window : global);
