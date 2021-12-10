// import screenshot from "desktop-screenshot";
import Vehicle from "/src/vehicle";

export default class TrajHandler {
  constructor(vehicle, game) {
    this.trajLength = 3;
    this.vehicle = vehicle;
    this.game = game;
    this.json = require("/assets/trajData/2021_07_29_sss_chosen.json");
    this.loadedRFunc = false;
    this.tookScreenShot = false;
    this.loadRewardFunction().then(() => {
      this.loadedRFunc = true;
    });

    this.maxPts = 100;
    this.i = 0;
    this.prevI = -1;
    this.cordsI = 20;
    this.quadI = 0;
    this.trajp = 0;
    this.keys = [];
    this.cellSize = vehicle.cellSize;
    this.socket = new WebSocket("ws://localhost:5000");
    this.socket.addEventListener("open", function (event) {
      console.log("Connected to the WS Server!");
    });

    // Listen for messages
    this.socket.addEventListener("message", function (event) {
      this.lastMessageRecieved = event.data;
      console.log("screenshotted traj " + String(event.data));
    });
    this.jsonLength = 0;
    for (var i in this.json) {
      this.keys.push(i);
      this.jsonLength += 1;
    }
    // this.fillStyles = ["red", "blue", "green", "purple"];
    this.init();
  }

  init() {
    // this.vehicle = new Vehicle(this.game, false);
    this.vehicle.lastCol = { x: -1, y: -1 };

    // this.vehicle.just_spawned = true;
    this.vehicle.isDone = false;
    this.vehicle.position = { x: -1, y: -1 };
    this.vehicle.goal = this.vehicle.position;
    this.vehicle.reachedGoal = false;
    this.vehicle.lastAction = null;

    this.game.isLeaving = false;
    this.game.reached_terminal = false;

    this.trajCords = [];
    this.actions = [];
    this.nStyles = 0;
    this.pos2img = {
      left: "img_car_side_f",
      right: "img_car_side",
      up: "img_car_back",
      down: "img_car_front"
    };

    this.pos2dim = {
      left: { x: this.vehicle.sideSizeX, y: this.vehicle.sideSizeY },
      right: { x: this.vehicle.sideSizeX, y: this.vehicle.sideSizeY },
      up: { x: this.vehicle.backSizeX, y: this.vehicle.backSizeY },
      down: { x: this.vehicle.backSizeX, y: this.vehicle.backSizeY }
    };
    this.incompleteCords = [];
    this.incompleteActions = [];
    this.x_img = document.getElementById("img_x");
    this.img_arrow_right = document.getElementById("img_arrow_right");
    this.img_arrow_left = document.getElementById("img_arrow_left");
    this.isPrinted = false;
    this.score = 0;
    this.gasScore = 0;
    this.pScore = 0;
    this.arrowTips = [];
    this.prevXDir = { x: 0, y: 0 };
    this.prevYDir = { x: 0, y: 0 };
    this.circlesDraw = 0;
    this.is3 = false;

    this.game.nCoins = 0;
    this.game.nPeople = 0;
    this.game.nGarbage = 0;
    this.game.nFlags = 0;
  }

  async loadRewardFunction() {
    // let rjson = require("/assets/trajData/" +
    //   String(this.game.boardName) +
    //   "_rewards_function.json");
    let rjson = await (
      await fetch(
        "/assets/boards/" +
          String(this.game.boardName) +
          "_rewards_function.json"
      )
    ).json();
    // console.log(rjson);
    this.rFunc = [];
    for (var i in rjson) {
      let row = [];
      for (var j in rjson[i]) {
        let stateRs = [];
        for (var r in rjson[i][j]) {
          stateRs.push(rjson[i][j][r]);
        }
        row.push(stateRs);
      }
      this.rFunc.push(row);
      // this.keys.push(i);
    }
  }

  updatePos(ns) {
    this.vehicle.goal = ns;
    if (!this.game.find_is_leaving_ow(ns) && !this.vehicle.find_is_blocking()) {
      if (ns.x >= 0 && ns.x <= 9 && ns.y >= 0 && ns.y <= 9) {
        this.vehicle.lastCol = ns;
        this.vehicle.position = ns;
      }
    }
  }

  findActionIndex(a) {
    //actions = [[-1,0],[1,0],[0,-1],[0,1]]
    let actions = [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 }
    ];

    for (var i = 0; i < actions.length; i++) {
      if (actions[i].x === a.x && actions[i].y === a.y) {
        return i;
      }
    }
    return false;
  }

  updateScore(a) {
    if (this.vehicle.isDone) {
      let aI = this.findActionIndex({ x: a[0], y: a[1] });
      if (this.loadedRFunc) {
        let deltaScore = this.rFunc[this.curStatePrevCords.y][
          this.curStatePrevCords.x
        ][aI];
        // console.log(deltaScore);
        this.score += deltaScore;
        this.prevI = this.i;
        //only deduct gas score if we did not just hit a terminal state
        if (Math.abs(deltaScore) != 50) {
          if (!this.game.is_in_ow(this.curStatePrevCords)) {
            this.gasScore -= 1;
          } else {
            this.gasScore -= 2;
          }
        }
        if (deltaScore === -50) {
          this.vehicle.updatedScore = true;
          this.game.nPeople += 1;
        } else if (deltaScore === 50) {
          this.vehicle.updatedScore = true;
          this.game.nFlags += 1;
        }
        // console.log(Math.abs(deltaScore));
        // console.log(this.game.nFlags);
        this.pScore = this.score - this.gasScore;
      }

      // console.log(a);
      // console.log(this.curStatePrevCords);
      // console.log(
      //   this.rFunc[this.curStatePrevCords.y][this.curStatePrevCords.x]
      // );
      // console.log("\n");
      let ns = {
        x: this.curStatePrevCords.x + a[1],
        y: this.curStatePrevCords.y + a[0]
      };
      if (ns.x >= 0 && ns.x < 10 && ns.y >= 0 && ns.y < 10) {
        if (
          !this.inBlocking(ns) &&
          !(
            this.game.is_in_ow(this.curStatePrevCords) &&
            !this.game.is_in_ow(ns)
          )
        )
          this.curStatePrevCords = ns;
      }
    }
  }

  executeTraj(traj) {
    //spawn vehicle at position

    if (this.i === 0) {
      let spawnPoint = { x: traj[0][1], y: traj[0][0] };
      this.trajCords.push(spawnPoint);
      // console.log(spawnPoint);
      this.vehicle.position = spawnPoint;
      this.vehicle.goal = spawnPoint;
      this.vehicle.spawnPoint = spawnPoint;
      this.vehicle.just_spawned = false;
      this.i += 1;
      this.curStatePrevCords = spawnPoint;
      // this.actions.push(null);
    }

    //respawn vehicle back at the beggining
    if (this.i === this.trajLength + 1) {
      let spawnPoint = { x: traj[0][1], y: traj[0][0] };
      this.vehicle.position = spawnPoint;
      this.vehicle.goal = spawnPoint;
      this.vehicle.spawnPoint = spawnPoint;
      this.vehicle.img = document.getElementById(
        this.pos2img[this.firstAction]
      );
      this.vehicle.size_x = this.pos2dim[this.firstAction].x;
      this.vehicle.size_y = this.pos2dim[this.firstAction].y;

      this.vehicle.just_spawned = true;
      return;
    }

    //execute actions

    let a = traj[this.i];

    //----------------------------------------------------
    if (this.prevI !== this.i) this.updateScore(a);
    // console.log(this.i);

    if (a[0] === 0 && a[1] === 1 && this.vehicle.updatedScore === true) {
      // console.log("right");
      if (this.i === 1) {
        this.firstAction = "right";
      }
      this.vehicle.moveRight();
      if (this.vehicle.isDone) this.actions.push("right");
    }
    if (a[0] === 0 && a[1] === -1 && this.vehicle.updatedScore === true) {
      // console.log("left");
      if (this.i === 1) {
        this.firstAction = "left";
      }
      this.vehicle.moveLeft();
      if (this.vehicle.isDone) this.actions.push("left");
    }

    if (a[0] === 1 && a[1] === 0 && this.vehicle.updatedScore === true) {
      // console.log("down");
      if (this.i === 1) {
        this.firstAction = "down";
      }
      this.vehicle.moveDown();
      // console.log("here");
      if (this.vehicle.isDone) this.actions.push("down");
    }
    if (a[0] === -1 && a[1] === 0 && this.vehicle.updatedScore === true) {
      // console.log("up");
      if (this.i === 1) {
        this.firstAction = "up";
      }
      this.vehicle.moveUp();
      if (this.vehicle.isDone) this.actions.push("up");
    }

    let trajPoint = this.vehicle.goal;
    if (this.inBlocking(trajPoint) === true) {
      if (this.inBlocking(this.vehicle.lastCol)) return;
      trajPoint = this.vehicle.lastCol;

      // console.log(trajPoint);
    }

    //problem: this.vehicle.goal is wrong
    // console.log(this.actions);
    // console.log(this.vehicle.lastAction);
    // console.log(this.vehicle.goal);
    // console.log(this.game.reached_terminal);

    let dup = false;
    if (
      this.trajCords[this.trajCords.length - 1].x === trajPoint.x &&
      this.trajCords[this.trajCords.length - 1].y === trajPoint.y
    ) {
      dup = true;
    }
    // console.log(this.incompleteCords);
    // console.log(this.incompleteActions);

    if (dup === false) this.trajCords.push(trajPoint);
  }

  handleArrow(x, y, add) {
    let sa = 10;
    for (var i = 0; i < this.arrowTips.length; i++) {
      if (this.arrowTips[i].x === x && this.arrowTips[i].y === y) {
        return true;
      }
      //search rough area
      if (
        this.arrowTips[i].x - sa < x &&
        this.arrowTips[i].x + sa > x &&
        this.arrowTips[i].y - 3 * sa < y &&
        this.arrowTips[i].y + 3 * sa > y
      ) {
        return true;
      }
    }
    if (add) {
      this.arrowTips.push({ x: x, y: y });
    }
    return false;
  }

  isIncomplete(cords, a) {
    let is_inc = false;
    // console.log(this.incompleteCords.length);
    for (var i = 0; i < this.incompleteCords.length; i++) {
      // use array[i] here
      let blocking_pos = this.incompleteCords[i];
      //&& this.incompleteActions[i] === a
      if (
        blocking_pos.x === cords.x &&
        blocking_pos.y === cords.y &&
        this.incompleteActions[i] === a
      ) {
        is_inc = true;
      }
    }
    return is_inc;
  }

  drawSVG(ctx) {
    this.svgArrow(ctx, 100, 100, 200, 250);

    var svgElement = document.getElementById("SVG");
    let { width, height } = svgElement.getBBox();
    let clonedSvgElement = svgElement.cloneNode(true);
    let outerHTML = clonedSvgElement.outerHTML,
      blob = new Blob([outerHTML], { type: "image/svg+xml;charset=utf-8" });
    let URL = window.URL || window.webkitURL || window;
    let blobURL = URL.createObjectURL(blob);
    let image = new Image();
    // image.onload = () => {
    // let canvas = document.createElement("canvas");
    // canvas.widht = width;

    // canvas.height = height;
    // let context = canvas.getContext("2d");
    // draw image in canvas starting left-0 , top - 0
    image.src = blobURL;
    ctx.drawImage(image, 0, 0, 200, 200);

    //  downloadImage(canvas); need to implement
    //};
  }

  svgArrow(context, p1x, p1y, p2x, p2y) {
    // var p1x = parseFloat(document.getElementById("au").getAttribute("cx"));
    // var p1y = parseFloat(document.getElementById("au").getAttribute("cy"));
    // var p2x = parseFloat(document.getElementById("sl").getAttribute("cx"));
    // var p2y = parseFloat(document.getElementById("sl").getAttribute("cy"));

    // mid-point of line:
    var mpx = (p2x + p1x) * 0.5;
    var mpy = (p2y + p1y) * 0.5;

    // angle of perpendicular to line:
    var theta = Math.atan2(p2y - p1y, p2x - p1x) - Math.PI / 2;

    // distance of control point from mid-point of line:
    var offset = 30;

    // location of control point:
    var c1x = mpx + offset * Math.cos(theta);
    var c1y = mpy + offset * Math.sin(theta);

    // show where the control point is:
    // var c1 = document.getElementById("cp");
    // c1.setAttribute("cx", c1x);
    // c1.setAttribute("cy", c1y);

    // construct the command to draw a quadratic curve
    var curve =
      "M" + p1x + " " + p1y + " Q " + c1x + " " + c1y + " " + p2x + " " + p2y;
    var curveElement = document.getElementById("curve");
    curveElement.setAttribute("d", curve);
  }

  trajBounds() {
    let lowestX = null;
    let lowestY = null;
    let highestX = -1;
    let highestY = -1;
    // console.log(this.trajCords.length);
    for (var i = 0; i < this.trajCords.length; i++) {
      let c = this.trajCords[i];

      if (lowestY === null || c.y < lowestY) {
        lowestY = c.y;
      }
      if (c.y > highestY) {
        highestY = c.y;
      }
      if (c.x > highestX) {
        highestX = c.x;
      }
      if (lowestX === null || c.x < lowestX) {
        lowestX = c.x;
      }
    }
    return { lx: lowestX, ly: lowestY, hx: highestX, hy: highestY };
  }

  cord2canvas(val, size) {
    return this.cellSize * val + this.cellSize / 2 - size / 2;
  }

  canvas2cord(val, size) {
    return Math.round(
      (val - this.cellSize / 2 + size / 2) * (1 / this.cellSize)
    );
  }

  maskOutBg(ctx) {
    let rectCords = this.trajBounds();
    //overlay
    //lighten
    ctx.globalCompositeOperation = "saturation";
    ctx.beginPath();

    let box1h;
    if (rectCords.lx === 0) {
      box1h = this.cord2canvas(rectCords.ly - 0.5, 0);
    } else {
      box1h = this.game.gameHeight;
    }
    //left rect
    ctx.rect(0, 0, this.cord2canvas(rectCords.lx - 0.5, 0), box1h);
    //bottom rect
    ctx.rect(
      0,
      this.cord2canvas(rectCords.hy + 0.5, 0),
      this.game.gameWidth,
      this.game.gameHeight
    );
    //right rect
    let box3h;
    if (rectCords.hx === 9) {
      box3h = this.cord2canvas(rectCords.ly + 0.5, 0);
    } else {
      box3h = this.game.gameHeight;
    }
    ctx.rect(
      this.cord2canvas(rectCords.hx + 0.5, 0),
      0,
      this.game.gameWidth,
      box3h
    );
    let box4h;
    if (rectCords.ly === 0) {
      box4h = 0;
    } else {
      box4h = this.cord2canvas(rectCords.ly + 0.5, 0);
    }
    //top rect
    ctx.rect(
      this.cord2canvas(rectCords.lx - 1 + 0.5, 0),
      0,
      this.game.gameWidth,
      box4h
    );
    ctx.fillStyle = "whitesmoke";
    ctx.fill();
  }

  recolorCanvas(ctx) {
    ctx.globalAlpha = 0.3;
    ctx.globalCompositeOperation = "saturation";
    // ctx.beginPath();
    // ctx.rect(0, 0, this.game.gameWidth, this.game.gameHeight);
    // ctx.fillStyle = "whitesmoke";
    // ctx.fill();
  }

  handelSameDir(p1, p2, ctx, first = false) {
    if (
      p1 === undefined ||
      p2 === undefined ||
      p1.inc === true ||
      p2.inc === true
    )
      return;
    if (
      (p1.a === "left" && p2.a === "right") ||
      (p1.a === "right" && p2.a === "left")
    ) {
      this.handled = true;
      if (first) this.sameDirYoffset = -8;
      else this.sameDirYoffset = 8;
    } else if (
      (p1.a === "up" && p2.a === "down") ||
      (p1.a === "down" && p2.a === "up")
    ) {
      this.handled = true;
      // console.log(p1);
      if (first) this.sameDirXoffset = -8;
      else this.sameDirXoffset = 8;
    }
  }

  handelMulSameDir(p1, p2, p3, ctx, first = false) {
    if (
      ((p1.a === "left" && p2.a === "right") ||
        (p1.a === "right" && p2.a === "left")) &&
      (p3.a === "left" || p3.a === "right")
    ) {
      this.sameDirYoffset = 0;
    } else if (
      ((p1.a === "up" && p2.a === "down") ||
        (p1.a === "down" && p2.a === "up")) &&
      (p3.a === "up" || p3.a === "down")
    ) {
      // console.log("here");
      this.sameDirXoffset = 0;
    }
  }

  canvasArrow(ctx, p1, p2, p3 = null, p4 = null) {
    this.sameDirXoffset = 0;
    this.sameDirYoffset = 0;
    let x;
    let y;
    if (p1 != null) {
      x = this.cord2canvas(p1.x, 0);
      y = this.cord2canvas(p1.y, 0);
    }

    let xn = this.cord2canvas(p2.x, 0);
    let yn = this.cord2canvas(p2.y, 0);

    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 5;
    // console.log("here");
    if (p1 != null && p1.inc === true && p2.inc === true) {
      return;
    }
    this.handled = false;
    if (p3 != null && !this.handled) {
      if (this.lastInc !== true) {
        this.handelSameDir(p1, p3, ctx);
      }
      //if prev is incomplete, compare current to prev prev
      if (this.lastInc === true) {
        this.handelSameDir(p2, p3, ctx);
      }
    }
    if (p1 != null && !this.handled) {
      if (this.lastInc !== true) {
        this.handelSameDir(p1, p2, ctx, true);
      }
      //if current is incomplete, compare prev to next
      if (p4 !== null && p2.inc === true) this.handelSameDir(p1, p4, ctx, true);
    }
    if (p1 != null && p3 != null && !this.handled)
      this.handelMulSameDir(p1, p2, p3, ctx);

    if (p1 != null && p1.inc && !p2.inc) {
      // console.log("here");
      //previous point is incomplete
      // console.log("here");
      if (p2.y - 1 === p1.y) {
        // console.log("here");
        ctx.moveTo(x + this.sameDirXoffset, y + 20 + this.sameDirYoffset);
        ctx.lineTo(xn + this.sameDirXoffset, yn + this.sameDirYoffset);
      }

      if (p1.y - 1 === p2.y) {
        ctx.moveTo(x + this.sameDirXoffset, y + this.sameDirYoffset);
        ctx.lineTo(xn + this.sameDirXoffset, yn + this.sameDirYoffset);
      }
      //moving from left to rigjt
      if (p2.x - 1 === p1.x) {
        // console.log("here");
        ctx.moveTo(x + 5 + this.sameDirXoffset, y - 2 + this.sameDirYoffset);
        ctx.lineTo(xn - 20 + this.sameDirXoffset, yn - 2 + this.sameDirYoffset);
      }
      //moving from right to left
      if (p1.x - 1 === p2.x) {
        // console.log("here");
        // ctx.moveTo(x, y - 10);
        // ctx.lineTo(x, y - 2);
        ctx.moveTo(x + this.sameDirXoffset, y - 2 + this.sameDirYoffset);
        ctx.lineTo(xn + this.sameDirXoffset, yn - 2 + this.sameDirYoffset);
      }
    } else if (p1 != null && p2.inc && !p1.inc) {
      // console.log("here");

      if (p2.x - 1 === p1.x) {
        ctx.moveTo(x + this.sameDirXoffset, y - 2 + this.sameDirYoffset);
        ctx.lineTo(xn + 5 + this.sameDirXoffset, yn - 2 + this.sameDirYoffset);
      }

      if (p2.y - 1 === p1.y) {
        // console.log("here");
        ctx.moveTo(x + this.sameDirXoffset, y - 5 + this.sameDirYoffset);
        ctx.lineTo(xn + this.sameDirXoffset, yn + this.sameDirYoffset);
      }

      if (p1.y - 1 === p2.y) {
        // console.log("here");
        ctx.moveTo(x + this.sameDirXoffset, y - 5 + this.sameDirYoffset);
        ctx.lineTo(xn + this.sameDirXoffset, yn + this.sameDirYoffset);
      }

      //moving from right to left
      if (p1.x - 1 === p2.x) {
        // console.log("here");
        ctx.moveTo(x - 5 + this.sameDirXoffset, y - 2 + this.sameDirYoffset);
        ctx.lineTo(xn + this.sameDirXoffset, yn - 2 + this.sameDirYoffset);
      }
      // console.log("here");
    } else {
      //check for prevprev (s,a) pair

      // if (p3 != null && p3.inc === false) {
      //   this.handelSameDir(p2, p3, ctx);
      // }

      // if (p3 != null && p3.inc === false) {
      //   this.handelSameDir(p1, p3, ctx);
      // }

      // if (p1 != null && p1.inc === false) {
      //   this.handelSameDir(p1, p2, ctx, true);
      // }

      if (p1 != null && p1.x !== p2.x) {
        // console.log("here");
        // console.log(p1.a);
        // console.log(p2.a);
        // console.log("\n");
        ctx.moveTo(x + this.sameDirXoffset, y - 3 + this.sameDirYoffset);
        ctx.lineTo(xn + this.sameDirXoffset, yn - 3 + this.sameDirYoffset);
      } else if (p1 != null && p1.y !== p2.y) {
        // console.log("here");
        ctx.moveTo(x + this.sameDirXoffset, y + this.sameDirYoffset);
        ctx.lineTo(xn + this.sameDirXoffset, yn + this.sameDirYoffset);
      }
    }
    ctx.stroke();
  }
  drawCircle2(ctx) {
    let fillStyles = [
      "rgb(192, 169, 72)",
      "rgb(192, 170, 194)",
      "rgb(127, 117, 251)"
    ];
    let circlesDrawn = 0;

    while (circlesDrawn < 3) {
      ctx.fillStyle = fillStyles[circlesDrawn];
      // console.log(circlesDrawn);
      let bounds = this.trajBounds();
      let xoffset = 30;
      let yoffset = 0;
      let x;
      let y;

      if (circlesDrawn === 0) {
        x = bounds.hx;
        y = bounds.ly;
      } else if (circlesDrawn === 1) {
        x = bounds.hx;
        y = (bounds.ly + bounds.hy) / 2;
        if (bounds.ly === bounds.hy) y = bounds.ly + 0.5;
      } else if (circlesDrawn === 2) {
        x = bounds.hx;
        y = bounds.hy;
        if (bounds.ly === bounds.hy) y = bounds.ly + 1;
      }

      x = this.cord2canvas(x, 20) + 20;
      y = this.cord2canvas(y, 15);
      // console.log(this.trajCords[0]);
      // ctx.fill();
      ctx.setLineDash([0, 0]);

      ctx.beginPath();

      // console.log(this.fillStyle);
      ctx.arc(x + xoffset, y + yoffset, 13, 0, 2 * Math.PI);
      ctx.fill();
      // ctx.stroke();

      ctx.font = "20px CustomFont";
      ctx.fillStyle = "white";
      ctx.fillText(String(circlesDrawn + 1), x + xoffset - 5, y + yoffset + 5);
      circlesDrawn += 1;
    }
  }
  drawCircle3(ctx, text, x, y, xDir, yDir, nXDir, nYDir) {
    ctx.beginPath();
    ctx.setLineDash([0, 0]);
    // console.log(x);
    //out of bounds on left side
    // if (x < 30) {
    //   x += 20;
    // }
    let xoffset = 0;
    let yoffset = 0;
    if (xDir > 0) {
      // console.log(nXDir);

      yoffset = 15;
      xoffset = -20;
      if (nXDir < 0) {
        yoffset = -15;
      }
    } else if (xDir < 0) {
      yoffset = 15;
      xoffset = 20;
      if (nXDir > 0) {
        yoffset = -15;
      }

      if (this.prevYDir < 0 && text !== "1") {
        yoffset = -20;
      }
    } else if (yDir > 0) {
      yoffset = -30;
      // console.log(text);
      if (this.prevXDir > 0 && text !== "1") {
        xoffset = 20;
        // } else if (this.prevYDir < 0) {
        //   // console.log(text);
        //   // console.log(this.nYDir);
        //   if (this.nYDir > 0) {
        //     console.log("here");
        //   }
      } else {
        xoffset = -15;
      }
    } else if (yDir < 0) {
      // console.log(text);
      yoffset = 30;
      xoffset = -15;
      if (this.prevXDir > 0 && text !== "1") {
        xoffset = -15;

        // console.log(text);
      }
      // console.log("here");
    }

    let isOverlapping = this.handleArrow(x + xoffset, y + yoffset, false);
    // console.log(isOverlapping);
    if (isOverlapping && xDir > 0) {
    }
    if (isOverlapping && xDir < 0) {
    } else if (isOverlapping && yDir > 0) {
      // console.log(isOverlapping);
      xoffset += 35;
    } else if (isOverlapping && yDir < 0) {
      // console.log("here");
      //first try moving it up a little bit
      yoffset += 10;
      isOverlapping = this.handleArrow(x + xoffset, y + yoffset, false);
      //then try moving it down a little bit
      if (isOverlapping) {
        yoffset -= 20;
        isOverlapping = this.handleArrow(x + xoffset, y + yoffset, false);
        //otherwise move it all the way to the left
        if (isOverlapping) {
          // yoffset += 20;
          xoffset += 35;
        }
      }
      // xoffset -= 35;
    }
    // console.log(x + xoffset);
    // console.log(y + yoffset);
    // console.log("\n");
    this.handleArrow({ x: x + xoffset, y: y + yoffset }, true);
    // console.log(this.arrowTips);
    ctx.arc(x + xoffset, y + yoffset, 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.font = "20px CustomFont";
    ctx.fillStyle = "white";
    ctx.fillText(text, x + xoffset - 5, y + yoffset + 5);
    // ctx.fill();
    this.prevXDir = xDir;
    this.prevYDir = yDir;
  }

  drawTriangle(ctx, tipCordX, tipCordY, xDir, yDir, nXDir, nYDir) {
    ctx.beginPath();

    let offset1 = 0;
    let offset2 = 0;
    let offset3 = 0;
    let offset4 = 0;
    let offset5 = 0;
    let offset6 = 0;
    let offset7 = 0;
    let label_offset_x = 0;
    let label_offset_y = 0;

    if (xDir > 0) {
      offset1 = 15;
      offset2 = -30;
      offset3 = -10;
      label_offset_x = -12;
      label_offset_y = 2;
    } else if (xDir < 0) {
      offset1 = 0;
      offset2 = 0;
      offset3 = 10;
      label_offset_x = 8;
      label_offset_y = 2;
    } else if (yDir > 0) {
      // console.log("here");
      offset2 = -3.5;
      offset3 = 10;
      offset4 = 10 - 10;
      offset5 = -24;
      offset6 = -4;
      offset7 = -25;
      label_offset_x = -2;
      label_offset_y = -7;
    } else if (yDir < 0) {
      // console.log("here");
      offset2 = -3.5;
      offset3 = 10;
      offset4 = -5 + 10;
      offset5 = -24;
      offset6 = 24;
      offset7 = 5;
      label_offset_x = -2;
      label_offset_y = 11;
    }
    // ctx.fillStyle = prevFill;
    let prevFill = ctx.fillStyle.valueOf();

    tipCordY = tipCordY + 5 + offset4 + this.sameDirYoffset;
    tipCordX = tipCordX + offset3 + offset1 + this.sameDirXoffset;
    this.handleArrow(tipCordX, tipCordY, true);
    let arrowLength = 15;
    let arrowHeight = 20;
    ctx.moveTo(tipCordX, tipCordY);
    ctx.lineTo(
      tipCordX + arrowLength + offset2,
      offset7 + tipCordY + arrowHeight / 2
    );
    ctx.lineTo(
      tipCordX + arrowLength + offset2 + offset5,
      offset6 + tipCordY - arrowHeight / 2
    );

    ctx.fill();
    // ctx.font = "9px CustomFont";
    // ctx.fillStyle = "white";
    let text;

    if (prevFill === "#c0a948") text = "1";
    else if (prevFill === "#c0aac2") text = "2";
    else text = 3;

    // console.log(text);
    // console.log(nYDir);
    // this.drawCircle(
    //   ctx,
    //   text,
    //   tipCordX + label_offset_x,
    //   tipCordY + label_offset_y,
    //   xDir,
    //   yDir,
    //   nXDir,
    //   nYDir
    // );
    // ctx.fillText(text, tipCordX + label_offset_x, tipCordY + label_offset_y);
    ctx.fillStyle = prevFill;
  }

  inBlocking(cords) {
    for (var i = 0; i < this.game.blockingCords.length; i++) {
      if (
        cords.x === this.game.blockingCords[i].x &&
        cords.y === this.game.blockingCords[i].y
      ) {
        return true;
      }
    }
    return false;
  }

  remove(arr, cords, removeNonInc = false) {
    let ret = [];
    for (var i = 0; i < arr.length; i++) {
      if (!removeNonInc) {
        if (
          !(
            arr[i].x === cords.x &&
            arr[i].y === cords.y &&
            arr[i].a === cords.a &&
            arr[i].inc === cords.inc
          )
        ) {
          ret.push(arr[i]);
        }
      } else {
        if (
          !(
            arr[i].x === cords.x &&
            arr[i].y === cords.y &&
            arr[i].a === cords.a &&
            arr[i].inc !== cords.inc
          )
        ) {
          ret.push(arr[i]);
        }
      }
    }
    return ret;
  }

  drawX(ctx, x, y) {
    let size = 6;

    ctx.setLineDash([]);
    ctx.lineWidth = 5;
    ctx.beginPath();

    ctx.moveTo(x - size + 10, y - size + 5);
    ctx.lineTo(x + size + 10, y + size + 5);

    ctx.moveTo(x + size + 10, y - size + 5);
    ctx.lineTo(x - size + 10, y + size + 5);
    ctx.stroke();

    ctx.setLineDash([5, 5]);
  }

  updateColors(ctx, replace = false, increment = 1) {
    // console.log(this.fillStyles[this.nStyles]);

    while (this.styleStatus[this.nStyles] === true) {
      this.nStyles += 1;
    }

    ctx.fillStyle = this.fillStyles[this.nStyles];
    ctx.strokeStyle = this.fillStyles[this.nStyles];
    this.styleStatus[this.nStyles] = true;
    // if (replace) {
    //   this.fillStyles[this.nStyles] = this.fillStyles[this.nStyles + 1];
    // }
    this.nStyles += increment;
  }

  cartesianProduct(arr) {
    return arr.reduce(
      function (a, b) {
        return a
          .map(function (x) {
            return b.map(function (y) {
              return x.concat([y]);
            });
          })
          .reduce(function (a, b) {
            return a.concat(b);
          }, []);
      },
      [[]]
    );
  }

  dist(c1, c2) {
    return Math.hypot(c1.x - c2.x, c1.y - c2.y);
  }

  seenCurrent(seen, current) {
    for (var i = 0; i < seen.length; i++) {
      if (
        seen[i].x === current.x &&
        seen[i].y === current.y &&
        seen[i].a === current.a
      ) {
        return true;
      }
    }
    return false;
  }

  drawCircle(ctx, centers) {
    //ERROR: SOMEHOW SOMEWHERE ONE OF OUR CENTERS IS REMVOED
    //6 possible combos, find the one with the greates min distance

    let fillStyles = [
      "rgb(192, 169, 72)",
      "rgb(192, 170, 194)",
      "rgb(127, 117, 251)"
    ];
    let allCandidateKeys = [];
    let index2cord = {};
    let index2gridCords = {};
    let index2center = {};
    let c_i = 0;
    let seen = [];
    let prevInc = false;
    // console.log(centers);

    // if (centers.length === 3) {
    //   this.is3 = true;
    // // }
    // if (centers.length === 2) {
    //   console.log(centers);
    //   throw new Error("debug stop");
    // }
    // console.log(centers.length);
    for (var i = 0; i < centers.length; i++) {
      let current = centers[i];
      // console.log(current);
      // console.log(prevInc);
      // consolexs.log("\n");
      //correct last trajectory segment action (if coming from blocking cord)
      //-------------------------------------------------------
      // if (
      //   i === centers.length - 1 &&
      //   current.a === "up" &&
      //   prevInc === true &&
      //   current.inc === false
      // ) {
      // console.log("here");
      // console.log(centers[i - 1].x - current.x);
      if (
        i === centers.length - 1 &&
        // current.a === "up" &&
        prevInc === true &&
        current.inc === false
      ) {
        if (centers[i - 1].x - current.x < 0) {
          current.a = "right";
        } else if (centers[i - 1].x - current.x > 0) {
          current.a = "left";
        } else if (centers[i - 1].y - current.y < 0) {
          current.a = "down";
        } else if (centers[i - 1].y - current.y > 0) {
          current.a = "up";
          // console.log("here");
        }
      }

      // if (
      //   i === centers.length - 1 &&
      //   current.a === "left" &&
      //   prevInc === true &&
      //   current.inc === false
      // ) {
      //   // console.log("here");
      //   // console.log(centers[i - 1].x - current.x);
      //   if (centers[i - 1].y - current.y < 0) {
      //     current.a = "down";
      //   } else if (centers[i - 1].y - current.y > 0) {
      //     current.a = "up";
      //     // console.log("here");
      //   }
      // }
      //-------------------------------------------------------

      // if (this.seenCurrent(seen, current)) {
      //   // console.log(current);
      //   continue;
      // } else {
      //   seen.push(current);
      // }
      // console.log(current);
      let candidates = [];
      let colCandidates = [];
      let xoffset1 = 0;
      let yoffset1 = 0;
      let xoffset2 = 0;
      let yoffset2 = 0;
      let centerOffset = 0;

      if (current.a === "left" || current.a === "right") {
        // console.log("here");
        if (current.a === "right") {
          xoffset1 = 20;
          xoffset2 = 20;
          yoffset1 = 5;
          yoffset2 = -5;
          // console.log(current);

          if (prevInc) {
            current = {
              x: current.x - 1,
              y: current.y,
              a: current.a,
              inc: current.inc
            };
            // console.log("here");
          }
        } else if (current.a === "left") {
          // console.log(current);
          xoffset1 = -20;
          xoffset2 = -20;
          yoffset1 = -5;
          yoffset2 = 5;
          if (prevInc) {
            // console.log("here");
            current = {
              x: current.x + 1,
              y: current.y,
              a: current.a,
              inc: current.inc
            };
          }
        }
        // console.log(current);

        if (current.y > 0) {
          if (current.a === "right") centerOffset = -35;
          else centerOffset = -25;
        } else {
          if (current.a === "right") centerOffset = -30;
          else centerOffset = -15;
        }
        // candidates.push(current);

        // console.log(c_i);
        // console.log(current);
        candidates.push(c_i);
        index2center[c_i] = current;
        index2gridCords[c_i] = { x: current.x, y: current.y };
        index2cord[c_i] = {
          x: this.cord2canvas(current.x, 0) + xoffset1,
          y: this.cord2canvas(current.y, 0) + centerOffset + yoffset1
        };

        c_i += 1;
        if (current.y < 9) {
          centerOffset = 25;
          // console.log("here");
        } else {
          centerOffset = 25;
        }

        candidates.push(c_i);
        index2center[c_i] = current;
        index2gridCords[c_i] = { x: current.x, y: current.y };
        index2cord[c_i] = {
          x: this.cord2canvas(current.x, 0) + xoffset2,
          y: this.cord2canvas(current.y, 0) + centerOffset + yoffset2
        };

        c_i += 1;
        //handle collisions
      } else if (current.a === "up" || current.a === "down") {
        if (current.a === "up") {
          if (prevInc) {
            // console.log("here");
            current = {
              x: current.x,
              y: current.y + 1,
              a: current.a,
              inc: current.inc
            };
          }
        }

        if (current.a === "down") {
          if (prevInc) {
            // console.log("here");
            current = {
              x: current.x,
              y: current.y - 1,
              a: current.a,
              inc: current.inc
            };
          }
        }
        if (current.a === "up") {
          yoffset1 = -20;
          yoffset2 = -20;

          //figure out which side of the arrow we are on
          xoffset1 = -5;
          xoffset2 = 5;
        } else if (current.a === "down") {
          yoffset1 = 20;
          yoffset2 = 20;

          //figure out which side of the arrow we are on
          xoffset1 = -5;
          xoffset2 = 5;
        }

        if (current.x > -1) {
          // console.log(c_i);
          // candidates.push(current);
          candidates.push(c_i);
          index2center[c_i] = current;
          index2gridCords[c_i] = { x: current.x, y: current.y };
          index2cord[c_i] = {
            x: this.cord2canvas(current.x, 0) - 20 + xoffset1,
            y: this.cord2canvas(current.y, 0) + yoffset1
          };
        }
        c_i += 1;

        if (current.x < 10) {
          // console.log(current.a);
          // console.log(c_i);

          candidates.push(c_i);
          index2center[c_i] = current;
          index2gridCords[c_i] = { x: current.x, y: current.y };
          index2cord[c_i] = {
            x: this.cord2canvas(current.x, 0) + 20 + xoffset2,
            y: this.cord2canvas(current.y, 0) + yoffset2
          };
        }
        c_i += 1;
      }

      if (current.inc === true) prevInc = true;

      if (current.inc === true && centers.length < 3) {
        if (current.x < 9) {
          colCandidates.push(c_i);
          index2center[c_i] = current;
          index2gridCords[c_i] = { x: current.x, y: current.y };
          index2cord[c_i] = {
            x: this.cord2canvas(current.x, 0) + 20 + xoffset1 + 20,
            y: this.cord2canvas(current.y, 0) + yoffset1
          };
        }
        c_i += 1;
        if (current.x > 0) {
          colCandidates.push(c_i);
          index2center[c_i] = current;
          index2gridCords[c_i] = { x: current.x, y: current.y };
          index2cord[c_i] = {
            x: this.cord2canvas(current.x, 0) + 20 + xoffset2 - 20,
            y: this.cord2canvas(current.y, 0) + yoffset2
          };
        }
        c_i += 1;
        if (current.y < 9) {
          colCandidates.push(c_i);
          index2center[c_i] = current;
          index2gridCords[c_i] = { x: current.x, y: current.y };
          if (current.x < 9) xoffset1 += 20;
          index2cord[c_i] = {
            x: this.cord2canvas(current.x, 0) + xoffset1,
            y: this.cord2canvas(current.y, 0) + yoffset1 + 20
          };
        }
        c_i += 1;
        if (current.y > 0) {
          colCandidates.push(c_i);
          index2center[c_i] = current;
          index2gridCords[c_i] = { x: current.x, y: current.y };
          if (current.x < 9) xoffset2 += 20;
          index2cord[c_i] = {
            x: this.cord2canvas(current.x, 0) + xoffset2,
            y: this.cord2canvas(current.y, 0) + yoffset2 - 20
          };
        }
        c_i += 1;

        //mentains the ordering (even->top,right)
        // console.log(colCandidates);
      }
      // else {
      //   prevInc = false;
      // }

      if (candidates.length > 0) allCandidateKeys.push(candidates);
      if (colCandidates.length > 0) allCandidateKeys.push(colCandidates);
    }
    //take cartesian product
    let allCombos = this.cartesianProduct(allCandidateKeys);
    // console.log(allCombos);
    // console.log(allCandidateKeys);
    // let allCombos = cartesian([1, 2], [10, 20], [100, 200, 300]);
    let maxDist = 0;
    let minComboDist = 0;
    let maxCombo = null;
    let minDist2Arrow = null;
    //find combo with max sum of distance
    // if (allCandidateKeys.length >= 3) {
    //allCombos !== null

    if (allCandidateKeys.length >= 3) {
      for (var j = 0; j < allCombos.length; j++) {
        let combo = allCombos[j];
        let distSum = 0;
        let triSides = [];
        let minDist = null;
        let dist2ArrowsSum = 0;
        // console.log(combo.length);
        for (var c = 0; c < combo.length; c++) {
          // console.log(index2cord[combo[c]]);
          let dist;
          if (c === combo.length - 1) {
            dist = this.dist(index2cord[combo[0]], index2cord[combo[c]]);
          } else {
            dist = this.dist(index2cord[combo[c]], index2cord[combo[c + 1]]);
          }
          //find distance from circle to corrosponding arrow
          let gridCordsX = this.cord2canvas(index2gridCords[combo[c]].x, 0);
          let gridCordsY = this.cord2canvas(index2gridCords[combo[c]].y, 0);
          let dist2arrow = this.dist(index2cord[combo[c]], {
            x: gridCordsX,
            y: gridCordsY
          });
          dist2ArrowsSum += dist2arrow;
          if (j === 1) {
            // console.log(dist2arrow);
          }
          // console.log(dist2arrow);

          if (minDist === null || dist < minDist) {
            minDist = dist;
          }

          distSum += dist;
          triSides.push(dist);
        }

        let p = distSum / 2;
        let area = Math.sqrt(
          p * (p - triSides[0]) * (p - triSides[1]) * (p - triSides[2])
        );

        // if (area >= maxDist) {
        if (
          minDist > minComboDist &&
          (minDist2Arrow === null || dist2ArrowsSum - 10 < minDist2Arrow)
        ) {
          maxDist = area;
          maxCombo = combo;
          minComboDist = minDist;
          minDist2Arrow = dist2ArrowsSum;
        }
      }
      // if (minComboDist > 48) {
      //   debugger;
      // }
      // console.log(minComboDist);
      // console.log(maxDist);
      // console.log(allCandidateKeys.length);
      // maxCombo = allCombos[1];
      // console.log(maxCombo);
      // console.log(maxCo3bo);
      let color_i = 0;

      //this means we have not finished processing the trajectry yet
      if (maxCombo === null) {
        return;
      }
      // console.log(index2center[2]);
      for (var mc = 0; mc < maxCombo.length; mc++) {
        let pos = index2cord[maxCombo[mc]];
        let center = index2center[maxCombo[mc]];
        // console.log(center);
        let xoffset = 0;
        let yoffset = 0;
        let posGrid;
        let nPosGrid;
        if (mc < maxCombo.length - 1) {
          posGrid = index2gridCords[maxCombo[mc]];
          nPosGrid = index2gridCords[maxCombo[mc + 1]];
        } else {
          posGrid = index2gridCords[maxCombo[mc - 1]];
          nPosGrid = index2gridCords[maxCombo[mc]];
        }
        let xDir = nPosGrid.x - posGrid.x;
        let yDir = nPosGrid.y - posGrid.y;

        // if (color_i === 3) {
        //   return;
        // }
        ctx.setLineDash([0, 0]);
        ctx.beginPath();
        // console.log(this.fillStyle);
        ctx.arc(pos.x + xoffset, pos.y + yoffset, 13, 0, 2 * Math.PI);
        ctx.fillStyle = fillStyles[color_i];
        color_i += 1;
        // console.log(maxCombo);
        // if (mc <= 2 && color_i < 2) {
        //   if (maxCombo[mc] !== maxCombo[mc + 1]) {
        //     color_i += 1;
        //   }
        // }

        ctx.fill();
        // ctx.stroke();
        ctx.fillStyle = fillStyles[mc + 1];
        ctx.font = "20px CustomFont";
        ctx.fillStyle = "white";
        ctx.fillText(String(mc + 1), pos.x - 5, pos.y + 5);
        //handle collisions
        // if (center.inc === true) {
        //   ctx.setLineDash([0, 0]);
        //   ctx.beginPath();
        //   // console.log(this.fillStyle);
        //   ctx.arc(pos.x + xoffset, pos.y + yoffset + 30, 13, 0, 2 * Math.PI);
        //   ctx.fillStyle = fillStyles[color_i];
        //   color_i += 1;

        //   ctx.fill();
        //   // ctx.stroke();
        //   ctx.fillStyle = fillStyles[mc + 2];
        //   ctx.font = "20px CustomFont";
        //   ctx.fillStyle = "white";
        //   ctx.fillText(String(mc + 2), pos.x - 5, pos.y + 35);
        // }
      }
      // console.log(this.trajCords);
      // console.log(centers);
      // return;
      // debugger;
      window.ready2Capture = true;
      // console.log(this.trajCords);
      // if (this.almostDone) {
      //   console.log(centers);
      //   throw new Error("DONE");
      // }
      // if (this.trajCords.length === 3) {
      //   // console.log(this.trajCords);
      //   this.almostDone = true;
      // }

      // new new;
    }
    // console.log(allCombos);
  }

  draw(ctx) {
    // this.maskOutBg(ctx);
    ctx.globalAlpha = 1;

    let centers = [];
    // console.log(this.trajCords.length);
    this.nStyles = 0;
    // this.updateColors(ctx);
    let nMoreCols = 3 - this.trajCords.length;
    // this.fillStyles = ["darkgreen", "darkseagreen", "lightcoral", "indianred"];
    this.fillStyles = [
      "rgb(192, 169, 72)",
      "rgb(192, 170, 194)",
      "rgb(127, 117, 251)"
    ];

    this.styleStatus = [false, false, false, false];

    //find centers of trajectory
    for (var n = 0; n < this.trajCords.length; n++) {
      let cords = this.trajCords[n];
      // console.log(cords);
      // let cordsX = this.cord2canvas(cords.x, 20);
      // let cordsY = this.cord2canvas(cords.y, 15);
      // let drawArrow = false;
      // let inc = false;
      let a = this.actions[n];
      if (this.isIncomplete(cords, a)) {
        centers.push({ x: cords.x, y: cords.y, inc: true, a: a });
        if (n !== 0) {
          // console.log("here");
          //if cords not in blocking or ow, it must have been one way
          if (!this.inBlocking(cords) && !this.game.find_is_leaving_ow(cords)) {
            centers.push({
              x: this.trajCords[n].x,
              y: this.trajCords[n].y,
              inc: false,
              a: a
            });
            // console.log("here");
          } else {
            centers.push({
              x: this.trajCords[n - 1].x,
              y: this.trajCords[n - 1].y,
              inc: false,
              a: a
            });
          }

          // drawArrow = true;
        }
      } else {
        // console.log(a);
        // console.log(n);
        // console.log("\n");

        centers.push({ x: cords.x, y: cords.y, inc: false, a: a });
      }
    }
    let centers_copy = JSON.parse(JSON.stringify(centers));
    for (var i = 0; i < this.trajCords.length; i++) {
      // console.log(cords);
      // this.updateColors(ctx);
      let cords = this.trajCords[i];
      let cordsX = this.cord2canvas(cords.x, 20);
      let cordsY = this.cord2canvas(cords.y, 15);
      let drawArrow = false;
      let inc = false;
      let a = this.actions[i];
      let blockingCase = false;
      // console.log(a);
      // console.log(i);
      // console.log("\n");
      // console.log(this.actions.length);
      // console.log(this.isIncomplete(this.trajCords[2]));
      if (this.isIncomplete(cords, a)) {
        blockingCase = true;
        // console.log(a);
        inc = true;
        let offsetY;
        let offsetX;

        if (a === "up") {
          offsetX = 0;
          if (this.inBlocking(cords)) offsetY = 20;
          else offsetY = -20;
        } else if (a === "down") {
          // console.log("here");
          offsetX = 0;
          //idk if this is right
          if (this.inBlocking(cords)) offsetY = -20;
          else offsetY = 20;
        } else if (a === "left") {
          offsetX = -20;
          offsetY = -2;
        } else if (a === "right") {
          offsetX = 25;
          offsetY = 0;
        }

        // console.log(cords);
        if (i === 0) {
          this.updateColors(ctx, true, 1);
        } else {
          this.nStyles += 1;
          this.updateColors(ctx, true, -1);
        }

        this.drawX(ctx, cordsX + offsetX, cordsY + offsetY);

        drawArrow = true;
        for (var nCol = 0; nCol < nMoreCols; nCol++) {
          if (i === 0) {
            this.updateColors(ctx, true, 1);
          } else {
            this.nStyles += nCol + 2;
            this.updateColors(ctx, true, -(nCol + 2));
          }
          if (nCol === 1)
            this.drawX(
              ctx,
              cordsX + offsetX + -6 * (nCol + 1),
              cordsY + offsetY
            );
          else
            this.drawX(
              ctx,
              cordsX + offsetX + 12 * (nCol + 1),
              cordsY + offsetY
            );
        }
      }
      // else {
      //   if (i !== 0) {
      //     // console.log(cords);
      //     drawArrow = true;
      //   }
      // }

      let currentCords = centers[i];

      if (i > 0) {
        // console.log(centers[i]);
        // console.log(i);
        // console.log("\n");
        let x = -1;
        let n = 1;
        let prevCords = centers[i - 1];
        this.updateColors(ctx);
        if (i > 1) {
          // console.log(currentCords);
          if (prevCords.inc === true) x = -2;
          //add another negative one to prevprev if currentCords.inc === true
          this.canvasArrow(ctx, prevCords, currentCords, centers[i - 2], null);
        } else {
          //this handles the case where we have left-> up (collision) ->right
          if (currentCords.inc === true) n = 2;
          this.canvasArrow(ctx, prevCords, currentCords, null, centers[i + n]);
        }
        // console.log(cords);

        //used to stop overlapping circles because of the prev circle
        let nDirx = null;
        let nDiry = null;
        if (i + 1 < this.trajCords.length) {
          let nextCordsX = this.cord2canvas(this.trajCords[i + 1].x, 20);
          let nextCordsY = this.cord2canvas(this.trajCords[i + 1].y, 15);
          nDirx = nextCordsX - currentCords.x;
          nDiry = nextCordsY - currentCords.y;
          // console.log(nDiry);
        }
        // console.log(currentCords.x - prevCords.x);
        // console.log(currentCords.y - prevCords.y);
        // console.log("\n");
        this.drawTriangle(
          ctx,
          cordsX,
          cordsY,
          currentCords.x - prevCords.x,
          currentCords.y - prevCords.y,
          nDirx,
          nDiry
        );

        if (currentCords.inc === true) {
          centers = this.remove(centers, currentCords);
          centers_copy = this.remove(centers_copy, currentCords, true);
          this.lastInc = true; //this flag needs to be here becuase we remove the incomplete points
        } else {
          this.lastInc = false;
        }
      }
    }

    this.drawCircle(ctx, centers_copy);
    this.recolorCanvas(ctx);
  }

  pauseBrowser(millis) {
    var date = Date.now();
    var curDate = null;
    do {
      curDate = Date.now();
    } while (curDate - date < millis);
  }

  update(deltaTime) {
    // NOTE!! FOR DEBUGGING PURPOSES - DONT FORGET

    // if (this.quadI === 0) {
    //   this.cordsI = 20;
    //   this.quadI = 4;
    //   this.trajp = 0;
    //   if (!this.tookScreenShot) {
    //     // console.log(this.keys);
    //     // var screenshot = require("desktop-screenshot");
    //     // screenshot("screenshot.png", function (error, complete) {
    //     //   if (error) console.log("Screenshot failed", error);
    //     //   else console.log("Screenshot succeeded");
    //     // });
    //     //https://www.npmjs.com/package/screenshot-node
    //     // var screenshot = require("screenshot-node");
    //     // screenshot.saveScreenshot(0, 0, 100, 100, "image.png", (err) => {
    //     //   if (err) console.log(err);
    //     // });
    //   }
    //   this.tookScreenShot = true;
    // }

    if (this.i < this.trajLength + 2 && this.loadedRFunc) {
      // console.log(this.json[this.keys[7]]);
      let traj1 = this.json[this.keys[this.cordsI]][this.quadI][this.trajp];

      this.cur_name =
        String(this.keys[this.cordsI]) +
        "_" +
        String(this.quadI) +
        "_" +
        String(this.trajp);

      this.executeTraj(traj1);
      // console.log(this.cur_name);
      // console.log("\n");
    }
    // console.log(this.trajLength + 2);
    if (
      this.vehicle.isDone === true &&
      this.vehicle.updatedScore === true &&
      this.loadedRFunc
    ) {
      if (this.i < this.trajLength + 2) {
        this.i += 1;
      } else if (this.trajp === 0) {
        // console.log("updating pair..");
        this.socket.send(this.cur_name);
        this.pauseBrowser(3000);
        this.init();
        this.trajp = 1;
        this.i = 0;
        this.trajCords = [];
      } else if (
        this.quadI <= this.maxPts &&
        this.quadI < this.json[this.keys[this.cordsI]].length - 1
      ) {
        this.socket.send(this.cur_name);
        this.pauseBrowser(3000);

        this.init();
        this.quadI += 1;
        this.trajp = 0;
        this.i = 0;
      } else if (this.cordsI <= this.jsonLength - 1) {
        console.log("updating cords..");
        this.socket.send(this.cur_name);
        this.pauseBrowser(3000);

        this.init();
        this.cordsI += 1;
        this.quadI = 0;
        this.trajp = 0;
        this.i = 0;
      }
    }
  }
}
