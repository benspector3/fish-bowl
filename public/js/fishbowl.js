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
    // Buttons
    let $roomControls = $('#general-room-controls');
    let $leaveRoom = $('#leave-room');
    let $howToPlay = $("#how-to-play");
    let $instructions = $("#instructions");
    let $closeInstructions = $("#close-instructions");
    let $readyButton = $('#ready-button');
    let $startGameButton = $('#start-game-button');
    // Chat
    let $chatForm = $("#chat-form");
    let $chatInput = $("#chat-input");
    // Add Phrases Lobby
    let $phraseForm = $("#phrase-form");
    let $phraseInput = $("#phrase-input");

    // Game Elements
    let $gameDiv = $("#game");
    let $teamDisplays = $(".team-display");
    let $roundInfo = $("#round-info");
    let $addPhrasesDiv = $("#add-phrase-container");
    let $gamePlayDiv = $("#game-play-container");
    let $team = $("#team");
    let $timer = $("#timer");
    let $roundName = $("#round-name");
    let $phrasesLeft = $("#phrases-left");
    let $gameScore = $("#game-score");
    
    let $joinRedTeamButton = $("#join-red-team-button");
    let $redTeam = $("#red-team");
    
    let $joinBlueTeamButton = $("#join-blue-team-button");
    let $blueTeam = $("#blue-team");
    
    let $clueGiver;
    let $clientName;
    
    // game controls
    let $gameControls = $("#game-controls-container");
    let $showPhraseButton = $("#show-phrase-button");
    let $correctButton = $("#correct-button");
    let $nextRoundButton = $("#next-round-button");
    let $phrase = $("#phrase");

    // init
    ///////////////////////////////////////////////////////////

    // UI Button Handlers
    ////////////////////////////////////////////////////////////////////////////
    
    // lobby buttons
    $joinEnter.click(() => { 
        var lobbyData = getLobbyInputData();
        socket.emit('joinRoom', lobbyData); 
    });
    $joinCreate.click(() => { 
        var lobbyData = getLobbyInputData();
        socket.emit('createRoom', lobbyData) 
    });
    $leaveRoom.click(() => { 
        socket.emit('leaveRoom', {});
    });

    // in room buttons
    $phraseForm.submit(addPhrase);

    $howToPlay.click((e) => { 
        e.stopPropagation()
        $instructions.show(); 
    });
    $closeInstructions.click((e) => { $instructions.hide(); });
    $(document).click((e) => { 
        if ($(event.target) !== $instructions) { 
            $instructions.hide();
        }
    });

    $readyButton.click((e) => { // decrease ready count if player is readied up, increase otherwise
        $readyButton.toggleClass('readied');
        socket.emit('readyGame', ($readyButton.hasClass('readied') ? 1 : -1));
    });
    $startGameButton.click((e) => {
        if (!$startGameButton.hasClass('unclickable')) {    // only start the game if the button is clickable
            socket.emit('startGame');
        }
    });
    
    // in game buttons
    $joinRedTeamButton.click((e) => { socket.emit("joinRedTeam"); }); 
    $joinBlueTeamButton.click((e) => { socket.emit("joinBlueTeam"); }); 

    $(document).on('keydown', (e) => {  // enable space and enter for game play interaction
        if (e.code === "Space") {   // space to press "show phrase" 
            if ($showPhraseButton.css("display") !== "none") $showPhraseButton.click();     
        }
        if (e.code === "Enter") {   // enter to press "correct"
            if ($correctButton.css("display") !== "none") $correctButton.click(); 
        }
    });

    $showPhraseButton.click((e) => { socket.emit("showPhraseButtonPressed"); });
    $correctButton.click((e) => { socket.emit("phraseCorrectButtonPressed"); });
    $nextRoundButton.click((e) => { socket.emit("nextRoundButtonPressed"); });

    // chat buttons
    $chatForm.submit((e) => {
        e.preventDefault(); // prevent the page from reloading
        socket.emit("chatMessage", $chatInput.val()); // send the server the chat mesasge
        $chatInput.val(''); // empty the input field
        return false;
    }); 
    
    // Server Responses to this client
    ///////////////////////////////////////////////////////////
    
    // Response to joining room
    socket.on('joinResponse', (data) => { enterRoomLobbyView(data) });
    // Response to creating room
    socket.on('createResponse', (data) => { enterRoomLobbyView(data) });
    // Response to leaving room
    socket.on('leaveResponse', (data) => { leaveRoomLobbyView(data) });

    // game events
    socket.on('playerReadyResponse', handlePlayerReadyResponse);
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
    function handlePlayerReadyResponse(data) {
        if (data.success) {
            if (data.playersReady === data.playersTotal) {
                $startGameButton.removeClass("unclickable");
            } else {
                $startGameButton.addClass("unclickable");
            }
            $readyButton.text("ready(" + data.playersReady + ")");
        } else {
            $readyButton.removeClass('readied');
            alert(data.msg);
        }
    }
    
    function handleGameOver(game) {
        console.log("game over!", game);
        showScore(game);
        let blueTeamScore = game.blueTeam.score;
        let redTeamScore = game.redTeam.score;
        let msg = "";
        if (blueTeamScore > redTeamScore) { msg = "blue team wins!"; }
        else if (blueTeamScore < redTeamScore) { msg = "red team wins!"; }
        else { msg = "tie game!"; }
        $gameScore.before($("<h1>").text(msg).addClass("middle"));
    }

    function showScore(game) {
        $team.parent().hide();
        $roundName.parent().hide();
        $gameControls.hide();
        $roundInfo.hide();
        $phrase.text("");
        $gameScore.show();
        $gameScore.empty();
        $("<span>").addClass('red-text').text('red ').appendTo($gameScore);
        $("<span>").text(game.redTeam.score + " : " + game.blueTeam.score).appendTo($gameScore);
        $("<span>").addClass('blue-text').text(' blue').appendTo($gameScore);
    }

    function handleSwitchingTurns(game) {
        console.log("switching turns", game);
        updateInfo(game);
        $timer.text(game.timerAmount - 1);
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
            $correctButton.hide();
        }
        
        updateInfo(data.game);
    }

    // data: room, players, game
    function handleNewGameResponse(data) {
        if (data.success) {
            enterGameView();
            $timer.text(data.game.timerAmount - 1);
        } 
    }

    function showActivePlayerControls(game) {
        $nextRoundButton.hide();  // hide next-round-button
        $gameScore.hide();  // hide the game score
        $phrase.text("");   // empty the phrase text
        
        // get the id of the active player
        let team = game[game.activeTeam];       
        let id = team.playerIds[team.activePlayer];
        if (id === socket.id) {     // if client is active player, show controls
            $gameControls.show();
            $showPhraseButton.show();
            $correctButton.hide();
        } else {                    // otherwise hide all controls
            $gameControls.hide();
            $correctButton.hide();
            $showPhraseButton.hide();
        }
    }

    function handleShowPhraseResponse(data) {
        $showPhraseButton.hide();
        $correctButton.show();
        $phrase.text(data.phrase);
    }

    
    function handleGameStateUpdate(data) {           // Response to gamestate update
        updateTeams(data.game, data.players);
        updateInfo(data.game)     // Update the games turn information
    }
    
    function updateInfo(game) {
        if (!game.hasBegun || game.over) return; // prevent info updates in the room lobby
        
        $roundInfo.show();
        $team.parent().show();
        $roundName.parent().show();
        
        // display round name and phrases remaining
        $roundName.text(capitalize(game.roundNames[game.roundNumber]));     // show the game mode
        $phrasesLeft.text(game.communityBowl.length + " / " + game.allPhrases.length);
        
        // change background to match active team color
        let team = game[game.activeTeam]; 
        $team.text(team.name + "'s turn")
        .css("color", COLORS[team.name.toUpperCase()]);
    }

    function updateTeams(game, players) {
        $blueTeam.empty();
        game.blueTeam.playerIds.forEach((playerId) => {
            let name = players[playerId].nickname;
                $("<p>").attr('id', playerId)
                .text(name)
                .appendTo($blueTeam);
        });
        $redTeam.empty();
        game.redTeam.playerIds.forEach((playerId) => {
            let name = players[playerId].nickname;
                $("<p>").attr('id', playerId)
                .text(name)
                .appendTo($redTeam);
        });

        // add (you) indicator next to client name
        $clientName = $("#"+socket.id);
        $clientName.text($clientName.text() + " (you)"); // add a star to client's name
        
        // add star and bold to clue giver
        if (game.hasBegun) {
            let team = game[game.activeTeam]; 
            $clueGiver = $("#"+team.playerIds[team.activePlayer]);
            $clueGiver.addClass("clue-giver");
            $clueGiver.text($clueGiver.text() + "*"); // add a star to client's name
        }
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

    function enterRoomLobbyView(data) {
        if(data.success){
            console.log("entering room lobby");
            
            // clean up join room view
            $joinDiv.hide();                // hide join / create room controls
            $joinErrorMessage.text('');     // make the join error message blank
            
            // show the in room / game div
            $gameDiv.show();            
            
            // show lobby controls
            $roomControls.show();           
            $readyButton.show();         
            $startGameButton.show();
            $teamDisplays.show();
            $addPhrasesDiv.show();
            
            // show joinTeam buttons
            $joinBlueTeamButton.show();
            $joinRedTeamButton.show();
        } else {
            $joinErrorMessage.text(data.msg);
        }
    }

    function leaveRoomLobbyView(data) {
        if(data.success){
            console.log("leaving room lobby");
            location.reload();
        }
    }

    function getLobbyInputData () {
        return {
            nickname: $joinNickname.val(),
            room: $joinRoom.val(),
            password: $joinPassword.val()
        }
    }

    function enterGameView(data) {
        console.log("entering game view");
        $joinBlueTeamButton.hide();
        $joinRedTeamButton.hide();
        $readyButton.hide();
        $startGameButton.hide();
        $addPhrasesDiv.hide();
        $gamePlayDiv.show();
        $roundInfo.show();
    }

    // Utility Functions
    //////////////////////////////////////////////////////////////////////////////
    function capitalize(str) {
        return str[0].toUpperCase() + str.slice(1);
    }
    
});