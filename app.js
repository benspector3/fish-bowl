const PORT = process.env.PORT || 3000;

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const Game = require('./server/game.js');

// listen for requests on port 3000
http.listen(PORT, function() {
    console.log("listening on *:" + PORT);
});

app.use(express.static('public'));

// global server variables
let SOCKET_LIST = {}
let ROOM_LIST = {}
let PLAYER_LIST = {}

// Room class
// Live rooms will have a name and password and keep track of game options / players in room
class Room {
    constructor(roomName, pass){
        this.roomName = '' + roomName
        this.password = '' + pass
        this.players = {};
        this.playersReady = 0;
        this.chatHistory = [];
        this.game = new Game();

        // Add room to room list, indexed by roomName
        ROOM_LIST[this.roomName] = this
    }
}

// Player class
// When players log in, they give a nickname, have a socket and a room they're trying to connect to
class Player {
    constructor(nickname, roomName, socket){
      this.id = socket.id
  
      // If someone in the room has the same name, append (1) to their nickname
      let nameAvailable = false
      let nameExists = false;
      let tempName = nickname
      let counter = 0
      let roomObj = ROOM_LIST[roomName];
      while (!nameAvailable){
        if (roomObj){
          nameExists = false;
          for (let i in roomObj.players){
            if (roomObj.players[i].nickname === tempName) nameExists = true
          }
          if (nameExists) tempName = nickname + "-" + ++counter;
          else nameAvailable = true
        }
      }
      this.nickname = tempName
      this.roomName = roomName
      this.ready = false;
      this.timeout = 2100         // # of seconds until kicked for afk (35min)
      this.afktimer = this.timeout
  
      // Add player to player list and add their socket to the socket list
      PLAYER_LIST[this.id] = this
    }
}

// Server Logic
////////////////////////////////////////////////////////////////////////////////

// each client that connects to the server creates a new socket object
// socket.id is unique
io.on('connection', function(socket) {
    SOCKET_LIST[socket.id] = socket;

    // Lobby
    ///////////////////////////////////////////////////////////////////

    // Room Creation. Called when client attempts to create a rooom
    // Data: player nickname, room name, room password
    socket.on('createRoom', (data) => { createRoom(socket, data) });
    // Room Joining. Called when client attempts to join a room
    // Data: player nickname, room name, room password
    socket.on('joinRoom', (data) => { joinRoom(socket, data) });
    // Room Leaving. Called when client leaves a room
    socket.on('leaveRoom', () => { leaveRoom(socket) });
    // whenever someone disconnects...
    socket.on('disconnect', () => { socketDisconnect(socket) });

    // In Room Lobby
    ///////////////////////////////////////////////////////////////////////

    socket.on("phraseAdded", (phrase) => { addPhraseToGame(socket, phrase) });
    socket.on("phraseRemoved", (phrase) => { removePhraseFromGame(socket, phrase) });
    socket.on("readyGame", (increment) => { readyGame(socket, increment) });
    socket.on("startGame", () => { startGame(socket); });
    
    // In Game
    ////////////////////////////////////////////////////////////////////////
    
    // team switching
    socket.on('joinRedTeam', () => { changeTeams(socket, 'redTeam') });
    socket.on('joinBlueTeam', () => { changeTeams(socket, 'blueTeam') });
    
    // clue giver controls 
    socket.on('showPhraseButtonPressed', () => { showNextPhrase(socket) });
    socket.on('phraseCorrectButtonPressed', () => { awardPhrase(socket) });
    socket.on('nextRoundButtonPressed', () => { startNextRound(socket) });

    // send chat messages
    socket.on('chatMessage', (data) => { sendMessage(socket, data); });
});

// Every second, update the timer in the rooms that are on timed mode
setInterval(()=>{
    // Game Timer Logic
    for (let roomName in ROOM_LIST){
        let roomObj = ROOM_LIST[roomName];
        
        if (!roomObj.game.timerRunning) continue;    // if the timer isn't running, move on to the next room
        
        roomObj.game.timer--          // count timer down
        if (roomObj.game.timer < 0){  // If timer runs out...
            roomObj.game.resetTimer();  // reset the timer back to the max amount
            roomObj.game.switchTurn();  // change turns

            // inform the room
            emitToRoom(roomObj, 'switchingTurns', roomObj.game);
            emitToRoom(roomObj, 'newActivePlayer', roomObj.game);
            emitToRoom(roomObj, 'updateGame', roomObj);
        }
        
        // Update the timer value to every client in the room
        emitToRoom(roomObj, 'timerUpdate', roomObj.game.timer);
    }
}, 1000);

// In Game Helpers
////////////////////////////////////////////////////////////////////////////////////////////

// Gets client that requested the new game and begins the game for the room
// increment will be -1 if a player was previously readied, 1 otherwise
function readyGame(socket, increment) {
    if (!getPlayer(socket)) return     // Prevent Crash
    
    let player = getPlayer(socket);       // get the player based on their socket id
    let roomObj = ROOM_LIST[player.roomName]; // Get the room that the client called from
        
    roomObj.playersReady += increment;          // increment (+1/-1) the playersReady count for the room
    player.ready = player.ready ? false : true; // toggle player.ready 
    
    emitToRoom(roomObj, "updateLobby", roomObj); // update lobby
}

function startGame(socket) {
    if (!getPlayer(socket)) return // Prevent Crash
    let roomObj = ROOM_LIST[getPlayer(socket).roomName]; // Get the room that the client called from
    let playerIds = Object.keys(roomObj.players);
    let game = roomObj.game;

    // prevent games with less than 4 players from starting
    if (playerIds.length < 4) { 
        socket.emit("newGameResponse", {success: false, msg:"You must have at least 4 players in the room to begin"});
    }
    
    // prevent games with less than 10 phrases from starting
    else if (game.allPhrases.length < 10) { 
        socket.emit("newGameResponse", {success: false, msg:"You need at least 10 phrases to begin. " + (10 - game.allPhrases.length) + " more to go!"})
    }

    // prevent games with teams < 2 from starting
    else if (game.redTeam.playerIds.length < 2 || game.blueTeam.playerIds.length < 2) {
        socket.emit("newGameResponse", {success: false, msg:"Each team must have at least 2 players to begin"})
    } 

    else {
        game.newGame(playerIds);      // Make a new game for that room
        emitToRoom(roomObj, 'newGameResponse', {success:true, game: game});
        emitToRoom(roomObj, 'newActivePlayer', game);
        emitToRoom(roomObj, 'updateGame', roomObj);
    }
}

function startNextRound(socket) {
    if (!getPlayer(socket)) return // Prevent Crash
    let roomObj = ROOM_LIST[getPlayer(socket).roomName]  // Get the room that the client called from
    roomObj.game.goToNextRound();  // clear phrase data for both teams
    emitToRoom(roomObj, 'newActivePlayer', roomObj.game);
    emitToRoom(roomObj, 'updateGame', roomObj);
}

function showNextPhrase(socket) {
    if (!getPlayer(socket)) return // Prevent Crash
    let roomObj = ROOM_LIST[getPlayer(socket).roomName]  // Get the room that the client called from
    let game = roomObj.game;
    
    game.startTimer();                      // start the timer (if it wasn't already)
    let phrase = game.getNextPhrase();      // get a random phrase from the community bowl
    socket.emit('showPhraseResponse', {phrase: phrase});    // respond to the client with the phrase
}

function awardPhrase(socket) {
    if (!getPlayer(socket)) return // Prevent Crash
    let roomObj = ROOM_LIST[getPlayer(socket).roomName]  // Get the room that the client called from
    let game = roomObj.game;    // get the game for that room
    
    game.awardPhraseToTeam();   // award the active phrase to the active team
    
    if (game.communityBowl.length > 0) {    // 
        game.changeActivePlayer();  // go to the next active player on the active team
        emitToRoom(roomObj, 'newActivePlayer', game);
    } else {
        // the round is over. display results and move to next round
        game.stopTimer();
        let lastRound = game.roundNames.length - (game.bonusRound ? 1 : 2); // if the bonus round is on, play one extra round
        if (game.roundNumber === lastRound) {
            game.over = true;
            emitToRoom(roomObj, 'gameOver', game);
        } else {
            // advance to the next round
            // wait to emit 'nextActivePlayer' until the host advances
            emitToRoom(roomObj, 'advanceToNextRound', game);    
        }
    }

    emitToRoom(roomObj, 'updateGame', roomObj);  // let the room know the award was given
}

// Chat Helpers
//////////////////////////////////////////////////////////////////////////////////////////////////////

function sendMessage(socket, message) {
    let player = getPlayer(socket);
    if (!player) {
        socket.emit("sendMessageResponse", {success:false});
    } else {
        let roomObj = ROOM_LIST[player.roomName];
        let data = {
            message: message,
            nickname: player.nickname
        }
        roomObj.chatHistory.push(data);
        emitToRoom(roomObj, 'chatMessage', data);
        socket.emit("sendMessageResponse", {success:true});
    }
}

// Game Setup Helpers
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function addPhraseToGame(socket, phrase) {
    let player = getPlayer(socket);
    if (!player) {
        socket.emit("addPhraseToGameResponse", {success:false, msg:'player not found. ' + phrase + ' not added'});
    } else {
        let game = ROOM_LIST[player.roomName].game;
        game.addPhrase(phrase);
        socket.emit("addPhraseToGameResponse", {success:true, msg:phrase + ' added'});
    }
}

function removePhraseFromGame(socket, phrase) {
    let player = getPlayer(socket);
    if (!player) {
        socket.emit("removePhraseFromGameResponse", {success:false, msg:'player not found. ' + phrase + ' not removed'});
    } else {
        let game = ROOM_LIST[player.roomName].game;
        game.removePhrase(phrase);
        socket.emit("removePhraseFromGameResponse", {success:true, msg: phrase + ' removed'});
    }
}

function changeTeams(socket, teamToJoin) {
    if (!getPlayer(socket)) return // Prevent Crash
    let roomObj = ROOM_LIST[getPlayer(socket).roomName]  // Get the room that the client called from
    roomObj.game.removePlayer(socket.id);
    roomObj.game.addPlayer(socket.id, teamToJoin);
    emitToRoom(roomObj, "updateLobby", roomObj);
}

// Join/Create/Leave Room Helpers
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Create room function
// Gets a room name and password and attempts to make a new room if one doesn't exist
// On creation, the client that created the room is created and added to the room
function createRoom(socket, data){
    let roomName = data.roomName;
    let passName = data.password;
    let userName = data.nickname;

    if (ROOM_LIST[roomName]) {   // If the requested room name is taken
        // Tell the client the room arleady exists
        socket.emit('createResponse', {success:false, msg:'Room Already Exists'})
    } else if (roomName === "") {    
        // Tell the client they need a valid room name
        socket.emit('createResponse', {success:false, msg:'Enter A Valid Room Name'})
    } else if (userName === ''){
        // Tell the client they need a valid nickname
        socket.emit('createResponse', {success:false, msg:'Enter A Valid Nickname'})
    } else {    // If the room name and nickname are both valid, proceed
        let roomObj = new Room(roomName, passName)              // Create a new room
    
        let player = new Player(userName, roomName, socket)     // Create a new player
        roomObj.players[socket.id] = player                     // Add player to room
        roomObj.game.addPlayer(socket.id);                      // Add player to game

        socket.emit('createResponse', {success:true, msg: ""})      // Tell client creation was successful
        emitToRoom(roomObj, "updateLobby", roomObj);
    }
}

// Join room function
// Gets a room name and poassword and attempts to join said room
// On joining, the client that joined the room is created and added to the room
function joinRoom(socket, data){
    let roomName = data.roomName;
    let pass = data.password;
    let userName = data.nickname;
    let roomObj = ROOM_LIST[roomName];

    if (!roomObj){
        // Tell client the room doesnt exist
        socket.emit('joinResponse', {success:false, msg:"Room Not Found"})
    } else if (roomObj.password !== pass){ 
        // Tell client the password is incorrect
        socket.emit('joinResponse', {success:false, msg:"Incorrect Password"})
    } else if (userName === ''){
        // Tell client they need a valid nickname
        socket.emit('joinResponse', {success:false, msg:'Enter A Valid Nickname'})
    } else {  // If the room exists and the password / nickname are valid, proceed
        let player = new Player(userName, roomName, socket) // Create a new player
        roomObj.players[socket.id] = player                 // Add player to room
        roomObj.game.addPlayer(socket.id);                  // add player to game
        socket.emit('joinResponse', {success:true, msg:""}) // Tell client join was successful
        socket.emit('chatHistory', roomObj.chatHistory);    // send client chat history
        
        // if the game has begun, go directly to the game view
        if (roomObj.game.hasBegun) {
            socket.emit("newGameResponse", {success: true, game: roomObj.game});
            emitToRoom(roomObj, "updateGame", roomObj);
        } else {
            emitToRoom(roomObj, "updateLobby", roomObj);
        }        
    }
}

// Leave room function
// Gets the client that left the room and removes them from the room's player list
function leaveRoom(socket){
    if (!getPlayer(socket)) return     // Prevent Crash
    let player = getPlayer(socket)     // Get the player that made the request
    let roomObj = ROOM_LIST[player.roomName];   // find the room they were in
    delete PLAYER_LIST[player.id]           // Delete the player from the player list
    delete roomObj.players[player.id]       // Remove the player from their room

    // If the number of players in the room is 0 at this point, delete the room entirely
    if (!deleteRoomIfEmpty(player.roomName)) {
        safelyRemovePlayerFromGame(socket, roomObj);
    }
    socket.emit('leaveResponse', {success:true})     // Tell the client the action was successful
}

// Disconnect function
// Called when a client closes the browser tab
function socketDisconnect(socket){
    let player = getPlayer(socket) // Get the player that made the request
    delete SOCKET_LIST[socket.id]       // Delete the client from the socket list
    delete PLAYER_LIST[socket.id]       // Delete the player from the player list

    if(player){   // If the player was in a room
        let roomObj = ROOM_LIST[player.roomName];
        delete roomObj.players[socket.id] // Remove the player from their room

        // If the number of players in the room is 0 at this point, delete the room entirely
        if (!deleteRoomIfEmpty(player.roomName)) {
            safelyRemovePlayerFromGame(player, roomObj);
        }
    }
}

// General Helpers
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getPlayer(socket) {
    return PLAYER_LIST[socket.id];
}

// If the number of players in the room is 0 at this point, delete the room entirely
function deleteRoomIfEmpty(roomName) {
    if (Object.keys(ROOM_LIST[roomName].players).length === 0) {
        delete ROOM_LIST[roomName]
        return true;
    }
    return false;
}

function safelyRemovePlayerFromGame(player, roomObj) {
    let activeTeam = roomObj.game[roomObj.game.activeTeam];     // check if the player was the active player on the active team
    if (activeTeam && activeTeam.playerIds[activeTeam.activePlayer] === player.id) {
        roomObj.game.changeActivePlayer();
        emitToRoom(roomObj, 'newActivePlayer', roomObj.game);
    }
    roomObj.game.removePlayer(player.id); 
    
    if (player.ready) {
        roomObj.playersReady--; // decrement room ready count
        player.ready = false;   // toggle player ready
    }

    if (roomObj.game.hasBegun && !roomObj.game.over) {
        emitToRoom(roomObj, 'updateGame', roomObj);
    } else {
        emitToRoom(roomObj, "updateLobby", roomObj);
    }
}

function emitToRoom(roomObj, emitMessage, data) {
    for (let playerId in roomObj.players){ // For everyone in the passed room
        SOCKET_LIST[playerId].emit(emitMessage, data)  // Pass data to the client
    }
}  
