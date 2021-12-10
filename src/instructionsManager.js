import Game from "/src/game";
import Vehicle from "/src/vehicle";

export default class InstructionManager {
  constructor() {
    this.finishedIns = false;
    this.insScene = 1;
    this.finishedGamePlay = false;
    this.animationGame = new Game(
      600,
      600,
      { x: 0, y: 3 },
      "anim_examp",
      false
    );
    this.animationGame.start(false, true);
    this.w = 750;
    this.h = 450;
    this.x = -75;
    this.y = 50;
  }

  // createButton(canvas, ctx) {}

  update() {
    if (this.insScene === 7 && !this.finishedGamePlay) this.finishedIns = true;
    if (this.insScene === 10 && !this.finishedGamePlay) this.finishedIns = true;

    this.img = document.getElementById("ins" + String(this.insScene));
    // console.log("here");
  }
  playAnimation(ctx) {
    this.animationGame.update();
    this.animationGame.draw(ctx);
  }
  draw(ctx) {
    if (this.insScene === 7 && !this.finishedGamePlay) return;
    if (this.insScene === 10) return;
    if (this.insScene === 4) {
      this.playAnimation(ctx);
      this.h = 200;
      this.w = 700;
      this.x = -40;
      this.y = -10;
    } else {
      this.w = 750;
      this.h = 450;
      this.x = -75;
      this.y = 50;
    }

    ctx.drawImage(this.img, this.x, this.y, this.w, this.h);
    //draw button
    // ctx.fillStyle = "white";
    // ctx.beginPath();
    // ctx.rect(500, 550, 100, 50);

    ctx.font = "25px CustomFont";

    ctx.fillStyle = "gray";

    // console.log("here");
    if (this.insScene === 6) ctx.fillText("Play", 500, 570);
    else if (this.insScene === 9) ctx.fillText("Begin", 500, 570);
    else ctx.fillText("Next", 500, 570);
    ctx.fill();
  }
}
