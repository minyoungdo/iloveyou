//////////////////////////////////////////////////////
// GAME STATE
//////////////////////////////////////////////////////

const GAME = {
    hearts: 0,
    affection: 0,
    stage: 1,
};

loadGame();
updateUI();

//////////////////////////////////////////////////////
// MINI GAME (VERSION 1 — SIMPLE BUT ADDICTIVE)
//////////////////////////////////////////////////////

function playMiniGame(){

    let heartsEarned = Math.floor(Math.random()*8)+3;

    GAME.hearts += heartsEarned;
    GAME.affection += Math.floor(heartsEarned/2);

    speak(`You played with Minyoung and earned ${heartsEarned} hearts!`);

    saveGame();
    updateUI();
}

//////////////////////////////////////////////////////
// SHOP
//////////////////////////////////////////////////////

function openShop(){

    if(GAME.hearts < 5){
        speak("Minyoung looked at the shop window… maybe earn some hearts first?");
        return;
    }

    GAME.hearts -= 5;
    GAME.affection += 5;

    speak("You bought Minyoung a cute gift. She is glowing.");

    saveGame();
    updateUI();
}

//////////////////////////////////////////////////////
// EVOLUTION SYSTEM (THE MAGIC)
//////////////////////////////////////////////////////

function evolveCheck(){

    if(GAME.stage === 1 && GAME.affection >= 20){
        evolve(2,"Minyoung grew into a cheerful child!");
        return;
    }

    if(GAME.stage === 2 && GAME.affection >= 45){
        evolve(3,"Minyoung is now a teenager with dreams.");
        return;
    }

    if(GAME.stage === 3 && GAME.affection >= 75){
        evolve(4,"Minyoung blossomed into a college girl.");
        return;
    }

    if(GAME.stage === 4 && GAME.affection >= 120){
        evolve(5,"Minyoung is now your perfect partner.");
        return;
    }

    speak("Minyoung is still growing… give her more love.");
}

function evolve(stage,message){

    GAME.stage = stage;

    document.getElementById("character").src =
        `assets/characters/stage${stage}-happy.png`;

    speak(message);

    saveGame();
}

//////////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////////

function updateUI(){

    document.getElementById("hearts").innerText = GAME.hearts;
    document.getElementById("affection").innerText = GAME.affection;

    document.getElementById("character").src =
        `assets/characters/stage${GAME.stage}-neutral.png`;
}

function speak(text){
    document.getElementById("dialogue").innerText = text;
}

//////////////////////////////////////////////////////
// SAVE SYSTEM (VERY IMPORTANT)
//////////////////////////////////////////////////////

function saveGame(){
    localStorage.setItem("minyoungSave",JSON.stringify(GAME));
}

function loadGame(){

    const save = localStorage.getItem("minyoungSave");

    if(save){
        Object.assign(GAME,JSON.parse(save));
    }
}
