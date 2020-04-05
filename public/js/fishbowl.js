$(document).ready(function() {
    let socket = io();
    const COLORS = {
        BLUE: "#048cff",
        RED: "#f70d2d"
    }

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
    let $team = $("#team");
    let $timer = $("#timer");
    let $roundName = $("#round-name");
    let $phrasesLeft = $("#phrases-left");
    let $gameScore = $("#game-score");
    
    let $redTeamScore = $("#red-team-score");
    let $redTeam = $("#red-team");
    let $redTeamPhrases = $("#red-team-phrases");
    let $blueTeamPhrases = $("#blue-team-phrases");

    let $blueTeamScore = $("#blue-team-score");
    let $blueTeam = $("#blue-team");
    
    let $clueGiver;
    let $clientName;
    
    // game controls
    let $gameControls = $("#game-controls-container");
    let $showPhraseForm = $("#show-phrase-form");
    let $showPhraseButton = $("#show-phrase-button");
    let $correctForm = $("#correct-form");
    let $correctButton = $("#correct-button");
    let $nextRoundForm = $("#next-round-form");
    let $nextRoundButton = $("#next-round-button");
    let $phrase = $("#phrase");

    // init
    ///////////////////////////////////////////////////////////

    let players = {};

    // UI Button Handlers
    ////////////////////////////////////////////////////////////////////////////
    
    // User Joins Room
    $joinEnter.click(() => { 
        var lobbyData = getLobbyInputData();
        socket.emit('joinRoom', lobbyData); 
    });
    // User Creates Room
    $joinCreate.click(() => { 
        var lobbyData = getLobbyInputData();
        socket.emit('createRoom', lobbyData) 
    });
    // User Leaves Room
    $leaveRoom.click(() => { 
        socket.emit('leaveRoom', {});
    });

    $phraseForm.submit(addPhrase);

    $chatForm.submit((e) => {
        e.preventDefault(); // prevent the page from reloading
        socket.emit("chatMessage", $chatInput.val()); // send the server the chat mesasge
        $chatInput.val(''); // empty the input field
        return false;
    }); 
    
    $startGame.click((e) => {
        e.preventDefault(); // prevent the page from reloading
        socket.emit('startGame');
        return false;
    });  

    $(document).on('keydown', (e) => {
        if (e.code === "Space" || e.code === "Enter") { // enable space and enter for game play interaction
            if ($showPhraseForm.is(":visible")) $showPhraseForm.submit(); 
            else if ($correctForm.is(":visible")) $correctForm.submit(); 
        }
    });
    $showPhraseForm.submit((e) => {
        e.preventDefault();

        if ($phrase.text() === "") {    // only emit if the phrase is not being shown
            socket.emit("showPhraseButtonPressed", {} );
        }
    });
    $correctForm.submit((e) => {
        e.preventDefault();
        socket.emit("phraseCorrectButtonPressed", {});
    });
    $nextRoundForm.submit((e) => {
        e.preventDefault();
        socket.emit("nextRoundButtonPressed", {});
    });

    
    // Server Responses to this client
    ///////////////////////////////////////////////////////////
    
    // Response to joining room
    socket.on('joinResponse', (data) => { enterRoomLobbyView(data) });
    // Response to creating room
    socket.on('createResponse', (data) => { enterRoomLobbyView(data) });
    // Response to leaving room
    socket.on('leaveResponse', (data) => { leaveRoomLobbyView(data) });
    // Another user joins or leaves the room
    socket.on('updatePlayerList', updatePlayerList);

    // game events
    socket.on('newGameResponse', handleNewGameResponse);
    socket.on('gameState', handleGameStateUpdate);
    socket.on('advanceToNextRound', handleAdvanceToNextRound)
    socket.on('switchingTurns', handleSwitchingTurns);
    socket.on('gameOver', handleGameOver);
    
    socket.on('newActivePlayer', showActivePlayerControls);
    socket.on('showPhraseResponse', handleShowPhraseResponse );
    socket.on('awardPhraseResponse', handleAwardPhraseResponse );
    
    socket.on('timerUpdate', updateTimer);

    socket.on('chatMessage', receiveChat);
    socket.on('chatHistory', updateChat);

    // Helper Functions
    ////////////////////////////////////////////////////////////////

    function handleGameOver(game) {
        console.log("game over!", game);
        $team.parent().hide();
        $roundName.parent().hide();
        $gameControls.hide();
        $phrase.hide();
        $gameScore.show();
        $gameScore.text(game.winner + " team wins!");
    }

    function showScore(game) {
        $team.parent().hide();
        $roundName.parent().hide();
        $gameControls.hide();
        $phrase.hide();
        $gameScore.show();
        $("<span>").addClass('red-text').text('red ').appendTo($gameScore);
        $("<span>").text(game.blueTeam.score + " : " + game.redTeam.score).appendTo($gameScore);
        $("<span>").addClass('blue-text').text(' blue').appendTo($gameScore);
    }

    function handleSwitchingTurns(game) {
        console.log("switching turns", game);
        $timer.text(game.timerAmount - 1);
        updateInfo(game);
    }

    function handleAdvanceToNextRound(game) {
        console.log('next round', game);
        showScore(game);    // show the end of the round score
        $nextRoundButton.show();  // show the next-round-button
    }

    // data: phrase, game
    function handleAwardPhraseResponse(data) {
        // only show the "show phrase" button if there are phrases left in the bowl
        if (data.game.communityBowl.length > 0) {
            $showPhraseButton.show();
        }
        
        updateInfo(data.game);
    }

    // data: room, players, game
    function handleNewGameResponse(data) {
        if (data.success) {
            enterGameView();
            $timer.text(data.game.timerAmount - 1);
        } else {
            alert(data.msg);
        }
    }

    function showActivePlayerControls(game) {
        console.log(game);
        $nextRoundButton.hide();  // hide next-round-button
        $phrase.text("");   // empty the phrase text

        // get the id of the active player
        let team = game[game.activeTeam];       
        let id = team.playerIds[team.activePlayer];
        if (id === socket.id) {     // if client is active player, show controls
            $gameControls.show();
            $showPhraseButton.show();
        } else {                    // otherwise hide them
            $gameControls.hide();
            $correctButton.hide();
        }
    }

    function handleShowPhraseResponse(data) {
        console.log("showing phrase");
        $showPhraseButton.hide();
        $correctButton.show();
        $phrase.text(data.phrase);
    }

    
    function handleGameStateUpdate(data) {           // Response to gamestate update
        updateInfo(data.game)     // Update the games turn information
        // updateTimer(data.game)    // Update the games timer slider
    }
    
    function updateInfo(game) {
        console.log('update game state', game);

        $team.parent().show();
        $roundName.parent().show();
        
        // display round name and phrases remaining
        $roundName.text(capitalize(game.roundNames[game.roundNumber]));     // show the game mode
        $phrasesLeft.text(game.communityBowl.length + " / " + game.allPhrases.length);
        
        // change background to match active team color
        let team = game[game.activeTeam]; 
        $team.text(team.name + "'s turn")
        .css("color", COLORS[team.name.toUpperCase()]);
        
        // update red team roster and score
        $redTeamScore.text("Red Team (" + game.redTeam.score + ")");
        $redTeam.empty();
        game.redTeam.playerIds.forEach((playerId) => {
            addPlayerToTeam(playerId, $redTeam);
        });
        $redTeamPhrases.empty();
        game.redTeam.phrasesWon.forEach((phrase) => {
            addToPhrasesWon(phrase, $redTeamPhrases);
        });
        
        // update blue team roster score
        $blueTeamScore.text("Blue Team (" + game.blueTeam.score + ")");
        $blueTeam.empty();
        game.blueTeam.playerIds.forEach((playerId) => {
            addPlayerToTeam(playerId, $blueTeam);
        });
        $blueTeamPhrases.empty();
        game.blueTeam.phrasesWon.forEach((phrase) => {
            addToPhrasesWon(phrase, $blueTeamPhrases);
        });
        
        // add (you) indicator next to client name
        $clientName = $("#"+socket.id);
        $clientName.text($clientName.text() + "(you)"); // add a star to client's name
        
        // add star and bold to clue giver
        $clueGiver = $("#"+team.playerIds[team.activePlayer]);
        $clueGiver.addClass("clue-giver");
        $clueGiver.text($clueGiver.text() + "*"); // add a star to client's name
    }
    
    function addPlayerToTeam(playerId, $teamDiv) {
        let name = players[playerId].nickname;
        $("<p>").attr('id', playerId)
        .text(name)
        .appendTo($teamDiv);
    }
    
    function addToPhrasesWon(phrase, $teamPhrasesDiv) {
        $("<p>").text(phrase).appendTo($teamPhrasesDiv);
    }
    
    function updateTimer(data) {
        // update client side timer
        $timer.text(data.timer);
    }
    
    // Chat
    ////////////////////////////////////////////////////////////////////////////////////////
    
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

    // Room Lobby
    ////////////////////////////////////////////////////////////////////////////

    function updatePlayerList(data) {
        // TODO
        // Create a li element for each player
        // If player is the clue giver, put brackets around their name
        // add player to their team's UL
        players = data;
        console.log(players);
    }

    function addPhrase(e) {
        e.preventDefault(); // prevent the page from reloading
        
        let phrase = $phraseInput.val().trim();     // get the phrase from the input field and remove whitespace
        if (!phrase) { return false }               // prevent blank phrases
        
        // append the phrase to the list of phrases in the DOM
        var $li = $("<li>").appendTo("#phrases-added")
        $("<p>").appendTo($li).text(phrase);
        $("<button>").addClass('remove-phrase')
        .text("X")
        .appendTo($li)
        .click(() => { 
            $li.remove();
            socket.emit("phraseRemoved", phrase);    // send the server the phrase
        });
        
        $phraseInput.val('');                       // empty the input field
        socket.emit("phraseAdded", phrase);         // send the server the phrase
        return false;
    }

    // Switching Views
    ////////////////////////////////////////////////////////////////////////
    function enterGameView(data) {
        $roomLobbyDiv.hide();
        $gameDiv.show();
    }

    function enterRoomLobbyView(data) {
        if(data.success){
            console.log("entering room lobby");
            $joinDiv.hide();
            $roomLobbyDiv.show();
            $joinErrorMessage.text('');
            $startGame.show();
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

    // Utility Functions
    //////////////////////////////////////////////////////////////////////////////
    function capitalize(str) {
        return str[0].toUpperCase() + str.slice(1);
    }
    
});