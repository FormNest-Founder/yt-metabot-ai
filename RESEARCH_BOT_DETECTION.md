# Bot Detection Research — 3 источника, 2026-05-26

## 1. Academic methods (F1-F8 implementable in JS)

### Локальные эвристики (без LLM)

| ID | Feature | Computation | Threshold |
|----|---------|-------------|-----------|
| F1 | channel_completeness_score | -1 нет аватара, -1 нет описания, -1 нет плейлистов, -1 <5 видео, -2 <6 мес возраст | score ≤ -3 = подозрение |
| F2 | comment_generic_ratio | % "огонь"/"топ"/"+1"/emoji-only/<5 слов из последних 10 комментов | >0.5 = подозрение |
| F3 | text_entropy | Shannon entropy символов комментария | avg <3.0 bits = шаблон |
| F4 | comment_interval_regularity | σ интервалов между комментариями (≥3 шт) | σ <5 мин = автопостер |
| F5 | target_overlap_jaccard | Jaccard 2 аккаунтов по сетам видео где комментили | >0.4 на ≥5 видео = кандидат в сеть |
| F6 | temporal_burst_detection | ≥5 аккаунтов в 60-сек окне на одном видео | флаг группе |
| F7 | username_entropy | entropy символов username или regex `[a-z]+\d{4,8}$` | <2.0 = generated |
| F8 | subscriber_to_video_ratio | (subs / video_count) | <50 при age >1год = аномалия |

### LLM роли (DeepSeek)
- **Semantic dedup**: парафразы текстов? (заменяет BERTScore)
- **Appraisal analysis**: extremist/evaluative без нейтральности
- **Linguistic fingerprint match**: общий стиль между двумя комментариями

### Архитектура: двухфазный pipeline
1. JS heuristics (F1-F8) фильтруют → burst_events в IDB
2. DeepSeek вызывается ТОЛЬКО для burst-кластеров ≥3 аккаунтов

### Papers
- Beskow & Carley 2020 — Russian trolls speaking Russian (MH17): https://arxiv.org/pdf/2005.06558
- PLOS ONE 2020 — 50 твитов хватает: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0236832
- Kirdemir 2022 — CIB on YouTube: https://www.researchgate.net/publication/369908435
- Shajari 2023 — YouTube commenter mobs Graph2Vec: https://arxiv.org/pdf/2311.05791
- Cinelli WWW'25 — Cross-Platform CIB 2024 US: https://arxiv.org/pdf/2410.22716
- Sharma 2025 — CIB on TikTok: https://arxiv.org/abs/2505.10867

## 2. Industry tools

| Tool | Methods | Public API | Маркеры |
|------|---------|------------|---------|
| Botometer (OSoMe) | 1000+ features, ML | Twitter X закрыт 2023 | posting bursts, friend ratio, account age |
| Bot Sentinel v3 | 95-99% F1, coordination | май 2026 запуск | Narratives clustering |
| Cyabra | 800 ML params + AI-text/img detection | enterprise | semantic fingerprinting |
| Graphika | Coordination Framework | enterprise + public reports | network science + semantic |
| BotSlayer-CE | Open source amplification tracking | OSoMe github | entity-trend graphs |
| 4CAT (SIO) | Multi-platform capture | github.com/stanfordio | modular |
| Information Laundromat | Narrative fingerprinting | Bellingcat | proxy site network |

### Топ 5 фич для MetaBot Pro
1. **Temporal burst scoring** (Graphika, Meta CIB)
2. **Cross-channel fingerprinting** (BotSlayer)
3. **Lexical clone detection** Jaccard >0.7 (YT-Spam-Purge + academia)
4. **Account metadata scoring** (BotometerLite-style)
5. **Narrative cluster tagging** vs EUvsDisinfo base

## 3. Russian-specific OSINT

### Botnet structures 2020-2026
- **IRA / Главсет / Ольгино** — ~400 операторов, 12-час смены, KPI; ликвидирована авг 2023 после Пригожина, но операции через переименованные структуры (ProPublica 2024)
- **Pravda Network** (TigerWeb, Крым) — ~190 сайтов, 83 страны, отравление LLM-корпусов (DFRLab 2024-2025)
- **Кибердружина / ЛБИ** — Telegram-бот с заданиями, система рангов "сотники"
- **AI ботофермы 2025** — СБУ ликвидировала 50000 аккаунтов; Claude используется для управления персонажами

### 10 RU-маркеров для JS

| # | Маркер | Тип | Сила |
|---|--------|-----|------|
| 1 | Лексика "иноагент"/"пятая колонна"/"денацификация"/"коллективный запад" | regex | Высокая |
| 2 | Штамп-валидатор "Молодец!"/"Правильно!"/"100%" без диалога | длина+паттерн | Средняя |
| 3 | Активность 09:00-18:00 МСК Пн-Пт, пик 09-11 и 18-20 | временной | **Высокая** |
| 4 | Реакция на видео <5 минут после публикации | временной | **Высокая** |
| 5 | Кириллица + цифровой суффикс (Ivan_1984) | username regex | Средняя |
| 6 | Идентичный комментарий на 3+ каналах за 1 час | кросс-канал | **Критическая** |
| 7 | Аккаунт <30 дней, нет non-политики | возраст+тематика | Высокая |
| 8 | Длинный copy-paste >500 chars без ответа на видео | тип контента | Средняя |
| 9 | "Специальная военная операция" vs "война" | точная фраза | Высокая |
| 10 | 0 ответов на 5+ реплеи к своему комменту | engagement gap | Высокая |

Маркеры #1, #6, #9 — наименьший false-positive для RU YouTube.

### Лексический blacklist (regex для T13 prompt)
```
пятая колонна, иноагент[ы]?, западные хозяева, пиндос[ы]?,
коллективный запад, денацификация, демилитаризация,
нацисты в Киеве, англосаксы, русофобия, либерасты?,
предатели родины, продались западу, грантоеды?
```

### Sources
- Factcheck.BY YouTube monitoring март/май 2025
- Ботнадзор (botnadzor.org) — 6.1M комментариев VK; заблокирован РКН февр 2025, расширение Chrome ещё работает
- DFRLab Pravda Network, Operation Overload
- Новая Газета Европа Дайджесты ботов 2024-2025
- ProPublica IRA продолжение 2024
- Bulletin of Atomic Scientists — Russian flood для AI 2025

## Применение в MetaBot

### Сейчас уже есть (после T1-T14 implemented)
- ✅ AI classification через DeepSeek (T7+)
- ✅ Tracked channels + auto-classify (T12)
- ✅ Pattern analysis + clustering (T13)
- ✅ Modern UI (T14)

### TODO следующие шаги (T16-T20)

**T16: Локальные эвристики F1-F8** — реализовать F1, F3, F5, F7 (быстро вычислимые) перед AI batch. Снижает API calls на 60-70%.

**T17: Russian-specific lexical detector** — regex-словарь из 10 маркеров #1, #9. Pre-AI filter — комментарии с маркерами автоматически SUSPECT.

**T18: Burst detection** — буферизировать всех виденных комментаторов в IDB, периодически (каждые N мин) запускать CIB-анализ по pairs sharing same video. T17 + burst → automatic NETWORK candidate.

**T19: Narrative tagging** — EUvsDisinfo base scraped в локальный JSON, regex-match нарративов. Кнопка в hover-card "этот нарратив фигурирует в X задокументированных операциях".

**T20: Pravda Network domain blacklist** — список из 190+ сайтов из DFRLab отчёта. Если комментарий содержит ссылку на эти домены → автоматически BOT.

### Cost-efficient cascade
```
Comment → F1+F3+F7 local (<1ms) → SUSPECT?
  ↓ NO → skip (HUMAN-like, save API)
  ↓ YES → F5+F6 cross-channel (IDB scan)
    ↓ Burst detected?
      ↓ YES → DeepSeek batch для верификации
      ↓ NO → SUSPECT-local (yellow), без AI
```

Это даст: 80% покрытие BOT/SUSPECT при ~20% AI calls vs current "all to AI".
