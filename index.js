// dependencies
var express = require("express");
var app = express();
var http = require("http").createServer(app);

var io = require("socket.io")(http);

var map = require("./client/map.js").map;
// global variables
var players = {};
var spawnPoints = [{ x: 480, y: 1296 }, { x: 480, y: 0 }];

var bullets = [];
// serve files
app.use("/client", express.static(__dirname + "/client"));

app.get("/", function(req, res) {
  res.sendFile(__dirname + "/client/index.html");
});
// utility functions
function rectCollision(obj1, obj2) {
  return (
    obj1.x < obj2.x + obj2.w &&
    obj1.x + obj1.w > obj2.x &&
    obj1.y < obj2.y + obj2.h &&
    obj1.y + obj1.h > obj2.y
  );
}

function tileCollision(obj1, obj2) {
  return (
    obj1.x < obj2.x + 48 &&
    obj1.x + obj1.w > obj2.x &&
    obj1.y < obj2.y + 48 &&
    obj1.y + obj1.h > obj2.y
  );
}

function edgeCollision(obj1, obj2) {
  var velX = obj1.x + obj1.w / 2 - (obj2.x + 48 / 2);
  var velY = obj1.y + obj1.h / 2 - (obj2.y + 48 / 2);
  var hws = obj1.w / 2 + 48 / 2;
  var hhs = obj1.h / 2 + 48 / 2;
  var colDir = null;
  if (Math.abs(velX) < hws && Math.abs(velY) < hhs) {
    var oX = hws - Math.abs(velX);
    var oY = hhs - Math.abs(velY);
    if (oX >= oY) {
      if (velY > 0) {
        colDir = "t";
        obj1.y += oY;
      } else {
        colDir = "b";
        obj1.y -= oY;
      }
    } else {
      if (velX > 0) {
        colDir = "l";
        obj1.x += oX;
      } else {
        colDir = "r";
        obj1.x -= oX;
      }
    }
  }
  return colDir;
}

function respawn(id) {
  players[id].x = players[id].spawn.x;
  players[id].y = players[id].spawn.y;
  players[id].health = 100;
  players[id].loaded = true;
}
// player connects
io.on("connection", function(socket) {
  console.log("an user connected; id: " + socket.id);

  var r = Math.round(Math.random());

  socket.player = {
    id: socket.id,
    x: spawnPoints[r].x,
    y: spawnPoints[r].y,
    spawn: spawnPoints[r],
    w: 48,
    h: 48,
    c:
      "rgb(" +
      Math.random() * 255 +
      "," +
      Math.random() * 255 +
      "," +
      Math.random() * 255 +
      ")",
    loaded: true,
    health: 100,
    vx: 0,
    vy: 0,
    cVars: {
      godMode: false,
      invisible: false,
      smallPlayer: false,
      superSpeed: false
    }
  };
  socket.player.oc = socket.player.c;

  players[String(socket.id)] = socket.player;

  var data = {
    map: map,
    player: socket.player,
    players: players,
    bullets: bullets
  };

  setInterval(function() {
    // update bullets
    for (var obj of bullets) {
      obj.update();
    }
  }, 1000 / 45);

  socket.on("username", function(data) {
    // player chooses username
    console.log("username chosen: " + data);
    socket.player.user = data;
  });

  socket.emit("init", data);

  socket.on("clientUpdate", function(data) {
    // player pings server
    if (data.keys.length !== 0) console.log(data.keys);
    // cheats
    socket.player.cVars = data.cVars;
    if (socket.player.cVars.invisible) socket.player.c = "rgba(0, 0, 0, 0)";
    else socket.player.c = socket.player.oc;
    if (socket.player.cVars.smallPlayer) {
      socket.player.w = 16;
      socket.player.h = 16;
    } else {
      socket.player.w = 48;
      socket.player.h = 48;
    }
    // input
    var max = 4;
    if (socket.player.cVars.superSpeed) {
      max = 20;
    } else if (data.keys.includes("Shift")) {
      max = 6;
    }
    if (
      (data.keys.includes("w") ||
        data.keys.includes("W") ||
        data.keys.includes("ArrowUp")) &&
      socket.player.vx > -max
    )
      socket.player.vy -= 2;
    if (
      (data.keys.includes("a") ||
        data.keys.includes("A") ||
        data.keys.includes("ArrowLeft")) &&
      socket.player.vx > -max
    )
      socket.player.vx -= 2;
    if (
      (data.keys.includes("s") ||
        data.keys.includes("S") ||
        data.keys.includes("ArrowDown")) &&
      socket.player.vx < max
    )
      socket.player.vy += 2;
    if (
      (data.keys.includes("d") ||
        data.keys.includes("D") ||
        data.keys.includes("ArrowRight")) &&
      socket.player.vx < max
    )
      socket.player.vx += 2;
    // friction
    socket.player.vx *= 0.6;
    socket.player.vy *= 0.6;

    for (var layer of map) {
      // map collisions
      for (var tile of layer) {
        if (tile.c === "rgb(0, 150, 25)") continue;
        var dir = edgeCollision(socket.player, tile);
        if (dir === "l" || dir === "r") socket.player.vx = 0;
        if (dir === "t" || dir === "b") socket.player.vy = 0;
      }
    }
    if (
      socket.player.x + socket.player.vx <= 0 ||
      socket.player.x + socket.player.w + socket.player.vx >= 1056
    )
      socket.player.vx = 0;
    if (
      socket.player.y + socket.player.vy <= 0 ||
      socket.player.y + socket.player.h + socket.player.vy >= 1344
    )
      socket.player.vy = 0;

    socket.player.x += socket.player.vx;
    socket.player.y += socket.player.vy;

    if (data.mouse.down && socket.player.loaded) {
      // player shoots
      var cx = socket.player.x + socket.player.w / 2;
      var cy = socket.player.y + socket.player.h / 2;

      var angle = Math.atan2(data.mouse.y - cy, data.mouse.x - cx);

      var id;
      bullets.length > 0 ? (id = bullets.length - 1) : (id = 0);

      var b = bullets.push({
        ply: socket.player,
        id: id,
        x: cx,
        y: cy,
        w: 15,
        h: 10,
        vx: Math.cos(angle) * 8,
        vy: Math.sin(angle) * 8,
        dir: angle,
        c: "rgb(75, 75, 75)",
        update: function() {
          var t = this; // for use in function scope

          this.x += this.vx;
          this.y += this.vy;

          for (var i in players) {
            // player hit detection
            if (players[i] === undefined || players[i].user === undefined)
              continue;
            if (!rectCollision(t, players[i]) || players[i] === t.ply) continue;
            if (!socket.player.cVars.godMode) players[i].health -= 25;
            if (players[i].health <= 0) {
              respawn(i);
              console.log("Player died: " + players[i].user);
            }
            bullets.splice(bullets.indexOf(t), 1);
          }

          for (var layer of map) {
            // map collisions
            for (var tile of layer) {
              if (tile.c === "rgb(0, 150, 25)") continue;
              if (tileCollision(t, tile)) bullets.splice(bullets.indexOf(t));
            }
          }
        }
      });

      socket.player.loaded = false;

      setTimeout(function() {
        // bullet decay
        if (bullets[b - 1] !== undefined) {
          if (bullets[b - 1].id === b - 1) {
            bullets.splice(bullets[b - 1]);
          }
        }
      }, 5000);

      setTimeout(function() {
        // shooting cooldown
        socket.player.loaded = true;
      }, 500);
    }

    players[String(socket.id)] = socket.player;

    data = {
      map: map,
      player: socket.player,
      players: players,
      bullets: bullets
    };

    socket.emit("serverUpdate", data);
  });

  socket.on("disconnect", function() {
    // player disconnected
    players[String(socket.id)] = undefined;
    console.log("user disconnected");
  });
});
// start server
http.listen(8080, function() {
  console.log("listening");
});
