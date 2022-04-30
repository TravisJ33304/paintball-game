// dependencies
let express = require("express");
let app = express();
let http = require("http").createServer(app);

let io = require("socket.io")(http);

let map = require("./map.js").map;
// global variables
const TPS = 500; // game ticks/second
const PORT = 8080; // game server port
// track game objects
let players = [];
let paintballs = [];
// spawn positions
let spawnPoints = [{
  x: 480,
  y: 1296
}, {
  x: 480,
  y: 0
}];
// serve files to client
app.use("/client", express.static(__dirname + "/client"));
app.get("/", function (req, res) {
  res.sendFile(__dirname + "/client/index.html");
});
// object classes
function Player(socket) {
  // determine players team
  var side = players.length % 2;
  var team = side ? "red" : "blue";
  // create object
  return {
    id: socket.id,
    team: team,
    spawn: spawnPoints[side],
    x: spawnPoints[side].x,
    y: spawnPoints[side].y,
    w: 48,
    h: 48,
    c: team,
    loaded: true,
    health: 100,
    vx: 0,
    vy: 0,
    input: {
      mouse: {
        x: 0,
        y: 0,
        down: false
      },
      keys: [],
      cVars: {
        godMode: false,
        invisible: false,
        smallPlayer: false,
        superSpeed: false
      }
    },
    update: function() {
      var self = this; // scoping purposes
      // console cheats
      if (this.input.cVars.invisible)
        this.c = "rgba(0, 0, 0, 0)";
      else
        this.c = this.team;
      if (this.input.cVars.smallPlayer) {
        this.w = 16;
        this.h = 16;
      } else {
        this.w = 48;
        this.h = 48;
      }
      // input
      // calculate max accelleration
      let max = 1;
      if (this.input.cVars.superSpeed)
        max = 20;
      else if (this.input.keys.includes("Shift"))
        max = 2;
      // add accelleration
      if ((this.input.keys.includes("w") || this.input.keys.includes("W") || this.input.keys.includes("ArrowUp")) && this.vx > -max)
        this.vy -= 0.2;
      if ((this.input.keys.includes("a") || this.input.keys.includes("A") || this.input.keys.includes("ArrowLeft")) && this.vx > -max)
        this.vx -= 0.2;
      if ((this.input.keys.includes("s") || this.input.keys.includes("S") || this.input.keys.includes("ArrowDown")) && this.vx < max)
        this.vy += 0.2;
      if ((this.input.keys.includes("d") || this.input.keys.includes("D") || this.input.keys.includes("ArrowRight")) && this.vx < max)
        this.vx += 0.2;
      // friction
      this.vx *= 0.6;
      this.vy *= 0.6;
      // map collsions
      for (let layer of map) {
        for (let tile of layer) {
          if (tile.c === "rgb(0, 150, 25)") // background tile
            continue;
          let dir = edgeCollision(self, tile); // collision check on the player/tile
          if (dir === "h") // horizontal collision
            this.vx = 0;
          if (dir === "v") // vertical collision
            this.vy = 0;
        }
      }
      // map boundaries
      if (this.x + this.vx <= 0 || this.x + this.w + this.vx >= 1056)
        this.vx = 0;
      if (this.y + this.vy <= 0 || this.y + this.h + this.vy >= 1344)
        this.vy = 0;
      // move after collision and input checks
      this.x += this.vx;
      this.y += this.vy;
      // player shoots paintball
      if (this.input.mouse.down && this.loaded) {
        let paintball = Paintball(self); // instantiate new object
        paintballs.push(paintball); // add object to paintballs

        setTimeout(function (paintball) { // paintball decay/range
          let i = paintballs.indexOf(paintball); // find paintball object
          if (i !== -1) // check if object still exists
            paintballs.splice(i, 1); // remove paintball
        }, 5000, paintball);
        // cooldown
        this.loaded = false;
        setTimeout(function (player) { // timer to end cooldown
          player.loaded = true;
        }, 500, self);
      }
    }
  };
}
function Paintball(parent) {
  // calculate paintball trajectory
  var cx = parent.x + parent.w / 2;
  var cy = parent.y + parent.h / 2;
  var angle = Math.atan2(parent.input.mouse.y - cy, parent.input.mouse.x - cx);

  return {
    id: Math.random(),
    parent: parent,
    x: cx,
    y: cy,
    r: 5,
    w: 5,
    h: 5,
    vx: Math.cos(angle),
    vy: Math.sin(angle),
    dir: angle,
    c: parent.c,
    update: function () {
      var self = this; // scoping purposes
      // movement
      this.x += this.vx;
      this.y += this.vy;
      // player collision detection
      for (let player of players) {
        if (!rectCollision(self, player) || player === self.parent) // no collision or collision with parent
          continue;
        if (!player.cVars.godMode) // take damage unless cheat enabled
          player.health -= 25;
        if (player.health <= 0) { // player respawns
          respawn(player);
          console.log("Player respawned: " + player.name);
        }
        paintballs.splice(paintballs.indexOf(self), 1); // remove paintball on collision
      }
      // map collision detection
      for (let layer of map) {
        for (let tile of layer) {
          if (tile.c === "rgb(0, 150, 25)") // background tile
            continue;
          let i = paintballs.indexOf(self);
          if (tileCollision(self, tile) && i !== -1) // delete the paintball after collision
            paintballs.splice(i, 1);
        }
      }
    }
  };
}
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
function edgeCollision(obj1, obj2) { // adjust movement along tile edges
  let vx = obj1.x + obj1.w / 2 - (obj2.x + 48 / 2);
  let vy = obj1.y + obj1.h / 2 - (obj2.y + 48 / 2);
  let hws = obj1.w / 2 + 48 / 2;
  let hhs = obj1.h / 2 + 48 / 2;
  let res = null;
  if (Math.abs(vx) < hws && Math.abs(vy) < hhs) { // collision detected
    let oX = hws - Math.abs(vx);
    let oY = hhs - Math.abs(vy);
    if (oX >= oY) { // vertical collision
      if (vy > 0) { // collision upwards
        res = "v";
        obj1.y += oY;
      } else { // collsion downwards
        res = "v";
        obj1.y -= oY;
      }
    } else { // horizontal collision
      if (vx > 0) { // collsion left
        res = "h";
        obj1.x += oX;
      } else { // collsion right
        res = "h";
        obj1.x -= oX;
      }
    }
  }
  return res;
}
function respawn(player) { // respawn a player object
  player = {
    ...player,
    x: this.spawn.x,
    y: this.spawn.y,
    vx: 0,
    vy: 0,
    health: 100,
    loaded: true,
  };
}
// player connects
io.on("connection", function (socket) {
  console.log("A user connected; id: " + socket.id);
  
  let player = Player(socket); // create player object
  socket.player = player; // reference player to client
  players.push(socket.player); // add player to data

  socket.on("username", function (data) { // client submits username
    // player chooses username
    console.log("Username chosen: " + data);
    socket.player.name = data;

    data = { // initial client data
      map: map,
      player: socket.player,
      players: players,
      paintballs: paintballs,
      map: map
    };
    socket.emit("init", data); // send initial data to client
  });

  socket.on("clientUpdate", function (data) { // player pings server
    socket.player.input = data; // collect new input data

    data = { // update data
      map: map,
      player: socket.player,
      players: players,
      paintballs: paintballs,
      map: map
    };

    socket.emit("serverUpdate", data); // send new data to client
  });

  socket.on("disconnect", function () { // client disconnected
    console.log("User disconnected: " + socket.id);
    players.splice(players.indexOf(socket.player), 1); // remove player data
  });
});
// start server
http.listen(PORT, function () {
  console.log("Listening on port: " + PORT);
});
// run game update loop
setInterval(function () {
  // update players
  for (let player of players)
    player.update();
  // update paintballs
  for (let paintball of paintballs)
    paintball.update();
}, 1000 / TPS);