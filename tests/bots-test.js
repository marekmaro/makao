// Symulacje bot-kontra-bot dla Kociej Ekipy i Remika: każda partia musi się skończyć,
// boty nie mogą wykonywać nielegalnych ruchów, a karty nie mogą znikać ani się mnożyć.
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const a = html.indexOf("    const SUITS = ['hearts'");
const b = html.indexOf('    // 4. UI COMPONENTS');
const names = ['createStandardDeck', 'initSaboteurState', 'applySabPath', 'applySabAction', 'applySabDiscard', 'chooseSabBotMove', 'checkSaboteurGoalReached', 'getReachableCells', 'canPlaceSabTile',
  'initRummyState', 'applyRummyDraw', 'applyRummyMeld', 'applyRummyDiscard', 'chooseRummyBotMove', 'validateRummyMeld', 'findBestRummyMeld', 'rummyHandPoints', 'GOAL_COL', 'GOAL_ROWS', 'DEFAULT_SAB_SETTINGS'];
const E = new Function('localStorage', html.slice(a, b) + `\nreturn { ${names.join(', ')} };`)({ getItem: () => null, setItem() {} });
const P = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, isBot: true, score: 0 }));
const N = Number(process.env.GAMES || 1500);
let groups = 0; const t = (name, fn) => { fn(); groups++; console.log('ok  ' + name); };
const pct = (x, n) => (100 * x / n).toFixed(0) + '%';

t('saboteur: goal is revealed only by a tunnel that points at it', () => {
  const start = { '2_0': { dirs: { N: 1, E: 1, S: 1, W: 1 }, open: true, isStart: true } };
  const h = { dirs: { N: 0, E: 1, S: 0, W: 1 }, open: true };
  const row = { ...start }; for (let c = 1; c <= 4; c++) row['2_' + c] = h;
  const goals = { '0_6': { type: 'trap', revealed: false }, '2_6': { type: 'mouse', revealed: false }, '4_6': { type: 'trap', revealed: false } };
  assert(E.checkSaboteurGoalReached({ ...row, '2_5': h }, goals).mouseFound, 'straight tunnel into the goal');
  assert(E.checkSaboteurGoalReached({ ...row, '2_5': { dirs: { N: 1, E: 1, S: 0, W: 1 }, open: true } }, goals).mouseFound, 'exit east reaches the goal');
  assert(!E.checkSaboteurGoalReached({ ...row, '2_5': { dirs: { N: 1, E: 0, S: 1, W: 1 }, open: true } }, goals).mouseFound, 'no east exit -> goal stays hidden');
  assert(!E.checkSaboteurGoalReached({ ...row, '2_5': { dirs: { N: 0, E: 1, S: 0, W: 1 }, open: false } }, goals).mouseFound, 'dead end does not reveal');
  const up = { ...row, '2_5': { dirs: { N: 1, E: 0, S: 0, W: 1 }, open: true }, '1_5': { dirs: { N: 0, E: 1, S: 1, W: 0 }, open: true }, '1_6': { dirs: { N: 1, E: 0, S: 1, W: 1 }, open: true } };
  const r = E.checkSaboteurGoalReached(up, goals);
  assert(r.mouseFound && r.updatedGoals['0_6'].revealed, 'tile between two goals with N+S exits reveals both');
});

const sabSim = (np, mode, games) => {
  const st = { cats: 0, dogs: 0, draw: 0, turns: 0, max: 0, moves: { path: 0, action: 0, discard: 0 } };
  for (let g = 0; g < games; g++) {
    const pl = P(np);
    let room = { status: 'playing', players: pl, gameType: 'saboteur', saboteur: E.initSaboteurState(pl, { mode1v1: mode }, 1 + (g % 2)) };
    const total = 52; let steps = 0;
    while (room.status === 'playing') {
      assert(++steps < 400, 'saboteur game stalled');
      const ss = room.saboteur; const cur = pl[ss.currentTurnIdx];
      assert(ss.hands[cur.id].length > 0, 'player to move has no cards');
      const mv = E.chooseSabBotMove(room, cur.id); assert(mv, 'bot returned no move');
      const res = mv.type === 'path' ? E.applySabPath(room, cur.id, mv.cardId, mv.r, mv.c, mv.rot)
        : mv.type === 'action' ? E.applySabAction(room, cur.id, mv.cardId, mv.target) : E.applySabDiscard(room, cur.id, mv.cardId);
      assert(res.room, `bot made an illegal move: ${JSON.stringify(mv)} -> ${res.error}`);
      st.moves[mv.type]++;
      if (mv.type === 'path' && ss.roles[cur.id] === 'dog') assert.strictEqual(ss.hands[cur.id].find(c => c.id === mv.cardId).open, false, 'dog must not build open tunnels for the cats');
      room = res.room;
      const n = room.saboteur; const inHands = Object.values(n.hands).reduce((s, h) => s + h.length, 0);
      assert(inHands + n.deck.length <= total);
      Object.keys(n.board).forEach(k => { const [r, c] = k.split('_').map(Number); assert(!(c === E.GOAL_COL && E.GOAL_ROWS.includes(r)), 'tile on a goal cell'); });
    }
    const w = room.winnerInfo.winnerName; if (/Kocia|Mysz/.test(w)) st.cats++; else if (/Psy/.test(w)) st.dogs++; else st.draw++;
    st.turns += steps; st.max = Math.max(st.max, steps);
  }
  return st;
};
t(`saboteur: ${N} bot games per setup finish with legal moves`, () => {
  for (const [np, mode] of [[2, 'cat_vs_dog'], [2, 'cat_race'], [3, 'x'], [4, 'x'], [6, 'x']]) {
    const s = sabSim(np, mode, N);
    console.log(`     ${np} graczy ${np === 2 ? mode : ''}: mysz znaleziona ${pct(s.cats, N)}, psy ${pct(s.dogs, N)}, remis ${pct(s.draw, N)} | śr. ${(s.turns / N).toFixed(0)} tur, maks. ${s.max} | ruchy: tunel ${s.moves.path}, akcja ${s.moves.action}, wymiana ${s.moves.discard}`);
    if (np === 2 && mode === 'cat_race') assert(s.cats > N * 0.5, 'two cooperating cats should usually find the mouse');
  }
});

t('rummy: melds are validated', () => {
  const c = (rank, suit) => ({ id: rank + suit + Math.random(), rank, suit });
  assert.strictEqual(E.validateRummyMeld([c('7', 'hearts'), c('7', 'spades'), c('7', 'clubs')]).type, 'group');
  assert.strictEqual(E.validateRummyMeld([c('7', 'hearts'), c('7', 'hearts'), c('7', 'clubs')]), null);
  assert.strictEqual(E.validateRummyMeld([c('Q', 'hearts'), c('K', 'hearts'), c('A', 'hearts')]).type, 'run');
  assert.strictEqual(E.validateRummyMeld([c('K', 'hearts'), c('A', 'hearts'), c('2', 'hearts')]), null);
  assert.strictEqual(E.validateRummyMeld([c('5', 'hearts'), c('JOKER', 'joker'), c('7', 'hearts')]).points, 37);
  assert.strictEqual(E.validateRummyMeld([c('5', 'hearts'), c('6', 'spades'), c('7', 'hearts')]), null);
});

t(`rummy: ${N} bot games per table size finish with legal moves`, () => {
  for (const np of [2, 3, 4]) {
    const st = { out: 0, stock: 0, turns: 0, max: 0, opened: 0, seats: {}, melds: 0, fromDiscard: 0 };
    for (let g = 0; g < N; g++) {
      const pl = P(np);
      let room = { status: 'playing', players: pl, gameType: 'rummy', rummy: E.initRummyState(pl) };
      let steps = 0;
      while (room.status === 'playing') {
        assert(++steps < 3000, 'rummy game stalled');
        const rs = room.rummy; const cur = pl[rs.currentTurnIdx];
        const mv = E.chooseRummyBotMove(room, cur.id);
        const res = mv.type === 'draw' ? E.applyRummyDraw(room, cur.id, mv.fromDiscard) : mv.type === 'meld' ? E.applyRummyMeld(room, cur.id, mv.cardIds) : E.applyRummyDiscard(room, cur.id, mv.cardId);
        assert(res.room, `bot made an illegal move: ${JSON.stringify(mv)} -> ${res.error}`);
        if (mv.type === 'meld') st.melds++; if (mv.type === 'draw' && mv.fromDiscard) st.fromDiscard++;
        if (mv.type === 'discard') assert(rs.hands[cur.id].length === 1 || rs.hands[cur.id].find(c => c.id === mv.cardId).rank !== 'JOKER' || rs.hands[cur.id].every(c => c.rank === 'JOKER'), 'bot threw away a joker');
        room = res.room;
        const n = room.rummy; const all = [...n.deck, ...n.discardPile, ...Object.values(n.hands).flat(), ...n.melds.flatMap(m => m.cards)];
        assert.strictEqual(all.length, 108, 'card count drifted'); assert.strictEqual(new Set(all.map(x => x.id)).size, 108, 'duplicate card');
      }
      if (/Talia/.test(room.winnerInfo.reason)) st.stock++; else st.out++;
      st.opened += Object.values(room.rummy.opened).filter(Boolean).length;
      st.seats[room.winnerInfo.winnerId] = (st.seats[room.winnerInfo.winnerId] || 0) + 1;
      st.turns += steps; st.max = Math.max(st.max, steps);
    }
    console.log(`     ${np} graczy: ktoś wyszedł z kart ${pct(st.out, N)}, koniec talii ${pct(st.stock, N)} | śr. ${(st.turns / N / 2).toFixed(0)} tur, maks. ${Math.round(st.max / 2)} | otworzyło ${(st.opened / N).toFixed(1)} z ${np} graczy, układów/partię ${(st.melds / N).toFixed(1)}, wzięć ze stosu/partię ${(st.fromDiscard / N).toFixed(1)}`);
    assert(st.out > N * 0.5, 'bots should usually finish a rummy round by going out');
  }
});
console.log(`\n${groups} test groups passed`);
