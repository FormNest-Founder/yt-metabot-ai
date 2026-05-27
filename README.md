# MetaBot · AI Bot Detection для YouTube

> Userscript для выявления ботов, новорегов и координированных сетей в комментариях YouTube. Гибридная классификация: **DeepSeek AI** + локальные эвристики + публичные базы (Ботнадзор, EUvsDisinfo, DFRLab).

Форк [asrdri/yt-metabot-user-js](https://github.com/asrdri/yt-metabot-user-js) (база ЕРКЮ заброшена с 2021), обновлённый под YouTube DOM 2026 и расширенный AI-pipeline'ом.

---

## Быстрый старт

1. Установить [Violentmonkey](https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag) (или Tampermonkey, но первый стабильнее на MV3).
2. Перейти на raw файл userscript'а — Violentmonkey предложит установку:
   ```
   https://github.com/FormNest-Founder/yt-metabot-ai/raw/main/yt-metabot.user.js
   ```
3. В `vivaldi://extensions` или `chrome://extensions` → Violentmonkey → **Site access: «На всех сайтах»**.
4. Открыть любое видео YouTube → кликнуть **🔧** возле заголовка комментариев.
5. Ввести **DeepSeek API key** (получить на [platform.deepseek.com](https://platform.deepseek.com/api_keys)) → Tab.
6. Нажать **🤖 Классифицировать** — через 5-10 сек комментаторы получат badge-метки.

---

## Что делает

| Метка | Цвет | Условие |
|-------|------|---------|
| **🤖 БОТ** | красный | AI label = BOT (confidence ≥ 70%) ИЛИ в базе ЕРКЮ |
| **🕸 СЕТЬ** | фиолетовый | Канал в выявленном кластере ботосети |
| **🆕 НОВОРЕГ** | оранжевый | Зарегистрирован менее 7 дней до публикации видео |
| **⚠️ ПОДОЗР** | жёлтый | Признаки бота, но низкая уверенность |
| **✓ ЧЕЛОВЕК** | зелёный | Органическое поведение |
| **? UNK** | серый | Ещё не классифицирован |

Дополнительные маркеры на бейдже:
- **👤** — статус установлен вручную (ваш override побеждает AI)
- **🧮** — статус из локальной эвристики (без AI calls)

При наведении на **ⓘ** рядом с бейджем — popover с объяснением "почему такой статус" + 6 кнопок ручной смены статуса.

---

## Pipeline

```
YouTube комментарии
    │
    ▼
[Collector] — извлекает channelId, joinDate, subs, videoCount, текст
    │
    ▼
[IndexedDB: channels, comments, clf_queue, analysis_queue, networks]
    │
    ▼
┌─────────────┴─────────────────────────────────┐
│                                               │
▼ (быстро, бесплатно)                          ▼ (DeepSeek API)
[Локальные эвристики F1-F4, F7]               [🤖 Классифицировать]
- Shannon entropy текста                       - LLM смотрит samples + meta
- Generic-фразы regex                          - returns {label, confidence,
- RU bot lexicon (15 regex)                      reasoning}
- Interval regularity                          
- Auto-generated handles                       
│                                               │
▼                                               ▼
heuristic_label: BOT/SUSPECT/HUMAN             label: BOT/SUSPECT/HUMAN/UNKNOWN
(score ≥80 + ≥2 signals = BOT)                 
│                                               │
└─────────────┬─────────────────────────────────┘
              ▼
          [applyBadge: priority user > heuristic > AI > UNKNOWN]
              │
              ▼
[Auto-enqueue не-HUMAN в analysis_queue]
              │
              ▼ (DeepSeek API, второй раз)
       [🔍 Анализ паттернов]
- themes (politics_russia, ...)
- targets (Putin/Navalny/Kac/...)
- network_signals (pro-kremlin, anti-opposition, ...)
              │
              ▼
       [🕸 Кластеризовать] — локально, без AI
- Euclidean distance между network_signals
- Union-find для кластеров
              │
              ▼
       networks store + бейдж 🕸 СЕТЬ
```

---

## Возможности

### Базовая классификация
- **DeepSeek V4 Flash** — `deepseek-chat`, JSON mode, ~$0.002/batch, ~$3/мес при 30K каналов
- Batches до 20 каналов за вызов
- Кеш в IndexedDB → повторные encountering моментально

### Channel tracking
- Кнопка **[👁 Отслеживать]** под автором видео
- Tracked-каналы получают **auto-classify** при просмотре их видео (через 30 сек, throttle 5 мин/канал)
- Список tracked в settings panel с ✕ для удаления

### Анализ паттернов (T13)
DeepSeek анализирует:
- **themes** — politics_russia / politics_world / entertainment / music / gaming / education
- **targets** — Putin, Navalny, Kac, Soloviev, Pevchikh, Zelensky, RF_government, Opposition, Ukraine, USA, EU; pro/anti scores
- **network_signals** — pro_kremlin_score, anti_opposition_score, whataboutism_score, personal_attack_score, repetition_score, quality_score

### Кластеризация ботосеток
Локально (без AI):
- Euclidean distance между `network_signals` всех каналов
- Union-find группировка с порогом 30
- Кластеры ≥3 членов получают имя (PRO-KREMLIN / PRO-OPPOSITION / ...) и записываются в `networks` store

### Manual override
При несогласии с AI/эвристикой — hover на **ⓘ** → клик одной из 6 кнопок-меток → ваш статус сохраняется в IDB и **побеждает все автоматические**. Маркер **👤** показывает override.

### Локальные эвристики (T17)
Снижают зависимость от AI API:
- **F1** channel_completeness — только при комбо <30 дней + 0 subs + 0 видео
- **F2** generic_ratio — % шаблонных фраз (≥5 комментов от канала)
- **F3** text_entropy — Shannon entropy < 2.5 = шаблон (≥5 длинных комментов)
- **F4** interval_regularity — σ интервалов < 60s = автопостер
- **F7** username_pattern — `EnglishWord+\d{6,}` = генерированный handle
- **RU lexicon** — 15 regex ("иноагент", "пятая колонна", "денацификация", "СВО", ...); ≥3 hits = strong

Verdict CONSERVATIVE: **BOT требует score ≥80 И ≥2 разных сигнала**. Single-сигнал каналы → нужен AI.

---

## Архитектура

### IndexedDB schema (v3)

```
metabot_db
├── channels (keyPath: channelId)
│   {channelId, handle, displayName, joinDate, subscriberCount, videoCount,
│    label, confidence, reasoning, classifiedAt,
│    heuristic_label, heuristic_score, heuristic_signals, heuristic_at,
│    user_label, user_label_at,
│    themes, targets, network_signals, analysisSummary, aiAnalysisAt,
│    network_cluster_id, lastSeen}
│
├── comments (autoIncrement, index by-channel)
│   {channelId, videoId, text, timestamp, isReply}
│
├── clf_queue (keyPath: channelId)
│   {channelId, addedAt, attempts}
│
├── analysis_queue (keyPath: channelId)
│   {channelId, addedAt, attempts}
│
├── tracked_channels (keyPath: channelId)
│   {channelId, displayName, addedAt}
│
└── networks (keyPath: clusterId)
    {clusterId, name, description, signature, members[], detectedAt}
```

### Priority в applyBadge

1. `user_label` — ручной override (👤 маркер) — НАИВЫСШИЙ
2. `heuristic_label` — локальная эвристика (🧮 маркер) если AI ещё нет
3. AI `label` — из DeepSeek
4. ERKY база — отдельная проверка для известных ботов
5. `network_cluster_id` — добавляет 🕸 СЕТЬ
6. `joinDate` vs videoPublishDate — добавляет 🆕 НОВОРЕГ
7. UNKNOWN — fallback

---

## Базы и источники

### Активные публичные данные

| Источник | Тип | Использование |
|----------|-----|---------------|
| [Ботнадзор](https://botnadzor.org) | RU база (6.1M комментариев VK) | Reference, regex словарь |
| [EUvsDisinfo](https://euvsdisinfo.eu) | EU EEAS дезинфо-нарративы | Reference |
| [Factcheck.BY](https://factcheck.by) | Мониторинг YouTube RU/BY | Methodology |
| [DFRLab](https://dfrlab.org) | Pravda Network, Operation Overload | Domain blacklist (планируется) |
| [НГ Европа](https://novayagazeta.eu) | Расследования ботов 2024-2025 | Reference |

### Заброшенные базы (исторически)

- [ЕРКЮ KB.CSV](https://github.com/FeignedAccomplice/YOUTUBOTS) — ~5949 UC IDs, последний коммит 2021
- [YT-ACC-DB](https://github.com/YTObserver/YT-ACC-DB) — mainDB + political + smm, последний 2019

Эти базы загружаются как `arrayERKY` для совместимости с оригинальным MetaBot — кому-то полезно.

### Академическая база

- [Beskow & Carley 2020](https://arxiv.org/pdf/2005.06558) — Russian trolls (MH17)
- [Kirdemir et al. 2022](https://www.researchgate.net/publication/369908435) — CIB on YouTube
- [Shajari et al. 2023](https://arxiv.org/pdf/2311.05791) — YouTube commenter mob detection (Graph2Vec)
- [Cinelli WWW'25](https://arxiv.org/pdf/2410.22716) — Cross-Platform CIB (US 2024)
- [Sharma 2025](https://arxiv.org/abs/2505.10867) — CIB на TikTok

Подробный research-brief: [RESEARCH_BOT_DETECTION.md](./RESEARCH_BOT_DETECTION.md).

---

## Стоимость

DeepSeek deepseek-chat:
- Input: $0.27 / 1M токенов
- Output: $1.10 / 1M токенов
- Один batch (20 каналов с 5 sample комментариев) — ~$0.002

| Сценарий | Batches/день | Каналов/мес | Цена/мес |
|----------|--------------|-------------|----------|
| Лёгкий | 12 (раз в 2ч) | 7K | **$0.72** |
| Средний | 48 (раз в 30 мин) | 30K | **$2.88** |
| Интенсивный | 144 (раз в 10 мин) | 86K | **$8.64** |

Анализ паттернов (отдельные batches) — ~5x дороже classify, но требуется реже.

---

## Известные ограничения

- **Tampermonkey 5.5.0** имеет проблемы с MV3 service worker в современных Chromium-based браузерах (Vivaldi). Используйте **Violentmonkey** — fork стабильнее.
- **YouTube DOM хрупкий** — на каналах с overlay-tooltip ссылка автора может быть `javascript:void(0)`, тогда channelId извлекается из ytInitialData regex (fallback в коде есть).
- **DeepSeek может галлюцинировать** на политически нагруженных комментариях. Используйте ручной override.
- **Бот-базы устарели** — ERKY с 2021. Реальная защита — AI classification + heuristics + накопление локальной базы через `tracked_channels`.
- **VM isolated context** — `indexedDB.open('metabot_db')` из main world DevTools console может не видеть store; нужно работать через `unsafeWindow` или через сам userscript.

---

## Roadmap

- **T18** — Temporal burst detection (≥5 каналов в 60s окне на одном видео = координация)
- **T19** — Narrative tagging vs EUvsDisinfo база (regex match нарративов)
- **T20** — Pravda Network domain blacklist (~190 доменов, ссылки в комментариях → red flag)
- **Sharing DB** — экспорт/импорт верифицированных каналов в JSON для community

---

## Структура проекта

```
yt-metabot-ai/
├── yt-metabot.user.js              — основной userscript (~148KB)
├── yt-metabot.meta.js              — metadata для @updateURL
├── trustedtypes-shim.js            — @require ДО jQuery для CSP-bypass
├── README.md                       — этот файл
├── UPSTREAM_README.md              — оригинальный README MetaBot
├── RESEARCH_BOT_DETECTION.md       — research brief (3 источника)
├── LICENSE.md                      — MIT (наследуется от upstream)
├── logo.png, nospam.png            — ассеты
├── list-sample.txt                 — пример формата custom-списка ботов
└── IMPLEMENTATION_PROMPT_T*.md     — история разработки (T7+ через T17)
```

---

## Версия

Текущая: **v230501** — `node --check` PASS.

История версий доступна через `git log --oneline -- yt-metabot.user.js`.

---

## Credits

- **asrdri** — оригинальный [yt-metabot-user-js](https://github.com/asrdri/yt-metabot-user-js)
- **Сообщество «Наблюдатели»** — методология ЕРКЮ
- **FeignedAccomplice/YOUTUBOTS** — оригинальная база
- **Ботнадзор team** — активный inspector для VK + методология
- **DeepSeek** — экономичный LLM API для классификации

---

## License

MIT (наследуется от upstream MetaBot). См. [LICENSE.md](./LICENSE.md).
