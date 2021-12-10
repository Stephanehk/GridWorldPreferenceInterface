import Vehicle from "/src/vehicle";
import House from "/src/house";
import Flag from "/src/flag";
import Person from "/src/person";
import Coin from "/src/coin";
import Garbage from "/src/garbage";
import OWTile from "/src/owTile";

import InputHandler from "/src/input";
import TrajHandler from "/src/trajHandler";

export default class Game {
  constructor(gameWidth, gameHeight, spawnPoint, boardName, dispTraj) {
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;
    this.spawnPoint = spawnPoint;
    this.boardName = boardName;
    // this.is_in_blocking = false;
    this.reached_terminal = false;
    this.nSteps = 0;
    this.collectedCoin = false;
    this.dispTraj = dispTraj;
    this.blockingCords = [];
    this.isLeavingBlank = false;
    //metrics used to decompose score
    this.nCoins = 0;
    this.nPeople = 0;
    this.nGarbage = 0;
    this.nFlags = 0;
  }

  start(loadTerm = true, isAnimating = false) {
    this.gameObjects = null;
    this.vehicle = new Vehicle(this, isAnimating);
    // this.coin = new Coin(this, { x: 0, y: 0 });
    this.score = 0;
    this.gasScore = 0;
    this.pScore = 0;
    if (this.dispTraj === false) new InputHandler(this.vehicle);
    // this.board_objects = this.load_board();

    // Assume the async call always succeed
    this.load_board(loadTerm).then(() => {
      this.gameObjects = [...this.board_objects, this.vehicle];
    });
    if (this.dispTraj) {
      this.trajHandler = new TrajHandler(this.vehicle, this);
    }
  }

  update(deltaTime) {
    this.collectedCoin = false;

    if (this.dispTraj === true) this.trajHandler.update(deltaTime);
    this.gameObjects.forEach((object) => object.update(deltaTime));

    //update oneway gates
    if (this.is_in_ow(this.vehicle.lastCol) || this.is_in_ow(this.spawnPoint)) {
      this.ow_obs.forEach(
        (object) =>
          (object.blockade = document.getElementById("img_blockade_closed"))
      );
    } else {
      this.ow_obs.forEach(
        (object) =>
          (object.blockade = document.getElementById("img_blockade_open"))
      );
    }

    if (this.dispTraj === true) {
      this.score = this.trajHandler.score;
      this.pScore = this.trajHandler.pScore;
      this.gasScore = this.trajHandler.gasScore;
    }
  }

  draw(ctx) {
    ctx.globalCompositeOperation = "source-over";
    this.gameObjects.forEach((object) => object.draw(ctx));
    if (this.dispTraj === true) this.trajHandler.draw(ctx);
  }

  is_in_ow(cords) {
    // console.log(cords);
    for (var i = 0; i < this.ow_cords.length; i++) {
      let ow_pos = this.ow_cords[i];

      if (ow_pos.x === cords.x && ow_pos.y === cords.y) {
        return true;
      }
    }
    return false;
  }

  find_is_leaving_blank(nextCords) {
    if (!this.is_in_ow(this.vehicle.lastCol) && this.is_in_ow(nextCords)) {
      this.isLeavingBlank = true;
    } else {
      // console.log(this.vehicle.lastCol);
      this.isLeavingBlank = false;
    }
  }

  find_is_leaving_ow(nextCords) {
    this.isLeaving = false;
    // //check if the car is trying to leave a oneway area
    // if (!this.is_in_ow(nextCords) && this.is_in_ow(this.vehicle.lastCol)) {
    //   this.isLeaving = true;
    // } else {
    //   // console.log(this.vehicle.lastCol);
    //   this.isLeaving = false;
    // }
  }

  async load_board(loadTerm) {
    let objects = [];

    // let json = await (
    //   await fetch(
    //     "/assets/trajData/" + String(this.boardName) + "_json_board.json"
    //   )
    // ).json();
    let json = await (
      await fetch("/assets/boards/" + String(this.boardName) + "_board.json")
    ).json();

    // var json = require("/assets/boards/test_json_board.json");
    var board = [];
    // var blocking_cords = [];
    this.blocking_cords = [];
    this.terminal_cords = [];
    this.ow_cords = [];
    this.ow_obs = [];
    //loads json
    for (var i in json) {
      var row = [];
      for (var j in json[i]) {
        row.push(json[i][j]);
      }
      board.push(row);
    }
    board.forEach((row, rowIndex) => {
      row.forEach((item, itemIndex) => {
        let position = {
          x: itemIndex,
          y: rowIndex
        };
        if (item === 1) {
          if (loadTerm) {
            objects.push(new Flag(this, position));
            this.terminal_cords.push(position);
          }

          // console.log(position);
        }
        if (item === 2) {
          objects.push(new House(this, position));
          this.blocking_cords.push(position);
        }
        if (item === 3) {
          if (loadTerm) {
            objects.push(new Person(this, position));
            this.terminal_cords.push(position);
          }
        }
        if (item === 4) {
          objects.push(new Coin(this, position));
        }
        if (item === 5) {
          objects.push(new Garbage(this, position));
        }
        if (item === 6) {
          let tile = new OWTile(this, position);
          objects.push(tile);
          this.ow_cords.push(position);
          this.ow_obs.push(tile);
        }
        if (item === 7) {
          let tile = new OWTile(this, position);
          objects.push(tile);
          objects.push(new Flag(this, position));
          this.terminal_cords.push(position);
          this.ow_cords.push(position);
          this.ow_obs.push(tile);
        }
        if (item === 8) {
          let tile = new OWTile(this, position);
          objects.push(tile);
          objects.push(new House(this, position));
          this.blocking_cords.push(position);
          this.ow_cords.push(position);
          this.ow_obs.push(tile);
        }
        if (item === 9) {
          let tile = new OWTile(this, position);
          objects.push(tile);
          if (loadTerm) {
            objects.push(new Person(this, position));
            this.terminal_cords.push(position);
            this.ow_obs.push(tile);
          }
          this.ow_cords.push(position);
        }
        if (item === 10) {
          let tile = new OWTile(this, position);
          objects.push(tile);
          objects.push(new Coin(this, position));
          this.ow_cords.push(position);
          this.ow_obs.push(tile);
        }
        if (item === 11) {
          let tile = new OWTile(this, position);
          objects.push(tile);
          objects.push(new Garbage(this, position));
          this.ow_cords.push(position);
          this.ow_obs.push(tile);
        }
      });
    });
    this.board_objects = objects;
  }
}
