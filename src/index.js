import Game from "/src/game";
import Score from "/src/score";
import InstructionsManager from "/src/instructionsManager";
import html2canvas from "html2canvas";
// var proxy = require("html2canvas-proxy");
// var express = require("express");

let canvas = document.getElementById("gameScreen");
let ctx = canvas.getContext("2d");

let scoreDisp = document.getElementById("scoreScreen");
let ctxScore = scoreDisp.getContext("2d");

// var svg = document.querySelector("svg");

const GAME_WIDTH = 600;
const GAME_HEIGHT = 600;
const SCORE_WIDTH = 300;
const SCORE_HEIGHT = 600;
const CELL_SIZE = GAME_WIDTH / 10;

scoreDisp.style.left = "1030px";
scoreDisp.style.top = "20px";
scoreDisp.style.position = "absolute";

//set SVG (for curves as an element of the canvas)

window.spawnPoints = [];
window.boardNames = [];

// const spawnPoint1 = { x: 0, y: 5 };
// window.spawnPoints.push(spawnPoint1);
// const boardName1 = "player_board_1";
// window.boardNames.push(boardName1);

const spawnPoint2 = { x: 0, y: 5 };
window.spawnPoints.push(spawnPoint2);
window.spawnPoints.push(spawnPoint2);

const boardName2 = "player_board_1";
window.boardNames.push(boardName2);
window.boardNames.push(boardName2);

const spawnPoint3 = { x: 0, y: 8 };
window.spawnPoints.push(spawnPoint3);
window.spawnPoints.push(spawnPoint3);

const boardName3 = "player_board_2";
window.boardNames.push(boardName3);
window.boardNames.push(boardName3);

const spawnPoint4 = { x: 8, y: 8 };
window.spawnPoints.push(spawnPoint4);
window.spawnPoints.push(spawnPoint4);

const boardName4 = "player_board_3";
window.boardNames.push(boardName4);
window.boardNames.push(boardName4);

const spawnPoint5 = { x: 0, y: 7 };
window.spawnPoints.push(spawnPoint5);
window.spawnPoints.push(spawnPoint5);

const boardName5 = "player_board_4";
window.boardNames.push(boardName5);
window.boardNames.push(boardName5);

//------------------------------------------------
window.game = null;
window.n_games = 0;
window.max_games = 8;
window.finished_game = true;
window.total_tsteps = 100;
window.timestep = 0;
window.disTraj = true;
window.im = new InstructionsManager();
window.ready2Capture = false;
// window.im.createButton(canvas, ctx);

//creates button
//------------------------------------------------
//https://stackoverflow.com/questions/24384368/simple-button-in-html5-canvas/24384882
function getMousePos(canvas, event) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function isInside(pos, rect) {
  return (
    pos.x > rect.x &&
    pos.x < rect.x + rect.width &&
    pos.y < rect.y + rect.height &&
    pos.y > rect.y
  );
}
var rect = {
  x: 500,
  y: 550,
  width: 100,
  height: 50
};
//Binding the click event on the canvas
canvas.addEventListener(
  "click",
  function (evt) {
    let mousePos = getMousePos(canvas, evt);

    if (isInside(mousePos, rect) && !this.finishedIns) {
      window.im.insScene += 1;
    }
  },
  false
);

//------------------------------------------------

function startNewGame() {
  if (
    window.finished_game &&
    window.timestep < window.total_tsteps &&
    window.n_games < window.max_games
  ) {
    window.finished_game = false;

    let boardName;
    let spawnPoint;
    if (window.disTraj) {
      //2021-07-29_sparseboard2-notrap_board.json
      //test_single_goal_mud
      boardName = "2021-07-29_sparseboard2-notrap";
      spawnPoint = { x: 0, y: 0 };
    } else {
      boardName = window.boardNames[window.n_games];
      spawnPoint = window.spawnPoints[window.n_games];
    }

    window.game = new Game(
      GAME_WIDTH,
      GAME_HEIGHT,
      spawnPoint,
      boardName,
      window.disTraj
    );
    window.game.start();
    window.score = new Score(window.game);
    window.score.start();

    window.lastTime = 0;
    window.alpha = 1; /// current alpha value
    window.delta = 0.005; /// delta = speed
    window.n_games += 1;
    ctx.globalAlpha = 1;

    if (window.n_games === window.max_games) window.n_games = 0;
  }
}

function gameLoop(timestamp) {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctxScore.clearRect(0, 0, SCORE_WIDTH, SCORE_HEIGHT);

  if (!window.im.finishedIns && !window.disTraj) {
    ctx.globalAlpha = 1;
    window.im.update();
    window.im.draw(ctx);
    requestAnimationFrame(gameLoop);
    // requestAnimationFrame(gameLoop);
  } else {
    startNewGame();
    let deltaTime = timestamp - window.lastTime;
    window.lastTime = timestamp;

    if (window.game.reached_terminal === true && !window.disTraj) {
      //figure out how to fade
      window.alpha -= window.delta;
      // if (alpha <= 0 || alpha >= 1) delta = -delta;
      ctx.globalAlpha = window.alpha;
      //clear a bunch of stuff like incompleteCords here
      //if user was playing game
    }

    if (window.alpha > 0) {
      if (window.game.gameObjects != null) {
        window.game.update(deltaTime);
        window.game.draw(ctx);
        window.score.update(deltaTime);
        window.score.draw(ctxScore);

        if (window.timestep > window.total_tsteps) {
          window.game.reached_terminal = true;
          window.im.finishedIns = false;
          window.im.finishedGamePlay = true;
        }
      }
    } else {
      window.finished_game = true;
    }
    if (window.ready2Capture && !window.captured) {
      // const screenshotTarget = document.body;
      // html2canvas(screenshotTarget).then(function (sCanvas) {
      //   saveAs(sCanvas.toDataURL(), "out.png");
      // });
      takeshot();
      window.captured = true;
    }
    requestAnimationFrame(gameLoop);
  }
}

requestAnimationFrame(gameLoop);

function saveAs(uri, filename) {
  var link = document.createElement("a");

  if (typeof link.download === "string") {
    link.href = uri;
    link.download = filename;

    //Firefox requires the link to be in the body
    document.body.appendChild(link);

    //simulate click
    link.click();

    //remove the link when done
    document.body.removeChild(link);
  } else {
    window.open(uri);
  }
}

// const capture = async () => {
//   const canvas_ = document.createElement("canvas");
//   const context = canvas_.getContext("2d");
//   const video = document.createElement("video");

//   try {
//     const captureStream = await navigator.mediaDevices.getDisplayMedia();
//     video.srcObject = captureStream;
//     context.drawImage(video, 0, 0, window.width, window.height);
//     const frame = canvas_.toDataURL("image/png");
//     captureStream.getTracks().forEach((track) => track.stop());
//     window.location.href = frame;
//     // saveAs(frame, "out.png");
//   } catch (err) {
//     console.error("Error: " + err);
//   }
// };

function takeshot() {
  // var app = express();
  // app.use("/", proxy());
  // let div = document.getElementById("entireScreen");
  // html2canvas(div, { allowTaint: true, useCORS: true }).then(function (canvas) {
  //   document.getElementById("output").appendChild(canvas);
  // });
  // var dataURL = canvas.toDataURL();
  // saveAs(dataURL, "out.png");
}
