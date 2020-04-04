const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const Game = require('./server/game.js');
const PORT = 3000;

app.use(express.static('public'))
// app.use(express.static(path.join(__dirname, 'public')));

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
        this.game = new Game()

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
          if (nameExists) tempName = nickname + "(" + ++counter + ")"
          else nameAvailable = true
        }
      }
      this.nickname = tempName
      this.room = room
      this.team = 'undecided'
      this.role = 'guesser'
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

    // In Room
    ////////////////////////////////////////////////////

    socket.on("phrase added", (phrase) => { addPhraseToGame(socket, phrase) });
    socket.on("phrase removed", (phrase) => { removePhraseFromGame(socket, phrase) });
    socket.on("start game", () => { startGame(socket) });

    // send chat messages
    socket.on('chat message', (data) => { sendMessage(socket, data); });

    // Helper Functions
    ////////////////////////////////////////////////////////

    // Gets client that requested the new game and begins the game for the room
    function startGame(socket) {
        if (!PLAYER_LIST[socket.id]) return // Prevent Crash
        let room = PLAYER_LIST[socket.id].room  // Get the room that the client called from
        let playerIds = Object.keys(ROOM_LIST[room].players);
        
        if (playerIds.length < 4) { // prevent games with less than 4 players from starting
            socket.emit("newGameResponse", {success: false, msg:"You must have at least 4 players in the room to begin"})
            return;
        }
        
        ROOM_LIST[room].game.init(playerIds);      // Make a new game for that room

        // Make everyone in the room a guesser and tell their client the game is new
        for(let player in ROOM_LIST[room].players){
            PLAYER_LIST[player].role = 'guesser';
            SOCKET_LIST[player].emit('switchRoleResponse', {success:true, role:'guesser'})
            SOCKET_LIST[player].emit('newGameResponse', {success:true})
        }
        gameUpdate(room) // Update everyone in the room
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
        let data = {
            message: message,
            nickname: player.nickname
        }
        let room = player.room;
        ROOM_LIST[room].chatHistory.push(data);
        for (let player in ROOM_LIST[room].players){ // For everyone in the passed room
            SOCKET_LIST[player].emit('chat message', data)  // Pass data to the client
        }
    }
    
    // Update the gamestate for every client in the room that is passed to this function
    function gameUpdate(room){
        // Create data package to send to the client
        let gameState = {
            room: room,
            players: ROOM_LIST[room].players,
            game: ROOM_LIST[room].game,
        }
        for (let player in ROOM_LIST[room].players){ // For everyone in the passed room
            gameState.team = PLAYER_LIST[player].team  // Add specific clients team info
            SOCKET_LIST[player].emit('gameState', gameState)  // Pass data to the client
        }
    }
    
    // If the number of players in the room is 0 at this point, delete the room entirely
    function deleteRoomIfEmpty(room) {
        if (Object.keys(ROOM_LIST[room].players).length === 0) {
            delete ROOM_LIST[room]
            console.log("DELETE ROOM: '" + room + "'")
        }
    }
    // Room Handlers
    ////////////////////////////////////////////////////

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
        } else {
            if (roomName === "") {    
                // Tell the client they need a valid room name
                socket.emit('createResponse', {success:false, msg:'Enter A Valid Room Name'})
            } else {
                if (userName === ''){
                    // Tell the client they need a valid nickname
                    socket.emit('createResponse', {success:false, msg:'Enter A Valid Nickname'})
                } else {    // If the room name and nickname are both valid, proceed
                    new Room(roomName, passName)                          // Create a new room
                    let player = new Player(userName, roomName, socket)   // Create a new player
                    ROOM_LIST[roomName].players[socket.id] = player       // Add player to room
                    socket.emit('createResponse', {success:true, msg: ""})// Tell client creation was successful
                    // Server Log
                    console.log(socket.id + "(" + player.nickname + ") CREATED '" + ROOM_LIST[player.room].room + "'(" + Object.keys(ROOM_LIST[player.room].players).length + ")")
                }
            }
        }
    }

    // Join room function
    // Gets a room name and poassword and attempts to join said room
    // On joining, the client that joined the room is created and added to the room
    function joinRoom(socket, data){
        let roomName = data.room.trim()     // Trim whitespace from room name
        let pass = data.password.trim()     // Trim whitespace from password
        let userName = data.nickname.trim() // Trim whitespace from nickname
    
        if (!ROOM_LIST[roomName]){
            // Tell client the room doesnt exist
            socket.emit('joinResponse', {success:false, msg:"Room Not Found"})
        } else {
        if (ROOM_LIST[roomName].password !== pass){ 
            // Tell client the password is incorrect
            socket.emit('joinResponse', {success:false, msg:"Incorrect Password"})
        } else {
            if (userName === ''){
                // Tell client they need a valid nickname
                socket.emit('joinResponse', {success:false, msg:'Enter A Valid Nickname'})
            } else {  // If the room exists and the password / nickname are valid, proceed
                let player = new Player(userName, roomName, socket)   // Create a new player
                ROOM_LIST[roomName].players[socket.id] = player       // Add player to room
                socket.emit('joinResponse', {success:true, msg:""})   // Tell client join was successful
                socket.emit('chat history', ROOM_LIST[roomName].chatHistory);
                // Server Log
                console.log(socket.id + "(" + player.nickname + ") JOINED '" + ROOM_LIST[player.room].room + "'(" + Object.keys(ROOM_LIST[player.room].players).length + ")")
            }
        }
        }
    }

    // Leave room function
    // Gets the client that left the room and removes them from the room's player list
    function leaveRoom(socket){
        if (!PLAYER_LIST[socket.id]) return // Prevent Crash
        let player = PLAYER_LIST[socket.id]              // Get the player that made the request
        delete PLAYER_LIST[player.id]                    // Delete the player from the player list
        delete ROOM_LIST[player.room].players[player.id] // Remove the player from their room
        // Server Log
        console.log(socket.id + "(" + player.nickname + ") LEFT '" + ROOM_LIST[player.room].room + "'(" + Object.keys(ROOM_LIST[player.room].players).length + ")")
        
        // If the number of players in the room is 0 at this point, delete the room entirely
        deleteRoomIfEmpty(player.room);
        socket.emit('leaveResponse', {success:true})     // Tell the client the action was successful
    }

    // Disconnect function
    // Called when a client closes the browser tab
    function socketDisconnect(socket){
        let player = PLAYER_LIST[socket.id] // Get the player that made the request
        delete SOCKET_LIST[socket.id]       // Delete the client from the socket list
        delete PLAYER_LIST[socket.id]       // Delete the player from the player list
    
        if(player){   // If the player was in a room
            delete ROOM_LIST[player.room].players[socket.id] // Remove the player from their room
            // Server Log
            console.log(socket.id + "(" + player.nickname + ") LEFT '" + ROOM_LIST[player.room].room + "'(" + Object.keys(ROOM_LIST[player.room].players).length + ")")
            
            // If the number of players in the room is 0 at this point, delete the room entirely
            deleteRoomIfEmpty(player.room);
        }
        // Server Log
        console.log('DISCONNECT: ' + socket.id)
    }
    
})

// listen for requests on port 3000
http.listen(PORT, function() {
    console.log("listening on *:" + PORT);
});