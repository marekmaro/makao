// Testy zasad Makao (nowe zasady: ciągi kart, jokery, obrona przed karami, żądania) + symulacja pełnych partii.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = html.indexOf("    const SUITS = ['hearts'");
const b = html.indexOf('    // --- KOCIA EKIPA VS PSY (SABOTEUR) LOGIC');
const names = ['SUITS', 'RANKS', 'SUIT_META', 'DEFAULT_MAKAO_RULES', 'createStandardDeck', 'canPlayMakaoCard', 'initMakaoState', 'applyMakaoPlay', 'applyMakaoDraw',
  'applyMakaoSayMakao', 'applyMakaoCatch', 'makaoCatchTargets', 'chooseMakaoBotMove', 'advanceMakaoTurn', 'makaoDeckCount', 'plCards', 'makaoLinked', 'chainValid',
  'jokerIdentities', 'resolveMakaoItems', 'isFunctional', 'attackValue', 'MAKAO_ORDER'];
const E = new Function('localStorage', html.slice(a, b) + `\nreturn { ${names.join(', ')} };`)({ getItem: () => null, setItem() {} });
const R = { ...E.DEFAULT_MAKAO_RULES };
const P = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, isBot: i !== 0 }));
const c = (rank, suit, id) => ({ id: id || `${rank}_${suit}_${Math.random().toString(36).slice(2, 7)}`, rank, suit });
const base = (players, top, hands, extra = {}) => ({
  deck: E.createStandardDeck({ includeJokers: false }), discardPile: [c('9', 'clubs', 'bottom'), top], hands,
  currentTurnIdx: 0, direction: 1, pendingDraw: 0, pendingSkip: 0, demandedSuit: null, demandSuitTurns: 0, demandedRank: null, demandRankTurns: 0,
  drawnCardId: null, skipTurns: Object.fromEntries(players.map(p => [p.id, 0])), saidMakao: Object.fromEntries(players.map(p => [p.id, false])),
  turnStartedAt: 0, lastEvent: '', ...extra
});
let groups = 0;
const t = (name, fn) => { fn(); groups++; console.log('ok  ' + name); };
const pl2 = P(2);

t('deck count grows with players (1 per 2–3 players, +1 per 3 more)', () => {
  assert.deepStrictEqual([2, 3, 4, 6, 7, 9, 10].map(n => E.makaoDeckCount(R, n)), [1, 1, 2, 2, 3, 3, 4]);
});

t('classic defence: 2 and 3 answer each other in any suit; kings only with kings or 2/3', () => {
  const st = base(pl2, c('2', 'hearts'), {}, { pendingDraw: 2 });
  assert(E.canPlayMakaoCard(c('3', 'spades'), st, R), '3 of spades must defend 2 of hearts');
  assert(E.canPlayMakaoCard(c('2', 'clubs'), st, R));
  assert(!E.canPlayMakaoCard(c('K', 'hearts'), st, R), 'king cannot defend a 2');
  assert(!E.canPlayMakaoCard(c('9', 'hearts'), st, R));
  const k = base(pl2, c('K', 'spades'), {}, { pendingDraw: 5 });
  assert(E.canPlayMakaoCard(c('K', 'hearts'), k, R), 'king defends king');
  assert(E.canPlayMakaoCard(c('2', 'clubs'), k, R), '2 defends king (7 cards in total)');
  assert(!E.canPlayMakaoCard(c('J', 'clubs'), k, R));
});

t('chains: same rank in any suit, or neighbouring rank in the same suit (the 5♠6♠7♠7♥8♥8♣7♣ example)', () => {
  const chain = [c('5', 'spades'), c('6', 'spades'), c('7', 'spades'), c('7', 'hearts'), c('8', 'hearts'), c('8', 'clubs'), c('7', 'clubs')];
  assert(E.chainValid(chain, R));
  assert(E.chainValid([c('7', 'hearts'), c('7', 'spades'), c('7', 'clubs')], R), 'three sevens of different suits');
  assert(!E.chainValid([c('5', 'spades'), c('7', 'spades')], R), 'skipping a rank is not a chain');
  assert(!E.chainValid([c('5', 'spades'), c('6', 'hearts')], R), 'neighbouring rank needs the same suit');
});

t('queens only chain like other cards: Q♦ with K♥ is not one move, Q♦ with Q♣ is', () => {
  assert(!E.chainValid([c('Q', 'diamonds'), c('K', 'hearts')], R), 'queen cannot link to a king of another suit');
  assert(!E.chainValid([c('Q', 'diamonds'), c('9', 'clubs')], R));
  assert(E.chainValid([c('Q', 'diamonds'), c('Q', 'clubs')], R), 'same rank is fine');
  assert(E.chainValid([c('J', 'diamonds'), c('Q', 'diamonds'), c('K', 'diamonds')], R), 'neighbours in the same suit');
  // ale dama nadal kładzie się na dowolną kartę jako pierwsza
  assert(E.canPlayMakaoCard(c('Q', 'clubs'), base(pl2, c('2', 'hearts'), {}), R), 'queen still answers any card');
});

t('play three cards of one rank in one move (the bug reported by the user)', () => {
  const hand = [c('7', 'hearts', 'a'), c('7', 'spades', 'b'), c('7', 'clubs', 'd'), c('9', 'diamonds', 'e')];
  const st = base(pl2, c('7', 'diamonds'), { p0: hand, p1: [c('5', 'clubs')] });
  const r = E.applyMakaoPlay(pl2, st, R, 'p0', ['a', 'b', 'd']);
  assert(r && !r.won, 'three sevens must be accepted');
  assert.strictEqual(r.state.hands.p0.length, 1);
  assert.strictEqual(r.state.discardPile[r.state.discardPile.length - 1].id, 'd');
});

t('play a chain 5♠ 6♠ 7♠ 7♥ 8♥ 8♣ 7♣ from the table 5♠ top', () => {
  const hand = [c('5', 'spades', 'a'), c('6', 'spades', 'b'), c('7', 'spades', 'c'), c('7', 'hearts', 'd'), c('8', 'hearts', 'e'), c('8', 'clubs', 'f'), c('7', 'clubs', 'g'), c('K', 'diamonds', 'h')];
  const st = base(pl2, c('5', 'spades'), { p0: hand, p1: [c('3', 'clubs')] });
  const r = E.applyMakaoPlay(pl2, st, R, 'p0', ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert(r && !r.won);
  assert.strictEqual(r.state.hands.p0.length, 1);
  assert.strictEqual(r.state.currentTurnIdx, 1);
  assert.throws(() => assert(E.applyMakaoPlay(pl2, st, R, 'p0', ['b', 'a']) === null));
});

t('jokers: take any value, bridge two neighbours and can be played together', () => {
  const st = base(pl2, c('7', 'hearts'), { p0: [{ id: 'j', rank: 'JOKER', suit: 'joker' }, c('9', 'clubs', 'x')], p1: [c('5', 'clubs')] });
  assert(E.canPlayMakaoCard({ id: 'j', rank: 'JOKER', suit: 'joker' }, st, R), 'a joker is always playable');
  const ids = E.jokerIdentities({ id: 'j', rank: 'JOKER', suit: 'joker' }, st, R, []);
  assert(ids.some(x => x.rank === '7' && x.suit === 'spades'), 'joker can be 7♠ on 7♥');
  assert(ids.some(x => x.rank === '7' && x.suit === 'hearts'), 'joker can be 7♥');
  assert(!ids.some(x => x.rank === '9' && x.suit === 'clubs'), 'joker cannot be a card that does not match the table');
  // joker as the bridge: 5♠ [joker as 6♠] 7♠
  const bridge = [c('5', 'spades'), { id: 'j', rank: '6', suit: 'spades', wild: true }, c('7', 'spades')];
  assert(E.chainValid(bridge, R));
  const hand = [c('5', 'spades', 'a'), { id: 'j', rank: 'JOKER', suit: 'joker' }, c('7', 'spades', 'b')];
  const st2 = base(pl2, c('5', 'spades'), { p0: hand, p1: [c('3', 'clubs')] });
  const r = E.applyMakaoPlay(pl2, st2, R, 'p0', ['a', { id: 'j', rank: '6', suit: 'spades' }, 'b']);
  assert(r && r.won, 'joker-bridged chain finishes the hand');
  assert.strictEqual(r.state.discardPile.find(x => x.id === 'j').rank, '6', 'joker keeps the chosen value on the table');
  // joker with a value that is not playable is refused
  assert(E.applyMakaoPlay(pl2, st2, R, 'p0', [{ id: 'j', rank: '9', suit: 'clubs' }]) === null);
});

t('2 and 3 accumulate; kings add 5; king of spades sends the penalty to the previous player', () => {
  const pl = P(3);
  let st = base(pl, c('7', 'hearts'), { p0: [c('2', 'hearts', 'a'), c('9', 'clubs')], p1: [c('3', 'hearts', 'b'), c('6', 'clubs')], p2: [c('K', 'spades', 'k'), c('6', 'spades')] }, { currentTurnIdx: 0 });
  st = E.applyMakaoPlay(pl, st, R, 'p0', ['a']).state; assert.strictEqual(st.pendingDraw, 2);
  st = E.applyMakaoPlay(pl, st, R, 'p1', ['b']).state; assert.strictEqual(st.pendingDraw, 5);
  let st2 = base(pl, c('7', 'spades'), { p0: [c('5', 'clubs')], p1: [c('5', 'spades')], p2: [c('K', 'spades', 'k'), c('6', 'spades')] }, { currentTurnIdx: 2 });
  const r = E.applyMakaoPlay(pl, st2, R, 'p2', ['k']);
  assert.strictEqual(r.state.pendingDraw, 5);
  assert.strictEqual(r.state.currentTurnIdx, 1, 'K♠ sends the penalty to the previous player (index 1)');
});

t('a penalty can be defended and then passed on: 2 on king adds up (7 cards)', () => {
  const pl = P(2);
  let st = base(pl2, c('7', 'hearts'), { p0: [c('K', 'hearts', 'k'), c('9', 'clubs')], p1: [c('2', 'clubs', 'two'), c('4', 'clubs')] });
  st = E.applyMakaoPlay(pl2, st, R, 'p0', ['k']).state; assert.strictEqual(st.pendingDraw, 5);
  st = E.applyMakaoPlay(pl2, st, R, 'p1', ['two']).state; assert.strictEqual(st.pendingDraw, 7);
  st = E.applyMakaoDraw(pl2, st, R, 'p0'); assert.strictEqual(st.hands.p0.length, 8, '1 card left + 7 drawn = 8');
});

t('fours block: each four waits one turn, blocks add up, a player with no four waits', () => {
  const pl = P(3);
  let st = base(pl, c('7', 'hearts'), { p0: [c('4', 'hearts', 'a'), c('5', 'clubs')], p1: [c('4', 'spades', 'b'), c('5', 'clubs')], p2: [c('9', 'clubs'), c('9', 'diamonds')] });
  st = E.applyMakaoPlay(pl, st, R, 'p0', ['a']).state; st = E.applyMakaoPlay(pl, st, R, 'p1', ['b']).state;
  assert.strictEqual(st.pendingSkip, 2);
  st = E.applyMakaoDraw(pl, st, R, 'p2');
  assert.strictEqual(st.currentTurnIdx, 0, 'player 2 lost two turns: back to player 0');
});

t('jack demands a rank for the whole round, ace a suit for the next player only', () => {
  const pl = P(3);
  let st = base(pl, c('7', 'hearts'), { p0: [c('J', 'hearts', 'j'), c('8', 'clubs', 'x'), c('2', 'clubs')], p1: [c('8', 'spades', 'y'), c('5', 'hearts')], p2: [c('9', 'spades'), c('5', 'spades')] });
  st = E.applyMakaoPlay(pl, st, R, 'p0', ['j'], '8').state;
  assert.strictEqual(st.demandedRank, '8');
  let visible = 0; let cur = st;
  for (let i = 0; i < 3; i++) { if (cur.demandedRank) visible++; cur = E.advanceMakaoTurn(pl, cur); }
  assert.strictEqual(visible, 3, 'demand is visible in the turns of all three players');
  assert.strictEqual(cur.demandedRank, null, 'and ends after the round');

  let st2 = base(pl2, c('7', 'hearts'), { p0: [c('A', 'hearts', 'a'), c('9', 'clubs')], p1: [c('5', 'clubs'), c('9', 'hearts')] });
  st2 = E.applyMakaoPlay(pl2, st2, R, 'p0', ['a'], 'clubs').state;
  assert.strictEqual(st2.demandedSuit, 'clubs');
  assert(E.canPlayMakaoCard(c('5', 'clubs'), st2, R), 'next player must follow the suit');
  assert(!E.canPlayMakaoCard(c('9', 'hearts'), st2, R), 'hearts does not match the demand');
  const after = E.advanceMakaoTurn(pl2, st2);
  assert.strictEqual(after.demandedSuit, null, 'ends once the next player has had their turn');
});

t('jacks cannot be answered by queens while a rank is demanded', () => {
  const st = base(pl2, c('J', 'hearts'), {}, { demandedRank: '6', demandRankTurns: 3 });
  assert(!E.canPlayMakaoCard(c('Q', 'clubs'), st, R));
  assert(E.canPlayMakaoCard(c('6', 'clubs'), st, R));
  assert(E.canPlayMakaoCard(c('J', 'clubs'), st, R));
});

t('MAKAO: forgetting it lets the opponent say STOP and draw five; announcing protects', () => {
  const pl = [{ id: 'p0', name: 'H', isBot: false }, { id: 'p1', name: 'B', isBot: true }];
  const mk = () => base(pl, c('7', 'hearts'), { p0: [c('9', 'hearts', 'a'), c('5', 'clubs')], p1: [c('8', 'hearts', 'b'), c('6', 'clubs')] });
  let st = E.applyMakaoPlay(pl, mk(), R, 'p0', ['a']).state;
  assert.deepStrictEqual(E.makaoCatchTargets(pl, st, R, 'p1').map(p => p.id), ['p0']);
  const caught = E.applyMakaoCatch(pl, st, R, 'p0', 'B'); assert.strictEqual(caught.hands.p0.length, 6);
  st = E.applyMakaoPlay(pl, E.applyMakaoSayMakao(pl, mk(), 'p0'), R, 'p0', ['a']).state;
  assert.strictEqual(E.makaoCatchTargets(pl, st, R, 'p1').length, 0);
});

t('the first card on the table is never functional; functional ones go back into the deck', () => {
  for (let i = 0; i < 300; i++) {
    const st = E.initMakaoState(P(4), R);
    assert(!E.isFunctional(st.discardPile[0], R), 'start card is not functional');
    const total = st.deck.length + st.discardPile.length + Object.values(st.hands).reduce((s, h) => s + h.length, 0);
    assert.strictEqual(total, 2 * 54, 'four players use two decks with jokers');
  }
});

t('illegal moves are refused', () => {
  const st = base(pl2, c('7', 'hearts'), { p0: [c('9', 'hearts', 'a')], p1: [c('5', 'clubs', 'z')] });
  assert.strictEqual(E.applyMakaoPlay(pl2, st, R, 'p1', ['z']), null, 'not your turn');
  assert.strictEqual(E.applyMakaoPlay(pl2, st, R, 'p0', ['a', 'a']), null, 'same card twice');
  assert.strictEqual(E.applyMakaoPlay(pl2, st, R, 'p0', ['nope']), null);
  assert.strictEqual(E.applyMakaoPlay(pl2, st, R, 'p0', ['a', 'z']), null, 'not in hand');
});

// ---------- symulacja pełnych partii: zawsze się kończą, karty się nie gubią, boty grają legalnie ----------
t('simulation: 3000 full games for 2–10 players never stall, lose or duplicate cards', () => {
  let maxSteps = 0; let total = 0; let multi = 0; let jokerPlays = 0; let catches = 0; const wins = {};
  for (let g = 0; g < 3000; g++) {
    const np = 2 + (g % 9);
    const rules = { ...R, useJokers: g % 4 !== 0, initialHandSize: g % 5 === 0 ? 7 : 5 };
    const pl = P(np).map((p, i) => ({ ...p, isBot: i !== 0 || g % 2 === 0 }));
    let st = E.initMakaoState(pl, rules);
    const decks = E.makaoDeckCount(rules, np);
    const perDeck = rules.useJokers ? 54 : 52;
    const expected = decks * perDeck;
    let steps = 0; let won = false;
    while (!won) {
      assert(++steps < 6000, `game stalled (${np} players)`);
      const cur = pl[st.currentTurnIdx];
      const tg = E.makaoCatchTargets(pl, st, rules, cur.id)[0];
      if (tg && Math.random() < 0.6) { st = E.applyMakaoCatch(pl, st, rules, tg.id, cur.name); catches++; }
      if (!cur.isBot && st.hands[cur.id].length === 2 && Math.random() < 0.5) st = E.applyMakaoSayMakao(pl, st, cur.id);
      const mv = E.chooseMakaoBotMove(pl, st, rules, cur.id);
      if (mv.type === 'play') {
        const r = E.applyMakaoPlay(pl, st, rules, cur.id, mv.items, mv.demand);
        assert(r, `bot made an illegal move ${JSON.stringify(mv.items)}`);
        if (mv.items.length > 1) multi++;
        if (mv.items.some(x => typeof x === 'object')) jokerPlays++;
        st = r.state; won = r.won;
        if (won) wins[cur.id] = (wins[cur.id] || 0) + 1;
      } else {
        const nx = E.applyMakaoDraw(pl, st, rules, cur.id);
        assert(nx, 'draw must be legal');
        st = nx;
      }
      const ids = [...st.deck, ...st.discardPile, ...Object.values(st.hands).flat()].map(x => x.id);
      assert.strictEqual(new Set(ids).size, ids.length, 'duplicate card id');
      assert.strictEqual(ids.length, expected, `card count changed: ${ids.length} vs ${expected}`);
    }
    maxSteps = Math.max(maxSteps, steps); total += steps;
  }
  console.log(`     avg moves/game ${(total / 3000).toFixed(0)}, longest ${maxSteps}, multi-card moves ${multi}, joker moves ${jokerPlays}, STOP MAKAO ${catches}, wins by seat ${JSON.stringify(wins)}`);
});

console.log(`\n${groups} test groups passed`);
