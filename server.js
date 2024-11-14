const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();


// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Check if Supabase URL and Key are provided
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL and Key must be provided in the .env file.');
  process.exit(1); // Exit the application if not provided
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.static(path.join(__dirname)));
app.use(express.json()); // To parse JSON bodies

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to get all cards
app.get('/api/cards', (req, res) => {
  res.json(globalGameState.allCards);
});

// API endpoint to get user's decks
app.get('/api/decks', async (req, res) => {
  const user = req.query.user;
  if (!user) {
    return res.status(400).json({ error: 'User is required' });
  }

  try {
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .eq('user', user);

    if (error) {
      console.error('Error fetching decks:', error);
      return res.status(500).json({ error: 'Error fetching decks' });
    }

    res.json(data);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// API endpoint to create/update a deck
app.post('/api/decks', async (req, res) => {
  const { user, deckName, cards, deckId } = req.body;

  if (!user || !deckName || !cards || !Array.isArray(cards)) {
    return res.status(400).json({ error: 'Invalid request data' });
  }

  if (cards.length !== 8) {
    return res.status(400).json({ error: 'Deck must contain exactly 8 cards' });
  }

  try {
    if (deckId) {
      // Update existing deck
      const { data, error } = await supabase
        .from('decks')
        .update({ name: deckName, cards })
        .eq('id', deckId)
        .eq('user', user);

      if (error) {
        console.error('Error updating deck:', error);
        return res.status(500).json({ error: 'Error updating deck' });
      }

      res.json({ message: 'Deck updated successfully', deckId });
    } else {
      // Create new deck
      const { data, error } = await supabase
        .from('decks')
        .insert([{ user, name: deckName, cards }])
        .select();

      if (error) {
        console.error('Error creating deck:', error);
        return res.status(500).json({ error: 'Error creating deck' });
      }

      res.json({ message: 'Deck created successfully', deckId: data[0].id });
    }
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Object to keep track of connected players
const players = {};

// Game states for multiple games
const games = {};

// Global game state (cards and other global data)
const globalGameState = {
  allCards: [
    // Era 1 Cards: "-10 Opp. Attack, Min 9"
    { name: 'Mr. Potato', era: 'Era 1', strength: 6, damage: 4, abilityDesc: '-10 Opp. Attack, Min 9', image: 'images/Mr_Potato.png' },
    { name: 'Mr. Bob', era: 'Era 1', strength: 5, damage: 5, abilityDesc: '-10 Opp. Attack, Min 9', image: 'images/Mr_Bob.png' },
    { name: 'Mr. Dog', era: 'Era 1', strength: 7, damage: 3, abilityDesc: '-10 Opp. Attack, Min 9', image: 'images/Mr_Dog.png' },

    // Era 2 Cards: "-2 Opp. Damage, Min 1"
    { name: 'Mr. Bones', era: 'Era 2', strength: 7, damage: 3, abilityDesc: '-2 Opp. Damage, Min 1', image: 'images/Mr_Bones.png' },
    { name: 'Mr. Beans', era: 'Era 2', strength: 6, damage: 4, abilityDesc: '-2 Opp. Damage, Min 1', image: 'images/Mr_Beans.png' },
    { name: 'Trumpet', era: 'Era 2', strength: 5, damage: 5, abilityDesc: '-2 Opp. Damage, Min 1', image: 'images/Trumpet.png' },

    // Era 3 Cards: "+1 Attack Per Life Left"
    { name: 'Boden', era: 'Era 3', strength: 4, damage: 6, abilityDesc: '+1 Attack per Life Left', image: 'images/Boden.png' },
    { name: 'Musket', era: 'Era 3', strength: 5, damage: 5, abilityDesc: '+1 Attack per Life Left', image: 'images/Musket.png' },
    { name: 'Pnut', era: 'Era 3', strength: 3, damage: 7, abilityDesc: '+1 Attack per Life Left', image: 'images/Pnut.png' },

    // Era 4 Cards: "+2 Life"
    { name: 'Old Man', era: 'Era 4', strength: 5, damage: 5, abilityDesc: '+2 Life', image: 'images/Old_Man.png' },
    { name: 'Mikey', era: 'Era 4', strength: 6, damage: 4, abilityDesc: '+2 Life', image: 'images/Mikey.png' },
    { name: 'JD', era: 'Era 4', strength: 4, damage: 6, abilityDesc: '+2 Life', image: 'images/JD.png' },

    // Era 5 Cards: "Stop Opp. Ability"
    { name: 'Chadman', era: 'Era 5', strength: 6, damage: 4, abilityDesc: 'Stop Opp. Ability', image: 'images/Chadman.png' },
    { name: 'Donerman', era: 'Era 5', strength: 5, damage: 5, abilityDesc: 'Stop Opp. Ability', image: 'images/Donerman.png' },
    { name: 'Arnie', era: 'Era 5', strength: 4, damage: 6, abilityDesc: 'Stop Opp. Ability', image: 'images/Arnie.png' },

    // Era 6 Cards: "Cancel Opp. attack Modif."
    { name: 'Turkiman', era: 'Era 6', strength: 4, damage: 6, abilityDesc: 'Cancel Opp. attack Modif.', image: 'images/Turkiman.png' },
    { name: 'Burningman', era: 'Era 6', strength: 3, damage: 7, abilityDesc: 'Cancel Opp. attack Modif.', image: 'images/Burningman.png' },
    { name: 'Jakey', era: 'Era 6', strength: 5, damage: 5, abilityDesc: 'Cancel Opp. attack Modif.', image: 'images/Jakey.png' },

    // Era 7 Cards: "Damage +2"
    { name: 'Samwichman', era: 'Era 7', strength: 5, damage: 5, abilityDesc: 'Damage +2', image: 'images/Samwichman.png' },
    { name: 'Toat', era: 'Era 7', strength: 6, damage: 4, abilityDesc: 'Damage +2', image: 'images/Toat.png' },
    { name: 'Oleg', era: 'Era 7', strength: 7, damage: 3, abilityDesc: 'Damage +2', image: 'images/Oleg.png' },

    // Era 8 Cards: "Attack +8"
    { name: 'Forkman', era: 'Era 8', strength: 4, damage: 6, abilityDesc: 'Attack +8', image: 'images/Forkman.png' },
    { name: 'Dishspencer', era: 'Era 8', strength: 5, damage: 5, abilityDesc: 'Attack +8', image: 'images/Dishspencer.png' },
    { name: 'Chairman', era: 'Era 8', strength: 3, damage: 7, abilityDesc: 'Attack +8', image: 'images/Chairman.png' },
  ],
};



// Matchmaking queue
const matchmakingQueue = [];

// Socket.io Connection Handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle player login (joinGame)
  socket.on('joinGame', (playerChoice) => {
    try {
      if (playerChoice !== 'senf' && playerChoice !== 'börek') {
        socket.emit('error', 'Invalid player choice.');
        console.error(`Invalid player choice by ${socket.id}: ${playerChoice}`);
        return;
      }

      // Assign player name
      players[socket.id] = {
        name: playerChoice,
        id: socket.id,
        gameId: null,
      };

      socket.emit('playerData', { playerName: playerChoice, playerId: socket.id });
      console.log(`${playerChoice} logged in.`);
    } catch (error) {
      console.error('Error in joinGame:', error);
      socket.emit('error', 'An error occurred while joining the game.');
    }
  });

  // Handle findMatch event
  socket.on('findMatch', async (data) => {
    try {
      const { user, deckId } = data;

      if (!user || !deckId) {
        socket.emit('error', 'User and deckId are required for matchmaking.');
        return;
      }

      // Fetch the deck from Supabase
      const { data: deckData, error } = await supabase
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .eq('user', user)
        .single();

      if (error || !deckData) {
        socket.emit('error', 'Deck not found.');
        return;
      }

      // Add player to matchmaking queue
      matchmakingQueue.push({
        socket,
        user,
        deck: deckData,
        socketId: socket.id,
      });

      console.log(`Player ${user} joined matchmaking queue.`);

      // Check if there are at least two players in the queue
      if (matchmakingQueue.length >= 2) {
        // Remove the first two players from the queue and start a game
        const player1 = matchmakingQueue.shift();
        const player2 = matchmakingQueue.shift();

        startGameWithPlayers(player1, player2);
      }
    } catch (error) {
      console.error('Error in findMatch:', error);
      socket.emit('error', 'An error occurred while finding a match.');
    }
  });

  // Handle player actions (e.g., selecting cards, boosting with bucks)
  socket.on('playerAction', (data) => {
    try {
      const player = players[socket.id];
      if (!player) {
        console.warn('Player not found.');
        return;
      }

      const gameId = player.gameId;
      handlePlayerAction(socket.id, data, gameId);
    } catch (error) {
      console.error('Error in playerAction:', error);
      socket.emit('error', 'An error occurred while processing your action.');
    }
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);

    // Remove from matchmaking queue
    const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
    if (index !== -1) {
      matchmakingQueue.splice(index, 1);
      console.log(`Player ${socket.id} removed from matchmaking queue.`);
    }

    if (players[socket.id]) {
      const player = players[socket.id];
      const gameId = player.gameId;

      if (gameId && games[gameId]) {
        const gameState = games[gameId];
        const opponentSocketId = player === gameState.player1 ? gameState.player2.id : gameState.player1.id;

        // Notify opponent
        io.to(opponentSocketId).emit('playerDisconnected', `${player.name} has left the game.`);

        // Clean up
        delete games[gameId];
      }

      delete players[socket.id];
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
    lp: 12,
    bucks: 12,
    field: [],
    selectedCard: null,
    selectedBucks: 0,
    tempVariables: {},
    gameId: null,
    deck: null,
  };
}

// Start game with two players
function startGameWithPlayers(player1Data, player2Data) {
  const gameId = generateGameId(); // Implement a function to generate unique game IDs

  const player1 = initializePlayer(player1Data.user, player1Data.socketId);
  const player2 = initializePlayer(player2Data.user, player2Data.socketId);

  player1.deck = player1Data.deck;
  player2.deck = player2Data.deck;

  // Create game state for this game
  const gameState = {
    allCards: [...globalGameState.allCards], // Copy of all cards
    player1,
    player2,
    currentPlayer: null,
    selectionPhase: 'attacker',
    gameOver: false,
    startingPlayer: null,
    battleResult: null,
    round: 1,
  };

  games[gameId] = gameState;

  // Assign gameId to players
  player1.gameId = gameId;
  player2.gameId = gameId;

  // Save player data
  players[player1Data.socketId] = player1;
  players[player2Data.socketId] = player2;

  // Notify players
  player1Data.socket.emit('matchFound', { gameId, opponent: player2.name });
  player2Data.socket.emit('matchFound', { gameId, opponent: player1.name });

  // Start the game
  startGame(gameId);
}

// Start the game by initializing decks, dealing cards, and setting the first player
function startGame(gameId) {
  const gameState = games[gameId];

  console.log('Both players have joined. Starting the game.');

  // Select 4 random cards from each player's deck
  gameState.player1.field = selectRandomCardsFromDeck(gameState.player1.deck.cards, 4, gameState);
  gameState.player2.field = selectRandomCardsFromDeck(gameState.player2.deck.cards, 4, gameState);

  console.log(`Player 1 Field: ${gameState.player1.field.map(card => card.name).join(', ')}`);
  console.log(`Player 2 Field: ${gameState.player2.field.map(card => card.name).join(', ')}`);

  // Decide the starting player randomly
  gameState.currentPlayer = Math.random() < 0.5 ? gameState.player1 : gameState.player2;
  gameState.startingPlayer = gameState.currentPlayer;

  console.log(`Starting Player: ${gameState.currentPlayer.name}`);

  // Emit the initial game state to both players
  io.to(gameState.player1.id).emit('gameStarted', gameState);
  io.to(gameState.player2.id).emit('gameStarted', gameState);
}

// Select a specified number of random unique cards from the player's deck
function selectRandomCardsFromDeck(deckCards, count, gameState) {
  const deckCardsCopy = [...deckCards];
  const selectedCards = [];

  for (let i = 0; i < count; i++) {
    if (deckCardsCopy.length === 0) break;
    const randomIndex = Math.floor(Math.random() * deckCardsCopy.length);
    const cardName = deckCardsCopy.splice(randomIndex, 1)[0];
    const card = gameState.allCards.find(c => c.name === cardName);
    if (card) {
      selectedCards.push({ ...card, baseStrength: card.strength }); // Create a copy of the card object with baseStrength
    } else {
      console.warn(`Card ${cardName} not found in allCards.`);
    }
  }

  return selectedCards;
}



function prepareGameStateForPlayer(gameState, playerId) {
  // Deep copy the gameState
  const playerGameState = JSON.parse(JSON.stringify(gameState));

  // Identify the player and opponent in the copied gameState
  let player, opponent;

  if (playerGameState.player1.id === playerId) {
    player = playerGameState.player1;
    opponent = playerGameState.player2;
  } else {
    player = playerGameState.player2;
    opponent = playerGameState.player1;
  }

  // During selection phase, mask opponent's bucks if they have made their selection
  if (!gameState.gameOver && gameState.selectionPhase !== 'battle') {
    // For the opponent, if they have selected their bucks, we need to restore their bucks to before selection
    if (opponent.selectedBucks !== null && opponent.selectedBucks !== undefined) {
      opponent.bucks = opponent.bucksBeforeSelection || opponent.bucks + opponent.selectedBucks;
    }
  }

  // Remove bucksBeforeSelection from both players to avoid sending unnecessary data
  delete player.bucksBeforeSelection;
  delete opponent.bucksBeforeSelection;

  return playerGameState;
}


// Handle player actions such as selecting a card or submitting a move
function handlePlayerAction(socketId, data, gameId) {
  const gameState = games[gameId];
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

      const selectedCard = player.field[data.selectedCard];
      if (selectedCard.used) {
        io.to(player.id).emit('error', 'You cannot select a used card.');
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
      player.bucksBeforeSelection = player.bucks; // Store current bucks before deduction
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
          resolveBattle(gameId);
        }
      }
      break;

    case 'cancelSelection':
      // Reset player's selected card and bucks
      player.selectedCard = null;
      player.selectedBucks = 0;
      // Restore bucks to before selection
      if (player.bucksBeforeSelection !== undefined) {
        player.bucks = player.bucksBeforeSelection;
        delete player.bucksBeforeSelection;
      }
      console.log(`${player.name} canceled their card selection.`);
      break;

    default:
      console.warn(`Unknown action received: ${data.action}`);
      break;
  }

  // Prepare game state for each player
  const playerGameState = prepareGameStateForPlayer(gameState, socketId);
  const opponentGameState = prepareGameStateForPlayer(gameState, opponent.id);

  // Emit the updated game state to both players
  io.to(player.id).emit('gameState', playerGameState);
  io.to(opponent.id).emit('gameState', opponentGameState);
}


// Resolve the battle between selected cards
 // Resolve the battle between selected cards
// Resolve the battle between selected cards
function resolveBattle(gameId) {
  const gameState = games[gameId];

  console.log(`Resolving battle for Round ${gameState.round}.`);

  const attackerPlayer = gameState.startingPlayer;
  const defenderPlayer = attackerPlayer === gameState.player1 ? gameState.player2 : gameState.player1;

  const attacker = attackerPlayer.field[attackerPlayer.selectedCard];
  const defender = defenderPlayer.field[defenderPlayer.selectedCard];

  console.log(`Attacker: ${attacker.name} (Player: ${attackerPlayer.name})`);
  console.log(`Defender: ${defender.name} (Player: ${defenderPlayer.name})`);

  // Initialize temporary variables
  attacker.tempStrength = attacker.baseStrength || attacker.strength;
  defender.tempStrength = defender.baseStrength || defender.strength;
  attacker.extraDamage = 0;
  defender.extraDamage = 0;

  attackerPlayer.tempVariables = {};
  defenderPlayer.tempVariables = {};

  // Pre-battle phase: Apply abilities
  applyAbilities(attackerPlayer, defenderPlayer, attacker, 'preBattle');
  applyAbilities(defenderPlayer, attackerPlayer, defender, 'preBattle');

  // Determine bucks multipliers
  let attackerBucksMultiplier = 1 + attackerPlayer.selectedBucks;
  let defenderBucksMultiplier = 1 + defenderPlayer.selectedBucks;

  // Check for attack modifiers canceled
  if (attackerPlayer.tempVariables.attackModifiersCanceled) {
    attackerBucksMultiplier = 1;
    console.log(`${attackerPlayer.name}'s attack modifiers (bucks) are canceled due to opponent's ability`);
  }
  if (defenderPlayer.tempVariables.attackModifiersCanceled) {
    defenderBucksMultiplier = 1;
    console.log(`${defenderPlayer.name}'s attack modifiers (bucks) are canceled due to opponent's ability`);
  }

  // Calculate total attacks
  let attackerTotalAttack = attacker.tempStrength * attackerBucksMultiplier;
  let defenderTotalAttack = defender.tempStrength * defenderBucksMultiplier;

  // Battle phase: Apply abilities that modify attack after multiplication
  applyAbilities(attackerPlayer, defenderPlayer, attacker, 'battle');
  applyAbilities(defenderPlayer, attackerPlayer, defender, 'battle');

  // Add tempAttackBoosts to total attack
  if (attacker.tempAttackBoost) {
    attackerTotalAttack += attacker.tempAttackBoost;
    console.log(`${attacker.name}'s attack increased by ${attacker.tempAttackBoost}`);
  }
  if (defender.tempAttackBoost) {
    defenderTotalAttack += defender.tempAttackBoost;
    console.log(`${defender.name}'s attack increased by ${defender.tempAttackBoost}`);
  }

  // Apply attack reductions (Era 1 ability)
  if (defenderPlayer.tempVariables.reduceAttack) {
    attackerTotalAttack = Math.max(
      attackerTotalAttack - defenderPlayer.tempVariables.reduceAttack,
      defenderPlayer.tempVariables.attackMin
    );
    console.log(
      `${attackerPlayer.name}'s attack reduced by ${defenderPlayer.tempVariables.reduceAttack}, min ${defenderPlayer.tempVariables.attackMin}, due to ${defenderPlayer.name}'s ability`
    );
  }
  if (attackerPlayer.tempVariables.reduceAttack) {
    defenderTotalAttack = Math.max(
      defenderTotalAttack - attackerPlayer.tempVariables.reduceAttack,
      attackerPlayer.tempVariables.attackMin
    );
    console.log(
      `${defenderPlayer.name}'s attack reduced by ${attackerPlayer.tempVariables.reduceAttack}, min ${attackerPlayer.tempVariables.attackMin}, due to ${attackerPlayer.name}'s ability`
    );
  }

  console.log(`Attacker Total Attack: ${attackerTotalAttack}`);
  console.log(`Defender Total Attack: ${defenderTotalAttack}`);

  // Determine winner and apply abilities
  let battleOutcome = '';
  let damage = 0;

  if (attackerTotalAttack > defenderTotalAttack) {
    battleOutcome = 'attacker';
    damage = attacker.damage + (attacker.extraDamage || 0);
    console.log(`${attackerPlayer.name} wins the battle and deals ${damage} damage to ${defenderPlayer.name}.`);

    // Post-battle phase: Apply abilities
    applyAbilities(attackerPlayer, defenderPlayer, attacker, 'postBattle');
    applyAbilities(defenderPlayer, attackerPlayer, defender, 'postBattle');

    // Apply damage modifications based on defender's ability to reduce opponent's damage
    if (defenderPlayer.tempVariables.reduceOpponentDamage) {
      damage = Math.max(damage - defenderPlayer.tempVariables.reduceOpponentDamage, defenderPlayer.tempVariables.opponentDamageMin);
      console.log(
        `${attackerPlayer.name}'s damage reduced by ${defenderPlayer.tempVariables.reduceOpponentDamage}, min ${defenderPlayer.tempVariables.opponentDamageMin}, due to ${defenderPlayer.name}'s ability`
      );
    }

    // Apply damage
    defenderPlayer.lp -= damage;

    // Post-win phase: Apply abilities
    applyAbilities(attackerPlayer, defenderPlayer, attacker, 'postWin');

  } else if (defenderTotalAttack > attackerTotalAttack) {
    battleOutcome = 'defender';
    damage = defender.damage + (defender.extraDamage || 0);
    console.log(`${defenderPlayer.name} wins the battle and deals ${damage} damage to ${attackerPlayer.name}.`);

    // Post-battle phase: Apply abilities
    applyAbilities(defenderPlayer, attackerPlayer, defender, 'postBattle');
    applyAbilities(attackerPlayer, defenderPlayer, attacker, 'postBattle');

    // Apply damage modifications based on attacker's ability to reduce opponent's damage
    if (attackerPlayer.tempVariables.reduceOpponentDamage) {
      damage = Math.max(damage - attackerPlayer.tempVariables.reduceOpponentDamage, attackerPlayer.tempVariables.opponentDamageMin);
      console.log(
        `${defenderPlayer.name}'s damage reduced by ${attackerPlayer.tempVariables.reduceOpponentDamage}, min ${attackerPlayer.tempVariables.opponentDamageMin}, due to ${attackerPlayer.name}'s ability`
      );
    }

    // Apply damage
    attackerPlayer.lp -= damage;

    // Post-win phase: Apply abilities
    applyAbilities(defenderPlayer, attackerPlayer, defender, 'postWin');

  } else {
    battleOutcome = 'tie';
    console.log('The battle ended in a tie. No damage dealt.');
  }

  // Mark cards as used and store battle info
  markCardAsUsed(attackerPlayer, battleOutcome === 'attacker', attackerTotalAttack);
  markCardAsUsed(defenderPlayer, battleOutcome === 'defender', defenderTotalAttack);

  // Reset temporary variables
  resetPlayerTempVariables(attackerPlayer);
  resetPlayerTempVariables(defenderPlayer);

  // Clear bucksBeforeSelection
  delete attackerPlayer.bucksBeforeSelection;
  delete defenderPlayer.bucksBeforeSelection;

  // Check for game over conditions
  if (attackerPlayer.lp <= 0 || defenderPlayer.lp <= 0) {
    gameState.gameOver = true;
    console.log('Game Over due to LP reaching 0.');
  } else if (gameState.round >= 4) {
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

  // Prepare game state for each player
  const player1GameState = prepareGameStateForPlayer(gameState, gameState.player1.id);
  const player2GameState = prepareGameStateForPlayer(gameState, gameState.player2.id);

  // Emit updated game state to both players
  io.to(gameState.player1.id).emit('gameState', player1GameState);
  io.to(gameState.player2.id).emit('gameState', player2GameState);
}





// Function to mark a card as used and store battle info
function markCardAsUsed(player, wonBattle, totalStrength) {
  if (player.selectedCard !== null && player.selectedCard < player.field.length) {
    const usedCard = player.field[player.selectedCard];
    usedCard.used = true;
    usedCard.wonBattle = wonBattle;
    usedCard.bucksBet = player.selectedBucks;
    usedCard.totalStrength = totalStrength;
  }
  player.selectedCard = null;
  player.selectedBucks = 0;
}


function hasEraBonus(player, era) {
  const eraCounts = {};
  player.field.forEach(card => {
    if (!card.used) { // Only consider unused cards
      eraCounts[card.era] = (eraCounts[card.era] || 0) + 1;
    }
  });
  return eraCounts[era] >= 2;
}



const ABILITY_TYPES = {
  PRE_BATTLE: 'preBattle',     // Abilities that affect strength/stats before battle resolution
  ON_LOSE: 'onLose',          // Abilities that trigger when card loses
  POST_WIN: 'postWin',        // Abilities that trigger when card wins
  ONGOING: 'ongoing'          // Special abilities (like Piercing Shot) that affect general rules
};

function getAbilityType(abilityName) {
  switch (abilityName) {
      // Pre-battle abilities (affect strength calculations)
      case 'Gas Cloud':         // Opponent's card loses 1 Strength
      case 'Burnt Toast':       // Opponent's card loses 2 Strength
      case 'Tech Savvy':        // Opponent's damage reduced by 2
      case 'Nut Barrage':       // +2 Strength
      case 'Power Flex':        // +3 Strength
      case 'Layered Attack':    // Strength is doubled
          return ABILITY_TYPES.PRE_BATTLE;
      
      // On-lose abilities
      case 'Potato Shield':     // Reduce incoming damage by 2
          return ABILITY_TYPES.ON_LOSE;
      
      // Post-win abilities
      case 'Wise Advice':       // Gain 2 LP
      case 'Feast':            // Gain 2 LP
      case "Bob's Rally":      // All Era 1 cards gain +1 Strength
      case 'Flame Aura':       // Enemy loses 2 LP
      case 'Dish Throw':       // Enemy loses 2 LP
      case 'Heavy Seat':       // Enemy loses 1 buck
      case 'Strategic Insight': // Enemy loses 1 buck
      case 'Loyal Companion':   // Gain 1 extra buck if you win
      case 'Late Night Snack':  // Gain 2 Bucks
      case 'Bone Crush':       // +2 damage
      case 'Sound Blast':      // +2 damage
      case 'Sharp Edges':      // +3 damage
          return ABILITY_TYPES.POST_WIN;
      
      // Special cases
      case 'Piercing Shot':    // Ignore opponent's abilities - handled separately
          return ABILITY_TYPES.ONGOING;
      
      default:
          return ABILITY_TYPES.PRE_BATTLE;
  }
}

function applyAbilities(player, opponent, card, battlePhase) {
  if (!player.tempVariables) player.tempVariables = {};
  if (!opponent.tempVariables) opponent.tempVariables = {};

  // Check if abilities are stopped
  if (player.tempVariables.abilitiesStopped) {
    console.log(`${player.name}'s abilities are stopped and will not be applied.`);
    return;
  }

  // Check if the player has at least 2 cards of the same era
  if (!hasEraBonus(player, card.era)) {
    console.log(`${player.name} does not have enough cards of the same era to activate the ability of ${card.name}`);
    return;
  }

  const era = card.era;

  switch (era) {
    case 'Era 1':
      // "-10 Opp. Attack, Min 9"
      if (battlePhase === 'battle') {
        opponent.tempVariables.reduceAttack = 10;
        opponent.tempVariables.attackMin = 9;
        console.log(`${player.name}'s ability will reduce ${opponent.name}'s attack by 10, min 9`);
      }
      break;

    case 'Era 2':
      // "-2 Opp. Damage, Min 1"
      if (battlePhase === 'postBattle') {
        player.tempVariables.reduceOpponentDamage = 2;
        player.tempVariables.opponentDamageMin = 1;
        console.log(`${player.name}'s ability will reduce opponent's damage by 2, min 1`);
      }
      break;

    case 'Era 3':
      // "+1 Attack Per Life Left"
      if (battlePhase === 'battle') {
        if (!opponent.tempVariables.attackModifiersCanceled) {
          const attackIncrease = player.lp;
          card.tempAttackBoost = (card.tempAttackBoost || 0) + attackIncrease;
          console.log(`${player.name}'s attack increases by ${attackIncrease} due to Era 3 ability`);
        } else {
          console.log(`${player.name}'s attack modifiers are canceled and Era 3 ability is not applied.`);
        }
      }
      break;

    case 'Era 4':
      // "+2 Life"
      if (battlePhase === 'postWin') {
        player.lp += 2;
        console.log(`${player.name} gains 2 life due to Era 4 ability`);
      }
      break;

    case 'Era 5':
      // "Stop Opp. Ability"
      if (battlePhase === 'preBattle') {
        opponent.tempVariables.abilitiesStopped = true;
        console.log(`${opponent.name}'s abilities are stopped due to ${player.name}'s Era 5 ability`);
      }
      break;

    case 'Era 6':
      // "Cancel Opp. attack Modif."
      if (battlePhase === 'preBattle') {
        opponent.tempVariables.attackModifiersCanceled = true;
        console.log(`${opponent.name}'s attack modifiers are canceled due to ${player.name}'s Era 6 ability`);
      }
      break;

    case 'Era 7':
      // "Damage +2"
      if (battlePhase === 'postBattle') {
        card.extraDamage = (card.extraDamage || 0) + 2;
        console.log(`${card.name}'s damage increases by 2 due to Era 7 ability`);
      }
      break;

    case 'Era 8':
      // "Attack +8"
      if (battlePhase === 'battle') {
        if (!opponent.tempVariables.attackModifiersCanceled) {
          card.tempAttackBoost = (card.tempAttackBoost || 0) + 8;
          console.log(`${card.name}'s attack increases by 8 due to Era 8 ability`);
        } else {
          console.log(`${player.name}'s attack modifiers are canceled and Era 8 ability is not applied.`);
        }
      }
      break;

    default:
      console.warn(`Unknown Era: ${era}`);
      break;
  }
}






// Reset temporary variables after a battle
function resetPlayerTempVariables(player) {
  player.tempVariables = {};
  player.field.forEach(card => {
    card.tempStrength = card.baseStrength || card.strength;
    card.extraDamage = 0;
  });
  console.log(`${player.name}'s temporary variables have been reset.`);
}


// Generate a unique game ID
function generateGameId() {
  return 'game-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}