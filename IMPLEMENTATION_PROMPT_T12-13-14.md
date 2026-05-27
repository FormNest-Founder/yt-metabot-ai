# T12 + T13 + T14 — Combined implementation prompt

## Контекст

Файл: `/home/admin/Projects/yt-metabot/yt-metabot.user.js` (v230203, ~86KB).

**Что уже работает**:
- IDB `metabot_db` v1, stores: `channels`, `comments`, `clf_queue`
- `mbdb.*` модуль: open/upsertChannel/addComment/getChannel/getComments/enqueueForClassification/dequeueBatch/applyClassification
- Collector с 700ms delay + fallback selectors, накапливает text комментариев
- DeepSeek classifier через `classifyBatch()` + UI кнопка `#mbClassifyBtn`
- TrustedTypes shim через `@require http://localhost:8888/trustedtypes-shim.js`
- jQuery 3.7.1, GM_config, normalizeChannelId(@handle→UCxxx), MutationObserver, RYD API, T1-T6 fixes

**Выполнить три задачи последовательно: T14 → T12 → T13.**

Порядок важен: UI (T14) первым, чтобы T12 и T13 могли добавлять в него свои элементы.

═══════════════════════════════════════════════════
## T14 — Modern Settings UI

Текущий `#config` innerHTML ~4715 байт с legacy-мусором (5 colorpicker'ов, 5 textareas под кастомные списки, ссылка на удалённый YouTube Redux extension).

**Удалить из UI** (но НЕ из логики — переменные `arrayListP1, arrayListC1..5, colorpersonal, colorcustom1..5, listp1, listc1..5` сохранить, просто не показывать input'ы):
- 5 colorpicker'ов + textareas для listpersonal/listcustom1..5
- Block `mbcswg2` ("Сторонние списки")
- Checkbox `mbcbox3` "Дополнительные списки"
- Ссылка "Классический дизайн YouTube" с Chrome/Firefox URL'ами

**Новый layout** (используя dark theme, system font, чёткие секции):

```html
<style>
  #config { font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; color: #ddd; background: #0e0e0e; border-radius:8px; padding:0; }
  #config .mb-header { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid #2a2a2a; }
  #config .mb-header img { width:32px; height:32px; border-radius:4px; }
  #config .mb-header h2 { margin:0; font-size:15px; font-weight:600; }
  #config .mb-version { margin-left:auto; font-size:11px; color:#777; }
  #config .mb-section { padding:12px 16px; border-bottom:1px solid #1f1f1f; }
  #config .mb-section h3 { margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#888; font-weight:600; }
  #config .mb-row { display:flex; align-items:center; gap:10px; margin:6px 0; }
  #config .mb-row label { flex:1; cursor:pointer; }
  #config input[type="checkbox"] { width:16px; height:16px; cursor:pointer; accent-color:#5af; }
  #config input[type="password"], #config input[type="text"], #config select {
    background:#1a1a1a; color:#eee; border:1px solid #333; border-radius:4px;
    padding:5px 8px; font-size:13px; outline:none;
  }
  #config input:focus, #config select:focus { border-color:#5af; }
  #config .mb-btn {
    display:inline-flex; align-items:center; gap:6px;
    padding:6px 12px; background:#2a3a4f; color:#fff;
    border:1px solid #3a5070; border-radius:4px; cursor:pointer;
    font-size:13px;
  }
  #config .mb-btn:hover { background:#3a5070; }
  #config .mb-btn.primary { background:#2a5a3a; border-color:#3a703a; }
  #config .mb-btn.primary:hover { background:#3a703a; }
  #config .mb-btn.danger { background:#5a2a2a; border-color:#703a3a; }
  #config .mb-tracked-list { max-height:120px; overflow-y:auto; background:#161616; padding:6px; border:1px solid #2a2a2a; border-radius:4px; font-size:12px; }
  #config .mb-tracked-item { display:flex; align-items:center; padding:4px 6px; border-radius:3px; }
  #config .mb-tracked-item:hover { background:#1f1f1f; }
  #config .mb-remove { color:#f55; cursor:pointer; margin-left:auto; padding:0 6px; }
  #config .mb-stats { font-size:11px; color:#888; margin-top:6px; }
  #config .mb-networks-list { max-height:100px; overflow-y:auto; font-size:12px; margin-top:4px; }
  #config .mb-network-item { padding:4px 6px; border-radius:3px; margin:2px 0; background:#161616; cursor:pointer; display:flex; align-items:center; }
  #config .mb-network-item:hover { background:#1f1f1f; }
  #config .mb-toast { position:absolute; top:8px; right:8px; background:#2a5a3a; color:#fff; padding:6px 10px; border-radius:4px; font-size:12px; display:none; }
</style>

<div class="mb-header">
  <img src="https://raw.githubusercontent.com/asrdri/yt-metabot-user-js/master/logo.png">
  <h2>MetaBot · AI Bot Detection</h2>
  <span class="mb-version">v$$VERSION$$</span>
</div>

<div class="mb-section">
  <h3>DeepSeek API</h3>
  <div class="mb-row">
    <label for="deepseek_api_key">API Key:</label>
    <input type="password" id="deepseek_api_key" placeholder="sk-..." style="width:280px">
  </div>
  <div class="mb-row">
    <label><input type="checkbox" id="mbAutoClassify"> Авто-классификация для tracked-каналов</label>
  </div>
</div>

<div class="mb-section">
  <h3>Известные боты (ЕРКЮ)</h3>
  <div class="mb-row">
    <label>Действие при обнаружении:</label>
    <select id="mbcddm1">
      <option value="1">Помечать</option>
      <option value="2">Скрывать</option>
    </select>
  </div>
  <div class="mb-row"><label><input type="checkbox" id="mbcbox1"> Авто-дизлайк ботам</label></div>
  <div class="mb-row"><label><input type="checkbox" id="mbcbox2"> Скрывать длинные подписи Like/Dislike</label></div>
</div>

<div class="mb-section">
  <h3>Отслеживаемые каналы <span id="mbTrackedCount" style="font-weight:normal;color:#666"></span></h3>
  <div class="mb-tracked-list" id="mbTrackedList">
    <div style="color:#666;font-style:italic;padding:8px;text-align:center">Нет отслеживаемых каналов.<br>Откройте видео и нажмите [👁 Отслеживать] под автором.</div>
  </div>
</div>

<div class="mb-section">
  <h3>Известные ботосетки <span id="mbNetworksCount" style="font-weight:normal;color:#666"></span></h3>
  <div class="mb-networks-list" id="mbNetworksList">
    <div style="color:#666;font-style:italic;padding:8px;text-align:center">Сетки не выявлены.<br>Нажмите [🕸 Кластеризовать] после анализа паттернов.</div>
  </div>
</div>

<div class="mb-section">
  <h3>Действия</h3>
  <div class="mb-row" style="flex-wrap:wrap;gap:6px">
    <button id="mbClassifyBtn" class="mb-btn primary">🤖 Классифицировать</button>
    <button id="mbAnalyzePatternsBtn" class="mb-btn">🔍 Анализ паттернов</button>
    <button id="mbClusterBtn" class="mb-btn">🕸 Кластеризовать</button>
  </div>
  <div class="mb-stats" id="mbStats">Каналов: 0 · Очередь: 0 · Комментариев: 0 · Сеток: 0</div>
</div>

<div class="mb-section" style="border-bottom:none;padding-top:8px">
  <div class="mb-row" style="font-size:11px;color:#666">
    <a href="https://github.com/asrdri/yt-metabot-user-js/" id="urlgithub" style="color:#6af;cursor:pointer">GitHub</a>
    <span style="margin-left:auto"><span id="resetbtn" style="cursor:pointer;color:#a55">Сброс</span></span>
  </div>
</div>

<span id="configsaved" class="mb-toast">Сохранено</span>
```

**В JS обновить** — при `cfgbtn click` (или открытии panel) вызывать `refreshStats()` и `renderTracked()` и `renderNetworks()`.

═══════════════════════════════════════════════════
## T12 — Channel tracking + auto-classify

### IDB v2 upgrade

В `mbdb.open()` поднять версию до 2:
```js
const req = indexedDB.open('metabot_db', 2);
req.onupgradeneeded = (e) => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains('channels')) db.createObjectStore('channels', { keyPath: 'channelId' });
  if (!db.objectStoreNames.contains('comments')) {
    const cs = db.createObjectStore('comments', { keyPath: 'id', autoIncrement: true });
    cs.createIndex('by-channel', 'channelId');
  }
  if (!db.objectStoreNames.contains('clf_queue')) db.createObjectStore('clf_queue', { keyPath: 'channelId' });
  if (!db.objectStoreNames.contains('tracked_channels')) db.createObjectStore('tracked_channels', { keyPath: 'channelId' });
};
```

### Новые mbdb функции

- `mbdb.trackChannel(channelId, displayName)` — upsert `{channelId, displayName, addedAt: Date.now()}`
- `mbdb.untrackChannel(channelId)` — delete
- `mbdb.isTracked(channelId)` — Promise<bool>
- `mbdb.getTrackedChannels()` — Promise<Array<{channelId, displayName, addedAt}>>
- `mbdb.countChannels()`, `mbdb.countComments()`, `mbdb.countQueue()`, `mbdb.countTracked()` — Promise<number> (для T14 stats)

### UI: кнопка [👁 Отслеживать] на странице видео

При navigation на watch page:
1. Найти owner: `document.querySelector('ytd-video-owner-renderer #channel-name a, #owner #channel-name a')`
2. Извлечь href, нормализовать через `normalizeChannelId(href)` → UCxxx
3. Проверить `mbdb.isTracked(ownerId)`
4. Вставить кнопку рядом с именем канала:
   ```html
   <button id="mbTrackOwnerBtn" style="padding:4px 10px; margin-left:8px; border-radius:12px; border:none; cursor:pointer; font-size:12px; background:#444; color:#fff;">👁 Отслеживать</button>
   ```
5. По клику — toggle: добавить/удалить, обновить label (`👁 Отслеживается ✓`) и background (`#3a5` при tracked, `#444` иначе)

Делать через MutationObserver на `ytd-video-owner-renderer` или delay 3 сек после navigation.

### Tracked list в settings (T14)

В функции `renderTracked()`:
```js
async function renderTracked() {
  const list = await mbdb.getTrackedChannels();
  const ul = document.querySelector('#mbTrackedList');
  document.querySelector('#mbTrackedCount').textContent = list.length ? `(${list.length})` : '';
  if (list.length === 0) {
    ul.innerHTML = '<div style="color:#666;font-style:italic;padding:8px;text-align:center">Нет отслеживаемых каналов.<br>Откройте видео и нажмите [👁 Отслеживать] под автором.</div>';
    return;
  }
  ul.innerHTML = list.map(c => `<div class="mb-tracked-item"><span>${c.displayName||c.channelId}</span><span class="mb-remove" data-id="${c.channelId}">✕</span></div>`).join('');
  ul.querySelectorAll('.mb-remove').forEach(el => {
    el.onclick = async () => { await mbdb.untrackChannel(el.dataset.id); renderTracked(); refreshStats(); };
  });
}
```

### Auto-classify

В `yt-navigate-finish` handler:
```js
const ownerId = await getCurrentVideoOwnerId();  // helper using normalizeChannelId
if (ownerId && await mbdb.isTracked(ownerId)) {
  const apiKey = GM_getValue('deepseek_api_key', '');
  if (!apiKey) return;
  // Throttle: not more than once per 5 minutes per channel
  const lastKey = 'mb_last_autoclassify_' + ownerId;
  const last = GM_getValue(lastKey, 0);
  if (Date.now() - last < 5 * 60 * 1000) return;
  // Wait 30s for comments to load, then classify in background
  setTimeout(async () => {
    GM_setValue(lastKey, Date.now());
    try {
      console.log('[MetaBot AI] Auto-classify triggered for tracked channel', ownerId);
      await classifyBatch();
    } catch (e) { console.warn('[MetaBot AI] auto-classify failed:', e.message); }
  }, 30000);
}
```

### Visual indicator

На странице видео tracked-канала — добавить badge `[👁 ОТСЛЕЖИВАЕТСЯ]` рядом с заголовком видео или fixed pos:
```js
if (tracked) {
  const badge = document.createElement('span');
  badge.id = 'mbTrackedBadge';
  badge.style.cssText = 'position:fixed;top:60px;right:20px;z-index:9999;background:#3a5;color:#fff;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;';
  badge.textContent = '👁 ОТСЛЕЖИВАЕТСЯ';
  document.body.appendChild(badge);
}
```

═══════════════════════════════════════════════════
## T13 — Behavioral patterns + Bot networks

### IDB v2 → v3 upgrade

Добавить в существующие `channels` записи (через upsert) поля:
- `themes` — Object<string, number>
- `targets` — Object<string, {pro:number, anti:number}>
- `topChannels` — Array<{videoChannel, count}>
- `network_signals` — Object<signal_name, number>
- `network_cluster_id` — string|null
- `aiAnalysisAt` — timestamp
- `analysisSummary` — string

Новый store `networks` (keyPath: 'clusterId'):
- `{clusterId, name, description, signature, members: [channelId...], detectedAt, exemplars: [text...]}`

Новый store `analysis_queue` (keyPath: 'channelId').

`mbdb.upsertChannel` должен делать MERGE (не overwrite) — чтобы расширенные поля сохранялись.

### Новые mbdb функции

- `mbdb.enqueueForAnalysis(channelId)`
- `mbdb.dequeueAnalysisBatch(n)` — берёт N каналов из analysis_queue
- `mbdb.applyPatterns(channelId, patternsObj)` — записывает themes/targets/network_signals и т.п.
- `mbdb.upsertNetwork(network)`
- `mbdb.getNetworks()` — Promise<Array>
- `mbdb.countNetworks()` — Promise<number>

### analyzePatternsBatch()

```js
async function analyzePatternsBatch() {
  const queue = await mbdb.dequeueAnalysisBatch(20);
  if (queue.length === 0) { showToast('Очередь анализа пуста'); return; }
  const channelData = await Promise.all(queue.map(async ({channelId}) => {
    const ch = await mbdb.getChannel(channelId);
    const comments = await mbdb.getComments(channelId, 10);  // 10 sample
    // Compute topChannels: count videoChannel occurrences from comments
    // (skip — too expensive to do here, prompt asks AI to identify them from samples)
    return {
      channelId,
      label: ch.label,
      confidence: ch.confidence,
      joinDate: ch.joinDate,
      commentSamples: comments.map(c => ({
        videoId: c.videoId,
        text: c.text,
        timestamp: c.timestamp
      })).filter(c => c.text && c.text.length > 5).slice(0, 8)
    };
  }));
  // Send to DeepSeek with PATTERN_SYSTEM_PROMPT
  const response = await callDeepSeek([
    { role: 'system', content: PATTERN_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(channelData) }
  ]);
  const parsed = JSON.parse(response.choices[0].message.content);
  for (const p of parsed.patterns) {
    await mbdb.applyPatterns(p.channelId, {
      themes: p.themes,
      targets: p.targets,
      network_signals: p.network_signals,
      analysisSummary: p.summary,
      aiAnalysisAt: Date.now()
    });
  }
  showToast(`Проанализировано: ${parsed.patterns.length}`);
  refreshStats();
}
```

PATTERN_SYSTEM_PROMPT (из IMPLEMENTATION_PROMPT_T13.md, повторно):
```
You are a YouTube comment behavior pattern analyst.
For each channel, analyze their COMMENT SAMPLES and produce:

1. themes: Object<theme_name, percentage> — what topics they comment on
   (politics_russia, politics_world, entertainment, music, gaming, education, other)
   Sum of percentages = 100.

2. targets: Object<person_or_entity, {pro: 0-100, anti: 0-100}>
   Common: Putin, Navalny, Kac, Soloviev, Pevchikh, Zelensky, RF_government, Opposition, Ukraine, USA, EU
   Only include targets actually mentioned.

3. network_signals: Object<signal, 0-100>
   - pro_kremlin_score (pro-Putin/RF gov stance)
   - anti_opposition_score (anti-Navalny/anti-Kac/anti-opposition)
   - pro_opposition_score
   - anti_kremlin_score
   - whataboutism_score (deflection tactics)
   - personal_attack_score (ad hominem)
   - repetition_score (same talking points repeated)
   - quality_score (0-100, organic engagement vs templated)

4. summary: 1-sentence behavior description in Russian (max 100 chars)

Return ONLY JSON: {"patterns": [{channelId, themes, targets, network_signals, summary}]}
```

### clusterNetworks() — locally without AI

```js
async function clusterNetworks() {
  // Get all channels with network_signals populated and label !== 'HUMAN'
  const channels = await mbdb.getAllChannels();
  const candidates = channels.filter(c => c.network_signals && c.label !== 'HUMAN');
  if (candidates.length < 3) { showToast('Недостаточно данных для кластеризации (нужно ≥3 канала)'); return; }
  
  // Build feature vectors
  const signalKeys = ['pro_kremlin_score', 'anti_opposition_score', 'pro_opposition_score', 'anti_kremlin_score', 'whataboutism_score', 'personal_attack_score', 'repetition_score'];
  const vectors = candidates.map(c => ({
    channelId: c.channelId,
    vec: signalKeys.map(k => c.network_signals[k] || 0)
  }));
  
  // Simple agglomerative clustering: union-find by distance < THRESHOLD
  const THRESHOLD = 30;  // tunable
  const parent = {};
  const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  vectors.forEach(v => parent[v.channelId] = v.channelId);
  
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i+1; j < vectors.length; j++) {
      const dist = Math.sqrt(vectors[i].vec.reduce((s, x, k) => s + Math.pow(x - vectors[j].vec[k], 2), 0));
      if (dist < THRESHOLD) union(vectors[i].channelId, vectors[j].channelId);
    }
  }
  
  // Group by root
  const groups = {};
  for (const v of vectors) {
    const root = find(v.channelId);
    (groups[root] ||= []).push(v.channelId);
  }
  
  // Create networks (only groups with ≥3 members)
  let createdCount = 0;
  for (const [root, members] of Object.entries(groups)) {
    if (members.length < 3) continue;
    // Determine name based on average signals
    const avgSignals = {};
    signalKeys.forEach(k => {
      avgSignals[k] = members.reduce((s, mid) => {
        const c = candidates.find(c => c.channelId === mid);
        return s + (c.network_signals[k] || 0);
      }, 0) / members.length;
    });
    
    let name = 'UNKNOWN';
    if (avgSignals.pro_kremlin_score > 60) name = 'PRO-KREMLIN';
    else if (avgSignals.pro_opposition_score > 60) name = 'PRO-OPPOSITION';
    else if (avgSignals.anti_kremlin_score > 60) name = 'ANTI-KREMLIN';
    else if (avgSignals.anti_opposition_score > 60) name = 'ANTI-OPPOSITION';
    
    const clusterId = 'cluster_' + Date.now() + '_' + createdCount;
    await mbdb.upsertNetwork({
      clusterId,
      name,
      description: `Auto-detected cluster, ${members.length} members, avg pro-K ${avgSignals.pro_kremlin_score.toFixed(0)}, anti-opp ${avgSignals.anti_opposition_score.toFixed(0)}`,
      signature: avgSignals,
      members,
      detectedAt: Date.now()
    });
    // Update channels with cluster_id
    for (const mid of members) {
      await mbdb.upsertChannel({channelId: mid, network_cluster_id: clusterId});
    }
    createdCount++;
  }
  showToast(`Создано сеток: ${createdCount}`);
  refreshStats();
  if (typeof renderNetworks === 'function') renderNetworks();
}
```

### Networks list в settings (T14)

```js
async function renderNetworks() {
  const list = await mbdb.getNetworks();
  document.querySelector('#mbNetworksCount').textContent = list.length ? `(${list.length})` : '';
  const ul = document.querySelector('#mbNetworksList');
  if (list.length === 0) {
    ul.innerHTML = '<div style="color:#666;font-style:italic;padding:8px;text-align:center">Сетки не выявлены.<br>Нажмите [🕸 Кластеризовать] после анализа паттернов.</div>';
    return;
  }
  ul.innerHTML = list.map(n => {
    const color = n.name === 'PRO-KREMLIN' ? '#a44' : (n.name === 'PRO-OPPOSITION' ? '#4a8' : '#888');
    return `<div class="mb-network-item" data-cluster="${n.clusterId}">
      <span style="font-weight:600;color:${color}">${n.name}</span>
      <span style="color:#888;margin-left:8px">${n.members.length} каналов</span>
      <span style="margin-left:auto;font-size:11px;color:#666">${new Date(n.detectedAt).toLocaleDateString()}</span>
    </div>`;
  }).join('');
}
```

### Extended hover-card (применяется в applyBadge)

При наведении на badge `[BOT]/[SUSPECT]` — показывать tooltip с:
- Label + confidence
- `analysisSummary` (если есть)
- Top-3 targets (`Putin +95 / Navalny -90 / Kac -85`)
- Network cluster name (если есть)
- "Активен на: @channel1 (47), @channel2 (23)" — если topChannels есть

В `applyBadge(jNode, channel)` обновить:
```js
const targets = channel.targets || {};
const topTargets = Object.entries(targets).map(([k, v]) => {
  const score = (v.pro || 0) - (v.anti || 0);
  return `${k} ${score > 0 ? '+' : ''}${score}`;
}).sort((a,b) => Math.abs(parseInt(b.split(' ')[1])) - Math.abs(parseInt(a.split(' ')[1]))).slice(0, 3);

const tooltip = [
  `${channel.label}: ${Math.round((channel.confidence||0)*100)}%`,
  channel.reasoning,
  channel.analysisSummary,
  topTargets.length ? 'Цели: ' + topTargets.join(' / ') : '',
  channel.network_cluster_id ? 'Сетка: ' + channel.network_cluster_id : ''
].filter(Boolean).join('\n');

badge.title = tooltip;
```

### Auto-flow

В `mbdb.applyClassification` после успешной классификации (label !== 'HUMAN' и comments.length ≥ 3):
- `await mbdb.enqueueForAnalysis(channelId);`

═══════════════════════════════════════════════════
## Общие требования

1. **@version: 230300**
2. **Backup**: `cp yt-metabot.user.js yt-metabot.user.js.bak-t12-13-14-pre`
3. **`node --check`** PASS обязательно
4. **НЕ переобъявлять переменные** в одном scope (eslint no-redeclare)
5. **Все async функции** в try/catch
6. **showToast(msg)** функция — показать `#configsaved` с текстом на 1.5с
7. **refreshStats()** — обновляет `#mbStats` счётчик
8. **При cfgbtn click** — после `cfg.style.display = 'block'` вызывать:
   ```js
   refreshStats(); renderTracked(); renderNetworks();
   ```
9. Сохранить @match, @include, все @connect, @grant, @require как сейчас. НЕ удалять `@require http://localhost:8888/trustedtypes-shim.js`!
10. Сохранить @updateURL/@downloadURL **закомментированными** (auto-update вернётся к upstream и сотрёт)

## Acceptance criteria

После reload userscript на YouTube:
1. ✅ Settings panel (cfgbtn click) — современный dark UI, ~2500 байт innerHTML вместо 4715
2. ✅ Live counter "Каналов: N · Очередь: N · Комментариев: N · Сеток: N"
3. ✅ На странице видео — кнопка [👁 Отслеживать] рядом с автором канала
4. ✅ Click — toggle tracked, кнопка меняет label/цвет
5. ✅ В settings panel — список отслеживаемых с ✕ кнопкой
6. ✅ Auto-classify срабатывает через 30 сек на видео tracked-канала (логируется в console)
7. ✅ Кнопка [🔍 Анализ паттернов] — отправляет batch в DeepSeek с pattern prompt
8. ✅ Кнопка [🕸 Кластеризовать] — локально группирует каналы по network_signals
9. ✅ В settings panel — список ботосеток
10. ✅ Hover на badge `[BOT]` показывает targets + cluster + summary

## Отчёт

После имплементации:
- @version финальный
- node --check pass/fail
- Размер `#config` innerHTML до/после
- Список новых функций mbdb.*
- Список новых UI элементов (id)
- Что протестировать визуально сэру
