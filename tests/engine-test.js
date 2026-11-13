const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const a = html.indexOf("    const SUITS = ['hearts'");
const b = html.indexOf('    // --- KOCIA EKIPA VS PSY (SABOTEUR) LOGIC');
const code = html.slice(a, b) + '\nreturn { SUITS, RANKS, DEFAULT_MAKAO_RULES, createStandardDeck, canPlayMakaoCard, initMakaoState, applyMakaoPlay, applyMakaoDraw, applyMakaoSayMakao, applyMakaoCatch, makaoCatchTargets, chooseMakaoBotMove, advanceMakaoTurn, makaoDeckCount, plCards };';
const E = new Function('localStorage', code)({ getItem: () => null, setItem() {} });
const R = E.DEFAULT_MAKAO_RULES;
const P = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, isBot: true }));
const c = (rank, suit, id) => ({ id: id || `${rank}_${suit}_${Math.random()}`, rank, suit });
const base = (players, top, hands, extra = {}) => ({
  deck: E.createStandardDeck({ includeJokers: false }), discardPile: [c('9', 'clubs'), top], hands,
  currentTurnIdx: 0, direction: 1, pendingDraw: 0, pendingSkip: 0, demandedSuit: null, demandedRank: null, demandTurnsLeft: 0,
  drawnCardId: null, skipTurns: Object.fromEntries(players.map(p => [p.id, 0])), saidMakao: Object.fromEntries(players.map(p => [p.id, false])), turnStartedAt: 0, lastEvent: '', ...extra
});
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('defaults are classic', () => {
  assert.deepStrictEqual({ ...R }, { stackDraw: true, skipFour: true, warKings: true, queenAll: true, queenSpadesShield: false, useJokers: false, catchMakao: true, deckMode: 'auto', initialHandSize: 5, turnTime: 30 });
});
t('basic matching + queen on everything', () => {
  const st = base(P(2), c('7', 'hearts'), {});
  assert(E.canPlayMakaoCard(c('9', 'hearts'), st, R)); assert(E.canPlayMakaoCard(c('7', 'clubs'), st, R));
  assert(!E.canPlayMakaoCard(c('9', 'clubs'), st, R)); assert(E.canPlayMakaoCard(c('Q', 'clubs'), st, R));
  assert(!E.canPlayMakaoCard(c('Q', 'clubs'), st, { ...R, queenAll: false }));
  assert(E.canPlayMakaoCard(c('5', 'clubs'), base(P(2), c('Q', 'hearts'), {}), R));
});
t('defending an attack needs a matching attack card', () => {
  const st = base(P(2), c('2', 'hearts'), {}, { pendingDraw: 2 });
  assert(E.canPlayMakaoCard(c('2', 'spades'), st, R)); assert(E.canPlayMakaoCard(c('3', 'hearts'), st, R));
  assert(!E.canPlayMakaoCard(c('3', 'spades'), st, R)); assert(E.canPlayMakaoCard(c('K', 'hearts'), st, R));
  assert(!E.canPlayMakaoCard(c('K', 'spades'), st, R)); assert(!E.canPlayMakaoCard(c('7', 'hearts'), st, R));
  assert(!E.canPlayMakaoCard(c('Q', 'hearts'), st, R)); assert(!E.canPlayMakaoCard(c('K', 'diamonds'), st, R));
  assert(!E.canPlayMakaoCard(c('Q', 'spades'), st, R)); assert(E.canPlayMakaoCard(c('Q', 'spades'), st, { ...R, queenSpadesShield: true }));
  assert(!E.canPlayMakaoCard(c('2', 'spades'), st, { ...R, stackDraw: false }));
  const k = base(P(2), c('K', 'spades'), {}, { pendingDraw: 5 });
  assert(E.canPlayMakaoCard(c('K', 'hearts'), k, R)); assert(E.canPlayMakaoCard(c('2', 'spades'), k, R)); assert(!E.canPlayMakaoCard(c('2', 'hearts'), k, R));
});
t('penalties stack and are drawn', () => {
  const pl = P(2); const two = c('2', 'hearts', 'a'); const three = c('3', 'hearts', 'b');
  let st = base(pl, c('7', 'hearts'), { p0: [two, c('5', 'clubs')], p1: [three, c('6', 'clubs')] });
  st = E.applyMakaoPlay(pl, st, R, 'p0', 'a').state; assert.strictEqual(st.pendingDraw, 2); assert.strictEqual(st.currentTurnIdx, 1);
  st = E.applyMakaoPlay(pl, st, R, 'p1', 'b').state; assert.strictEqual(st.pendingDraw, 5); assert.strictEqual(st.currentTurnIdx, 0);
  st = E.applyMakaoDraw(pl, st, R, 'p0'); assert.strictEqual(st.hands.p0.length, 6); assert.strictEqual(st.pendingDraw, 0); assert.strictEqual(st.currentTurnIdx, 1);
});
t('king of spades hits the previous player, then play continues from them', () => {
  const pl = P(3); const ks = c('K', 'spades', 'ks');
  let st = base(pl, c('7', 'spades'), { p0: [c('5', 'clubs')], p1: [ks, c('5', 'hearts')], p2: [c('6', 'clubs')] }, { currentTurnIdx: 1 });
  st = E.applyMakaoPlay(pl, st, R, 'p1', 'ks').state;
  assert.strictEqual(st.currentTurnIdx, 0); assert.strictEqual(st.pendingDraw, 5); assert.strictEqual(st.direction, 1);
  st = E.applyMakaoDraw(pl, st, R, 'p0'); assert.strictEqual(st.hands.p0.length, 6); assert.strictEqual(st.currentTurnIdx, 1);
});
t('jack demand lasts a full round incl. the demander', () => {
  const pl = P(3); const j = c('J', 'hearts', 'j');
  let st = base(pl, c('7', 'hearts'), { p0: [j, c('8', 'clubs', 'x0'), c('2', 'clubs')], p1: [c('8', 'spades', 'x1'), c('9', 'hearts', 'n1'), c('5', 'clubs')], p2: [c('9', 'spades'), c('5', 'spades')] });
  st = E.applyMakaoPlay(pl, st, R, 'p0', 'j', '8').state; assert.strictEqual(st.demandedRank, '8');
  assert.strictEqual(E.applyMakaoPlay(pl, st, R, 'p1', 'n1'), null, 'hearts card must not beat the demand');
  st = E.applyMakaoPlay(pl, st, R, 'p1', 'x1').state; assert.strictEqual(st.demandedRank, '8', 'demand survives a matching card');
  st = E.applyMakaoDraw(pl, st, R, 'p2'); if (st.drawnCardId) st = E.applyMakaoDraw(pl, st, R, 'p2');
  assert.strictEqual(st.currentTurnIdx, 0); assert.strictEqual(st.demandedRank, '8', 'demander is bound too');
  st = E.applyMakaoPlay(pl, st, R, 'p0', 'x0').state; assert.strictEqual(st.demandedRank, null); assert.strictEqual(st.currentTurnIdx, 1);
  assert.strictEqual(E.applyMakaoPlay(pl, base(pl, c('7', 'hearts'), { p0: [j, c('5', 'clubs')], p1: [], p2: [] }), R, 'p0', 'j', 'K').state.demandedRank, null, 'figures cannot be demanded');
});
t('ace demand holds until a card is played', () => {
  const pl = P(2); const ace = c('A', 'hearts', 'a');
  let st = base(pl, c('7', 'hearts'), { p0: [ace, c('5', 'clubs'), c('6', 'clubs', 'c6')], p1: [c('9', 'hearts', 'h9'), c('5', 'spades')] });
  st.deck = [c('8', 'diamonds'), c('8', 'diamonds')];
  st = E.applyMakaoPlay(pl, st, R, 'p0', 'a', 'clubs').state; assert.strictEqual(st.demandedSuit, 'clubs');
  assert.strictEqual(E.applyMakaoPlay(pl, st, R, 'p1', 'h9'), null);
  st = E.applyMakaoDraw(pl, st, R, 'p1'); assert.strictEqual(st.currentTurnIdx, 0); assert.strictEqual(st.demandedSuit, 'clubs');
  st = E.applyMakaoPlay(pl, st, R, 'p0', 'c6').state; assert.strictEqual(st.demandedSuit, null);
});
t('fours stack into a longer wait', () => {
  const pl = P(3);
  let st = base(pl, c('7', 'hearts'), { p0: [c('4', 'hearts', 'a'), c('5', 'clubs')], p1: [c('4', 'spades', 'b'), c('5', 'clubs')], p2: [c('9', 'clubs'), c('9', 'diamonds')] });
  st = E.applyMakaoPlay(pl, st, R, 'p0', 'a').state; st = E.applyMakaoPlay(pl, st, R, 'p1', 'b').state; assert.strictEqual(st.pendingSkip, 2);
  assert(!E.canPlayMakaoCard(st.hands.p2[0], st, R));
  st = E.applyMakaoDraw(pl, st, R, 'p2'); assert.strictEqual(st.hands.p2.length, 2); assert.strictEqual(st.skipTurns.p2, 1); assert.strictEqual(st.currentTurnIdx, 0);
  st = E.applyMakaoDraw(pl, st, R, 'p0'); if (st.drawnCardId) st = E.applyMakaoDraw(pl, st, R, 'p0');
  st = E.applyMakaoDraw(pl, st, R, 'p1'); if (st.drawnCardId) st = E.applyMakaoDraw(pl, st, R, 'p1');
  assert.strictEqual(st.currentTurnIdx, 0, 'p2 is skipped once more'); assert.strictEqual(st.skipTurns.p2, 0);
});
t('a drawn card that fits may be played or passed', () => {
  const pl = P(2);
  let st = base(pl, c('7', 'hearts'), { p0: [c('9', 'clubs', 'old')], p1: [c('5', 'clubs')] }); st.deck = [c('7', 'spades', 'new')];
  st = E.applyMakaoDraw(pl, st, R, 'p0'); assert.strictEqual(st.drawnCardId, 'new'); assert.strictEqual(st.currentTurnIdx, 0);
  assert(!E.canPlayMakaoCard(st.hands.p0[0], st, R)); assert(E.canPlayMakaoCard(st.hands.p0[1], st, R));
  const passed = E.applyMakaoDraw(pl, st, R, 'p0'); assert.strictEqual(passed.currentTurnIdx, 1); assert.strictEqual(passed.drawnCardId, null); assert.strictEqual(passed.hands.p0.length, 2);
  const played = E.applyMakaoPlay(pl, st, R, 'p0', 'new').state; assert.strictEqual(played.currentTurnIdx, 1); assert.strictEqual(played.hands.p0.length, 1);
  let st2 = base(pl, c('7', 'hearts'), { p0: [c('9', 'clubs')], p1: [] }); st2.deck = [c('8', 'spades')];
  st2 = E.applyMakaoDraw(pl, st2, R, 'p0'); assert.strictEqual(st2.currentTurnIdx, 1);
});
t('MAKAO: announce in advance, forget -> caught, bots announce', () => {
  const pl = [{ id: 'p0', name: 'H', isBot: false }, { id: 'p1', name: 'B', isBot: true }];
  const mk = () => base(pl, c('7', 'hearts'), { p0: [c('9', 'hearts', 'a'), c('5', 'clubs')], p1: [c('8', 'hearts', 'b'), c('6', 'clubs')] });
  let st = E.applyMakaoPlay(pl, mk(), R, 'p0', 'a').state; assert.strictEqual(st.saidMakao.p0, false);
  assert.deepStrictEqual(E.makaoCatchTargets(pl, st, R, 'p1').map(p => p.id), ['p0']);
  const caught = E.applyMakaoCatch(pl, st, R, 'p0', 'B'); assert.strictEqual(caught.hands.p0.length, 6); assert.strictEqual(E.applyMakaoCatch(pl, caught, R, 'p0'), null);
  st = E.applyMakaoPlay(pl, E.applyMakaoSayMakao(pl, mk(), 'p0'), R, 'p0', 'a').state; assert.strictEqual(st.saidMakao.p0, true); assert.strictEqual(E.makaoCatchTargets(pl, st, R, 'p1').length, 0);
  st = E.applyMakaoPlay(pl, st, R, 'p1', 'b').state; assert.strictEqual(st.saidMakao.p1, true);
  assert.strictEqual(E.makaoCatchTargets(pl, st, { ...R, catchMakao: false }, 'p0').length, 0);
});
t('winning + illegal moves', () => {
  const pl = P(2); const st = base(pl, c('7', 'hearts'), { p0: [c('9', 'hearts', 'a')], p1: [c('5', 'clubs', 'z')] });
  const r = E.applyMakaoPlay(pl, st, R, 'p0', 'a'); assert(r.won); assert.strictEqual(r.state.hands.p0.length, 0);
  assert.strictEqual(E.applyMakaoPlay(pl, st, R, 'p1', 'z'), null); assert.strictEqual(E.applyMakaoDraw(pl, st, R, 'p1'), null); assert.strictEqual(E.applyMakaoPlay(pl, st, R, 'p0', 'nope'), null);
});
t('deck count + plural', () => {
  assert.strictEqual(E.makaoDeckCount(R, 3), 1); assert.strictEqual(E.makaoDeckCount(R, 4), 2); assert.strictEqual(E.makaoDeckCount({ ...R, deckMode: '2' }, 2), 2);
  assert.deepStrictEqual([1, 2, 5, 12, 22, 25].map(E.plCards), ['kartę', 'karty', 'kart', 'kart', 'karty', 'kart']);
});
t('simulation: 4000 full games never stall or lose cards', () => {
  let maxSteps = 0, totalSteps = 0, catches = 0, emergency = 0; const wins = {};
  for (let g = 0; g < 4000; g++) {
    const np = 2 + (g % 5);
    const rules = { ...R }; ['stackDraw', 'skipFour', 'warKings', 'queenAll', 'queenSpadesShield', 'useJokers', 'catchMakao'].forEach(k => { if (g % 3 === 0) rules[k] = Math.random() < 0.5; });
    rules.initialHandSize = g % 2 ? 5 : 7;
    const pl = P(np).map((p, i) => ({ ...p, isBot: i !== 0 }));
    let st = E.initMakaoState(pl, rules);
    const total = E.makaoDeckCount(rules, np) * (rules.useJokers ? 54 : 52);
    assert(!['2', '3', '4', 'J', 'Q', 'K', 'A', 'JOKER'].includes(st.discardPile[0].rank));
    let steps = 0, won = false, extra = 0;
    while (!won) {
      assert(++steps < 5000, 'game stalled');
      const cur = pl[st.currentTurnIdx];
      const tg = E.makaoCatchTargets(pl, st, rules, cur.id)[0];
      if (tg && Math.random() < 0.7) { const before = st.deck.length + st.discardPile.length; st = E.applyMakaoCatch(pl, st, rules, tg.id, cur.name); catches++; if (before < 6) extra = 1; }
      if (!cur.isBot && st.hands[cur.id].length === 2 && Math.random() < 0.5) st = E.applyMakaoSayMakao(pl, st, cur.id);
      const mv = E.chooseMakaoBotMove(pl, st, rules, cur.id);
      const cardsBefore = Object.values(st.hands).reduce((s, h) => s + h.length, 0) + st.deck.length + st.discardPile.length;
      if (mv.type === 'play') { const r = E.applyMakaoPlay(pl, st, rules, cur.id, mv.cardId, mv.demand); assert(r, 'bot chose an illegal card'); st = r.state; won = r.won; if (won) wins[cur.id] = (wins[cur.id] || 0) + 1; }
      else { const nx = E.applyMakaoDraw(pl, st, rules, cur.id); assert(nx); st = nx; }
      const cardsAfter = Object.values(st.hands).reduce((s, h) => s + h.length, 0) + st.deck.length + st.discardPile.length;
      if (cardsAfter !== cardsBefore) { extra = 1; emergency++; assert(cardsAfter > cardsBefore); }
      if (!extra) assert.strictEqual(cardsAfter, total, 'card count drifted');
      assert(st.currentTurnIdx >= 0 && st.currentTurnIdx < np); assert(st.pendingDraw >= 0 && st.pendingSkip >= 0);
      if (!extra) { const ids = [...st.deck, ...st.discardPile, ...Object.values(st.hands).flat()].map(x => x.id); assert.strictEqual(new Set(ids).size, ids.length, 'duplicate card'); }
    }
    maxSteps = Math.max(maxSteps, steps); totalSteps += steps;
  }
  console.log(`     avg turns/game ${(totalSteps / 4000).toFixed(1)}, longest ${maxSteps}, catches ${catches}, emergency decks ${emergency}, wins by seat`, wins);
});
console.log(`\n${n} test groups passed`);
