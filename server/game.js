class Game {
    constructor() {
        this.roundNames = ['taboo', 'charades', 'password', 'ghost charades'];
        this.timerAmount = 11;
        this.allPhrases = [];
        this.communityBowl = [];
        this.alternateClueGiver = false;
        this.hasBegun = false;
    }

    // playerIds: socket ids for each team's players
    newGame(playerIds) {
        this.shuffle(playerIds); // randomize the teams and order of the players

        this.redTeam = {
            name: 'red',
            playerIds: playerIds.slice(0, playerIds.length / 2),  // assign the first half of the players to red
            phrasesWon: [],
            activePlayer: 0,
            nextPlayer: 1,
            score: 0
        } 
        this.blueTeam = {
            name: 'blue',
            playerIds: playerIds.slice(playerIds.length / 2),     // assign second half of players to blue
            phrasesWon: [],
            activePlayer: 0,
            nextPlayer: 1,
            score: 0
        }

        this.hasBegun = true;
        this.bonusRound = false;
        this.randomTurn();          // When game is created, select red or blue to start, randomly
        this.over = false;          // Whether or not the game has been won / lost
        this.winner = "";           // Winning team
        this.activePhrase = "";     // The phrase currently being displayed to the cluegiver
        this.timer = this.timerAmount;  // Set the timer
        this.timerRunning = false;
        this.roundNumber = 0;

        this.communityBowl = this.allPhrases.slice();
    }

    removePlayer(playerId) {
        var i = this.blueTeam.playerIds.indexOf(playerId);
        if (i >= 0) this.blueTeam.playerIds.splice(i, 1);

        i = this.redTeam.playerIds.indexOf(playerId);
        if (i >= 0) this.redTeam.playerIds.splice(i, 1);
    }
    
    endGame() {
        this.winner = this.blueTeam.score > this.redTeam.score ? "blue" : "red";
        return this.winner;
    }

    // called when the host presses the start button from the setup lobby
    startTimer() {
        this.timerRunning = true;
    }

    stopTimer() {
        this.timerRunning = false;
    }

    // returns a random phrase from the community bowl
    getNextPhrase() {
        var randomI = Math.floor(Math.random() * this.communityBowl.length);
        this.activePhrase = this.communityBowl[randomI];
        return this.activePhrase;
    }

    awardPhraseToTeam() {
        this[this.activeTeam].phrasesWon.push(this.activePhrase);
        this[this.activeTeam].score++;
        this.communityBowl.splice(this.communityBowl.indexOf(this.activePhrase), 1);
        console.log("red phrases: " + this.redTeam.phrasesWon);
        console.log("blue phrases: " + this.blueTeam.phrasesWon);
        console.log("phrases left: " + this.communityBowl);
        this.changeActivePlayer();
    }

    changeActivePlayer() {
        let team = this[this.activeTeam];
        team.activePlayer = (team.activePlayer + 1) % team.playerIds.length
        team.nextPlayer = (team.nextPlayer + 1) % team.playerIds.length
    }

    addPhrase(phrase) {
        this.allPhrases.push(phrase);
    }

    removePhrase(phrase) {
        var i = this.allPhrases.indexOf(phrase);
        if (i !== -1) {
            this.allPhrases.splice(i, 1);
        }
    }

    goToNextRound() {
        this.roundNumber++;
        this.redTeam.phrasesWon = [];
        this.blueTeam.phrasesWon = [];
        
        this.communityBowl = this.allPhrases.slice();
        
        let lastRound = this.bonusRound ? this.roundNames.length : this.roundNames.length - 1;
        if (this.roundNumber === lastRound) {
            this.over = true;
        }
    }

    // 50% red turn, 50% blue turn
    randomTurn(){
        this.activeTeam = Math.random() < 0.5 ? 'redTeam' : 'blueTeam';
    }

    switchTurn() {
        console.log("game.js switching team");
        this.activeTeam = (this.activeTeam === "blueTeam") ? 'redTeam' : 'blueTeam';
        this.activePhrase = this.getNextPhrase();
    }

    resetTimer() {
        this.timer = this.timerAmount;  // reset timer
        this.stopTimer();
    }

    shuffle(array) {
        let currentIndex = array.length, temporaryValue, randomIndex;
      
        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
      
          // Pick a remaining element...
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;
      
          // And swap it with the current element.
          temporaryValue = array[currentIndex];
          array[currentIndex] = array[randomIndex];
          array[randomIndex] = temporaryValue;
        }
        return array;
    }
}



module.exports = Game;