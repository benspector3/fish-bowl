$(document).ready(function() {
    let socket = io();

    // Lobby Page Elements
    ////////////////////////////////////////////////////
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
    var $teamTurn = $("#team-turn");
    let $clueGiverName = $("#clue-giver-name");
    let $clueGiverNext = $("#clue-giver-next");
    
    let $nextPhraseForm = $("#next-phrase-form");
    
    let $correctForm = $("#correct-form");
    let $phrase = $("#phrase");

    // init
    ///////////////////////////////////////////////////////////

    // UI Interaction with server
    ////////////////////////////////////////////////////////////////////////////
    
    // Lobby 
    ////////////////////////////////////////////////////////////////////////

    // User Joins Room
    $joinEnter.click(() => { socket.emit('joinRoom', getLobbyInputData()) });
    // User Creates Room
    $joinCreate.click(() => { socket.emit('createRoom', getLobbyInputData()) });
    // User Leaves Room
    $leaveRoom.click(() => { socket.emit('leaveRoom', {}) });

    // Add Phrase Logic
    ////////////////////////////////////////////////////////////////////////
    $phraseForm.submit(addPhrase);

    // Chat Logic
    //////////////////////////////////////////////////////
    $chatForm.submit(sendChat);  
    $startGame.click(hostStartGame);  

    socket.on('chat message', receiveChat);
    socket.on('chat history', updateChat);

    // Server Responses to this client
    ///////////////////////////////////////////////////////////
    
    // Response to joining room
    socket.on('joinResponse', (data) => { enterRoomLobbyView(data, false) });
    // Response to creating room
    socket.on('createResponse', (data) => { enterRoomLobbyView(data, true) });
    // Response to leaving room
    socket.on('leaveResponse', (data) => { leaveRoomLobbyView(data) });


    // data: room, players, game
    socket.on('gameState', (data) =>{           // Response to gamestate update
        updateInfo(data.game, data.players)      // Update the games turn information
        updateTimer(data.game)          // Update the games timer slider
        updatePlayerList(data.players)        // Update the player list for the room
    });

    socket.on('switchRoleResponse', (data) => {

    });

    socket.on('newGameResponse', (data) => {
        if (data.success) {
            enterGameView();
        } else {
            alert(data.msg);
        }
    });

    $nextPhraseForm.submit(() => {
        e.preventDefault();
        // socket.emit("next phrase", {} );
    });
    
    $correctForm.submit(() => {
        e.preventDefault();
        // socket.emit("phrase correct", { phrase: })
    });

    // Helper Functions
    ////////////////////////////////////////////////////////////////

    function hostStartGame(e) {
        e.preventDefault(); // prevent the page from reloading
        socket.emit('start game');
        return false;
    }

    function sendChat(e) {
        e.preventDefault(); // prevent the page from reloading
        socket.emit("chat message", $chatInput.val()); // send the server the chat mesasge
        $chatInput.val(''); // empty the input field
        return false;
    }

    function receiveChat(data) {
        var $li = $("<li> <span class='bold'>" + data.nickname + "</span>: " + data.message + " </li>")
        if (data.id === socket.id) {
            $li.addClass('myMessage');
        }
        $li.appendTo("#messages");
    }

    // chatHistory: Array of chatData Objects
    // chatData: { message, nickname }
    function updateChat(chatHistory) {
        chatHistory.forEach((chatData) => { receiveChat(chatData) });
    }

    function updateInfo(game, players) {
        // update game info displayed to client
        // - current team's turn
        // - phrases remaining/total
        // - score
        /* 
        let $timer = $("#timer");
        */
        $roundName.text("Game Type: " + capitalize(game.roundNames[game.roundNumber]));
        $phrasesLeft.text("Phrases Remaining: " + game.communityBowl.length + " / " + game.allPhrases.length)
        
        let team = game.activeTeam; 
        $teamTurn.text("Team Up: " + capitalize(team.name));

        let clueGiverName = players[team.playerIds[team.activePlayer]].nickname;
        let clueGiverNext = players[team.playerIds[team.nextPlayer]].nickname
        $clueGiverName.text("Clue Giver: " + clueGiverName);
        $clueGiverNext.text("Next Up: " + clueGiverNext);
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
                .click(() => { removePhrase(phrase, $li) })
        
        $("<p>").appendTo($li).text(phrase).css({
            "display": "inline",
            "margin-left": 3
        });
        return false;
    }

    function removePhrase(phrase, $li) {
        $li.remove();
        socket.emit("phrase removed", phrase);    // send the server the phrase
    }

    function capitalize(str) {
        return str[0].toUpperCase() + str.slice(1);
    }
    
});