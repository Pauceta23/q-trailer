const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// rooms[id] = { host, players: { socketId: { name, score } }, activeQuestion }
const rooms = {};

app.use(express.static(__dirname));
app.get('/',       (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/webrtc', (req, res) => res.sendFile(path.join(__dirname, 'webrtc.html')));

io.on('connection', (socket) => {

  socket.on('join', ({ room, name }) => {
    if (!room || !name) return;
    if (!rooms[room]) rooms[room] = { host: socket.id, players: {}, activeQuestion: null };
    const r = rooms[room];
    r.players[socket.id] = { name, score: 0 };
    socket.join(room);
    socket.data.room = room;
    io.to(room).emit('player-list', buildPlayerList(r));
    socket.emit('joined', { isHost: r.host === socket.id, room });
  });

  // Host broadcasts video time/state → relay to everyone else
  socket.on('video-sync', ({ currentTime, paused }) => {
    const room = socket.data.room;
    if (!room || !rooms[room]) return;
    if (rooms[room].host !== socket.id) return;
    socket.to(room).emit('video-sync', { currentTime, paused });
  });

  // Host reaches a question timestamp → broadcast to ALL (host included)
  socket.on('trigger-question', ({ question, options, correctIndex, funFact, movie }) => {
    const room = socket.data.room;
    if (!room || !rooms[room]) return;
    const r = rooms[room];
    if (r.host !== socket.id) return;
    if (r.activeQuestion) return; // already active

    r.activeQuestion = { correctIndex, funFact, answered: {}, startTime: Date.now() };
    // io.to → ALL clients in room (including host)
    io.to(room).emit('question', { question, options, movie });
    r.activeQuestion.timer = setTimeout(() => closeQuestion(room), 20000);
  });

  // Any player (including host) submits an answer
  socket.on('answer', ({ optionIndex }) => {
    const room = socket.data.room;
    if (!room || !rooms[room]) return;
    const r = rooms[room];
    if (!r.activeQuestion) return;
    if (r.activeQuestion.answered[socket.id] !== undefined) return;

    const aq = r.activeQuestion;
    const correct = optionIndex === aq.correctIndex;
    const elapsed = Date.now() - aq.startTime;
    let points = 0;
    if (correct) {
      points = 100 + Math.max(0, Math.round(50 * (1 - elapsed / 5000)));
      r.players[socket.id].score += points;
    }
    aq.answered[socket.id] = { correct, points };
    socket.emit('answer-result', { correct, points, correctIndex: aq.correctIndex });
    io.to(room).emit('score-update', buildPlayerList(r));

    // Close early if everyone answered
    const allIds = Object.keys(r.players);
    if (allIds.every(id => aq.answered[id] !== undefined)) {
      clearTimeout(aq.timer);
      closeQuestion(room);
    }
  });

  // Host ends the quiz manually
  socket.on('end-quiz', () => {
    const room = socket.data.room;
    if (!room || !rooms[room]) return;
    if (rooms[room].host !== socket.id) return;
    io.to(room).emit('quiz-end', { scores: buildPlayerList(rooms[room]) });
  });

  socket.on('disconnect', () => {
    const room = socket.data.room;
    if (!room || !rooms[room]) return;
    const r = rooms[room];
    delete r.players[socket.id];
    if (Object.keys(r.players).length === 0) {
      if (r.activeQuestion?.timer) clearTimeout(r.activeQuestion.timer);
      delete rooms[room];
      return;
    }
    if (r.host === socket.id) {
      r.host = Object.keys(r.players)[0];
      io.to(room).emit('new-host', r.host);
    }
    io.to(room).emit('player-list', buildPlayerList(r));
  });
});

function buildPlayerList(r) {
  return Object.entries(r.players)
    .map(([id, p]) => ({ id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

function closeQuestion(room) {
  const r = rooms[room];
  if (!r?.activeQuestion) return;
  io.to(room).emit('question-end', {
    funFact: r.activeQuestion.funFact,
    correctIndex: r.activeQuestion.correctIndex,
    scores: buildPlayerList(r),
  });
  r.activeQuestion = null;
}

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
