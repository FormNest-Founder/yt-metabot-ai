# Prompt для opencode + DeepSeek — T12: Channel Tracking + Auto-Classify

## Запуск
```bash
cd /home/admin/Projects/yt-metabot
opencode run --model deepseek/deepseek-chat "$(cat IMPLEMENTATION_PROMPT_T12.md)"
```

## Контекст

Файл: `/home/admin/Projects/yt-metabot/yt-metabot.user.js` (v230200, ~85KB, работает с AI-классификацией).

Уже есть:
- IDB `metabot_db` v1 со stores `channels`, `comments`, `clf_queue`
- `mbdb.*` модуль (upsertChannel/addComment/getChannel/getComments/enqueueForClassification/dequeueBatch/applyClassification)
- `classifyBatch()` — посылает в DeepSeek API
- UI: button `#mbClassifyBtn` и input `#deepseek_api_key` в settings panel (`#config`)
- Settings panel открывается через клик на `#cfgbtn` (🔧)
- normalizeChannelId(href) — резолвит @handle → UCxxx
- MutationObserver на #comments + SPA navigation handler

## Задача T12

Добавить функционал **"Отслеживание каналов"** для автоматической работы:

### 1. IDB upgrade — добавить store `tracked_channels`

В `mbdb.open()` поднять версию до v2:
```javascript
const req = indexedDB.open('metabot_db', 2);
req.onupgradeneeded = (e) => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains('channels')) { /* ... */ }
  // ... existing v1 stores
  if (!db.objectStoreNames.contains('tracked_channels')) {
    db.createObjectStore('tracked_channels', { keyPath: 'channelId' });
  }
};
```

Добавить функции в mbdb:
- `mbdb.trackChannel(channelId, displayName)` — добавляет/обновляет запись `{channelId, displayName, addedAt: Date.now()}`
- `mbdb.untrackChannel(channelId)` — удаляет
- `mbdb.isTracked(channelId)` — Promise<bool>
- `mbdb.getTrackedChannels()` — Promise<Array<{channelId, displayName, addedAt}>>

### 2. UI: кнопка "Отслеживать" на странице видео

В `parseitemNew` уже выявляется автор канала. Для **владельца видео** (а не каждого комментатора) — отдельная кнопка.

Найти владельца видео через DOM селектор: `ytd-video-owner-renderer ytd-channel-name a` или `#owner #channel-name a` или `meta[itemprop="channelId"]`. Использовать `normalizeChannelId(href)` если @handle.

После загрузки страницы видео (yt-navigate-finish + delay):
1. Найти контейнер owner: `ytd-video-owner-renderer #owner` или ближайший контейнер с именем канала
2. Вставить кнопку справа от имени канала с текстом `[👁 Отслеживать]` или `[👁 Отслеживается ✓]` в зависимости от статуса
3. По клику — toggle: добавить/удалить из `tracked_channels`, обновить label кнопки и сохранить
4. Стили: padding 4px 10px, border-radius 12px, cursor pointer, background при tracked = `#3a5` (зелёный), при не-tracked = `#444`

ID кнопки: `mbTrackOwnerBtn`. Selector родителя — `ytd-video-owner-renderer #owner` (или fallback на ближайший контейнер).

### 3. Settings panel: список отслеживаемых

В `#config` settings panel перед кнопкой `#mbClassifyBtn` добавить блок:
```html
<br><b>Отслеживаемые каналы:</b>
<div id="mbTrackedList" style="max-height:120px;overflow-y:auto;background:#1a1a1a;padding:6px 10px;margin:6px 0;font-size:12px;border:1px solid #333;border-radius:4px">
  <!-- динамически заполняется -->
</div>
```

Когда settings panel открывается (`cfgbtn click`), вызывать `renderTrackedList()`:
- Получить через `mbdb.getTrackedChannels()`
- Рендерить каждую строку как `<div><span>@{displayName}</span> <span style="cursor:pointer;color:#f55;float:right" data-untrack="{channelId}">[✕ remove]</span></div>`
- Click на ✕ — `mbdb.untrackChannel(channelId)` + re-render

### 4. Auto-classify при просмотре tracked-канала

В обработчике `yt-navigate-finish` или после загрузки нового видео:
1. Получить channelId владельца видео (тем же способом что для кнопки в п.2)
2. `await mbdb.isTracked(ownerChannelId)`
3. Если tracked И есть API key (`GM_getValue('deepseek_api_key')` непустой):
   - Подождать 30 секунд после загрузки (чтобы комменты успели загрузиться и попали в clf_queue)
   - В фоне (без UI индикации, чтобы не отвлекать) вызвать `classifyBatch()`
   - В консоли логировать `[MetaBot AI] Auto-classify triggered for tracked channel UCxxxxx`
4. Throttle: не делать auto-classify чаще раз в 5 минут (per channel) — хранить timestamps в `GM_setValue('mb_last_autoclassify_'+channelId)`

### 5. Визуальный индикатор tracked-канала

На странице видео tracked-канала — отображать badge `[👁 ОТСЛЕЖИВАЕТСЯ]` зелёным цветом в правом верхнем углу страницы или рядом с заголовком видео.

Можно сделать как `position: fixed; top: 60px; right: 20px; z-index: 9999;` минималистично. Или вставить в `ytd-watch-metadata #title` как inline span.

### 6. Не ломать существующее

- @version: 230300
- Backup: `cp yt-metabot.user.js yt-metabot.user.js.bak-t12-pre`
- Все новые функции в try/catch
- IDB version migration безопасная (только добавляем store, не меняем существующие)
- node --check после правок

## Acceptance criteria

1. После reload userscript: кнопка `[👁 Отслеживать]` появляется на странице любого YouTube видео рядом с именем канала-владельца
2. Click — кнопка меняет label на `[👁 Отслеживается ✓]` + зелёный фон, в IDB появляется запись в `tracked_channels`
3. Settings panel показывает список отслеживаемых каналов с кнопкой ✕ для удаления
4. При следующем открытии видео с отслеживаемого канала: через 30 сек в console появляется `[MetaBot AI] Auto-classify triggered`, batch отправляется без явного клика на кнопку
5. После reload браузера — список отслеживаемых сохраняется (IDB persistent)

## НЕ делать

- Авто-классификацию для не-tracked каналов (остаётся manual button)
- Множественный одновременный auto-classify (throttle 5 min per channel)
- Notification API (не использовать window.alert / Notification)
- Сложные animations / UX overkill

## Отчёт

После имплементации:
- Какие строки/блоки добавлены (диапазоны)
- @version финальный
- node --check pass/fail
- Список новых ID элементов
- Что проверить: открыть видео сэр, кликнуть [👁 Отслеживать], reload, убедиться что состояние сохранено
