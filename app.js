const PORT = process.env.PORT || 3000;

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const Game = require('./server/game.js');

app.use(express.static('public'))

// global server variables
let SOCKET_LIST = {}
let ROOM_LIST = {}
let PLAYER_LIST = {}

// Room class
// Live rooms will have a name and password and keep track of game options / players in room
class Room {
    constructor(name, pass){
        this.room = '' + name
        this.password = '' + pass
        this.players = {}
        this.chatHistory = [];
        this.game = new Game();

        // Add room to room list
        ROOM_LIST[this.room] = this
    }
}

// Player class
// When players log in, they give a nickname, have a socket and a room they're trying to connect to
class Player {
    constructor(nickname, room, socket){
      this.id = socket.id
  
      // If someone in the room has the same name, append (1) to their nickname
      let nameAvailable = false
      let nameExists = false;
      let tempName = nickname
      let counter = 0
      while (!nameAvailable){
        if (ROOM_LIST[room]){
          nameExists = false;
          for (let i in ROOM_LIST[room].players){
            if (ROOM_LIST[room].players[i].nickname === tempName) nameExists = true
          }
          if (nameExists) tempName = nickname + "-" + ++counter;
          else nameAvailable = true
        }
      }
      this.nickname = tempName
      this.room = room
      this.timeout = 2100         // # of seconds until kicked for afk (35min)
      this.afktimer = this.timeout
  
      // Add player to player list and add their socket to the socket list
      PLAYER_LIST[this.id] = this
    }
}


// Server Logic
///////////////////////////////////////////////////////

// each client that connects to the server creates a new socket object
// socket.id is unique
io.on('connection', function(socket) {
    SOCKET_LIST[socket.id] = socket;
    console.log("a user connected");

    // Pass server stats to client
    socket.emit('serverStats', {
        players: Object.keys(PLAYER_LIST).length,
        rooms: Object.keys(ROOM_LIST).length
    });

    // Lobby
    //////////////////////////////////////////////////

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
    socket.on("startGame", () => { startGame(socket) });
    
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

function changeTeams(socket, teamToJoin) {
    if (!PLAYER_LIST[socket.id]) return // Prevent Crash
    let roomObj = ROOM_LIST[PLAYER_LIST[socket.id].room]  // Get the room that the client called from

    roomObj.game.removePlayer(socket.id);
    roomObj.game.addPlayer(socket.id, teamToJoin);
    emitToRoom(roomObj, 'gameState', roomObj);
}

function awardPhrase(socket) {
    if (!PLAYER_LIST[socket.id]) return // Prevent Crash
    let roomObj = ROOM_LIST[PLAYER_LIST[socket.id].room]  // Get the room that the client called from
    let game = roomObj.game;
    game.awardPhraseToTeam();

    emitToRoom(roomObj, "awardPhraseResponse", { game: game });   // let the room know the award was given
    emitToRoom(roomObj, 'gameState', roomObj);

    // the round is over. display results and move to next round
    if (game.communityBowl.length === 0) {

        game.goToNextRound();  
        console.log('advancing to next round: ' + (game.roundNumber + 1));
        game.stopTimer();

        if (game.over) {
            emitToRoom(roomObj, 'gameOver', game);
            return;
        } else {
            // advance to the next round
            // wait to emit 'nextActivePlayer' until the host advances
            emitToRoom(roomObj, 'advanceToNextRound', game);    
        }
    } else {
        // show the next active player the controls
        emitToRoom(roomObj, 'newActivePlayer', game);
    }
}

function startNextRound(socket) {
    if (!PLAYER_LIST[socket.id]) return // Prevent Crash
    let roomObj = ROOM_LIST[PLAYER_LIST[socket.id].room]  // Get the room that the client called from
    emitToRoom(roomObj, 'newActivePlayer', roomObj.game);
    emitToRoom(roomObj, 'gameState', roomObj);
}

function showNextPhrase(socket) {
    if (!PLAYER_LIST[socket.id]) return // Prevent Crash
    let roomObj = ROOM_LIST[PLAYER_LIST[socket.id].room]  // Get the room that the client called from
    let game = roomObj.game;

    game.startTimer();

    let phrase = game.getNextPhrase();      // Make a new game for that room

    console.log("showing phrase: " + phrase);
    socket.emit('showPhraseResponse', {phrase: phrase});
}

// Gets client that requested the new game and begins the game for the room
function startGame(socket) {
    if (!PLAYER_LIST[socket.id]) return // Prevent Crash
    let roomObj = ROOM_LIST[PLAYER_LIST[socket.id].room]; // Get the room that the client called from
    let playerIds = Object.keys(roomObj.players);
    
    // prevent games with less than 4 players from starting
    if (playerIds.length < 4) { 
        socket.emit("newGameResponse", {success: false, msg:"You must have at least 4 players in the room to begin"})
    }
    
    // prevent games with less than 4 phrases from starting
    else if (roomObj.game.allPhrases.length < 4) { 
        socket.emit("newGameResponse", {success: false, msg:"You must have at least 4 phrases to begin"})
    }

    // prevent games with teams < 2 from starting
    else if (roomObj.game.redTeam.playerIds.length < 2 || roomObj.game.blueTeam.playerIds.length < 2) {
        socket.emit("newGameResponse", {success: false, msg:"Each team must have at least 2 players to begin"})
    }

    // otherwise begin teh game
    else {
        roomObj.game.newGame(playerIds);      // Make a new game for that room
        
        let team = roomObj.game[roomObj.game.activeTeam];
        
        emitToRoom(roomObj, 'newGameResponse', {success:true, game: roomObj.game});
        emitToRoom(roomObj, 'newActivePlayer', roomObj.game);
        emitToRoom(roomObj, 'gameState', roomObj);
        
        console.log("clue giver: " + team.playerIds[team.activePlayer])
    }
}

function addPhraseToGame(socket, phrase) {
    let player = PLAYER_LIST[socket.id];
    let game = ROOM_LIST[player.room].game;
    game.addPhrase(phrase);
    console.log("phrase added. phrases in game: " + game.allPhrases.length);
}

function removePhraseFromGame(socket, phrase) {
    let player = PLAYER_LIST[socket.id];
    let game = ROOM_LIST[player.room].game;
    game.removePhrase(phrase);
    console.log("phrase removed. phrases in game: " + game.allPhrases.length);
}

function sendMessage(socket, message) {
    let player = PLAYER_LIST[socket.id];
    let roomObj = ROOM_LIST[player.room];
    let data = {
        message: message,
        nickname: player.nickname
    }
    roomObj.chatHistory.push(data);
    emitToRoom(roomObj, 'chatMessage', data);
}

// Create room function
// Gets a room name and password and attempts to make a new room if one doesn't exist
// On creation, the client that created the room is created and added to the room
function createRoom(socket, data){
    let roomName = data.room.trim()     // Trim whitespace from room name
    let passName = data.password.trim() // Trim whitespace from password
    let userName = data.nickname.trim() // Trim whitespace from nickname

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

        emitToRoom(roomObj, 'gameState', roomObj);                                    // tell clients to update team display

        socket.emit('createResponse', {success:true, msg: ""})      // Tell client creation was successful
        
        console.log(socket.id + "(" + player.nickname + ") CREATED '" + ROOM_LIST[player.room].room + "'(" + Object.keys(ROOM_LIST[player.room].players).length + ")")
    }
}

// Join room function
// Gets a room name and poassword and attempts to join said room
// On joining, the client that joined the room is created and added to the room
function joinRoom(socket, data){
    let roomName = data.room.trim()     // Trim whitespace from room name
    let pass = data.password.trim()     // Trim whitespace from password
    let userName = data.nickname.trim() // Trim whitespace from nickname
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

        emitToRoom(roomObj, 'gameState', roomObj);                                // update game to display new team member
        socket.emit('joinResponse', {success:true, msg:""}) // Tell client join was successful
        
        // if the game has begun, go directly to the game view
        if (roomObj.game.hasBegun) {
            // roomObj.game.addPlayer(player.id);
            socket.emit("newGameResponse", {success: true, game: roomObj.game})
        } 

        socket.emit('chatHistory', roomObj.chatHistory);            // send client chat history
        console.log(socket.id + "(" + player.nickname + ") JOINED '" + ROOM_LIST[player.room].room + "'(" + Object.keys(ROOM_LIST[player.room].players).length + ")")
    }
}

// Leave room function
// Gets the client that left the room and removes them from the room's player list
function leaveRoom(socket){
    if (!PLAYER_LIST[socket.id]) return // Prevent Crash
    let player = PLAYER_LIST[socket.id]              // Get the player that made the request
    let roomObj = ROOM_LIST[player.room];
    delete PLAYER_LIST[player.id]                    // Delete the player from the player list
    delete roomObj.players[player.id] // Remove the player from their room
    
    // If the number of players in the room is 0 at this point, delete the room entirely
    if (!deleteRoomIfEmpty(player.room)) {
        
        roomObj.game.removePlayer(socket.id);   // otherwise, remove the player
        emitToRoom(roomObj, 'gameState', roomObj);                    // inform the room
        console.log(socket.id + "(" + player.nickname + ") LEFT '" + roomObj.room + "'(" + Object.keys(roomObj.players).length + ")")
    }
    socket.emit('leaveResponse', {success:true})     // Tell the client the action was successful
}

// Disconnect function
// Called when a client closes the browser tab
function socketDisconnect(socket){
    let player = PLAYER_LIST[socket.id] // Get the player that made the request
    delete SOCKET_LIST[socket.id]       // Delete the client from the socket list
    delete PLAYER_LIST[socket.id]       // Delete the player from the player list

    if(player){   // If the player was in a room
        let roomObj = ROOM_LIST[player.room];
        delete roomObj.players[socket.id] // Remove the player from their room

        // If the number of players in the room is 0 at this point, delete the room entirely
        if (!deleteRoomIfEmpty(player.room)) {
            roomObj.game.removePlayer(socket.id);   // otherwise remove the player from the game
            emitToRoom(roomObj, 'gameState', roomObj);                    // inform all clients
            console.log(socket.id + "(" + player.nickname + ") LEFT '" + roomObj.room + "'(" + Object.keys(roomObj.players).length + ")")
        }
    }
    // Server Log
    console.log('DISCONNECT: ' + socket.id);
}

// If the number of players in the room is 0 at this point, delete the room entirely
function deleteRoomIfEmpty(room) {
    if (Object.keys(ROOM_LIST[room].players).length === 0) {
        delete ROOM_LIST[room]
        console.log("DELETE ROOM: '" + room + "'");
        return true;
    }
    return false;
}

function emitToRoom(roomObj, emitMessage, data) {
    for (let playerId in roomObj.players){ // For everyone in the passed room
        SOCKET_LIST[playerId].emit(emitMessage, data)  // Pass data to the client
    }
}  

// Every second, update the timer in the rooms that are on timed mode
setInterval(()=>{
    // Game Timer Logic
    for (let room in ROOM_LIST){
        var roomObj = ROOM_LIST[room];
        if (!roomObj.game.timerRunning) continue;    // if the timer isn't running, move on to the next room

        roomObj.game.timer--          // count timer down
        if (roomObj.game.timer < 0){  // If timer runs out, switch that rooms turn
            console.log('time ran out. switching turns');
            roomObj.game.resetTimer();
            roomObj.game.switchTurn();
            emitToRoom(roomObj, 'switchingTurns', roomObj.game);
            emitToRoom(roomObj, 'newActivePlayer', roomObj.game);
            emitToRoom(roomObj, 'gameState', roomObj);
        }
        
        // Update the timer value to every client in the room
        emitToRoom(roomObj, 'timerUpdate', {timer:roomObj.game.timer});
    }
}, 1000)

// listen for requests on port 3000
http.listen(PORT, function() {
    console.log("listening on *:" + PORT);
});