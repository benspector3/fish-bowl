class Game {
    constructor() {
        this.roundNames = ['taboo', 'charades', 'password'];
        this.timerAmount = 61;
        this.allPhrases = [];
        this.communityBowl = [];
        this.alternateClueGiver = false;
    }

    // playerIds: socket ids for each team's players
    init(playerIds) {
        this.shuffle(playerIds); // randomize the teams and order of the players

        this.redTeam = {
            name: 'red',
            playerIds: playerIds.slice(0, playerIds.length / 2),  // assign the first half of the players to red
            phrasesWon: [],
            activePlayer: 0,
            nextPlayer: 1,
        } 
        this.blueTeam = {
            name: 'blue',
            playerIds: playerIds.slice(playerIds.length / 2),     // assign second half of players to blue
            phrasesWon: [],
            activePlayer: 0,
            nextPlayer: 1
        }

        this.randomTurn();          // When game is created, select red or blue to start, randomly
        this.over = false;          // Whether or not the game has been won / lost
        this.winner = "";           // Winning team
        this.activePhrase = "";     // The phrase currently being displayed to the cluegiver
        this.timer = this.timerAmount;  // Set the timer
        this.roundNumber = 0;

        this.communityBowl = this.allPhrases.slice();
        this.activePhrase = this.getNextPhrase();
    }

    // called when the host presses the start button from the setup lobby


    // returns a random phrase from the community bowl
    getNextPhrase() {
        var randomI = Math.floor(Math.random() * this.communityBowl.length);
        return this.communityBowl[randomI];
    }

    awardPhraseToTeam(team) {
        this.teamBowls[team].push(this.activePhrase);
        this.communityBowl.splice(this.communityBowl.indexOf(this.activePhrase), 1);
        this.activePhrase = this.getNextPhrase();
    }

    changeActivePlayer(team) {
        team.activePlayer = (team.activePlayer + 1) % team.playerIds.length
        team.nextPlayer = (team.nextPlayer + 1) % team.playerIds.length
    }

    addPhrase(phrase) {
        this.allPhrases.push(phrase);
    }

    removePhrase(phrase) {
        this.allPhrases.splice(this.allPhrases.indexOf(phrase));
    }

    goToNextRound() {
        this.roundNumber++;
    }

    // 50% red turn, 50% blue turn
    randomTurn(){
        this.activeTeam = Math.random() < 0.5 ? this.redTeam : this.blueTeam;
    }

    switchTurn() {
        this.activeTeam = (this.activeTeam.name === "red") ? this.blueTeam : this.redTeam;
        this.timer = this.timerAmount;
        this.activePhrase = this.getNextPhrase();
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