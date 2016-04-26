var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var io = require('socket.io')();

var routes = require('./routes/index');

var app = express();
app.io = io;
var rooms = {};

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// http routes
app.use('/', routes);
app.get('/:room_id', function(req, res, next) {
  console.log('Room Id: ' + req.params.room_id);
  console.log(rooms[req.params.room_id]);

  if (rooms[req.params.room_id] == undefined) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
    return;
  }
  res.render('index', { title: 'Tic Tac Toe', player_id: 1, room_id: req.params.room_id });
});

// websockets handler
io.sockets.on('connection', function(socket) {
  console.log('Client connected...');

  socket.on('create', function() {
    console.log('Room is created...');

    var room_id = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 8; i++) {
      room_id += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    socket.room_id = room_id;
    socket.player_id = 0;
    socket.isAdmin = true;
    socket.join(room_id);

    rooms[room_id] = {
      current_player: 0,
      board: ['', '', '', '', '', '', '', '', ''],
      game_over: false
    };

    socket.emit('start_room', { player_id: socket.player_id, room_id: room_id });
  });

  socket.on('join', function(room_id) {
    // var room = io.nsps['/'].adapter.rooms[room_id];
    var room = rooms[room_id];
    if (!room) {
      socket.emit('close_room');
      return;
    }
    var players_count = io.sockets.adapter.rooms[room_id];
    console.log(players_count.length);
    if (players_count.length >= 2) {
      socket.emit('close_room', 'This room is full.');
      return;
    }
    socket.room_id = room_id;
    socket.player_id = 1;
    socket.join(room_id);
    console.log(room);
    socket.broadcast.to(room_id).emit('start_game', { game: room });
    socket.emit('start_room', { player_id: socket.player_id, room_id: room_id, game: room });
    console.log('Player 2 joined...');
  });

  socket.on('change_state', function(cell_id) {
    if (!socket.room_id) {
      return; // not joined at all
    }
    var room = rooms[socket.room_id];
    if (!room) { // not found, room no longer available
      socket.emit('close_room');
      return;
    }
    if (room.current_player != socket.player_id) {
      socket.emit('change_state', { err: 'It is not your turn' });
      return; // trying to hack
    }
    console.log(room.board);
    console.log(cell_id - 1);
    if (room.board[cell_id - 1] != '') {
      socket.emit('change_state', { err: 'Cell already taken' });
      return; // already taken, trying to hack
    }
    room.board[cell_id - 1] = socket.player_id == 0 ? 'X' : 'O';
    room.current_player = 1 - room.current_player;


    var winner = checkWin(room.board);
    console.log('winner...' + winner);
    if (winner == 'X' || winner == 'O' || winner == 'T') {
      io.sockets.in(socket.room_id).emit('win_game', { game: room, player_win: winner == 'T' ? 2 : (winner == 'X' ? 0 : 1) });
    } else {
      io.sockets.in(socket.room_id).emit('change_state', { game: room });
    }
  });

  socket.on('restart_game', function() {
    rooms[socket.room_id] = {
      current_player: Math.random() < 0.5 ? 0 : 1, // randomize
      board: ['', '', '', '', '', '', '', '', ''],
      game_over: false
    };

    var room = io.sockets.adapter.rooms[socket.room_id];
    if (!room) {
      return; // nothing happens here
    }
    console.log("room..." + Object.keys(room));
    io.sockets.in(socket.room_id).emit('restart_game', { game: rooms[socket.room_id], wait: Object.keys(room).length < 2 });
  });

  socket.on('disconnect', function() {
    if (!socket.room_id) {
      return; // not joined at all
    }
    console.log('Client disconnected...');
    if (socket.isAdmin) {
      socket.broadcast.to(socket.room_id).emit('close_room');
      socket.leave(socket.room_id);
      delete rooms[socket.room_id];
    } else { // not admin
      var room = rooms[socket.room_id];
      if (room) {
        room.game_over = true;
      }
      socket.broadcast.to(socket.room_id).emit('left_room'); // broadcast to the other guy
      socket.leave(socket.room_id);
    }
  });
});

function checkWin(board) {
  var pairs = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [1, 4, 7], [2, 5, 8], [3, 6, 9], [1, 5, 9], [3, 5, 7]];
  var win = '';
  pairs.forEach(function(element) {
    if (checkEquals(board[element[0] - 1], board[element[1] - 1], board[element[2] - 1])) {
      console.log(element);
      win = board[element[0] - 1]; // I have no idea how to break
    }
  });
  var filled = true;
  board.forEach(function(element) {
    if (element == '') {
      filled = false;
    }
  });

  return filled ? 'T' : win;
}

function checkEquals(a, b, c) {
  if (a == '' || b == '' || c == '') {
    return false;
  }
  return a == b && b == c && a == c;
}

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
