const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Object to keep track of connected players
const players = {};

// Game state object
const gameState = {
  allCards: [
    // Era 1 Cards
    { name: 'Mr. Potato', era: 'Era 1', strength: 6, damage: 4, ability: 'Potato Shield', abilityDesc: 'Reduce incoming damage by 2', image: 'Mr. Potatoe.png' },
    { name: 'Mr. Bob', era: 'Era 1', strength: 5, damage: 5, ability: "Bob's Rally", abilityDesc: 'All Era 1 cards gain +1 Strength', image: 'Mr. Bob.png' },
    { name: 'Mr. Dog', era: 'Era 1', strength: 7, damage: 3, ability: 'Loyal Companion', abilityDesc: 'Gain 1 extra buck if you win', image: 'Mr. Dog.png' },
    { name: 'Mr. Bones', era: 'Era 1', strength: 4, damage: 6, ability: 'Bone Crush', abilityDesc: '+2 damage', image: 'Mr. Bones.png' },
    { name: 'Mr. Beans', era: 'Era 1', strength: 3, damage: 7, ability: 'Gas Cloud', abilityDesc: 'Opponent\'s card loses 1 Strength', image: 'Mr. Beans.png' },
    // Era 2 Cards
    { name: 'Trumpet', era: 'Era 2', strength: 5, damage: 5, ability: 'Sound Blast', abilityDesc: '+2 damage', image: 'Trumpet.png' },
    { name: 'Boden', era: 'Era 2', strength: 6, damage: 4, ability: 'Strategic Insight', abilityDesc: 'Opponent loses 1 Buck', image: 'Boden.png' },
    { name: 'Musket', era: 'Era 2', strength: 7, damage: 3, ability: 'Piercing Shot', abilityDesc: 'Ignore opponent\'s abilities', image: 'Musket.png' },
    { name: 'Pnut', era: 'Era 2', strength: 4, damage: 6, ability: 'Nut Barrage', abilityDesc: '+2 Strength', image: 'Pnut.png' },
    { name: 'Old Man', era: 'Era 2', strength: 3, damage: 7, ability: 'Wise Advice', abilityDesc: 'Gain 2 LP', image: 'Old Man.png' },
    // Era 3 Cards
    { name: 'Mikey', era: 'Era 3', strength: 6, damage: 4, ability: 'Tech Savvy', abilityDesc: 'Opponent\'s damage reduced by 2', image: 'Mikey.png' },
    { name: 'Chadman', era: 'Era 3', strength: 7, damage: 3, ability: 'Power Flex', abilityDesc: '+3 Strength', image: 'Chadman.png' },
    { name: 'Donerman', era: 'Era 3', strength: 5, damage: 5, ability: 'Late Night Snack', abilityDesc: 'Gain 2 Bucks', image: 'Donerman.png' },
    { name: 'Turkiman', era: 'Era 3', strength: 4, damage: 6, ability: 'Feast', abilityDesc: 'Gain 2 LP', image: 'Turkiman.png' },
    { name: 'Burningman', era: 'Era 3', strength: 3, damage: 7, ability: 'Flame Aura', abilityDesc: 'Opponent loses 2 LP', image: 'Burningman.png' },
    // Era 4 Cards
    { name: 'Samwichman', era: 'Era 4', strength: 6, damage: 4, ability: 'Layered Attack', abilityDesc: 'Strength is doubled', image: 'Samwichman.png' },
    { name: 'Toat', era: 'Era 4', strength: 5, damage: 5, ability: 'Burnt Toast', abilityDesc: 'Opponent\'s card loses 2 Strength', image: 'Toat.png' },
    { name: 'Forkman', era: 'Era 4', strength: 7, damage: 3, ability: 'Sharp Edges', abilityDesc: '+3 damage', image: 'Forkman.png' },
    { name: 'Dishspencer', era: 'Era 4', strength: 4, damage: 6, ability: 'Dish Throw', abilityDesc: 'Opponent loses 2 LP', image: 'Dishspencer.png' },
    { name: 'Chairman', era: 'Era 4', strength: 3, damage: 7, ability: 'Heavy Seat', abilityDesc: 'Opponent loses 1 Buck', image: 'Chairman.png' },
  ],
  player1: null,
  player2: null,
  currentPlayer: null,
  selectionPhase: 'attacker',
  gameOver: false,
  startingPlayer: null,
  battleResult: null,
  round: 1, // Track the current round (max 4)
};

// Socket.io Connection Handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle player joining the game
  socket.on('joinGame', (playerChoice) => {
    try {
      if (playerChoice !== 'senf' && playerChoice !== 'börek') {
        socket.emit('error', 'Invalid player choice.');
        console.error(`Invalid player choice by ${socket.id}: ${playerChoice}`);
        return;
      }

      // Assign player to player1 or player2
      if (!gameState.player1) {
        gameState.player1 = initializePlayer(playerChoice, socket.id);
        players[socket.id] = gameState.player1;
        socket.emit('playerData', { playerName: playerChoice, playerId: socket.id });
        console.log(`${playerChoice} joined as Player 1.`);
      } else if (!gameState.player2) {
        gameState.player2 = initializePlayer(playerChoice, socket.id);
        players[socket.id] = gameState.player2;
        socket.emit('playerData', { playerName: playerChoice, playerId: socket.id });
        console.log(`${playerChoice} joined as Player 2.`);

        // Start the game when both players have joined
        startGame();
      } else {
        socket.emit('gameFull');
        console.warn(`Game full. Player ${playerChoice} (${socket.id}) cannot join.`);
      }
    } catch (error) {
      console.error('Error in joinGame:', error);
      socket.emit('error', 'An error occurred while joining the game.');
    }
  });

  // Handle player actions (e.g., selecting cards, boosting with bucks)
  socket.on('playerAction', (data) => {
    try {
      handlePlayerAction(socket.id, data);
    } catch (error) {
      console.error('Error in playerAction:', error);
      socket.emit('error', 'An error occurred while processing your action.');
    }
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    if (players[socket.id]) {
      const disconnectedPlayer = players[socket.id].name;
      delete players[socket.id];
      io.emit('playerDisconnected', `${disconnectedPlayer} has left the game.`);
      resetGameState();
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// ===================== Helper Functions =====================

// Initialize a new player with default stats
function initializePlayer(name, id) {
  return {
    name,
    id,
    lp: 12, // Reduced from 15 to 12
    bucks: 12, // Reduced from 15 to 12
    field: [], // Each player will have exactly 4 cards on the field
    selectedCard: null,
    selectedBucks: 0,
    tempVariables: {},
  };
}

// Reset the game state to initial conditions
function resetGameState() {
  gameState.player1 = null;
  gameState.player2 = null;
  gameState.currentPlayer = null;
  gameState.selectionPhase = 'attacker';
  gameState.gameOver = false;
  gameState.startingPlayer = null;
  gameState.battleResult = null;
  gameState.round = 1;
  console.log('Game state has been reset.');
}

// Start the game by initializing decks, dealing cards, and setting the first player
function startGame() {
  console.log('Both players have joined. Starting the game.');

  // Assign exactly 4 cards to each player's field
  gameState.player1.field = selectRandomCards(4);
  gameState.player2.field = selectRandomCards(4);

  console.log(`Player 1 Field: ${gameState.player1.field.map(card => card.name).join(', ')}`);
  console.log(`Player 2 Field: ${gameState.player2.field.map(card => card.name).join(', ')}`);

  // Decide the starting player randomly
  gameState.currentPlayer = Math.random() < 0.5 ? gameState.player1 : gameState.player2;
  gameState.startingPlayer = gameState.currentPlayer;

  console.log(`Starting Player: ${gameState.currentPlayer.name}`);

  // Emit the initial game state to both players
  io.emit('gameStarted', gameState);
}

// Select a specified number of random unique cards for a player's field
function selectRandomCards(count) {
  const allCardsCopy = [...gameState.allCards];
  const selectedCards = [];

  for (let i = 0; i < count; i++) {
    if (allCardsCopy.length === 0) break;
    const randomIndex = Math.floor(Math.random() * allCardsCopy.length);
    selectedCards.push(allCardsCopy.splice(randomIndex, 1)[0]);
  }

  return selectedCards;
}

// Handle player actions such as selecting a card or submitting a move
function handlePlayerAction(socketId, data) {
  const player = players[socketId];
  const opponent = player === gameState.player1 ? gameState.player2 : gameState.player1;

  // Validate game state
  if (gameState.gameOver) {
    console.warn('Action received after game over.');
    return;
  }

  if (!player || !opponent) {
    console.warn('Player or opponent not found.');
    return;
  }

  if (gameState.currentPlayer.id !== socketId) {
    console.warn(`It's not ${player.name}'s turn.`);
    return;
  }

  switch (data.action) {
    case 'selectCard':
      // Validate selected card index
      if (typeof data.selectedCard !== 'number' || data.selectedCard < 0 || data.selectedCard >= player.field.length) {
        console.warn(`Invalid card selection by ${player.name}: ${data.selectedCard}`);
        return;
      }
      player.selectedCard = data.selectedCard;
      console.log(`${player.name} selected card index ${data.selectedCard}: ${player.field[data.selectedCard].name}`);
      break;

    case 'submitMove':
      const selectedBucks = parseInt(data.selectedBucks, 10);
      // Validate selected bucks
      if (isNaN(selectedBucks) || selectedBucks < 0 || selectedBucks > player.bucks) {
        console.warn(`Invalid bucks selection by ${player.name}: ${selectedBucks}`);
        return;
      }
      player.selectedBucks = selectedBucks;
      player.bucks -= selectedBucks;
      console.log(`${player.name} boosted with ${selectedBucks} bucks.`);

      // Check if both players have made their selections
      if (gameState.selectionPhase === 'attacker') {
        gameState.selectionPhase = 'defender';
        gameState.currentPlayer = opponent;
        console.log('Phase changed to defender.');
      } else {
        // Resolve the battle if both players have made their selections
        if (gameState.selectionPhase === 'defender') {
          resolveBattle();
        }
      }
      break;

    case 'cancelSelection':
      // Reset player's selected card and bucks
      player.selectedCard = null;
      player.selectedBucks = 0;
      console.log(`${player.name} canceled their card selection.`);
      break;

    default:
      console.warn(`Unknown action received: ${data.action}`);
      break;
  }

  // Emit the updated game state to both players
  io.emit('gameState', gameState);
}

// Resolve the battle between selected cards
function resolveBattle() {
  console.log(`Resolving battle for Round ${gameState.round}.`);

  const attackerPlayer = gameState.startingPlayer;
  const defenderPlayer = attackerPlayer === gameState.player1 ? gameState.player2 : gameState.player1;

  const attacker = attackerPlayer.field[attackerPlayer.selectedCard];
  const defender = defenderPlayer.field[defenderPlayer.selectedCard];

  console.log(`Attacker: ${attacker.name} (Player: ${attackerPlayer.name})`);
  console.log(`Defender: ${defender.name} (Player: ${defenderPlayer.name})`);

  // Initialize temporary variables for abilities
  attacker.tempStrength = attacker.strength;
  defender.tempStrength = defender.strength;
  attacker.extraDamage = 0;
  defender.extraDamage = 0;

  attackerPlayer.tempVariables = {};
  defenderPlayer.tempVariables = {};

  // Apply abilities
  applyAbilities(attackerPlayer, defenderPlayer, attacker);
  applyAbilities(defenderPlayer, attackerPlayer, defender);

  // Calculate effective strengths
  let attackerStrength = attacker.tempStrength;
  let defenderStrength = defender.tempStrength;

  // Apply opponent's strength reduction abilities
  if (defenderPlayer.tempVariables.activeCardStrengthReduction && !attackerPlayer.tempVariables.abilitiesIgnored) {
    attackerStrength -= defenderPlayer.tempVariables.activeCardStrengthReduction;
    console.log(`${attacker.name}'s strength reduced by ${defenderPlayer.tempVariables.activeCardStrengthReduction}`);
  }

  if (attackerPlayer.tempVariables.activeCardStrengthReduction && !defenderPlayer.tempVariables.abilitiesIgnored) {
    defenderStrength -= attackerPlayer.tempVariables.activeCardStrengthReduction;
    console.log(`${defender.name}'s strength reduced by ${attackerPlayer.tempVariables.activeCardStrengthReduction}`);
  }

  // Ensure strengths are not negative
  attackerStrength = Math.max(0, attackerStrength);
  defenderStrength = Math.max(0, defenderStrength);

  // Calculate total strengths with bucks boost
  const attackerTotalStrength = attackerStrength * (1 + attackerPlayer.selectedBucks);
  const defenderTotalStrength = defenderStrength * (1 + defenderPlayer.selectedBucks);

  console.log(`Attacker Total Strength: ${attackerTotalStrength}`);
  console.log(`Defender Total Strength: ${defenderTotalStrength}`);

  // Determine battle outcome
  let battleOutcome = ''; // 'attacker', 'defender', or 'tie'
  let damage = 0;

  if (attackerTotalStrength > defenderTotalStrength) {
    battleOutcome = 'attacker';
    damage = attacker.damage + (attacker.extraDamage || 0);

    // Apply opponent's incoming damage reduction
    if (defenderPlayer.tempVariables.incomingDamageReduction && !attackerPlayer.tempVariables.abilitiesIgnored) {
      damage -= defenderPlayer.tempVariables.incomingDamageReduction;
      console.log(`${defender.name}'s incoming damage reduced by ${defenderPlayer.tempVariables.incomingDamageReduction}`);
    }

    damage = Math.max(0, damage);
    defenderPlayer.lp -= damage;

    console.log(`${attackerPlayer.name} wins the battle and deals ${damage} damage to ${defenderPlayer.name}.`);

    // Check for abilities that activate on win
    if (attackerPlayer.tempVariables.loyalCompanion) {
      attackerPlayer.bucks += 1;
      console.log(`${attackerPlayer.name} gains 1 extra buck due to Loyal Companion.`);
    }

  } else if (defenderTotalStrength > attackerTotalStrength) {
    battleOutcome = 'defender';
    damage = defender.damage + (defender.extraDamage || 0);

    // Apply opponent's incoming damage reduction
    if (attackerPlayer.tempVariables.incomingDamageReduction && !defenderPlayer.tempVariables.abilitiesIgnored) {
      damage -= attackerPlayer.tempVariables.incomingDamageReduction;
      console.log(`${attacker.name}'s incoming damage reduced by ${attackerPlayer.tempVariables.incomingDamageReduction}`);
    }

    damage = Math.max(0, damage);
    attackerPlayer.lp -= damage;

    console.log(`${defenderPlayer.name} wins the battle and deals ${damage} damage to ${attackerPlayer.name}.`);

    // Check for abilities that activate on win
    if (defenderPlayer.tempVariables.loyalCompanion) {
      defenderPlayer.bucks += 1;
      console.log(`${defenderPlayer.name} gains 1 extra buck due to Loyal Companion.`);
    }

  } else {
    battleOutcome = 'tie';
    console.log('The battle ended in a tie. No damage dealt.');
  }

  // Set battleResult in gameState
  gameState.battleResult = {
    id: Date.now(),
    attackerCardIndex: attackerPlayer.selectedCard,
    defenderCardIndex: defenderPlayer.selectedCard,
    winner: battleOutcome, // 'attacker', 'defender', or 'tie'
    damageDealt: damage,
    lpChanges: {
      [attackerPlayer.id]: attackerPlayer.lp,
      [defenderPlayer.id]: defenderPlayer.lp,
    },
    attackerId: attackerPlayer.id,
    defenderId: defenderPlayer.id,
  };

  console.log('Battle Result:', gameState.battleResult);

  // Remove used cards from the field (no replacements)
  removeCardsFromField(attackerPlayer);
  removeCardsFromField(defenderPlayer);

  // Reset temporary variables
  resetPlayerTempVariables(attackerPlayer);
  resetPlayerTempVariables(defenderPlayer);

  // Check for game over conditions
  if (attackerPlayer.lp <= 0 || defenderPlayer.lp <= 0) {
    gameState.gameOver = true;
    console.log('Game Over due to LP reaching 0.');
  } else if (gameState.round >= 4) { // 4 rounds
    gameState.gameOver = true;
    console.log('Game Over after 4 rounds.');
  }

  // Prepare for next turn
  if (!gameState.gameOver) {
    gameState.round += 1;
    gameState.selectionPhase = 'attacker';
    gameState.startingPlayer = gameState.startingPlayer === gameState.player1 ? gameState.player2 : gameState.player1;
    gameState.currentPlayer = gameState.startingPlayer;

    // Reset selections
    gameState.player1.selectedCard = null;
    gameState.player2.selectedCard = null;
    gameState.player1.selectedBucks = 0;
    gameState.player2.selectedBucks = 0;

    console.log(`Round ${gameState.round} starts. Current Player: ${gameState.currentPlayer.name}`);
  }

  // Emit updated game state to both players
  io.emit('gameState', gameState);
}

// Apply card abilities to players and opponents
function applyAbilities(player, opponent, card) {
  // Abilities always activate
  switch (card.ability) {
    case 'Potato Shield':
      // Reduce incoming damage by 2
      player.tempVariables.incomingDamageReduction += 2;
      console.log(`${player.name}'s Potato Shield reduces incoming damage by 2.`);
      break;

    case "Bob's Rally":
      // Increase all Era 1 cards' strength by 1
      player.field.forEach(c => {
        if (c.era === 'Era 1') {
          c.tempStrength += 1;
          console.log(`${player.name}'s Bob's Rally increases ${c.name}'s strength by 1.`);
        }
      });
      break;

    case 'Loyal Companion':
      // Gain 1 extra buck if you win
      player.tempVariables.loyalCompanion = true;
      console.log(`${player.name} has Loyal Companion ability active.`);
      break;

    case 'Bone Crush':
      // Deal 2 extra damage
      card.extraDamage = (card.extraDamage || 0) + 2;
      console.log(`${card.name}'s Bone Crush adds +2 damage.`);
      break;

    case 'Gas Cloud':
      // Reduce opponent's strength by 1
      opponent.tempVariables.activeCardStrengthReduction += 1;
      console.log(`${opponent.name}'s card strength reduced by 1 due to Gas Cloud.`);
      break;

    // Era 2 Abilities
    case 'Sound Blast':
      card.extraDamage = (card.extraDamage || 0) + 2;
      console.log(`${card.name}'s Sound Blast adds +2 damage.`);
      break;

    case 'Strategic Insight':
      opponent.bucks = Math.max(0, opponent.bucks - 1);
      console.log(`${opponent.name} loses 1 buck due to Strategic Insight.`);
      break;

    case 'Piercing Shot':
      opponent.tempVariables.abilitiesIgnored = true;
      console.log(`${opponent.name}'s abilities are ignored due to Piercing Shot.`);
      break;

    case 'Nut Barrage':
      card.tempStrength += 2;
      console.log(`${card.name}'s Nut Barrage increases strength by 2.`);
      break;

    case 'Wise Advice':
      player.lp += 2;
      console.log(`${player.name} gains 2 LP due to Wise Advice.`);
      break;

    // Era 3 Abilities
    case 'Tech Savvy':
      opponent.tempVariables.activeCardDamageReduction += 2;
      console.log(`${opponent.name}'s damage reduced by 2 due to Tech Savvy.`);
      break;

    case 'Power Flex':
      card.tempStrength += 3;
      console.log(`${card.name}'s Power Flex increases strength by 3.`);
      break;

    case 'Late Night Snack':
      player.bucks += 2;
      console.log(`${player.name} gains 2 bucks due to Late Night Snack.`);
      break;

    case 'Feast':
      player.lp += 2;
      console.log(`${player.name} gains 2 LP due to Feast.`);
      break;

    case 'Flame Aura':
      opponent.lp -= 2;
      console.log(`${opponent.name} loses 2 LP due to Flame Aura.`);
      break;

    // Era 4 Abilities
    case 'Layered Attack':
      card.tempStrength *= 2;
      console.log(`${card.name}'s Layered Attack doubles its strength.`);
      break;

    case 'Burnt Toast':
      opponent.tempVariables.activeCardStrengthReduction += 2;
      console.log(`${opponent.name}'s card strength reduced by 2 due to Burnt Toast.`);
      break;

    case 'Sharp Edges':
      card.extraDamage = (card.extraDamage || 0) + 3;
      console.log(`${card.name}'s Sharp Edges adds +3 damage.`);
      break;

    case 'Dish Throw':
      opponent.lp -= 2;
      console.log(`${opponent.name} loses 2 LP due to Dish Throw.`);
      break;

    case 'Heavy Seat':
      opponent.bucks = Math.max(0, opponent.bucks - 1);
      console.log(`${opponent.name} loses 1 buck due to Heavy Seat.`);
      break;

    default:
      console.warn(`Unknown ability: ${card.ability}`);
      break;
  }
}

// Reset temporary variables after a battle
function resetPlayerTempVariables(player) {
  player.tempVariables = {};
  player.field.forEach(card => {
    card.tempStrength = card.strength;
    card.extraDamage = 0;
  });
  console.log(`${player.name}'s temporary variables have been reset.`);
}

// Remove used cards from the field (no replacements)
function removeCardsFromField(player) {
  if (player.selectedCard < player.field.length) {
    const removedCard = player.field.splice(player.selectedCard, 1)[0];
    console.log(`${player.name} used card: ${removedCard.name} and it has been removed from the field.`);
  }
  player.selectedCard = null;
  player.selectedBucks = 0;
}

// Shuffle an array using Fisher-Yates algorithm
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
