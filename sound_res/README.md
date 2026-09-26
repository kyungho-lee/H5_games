# sound_res/ — 소리 자원 원본 (퍼즐 공용)

> **여기가 원본 보관소다.** 게임에 실리는 사본은 각 게임의 `src/pack/assets/sfx/` 에 있고,
> 이 폴더는 **여러 퍼즐이 함께 쓰는 원본**을 둔다(감독 결정 2026-09-26 — *"사운드는 다른
> 퍼즐에서도 사용할 자원이니 올리는게 좋음"*).
>
> **아래 본문은 게임 쪽 문서(`src/pack/assets/sfx/README.md`)를 옮겨 온 것**이라 경로가
> 게임 기준으로 적혀 있다. 등록하는 방법은 그쪽이 맞고, **여기서는 파일을 놓기만 한다.**
>
> 지금 37개(`.wav` 23 · `.ogg` 9 · `.mp3` 4 · 이 문서) · 3.3MB.
> 같은 소리가 `.wav` 와 `.ogg` 로 둘 다 있는 것이 몇 개 있다 — **게임에 실을 때 한 벌만
> 고른다**(용량이 그대로 내려가므로). 어느 쪽을 쓰는지는 게임 쪽 `sound-triggers.js` 가 정한다.

---

# src/assets/sfx/

실제 SFX·BGM 에셋 파일을 놓는 자리. 2026-09-11에 실제 파일 13개가 들어왔고, 대부분
`src/sound-triggers.js`의 `REGISTRY`에 등록됐다(아래 표). **합성음 폴백은 없다** —
"비트음은 사용하지 않는다"는 방침에 따라, `file: null`인 이벤트는 그냥 조용하다.

## 구조 — 엔진과 트리거가 분리돼 있다

- `src/sound.js` — 재생 엔진(`SG.SoundEngine`). 게임을 전혀 모른다 — 그냥 파일 경로를
  한 번(`playOnce`) 또는 루프(`startLoop`/`stopLoop`)로 재생할 뿐이다.
- `src/sound-triggers.js` — 이 게임의 이벤트 → 파일 매핑(`SG.SOUND_EVENTS`)과 트리거
  API(`SG.SoundTriggers.play(key)`/`.stop(key)`). **파일을 등록하려면 이 파일만 고치면
  된다** — `sound.js`도, 게임의 다른 호출부도 안 건드린다.

## 파일을 추가하려면

1. `.mp3`(우선 권장) 또는 다른 브라우저 재생 가능 포맷을 이 폴더에 놓는다. 파일명 자유.
2. `src/sound-triggers.js`의 `REGISTRY`에서 해당 이벤트의 `file: null`을
   `file: 'assets/sfx/파일명.mp3'`로 바꾼다. `pour`처럼 여러 변형을 무작위로 재생하고
   싶으면 배열로: `file: ['assets/sfx/pour1.mp3', 'assets/sfx/pour2.mp3', ...]`
   (`type: 'loop'`인 항목은 배열 불가 — 루프는 고를 대상이 없다, 파일 하나만).
3. 그게 전부다 — `SG.SoundTriggers.play('pour')`처럼 부르는 다른 코드는 손댈 필요 없다.

## 지금 등록된 이벤트 (src/sound-triggers.js의 REGISTRY 참고)

| 이벤트 | 타입 | 트리거 시점 | 파일 | 확인 상태 |
|---|---|---|---|---|
| `select` | once | 소스 튜브 탭 선택 | `sfx_pick_.ogg` | 사용자 확인 |
| `error` | once | 무효한 탭(재선택 해제 / 못 붓는 타겟) | `sfx_error.ogg` | 사용자 확인 |
| `pour` | once(4종 무작위) | 붓기 한 번(탭 확정 → 실제로 흐르기 시작까지 합쳐서 하나) | `sfx_pour0~3.ogg` | 사용자 확인 |
| `tubeClear` | once | 튜브 하나가 단색으로 다 참(`celebrate()` 트리거) | `sfx_complete.wav` | 사용자 확인 |
| `clear` | once | 보드 전체 클리어(레벨 완료) | `sfx_clearLevel.ogg` | 사용자 확인 |
| `reward` | once | 클리어 리워드 팝업에서 보상을 받는 순간(fx.js의 `reward-shine`과 같은 시점) | `sfx_get_gold.wav` | 사용자 확인 |
| `reveal` | once | 히든(가려진) 색상 공개 — `applyPour()`의 `revealed` | `sfx_curten_remove.wav` | 사용자 확인 |
| `deadlock` | once | 더 이상 둘 수 있는 수가 없음(게임 실패) | `sfx_deadlock.ogg` | 사용자 확인 |
| `musicMain` | loop | 타이틀 화면 BGM | `bgame_bgm_make.ogg` | 사용자 확인(BGM 하나뿐이라 musicGame과 공유) |
| `musicGame` | loop | 인게임 BGM | `bgame_bgm_make.ogg` | 위와 동일 |

`sfx_level_button.wav`(레벨 선택 화면 버튼음으로 보임 — 지금 REGISTRY 10개 어디에도 안
맞는다, 그 화면을 만들 때 새 이벤트로 추가)와 `sfx_broke_ice.wav`(deadlock 확정 전 임시로
썼던 파일, 지금은 미사용)는 아직 미배정이다.

`once`는 매번 새로 재생(겹쳐 울려도 서로 안 끊는다). `loop`는 `play()`를 여러 번 불러도
이미 돌고 있으면 그대로 두고(멱등), `stop()`을 불러야 멈춘다 — 화면을 떠날 때
`SG.SoundTriggers.stop('musicGame')`을 꼭 불러야 다음 화면에서도 계속 도는 걸 막는다.

레퍼런스(Liquid Sort, toytheater.com)가 실제로 쓰는 SFX·BGM 이벤트·파일명 목록과 청음용
원본 위치는 `docs/rnd/REFERENCE-ASSETS.md` §3 — 그 파일들 자체는 저작권상 가져오지
않는다. "비슷한 느낌"을 찾을 때 귀로 듣는 기준으로만 참고한다.

## 파일이 없을 때 무슨 일이 일어나나

`file: null`인 이벤트는 `play()`를 불러도 완전히 조용하다(엔진까지 안 내려간다). 실제
경로를 채웠는데 그 경로에 파일이 없으면 브라우저 콘솔에 리소스 로드 실패가 찍히지만
JS 예외로 게임이 멎지는 않는다(`SoundEngine`이 `play()`의 거부를 삼킨다). 파일을 넣은
뒤엔 실제로 브라우저에서 눌러서 소리가 나는지 확인한다(`tools/fluid-render-demo.html`의
"사운드" 섹션 미리듣기 버튼) — 콘솔에 로드 실패가 없는지도 같이 본다.
