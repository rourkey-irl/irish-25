// Simple but rule-correct AI
// Strategy: win tricks we need, dump low cards otherwise

function aiChooseCard(hand, state, playerIndex) {
  const trick = state.currentTrick;
  const trumpSuit = state.trumpSuit;
  const ledCard = trick.length > 0 ? trick[0].card : null;
  const legal = Game.legalCards(hand, ledCard, trumpSuit);

  // Sort legal cards by rank
  const ranked = [...legal].sort(
    (a, b) => Game.rankCard(b, trumpSuit) - Game.rankCard(a, trumpSuit)
  );

  // If leading — play highest trump if we have one, else highest card
  if (!ledCard) {
    const trumps = ranked.filter(c => Game.isTrump(c, trumpSuit));
    return trumps.length > 0 ? trumps[0] : ranked[0];
  }

  // If a trump is already winning the trick, dump our lowest card
  const currentWinner = Game.trickWinner(trick, trumpSuit);
  const winnerIsTrump = Game.isTrump(currentWinner.card, trumpSuit);

  // Try to win if we can beat the current best
  const canWin = ranked.filter(c =>
    Game.rankCard(c, trumpSuit) > Game.rankCard(currentWinner.card, trumpSuit) &&
    (Game.isTrump(c, trumpSuit) || c.suit === trick[0].card.suit)
  );

  if (canWin.length > 0) {
    // Win with the lowest winning card (don't waste high trumps)
    return canWin[canWin.length - 1];
  }

  // Can't win — play lowest ranked legal card
  return ranked[ranked.length - 1];
}

window.AI = { aiChooseCard };