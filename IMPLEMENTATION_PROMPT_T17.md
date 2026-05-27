# T17 — Local heuristics (F1-F8) + RU markers cascade

## Контекст
`/home/admin/Projects/yt-metabot/yt-metabot.user.js` (v230408, ~128KB).

Сейчас pipeline:
1. Collector → channels + comments в IDB
2. Все каналы → clf_queue
3. 🤖 Классифицировать → DeepSeek API → label
4. 🔍 Анализ паттернов → DeepSeek → network_signals
5. 🕸 Кластеризовать → networks

DeepSeek API дорогой и медленный. Нужны **локальные cheap эвристики** которые fillter обвиозных HUMAN до AI и автоматически помечают обвиозных BOT.

## Цель

Снизить DeepSeek API calls на 60-70% через cascade:
```
Комментарий → F1-F8 локально → SUSPECT?
  ↓ NO → label = HUMAN_HEURISTIC (skip AI, save tokens)
  ↓ YES → label = BOT_HEURISTIC (skip AI for obvious bots)
  ↓ MAYBE → clf_queue → AI
```

## F1-F8 эвристики (из RESEARCH_BOT_DETECTION.md)

| F# | Признак | Computation | Threshold |
|----|---------|-------------|-----------|
| F1 | channel_completeness | -1 нет видео, -1 <100 подписчиков, -2 <30 дней | score ≤ -3 |
| F2 | generic_ratio | % шаблонных фраз из last 10 comments | >0.5 |
| F3 | text_entropy | Shannon entropy avg по символам | <3.0 bits |
| F4 | interval_regularity | σ интервалов между ≥3 комментами | σ <300сек (5мин) |
| F5 | target_overlap | (other ch в IDB) Jaccard по videoIds | >0.4 на ≥5 |
| F6 | temporal_burst | ≥5 каналов в 60s окне same video | флаг группе |
| F7 | username_entropy | Shannon entropy username chars | <2.0 |
| F8 | subs_video_ratio | subscriberCount / videoCount при age >1год | <50 |

## RU маркеры (regex словарь)

```javascript
var RU_BOT_LEXICON = [
  /\bинoагент(ы|ах|ами|ов|у)?\b/i,
  /\bпят[ао]я колонна\b/i,
  /\bденацификаци\w+/i,
  /\bколлективн\w+ запад\w*/i,
  /\bпиндос\w+/i,
  /\bнацист\w+ в Киеве/i,
  /\bангл[оа]сакс\w+/i,
  /\bру[сс]?офоб\w+/i,
  /\bлибераст\w+/i,
  /\bпредател\w+ родин\w+/i,
  /\bпрод[аы]лись (запад\w*|америк)/i,
  /\bгрант[оа]ед\w*/i,
  /\bспециальн\w+ военн\w+ операци\w+/i,  // SVO
  /\bбандеровц\w+/i,
  /\bнав[оа]льнен\w+/i
];

var RU_GENERIC_PATTERNS = [
  /^(молодец[!.,]?\s*)+$/i,
  /^(правильно[!.,]?\s*)+$/i,
  /^(согласен полностью[!.,]?\s*)+$/i,
  /^(100[%!]?\s*)+$/i,
  /^(\+1[!.,]?\s*)+$/i,
  /^(огонь[!.,]?\s*)+$/i,
  /^(топ[!.,]?\s*)+$/i,
  /^([\u{1F600}-\u{1F64F}]+\s*)+$/u  // только emoji
];
```

## Реализация

### 1. Новый модуль `mbHeuristics`

После `mbdb.*` объявить:
```javascript
var mbHeuristics = {};

mbHeuristics.shannonEntropy = function(str) {
  if (!str || str.length === 0) return 0;
  var freq = {};
  for (var i = 0; i < str.length; i++) {
    freq[str[i]] = (freq[str[i]] || 0) + 1;
  }
  var e = 0;
  var n = str.length;
  for (var k in freq) {
    var p = freq[k] / n;
    e -= p * Math.log2(p);
  }
  return e;
};

mbHeuristics.isGeneric = function(text) {
  if (!text) return false;
  var t = text.trim();
  if (t.length < 5) return true;
  for (var i = 0; i < RU_GENERIC_PATTERNS.length; i++) {
    if (RU_GENERIC_PATTERNS[i].test(t)) return true;
  }
  return false;
};

mbHeuristics.hasRuBotLexicon = function(text) {
  if (!text) return 0;
  var count = 0;
  for (var i = 0; i < RU_BOT_LEXICON.length; i++) {
    if (RU_BOT_LEXICON[i].test(text)) count++;
  }
  return count;
};

mbHeuristics.compute = async function(channel, comments) {
  comments = comments || [];
  var signals = [];
  var score = 0;
  
  // F1: completeness
  var compScore = 0;
  if (!channel.videoCount || channel.videoCount === 0) compScore -= 1;
  if (!channel.subscriberCount || channel.subscriberCount < 100) compScore -= 1;
  if (channel.joinDate) {
    var ageDays = (Date.now() - new Date(channel.joinDate).getTime()) / 86400000;
    if (ageDays < 30) compScore -= 2;
  }
  if (compScore <= -3) { signals.push('F1:young_minimal_channel'); score += 30; }
  
  // F2: generic ratio
  if (comments.length >= 3) {
    var generic = comments.filter(function(c){ return mbHeuristics.isGeneric(c.text); }).length;
    var ratio = generic / comments.length;
    if (ratio > 0.5) { signals.push('F2:high_generic_ratio:' + ratio.toFixed(2)); score += 25; }
  }
  
  // F3: text entropy
  if (comments.length >= 3) {
    var totalEntropy = 0;
    var n = 0;
    for (var i = 0; i < comments.length; i++) {
      if (comments[i].text && comments[i].text.length >= 10) {
        totalEntropy += mbHeuristics.shannonEntropy(comments[i].text);
        n++;
      }
    }
    if (n > 0) {
      var avgEntropy = totalEntropy / n;
      if (avgEntropy < 3.0) { signals.push('F3:low_entropy:' + avgEntropy.toFixed(2)); score += 20; }
    }
  }
  
  // F4: interval regularity
  if (comments.length >= 3) {
    var sorted = comments.slice().sort(function(a,b){ return a.timestamp - b.timestamp; });
    var intervals = [];
    for (var j = 1; j < sorted.length; j++) {
      intervals.push((sorted[j].timestamp - sorted[j-1].timestamp) / 1000);
    }
    var mean = intervals.reduce(function(s,x){ return s+x; }, 0) / intervals.length;
    var variance = intervals.reduce(function(s,x){ return s + (x-mean)*(x-mean); }, 0) / intervals.length;
    var stdDev = Math.sqrt(variance);
    if (stdDev < 300) { signals.push('F4:regular_intervals:' + stdDev.toFixed(0)); score += 25; }
  }
  
  // F7: username entropy
  if (channel.handle || channel.channelId) {
    var u = (channel.handle || '').replace(/^@/, '') || channel.channelId.replace(/^UC/, '');
    var uEnt = mbHeuristics.shannonEntropy(u);
    // Also check cyrillic_NNNN pattern
    if (/[а-я]+_?\d{3,}/i.test(u) || /^[a-z]+\d{4,8}$/i.test(u)) {
      signals.push('F7:bot_username_pattern');
      score += 15;
    }
    if (uEnt < 2.0) { signals.push('F7:low_username_entropy:' + uEnt.toFixed(2)); score += 10; }
  }
  
  // F8: subs/video ratio
  if (channel.subscriberCount > 0 && channel.videoCount > 0 && channel.joinDate) {
    var ageDays8 = (Date.now() - new Date(channel.joinDate).getTime()) / 86400000;
    if (ageDays8 > 365) {
      var ratio8 = channel.subscriberCount / channel.videoCount;
      if (ratio8 < 50) { signals.push('F8:low_subs_video_ratio:' + ratio8.toFixed(1)); score += 10; }
    }
  }
  
  // RU lexicon
  if (comments.length > 0) {
    var lexHits = 0;
    for (var k = 0; k < comments.length; k++) {
      lexHits += mbHeuristics.hasRuBotLexicon(comments[k].text);
    }
    if (lexHits >= 2) { signals.push('RU:bot_lexicon_hits:' + lexHits); score += 30; }
  }
  
  return {
    score: score,
    signals: signals,
    verdict: score >= 50 ? 'BOT_HEURISTIC' : (score >= 25 ? 'SUSPECT_HEURISTIC' : (score === 0 ? 'HUMAN_HEURISTIC' : null))
  };
};
```

### 2. Интеграция в collector (parseitemNew)

После get channel из IDB — ВЫЧИСЛИТЬ heuristics и применить:

В collector hook найди:
```javascript
var channel = await mbdb.getChannel(userID);
// ALWAYS apply badge — even for unknown channels show UNKNOWN/NEW_REG.
var channelData = channel || { channelId: userID, label: null };
applyBadge(jNode, channelData);
```

Добавь ПОСЛЕ:
```javascript
// Local heuristics — run if no AI label yet
if (channel && !channel.label && !channel.user_label) {
  try {
    var allComments = await mbdb.getComments(userID, 20);
    var heur = await mbHeuristics.compute(channel, allComments);
    if (heur.verdict) {
      // Store heuristic verdict separate from AI label
      await mbdb.upsertChannel({
        channelId: userID,
        heuristic_label: heur.verdict,
        heuristic_score: heur.score,
        heuristic_signals: heur.signals,
        heuristic_at: Date.now()
      });
      // Re-render badge with new info
      var updatedChannel = await mbdb.getChannel(userID);
      if (updatedChannel) applyBadge(jNode, updatedChannel);
    }
  } catch (e) { console.warn('[MetaBot Heur] failed:', e.message); }
}
```

### 3. applyBadge поддерживает heuristic_label

В applyBadge — учитывать `heuristic_label` ПОСЛЕ user_label но ПЕРЕД AI label:

```javascript
if (channel.user_label) {
  states.push(channel.user_label);
} else if (channel.heuristic_label && !channel.label) {
  // Heuristic verdict (when no AI label yet)
  if (channel.heuristic_label === 'BOT_HEURISTIC') states.push('BOT');
  else if (channel.heuristic_label === 'SUSPECT_HEURISTIC') states.push('SUSPECT');
  else if (channel.heuristic_label === 'HUMAN_HEURISTIC') states.push('HUMAN');
} else {
  // existing AI/legacy logic
  ...existing...
}
```

Также — добавить маркер `🧮` (или `⚙️`) рядом с pill если статус из heuristics. Аналогично 👤 для user override:
```javascript
if (channel.heuristic_label && !channel.label && !channel.user_label) {
  var heurMark = document.createElement('span');
  heurMark.textContent = '🧮';
  heurMark.title = 'Локальная эвристика (без AI): score ' + (channel.heuristic_score || 0);
  heurMark.style.cssText = 'margin-left:4px;font-size:10px;opacity:0.7';
  container.appendChild(heurMark);
}
```

### 4. buildExplanation — поддержка heuristic

В `buildExplanation` (popover content) — добавь branch для heuristic verdict:

```javascript
if (channel.heuristic_signals && channel.heuristic_signals.length > 0) {
  parts.push('Эвристика (score ' + (channel.heuristic_score || 0) + '): ' + channel.heuristic_signals.join(', '));
}
```

### 5. Запретить heuristic_label override через AI

В `mbdb.applyClassification` — после AI classify запись в IDB должна **очистить** heuristic_label (теперь актуальный AI label):
```javascript
ch.label = label;
ch.confidence = confidence;
ch.reasoning = reasoning;
ch.heuristic_label = null;  // AI overrides heuristic
ch.lastSeen = Date.now();
```

### 6. Bump @version: 230408 → 230500

(major patch — новая логика классификации)

## Verify

```bash
grep -c "mbHeuristics\.\|heuristic_label\|RU_BOT_LEXICON" /home/admin/Projects/yt-metabot/yt-metabot.user.js
# Должно быть ≥6
```

```bash
node --check /home/admin/Projects/yt-metabot/yt-metabot.user.js
# PASS
```

## Отчёт

- @version final (230500)
- node --check pass/fail
- Список добавленных функций (mbHeuristics.*, RU_BOT_LEXICON, RU_GENERIC_PATTERNS)
- Что сэр должен увидеть: на комментариях БЕЗ запуска 🤖 — могут появиться зеленые HUMAN или красные BOT badges с маркером 🧮 (heuristic) и popover показывает "Эвристика (score N): F2:high_generic_ratio, F3:low_entropy, ..."

## НЕ делать

- Не сейчас: F5 target_overlap_jaccard, F6 temporal_burst — требуют межканальной IDB-агрегации, отдельный T18
- Не сейчас: full data pipeline для tracked channels — это T19+
