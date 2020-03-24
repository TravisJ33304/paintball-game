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
// object variables
let player, players, bullets;
// console cheats
var cVars = {
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
  bullets = data.bullets;

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
  bullets = data.bullets;

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

      for (var layer of map) {
        // draw map
        for (var tile of layer) {
          ctx.fillStyle = tile.c;
          ctx.fillRect(tile.x + translationX, tile.y + translationY, 48, 48);
        }
      }

      for (var i in players) {
        // draw players
        if (players[i].id === player.id || players[i].user === undefined) continue;
        //draw player
        ctx.fillStyle = players[i].c;
        ctx.fillRect(
          players[i].x + translationX,
          players[i].y + translationY,
          players[i].w,
          players[i].h
        );
        // health bar
        ctx.fillStyle = "rgb(255, 0, 0)";
        ctx.fillRect(
          players[i].x + translationX,
          players[i].y + translationY - 25,
          players[i].health / 2,
          15
        );
        ctx.strokeRect(
          players[i].x + translationX,
          players[i].y + translationY - 25,
          50,
          15
        );
        // draw username
        ctx.fillText(
          players[i].user,
          players[i].x + translationX,
          players[i].y + translationY - 50
        );
      }
      // draw player
      ctx.fillStyle = player.c;
      ctx.fillRect(player.tx, player.ty, player.w, player.h);
      // draw healthbar on HUD
      ctx.fillStyle = "rgb(255, 0, 0)";
      ctx.fillRect(25, window.innerHeight - 50, player.health, 25);
      ctx.strokeRect(25, window.innerHeight - 50, 100, 25);

      for (var obj of bullets) {
        // draw bullets
        let tx = obj.x + translationX;
        let ty = obj.y + translationY;
        // rotate canvas
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(obj.dir);
        ctx.translate(-tx, -ty);
        // draw bullet
        ctx.fillStyle = obj.c;
        ctx.fillRect(tx, ty, obj.w, obj.h);
        // revert canvas rotation
        ctx.restore();
      }
    });
  }, 1000/FPS);
}