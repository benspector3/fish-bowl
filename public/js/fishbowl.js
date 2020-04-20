$(document).ready(function() {
    let socket = io();
    const COLORS = {
        BLUE: "#048cff",
        RED: "#f70d2d",
        LIGHT_BLUE: "#80c5ff",
        LIGHT_RED: "#ff435c"
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
    
    let $roomContainer = $("#room-container");

    // Pre game lobby
    let $preGameLobbyElements = $(".pre-game-lobby");
    let $showAddPhrases = $("#show-add-phrases");
    let $addPhrases = $("#add-phrases");
    let $closeAddPhrases = $("#close-add-phrases");
    let $readyButton = $('#ready-button');
    let $startGameButton = $('#start-game-button');
    let $phraseForm = $("#phrase-form");
    let $phraseInput = $("#phrase-input");

    // Team Elements
    let $joinRedTeamButton = $("#join-red-team-button");
    let $redTeamRosterDiv = $("#red-team");
    let $redTeamPhrasesWon = $("#red-phrases-won");
    let $joinBlueTeamButton = $("#join-blue-team-button");
    let $blueTeamRosterDiv = $("#blue-team");
    let $blueTeamPhrasesWon = $("#blue-phrases-won");
    let $phrasesWon = $(".phrases-won")
    let $clueGiver;
    let $clientName;

    // Game Elements
    let $roundInfo = $("#round-info");
    let $gamePlayDiv = $("#game-play-container");
    let $activeTeam = $("#active-team");
    let $timer = $("#timer");
    let $roundName = $("#round-name");
    let $phrasesLeft = $("#phrases-left");
    let $gameScore = $("#game-score");
    
    // game controls
    let $gameControls = $("#game-controls-container");
    let $showPhraseButton = $("#show-phrase-button");
    let $correctButton = $("#correct-button");
    let $nextRoundButton = $("#next-round-button");
    let $phrase = $("#phrase");

    // Chat
    let $chatForm = $("#chat-form");
    let $chatInput = $("#chat-input");

    // UI Button Handlers
    ////////////////////////////////////////////////////////////////////////////
    
    // lobby buttons
    $joinEnter.click(() => { socket.emit('joinRoom', getLobbyInputData()); });
    $joinCreate.click(() => { socket.emit('createRoom', getLobbyInputData()); });
    $leaveRoom.click(() => { socket.emit('leaveRoom', {});});

    // pre-game lobby buttons
    $howToPlay.click((e) => { 
        e.stopPropagation();
        $instructions.show(); 
    });
    $closeInstructions.click((e) => { $instructions.hide(); });

    $showAddPhrases.click((e) => { 
        e.stopPropagation();
        $addPhrases.show(); 
    });
    $closeAddPhrases.click((e) => { $addPhrases.hide(); });
    $phraseForm.submit(addPhrase);

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

    $showPhraseButton.click((e) => { socket.emit("showPhraseButtonPressed"); });
    $correctButton.click((e) => { socket.emit("phraseCorrectButtonPressed"); });
    $nextRoundButton.click((e) => { socket.emit("nextRoundButtonPressed"); });

    $(document).on('keydown', (e) => {
        if (!isVisible($gameControls)) return;

        if (e.code === "Space" && isVisible($showPhraseButton)) { // space to press "show phrase" 
            $showPhraseButton.click();     
        }
        else if (e.code === "Enter" && isVisible($correctButton)) {   // enter to press "correct"
            $correctButton.click(); 
        }
    });

    // chat buttons
    $chatForm.submit((e) => {
        e.preventDefault(); // prevent the page from reloading
        socket.emit("chatMessage", $chatInput.val()); // send the server the chat mesasge
        $chatInput.val(''); // empty the input field
        return false;
    }); 
    
    // Server Responses to this client
    ///////////////////////////////////////////////////////////
    
    // Fish Bowl Lobby
    socket.on('joinResponse', (data) => { enterRoomLobbyView(data) });
    socket.on('createResponse', (data) => { enterRoomLobbyView(data) });
    socket.on('leaveResponse', (data) => { leaveRoomLobbyView(data) });

    // pre-game lobby
    socket.on('updateLobby', handleLobbyUpdate);
    socket.on('newGameResponse', handleNewGameResponse);
    
    // in game
    socket.on('updateGame', handleGameUpdate);
    socket.on('newActivePlayer', showActivePlayerControls);
    socket.on('showPhraseResponse', handleShowPhraseResponse );
    socket.on('advanceToNextRound', handleAdvanceToNextRound)
    socket.on('switchingTurns', handleSwitchingTurns);
    socket.on('gameOver', handleGameOver);
    socket.on('timerUpdate', updateTimer);

    // chat
    socket.on('chatMessage', receiveChat);
    socket.on('chatHistory', updateChat);

    // Pre-Game Lobby Helper Functions
    /////////////////////////////////////////////////////////////////////////////////////////////////
    
    function handleLobbyUpdate(roomObj) {
        updateReadyTally(roomObj);
        updateTeams(roomObj.game, roomObj.players)
    }
    
    function updateReadyTally(roomObj) {
        if (roomObj.playersReady === Object.keys(roomObj.players).length) {
            $startGameButton.removeClass("unclickable");
        } else {
            $startGameButton.addClass("unclickable");
        }
        $readyButton.text("ready (" + roomObj.playersReady + ")")
    
    }

    function updateTeams(game, players) {
        addPlayerNamesToTeamRoster(game, players, "blueTeam", $blueTeamRosterDiv);
        addPlayerNamesToTeamRoster(game, players, "redTeam", $redTeamRosterDiv);        

        // add (you) indicator next to client name
        $clientName = $("#"+socket.id);
        $clientName.text($clientName.text() + " (you)"); // add a star to client's name
        
        // add indicator and bold to clue giver's name
        if (game.hasBegun) {
            let team = game[game.activeTeam]; 
            $clueGiver = $("#"+team.playerIds[team.activePlayer]);
            $clueGiver.addClass("clue-giver");
            $clueGiver.text("> " + $clueGiver.text() + " <"); 
        }
    }

    function addPlayerNamesToTeamRoster(game, players, team, $teamRosterDiv) {
        $teamRosterDiv.empty();
        game[team].playerIds.forEach((playerId) => {
            let player = players[playerId];
            let $p = $("<p>").attr('id', playerId).text(player.nickname).appendTo($teamRosterDiv);  // display the players name with an id=player.id
            if (player.ready && !game.hasBegun) {               // during the pre-game lobby...
                $("<span>").html('&#10004;').prependTo($p);     // add a check to the beginning of their name if they are readied
            }
        });
    }

    // In-Game Lobby Helper Functions
    /////////////////////////////////////////////////////////////////////////////////////////////////

    function handleGameUpdate(roomObj) {           // Response to gamestate update
        updateTeams(roomObj.game, roomObj.players);
        updateGameInfo(roomObj.game)     // Update the games turn information
    }

    function updateGameInfo(game) {
        // display round name and phrases remaining
        $roundName.text(game.roundNames[game.roundNumber]);     // show the game mode
        $phrasesLeft.text(game.communityBowl.length + " phrases remaining");
        
        // change background to match active team color
        let team = game[game.activeTeam]; 
        $activeTeam.text(team.name + "'s turn ")
            .css("color", COLORS[team.name.toUpperCase()]);
    }
    
    // data: room, players, game
    function handleNewGameResponse(data) {
        console.log("start game player")
        if (data.success) {
            enterGameView();
            updateTimer(data.game.timer - 1);
        } else {
            alert(data.msg);
        }
    }

    function showActivePlayerControls(game) {
        console.log("new active player")
        $roundInfo.show();
        $nextRoundButton.hide();  // hide next-round-button
        $gameScore.parent().hide();  // hide the game score
        $phrasesWon.hide();
        $phrase.text("");   // empty the phrase text
        $correctButton.hide();
        
        // get the id of the active player
        let team = game[game.activeTeam];       
        let id = team.playerIds[team.activePlayer];
        if (id === socket.id) {     // if client is active player, show controls
            $gameControls.show();
            $showPhraseButton.show();
        } else {                    // otherwise hide all controls
            $gameControls.hide();
            $showPhraseButton.hide();
        }
    }

    function handleShowPhraseResponse(data) {
        $showPhraseButton.hide();
        $correctButton.show();
        $phrase.text(data.phrase);
    }

    function handleSwitchingTurns(game) {
        console.log("switching turns");
        updateTimer(game.timer - 1);
    }

    function handleAdvanceToNextRound(game) {
        console.log('next round');
        showScore(game);    // show the end of the round score
        showPhrasesWon(game.redTeam.phrasesWon, game.blueTeam.phrasesWon);
        $nextRoundButton.show();  // show the next-round-button
    }

    function showPhrasesWon(redPhrases, bluePhrases) {
        $phrasesWon.empty();
        $phrasesWon.show();
        
        redPhrases.forEach((phrase) => {
            $redTeamPhrasesWon.append("<p> " + phrase + " </p>");
        });
        bluePhrases.forEach((phrase) => {
            $blueTeamPhrasesWon.append("<p> " + phrase + " </p>");
        });
    }

    function handleGameOver(game) {
        console.log("game over!");
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
        $gameControls.hide();
        $roundInfo.hide();
        $phrase.text("");
        $gameScore.parent().show();
        $gameScore.empty();
        $("<span>").addClass('red-text').text('red ').appendTo($gameScore);
        $("<span>").text(game.redTeam.score + " : " + game.blueTeam.score).appendTo($gameScore);
        $("<span>").addClass('blue-text').text(' blue').appendTo($gameScore);
    }
    
    function updateTimer(time) {
        // update client side timer
        $timer.text(time);
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
            $roomContainer.show();            
            
            // show pre-game lobby controls, the team displays, and the general room controls
            $preGameLobbyElements.show();
            $roomControls.show();           
            
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
        var nickname = $joinNickname.val().trim().split("");
        if (nickname[nickname.length - 1] === "<") {
            nickname.pop();
        }
        if (nickname[0] === ">") {
            nickname.shift();
        }
        return {
            nickname: nickname.join(""),
            roomName: $joinRoom.val().trim(),
            password: $joinPassword.val().trim()
        }
    }

    function enterGameView(data) {
        console.log("entering game view");
        $preGameLobbyElements.hide();
        $gamePlayDiv.show();
        $roundInfo.show();
    }    
    
    // Utility Functions
    ////////////////////////////////////////////////////////////////////////////////////////////
    function isVisible($element) {
        return $element.css("display") !== "none";
    }
});
