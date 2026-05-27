# T14: Modernize MetaBot settings UI

## Запуск
```bash
cd /home/admin/Projects/yt-metabot
opencode run --model deepseek/deepseek-chat "$(cat IMPLEMENTATION_PROMPT_T14.md)"
```

## Контекст

Файл: `/home/admin/Projects/yt-metabot/yt-metabot.user.js` (v230203, ~86KB).
Settings panel сейчас — гигантская innerHTML строка (~4KB) с legacy-мусором из 2018-2021 годов: цветовые пикеры для 5 кастомных списков, текстовые поля под каждый список, ссылка на удалённое расширение YouTube Redux, неактуальные опции.

## Задача T14 — современный минималистичный UI

### Что УБРАТЬ (legacy мусор)

1. Все 5 colorpicker'ов и textarea для `listpersonal`, `listcustom1..5` — это для подключения чужих CSV-списков ботов, мёртвая фича 2021 года
2. `mbcbox3` checkbox "Дополнительные списки" и вложенный `mbcswg2` блок
3. Ссылка "Классический дизайн YouTube: [Chrome] [Firefox]" — мёртвое расширение
4. "Сторонние списки" с descc1-5 и input'ами URL — legacy bot-list aggregator
5. Кнопка "Сбросить настройки" (`resetbtn`) — оставить но в углу маленькую

### Что ОСТАВИТЬ / СДЕЛАТЬ

Новая структура `#config` innerHTML:

```html
<style>
  #config { font: 13px/1.5 ui-sans-serif, system-ui, sans-serif; color: #ddd; }
  #config .mb-header { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid #2a2a2a; }
  #config .mb-header img { width:32px; height:32px; }
  #config .mb-header h2 { margin:0; font-size:15px; font-weight:600; }
  #config .mb-version { margin-left:auto; font-size:11px; color:#777; }
  #config .mb-section { padding:12px 16px; border-bottom:1px solid #1f1f1f; }
  #config .mb-section h3 { margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#888; }
  #config .mb-row { display:flex; align-items:center; gap:10px; margin:6px 0; }
  #config .mb-row label { flex:1; cursor:pointer; }
  #config input[type="checkbox"] { width:16px; height:16px; cursor:pointer; }
  #config input[type="password"], #config input[type="text"], #config select {
    background:#1a1a1a; color:#eee; border:1px solid #333; border-radius:4px;
    padding:5px 8px; font-size:13px; outline:none; transition:border-color .15s;
  }
  #config input:focus, #config select:focus { border-color:#5af; }
  #config .mb-btn {
    display:inline-flex; align-items:center; gap:6px;
    padding:6px 12px; background:#2a3a4f; color:#fff;
    border:1px solid #3a5070; border-radius:4px; cursor:pointer;
    font-size:13px; transition:background .15s;
  }
  #config .mb-btn:hover { background:#3a5070; }
  #config .mb-btn.primary { background:#2a5a3a; border-color:#3a703a; }
  #config .mb-btn.primary:hover { background:#3a703a; }
  #config .mb-btn.danger { background:#5a2a2a; border-color:#703a3a; }
  #config .mb-tracked-list {
    max-height:120px; overflow-y:auto; background:#161616;
    padding:6px; border:1px solid #2a2a2a; border-radius:4px;
    font-size:12px; margin-top:6px;
  }
  #config .mb-tracked-item {
    display:flex; align-items:center; padding:4px 6px; border-radius:3px;
  }
  #config .mb-tracked-item:hover { background:#1f1f1f; }
  #config .mb-tracked-item .mb-remove { color:#f55; cursor:pointer; margin-left:auto; padding:0 6px; }
  #config .mb-stats { font-size:11px; color:#888; margin-top:4px; }
  #config .mb-toast {
    position:absolute; top:8px; right:8px;
    background:#2a5a3a; color:#fff; padding:6px 10px;
    border-radius:4px; font-size:12px; display:none;
  }
</style>

<div class="mb-header">
  <img src="https://raw.githubusercontent.com/asrdri/yt-metabot-user-js/master/logo.png">
  <h2>MetaBot · AI Bot Detection</h2>
  <span class="mb-version">v$$VERSION$$</span>
</div>

<!-- API & Mode -->
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

<!-- Comment marking -->
<div class="mb-section">
  <h3>Известные боты (ЕРКЮ)</h3>
  <div class="mb-row">
    <label>Действие при обнаружении:</label>
    <select id="mbcddm1">
      <option value="1">Помечать</option>
      <option value="2">Скрывать</option>
    </select>
  </div>
  <div class="mb-row">
    <label><input type="checkbox" id="mbcbox1"> Автоматически ставить 👎</label>
  </div>
  <div class="mb-row">
    <label><input type="checkbox" id="mbcbox2"> Скрывать длинные подписи кнопок Like/Dislike</label>
  </div>
</div>

<!-- Tracked channels -->
<div class="mb-section">
  <h3>Отслеживаемые каналы <span id="mbTrackedCount" style="font-weight:normal;color:#666"></span></h3>
  <div class="mb-tracked-list" id="mbTrackedList">
    <div style="color:#666;font-style:italic;padding:8px">Нет отслеживаемых каналов. Откройте видео и нажмите [👁 Отслеживать].</div>
  </div>
</div>

<!-- Actions -->
<div class="mb-section">
  <h3>Действия</h3>
  <div class="mb-row" style="flex-wrap:wrap;gap:6px">
    <button id="mbClassifyBtn" class="mb-btn primary">🤖 Классифицировать (AI)</button>
    <button id="mbAnalyzePatternsBtn" class="mb-btn">🔍 Анализ паттернов</button>
    <button id="mbClusterBtn" class="mb-btn">🕸 Перестроить кластеры</button>
  </div>
  <div class="mb-stats" id="mbStats">
    Каналов: 0 · Очередь: 0 · Комментариев: 0 · Сеток: 0
  </div>
</div>

<!-- Footer -->
<div class="mb-section" style="border-bottom:none;padding-top:8px">
  <div class="mb-row" style="font-size:11px;color:#666">
    <a href="https://github.com/asrdri/yt-metabot-user-js/" id="urlgithub" style="color:#6af;cursor:pointer">GitHub</a>
    <span style="margin-left:auto">
      <span id="resetbtn" style="cursor:pointer;color:#a55">Сброс настроек</span>
    </span>
  </div>
</div>

<span id="configsaved" class="mb-toast">Сохранено</span>
```

### Логика обновлений

1. **При открытии panel** (`cfgbtn click`):
   - Заполнить `#mbStats` актуальными счётчиками из IDB:
     ```js
     const channels = await mbdb.countChannels();
     const queue = await mbdb.countQueue();
     const comments = await mbdb.countComments();
     const networks = await mbdb.countNetworks?.() ?? 0;
     document.querySelector('#mbStats').textContent =
       `Каналов: ${channels} · Очередь: ${queue} · Комментариев: ${comments} · Сеток: ${networks}`;
     ```
   - Заполнить `#mbTrackedList` (если есть mbdb.getTrackedChannels — иначе пропустить, T12 ещё не сделан)

2. **Добавить функции счётчиков в mbdb** (если нет):
   - `mbdb.countChannels()`, `mbdb.countComments()`, `mbdb.countQueue()` — Promise<number>

3. **Toast notification** (`#configsaved`) — показывать на 1.5 сек при сохранении или после кнопок (через `.style.display = 'inline-block'`, timeout, hide).

4. **Кнопки**:
   - `#mbClassifyBtn` — `classifyBatch()` + toast
   - `#mbAnalyzePatternsBtn` — `analyzePatternsBatch()` (если функция есть — иначе показать toast "T13 not implemented yet")
   - `#mbClusterBtn` — `clusterNetworks()` (если функция есть — иначе toast)
   - `#resetbtn` — `confirm('Сбросить настройки?')` → reset GM_config

5. **Сохранение API key**:
   - Listen `change` event на `#deepseek_api_key`
   - `GM_config.set('deepseek_api_key', val); GM_config.save();`
   - Показать toast

### Что НЕ трогать (legacy функциональность которую УБИРАЕМ ПОЛНОСТЬЮ)

- `arrayListP1, arrayListC1..C5` переменные — оставить (используются в parseitemNew), просто игнорировать в UI
- `colorpersonal, colorcustom1..5` GM_config поля — не показывать в UI но сохранить
- `listc1..5, listp1` GM_config поля — не показывать в UI
- Если код где-то использует `$(jNode).find("input#listcustom1").val(...)` — убрать или wrap в try (т.к. эти input больше не создаются)

### Версионирование

- `@version`: 230300
- Backup: `cp yt-metabot.user.js yt-metabot.user.js.bak-t14-pre`
- node --check после правок
- Bonus: пройтись eslint-стилем по новому коду — НЕ переобъявлять переменные в одном scope

## Acceptance criteria

1. После reload settings panel выглядит современно: dark theme, чёткие секции, минимум полей
2. Размер `#config` innerHTML уменьшается с ~4715 байт до ~2500-3000
3. API key поле работает, save сохраняет в GM_config
4. Кнопки Classify/Analyze/Cluster есть и связаны со своими функциями
5. `#mbStats` показывает реальные счётчики из IDB
6. `node --check` PASS, нет JS exception при открытии panel

## Отчёт

После имплементации:
- Размер `#config` innerHTML до/после
- Скриншот через CDP (если возможно)
- @version финальный
- node --check pass/fail
- Что протестировать сэру визуально
