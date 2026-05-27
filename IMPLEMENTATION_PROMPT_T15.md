# T15 — Color palette + Freshly-registered detection

## Контекст

Файл: `/home/admin/Projects/yt-metabot/yt-metabot.user.js` (после T12+T13+T14, v230300+).

Уже работает: classification (BOT/SUSPECT/HUMAN/UNKNOWN), network clustering, joinDate для каналов.

## Задача T15 — продуманная цветовая палитра

### Палитра (приоритетная иерархия)

| # | Состояние | Цвет (hex) | Badge | Условие |
|---|-----------|------------|-------|---------|
| 1 | **BOT** | 🔴 `#e53935` | `[🤖 BOT]` | label === 'BOT' (AI confidence ≥ 0.7) ИЛИ в ERKY-базе |
| 2 | **NETWORK** | 🟣 `#8e24aa` | `[🕸 СЕТЬ]` | network_cluster_id !== null |
| 3 | **NEW_REG** | 🟠 `#fb8c00` | `[🆕 НОВОРЕГ]` | (videoPublishDate - joinDate) < 7 дней |
| 4 | **SUSPECT** | 🟡 `#fbc02d` | `[⚠️ SUSPECT]` | label === 'SUSPECT' (AI confidence < 0.7 для BOT, либо явный SUSPECT label) |
| 5 | **HUMAN** | 🟢 `#43a047` | `[✓ HUMAN]` | label === 'HUMAN' (confidence ≥ 0.7) |
| 6 | **UNKNOWN** | ⚫ `#757575` | `[? UNKNOWN]` | классификации нет |

### Multi-badge logic

Если канал имеет НЕСКОЛЬКО состояний — показывать **все применимые badges**, рядом, через тонкий разделитель ` · `.

**Приоритет ОСНОВНОГО цвета** для border-left комментария (когда CSS underline):
1. BOT (если в ERKY или AI-classified) — даже если в сетке/новорег, главный сигнал = бот
2. NETWORK (если cluster_id есть и не BOT)
3. NEW_REG (если новорег и не выше)
4. SUSPECT
5. HUMAN
6. UNKNOWN

Но **badges показываем все** в любом случае:
- `[🤖 BOT] [🕸 СЕТЬ] [🆕 НОВОРЕГ]` — самый красноречивый случай
- `[🆕 НОВОРЕГ] [⚠️ SUSPECT]` — подозрительный новорег
- `[✓ HUMAN] [🆕 НОВОРЕГ]` — новый человек (необычно но возможно)

### Извлечение `videoPublishDate`

При обработке текущего видео:
```js
function getVideoPublishDate() {
  // Try meta tag
  const meta = document.querySelector('meta[itemprop="datePublished"]');
  if (meta?.content) return new Date(meta.content);
  // Try ytd-watch-info-text
  const dateText = document.querySelector('#info-strings yt-formatted-string, ytd-video-primary-info-renderer #date yt-formatted-string')?.textContent;
  if (dateText) return new Date(dateText);
  // Fallback: parse from initial ytInitialData
  try {
    const html = document.documentElement.innerHTML;
    const m = html.match(/"publishDate":\{"simpleText":"([^"]+)"/);
    if (m) return new Date(m[1]);
  } catch (e) {}
  return null;
}
```

Кешировать в `window._mbCurrentVideoPublishDate` на каждой странице, сбрасывать в `yt-navigate-finish`.

### `isNewReg(joinDate)` функция

```js
function isNewReg(joinDate, videoPublishDate) {
  if (!joinDate || !videoPublishDate) return false;
  const join = new Date(joinDate);
  const pub = new Date(videoPublishDate);
  if (isNaN(join) || isNaN(pub)) return false;
  // joinDate < 7 days before video publish
  const diffDays = (pub - join) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays < 7;
}
```

### Обновлённая `applyBadge(jNode, channel)`

```js
const COLORS = {
  BOT:     '#e53935',
  NETWORK: '#8e24aa',
  NEW_REG: '#fb8c00',
  SUSPECT: '#fbc02d',
  HUMAN:   '#43a047',
  UNKNOWN: '#757575'
};

const ICONS = {
  BOT: '🤖', NETWORK: '🕸', NEW_REG: '🆕', SUSPECT: '⚠️', HUMAN: '✓', UNKNOWN: '?'
};

function applyBadge(jNode, channel) {
  const author = jNode.querySelector('#author-text');
  if (!author) return;
  // Remove old badge container if exists
  author.querySelectorAll('.mb-ai-badge').forEach(e => e.remove());

  const states = [];
  // Check states in priority order
  const isErky = window.arrayERKY && arrayERKY.indexOf(channel.channelId) >= 0;
  if (channel.label === 'BOT' || isErky) states.push('BOT');
  if (channel.network_cluster_id) states.push('NETWORK');
  if (isNewReg(channel.joinDate, window._mbCurrentVideoPublishDate)) states.push('NEW_REG');
  if (channel.label === 'SUSPECT') states.push('SUSPECT');
  if (channel.label === 'HUMAN' && states.length === 0) states.push('HUMAN');
  if (states.length === 0) states.push('UNKNOWN');

  // Primary color (highest priority)
  const primaryState = states[0];
  const primaryColor = COLORS[primaryState];

  // Render multi-badge container
  const container = document.createElement('span');
  container.className = 'mb-ai-badge';
  container.style.cssText = 'margin-left:6px;font-size:11px;font-weight:600;cursor:help;display:inline-flex;gap:2px;';
  states.forEach((state, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.textContent = ' · ';
      sep.style.color = '#666';
      container.appendChild(sep);
    }
    const badge = document.createElement('span');
    badge.style.color = COLORS[state];
    badge.textContent = ICONS[state];
    container.appendChild(badge);
  });

  // Build tooltip
  const tooltip = [
    `${primaryState}: ${Math.round((channel.confidence||0)*100)}%`,
    channel.reasoning,
    channel.analysisSummary,
    channel.network_cluster_id ? `🕸 Сетка: ${channel.network_cluster_id}` : '',
    isNewReg(channel.joinDate, window._mbCurrentVideoPublishDate)
      ? `🆕 Зарегистрирован ${channel.joinDate}, видео опубликовано ${new Date(window._mbCurrentVideoPublishDate).toISOString().slice(0,10)}`
      : (channel.joinDate ? `📅 Зарегистрирован ${channel.joinDate}` : '')
  ].filter(Boolean).join('\n');
  container.title = tooltip;
  author.appendChild(container);

  // Border-left на комментарии
  const thread = jNode.closest('ytd-comment-thread-renderer') || jNode;
  thread.style.borderLeft = `3px solid ${primaryColor}`;
  thread.style.paddingLeft = '8px';
}
```

### Поддержка `channelId` в `channel` object

Сейчас channel object из `mbdb.getChannel(id)` уже содержит channelId (keyPath). Если нет — добавить.

### Применение при collector hook

В collector в parseitemNew:
```js
const channel = await mbdb.getChannel(userID);
if (channel) {
  // Apply badge regardless of classification — NEW_REG can fire without classification
  applyBadge(jNode, channel);
} else {
  // Even no channel record yet — try to derive from current data
  // Check if joinDate available somehow (from procdateNew result)
  // For now: skip, badge will appear next time after first /about scrape
}
```

### Обновлённые states при reclassify

Когда `mbdb.applyClassification` или `mbdb.applyPatterns` пишет в IDB — пройтись по DOM на текущей странице и обновить badges (вызвать applyBadge для всех ytd-comment-view-model с этим channelId):

```js
async function refreshBadgesForChannel(channelId) {
  const channel = await mbdb.getChannel(channelId);
  if (!channel) return;
  // Find all comment renderers for this channel
  const authors = document.querySelectorAll('#author-text');
  for (const a of authors) {
    const href = a.href || '';
    const normalized = await normalizeChannelId(href);
    if (normalized === channelId) {
      const view = a.closest('ytd-comment-view-model, ytd-comment-renderer');
      if (view) applyBadge(view, channel);
    }
  }
}
```

Вызывать `refreshBadgesForChannel(channelId)` после applyClassification и applyPatterns.

## Acceptance criteria

1. На свежесозданном видео с ботами: кометаторы с joinDate < 7 дней до publishDate видео получают `[🆕 НОВОРЕГ]` оранжевый badge
2. AI-классифицированные боты — `[🤖 BOT]` красный
3. Если канал в network_cluster_id и одновременно бот — показывает `[🤖 BOT] · [🕸 СЕТЬ]`
4. Если новорег и подозрительный одновременно — `[🆕 НОВОРЕГ] · [⚠️ SUSPECT]`
5. Border-left комментария окрашен в цвет PRIMARY состояния
6. Hover на badge — tooltip с полной информацией (label, confidence, reasoning, summary, дата регистрации vs видео)
7. После Classify Now — badges обновляются автоматически (refreshBadgesForChannel)

## Версионирование
- @version: 230400
- Backup: `cp yt-metabot.user.js yt-metabot.user.js.bak-t15-pre`
- node --check PASS

## Отчёт
- Список изменённых функций (applyBadge replacement + новые helpers)
- @version
- Новые color constants
- Acceptance criteria pass/fail
