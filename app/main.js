// GAME SETUP
var initialState = SKIPSETUP ? "playing" : "setup";
var gameState = new GameState({state: initialState});
var cpuBoard = new Board({autoDeploy: true, name: "cpu"});
var playerBoard = new Board({autoDeploy: SKIPSETUP, name: "player"});
var cursor = new Cursor();
var GRAB_STRENGTH_THRESHOLD = 0.9;
var Y_OFFSET = -4;
var ROLL_MULTIPLIER = -1.2;

var moveStartTime = new Date();
moveStartTime = moveStartTime.getTime();

// UI SETUP
setupUserInterface();

// selectedTile: The tile that the player is currently hovering above
var selectedTile = false;

// grabbedShip/Offset: The ship and offset if player is currently manipulating a ship
var grabbedShip = false;
var grabbedOffset = [0, 0];

// isGrabbing: Is the player's hand currently in a grabbing pose
var isGrabbing = false;

// MAIN GAME LOOP
// Called every time the Leap provides a new frame of data
Leap.loop({ hand: function(hand) {
  // Clear any highlighting at the beginning of the loop
  unhighlightTiles();

  // TODO: 4.1, Moving the cursor with Leap data - done
  // Use the hand data to control the cursor's screen position
  var cursorPosition = [hand.screenPosition()[0], hand.screenPosition()[1] + Y_OFFSET]
  cursor.setScreenPosition(cursorPosition);

  // TODO: 4.1 - done
  // Get the tile that the player is currently selecting, and highlight it
  selectedTile = getIntersectingTile(cursorPosition);
  if (selectedTile) {
    highlightTile(selectedTile, Colors.GREEN);
  }

  // SETUP mode
  if (gameState.get('state') == 'setup') {
    background.setContent("<h1>battleship</h1><h3 style='color: #7CD3A2;'>deploy ships</h3>");
    // TODO: 4.2, Deploying ships
    //  Enable the player to grab, move, rotate, and drop ships to deploy them

    // First, determine if grabbing pose or not
    isGrabbing = (hand.grabStrength > GRAB_STRENGTH_THRESHOLD);

    

    // Grabbing, but no selected ship yet. Look for one.
    // TODO: Update grabbedShip/grabbedOffset if the user is hovering over a ship
    if (!grabbedShip && isGrabbing) {
      
      shipAndOffset = getIntersectingShipAndOffset(hand.screenPosition());
      if (shipAndOffset) { // if hovering over a ship
        grabbedShip = shipAndOffset.ship;
        grabbedOffset = shipAndOffset.offset;
      }
    }

    // Has selected a ship and is still holding it
    // TODO: Move the ship
    else if (grabbedShip && isGrabbing) {
      //grabbedShip.setScreenPosition([grabbedOffset[0], grabbedOffset[1]]);
      grabbedShip.setScreenPosition([hand.screenPosition()[0] - grabbedOffset[0], hand.screenPosition()[1] - grabbedOffset[1]]);
      grabbedShip.setScreenRotation(ROLL_MULTIPLIER*hand.roll());

    }

    // Finished moving a ship. Release it, and try placing it.
    // TODO: Try placing the ship on the board and release the ship
    else if (grabbedShip && !isGrabbing) {
      placeShip(grabbedShip);
      grabbedShip = false;
    }
  }

  // PLAYING or END GAME so draw the board and ships (if player's board)
  // Note: Don't have to touch this code
  else {
    if (gameState.get('state') == 'playing') {
      background.setContent("<h1>battleship</h1><h3 style='color: #7CD3A2;'>game on</h3>");
      turnFeedback.setContent(gameState.getTurnHTML());
    }
    else if (gameState.get('state') == 'end') {
      var endLabel = gameState.get('winner') == 'player' ? 'you won!' : 'game over';
      background.setContent("<h1>battleship</h1><h3 style='color: #7CD3A2;'>"+endLabel+"</h3>");
      turnFeedback.setContent("");
    }

    var board = gameState.get('turn') == 'player' ? cpuBoard : playerBoard;
    // Render past shots
    board.get('shots').forEach(function(shot) {
      var position = shot.get('position');
      var tileColor = shot.get('isHit') ? Colors.RED : Colors.YELLOW;
      highlightTile(position, tileColor);
    });

    // Render the ships
    playerBoard.get('ships').forEach(function(ship) {
      if (gameState.get('turn') == 'cpu') {
        var position = ship.get('position');
        var screenPosition = gridOrigin.slice(0);
        screenPosition[0] += position.col * TILESIZE;
        screenPosition[1] += position.row * TILESIZE;
        ship.setScreenPosition(screenPosition);
        if (ship.get('isVertical'))
          ship.setScreenRotation(Math.PI/2);
      } else {
        ship.setScreenPosition([-500, -500]);
      }
    });

    // If playing and CPU's turn, generate a shot
    if (gameState.get('state') == 'playing' && gameState.isCpuTurn() && !gameState.get('waiting')) {
      gameState.set('waiting', true);
      generateCpuShot();
    }
  }
}}).use('screenPosition', {scale: LEAPSCALE});

var confirmFireMode = false;

//  Is called anytime speech is recognized by the Web Speech API
// Input: 
//    transcript, a string of possibly multiple words that were recognized
// Output: 
//    processed, a boolean indicating whether the system reacted to the speech or not
var processSpeech = function(transcript) {
  console.log(transcript);
  // Helper function to detect if any commands appear in a string
  var userSaid = function(str, commands) {
    for (var i = 0; i < commands.length; i++) {
      if (str.indexOf(commands[i]) > -1)
        return true;
    }
    return false;
  };

  var processed = false;
  if (gameState.get('state') == 'setup') {
    // TODO: 4.3, Starting the game with speech
    // Detect the 'start' command, and start the game if it was said
    if (userSaid(transcript, ["start"])) {
      gameState.startGame();
      processed = true;
      console.log("game has been started!");
    }
  }

  else if (gameState.get('state') == 'playing') {
    if (gameState.isPlayerTurn()) {
      // TODO: 4.4, Player's turn
      // Detect the 'fire' command, and register the shot if it was said

      if (userSaid(transcript, ["yes", "yeah"]) && confirmFireMode) {
        // reset move start time
        moveStartTime = new Date();
        moveStartTime = moveStartTime.getTime();
        generateSpeech("Confirmed, firing now");
        confirmFireMode = false;
        processed = true;
        registerPlayerShot()
      }

      if (userSaid(transcript, ["fire"])) {
        var currentTime = new Date();
        currentTime = currentTime.getTime();
        var timeDifference = currentTime - moveStartTime; // get time in ms
        console.log("time difference is " + timeDifference/1000 + " seconds");
        var timeMessage = "";
        if ((timeDifference/1000) > 60) { //if it took longer than a minute to make a move
          timeMessage = getRandomPhrase(cpuWordBank.longTime);
        } 
        else if ((timeDifference/1000) < 30) { //if it took less than 30 sec to make a move
          timeMessage = getRandomPhrase(cpuWordBank.shortTime); 
        }

        confirmFireMode = true; //go into confirm mode

        // check which tile you're pointing at
        if (selectedTile) {
          var rowToLetter = {
            "0": "A",
            "1": "B",
            "2": "C",
            "3": "D"
          }
          var tile = rowToLetter[selectedTile.row] + " " + parseInt(selectedTile.col+1);
        }
        else {
          var tile = "nothing";
        }
        console.log("generating confirm message");
        generateSpeech(timeMessage + " Are you sure you want to fire at " + tile);
        processed = true;
      }
  }

    else if (gameState.isCpuTurn() && gameState.waitingForPlayer()) {
      // TODO: 4.5, CPU's turn
      // Detect the player's response to the CPU's shot: hit, miss, you sunk my ..., game over
      // and register the CPU's shot if it was said
      if (userSaid(transcript, ["hit", "miss", "you sunk my", "game over"])) {
        var response = "playerResponse";
        registerCpuShot(response);

        processed = true;
      }
    }
  }

  return processed;
};

var getRandomPhrase = function(phrases) {
  var i = Math.floor(Math.random()*phrases.length);
  return phrases[i];
}

// TODO: 4.4, Player's turn
// Generate CPU speech feedback when player takes a shot
var registerPlayerShot = function() {
  // TODO: CPU should respond if the shot was off-board
  if (!selectedTile) {
    generateSpeech(getRandomPhrase(cpuWordBank.offboard));
  }

  // If aiming at a tile, register the player's shot
  else {
    var shot = new Shot({position: selectedTile});
    var result = cpuBoard.fireShot(shot);

    // Duplicate shot
    if (!result) return;

    // TODO: Generate CPU feedback in three cases
    // Game over
    if (result.isGameOver) {
      generateSpeech(getRandomPhrase(cpuWordBank.gameover));
      gameState.endGame("player");
      return;
    }
    // Sunk ship
    else if (result.sunkShip) {
      var shipName = result.sunkShip.get('type');
      generateSpeech(getRandomPhrase(cpuWordBank.sunkShip) + shipName);
    }
    // Hit or miss
    else {
      var isHit = result.shot.get('isHit');
      if (isHit) {
        generateSpeech(getRandomPhrase(cpuWordBank.hit));
      }
      else {
        generateSpeech(getRandomPhrase(cpuWordBank.miss));
      }
    }

    if (!result.isGameOver) {
      // TODO: Uncomment nextTurn to move onto the CPU's turn
      nextTurn();
    }
  }
};

// TODO: 4.5, CPU's turn
// Generate CPU shot as speech and blinking
var cpuShot;
var generateCpuShot = function() {
  // Generate a random CPU shot
  cpuShot = gameState.getCpuShot();
  var tile = cpuShot.get('position');
  var rowName = ROWNAMES[tile.row]; // e.g. "A"
  var colName = COLNAMES[tile.col]; // e.g. "5"

  // TODO: Generate speech and visual cues for CPU shot
  generateSpeech("fire " + rowName + " " + colName);
  blinkTile(tile);
};

// TODO: 4.5, CPU's turn
// Generate CPU speech in response to the player's response
// E.g. CPU takes shot, then player responds with "hit" ==> CPU could then say "AWESOME!"
var registerCpuShot = function(playerResponse) {
  // Cancel any blinking
  unblinkTiles();
  var result = playerBoard.fireShot(cpuShot);

  // NOTE: Here we are using the actual result of the shot, rather than the player's response
  // In 4.6, you may experiment with the CPU's response when the player is not being truthful!

  // TODO: Generate CPU feedback in three cases
  // Game over
  if (result.isGameOver) {
    gameState.endGame("cpu");
    return;
  }
  // Sunk ship
  else if (result.sunkShip) {
    var shipName = result.sunkShip.get('type');
    message = getRandomPhrase(cpuWordBank.cpuHit);
  }
  // Hit or miss
  else {
    console.log("result shot: " + result.shot);
    var isHit = result.shot.get('isHit');
    console.log(isHit);
    if (isHit) {
      message = getRandomPhrase(cpuWordBank.cpuHit);
    }
    else {
      message = getRandomPhrase(cpuWordBank.cpuMiss);
    }
  }

  generateSpeech(message);

  if (!result.isGameOver) {
    // TODO: Uncomment nextTurn to move onto the player's next turn
    nextTurn();
  }
};

