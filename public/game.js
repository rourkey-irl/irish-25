// ============================================================
//  DECK & CARD DEFINITIONS
// ============================================================

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardLabel(card) {
  const suitSymbol = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  return `${card.value}${suitSymbol[card.suit]}`;
}

// ============================================================
//  TRUMP RANKING — the core of Irish 25
//
//  Trump order (high to low):
//    5 of trumps → J of trumps → A♥ → A of trumps (if not hearts)
//    → then remaining cards in colour order
//
//  Non-trump red suits (high to low):
//    K Q J 10 9 8 7 6 5 4 3 2 A
//
//  Non-trump black suits (high to low):
//    K Q J A 2 3 4 5 6 7 8 9 10
// ============================================================

function isTrump(card, trumpSuit) {
  if (card.suit === trumpSuit) return true;
  // A♥ is always a trump regardless of trump suit
  if (card.value === 'A' && card.suit === 'hearts') return true;
  return false;
}

// Returns a numeric rank for a card given the trump suit.
// Higher number = stronger card.
function rankCard(card, trumpSuit) {
  // --- Trump ranking ---
  if (isTrump(card, trumpSuit)) {
    // 5 of trumps — highest card in the game
    if (card.value === '5' && card.suit === trumpSuit) return 100;
    // Jack of trumps
    if (card.value === 'J' && card.suit === trumpSuit) return 99;
    // Ace of hearts — always 3rd highest trump
    if (card.value === 'A' && card.suit === 'hearts') return 98;
    // Ace of trumps (only relevant if trump suit is not hearts)
    if (card.value === 'A' && card.suit === trumpSuit) return 97;

    // Remaining trumps follow colour-based ranking
    if (['hearts', 'diamonds'].includes(trumpSuit)) {
      // Red trump suit: K Q 10 9 8 7 6 4 3 2 (high to low, 5 and J already handled)
      const redOrder = ['K','Q','10','9','8','7','6','4','3','2'];
      const idx = redOrder.indexOf(card.value);
      return idx === -1 ? 0 : 80 - idx;
    } else {
      // Black trump suit: K Q 2 3 4 6 7 8 9 10 (high to low, A/5/J already handled)
      const blackOrder = ['K','Q','2','3','4','6','7','8','9','10'];
      const idx = blackOrder.indexOf(card.value);
      return idx === -1 ? 0 : 80 - idx;
    }
  }

  // --- Non-trump ranking ---
  if (['hearts', 'diamonds'].includes(card.suit)) {
    // Red non-trump: K Q J 10 9 8 7 6 5 4 3 2 A
    const redOrder = ['K','Q','J','10','9','8','7','6','5','4','3','2','A'];
    const idx = redOrder.indexOf(card.value);
    return idx === -1 ? 0 : 50 - idx;
  } else {
    // Black non-trump: K Q J A 2 3 4 5 6 7 8 9 10
    const blackOrder = ['K','Q','J','A','2','3','4','5','6','7','8','9','10'];
    const idx = blackOrder.indexOf(card.value);
    return idx === -1 ? 0 : 50 - idx;
  }
}

// Returns the winning card from a completed trick
function trickWinner(trick, trumpSuit) {
  // trick = [{ card, playerIndex }, ...]
  const ledSuit = trick[0].card.suit;

  let best = trick[0];
  for (let i = 1; i < trick.length; i++) {
    const current = trick[i];
    const bestIsTrump = isTrump(best.card, trumpSuit);
    const currentIsTrump = isTrump(current.card, trumpSuit);

    if (currentIsTrump && !bestIsTrump) {
      // Trump beats non-trump
      best = current;
    } else if (!currentIsTrump && bestIsTrump) {
      // Non-trump can't beat trump
      continue;
    } else if (currentIsTrump && bestIsTrump) {
      // Both trump — higher rank wins
      if (rankCard(current.card, trumpSuit) > rankCard(best.card, trumpSuit)) {
        best = current;
      }
    } else {
      // Neither is trump — must follow led suit to win
      if (current.card.suit === ledSuit &&
          rankCard(current.card, trumpSuit) > rankCard(best.card, trumpSuit)) {
        best = current;
      }
    }
  }
  return best;
}

// ============================================================
//  RENEGING RULE
//  A player may renege (play a non-trump) to a trump lead if
//  their only trump(s) are the 5, J, or A♥ AND that card is
//  higher than the trump led.
// ============================================================

function canRenege(card, ledCard, trumpSuit) {
  const topTrumps = ['5', 'J'];
  const isTopTrump = topTrumps.includes(card.value) && card.suit === trumpSuit
    || (card.value === 'A' && card.suit === 'hearts');
  const isHigherThanLed = rankCard(card, trumpSuit) > rankCard(ledCard, trumpSuit);
  return isTopTrump && isHigherThanLed;
}

// Returns which cards in a player's hand are legal to play
function legalCards(hand, ledCard, trumpSuit) {
  // First card of trick — anything is legal
  if (!ledCard) return hand;

  const ledSuit = ledCard.suit;
  const ledIsTrump = isTrump(ledCard, trumpSuit);

  if (ledIsTrump) {
    // Trump was led — must follow trump unless you can only renege
    const trumpsInHand = hand.filter(c => isTrump(c, trumpSuit));
    if (trumpsInHand.length === 0) return hand; // no trumps, play anything

    // Check if ALL trumps in hand are renegeable
    const mustPlay = trumpsInHand.filter(c => !canRenege(c, ledCard, trumpSuit));
    if (mustPlay.length > 0) return mustPlay; // must play one of these

    // All trumps are top trumps higher than led — can renege
    return hand;
  } else {
    // Non-trump led — may follow suit or trump; discard only if void in both
    const suitInHand = hand.filter(c => c.suit === ledSuit && !isTrump(c, trumpSuit));
    if (suitInHand.length > 0) {
      const trumpsInHand = hand.filter(c => isTrump(c, trumpSuit));
      return [...suitInHand, ...trumpsInHand];
    }
    return hand; // void in led suit — play anything
  }
}

// ============================================================
//  GAME STATE
// ============================================================

function createGameState(playerNames) {
  return {
    players: playerNames.map((name, i) => ({
      name,
      isHuman: i === 0,
      hand: [],
      tricksWon: 0,
      score: 0,
    })),
    deck: [],
    trumpCard: null,
    trumpSuit: null,
    currentTrick: [],
    trickHistory: [],
    currentPlayer: 0,
    dealer: 0,
    phase: 'dealing', // dealing → robbing → playing → scoring → gameover
    round: 1,
  };
}

function dealHands(state) {
  state.deck = shuffle(createDeck());
  // Deal 5 cards to each player
  for (const player of state.players) {
    player.hand = state.deck.splice(0, 5);
    player.tricksWon = 0;
  }
  // Turn up trump card
  state.trumpCard = state.deck.splice(0, 1)[0];
  state.trumpSuit = state.trumpCard.suit;
  // First player left of dealer leads
  state.currentPlayer = (state.dealer + 1) % state.players.length;
  state.currentTrick = [];
  state.phase = 'robbing';
  return state;
}

// Check if any player holds the ace of trumps and can rob
function whoCanRob(state) {
  return state.players.findIndex(p =>
    p.hand.some(c => c.value === 'A' && c.suit === state.trumpSuit)
  );
}

// Rob the pack — swap trump card into hand, discard a card
function robPack(state, playerIndex, discardCard) {
  const player = state.players[playerIndex];
  // Add trump card to hand
  player.hand.push(state.trumpCard);
  // Remove discarded card
  player.hand = player.hand.filter(
    c => !(c.value === discardCard.value && c.suit === discardCard.suit)
  );
  state.phase = 'playing';
  return state;
}

// Play a card from a player's hand into the current trick
function playCard(state, playerIndex, card) {
  const player = state.players[playerIndex];
  // Remove card from hand
  player.hand = player.hand.filter(
    c => !(c.value === card.value && c.suit === card.suit)
  );
  state.currentTrick.push({ card, playerIndex });

  // If all players have played, resolve the trick
  if (state.currentTrick.length === state.players.length) {
    return resolveTrick(state);
  }

  // Next player's turn
  state.currentPlayer = (playerIndex + 1) % state.players.length;
  return state;
}

function resolveTrick(state) {
  const winner = trickWinner(state.currentTrick, state.trumpSuit);
  state.players[winner.playerIndex].tricksWon++;
  state.players[winner.playerIndex].score += 5;

  state.trickHistory.push({
    trick: [...state.currentTrick],
    winner: winner.playerIndex
  });
  state.currentTrick = [];

  if (state.players[winner.playerIndex].score >= 25) {
    state.phase = 'gameover';
    state.winner = state.players[winner.playerIndex].name;
    return state;
  }

  if (state.trickHistory.length === 5) {
    state.phase = 'scoring';
    return state;
  }

  state.currentPlayer = winner.playerIndex;
  return state;
}

// ============================================================
//  EXPORTS — available to ui.js and ai.js
// ============================================================

window.Game = {
  createGameState,
  dealHands,
  whoCanRob,
  robPack,
  playCard,
  legalCards,
  isTrump,
  rankCard,
  cardLabel,
  trickWinner,
};