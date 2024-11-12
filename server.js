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
      selectedCards.push({ ...card }); // Create a copy of the card object
    } else {
      console.warn(`Card ${cardName} not found in allCards.`);
    }
  }

  return selectedCards;
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
      console.log(`${player.name} canceled their card selection.`);
      break;

    default:
      console.warn(`Unknown action received: ${data.action}`);
      break;
  }

  // Emit the updated game state to both players
  io.to(player.id).emit('gameState', gameState);
  io.to(opponent.id).emit('gameState', gameState);
}

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

  attackerPlayer.tempVariables = {
      incomingDamageReduction: 0,
      activeCardStrengthReduction: 0,
  };
  defenderPlayer.tempVariables = {
      incomingDamageReduction: 0,
      activeCardStrengthReduction: 0,
  };

  // Pre-battle phase: Apply strength modifications
  applyAbilities(attackerPlayer, defenderPlayer, attacker, 'preBattle');
  applyAbilities(defenderPlayer, attackerPlayer, defender, 'preBattle');

  // Calculate strengths after pre-battle abilities
  let attackerStrength = attacker.tempStrength;
  let defenderStrength = defender.tempStrength;

  // Apply strength reductions from abilities
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

  // Calculate total strengths with bucks
  const attackerTotalStrength = attackerStrength * (1 + attackerPlayer.selectedBucks);
  const defenderTotalStrength = defenderStrength * (1 + defenderPlayer.selectedBucks);

  console.log(`Attacker Total Strength: ${attackerTotalStrength}`);
  console.log(`Defender Total Strength: ${defenderTotalStrength}`);

  // Initialize battle outcome variables
  let battleOutcome = '';
  let damage = 0;

  // Determine winner and apply abilities
  if (attackerTotalStrength > defenderTotalStrength) {
      battleOutcome = 'attacker';
      damage = attacker.damage + (attacker.extraDamage || 0);

      // Apply win/lose abilities
      if (hasEraBonus(attackerPlayer)) {
          applyAbilities(attackerPlayer, defenderPlayer, attacker, 'postWin');
      }
      if (hasEraBonus(defenderPlayer)) {
          applyAbilities(defenderPlayer, attackerPlayer, defender, 'onLose');
      }

      // Apply damage reduction
      if (defenderPlayer.tempVariables.incomingDamageReduction) {
          damage = Math.max(0, damage - defenderPlayer.tempVariables.incomingDamageReduction);
      }
      
      defenderPlayer.lp -= damage;
      console.log(`${attackerPlayer.name} wins the battle and deals ${damage} damage to ${defenderPlayer.name}.`);

  } else if (defenderTotalStrength > attackerTotalStrength) {
      battleOutcome = 'defender';
      damage = defender.damage + (defender.extraDamage || 0);

      // Apply win/lose abilities
      if (hasEraBonus(defenderPlayer)) {
          applyAbilities(defenderPlayer, attackerPlayer, defender, 'postWin');
      }
      if (hasEraBonus(attackerPlayer)) {
          applyAbilities(attackerPlayer, defenderPlayer, attacker, 'onLose');
      }

      // Apply damage reduction
      if (attackerPlayer.tempVariables.incomingDamageReduction) {
          damage = Math.max(0, damage - attackerPlayer.tempVariables.incomingDamageReduction);
      }
      
      attackerPlayer.lp -= damage;
      console.log(`${defenderPlayer.name} wins the battle and deals ${damage} damage to ${attackerPlayer.name}.`);

  } else {
      battleOutcome = 'tie';
      console.log('The battle ended in a tie. No damage dealt.');
  }

  // Set battleResult in gameState
  gameState.battleResult = {
      id: Date.now(),
      attackerCardIndex: attackerPlayer.selectedCard,
      defenderCardIndex: defenderPlayer.selectedCard,
      winner: battleOutcome,
      damageDealt: damage,
      lpChanges: {
          [attackerPlayer.id]: attackerPlayer.lp,
          [defenderPlayer.id]: defenderPlayer.lp,
      },
      attackerId: attackerPlayer.id,
      defenderId: defenderPlayer.id,
      attackerTotalStrength: attackerTotalStrength,
      defenderTotalStrength: defenderTotalStrength,
      attackerBucksBet: attackerPlayer.selectedBucks,
      defenderBucksBet: defenderPlayer.selectedBucks,
  };

  // Mark cards as used and store battle info
  markCardAsUsed(attackerPlayer, battleOutcome === 'attacker', attackerTotalStrength);
  markCardAsUsed(defenderPlayer, battleOutcome === 'defender', defenderTotalStrength);

  // Reset temporary variables
  resetPlayerTempVariables(attackerPlayer);
  resetPlayerTempVariables(defenderPlayer);

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

  // Emit updated game state to both players
  io.to(gameState.player1.id).emit('gameState', gameState);
  io.to(gameState.player2.id).emit('gameState', gameState);
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


function hasEraBonus(player) {
  const eraCounts = {};
  player.field.forEach(card => {
      eraCounts[card.era] = (eraCounts[card.era] || 0) + 1;
  });
  return Object.values(eraCounts).some(count => count >= 2);
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

function applyAbilities(player, opponent, card, battlePhase = 'preBattle') {
  if (!player.tempVariables) player.tempVariables = {};
  if (!opponent.tempVariables) opponent.tempVariables = {};

  const hasEraRequirement = hasEraBonus(player);
  if (!hasEraRequirement) {
      console.log(`${player.name} doesn't have enough cards of the same era for abilities`);
      return;
  }

  const abilityType = getAbilityType(card.ability);
  
  // Only process abilities that match the current battle phase
  if (abilityType !== battlePhase) return;

  // Check if abilities are ignored by Piercing Shot
  if (opponent.tempVariables.abilitiesIgnored && abilityType !== ABILITY_TYPES.ONGOING) {
      console.log(`${player.name}'s abilities are ignored due to Piercing Shot`);
      return;
  }

  switch (card.ability) {
      // PRE-BATTLE ABILITIES
      case 'Gas Cloud':
          if (battlePhase === 'preBattle') {
              opponent.tempVariables.activeCardStrengthReduction = 
                  (opponent.tempVariables.activeCardStrengthReduction || 0) + 1;
              console.log(`${opponent.name}'s card base strength reduced by 1 due to Gas Cloud`);
          }
          break;

      case 'Burnt Toast':
          if (battlePhase === 'preBattle') {
              opponent.tempVariables.activeCardStrengthReduction = 
                  (opponent.tempVariables.activeCardStrengthReduction || 0) + 2;
              console.log(`${opponent.name}'s card base strength reduced by 2 due to Burnt Toast`);
          }
          break;

      case 'Tech Savvy':
          if (battlePhase === 'preBattle') {
              opponent.tempVariables.damageReduction = 
                  (opponent.tempVariables.damageReduction || 0) + 2;
              console.log(`${opponent.name}'s damage reduced by 2 due to Tech Savvy`);
          }
          break;

      case 'Nut Barrage':
          if (battlePhase === 'preBattle') {
              card.tempStrength = (card.baseStrength || card.strength) + 2;
              console.log(`${card.name}'s strength increased by 2 due to Nut Barrage`);
          }
          break;

      case 'Power Flex':
          if (battlePhase === 'preBattle') {
              card.tempStrength = (card.baseStrength || card.strength) + 3;
              console.log(`${card.name}'s strength increased by 3 due to Power Flex`);
          }
          break;

      case 'Layered Attack':
          if (battlePhase === 'preBattle') {
              card.tempStrength = (card.baseStrength || card.strength) * 2;
              console.log(`${card.name}'s strength doubled due to Layered Attack`);
          }
          break;

      // ON-LOSE ABILITIES
      case 'Potato Shield':
          if (battlePhase === 'onLose') {
              player.tempVariables.incomingDamageReduction = 
                  (player.tempVariables.incomingDamageReduction || 0) + 2;
              console.log(`${player.name}'s Potato Shield reduces incoming damage by 2`);
          }
          break;

      // POST-WIN ABILITIES
      case "Bob's Rally":
          if (battlePhase === 'postWin') {
              player.field.forEach(c => {
                  if (c.era === 'Era 1' && !c.used) {
                      c.baseStrength = (c.baseStrength || c.strength) + 1;
                      console.log(`${c.name}'s base strength increased by 1 due to Bob's Rally`);
                  }
              });
          }
          break;

      case 'Wise Advice':
      case 'Feast':
          if (battlePhase === 'postWin') {
              player.lp += 2;
              console.log(`${player.name} gains 2 LP from ${card.ability}`);
          }
          break;

      case 'Flame Aura':
      case 'Dish Throw':
          if (battlePhase === 'postWin') {
              opponent.lp -= 2;
              console.log(`${opponent.name} loses 2 LP from ${card.ability}`);
          }
          break;

      case 'Heavy Seat':
      case 'Strategic Insight':
          if (battlePhase === 'postWin') {
              opponent.bucks = Math.max(0, opponent.bucks - 1);
              console.log(`${opponent.name} loses 1 buck from ${card.ability}`);
          }
          break;

      case 'Loyal Companion':
          if (battlePhase === 'postWin') {
              player.bucks += 1;
              console.log(`${player.name} gains 1 buck from Loyal Companion`);
          }
          break;

      case 'Late Night Snack':
          if (battlePhase === 'postWin') {
              player.bucks += 2;
              console.log(`${player.name} gains 2 bucks from Late Night Snack`);
          }
          break;

      case 'Bone Crush':
      case 'Sound Blast':
          if (battlePhase === 'postWin') {
              card.extraDamage = (card.extraDamage || 0) + 2;
              console.log(`${card.name} gains +2 damage from ${card.ability}`);
          }
          break;

      case 'Sharp Edges':
          if (battlePhase === 'postWin') {
              card.extraDamage = (card.extraDamage || 0) + 3;
              console.log(`${card.name} gains +3 damage from Sharp Edges`);
          }
          break;

      // SPECIAL ABILITIES
      case 'Piercing Shot':
          opponent.tempVariables.abilitiesIgnored = true;
          console.log(`${opponent.name}'s abilities are ignored due to Piercing Shot`);
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

// Generate a unique game ID
function generateGameId() {
  return 'game-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}