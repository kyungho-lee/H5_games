# 디자인 토큰 — H5 Puzzle Template

SameGame Grid Protocol과 동일한 톤앤매너를 유지하기 위한 CSS 변수 및 타이포그래피 레퍼런스.

---

## CSS 변수 (`:root`)

```css
:root {
  /* 배경/패널 */
  --bg:      #060810;   /* 최외곽 배경 (거의 검정) */
  --panel:   #0d0f18;   /* 카드/패널 배경 */
  --border:  #1e2235;   /* 테두리, 구분선 */

  /* 텍스트 */
  --text:    #e8eaf6;   /* 본문 텍스트 */
  --textdim: #6b7299;   /* 보조/비활성 텍스트 */
  --dim:     #3a3f5c;   /* 비활성 아이콘/장식 */

  /* 포인트 컬러 */
  --accent:  #00f5c8;   /* 시안 — 강조, CTA, 글로우 */
  --warn:    #ff4060;   /* 레드 — 경고, 게임오버, 에러 */
}
```

---

## 타일 색상 (게임별 조정 가능)

```css
:root {
  --c0: #ff4060;   /* 레드 */
  --c1: #00c8ff;   /* 시안 */
  --c2: #39d353;   /* 그린 */
  --c3: #ffaa00;   /* 오렌지 */
  --c4: #b06aff;   /* 퍼플 */
  --c5: #ffee44;   /* 옐로 */
}
```

타일 수가 다르면 사용하는 변수만 남기고 나머지 제거.

---

## 타이포그래피

| 용도 | 폰트 | 속성 |
|------|------|------|
| 제목, 점수, 큰 숫자 | `Rajdhani` | `font-weight: 700`, `letter-spacing: 2-3px` |
| 버튼, 본문, UI | `Share Tech Mono` | monospace, `letter-spacing: 1px` |

```html
<!-- Google Fonts 로드 -->
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Share Tech Mono&display=swap" rel="stylesheet">
```

---

## 배경 효과

### 격자 패턴

```css
body::before {
  content: '';
  position: fixed; inset: 0; z-index: 0;
  background-image:
    linear-gradient(rgba(0,245,200,.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,245,200,.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}
```

### 코너 글로우

```css
body::after {
  content: '';
  position: fixed; inset: 0; z-index: 0;
  background:
    radial-gradient(ellipse 50% 40% at 0% 0%,    rgba(0,245,200,.08) 0%, transparent 70%),
    radial-gradient(ellipse 50% 40% at 100% 100%, rgba(180,100,255,.08) 0%, transparent 70%);
  pointer-events: none;
}
```

---

## 컴포넌트 레시피

### 강조 버튼 (CTA)

```css
.btn-primary {
  padding: 12px;
  background: var(--accent); color: #060810;
  border: none; border-radius: 4px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.9rem; font-weight: 700;
  letter-spacing: 2px; text-transform: uppercase;
  cursor: pointer;
  transition: opacity .15s;
}
.btn-primary:hover  { opacity: .85; }
.btn-primary:active { opacity: .7;  }
```

### 보조 버튼

```css
.btn-secondary {
  padding: 10px;
  background: transparent; color: var(--textdim);
  border: 1px solid var(--border); border-radius: 4px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 0.8rem;
  letter-spacing: 1px; text-transform: uppercase;
  cursor: pointer;
  transition: border-color .15s, color .15s;
}
.btn-secondary:hover { border-color: var(--dim); color: var(--text); }
```

### 패널/카드

```css
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
}
```

### 점수 표시

```css
.score-display {
  font-family: 'Rajdhani', sans-serif;
  font-size: 3rem; font-weight: 700;
  color: var(--text);
  line-height: 1;
}
.score-label {
  font-size: 0.65rem; color: var(--textdim);
  letter-spacing: 2px; text-transform: uppercase;
}
```

### 섹션 타이틀

```css
.section-title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 1.6rem; font-weight: 700;
  color: var(--accent);
  letter-spacing: 3px; text-transform: uppercase;
}
```

---

## 캔버스 렌더링 색상 사용법

CSS 변수를 캔버스에서 읽으려면:

```javascript
const style = getComputedStyle(document.documentElement);
const colors = [
  style.getPropertyValue('--c0').trim(),
  style.getPropertyValue('--c1').trim(),
  style.getPropertyValue('--c2').trim(),
  style.getPropertyValue('--c3').trim(),
  style.getPropertyValue('--c4').trim(),
  style.getPropertyValue('--c5').trim(),
];
// colors[tileType] → ctx.fillStyle
```

또는 직접 배열로 관리 (성능):

```javascript
const TILE_COLORS = ['#ff4060','#00c8ff','#39d353','#ffaa00','#b06aff','#ffee44'];
```
