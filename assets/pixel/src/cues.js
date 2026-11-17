// 动作踩字：镜头代码按"第几句、第几个字"取时间，不写死秒数。四种画风的模板里都有这一份（src/cues.js）。
//
// 时间从哪来，两种：
//   1. 逐字时间表（推荐）：分镜阶段用 lyric-scene-mv 的 song_timing.py 出的 逐字时间.json，
//      用 scripts/words_to_js.py 转成 src/data/words.js，每个字的时间已经对过人声起音：
//        import words from "./data/words.js";
//        const C = makeCues(words);
//   2. 只有每句的起止：timing.phrases（set_lyrics.py 写的），或者自己写的 [{ line, start, end, n }]（没有歌词文本时给字数 n）。
//      一行从开唱到唱完，前 82%（tail）的时间平均分给每个字，最后一个字常常拖长：
//        import timing from "./data/timing.js";
//        const C = makeCues(timing.phrases, { "6:6": 34.86 });   // 第 6 行第 6 个字（从 0 数）实测在 34.86 秒
//
//   const tCard = C.at(6, 6);                                // 唱到那个字的时刻（整片时间 T）
//   const jump = hit(T, tCard, { pre: 0.3, post: 0.45 });    // 0→1→0：提前 0.3 秒起势，字一出来到顶点，0.45 秒落回
//
// 不准的字写进 fix（"行号:字序" → 秒），只改这一个字，别的字不动。行号从 1 数，字序从 0 数，标点和空格不算字。

const PUNCT = /[\s,，。.!！?？、;；:：'"“”‘’()（）\[\]【】~～…·\-—]/u;

/** 把一行字拆成"唱的字"（去掉标点空格；英文单词算一个字）。 */
export function sungUnits(text = "") {
  const out = [];
  let word = "";
  for (const ch of [...text]) {
    if (/[A-Za-z0-9']/u.test(ch)) {
      word += ch;
      continue;
    }
    if (word) out.push(word), (word = "");
    if (!PUNCT.test(ch)) out.push(ch);
  }
  if (word) out.push(word);
  return out;
}

/**
 * src：逐字时间表（{ lines: [{ line, start, end, chars: [{ t }] }] }，每个字的时间直接用），
 *      或者 timing.phrases（[{ line, start, end, text }]），或者自己写的 [{ line, start, end, n }]。
 * fix：{ "行号:字序": 秒 } 手工校正。opts.tail：只有起止时间时，一行里平均分配的时间占比（默认 0.82）。
 */
export function makeCues(src, fix = {}, { tail = 0.82 } = {}) {
  const lines = new Map();
  if (src && !Array.isArray(src) && Array.isArray(src.lines)) {
    for (const L of src.lines) lines.set(L.line, { line: L.line, start: L.start, end: L.end, times: L.chars.map((c) => c.t), n: L.chars.length, sheet: true });
  }
  const phrases = Array.isArray(src) ? src : [];
  for (const p of phrases) {
    const units = p.n ? Array.from({ length: p.n }, () => "") : sungUnits(p.text);
    const L = lines.get(p.line) || { line: p.line, start: p.start, end: p.end, parts: [] };
    L.start = Math.min(L.start, p.start);
    L.end = Math.max(L.end, p.end);
    L.parts.push({ start: p.start, end: p.end, units });
    lines.set(p.line, L);
  }
  // 一行可能分成几个乐句（phrase），字按乐句各自平均分
  for (const L of lines.values()) {
    if (L.sheet) continue;
    L.times = [];
    for (const part of L.parts) {
      const n = part.units.length || 1;
      const span = (part.end - part.start) * tail;
      for (let i = 0; i < part.units.length; i++) L.times.push(part.start + (span * i) / n);
    }
    L.n = L.times.length;
  }
  const get = (line) => {
    const L = lines.get(line);
    if (!L) throw new Error(`cues：没有第 ${line} 行`);
    return L;
  };
  return {
    /** 第 line 行第 i 个字（从 0 数；负数从行尾倒数）开唱的时刻 + off */
    at(line, i = 0, off = 0) {
      const L = get(line);
      const k = i < 0 ? L.n + i : i;
      const key = `${line}:${k}`;
      if (fix[key] !== undefined) return fix[key] + off;
      return L.times[Math.max(0, Math.min(L.n - 1, k))] + off;
    },
    /** 这一行的开唱、唱完时间 */
    start: (line) => get(line).start,
    end: (line) => get(line).end,
    /** 这一行有几个字 */
    count: (line) => get(line).n,
    lines: () => [...lines.keys()].sort((a, b) => a - b),
  };
}

/** 平滑的 0→1（smoothstep） */
const ss = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * 踩在字上的一下动作：提前 pre 秒起势，正好在 tCue 到顶（=1），再用 post 秒回到 0。
 * 跳、点头、挥一下、灯闪一下、烟冒一大口，都用它。
 */
export function hit(T, tCue, { pre = 0.25, post = 0.5 } = {}) {
  if (T <= tCue) return ss(1 - (tCue - T) / pre);
  return 1 - ss((T - tCue) / post);
}

/**
 * 踩在字上、做完就停在那儿的动作：tCue - pre 开始，tCue 到位（=1），之后一直是 1。
 * 掏出卡片、抬头、转身、灯亮了不再灭，用它。
 */
export function settle(T, tCue, { pre = 0.35 } = {}) {
  return ss(1 - (tCue - T) / pre);
}

/**
 * 一个物件在几个镜头之间接力：keys = [[整片时间, 状态名], ...]，返回当前状态名和进入这个状态多久了。
 * 例：信 [[15.9, "桌上"], [16.7, "纸飞机"], [18.4, "飞出窗"], [27.9, "他的窗台"], [29.2, "展开"]]
 * 每个镜头只管画"这个状态下"的卡片，物件就不会在两镜之间凭空消失或重复。
 */
export function relay(keys, T) {
  let cur = keys[0];
  for (const k of keys) if (T >= k[0]) cur = k;
  return { state: cur[1], since: T - cur[0] };
}
