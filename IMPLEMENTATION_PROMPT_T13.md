# Prompt для opencode + DeepSeek — T13: Behavioral patterns + Bot network detection

## Запуск
```bash
cd /home/admin/Projects/yt-metabot
opencode run --model deepseek/deepseek-chat "$(cat IMPLEMENTATION_PROMPT_T13.md)"
```

## Контекст

Файл: `/home/admin/Projects/yt-metabot/yt-metabot.user.js` (v230202, ~86KB, рабочий с AI-классификацией).

Уже работает:
- IDB `metabot_db` v1 со stores `channels`, `comments`, `clf_queue`
- `mbdb.*` модуль + `classifyBatch()` → DeepSeek
- Collector с 700ms delay + fallback selectors для text capture
- UI badges `[BOT]/[SUSPECT]/[HUMAN]` + кнопка `#mbClassifyBtn`
- `@connect api.deepseek.com`, `@updateURL` закомментирован

## Задача T13 — поведенческие паттерны и кластеры ботосеток

Сэр хочет накапливать **профиль** каждого комментатора:
- На каких каналах активен (top-N с counts)
- Кого консистентно хвалит/критикует (targets с sentiment scores)
- Тематика (политика, развлечения, etc.)
- Поведенческие маркеры ботосетки

Цель: со временем выявлять **связанные кластеры** ("эти 50 каналов всегда вместе всплывают с одинаковой про-власть риторикой = одна ботосеть").

### 1. IDB schema upgrade (v2 → v3)

Версия БД: 3. В `onupgradeneeded` добавить:
- В store `channels` добавить (в существующих записях через upsert):
  - `themes` — Map<string, number> (тематика → count): `{"politics": 47, "entertainment": 3}`
  - `targets` — Map<string, {pro: N, anti: N, neutral: N}>: `{"Navalny": {pro:0, anti:42, neutral:1}, "Kac": {anti:38}, "Putin": {pro:51}}`
  - `topChannels` — Array<{videoChannel: string, count: number}> (top-5 каналов на которых комментирует)
  - `aiAnalysisAt` — timestamp последнего AI-анализа паттернов
  - `network_cluster_id` — string|null, ID кластера ботосетки (вычисляется отдельно)
  - `network_signals` — Object: {pro_putin_score, anti_navalny_score, pro_kac_score, и т.п.} — числа 0-100

- Новый store `networks` (keyPath: 'clusterId'):
  - `{clusterId, name, description, signature, members: [channelId...], detectedAt, exemplars: [3 sample comments]}`

- Новый store `analysis_queue` (keyPath: 'channelId'):
  - Аналогично `clf_queue` но для extended pattern analysis (после basic classification done)

### 2. Расширение AI prompt

Добавить **второй тип batch** — `analyzePatternsBatch()`. Он берёт из `analysis_queue` каналы у которых уже есть classification, но нет pattern profile.

System prompt (для analyzePatternsBatch):
```
You are a YouTube comment behavior pattern analyst.
For each channel, analyze their COMMENT SAMPLES and produce:

1. themes: Object<theme_name, percentage> — what topics they comment on
   (politics_russia, politics_world, entertainment, music, gaming, education, other)

2. targets: Object<person_or_entity, {pro: 0-100, anti: 0-100}>
   Common targets: Putin, Navalny, Kac, Soloviev, Pevchikh, Zelensky, RF_government, Opposition, Ukraine, USA, EU, US_politicians
   Score reflects how STRONGLY they support/oppose (0-100). Only include targets they mention.

3. network_signals: Object<signal, 0-100>
   - pro_kremlin_score (overall pro-Putin/RF gov stance)
   - anti_opposition_score (anti-Navalny/anti-Kac/anti-opposition)
   - pro_opposition_score (opposite)
   - anti_kremlin_score
   - whataboutism_score (deflection tactics)
   - personal_attack_score (ad hominem at video author or commenters)
   - repetition_score (same talking points repeated)
   - quality_score (0-100, organic engagement vs templated)

4. summary: 1-sentence behavior description in Russian

Return JSON only.
```

User prompt:
```json
[
  {
    "channelId": "UCxxxxxxx",
    "label": "BOT",
    "confidence": 0.87,
    "commentSamples": [
      {"videoChannel": "Навальный LIVE", "text": "Этот предатель за деньги Запада...", "timestamp": ...},
      {"videoChannel": "Россия 24", "text": "Президент гениально решил...", "timestamp": ...},
      {"videoChannel": "Соловьёв LIVE", "text": "Кац - враг народа!", "timestamp": ...}
    ]
  }
]
```

Expected response:
```json
{
  "patterns": [{
    "channelId": "UCxxxxxxx",
    "themes": {"politics_russia": 95, "other": 5},
    "targets": {
      "Putin": {"pro": 95, "anti": 0},
      "Navalny": {"pro": 0, "anti": 90},
      "Kac": {"pro": 0, "anti": 85}
    },
    "network_signals": {
      "pro_kremlin_score": 92,
      "anti_opposition_score": 88,
      "pro_opposition_score": 0,
      "anti_kremlin_score": 0,
      "whataboutism_score": 45,
      "personal_attack_score": 70,
      "repetition_score": 65,
      "quality_score": 25
    },
    "summary": "Активно поддерживает Путина и власть РФ, систематически атакует оппозицию"
  }]
}
```

### 3. Network clustering (локально, без AI)

Функция `clusterNetworks()` (manual trigger или periodically):
1. Берёт все каналы у которых `network_signals` populated и `label !== 'HUMAN'`
2. Считает Euclidean distance между network_signals каждой пары
3. Если distance < threshold (например 25) И они comment'ят на одних videoChannels → same cluster
4. Использует union-find для группировки
5. Записывает clusterId в каждый channel
6. Создаёт запись в `networks` store с auto-generated именем типа:
   - "PRO-KREMLIN / ANTI-OPPOSITION" (если pro_kremlin>70 + anti_opposition>70)
   - "PRO-NAVALNY" (если pro_opposition>70 + mentions Navalny>50% positive)
   - И т.п.
7. Members = все channelIds в кластере

### 4. UI расширение

#### 4.1 В hover-card на комментарии добавить блок "Profile":
```
[BOT] 87% — анти-оппозиция (5 каналов в сетке "PRO-KREMLIN")
Темы: politics_russia 95%
Цели: Putin +95 / Navalny -90 / Kac -85
Активен: @SolovievLIVE (47), @Russia24 (23), ...
```

#### 4.2 Settings panel: добавить блок "Известные ботосетки"
- Список кластеров из `networks` store
- Каждый: имя кластера + кол-во members + button [Подсветить все]
- При нажатии [Подсветить] — все members этой сетки на текущей странице получают рамку особого цвета

#### 4.3 Settings panel: новая кнопка
- **[🔍 Анализ паттернов]** — запускает `analyzePatternsBatch()` для первых 20 каналов из `analysis_queue`
- **[🕸 Перестроить кластеры]** — запускает `clusterNetworks()`

### 5. Auto-flow после classification

Когда `applyClassification(channelId, label, ...)` вызывается:
- Если label !== 'HUMAN' AND comments.length(channelId) >= 3:
  - Auto-enqueue в `analysis_queue` (если не там)

### 6. Cost considerations

Pattern analysis batch:
- 20 каналов × ~10 sample comments × ~50 tokens = ~10K input tokens
- Output ~3K tokens
- Cost ~$0.01 per batch (5x classification batch)

Throttle: max 5 pattern batches per day default. UI: настройка как для classify.

### 7. НЕ делать (out of scope для T13)

- Real-time graph visualization (это T14)
- Cross-platform tracking (только YouTube)
- Sharing/export DB
- Public network registry

### 8. Версионирование

- @version: 230300
- Backup: `cp yt-metabot.user.js yt-metabot.user.js.bak-t13-pre`
- node --check после правок

## Acceptance criteria

1. После reload: settings panel показывает 2 новые кнопки `[🔍 Анализ паттернов]` и `[🕸 Перестроить кластеры]`
2. При нажатии `[🔍 Анализ паттернов]` — отправляется batch, через 5 секунд первые 20 channel'ов получают `network_signals` в IDB
3. Hover-card показывает расширенный profile (themes, targets, network)
4. После `[🕸 Перестроить кластеры]` — записи в `networks` store, channels получают `network_cluster_id`
5. Если в IDB достаточно данных — кластеры формируются по реальным сигналам (pro-K, anti-K, opposition, etc.)

## Отчёт

После имплементации:
- Какие функции добавлены (имена + строки)
- IDB schema diff (v2 → v3)
- Новые prompt templates
- @version финальный
- node --check pass/fail
- Что проверить сэру: открыть видео, накопить 30+ каналов, нажать `[🔍 Анализ паттернов]`, потом `[🕸 Перестроить кластеры]`, посмотреть hover-card
