/* Fault-finding engine: system model, fault generator, tests, scoring, AI-mentor mock, integrity flags.
   Pure logic, no DOM. The browser page and the Node evaluation (game/eval.js) use this same file. */
(function (root) {
  'use strict';

  // Supply tree: each node's output depends on its parent. Single fault per form.
  const NODES = [
    { id: 'MAINS', parent: null, kind: 'source', name: 'Mains inlet' },
    { id: 'Q1', parent: 'MAINS', kind: 'isolator', name: 'Isolator', gate: 'Q1' },
    { id: 'F1', parent: 'Q1', kind: 'fuse', name: 'Fuse', modes: ['open'] },
    { id: 'PSU', parent: 'F1', kind: 'psu', name: 'Power supply', modes: ['open', 'low'] },
    { id: 'S1', parent: 'PSU', kind: 'estop', name: 'Emergency stop', gate: 'S1', modes: ['open'] },
    { id: 'K1', parent: 'S1', kind: 'relay', name: 'Safety relay', modes: ['open'] },
    { id: 'SW1', parent: 'K1', kind: 'toggle', name: 'Conveyor enable switch', gate: 'SW1', modes: ['open'] },
    { id: 'KM1', parent: 'SW1', kind: 'contactor', name: 'Conveyor contactor', modes: ['open'] },
    { id: 'M1', parent: 'KM1', kind: 'motor', name: 'Conveyor motor', modes: ['open', 'seized'] },
    { id: 'SW2', parent: 'K1', kind: 'toggle', name: 'Pump enable switch', gate: 'SW2', modes: ['open'] },
    { id: 'KM2', parent: 'SW2', kind: 'contactor', name: 'Pump contactor', modes: ['open'] },
    { id: 'M2', parent: 'KM2', kind: 'motor', name: 'Pump motor', modes: ['open', 'seized'] },
  ];
  const BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const HYPS = [];
  NODES.forEach((n) => (n.modes || []).forEach((m) => HYPS.push({ id: n.id, mode: m })));
  const FAULTABLE = NODES.filter((n) => n.modes).map((n) => n.id);
  const COST = { V: 1, I: 1, SWAP: 3 };
  const INITIAL = { Q1: true, S1: true, SW1: false, SW2: false }; // S1 true = released
  const ALL_ON = { Q1: true, S1: true, SW1: true, SW2: true };
  const PULL_IN = 20; // volts: relays and contactors drop out below this

  function solve(state, fault) {
    const out = {};
    for (const n of NODES) {
      const vin = n.parent === null ? 230 : out[n.parent].v;
      const f = fault && fault.id === n.id ? fault.mode : null;
      let v = vin, i = 0, run = false, hum = false;
      if (n.kind === 'source') v = 230;
      if (n.gate && !state[n.gate]) v = 0;
      if (f === 'open' && n.kind !== 'motor') v = 0;
      if (n.kind === 'psu') v = vin >= 100 && f !== 'open' ? (f === 'low' ? 17 : 24) : 0;
      if ((n.kind === 'relay' || n.kind === 'contactor') && vin < PULL_IN) v = 0;
      if (n.kind === 'motor') {
        v = vin;
        const powered = v >= PULL_IN;
        run = powered && f === null;
        hum = powered && f === 'seized';
        i = powered ? (f === 'seized' ? 9.8 : f === 'open' ? 0 : 2.1) : 0;
      }
      out[n.id] = { v, i, run, hum };
    }
    return out;
  }

  // Free observations: what the candidate can see and hear without spending test budget.
  function observe(state, fault) {
    const o = solve(state, fault);
    const motor = (m) => (m.hum ? 'humming' : m.run ? 'running' : 'stopped');
    return { H1: o.PSU.v >= PULL_IN ? 'on' : o.PSU.v > 0 ? 'dim' : 'off', H2: o.K1.v >= PULL_IN ? 'on' : 'off', M1: motor(o.M1), M2: motor(o.M2) };
  }

  // Paid tests. A test is {type:'V'|'I'|'SWAP', node}.
  function measure(test, state, fault) {
    const o = solve(state, fault);
    if (test.type === 'V') return String(o[test.node].v);
    if (test.type === 'I') return String(o[test.node].i);
    return fault && fault.id === test.node ? 'fixed' : 'nochange';
  }
  function allTests() {
    const t = [];
    NODES.forEach((n) => { if (n.kind !== 'source') t.push({ type: 'V', node: n.id }); });
    ['M1', 'M2'].forEach((m) => t.push({ type: 'I', node: m }));
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
    const tags = { MAINS: 'Mains', Q1: 'Q1', F1: 'F' + (1 + o), PSU: 'PSU1', S1: 'S' + (1 + o), K1: 'K' + (1 + o), SW1: 'SW' + (1 + o), SW2: 'SW' + (2 + o), KM1: 'KM' + (1 + o), KM2: 'KM' + (2 + o), M1: 'M' + (1 + o), M2: 'M' + (2 + o) };
    return { seed, formId: 'FF-' + (seed >>> 0).toString(36).toUpperCase().padStart(4, '0'), fault, tags };
  }
  const label = (form, id) => `${BY_ID[id].name} ${form.tags[id]}`;

  // ---- AI mentor (mock). It is given the guide and the question only, never the fault: it cannot leak what it does not know.
  function guide(tags) {
    const T = tags;
    const L = (name, tag) => `${name} ${tag}`;
    return [
      { id: 'method', keys: ['method', 'approach', 'strategy', 'where', 'start', 'how do i', 'how to', 'begin', 'stuck', 'help'],
        title: 'Method', text: 'Work from what you can see to what you can measure. Each test narrows where the fault can be. A reading at a point in the supply chain tells you whether the fault is upstream or downstream of it, so a test near the middle of the remaining chain rules out more than one at the ends. Free observations (lamps, motors) cost nothing; meter readings cost 1, a spare swap costs 3.' },
      { id: 'meter', keys: ['meter', 'voltmeter', 'measure', 'probe', 'clamp', 'ammeter', 'amps', 'current', 'reading', 'tool'],
        title: 'Using the meters', text: `Voltmeter: pick it, then click any part to read the voltage at its output terminal (mains side is AC, everything after ${T.PSU} is 24 V DC). Clamp ammeter: works on the motor leads only. A switch that is off or an engaged emergency stop gives 0 V by design, so check switch positions before you read anything.` },
      { id: 'lamps', keys: ['lamp', 'light', 'h1', 'h2', 'indicator', 'led'],
        title: 'Indicator lamps', text: `H1 shows the ${T.PSU} output: lit at 20 V or more, dim between 0 and 20 V, dark at 0 V. H2 shows the ${T.K1} output: lit only when the relay has pulled in. A lamp tells you the voltage at one point only.` },
      { id: 'swap', keys: ['swap', 'spare', 'replace', 'change part'],
        title: 'Spare parts', text: 'A known-good spare can be swapped into any part except the isolator and the enable switches you can already operate. It costs 3 and tells you only whether that one part was the cause. It is a confirmation tool, not a search tool.' },
      { id: 'safety', keys: ['safe', 'safety', 'lockout', 'danger', 'shock'],
        title: 'Safety', text: 'On site you would lock out and verify dead before touching anything. In this simulator you may probe live parts.' },
      { id: 'hum', keys: ['hum', 'noise', 'sound', 'buzz', 'smell'],
        title: 'Motor sounds', text: 'A motor with power at its terminals that hums but does not turn is mechanically stuck. A motor with power and no sound and no current has an open winding or lead.' },
      { id: 'Q1', keys: [T.Q1.toLowerCase(), 'isolator', 'disconnect'], title: L('Isolator', T.Q1), text: 'Manual isolator. ON: 230 V AC passes. OFF: 0 V downstream. Off is not a fault.' },
      { id: 'F1', keys: [T.F1.toLowerCase(), 'fuse'], title: L('Fuse', T.F1), text: `6.3 A slow-blow fuse. Healthy: 230 V AC at its output with ${T.Q1} on. A blown fuse passes no voltage.` },
      { id: 'PSU', keys: [T.PSU.toLowerCase(), 'psu', 'power supply', 'transformer'], title: L('Power supply', T.PSU), text: '230 V AC in, 24 V DC out. Healthy output 21.6 to 26.4 V. Relays and contactors need 20 V or more to pull in, so a supply that sags below 20 V can look like a dead relay downstream.' },
      { id: 'S1', keys: [T.S1.toLowerCase(), 'estop', 'e-stop', 'emergency'], title: L('Emergency stop', T.S1), text: 'Normally-closed mushroom button. Released: 24 V passes. Pressed in: 0 V downstream, which is a normal state, not a fault. Twist to release.' },
      { id: 'K1', keys: [T.K1.toLowerCase(), 'relay', 'safety relay'], title: L('Safety relay', T.K1), text: 'Pulls in when its input is 20 V or more and the emergency stop is released. Healthy output equals its input (24 V). H2 shows its output.' },
      { id: 'SW1', keys: [T.SW1.toLowerCase(), 'conveyor enable', 'enable switch'], title: L('Conveyor enable switch', T.SW1), text: 'Toggle that passes 24 V to the conveyor contactor when ON.' },
      { id: 'SW2', keys: [T.SW2.toLowerCase(), 'pump enable'], title: L('Pump enable switch', T.SW2), text: 'Toggle that passes 24 V to the pump contactor when ON.' },
      { id: 'KM1', keys: [T.KM1.toLowerCase(), 'conveyor contactor', 'contactor'], title: L('Conveyor contactor', T.KM1), text: 'Pulls in at 20 V or more at its coil feed and passes 24 V to the conveyor motor.' },
      { id: 'KM2', keys: [T.KM2.toLowerCase(), 'pump contactor'], title: L('Pump contactor', T.KM2), text: 'Pulls in at 20 V or more at its coil feed and passes 24 V to the pump motor.' },
      { id: 'M1', keys: [T.M1.toLowerCase(), 'conveyor motor', 'conveyor', 'motor'], title: L('Conveyor motor', T.M1), text: '24 V DC motor. Healthy: 24 V at terminals, 2.1 A run current, turns. Seized rotor: 24 V at terminals, about 9.8 A, hums. Open winding: 24 V at terminals, 0 A.' },
      { id: 'M2', keys: [T.M2.toLowerCase(), 'pump motor', 'pump'], title: L('Pump motor', T.M2), text: '24 V DC motor, same ratings as the conveyor motor: 2.1 A run current when healthy, about 9.8 A seized, 0 A with an open winding.' },
    ];
  }

  const RX_INJECT = /ignore (all|any|previous|prior|your)|system prompt|you are now|pretend|developer mode|jailbreak|reveal (your|the) (prompt|instructions)/i;
  const RX_VERDICT = /\b(which|what)\b[^?]*\b(faulty|broken|failed|failing|dead|bad|culprit|fault|problem|cause|wrong)\b|\bis\b[^?]*\b(faulty|broken|failed|dead|bad|blown|healthy|okay|ok|working|good|the fault|the cause|the problem)\b|\b(tell|give|show) me (the )?(answer|fault|solution)|\bjust tell\b|\bam i right\b|\bis it\b|\bwhich (part|component|one)\b[^?]*\b(swap|replace|change|fix|check|test|look)/i;
  const RX_SPEC = /\b(expected|normal|nominal|spec|specification|rating|should (read|be)|healthy (value|reading|voltage|current))\b/i;

  function mentor(question, tags) {
    const q = String(question || '').trim();
    if (!q) return { intent: 'empty', flag: null, text: 'Ask about a part, a meter, a lamp, or how to approach the fault.' };
    if (RX_INJECT.test(q)) return { intent: 'injection', flag: 'mentor_injection_attempt', text: 'I only help with this cell: parts, meters, lamps and method. I cannot change my instructions.' };
    if (RX_VERDICT.test(q) && !RX_SPEC.test(q)) return { intent: 'verdict', flag: 'mentor_answer_seeking', text: `I cannot say which part is at fault or confirm a guess; that is the task. I can tell you what a healthy part reads, how the meters work, or how to narrow down a fault. Try asking, for example, what the fuse ${tags.F1} should read.` };
    const ql = q.toLowerCase();
    let best = null, bestScore = 0;
    for (const g of guide(tags)) {
      const s = g.keys.reduce((a, k) => a + (ql.includes(k) ? (k.length > 3 ? 2 : 1) : 0), 0);
      if (s > bestScore) { best = g; bestScore = s; }
    }
    if (!best) return { intent: 'none', flag: null, text: `I did not catch that. I can help with a part (use its tag, for example ${tags.F1}), the meters, the lamps, spare parts or method.` };
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
    let cost = 0, redundant = 0, answerSeeks = 0, injects = 0, done = null;
    const stamp = () => Math.round((now() - t0) / 100) / 10;
    const addObs = () => recs.push({ kind: 'obs', state: Object.assign({}, state), result: observe(state, form.fault) });
    addObs();
    const hyps = () => HYPS.filter((h) => recs.every((r) => consistent(h, r)));

    const S = {
      form, state, log, events, tests,
      observation: () => observe(state, form.fault),
      hypotheses: hyps,
      get cost() { return cost; },
      get done() { return done; },
      setSwitch(k, val) {
        if (done || state[k] === val) return null;
        state[k] = val; addObs();
        events.push({ t: stamp(), type: 'action' });
        const entry = { t: stamp(), kind: 'switch', switch: k, value: val, obs: observe(state, form.fault) };
        log.push(entry); return entry;
      },
      test(t) {
        if (done) return null;
        const result = measure(t, state, form.fault);
        const isRedundant = new Set(hyps().map((h) => measure(t, state, h))).size <= 1;
        if (isRedundant) redundant++;
        recs.push({ kind: 'test', test: t, state: Object.assign({}, state), result });
        cost += COST[t.type];
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

  const api = { NODES, BY_ID, HYPS, FAULTABLE, TESTS, COST, INITIAL, ALL_ON, solve, observe, measure, consistent, opt, policyPath, afterFreeLook, generate, label, mentor, guide, createSession, integrity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
