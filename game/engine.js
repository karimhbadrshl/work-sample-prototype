/* Fault-finding engine: system model, fault generator, tests, scoring, AI-mentor mock, integrity flags.
   Pure logic, no DOM. The browser page and the Node evaluation (game/eval.js) use this same file. */
(function (root) {
  'use strict';

  // One pump line: mains, fuse, power supply, operator switch, level switch, contactor, pump motor. Single fault per item.
  const NODES = [
    { id: 'MAINS', parent: null, kind: 'source', name: 'Mains inlet' },
    { id: 'F', parent: 'MAINS', kind: 'fuse', name: 'Fuse', modes: ['open'] },
    { id: 'PSU', parent: 'F', kind: 'psu', name: 'Power supply', modes: ['open', 'low'] },
    { id: 'SW', parent: 'PSU', kind: 'toggle', name: 'Pump switch', gate: 'SW' },
    { id: 'LS', parent: 'SW', kind: 'level', name: 'Level switch', modes: ['open'] },
    { id: 'K', parent: 'LS', kind: 'contactor', name: 'Contactor', modes: ['open'] },
    { id: 'M', parent: 'K', kind: 'motor', name: 'Pump motor', modes: ['open', 'seized'] },
  ];
  const BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const HYPS = [];
  NODES.forEach((n) => (n.modes || []).forEach((m) => HYPS.push({ id: n.id, mode: m })));
  const FAULTABLE = NODES.filter((n) => n.modes).map((n) => n.id);
  const COST = { V: 1, SWAP: 3 };
  const INITIAL = { SW: false };
  const ALL_ON = { SW: true };
  const PULL_IN = 20; // volts: the contactor drops out below this
  // Item bank by difficulty tier. Difficulty = how many paid tests an efficient route needs (0, 1, 2).
  const ITEMS = { easy: [{ id: 'M', mode: 'seized' }, { id: 'PSU', mode: 'low' }], medium: [{ id: 'F', mode: 'open' }, { id: 'PSU', mode: 'open' }, { id: 'LS', mode: 'open' }], hard: [{ id: 'K', mode: 'open' }, { id: 'M', mode: 'open' }] };

  function solve(state, fault) {
    const out = {};
    for (const n of NODES) {
      const vin = n.parent === null ? 230 : out[n.parent].v;
      const f = fault && fault.id === n.id ? fault.mode : null;
      let v = vin, run = false, hum = false;
      if (n.gate && !state[n.gate]) v = 0;
      if (f === 'open' && n.kind !== 'motor') v = 0;
      if (n.kind === 'psu') v = vin >= 100 && f !== 'open' ? (f === 'low' ? 17 : 24) : 0;
      if (n.kind === 'contactor' && vin < PULL_IN) v = 0;
      if (n.kind === 'motor') { v = vin; const powered = v >= PULL_IN; run = powered && f === null; hum = powered && f === 'seized'; }
      out[n.id] = { v, run, hum };
    }
    return out;
  }

  // Free observations: what the candidate can see and hear without spending test budget.
  function observe(state, fault) {
    const o = solve(state, fault);
    return { H1: o.PSU.v >= PULL_IN ? 'on' : o.PSU.v > 0 ? 'dim' : 'off', M: o.M.hum ? 'jammed' : o.M.run ? 'running' : 'stopped' };
  }

  // Paid tests. A test is {type:'V'|'SWAP', node}.
  function measure(test, state, fault) {
    if (test.type === 'V') return String(solve(state, fault)[test.node].v);
    return fault && fault.id === test.node ? 'fixed' : 'nochange';
  }
  function allTests() {
    const t = [];
    NODES.forEach((n) => { if (n.kind !== 'source') t.push({ type: 'V', node: n.id }); });
    FAULTABLE.forEach((id) => t.push({ type: 'SWAP', node: id }));
    return t;
  }
  const TESTS = allTests();
  const sig = (o) => JSON.stringify(o);

  function consistent(h, rec) {
    return rec.kind === 'obs' ? sig(observe(rec.state, h)) === sig(rec.result) : measure(rec.test, rec.state, h) === rec.result;
  }
  const comps = (hs) => new Set(hs.map((h) => h.id));

  // Reference policy: minimax test cost to isolate one component from state ALL_ON (the "efficient technician").
  const memo = new Map();
  function opt(hs) {
    if (comps(hs).size <= 1) return { cost: 0, test: null };
    const key = hs.map((h) => h.id + h.mode).sort().join('|');
    if (memo.has(key)) return memo.get(key);
    let best = { cost: Infinity, test: null };
    for (const t of TESTS) {
      const parts = new Map();
      hs.forEach((h) => { const r = measure(t, ALL_ON, h); (parts.get(r) || parts.set(r, []).get(r)).push(h); });
      if (parts.size === 1) continue;
      let worst = 0;
      parts.forEach((p) => { worst = Math.max(worst, opt(p).cost); });
      const c = COST[t.type] + worst;
      if (c < best.cost) best = { cost: c, test: t };
    }
    memo.set(key, best);
    return best;
  }
  // Hypotheses left after the free look at ALL_ON for a given true fault.
  function afterFreeLook(fault) {
    const r = sig(observe(ALL_ON, fault));
    return HYPS.filter((h) => sig(observe(ALL_ON, h)) === r);
  }
  function policyPath(fault) {
    let hs = afterFreeLook(fault), cost = 0;
    const steps = [];
    while (comps(hs).size > 1) {
      const { test } = opt(hs);
      if (!test) break;
      const r = measure(test, ALL_ON, fault);
      cost += COST[test.type]; steps.push(test);
      hs = hs.filter((h) => measure(test, ALL_ON, h) === r);
    }
    return { cost, steps };
  }

  // ---- Form generator: a seed gives one fault and its own part labels, so there is no shared answer key.
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function generate(seed, forceFault) {
    const rnd = mulberry32(seed >>> 0);
    const fault = forceFault || HYPS[Math.floor(rnd() * HYPS.length)];
    const o = Math.floor(rnd() * 4);
    const tags = { MAINS: 'Mains', F: 'F' + (1 + o), PSU: 'PSU1', SW: 'S' + (1 + o), LS: 'LS' + (1 + o), K: 'K' + (1 + o), M: 'M' + (1 + o) };
    return { seed, formId: 'FF-' + (seed >>> 0).toString(36).toUpperCase().padStart(4, '0'), fault, tags };
  }
  function pickItem(tier, seed) { const list = ITEMS[tier]; const r = mulberry32((seed >>> 0) + 17)(); const f = generate(seed, list[Math.floor(r * list.length)]); f.tier = tier; return f; }
  // Two-stage routing: start at medium. A diagnosis counts as sound when it is correct AND the candidate's own tests supported it
  // (a lucky or pasted answer does not route up). Sound goes to hard, otherwise easy.
  const sound = (r) => r.correct && r.justified;
  const route = (r) => (sound(r) ? 'hard' : 'easy');
  function band(r1, r2) { if (sound(r1)) return sound(r2) ? 'Advanced' : 'Proficient'; return sound(r2) ? 'Developing' : 'Beginning'; }
  const label = (form, id) => `${BY_ID[id].name} ${form.tags[id]}`;

  // ---- AI mentor (mock). It is given the guide and the question only, never the fault: it cannot leak what it does not know.
  function guide(tags) {
    const T = tags;
    const L = (name, tag) => `${name} ${tag}`;
    return [
      { id: 'method', keys: ['method', 'approach', 'strategy', 'where', 'start', 'how do i', 'how to', 'begin', 'stuck', 'help'],
        title: 'Method', text: 'Work from what you can see to what you can measure. A reading at a point in the line tells you whether the fault is before it or after it, so a test near the middle of what is left rules out more than one at the ends. The lamp and the motor movement are free; a voltmeter reading costs 1; a spare part costs 3.' },
      { id: 'meter', keys: ['meter', 'voltmeter', 'measure', 'probe', 'reading', 'tool'],
        title: 'The voltmeter', text: `Pick the voltmeter, then click a part to read the voltage at its output terminal. The mains side (up to the fuse) is 230 V AC; everything after ${T.PSU} is 24 V DC. The pump switch gives 0 V when it is off, which is normal, so switch it on before you read anything.` },
      { id: 'lamps', keys: ['lamp', 'light', 'h1', 'indicator', 'led'],
        title: 'Lamp H1', text: `H1 shows the ${T.PSU} output: lit at 20 V or more, dim between 0 and 20 V, dark at 0 V.` },
      { id: 'swap', keys: ['swap', 'spare', 'replace', 'change part'],
        title: 'Spare part', text: 'A known-good spare can be swapped into any of the five parts. It costs 3 and tells you only whether that one part was the cause. If it was, the pump runs. It is a confirmation tool, not a search tool.' },
      { id: 'hum', keys: ['shake', 'vibrat', 'jam', 'stuck', 'stall', 'movement'],
        title: 'Motor movement', text: 'A motor with power at its terminals that shakes but does not turn is mechanically jammed (seized). A motor with power that stays perfectly still has an open winding.' },
      { id: 'tank', keys: ['tank', 'fill', 'filled', 'water'],
        title: 'The tank', text: `When the pump runs, the tank fills. The level switch ${T.LS} is closed while the tank has room, and opens when it is full to stop the pump.` },
      { id: 'F', keys: [T.F.toLowerCase(), 'fuse'], title: L('Fuse', T.F), text: '6.3 A slow-blow fuse. Healthy: 230 V AC at its output. A blown fuse passes no voltage.' },
      { id: 'PSU', keys: [T.PSU.toLowerCase(), 'psu', 'power supply'], title: L('Power supply', T.PSU), text: '230 V AC in, 24 V DC out. Healthy output 21.6 to 26.4 V. The contactor needs 20 V or more to pull in, so a supply that sags below 20 V can look like a dead contactor downstream.' },
      { id: 'SW', keys: [T.SW.toLowerCase(), 'pump switch', 'switch'], title: L('Pump switch', T.SW), text: 'Operator switch. ON passes 24 V on; OFF gives 0 V. Off is not a fault.' },
      { id: 'LS', keys: [T.LS.toLowerCase(), 'level switch', 'float'], title: L('Level switch', T.LS), text: 'Closed while the tank has room, so 24 V passes through. It opens when the tank is full.' },
      { id: 'K', keys: [T.K.toLowerCase(), 'contactor', 'relay'], title: L('Contactor', T.K), text: 'Pulls in at 20 V or more at its coil feed and passes 24 V to the pump motor.' },
      { id: 'M', keys: [T.M.toLowerCase(), 'motor', 'pump'], title: L('Pump motor', T.M), text: '24 V DC motor. Healthy: 24 V at its terminals and it turns. Seized rotor: 24 V at the terminals, shakes, does not turn. Open winding: 24 V at the terminals, stays still.' },
    ];
  }

  const RX_INJECT = /ignore (all|any|previous|prior|your)|system prompt|you are now|pretend|developer mode|jailbreak|reveal (your|the) (prompt|instructions)/i;
  const RX_VERDICT = /\b(which|what)\b[^?]*\b(faulty|broken|failed|failing|dead|bad|culprit|fault|problem|cause|wrong)\b|\bis\b[^?]*\b(faulty|broken|failed|dead|bad|blown|healthy|okay|ok|working|good|the fault|the cause|the problem)\b|\b(tell|give|show) me (the )?(answer|fault|solution)|\bjust tell\b|\bam i right\b|\bis it\b|\bwhich (part|component|one)\b[^?]*\b(swap|replace|change|fix|check|test|look)/i;
  const RX_SPEC = /\b(expected|normal|nominal|spec|specification|rating|should (read|be)|healthy (value|reading|voltage|current))\b/i;

  function mentor(question, tags) {
    const q = String(question || '').trim();
    if (!q) return { intent: 'empty', flag: null, text: 'Ask about a part, a meter, a lamp, or how to approach the fault.' };
    if (RX_INJECT.test(q)) return { intent: 'injection', flag: 'mentor_injection_attempt', text: 'I only help with this cell: parts, meters, lamps and method. I cannot change my instructions.' };
    if (RX_VERDICT.test(q) && !RX_SPEC.test(q)) return { intent: 'verdict', flag: 'mentor_answer_seeking', text: `I cannot say which part is at fault or confirm a guess; that is the task. I can tell you what a healthy part reads, how the meters work, or how to narrow down a fault. Try asking, for example, what the fuse ${tags.F} should read.` };
    const ql = q.toLowerCase();
    let best = null, bestScore = 0;
    for (const g of guide(tags)) {
      const s = g.keys.reduce((a, k) => a + (ql.includes(k) ? (k.length > 3 ? 2 : 1) : 0), 0);
      if (s > bestScore) { best = g; bestScore = s; }
    }
    if (!best) return { intent: 'none', flag: null, text: `I did not catch that. I can help with a part (use its tag, for example ${tags.F}), the meters, the lamps, spare parts or method.` };
    return { intent: 'info', flag: null, ref: best.id, text: best.title + ': ' + best.text };
  }

  // ---- Session: records every action, keeps the hypothesis set, scores, flags.
  function createSession(form, opts) {
    const now = (opts && opts.now) || (() => Date.now());
    const t0 = now();
    const state = Object.assign({}, INITIAL);
    const recs = [];
    const log = [];
    const events = [];
    const tests = [];
    let cost = 0, redundant = 0, answerSeeks = 0, injects = 0, done = null, fixed = false;
    const stamp = () => Math.round((now() - t0) / 100) / 10;
    const addObs = () => recs.push({ kind: 'obs', state: Object.assign({}, state), result: observe(state, form.fault) });
    addObs();
    const hyps = () => HYPS.filter((h) => recs.every((r) => consistent(h, r)));

    const S = {
      form, state, log, events, tests,
      observation: () => observe(state, fixed ? null : form.fault),
      get fixed() { return fixed; },
      hypotheses: hyps,
      get cost() { return cost; },
      get done() { return done; },
      setSwitch(k, val) {
        if (done || state[k] === val) return null;
        state[k] = val; addObs();
        events.push({ t: stamp(), type: 'action' });
        const entry = { t: stamp(), kind: 'switch', switch: k, value: val, obs: observe(state, fixed ? null : form.fault) };
        log.push(entry); return entry;
      },
      test(t) {
        if (done) return null;
        const result = measure(t, state, form.fault);
        const isRedundant = new Set(hyps().map((h) => measure(t, state, h))).size <= 1;
        if (isRedundant) redundant++;
        recs.push({ kind: 'test', test: t, state: Object.assign({}, state), result });
        cost += COST[t.type];
        if (result === 'fixed') fixed = true;
        events.push({ t: stamp(), type: 'action' });
        const entry = { t: stamp(), kind: 'test', test: t, result, redundant: isRedundant, cost: COST[t.type] };
        tests.push(entry); log.push(entry); return entry;
      },
      ask(q) {
        const r = mentor(q, form.tags);
        if (r.flag === 'mentor_answer_seeking') answerSeeks++;
        if (r.flag === 'mentor_injection_attempt') injects++;
        events.push({ t: stamp(), type: 'mentor' });
        log.push({ t: stamp(), kind: 'mentor', q, intent: r.intent });
        return r;
      },
      event(type, data) { events.push(Object.assign({ t: stamp(), type }, data || {})); },
      submit(answerId, reason) {
        if (done) return done;
        const ids = comps(hyps());
        const correct = answerId === form.fault.id;
        const justified = ids.size === 1;
        const inSet = ids.has(answerId);
        const pp = policyPath(form.fault);
        const excess = Math.max(0, cost - pp.cost);
        const nTests = tests.length;
        const accuracy = correct ? (justified ? 50 : 25) : 0;
        const efficiency = correct && justified ? Math.round(30 * Math.max(0, 1 - excess / 8)) : 0;
        const redundancy = correct && justified ? Math.round(10 * (1 - (nTests ? redundant / nTests : 0))) : 0;
        const consistency = inSet ? 10 : 0;
        const elapsed = stamp();
        const flags = integrity({ events, elapsed, correct, justified, answerSeeks, injects });
        done = { total: accuracy + efficiency + redundancy + consistency, parts: { accuracy, efficiency, redundancy, consistency },
          correct, justified, inSet, cost, policyCost: pp.cost, excess, nTests, redundant, elapsed, answer: answerId, reason: reason || '',
          flags, review: flags.length ? 'Human review recommended' : 'No review needed', remaining: [...ids] };
        return done;
      },
    };
    return S;
  }

  // Integrity flags are evidence for a human reviewer, never an automatic decision.
  function integrity(x) {
    const f = [];
    if (x.events.some((e) => e.type === 'paste')) f.push('paste_into_answer_or_mentor');
    if (x.events.some((e) => e.type === 'copy')) f.push('copied_task_text');
    const blur = x.events.filter((e) => e.type === 'blur').length;
    const away = x.events.filter((e) => e.type === 'focus').reduce((a, e) => a + (e.awayFor || 0), 0);
    if (blur >= 3 || away > 30) f.push('left_window_repeatedly');
    const acts = x.events.filter((e) => e.type === 'action').map((e) => e.t);
    const gaps = acts.slice(1).map((t, i) => t - acts[i]).sort((a, b) => a - b);
    const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
    if (x.elapsed < 20 || (medianGap !== null && medianGap < 0.4)) f.push('implausible_speed');
    if (x.answerSeeks >= 2) f.push('mentor_answer_seeking');
    if (x.injects >= 1) f.push('mentor_injection_attempt');
    if (x.correct && !x.justified) f.push('correct_answer_not_supported_by_evidence');
    return f;
  }

  const api = { NODES, BY_ID, HYPS, FAULTABLE, TESTS, COST, INITIAL, ALL_ON, solve, observe, measure, consistent, opt, policyPath, afterFreeLook, generate, pickItem, route, band, ITEMS, label, mentor, guide, createSession, integrity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
