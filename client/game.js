// canvas
let canvas, ctx;
// Set the time between each frame
const FPS = 60;
// connect to server
let socket = io();
// input variables
let keys = [];

let mouse = {
  x: 0,
  y: 0,
  down: false
};
// screen variables
let centerX = 0;
let centerY = 0;

let translationX = 0;
let translationY = 0;
// game data
let player, players, paintballs, map;
// console cheats
let cVars = {
  godMode: false,
  invisible: false,
  smallPlayer: false,
  superSpeed: false
};

function resize() {
  // resize the window
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  centerX = Math.floor(canvas.width / 2);
  centerY = Math.floor(canvas.height / 2);
}

function username() {
  // user selected username
  document.getElementById("username_div").style.display = "none";
  document.getElementById("title").style.display = "none";
  canvas.style.display = "block";
  socket.emit("username", document.getElementById("username").value);
}
// keyboard input events
document.onkeydown = function(e) {
  keys.push(e.key);
};

document.onkeyup = function(e) {
  while (keys.includes(e.key)) {
    keys.splice(keys.indexOf(e.key), 1);
  }
  while (keys.includes(e.key.toUpperCase())) {
    keys.splice(keys.indexOf(e.key.toUpperCase()), 1);
  }
  while (keys.includes(e.key.toLowerCase())) {
    keys.splice(keys.indexOf(e.key.toLowerCase()), 1);
  }
};

socket.on("init", function(data) {
  // initialize data
  player = data.player;
  players = data.players;
  paintballs = data.paintballs;
  map = data.map;

  translationX = centerX - player.x;
  translationY = centerY - player.y;

  player.tx = player.x + translationX;
  player.ty = player.y + translationY;

  render();

  data = {
    // send input variables
    mouse: mouse,
    keys: keys,
    // send console cheats
    cVars: cVars
  };

  socket.emit("clientUpdate", data);
});

socket.on("serverUpdate", function(data) {
  // recieve data from server

  player = data.player;
  players = data.players;
  paintballs = data.paintballs;
  map = data.map;

  translationX = centerX - player.x;
  translationY = centerY - player.y;

  player.tx = player.x + translationX;
  player.ty = player.y + translationY;

  data = {
    // send input variables
    mouse: mouse,
    keys: keys,
    // send console cheats
    cVars: cVars
  };

  socket.emit("clientUpdate", data);
});

window.onload = function() {
  // get canvas and context
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  // general canvas font
  ctx.font = "24px verdana";
  // size window
  resize();
  // canvas input events
  canvas.onmousedown = function() {
    mouse.down = true;
  };

  canvas.onmouseup = function() {
    mouse.down = false;
  };

  canvas.onmouseenter = function(e) {
    mouse.x = e.clientX - canvas.offsetLeft - translationX;
    mouse.y = e.clientY - canvas.offsetTop - translationY;
  };

  canvas.onmousemove = function(e) {
    mouse.x = e.clientX - canvas.offsetLeft - translationX;
    mouse.y = e.clientY - canvas.offsetTop - translationY;
  };

  canvas.onmouseover = function(e) {
    mouse.x = e.clientX - canvas.offsetLeft - translationX;
    mouse.y = e.clientY - canvas.offsetTop - translationY;
  };

  canvas.oncontextmenu = function(e) {
    e.preventDefault();
  };
};

function render() {
  window.setInterval(function() {
    window.requestAnimationFrame(function() {
      // clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let layer of map) { // draw map
        for (let tile of layer) {
          ctx.fillStyle = tile.c;
          ctx.fillRect(tile.x + translationX, tile.y + translationY, 48, 48);
        }
      }

      for (let obj of players) {
        // draw players
        if (obj.id === player.id || player.name === undefined)
          continue;
        //draw player
        ctx.fillStyle = obj.c;
        ctx.fillRect(obj.x + translationX, obj.y + translationY, obj.w, obj.h);
        // health bar
        ctx.fillStyle = "rgb(255, 0, 0)";
        ctx.fillRect(obj.x + translationX, obj.y + translationY - 25, obj.health / 2, 15);
        ctx.strokeRect(obj.x + translationX, obj.y + translationY - 25, 50, 15);
        // draw username
        ctx.fillText(obj.name, obj.x + translationX, obj.y + translationY - 50);
      }
      // draw player
      ctx.fillStyle = player.c;
      ctx.fillRect(player.tx, player.ty, player.w, player.h);
      // draw healthbar on HUD
      ctx.fillStyle = "rgb(255, 0, 0)";
      ctx.fillRect(25, window.innerHeight - 50, player.health, 25);
      ctx.strokeRect(25, window.innerHeight - 50, 100, 25);
      for (let paintball of paintballs) { // draw paintballs
        // calculate relative position
        let tx = paintball.x + translationX;
        let ty = paintball.y + translationY;
        // draw paintball
        ctx.fillStyle = paintball.c;
        ctx.beginPath();
        ctx.arc(tx, ty, paintball.r, 0, 2 * Math.PI);
        ctx.fill();
        ctx.closePath();
      }
    });
  }, 1000/FPS);
}