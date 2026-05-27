# T15 + T16 — Color palette + "О скрипте" info modal

## Контекст
Файл `/home/admin/Projects/yt-metabot/yt-metabot.user.js` (v230303, ~107KB) — рабочий MetaBot с AI classification (T7), channel tracking (T12), pattern analysis + clustering (T13), modern UI (T14).

Уже есть:
- `applyBadge(jNode, channel)` — текущая базовая раскраска (vinyl-T7)
- `mbdb.getChannel(channelId)` возвращает {label, confidence, reasoning, joinDate, themes, targets, network_signals, network_cluster_id, analysisSummary}
- `mbdb.getNetworks()` возвращает networks с {clusterId, name, members}
- normalizeChannelId(href) для @handle resolution
- Settings panel `#config` с секциями + кнопками 🤖🔍🕸
- arrayERKY — глобальный список ID известных ботов из ЕРКЮ-базы

═══════════════════════════════════════════════════
## T15 — Color palette + freshly-registered detection
═══════════════════════════════════════════════════

### Цветовая палитра (приоритетная иерархия для border-left)

| # | State | Color | Badge | Условие |
|---|-------|-------|-------|---------|
| 1 | BOT | `#e53935` | `🤖 БОТ` | `label === 'BOT'` (AI conf ≥ 0.7) ИЛИ в `arrayERKY` |
| 2 | NETWORK | `#8e24aa` | `🕸 СЕТЬ` | `network_cluster_id` !== null |
| 3 | NEW_REG | `#fb8c00` | `🆕 НОВОРЕГ` | (videoPublishDate − joinDate) < 7 days |
| 4 | SUSPECT | `#fbc02d` | `⚠️ ПОДОЗР` | `label === 'SUSPECT'` |
| 5 | HUMAN | `#43a047` | `✓ ЧЕЛОВЕК` | `label === 'HUMAN'` AND нет выше |
| 6 | UNKNOWN | `#757575` | `? UNK` | классификации нет |

### Multi-badge logic
Если канал имеет НЕСКОЛЬКО состояний — показываем ВСЕ badges, между ними тонкий разделитель ` · `. Например для BOT в сети + новорег: `🤖 БОТ · 🕸 СЕТЬ · 🆕 НОВОРЕГ`. Primary color (border-left) — первое в иерархии состояние.

### getVideoPublishDate() helper
```js
function getVideoPublishDate() {
  if (window._mbCurrentVideoPublishDate) return window._mbCurrentVideoPublishDate;
  // Try multiple sources
  var src = null;
  var meta = document.querySelector('meta[itemprop="datePublished"]');
  if (meta && meta.content) src = meta.content;
  if (!src) {
    var info = document.querySelector('#info-strings yt-formatted-string, ytd-video-primary-info-renderer #date yt-formatted-string');
    if (info && info.textContent) src = info.textContent;
  }
  if (!src) {
    try {
      var m = document.documentElement.innerHTML.match(/"publishDate":\{"simpleText":"([^"]+)"/);
      if (m) src = m[1];
    } catch (e) {}
  }
  if (!src) return null;
  var d = new Date(src);
  if (isNaN(d)) return null;
  window._mbCurrentVideoPublishDate = d;
  return d;
}
// Reset on SPA navigation
document.addEventListener('yt-navigate-finish', function() {
  window._mbCurrentVideoPublishDate = null;
});

function isNewReg(joinDate, videoPublishDate) {
  if (!joinDate || !videoPublishDate) return false;
  var join = new Date(joinDate);
  var pub = new Date(videoPublishDate);
  if (isNaN(join) || isNaN(pub)) return false;
  var diffDays = (pub.getTime() - join.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= -1 && diffDays < 7;  // tolerate ±1 day clock skew
}
```

### Replace applyBadge

Найди существующую `applyBadge(jNode, channel)` функцию (она есть, добавлена в T7+) и **замени её целиком** на:

```js
var MB_COLORS = { BOT:'#e53935', NETWORK:'#8e24aa', NEW_REG:'#fb8c00', SUSPECT:'#fbc02d', HUMAN:'#43a047', UNKNOWN:'#757575' };
var MB_BADGES = { BOT:'🤖 БОТ', NETWORK:'🕸 СЕТЬ', NEW_REG:'🆕 НОВОРЕГ', SUSPECT:'⚠️ ПОДОЗР', HUMAN:'✓ ЧЕЛОВЕК', UNKNOWN:'? UNK' };

function applyBadge(jNode, channel) {
  try {
    var root = jNode instanceof Element ? jNode : (jNode[0] || jNode);
    if (!root || !root.querySelector) return;
    var author = root.querySelector('#author-text');
    if (!author) return;
    // Remove previous badge if any (re-renders)
    var oldBadge = author.parentNode.querySelector('.mb-ai-badge');
    if (oldBadge) oldBadge.remove();
    var thread = root.closest ? root.closest('ytd-comment-thread-renderer') : null;
    // Compute states
    var states = [];
    var inErky = (typeof arrayERKY !== 'undefined' && arrayERKY.indexOf(channel.channelId) >= 0);
    if (channel.label === 'BOT' || inErky) states.push('BOT');
    if (channel.network_cluster_id) states.push('NETWORK');
    if (isNewReg(channel.joinDate, getVideoPublishDate())) states.push('NEW_REG');
    if (channel.label === 'SUSPECT' && states.indexOf('SUSPECT') < 0) states.push('SUSPECT');
    if (channel.label === 'HUMAN' && states.length === 0) states.push('HUMAN');
    if (states.length === 0) states.push('UNKNOWN');
    var primary = states[0];
    // Build container
    var container = document.createElement('span');
    container.className = 'mb-ai-badge';
    container.style.cssText = 'margin-left:8px;font-size:11px;font-weight:600;cursor:help;display:inline-flex;gap:4px;align-items:center;flex-wrap:wrap';
    states.forEach(function(state, i) {
      if (i > 0) {
        var sep = document.createElement('span');
        sep.textContent = '·';
        sep.style.cssText = 'color:#666;margin:0 2px';
        container.appendChild(sep);
      }
      var pill = document.createElement('span');
      pill.style.cssText = 'background:' + MB_COLORS[state] + '22;color:' + MB_COLORS[state] + ';padding:2px 6px;border-radius:10px;border:1px solid ' + MB_COLORS[state] + '55';
      pill.textContent = MB_BADGES[state];
      container.appendChild(pill);
    });
    // Tooltip
    var lines = [];
    lines.push(primary + (channel.confidence ? ' · ' + Math.round(channel.confidence*100) + '%' : ''));
    if (channel.analysisSummary) lines.push(channel.analysisSummary);
    else if (channel.reasoning) lines.push(channel.reasoning);
    if (channel.joinDate) {
      var pub = getVideoPublishDate();
      var ageLine = 'Зарегистрирован: ' + channel.joinDate;
      if (pub) {
        var diff = Math.floor((new Date(pub).getTime() - new Date(channel.joinDate).getTime()) / 86400000);
        if (diff >= 0 && diff < 365) ageLine += ' (' + diff + ' дн. до видео)';
      }
      lines.push(ageLine);
    }
    if (channel.network_cluster_id) {
      lines.push('🕸 Кластер: ' + channel.network_cluster_id);
    }
    if (channel.targets) {
      var tops = Object.entries(channel.targets).map(function(kv){
        var k = kv[0], v = kv[1] || {};
        var score = (v.pro || 0) - (v.anti || 0);
        return { k: k, score: score };
      }).sort(function(a,b){ return Math.abs(b.score) - Math.abs(a.score); }).slice(0,3);
      if (tops.length) lines.push('Цели: ' + tops.map(function(t){ return t.k + (t.score>0?' +':' ') + t.score; }).join(' · '));
    }
    container.title = lines.join('\n');
    author.parentNode.insertBefore(container, author.nextSibling);
    // Border-left on whole thread
    if (thread) {
      thread.style.borderLeft = '3px solid ' + MB_COLORS[primary];
      thread.style.paddingLeft = '8px';
    }
  } catch (e) { console.warn('[MetaBot] applyBadge failed:', e.message); }
}
```

### Re-apply badge для всех видимых комментариев канала после re-classify

После `mbdb.applyClassification(...)` и `mbdb.applyPatterns(...)` вызвать helper:

```js
async function refreshBadgesForChannel(channelId) {
  try {
    var channel = await mbdb.getChannel(channelId);
    if (!channel) return;
    // Walk through all rendered comment threads
    var authors = document.querySelectorAll('#author-text');
    for (var i = 0; i < authors.length; i++) {
      var href = authors[i].href || '';
      if (!href) continue;
      var nid = await normalizeChannelId(href);
      if (nid === channelId) {
        var view = authors[i].closest('ytd-comment-view-model, ytd-comment-renderer, ytd-comment-thread-renderer');
        if (view) applyBadge(view, channel);
      }
    }
  } catch (e) { console.warn('[MetaBot] refreshBadges failed:', e.message); }
}
```

В обработчиках classifyBatch и analyzePatternsBatch — после каждой записанной классификации/паттернов вызвать `refreshBadgesForChannel(c.channelId)`.

В `clusterNetworks` — после записи всех members кластера: `for (var mid of members) refreshBadgesForChannel(mid);`

### Применение бейджа в collector (real-time)

В parseitemNew после `var channel = await mbdb.getChannel(userID); if (channel) applyBadge(jNode, channel);` — это уже должно быть. Если нет — добавь.

Также для новорегов БЕЗ classification: даже если канал не классифицирован, проверить isNewReg по joinDate. Это значит при первом /about scrape когда узнали joinDate — сразу applyBadge с UNKNOWN+NEW_REG.

═══════════════════════════════════════════════════
## T16 — "О скрипте" info modal
═══════════════════════════════════════════════════

### Кнопка в Settings footer

В блоке footer settings panel (где сейчас `<a id="urlgithub">GitHub</a>` + `<span id="resetbtn">Сброс</span>`) добавь между GitHub и Сброс новую кнопку:

```html
<span id="mbAboutBtn" style="cursor:pointer;color:#6af;margin:0 12px">ℹ️ О скрипте</span>
```

### Click handler — открывает overlay

Добавь в обработчиках открытия settings (там где `$(jNode).find('button#mbClassifyBtn').on('click', ...)` block) ещё один handler:

```js
$(jNode).find('#mbAboutBtn').on('click', function() {
  var overlay = document.createElement('div');
  overlay.id = 'mbAboutOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;font:13px/1.6 ui-sans-serif,system-ui,sans-serif;color:#ddd';
  overlay.innerHTML =
    '<div style="background:#0e0e0e;border:1px solid #2a2a2a;border-radius:8px;padding:24px;max-width:680px;max-height:80vh;overflow-y:auto;position:relative">' +
    '<span style="position:absolute;top:8px;right:14px;cursor:pointer;font-size:20px;color:#888" id="mbAboutClose">×</span>' +
    '<h2 style="margin:0 0 12px;font-size:18px;color:#fff">MetaBot · AI Bot Detection</h2>' +
    '<p style="color:#aaa;margin:0 0 16px">Userscript для YouTube — детектирует ботов, новорегов, координированные сети в комментариях.</p>' +
    '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">🎯 Что делает</h3>' +
    '<ul style="margin:0;padding-left:20px;color:#ccc">' +
      '<li><b style="color:#fb8c00">🆕 Новореги</b> — каналы, зарегистрированные менее 7 дней до публикации видео</li>' +
      '<li><b style="color:#e53935">🤖 Боты</b> — AI-классификация поведения (DeepSeek V4) + база ЕРКЮ</li>' +
      '<li><b style="color:#8e24aa">🕸 Ботосетки</b> — кластеризация каналов по поведенческим паттернам</li>' +
      '<li><b style="color:#fbc02d">⚠️ Подозрительные</b> — низкая уверенность бот-сигналов</li>' +
      '<li><b style="color:#43a047">✓ Люди</b> — органичная активность</li>' +
    '</ul>' +
    '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">🔬 Методы</h3>' +
    '<ul style="margin:0;padding-left:20px;color:#ccc">' +
      '<li>Сбор комментариев + метаданных каналов локально в IndexedDB</li>' +
      '<li>AI классификация через <b>DeepSeek V4</b> (label + confidence + reasoning)</li>' +
      '<li>Анализ паттернов: themes, targets (Putin/Navalny/Kac/...), network_signals (pro-kremlin, anti-opposition, whataboutism, ...)</li>' +
      '<li>Кластеризация ботосеток: Euclidean distance + union-find по signals</li>' +
      '<li>Кросс-канальное отслеживание: что комментирует на нескольких каналах</li>' +
    '</ul>' +
    '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">🛠 Инструменты</h3>' +
    '<ul style="margin:0;padding-left:20px;color:#ccc">' +
      '<li><b>DeepSeek API</b> — LLM-классификация (~$3/мес при 30K каналов)</li>' +
      '<li><b>IndexedDB</b> — локальная база каналов / комментариев / сетей</li>' +
      '<li><b>Tampermonkey/Violentmonkey</b> — runtime userscript</li>' +
      '<li><b>YouTube DOM scraping</b> — joinDate, subs, videoCount из /about</li>' +
      '<li><b>Return YouTube Dislike API</b> — счётчик дислайков</li>' +
    '</ul>' +
    '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">📚 Базы и источники</h3>' +
    '<ul style="margin:0;padding-left:20px;color:#ccc">' +
      '<li><a href="https://botnadzor.org" target="_blank" style="color:#6af">Ботнадзор</a> — RU база ботов VK (6.1M комментариев, GitHub: <a href="https://github.com/botnadzor/extension" target="_blank" style="color:#6af">extension</a>)</li>' +
      '<li><a href="https://euvsdisinfo.eu" target="_blank" style="color:#6af">EUvsDisinfo</a> — EU EEAS публичная база дезинфо-нарративов</li>' +
      '<li><a href="https://factcheck.by/eng/news/youtube_botnet_march2025/" target="_blank" style="color:#6af">Factcheck.BY</a> — мониторинг YouTube-ботов RU/BY</li>' +
      '<li><a href="https://dfrlab.org/2025/02/24/russia-pravda-network-expands-worldwide/" target="_blank" style="color:#6af">DFRLab</a> — Pravda Network (~190 сайтов), Operation Overload</li>' +
      '<li><a href="https://novayagazeta.eu/articles/2025/12/25/o-chem-sporili-boty" target="_blank" style="color:#6af">НГ Европа</a> — расследования по ботам 2024-2025</li>' +
      '<li><a href="https://github.com/asrdri/yt-metabot-user-js" target="_blank" style="color:#6af">ЕРКЮ (FeignedAccomplice/YOUTUBOTS)</a> — оригинальная база, заброшена с 2021 (~5949 IDs)</li>' +
    '</ul>' +
    '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:16px 0 6px">📄 Академические работы</h3>' +
    '<ul style="margin:0;padding-left:20px;color:#ccc;font-size:12px">' +
      '<li><a href="https://arxiv.org/pdf/2005.06558" target="_blank" style="color:#6af">Beskow & Carley 2020</a> — Russian trolls (MH17)</li>' +
      '<li><a href="https://arxiv.org/pdf/2311.05791" target="_blank" style="color:#6af">Shajari 2023</a> — YouTube commenter mob detection (Graph2Vec)</li>' +
      '<li><a href="https://arxiv.org/pdf/2410.22716" target="_blank" style="color:#6af">Cinelli WWW\'25</a> — Cross-Platform CIB</li>' +
    '</ul>' +
    '<div style="margin-top:18px;padding-top:12px;border-top:1px solid #2a2a2a;color:#666;font-size:11px">' +
      'Версия: v' + GM_info.script.version + ' · Форк MetaBot для YouTube (asrdri/yt-metabot-user-js)' +
    '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  var closeIt = function() { overlay.remove(); };
  overlay.querySelector('#mbAboutClose').onclick = closeIt;
  overlay.onclick = function(e) { if (e.target === overlay) closeIt(); };
});
```

═══════════════════════════════════════════════════
## Общие требования

1. **@version: 230400**
2. **Backup**: `cp yt-metabot.user.js yt-metabot.user.js.bak-t15-t16-pre`
3. **node --check** PASS
4. НЕ ломать существующее (T1-T14)
5. НЕ переобъявлять переменные (eslint no-redeclare)

## Acceptance criteria

1. После reload: hover-card на любом комментарии показывает badges с цветными пилюлями (BOT/NETWORK/NEW_REG/SUSPECT/HUMAN/UNKNOWN)
2. Border-left комментария окрашен primary color
3. Tooltip badge содержит: label, confidence, reasoning, joinDate (+ дни до видео), targets top-3, cluster name
4. Новореги (joinDate < 7 дней до publishDate) подсвечены оранжевым 🆕 даже без AI-классификации
5. После `🤖 Классифицировать` → badges обновляются без F5 (refreshBadgesForChannel)
6. В Settings footer — кнопка "ℹ️ О скрипте" открывает overlay с описанием задач/методов/инструментов/баз
7. node --check PASS

## Отчёт
- @version
- Размер файла до/после
- node --check pass/fail
- Список изменённых функций
- Acceptance criteria checked
