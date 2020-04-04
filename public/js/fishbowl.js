$(document).ready(function() {
    let socket = io();

    // Lobby Page Elements
    ////////////////////////////////////////////////////
    let $body = $("body");
    // Divs
    let $joinDiv = $('#join-game')
    let $joinErrorMessage = $('#error-message')
    // Input Fields
    let $joinNickname = $('#join-nickname')
    let $joinRoom = $('#join-room')
    let $joinPassword = $('#join-password')
    // Buttons
    let $joinEnter = $('#join-enter')
    let $joinCreate = $('#join-create')
    
    // Room Lobby Elements
    ////////////////////////////////////////////////////////
    let $roomLobbyDiv = $("#room-lobby");
    // Buttons
    let $leaveRoom = $('#leave-room');
    let $startGame = $('#start-game');
    // Chat
    let $chatForm = $("#chat-form");
    let $chatInput = $("#chat-input");
    // Add Phrases Lobby
    let $phraseForm = $("#phrase-form");
    let $phraseInput = $("#phrase-input");


    // Game Elements
    let $gameDiv = $("#game");
    let $timer = $("#timer");
    let $roundInfoDiv = $("#round-info");
    let $roundName = $("#round-name");
    let $phrasesLeft = $("#phrases-left");
    let $clueGiverName = $("#clue-giver-name");
    let $clueGiverNext = $("#clue-giver-next");
    
    // game controls
    let $gameControls = $("#game-controls-container");
    let $showPhraseForm = $("#show-phrase-form");
    let $showPhraseButton = $("#show-phrase-button");
    let $correctForm = $("#correct-form");
    let $correctButton = $("#correct-button");
    let $phrase = $("#phrase");

    // init
    ///////////////////////////////////////////////////////////

    // UI Button Handlers
    ////////////////////////////////////////////////////////////////////////////
    
    // User Joins Room
    $joinEnter.click(() => { socket.emit('joinRoom', getLobbyInputData()) });
    // User Creates Room
    $joinCreate.click(() => { socket.emit('createRoom', getLobbyInputData()) });
    // User Leaves Room
    $leaveRoom.click(() => { socket.emit('leaveRoom', {}) });

    $phraseForm.submit(addPhrase);

    $chatForm.submit((e) => {
        e.preventDefault(); // prevent the page from reloading
        socket.emit("chat message", $chatInput.val()); // send the server the chat mesasge
        $chatInput.val(''); // empty the input field
        return false;
    }); 
    
    $startGame.click((e) => {
        e.preventDefault(); // prevent the page from reloading
        socket.emit('start game');
        return false;
    });  
    $showPhraseForm.submit((e) => {
        e.preventDefault();

        if ($phrase.text() === "") {    // only emit if the phrase is not being shown
            socket.emit("show phrase", {} );
        }
        $showPhraseButton.hide();
        $correctButton.show();
    });
    $correctForm.submit((e) => {
        e.preventDefault();
        socket.emit("phrase correct", {})
    });

    
    // Server Responses to this client
    ///////////////////////////////////////////////////////////
    
    // Response to joining room
    socket.on('joinResponse', (data) => { enterRoomLobbyView(data, false) });
    // Response to creating room
    socket.on('createResponse', (data) => { enterRoomLobbyView(data, true) });
    // Response to leaving room
    socket.on('leaveResponse', (data) => { leaveRoomLobbyView(data) });

    socket.on('game state', handleGameStateUpdate);

    socket.on('new game response', handleNewGameResponse);
    socket.on('new active player', showActivePlayerControls);

    socket.on('show phrase response', showPhrase );
    socket.on('award phrase response', handleAwardPhraseResponse );
    socket.on('start timer', updateTimer);

    socket.on('chat message', receiveChat);
    socket.on('chat history', updateChat);

    // Helper Functions
    ////////////////////////////////////////////////////////////////
    
    // data: phrase, game
    function handleAwardPhraseResponse(data) {
        updateInfo(data.game, data.players);
    }

    // data: room, players, game
    function handleNewGameResponse(data) {
        if (data.success) {
            enterGameView();
        } else {
            alert(data.msg);
        }
    }

    function showActivePlayerControls(game) {
        console.log(game);
        let team = game.activeTeam;
        let id = team.playerIds[team.activePlayer];
        if (id === socket.id) {
            $gameControls.show();
        } else {
            $gameControls.hide();
            $phrase.hide();
        }
    }

    function showPhrase(data) {
        $phrase.text(data.phrase);
        $phrase.show();
    }

    // chatHistory: Array of chatData Objects
    // chatData: { message, nickname }
    function updateChat(chatHistory) {
        chatHistory.forEach((chatData) => { receiveChat(chatData) });
    }
    
    function receiveChat(data) {
        var $li = $("<li> <span class='bold'>" + data.nickname + "</span>: " + data.message + " </li>")
        if (data.id === socket.id) {
            $li.addClass('myMessage');
        }
        $li.appendTo("#messages");
    }

    function handleGameStateUpdate(data) {           // Response to gamestate update
        updateInfo(data.game, data.players)      // Update the games turn information
        updateTimer(data.game)          // Update the games timer slider
        updatePlayerList(data.players)        // Update the player list for the room
    }

    function updateInfo(game, players) {
        $roundName.text(capitalize(game.roundNames[game.roundNumber]));     // show the game mode
        $phrasesLeft.text(game.communityBowl.length + " / " + game.allPhrases.length);
        
        let team = game.activeTeam; 
        if (team.name === "blue") {
            $body.css("background-color", "#048cff");
        } else {
            $body.css("background-color", "#f70d2d");
        }

        $clueGiverName.text(players[team.playerIds[team.activePlayer]].nickname);
        $clueGiverNext.text(players[team.playerIds[team.nextPlayer]].nickname);
    }
    
    function updateTimer(game) {
        // update client side timer
    }

    function updatePlayerList(players) {
        // Create a li element for each player
        // If player is the clue giver, put brackets around their name
        // add player to their team's UL
    }

    function enterGameView(data) {
        $roomLobbyDiv.hide();
        $gameDiv.show();
    }

    function enterRoomLobbyView(data, host) {
        if(data.success){
            console.log("entering room lobby");
            $joinDiv.hide();
            $roomLobbyDiv.show();
            $joinErrorMessage.text('');
            if (host) {
                $startGame.show();
            }
        } else {
            $joinErrorMessage.text(data.msg);
        }
    }

    function leaveRoomLobbyView(data) {
        if(data.success){
            console.log("leaving room lobby");
            $joinDiv.show();
            $roomLobbyDiv.hide();
        }
    }

    function getLobbyInputData () {
        return {
            nickname: $joinNickname.val(),
            room: $joinRoom.val(),
            password: $joinPassword.val()
        }
    }

    function addPhrase(e) {
        e.preventDefault(); // prevent the page from reloading
        
        let phrase = $phraseInput.val();        // get the phrase from the input field
        socket.emit("phrase added", phrase);    // send the server the phrase
        $phraseInput.val('');   // empty the input field
        
        // append the phrase to the list of phrases in the DOM
        var $li = $("<li>").appendTo("#phrases-added")
        $("<span>").addClass('remove-phrase')
                .text("[X]")
                .appendTo($li)
                .click(() => { 
                    $li.remove();
                    socket.emit("phrase removed", phrase);    // send the server the phrase
                 });
        
        $("<p>").appendTo($li).text(phrase).css({
            "display": "inline",
            "margin-left": 3
        });
        return false;
    }

    function capitalize(str) {
        return str[0].toUpperCase() + str.slice(1);
    }
    
});