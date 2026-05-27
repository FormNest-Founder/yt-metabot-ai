# Prompt для opencode + DeepSeek — MVP AI-augmented bot detection

## Запуск

```bash
cd /home/admin/Projects/yt-metabot
opencode run --agent coder --model deepseek/deepseek-chat "$(cat IMPLEMENTATION_PROMPT.md)"
```

Или интерактивно:
```bash
cd /home/admin/Projects/yt-metabot
opencode
# затем вставить содержимое ниже
```

---

## Контекст

Файл: `/home/admin/Projects/yt-metabot/yt-metabot.user.js` (v230113, ~63KB, рабочий MetaBot для YouTube).

Уже работает:
- normalizeChannelId(href) — резолвит @handle → UCxxx через scraping /about
- parseitemNew(jNode) — обработка комментария, idempotency guard через `data-metabot-done` на ytd-comment-thread-renderer
- ERKY-db и custom lists через GM_xmlhttpRequest (mertвые но грузятся)
- MutationObserver на #comments, SPA-navigation handler
- @grant: GM_xmlhttpRequest, GM_getValue, GM_setValue
- @connect: youtube.com, returnyoutubedislikeapi.com, raw.githubusercontent.com, github.com

## Задача — MVP

Расширить MetaBot функциональностью AI-augmented bot detection. Все публичные RU-bot-базы мёртвы с 2021, нужен собственный механизм классификации через DeepSeek API.

### 1. IndexedDB модуль (`mbdb.*` namespace)

Открыть IDB `metabot_db` v1 со stores:
- `channels` (keyPath: 'channelId'): {channelId, handle, joinDate, joinAgeDays, subscriberCount, videoCount, label, confidence, reasoning, classifiedAt, lastSeen}
- `comments` (keyPath: auto, index: by-channel on channelId): {channelId, videoId, text, timestamp, isReply}
- `clf_queue` (keyPath: 'channelId'): {channelId, addedAt, attempts}

Функции:
- `mbdb.open()` — Promise<IDBDatabase>
- `mbdb.upsertChannel(channelData)` — merge с существующим
- `mbdb.addComment(commentData)` — append, FIFO eviction если >50 per channel
- `mbdb.getChannel(channelId)` — для real-time lookup
- `mbdb.enqueueForClassification(channelId)` — add to clf_queue
- `mbdb.dequeueBatch(N=20)` — берёт N каналов из очереди
- `mbdb.applyClassification(channelId, label, confidence, reasoning)` — write back to channels

### 2. Collector — расширить parseitemNew

В parseitemNew после извлечения userID и до основной логики:
```javascript
// Collector hook — async, не блокирующий
(async () => {
  try {
    await mbdb.addComment({
      channelId: userID,
      videoId: (location.search.match(/v=([^&]+)/) || [])[1],
      text: $(jNode).find('#content-text, yt-attributed-string').first().text().slice(0, 1000),
      timestamp: Date.now(),
      isReply: !!jNode.closest('ytd-comment-replies-renderer')
    });
    // Если канал ещё не классифицирован — добавить в очередь
    const channel = await mbdb.getChannel(userID);
    if (!channel || !channel.label) {
      await mbdb.enqueueForClassification(userID);
    }
    // Real-time lookup для уже классифицированных
    if (channel?.label) {
      applyBadge(jNode, channel);
    }
  } catch (e) { console.warn('[MetaBot] collector failed:', e.message); }
})();
```

### 3. Channel meta scraper — extend procdateNew

Когда procdateNew успешно резолвит joinDate, дополнительно вытащить из той же страницы:
- `subscriberCount` — regex `/"subscriberCountText":\{"simpleText":"([^"]+)/`
- `videoCount` — regex `/"videoCount":"(\d+)"/`
- Записать в mbdb.upsertChannel({channelId, joinDate, subscriberCount, videoCount, lastSeen: Date.now()})

### 4. computePatterns(channelId) — derived metrics

Функция читает comments[] для канала и возвращает:
- joinAgeDays (Date.now() - joinDate)
- commentCount
- avgCommentsPerWeek (count / weeks since first comment)
- peakHourMSK (mode of (timestamp+3h)%24 hours)
- peakWeekday (mode of weekday)
- weekdayVsWeekendRatio
- avgCommentLength
- repetitionScore (simple Jaccard between consecutive comments, average)
- channelDiversity (unique videoIds count)

### 5. DeepSeek connector

```javascript
async function callDeepSeek(messages) {
  const apiKey = GM_getValue('deepseek_api_key');
  if (!apiKey) throw new Error('No API key');
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'POST',
      url: 'https://api.deepseek.com/v1/chat/completions',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2000
      }),
      onload: r => {
        if (r.status !== 200) return reject(new Error('HTTP ' + r.status));
        try { resolve(JSON.parse(r.responseText)); }
        catch (e) { reject(e); }
      },
      onerror: reject,
      timeout: 30000
    });
  });
}
```

Добавить в header: `// @connect api.deepseek.com`.

### 6. Batcher — buildPrompt + sendBatch

```javascript
async function classifyBatch() {
  const queue = await mbdb.dequeueBatch(20);
  if (queue.length === 0) return;
  // Собрать данные для каждого канала
  const channelData = await Promise.all(queue.map(async ({channelId}) => {
    const channel = await mbdb.getChannel(channelId);
    const comments = await mbdb.getComments(channelId, 5);  // 5 сэмплов
    const patterns = await computePatterns(channelId);
    return {
      channelId,
      joinDate: channel?.joinDate,
      ...patterns,
      sampleComments: comments.map(c => c.text)
    };
  }));
  const messages = buildPromptMessages(channelData);
  const response = await callDeepSeek(messages);
  const parsed = JSON.parse(response.choices[0].message.content);
  // Apply classifications
  for (const c of parsed.classifications) {
    await mbdb.applyClassification(c.channelId, c.label, c.confidence, c.reasoning);
  }
  // Update cost stats
  GM_setValue('mb_total_input_tokens', (GM_getValue('mb_total_input_tokens', 0) + (response.usage?.prompt_tokens || 0)));
  GM_setValue('mb_total_output_tokens', (GM_getValue('mb_total_output_tokens', 0) + (response.usage?.completion_tokens || 0)));
}
```

### 7. Prompt builder

Использовать промпт из ARCHITECT_PLAN.md ниже (system + user role split):

```javascript
function buildPromptMessages(channels) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: 'Channels:\n' + JSON.stringify(channels, null, 2) }
  ];
}
const SYSTEM_PROMPT = `You are a YouTube comment behavior analyst...`;  // see plan
```

### 8. GM_config — добавить поля

В GM_config.init({fields: {...}}) добавить:
- `deepseek_api_key` — type: 'text', label: 'DeepSeek API Key'
- `mb_batch_interval_min` — type: 'int', min: 5, max: 1440, default: 30
- `mb_daily_batch_cap` — type: 'int', min: 1, max: 500, default: 50
- `mb_auto_classify` — type: 'checkbox', default: false (manual в MVP)

### 9. UI badge

В функции применения классификации (applyBadge или внутри parseitemNew):
```javascript
function applyBadge(jNode, channel) {
  const colors = { BOT: '#ff5050', SUSPECT: '#ffaa00', HUMAN: '#50c050', UNKNOWN: '#888' };
  const author = jNode.querySelector('#author-text');
  if (!author || author.querySelector('.mb-ai-badge')) return;
  const badge = document.createElement('span');
  badge.className = 'mb-ai-badge';
  badge.style.cssText = `color: ${colors[channel.label]}; margin-left: 6px; font-weight: bold; cursor: help;`;
  badge.textContent = `[${channel.label}]`;
  badge.title = `Confidence: ${(channel.confidence*100).toFixed(0)}%\nReason: ${channel.reasoning}`;
  author.appendChild(badge);
}
```

### 10. "Classify now" button в GM_config

Добавить через `GM_config.init({events: {...}})` или отдельную кнопку в settings panel — триггерит classifyBatch() вручную.

## Acceptance criteria для MVP

1. После установки API key в GM_config:
   - При просмотре YouTube видео комментарии собираются в IDB
   - Кнопка "Classify now" обрабатывает первые 20 каналов из очереди
   - Через несколько секунд под комментариями появляются цветные badges [BOT]/[SUSPECT]/[HUMAN]
2. При повторном открытии YouTube — уже классифицированные комментаторы сразу подсвечены
3. IDB не разрастается бесконечно (FIFO eviction)
4. Cost stats доступны через GM_config

## НЕ делать в MVP

- Авто-таймер для классификации (только manual button)
- Расширенная hover card с reasoning (badge.title достаточно)
- Cold-start эвристики без AI
- Экспорт/импорт базы
- Cost cap warnings (только трекинг)
- Privacy mode "send only patterns"
- Repetition score / response time metric (только базовые: count, avg, peakHour, diversity)

## Требования к коду

- @version: 230200 (мажорное обновление функциональности)
- Backup перед началом: `cp yt-metabot.user.js yt-metabot.user.js.bak-mvp-pre`
- node --check после правок — должен пройти
- Не ломать существующие T1-T6 фиксы
- Все новые async функции в try/catch
- IDB операции через Promise wrapper (не raw event handlers)
- Console logging с префиксом `[MetaBot AI]` для отладки

## Отчёт

После имплементации:
- Какие строки/блоки добавлены
- node --check pass/fail
- Размер файла до/после
- Шаги для тестирования (где ввести API key, как запустить classify)
