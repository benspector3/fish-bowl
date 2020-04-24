# fish-bowl

Classic party game mixing up taboo, charades, and password made for the web using socket.io, express, and nodejs

Play for free with your friends at [fishbowlparty.herokuapp.com](fishbowlparty.herokuapp.com).

## Create or Join a Game

Sign in to fish bowl by choosing a nickname. Enter a room name and password to either create a new game or join an existing one.

## Game Setup

Once in a Room, you can add and remove phrases to the "bowl" that only you will see.

Game Requirements:

- at least 10 total phrases in the bowl
- at least 4 players in the game
- at least 2 players on each team

Press **start** when all players are ready!

## Game Play

### Rounds

Fish bowl has 3 rounds of game play where teams will take turns trying to guess as many of the words in the bowl as they can. Turns last 90 seconds and the team with the most phrases guessed at the end of the game wins!

The first round is **Taboo** where the **clue giver** can describe the phrase using any words _except the words in the phrase_.

The second round is **Charades** where the clue giver can act out the phrase. No words or sounds are allowed!

The third round is **Password** where the clue giver can use one word to describe the phrase. Choose wisely!

### Turns

The game begins with one team being chosen randomly and one person on their team assigned to be the **clue giver** while the rest of the team are **guessers**. Once the phrase is guessed correctly the **clue giver** switches to the next player on their team.

Once the 90 seconds are up, teams will switch. The clock starts running once the first phrase is drawn during a team's turn and continues to run after the phrase is guessed correctly. Be ready to draw if you are next up!
