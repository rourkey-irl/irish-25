let state = null;
let currentUser = null;
const AI_DELAY = 900; // ms between AI plays

// ── Boot ──────────────────────────────────────────────────

async function boot() {
  const res = await fetch('/api/me');
  const data = await res.json();
  if (!data.user) { window.location.href = '/'; return; }
  currentUser = data.user;
  document.getElementById('welcome-msg').textContent = `👤 ${currentUser.username}`;
  document.getElementById('player-name-display').textContent = currentUser.username;
  setMessage('Welcome! Press "Deal new game" to start.');
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// ── Game flow ─────────────────────────────────────────────

function startGame() {
  const names = [currentUser.username, 'Séamus', 'Brigid', 'Ciarán', 'Aoife', 'Pádraig'];
  state = Game.createGameState(names);
  state = Game.dealHands(state);
  document.getElementById('btn-start').textContent = 'Deal new game';
  checkRobbing();
}

function checkRobbing() {
  const robberIndex = Game.whoCanRob(state);
  if (robberIndex === -1) {
    state.phase = 'playing';
    renderAll();
    if (state.currentPlayer !== 0) setTimeout(aiTurn, AI_DELAY);
    return;
  }

  renderAll();

  if (robberIndex === 0) {
    // Human can rob
    setMessage(`You hold the A${suitSymbol(state.trumpSuit)} — you may rob the pack!`);
    document.getElementById('btn-rob').style.display = 'inline-block';
    document.getElementById('btn-skip-rob').style.display = 'inline-block';
  } else {
    // AI robs automatically
    setMessage(`${state.players[robberIndex].name} robs the pack!`);
    const ai = state.players[robberIndex];
    // AI discards its lowest ranked card
    const sorted = [...ai.hand].sort(
      (a, b) => Game.rankCard(a, state.trumpSuit) - Game.rankCard(b, state.trumpSuit)
    );
    state = Game.robPack(state, robberIndex, sorted[0]);
    setTimeout(() => {
      state.phase = 'playing';
      renderAll();
      if (state.currentPlayer !== 0) setTimeout(aiTurn, AI_DELAY);
    }, 1000);
  }
}

function showRobUI() {
  setMessage('Click a card in your hand to discard it and take the trump card.');
  document.getElementById('btn-rob').style.display = 'none';
  document.getElementById('btn-skip-rob').style.display = 'none';
  renderHand(true); // render hand in "rob discard" mode
}

function skipRob() {
  document.getElementById('btn-rob').style.display = 'none';
  document.getElementById('btn-skip-rob').style.display = 'none';
  state.phase = 'playing';
  renderAll();
  if (state.currentPlayer !== 0) setTimeout(aiTurn, AI_DELAY);
}

function handleRobDiscard(card) {
  state = Game.robPack(state, 0, card);
  state.phase = 'playing';
  renderAll();
  if (state.currentPlayer !== 0) setTimeout(aiTurn, AI_DELAY);
}

function nextRound() {
  document.getElementById('btn-next-round').style.display = 'none';
  state.dealer = (state.dealer + 1) % state.players.length;
  state.round++;
  state.trickHistory = [];
  state = Game.dealHands(state);
  checkRobbing();
}

// ── Card play ─────────────────────────────────────────────

function humanPlayCard(card) {
  if (state.phase !== 'playing') return;
  if (state.currentPlayer !== 0) return;

  const ledCard = state.currentTrick.length > 0 ? state.currentTrick[0].card : null;
  const legal = Game.legalCards(state.players[0].hand, ledCard, state.trumpSuit);
  const isLegal = legal.some(c => c.value === card.value && c.suit === card.suit);
  if (!isLegal) { setMessage("You can't play that card!"); return; }

  state = Game.playCard(state, 0, card);
  renderAll();
  handleAfterPlay();
}

function aiTurn() {
  if (state.phase !== 'playing') return;
  const idx = state.currentPlayer;
  const ai = state.players[idx];
  const card = AI.aiChooseCard(ai.hand, state, idx);
  state = Game.playCard(state, idx, card);
  renderAll();
  handleAfterPlay();
}

function handleAfterPlay() {
  if (state.phase === 'scoring') {
    handleScoring();
    return;
  }
  if (state.phase === 'gameover') {
    handleGameOver();
    return;
  }
  // Trick just completed — pause so player can see it
  if (state.currentTrick.length === 0 && state.trickHistory.length > 0) {
    const last = state.trickHistory[state.trickHistory.length - 1];
    const winnerName = state.players[last.winner].name;
    setMessage(`${winnerName} wins the trick!`);
    setTimeout(() => {
      renderAll();
      if (state.currentPlayer !== 0) setTimeout(aiTurn, AI_DELAY);
    }, 1200);
    return;
  }
  if (state.currentPlayer !== 0) setTimeout(aiTurn, AI_DELAY);
}

function handleScoring() {
  let msg = '';
  let poolWinner = state.players.findIndex(p => p.tricksWon >= 3);
  if (poolWinner >= 0) {
    msg = `${state.players[poolWinner].name} wins the round with ${state.players[poolWinner].tricksWon} tricks!`;
    if (state.players[poolWinner].tricksWon === 5) msg += ' 🏆 All five tricks!';
  } else {
    msg = 'Spoiled! No one won 3 tricks.';
  }
  setMessage(msg);
  renderScores();

  // Save result to server if human was involved
  if (poolWinner === 0) {
    fetch('/api/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: 'win', tricks: state.players[0].tricksWon })
    });
  } else if (poolWinner > 0) {
    fetch('/api/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: 'loss', tricks: state.players[0].tricksWon })
    });
  }

  if (state.phase !== 'gameover') {
    document.getElementById('btn-next-round').style.display = 'inline-block';
  }
}

function handleGameOver() {
  renderAll();
  setMessage(`🏆 ${state.winner} wins the game with 25 points!`);
  document.getElementById('btn-start').textContent = 'Play again';
}

// ── Rendering ─────────────────────────────────────────────

function renderAll() {
  renderOpponents();
  renderTrump();
  renderTrick();
  renderHand(false);
  renderScores();
  renderPool();

  const isMyTurn = state.phase === 'playing' && state.currentPlayer === 0;
  document.getElementById('player-area').classList.toggle('your-turn', isMyTurn);
  setMessage(isMyTurn
    ? "Your turn — choose a card to play."
    : state.phase === 'playing'
      ? `${state.players[state.currentPlayer].name} is playing...`
      : "");
}

function renderOpponents() {
  for (let i = 1; i <= 5; i++) {
    const seat = document.getElementById(`seat-${i}`);
    const player = state && state.players[i];
    if (!player) { seat.classList.remove('active'); continue; }

    seat.classList.add('active');
    seat.classList.toggle('current-turn',
      state.phase === 'playing' && state.currentPlayer === i);

    seat.innerHTML = `
      <div class="opp-name">${player.name}</div>
      <div class="opp-cards">
        ${player.hand.map(() => '<div class="opp-card-back"></div>').join('')}
      </div>
      <div class="opp-tricks">Tricks: ${player.tricksWon}</div>
      <div class="opp-score">Score: ${player.score}</div>
    `;
  }
}

function renderTrump() {
  if (!state) return;
  const sym = suitSymbol(state.trumpSuit);
  const col = isRed(state.trumpSuit) ? '♥♦' : '♣♠';
  document.getElementById('trump-display').textContent =
    `Trump: ${Game.cardLabel(state.trumpCard)} ${sym}`;
  document.getElementById('round-display').textContent = `Round ${state.round}`;
}

function renderTrick() {
  const area = document.getElementById('trick-area');
  if (!state || state.currentTrick.length === 0) {
    // Show last completed trick briefly
    if (state && state.trickHistory.length > 0) {
      const last = state.trickHistory[state.trickHistory.length - 1];
      area.innerHTML = last.trick.map(t => cardHTML(t.card, false, false,
        t.playerIndex === last.winner, state.players[t.playerIndex].name)).join('');
    } else {
      area.innerHTML = '';
    }
    return;
  }
  area.innerHTML = state.currentTrick.map(t =>
    cardHTML(t.card, false, false, false, state.players[t.playerIndex].name)
  ).join('');
}

function renderHand(robMode) {
  const area = document.getElementById('player-hand');
  if (!state) { area.innerHTML = ''; return; }

  const hand = state.players[0].hand;
  const ledCard = state.currentTrick.length > 0 ? state.currentTrick[0].card : null;
  const isMyTurn = state.phase === 'playing' && state.currentPlayer === 0;
  const legal = isMyTurn
    ? Game.legalCards(hand, ledCard, state.trumpSuit)
    : hand;

  area.innerHTML = hand.map(card => {
    const isLegal = legal.some(c => c.value === card.value && c.suit === card.suit);
    const clickable = robMode ? true : (isMyTurn && isLegal);
    const disabled = isMyTurn && !isLegal;
    const highlight = !robMode && isMyTurn && isLegal;
    const isTrump = Game.isTrump(card, state.trumpSuit);
    return cardHTML(card, disabled, isTrump, false, null, clickable, highlight);
  }).join('');

  // Attach click listeners properly after rendering
  area.querySelectorAll('.card:not(.disabled)').forEach(el => {
    el.addEventListener('click', () => {
      const card = { suit: el.dataset.suit, value: el.dataset.value };
      if (robMode) {
        handleRobDiscard(card);
      } else {
        humanPlayCard(card);
      }
    });
  });

  // Hover explanation for illegal cards
  if (isMyTurn) {
    area.querySelectorAll('.card.disabled').forEach(el => {
      el.addEventListener('mouseenter', () => setMessage("You must follow suit — only the glowing cards can be played."));
      el.addEventListener('mouseleave', () => setMessage("Your turn — choose a card to play."));
    });
  }

  document.getElementById('player-tricks-display').textContent =
    `Tricks: ${state.players[0].tricksWon}`;
  document.getElementById('player-score-display').textContent =
    `Score: ${state.players[0].score}`;
}

function cardHTML(card, disabled, isTrump, isWinner, playerName, clickable, highlight) {
  const red = isRed(card.suit);
  const sym = suitSymbol(card.suit);
  const classes = [
    'card',
    red ? 'red' : '',
    disabled ? 'disabled' : '',
    isTrump ? 'trump-card' : '',
    playerName ? 'card-in-trick' : '',
    isWinner ? 'trick-winner-card' : '',
    highlight ? 'legal-card' : '',
  ].filter(Boolean).join(' ');

  const nameTag = playerName
    ? `<div class="trick-player-name">${playerName}</div>` : '';

  return `
    <div class="${classes}" 
         data-suit="${card.suit}" 
         data-value="${card.value}"
         style="${clickable ? 'cursor:pointer' : ''}">
      <div class="card-value">${card.value}</div>
      <div class="card-suit">${sym}</div>
      ${nameTag}
    </div>`;
}

function renderScores() {
  if (!state) return;
  const maxScore = Math.max(...state.players.map(p => p.score));
  document.getElementById('score-list').innerHTML = state.players.map(p => `
    <div class="score-row${p.score === maxScore && maxScore > 0 ? ' leader' : ''}">
      <span>${p.isHuman ? '👤 ' : ''}${p.name}</span>
      <span>${p.score}</span>
    </div>
  `).join('');
}

function renderPool() {}

// ── Helpers ───────────────────────────────────────────────

function suitSymbol(suit) {
  return { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[suit] || '';
}

function isRed(suit) {
  return suit === 'hearts' || suit === 'diamonds';
}

function setMessage(msg) {
  document.getElementById('message-box').textContent = msg;
}

// ── Add result endpoint to server ─────────────────────────
// (reminder — add this to server.js)

boot();