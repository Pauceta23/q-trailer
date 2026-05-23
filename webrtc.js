const socket = io();

// ── State ─────────────────────────────────────────────────────────────────────
let myId = null;
let isHost = false;
let currentRoom = null;
let quizQuestions = [];
const triggeredTimes = new Set();
let questionActive = false;
let answered = false;
let countdownTimer = null;
let syncInterval = null;

// ── DOM ───────────────────────────────────────────────────────────────────────
const screenJoin = document.getElementById('screen-join');
const screenGame = document.getElementById('screen-game');
const screenEnd  = document.getElementById('screen-end');

const inputName  = document.getElementById('input-name');
const inputRoom  = document.getElementById('input-room');
const btnJoin    = document.getElementById('btn-join');
const joinError  = document.getElementById('join-error');

const gameRoomCode = document.getElementById('game-room-code');
const badgeHost    = document.getElementById('badge-host');
const btnEndQuiz   = document.getElementById('btn-end-quiz');
const scoreboard    = document.getElementById('scoreboard');
const funfactsPanel = document.getElementById('funfacts-panel');
const funfactsList  = document.getElementById('funfacts-list');
const video         = document.getElementById('game-video');
const gameControls  = document.getElementById('game-controls');
const gameContainer = document.getElementById('game-player-container');
const gamePlayBtn   = document.getElementById('game-play-btn');
const gameTimeDisp  = document.getElementById('game-time-display');
const gameProgressBar  = document.getElementById('game-progress-bar');
const gameProgressFill = document.getElementById('game-progress-fill');
const gameProgressBuf  = document.getElementById('game-progress-buffer');
const gameFsBtn     = document.getElementById('game-fs-btn');

const overlay         = document.getElementById('question-overlay');
const overlayMovie    = document.getElementById('overlay-movie');
const overlayQuestion = document.getElementById('overlay-question');
const overlayCountdown = document.getElementById('overlay-countdown');
const overlayOptions  = document.getElementById('overlay-options');
const overlayFeedback = document.getElementById('overlay-feedback');

const endPodium    = document.getElementById('end-podium');
const endScores    = document.getElementById('end-scores');
const btnPlayAgain = document.getElementById('btn-play-again');

// ── Screens ───────────────────────────────────────────────────────────────────
function showScreen(name) {
  screenJoin.style.display = name === 'join' ? '' : 'none';
  screenGame.style.display = name === 'game' ? '' : 'none';
  screenEnd.style.display  = name === 'end'  ? '' : 'none';
}

// ── Join ──────────────────────────────────────────────────────────────────────
btnJoin.addEventListener('click', () => {
  const name = inputName.value.trim();
  const room = inputRoom.value.trim().toUpperCase();
  if (!name || !room) {
    joinError.textContent = 'Introduce tu nombre y el código de sala.';
    joinError.style.display = 'block';
    return;
  }
  joinError.style.display = 'none';
  socket.emit('join', { room, name });
});
inputRoom.addEventListener('keydown', e => { if (e.key === 'Enter') btnJoin.click(); });

// ── Socket: join & players ────────────────────────────────────────────────────
socket.on('joined', ({ isHost: host, room }) => {
  isHost = host;
  myId = socket.id;
  currentRoom = room;
  gameRoomCode.textContent = room;

  if (isHost) {
    badgeHost.style.display = 'inline-block';
    btnEndQuiz.style.display = 'inline-block';
    enableControls();
  } else {
    disableControls();
  }

  showScreen('game');
  initPlayer();
  if (isHost) loadQuizQuestions();
});

socket.on('player-list', (players) => {
  renderScoreboard(players);
});

socket.on('new-host', (hostId) => {
  if (hostId === socket.id) {
    isHost = true;
    badgeHost.style.display = 'inline-block';
    btnEndQuiz.style.display = 'inline-block';
    enableControls();
    loadQuizQuestions();
    startSyncInterval();
  }
});

// ── Socket: video sync ────────────────────────────────────────────────────────
socket.on('video-sync', ({ currentTime, paused }) => {
  if (isHost) return; // host is the source, never applies sync to itself
  if (Math.abs(video.currentTime - currentTime) > 2) {
    video.currentTime = currentTime;
  }
  if (paused && !video.paused) {
    video.pause();
  } else if (!paused && video.paused && !questionActive) {
    video.play().catch(() => {});
  }
});

// ── Socket: question ──────────────────────────────────────────────────────────
socket.on('question', ({ question, options, movie }) => {
  questionActive = true;
  answered = false;
  video.pause();
  showOverlay(question, options, movie);
  startCountdown(20);
});

socket.on('answer-result', ({ correct, points, correctIndex }) => {
  stopCountdown();
  markOptions(correctIndex);
  showFeedback(correct, points);
});

socket.on('question-end', ({ funFact, correctIndex, scores }) => {
  stopCountdown();
  markOptions(correctIndex);
  renderScoreboard(scores);
  setTimeout(() => {
    hideOverlay();
    questionActive = false;
    if (!video.paused) return;
    video.play().catch(() => {});
    if (funFact) showFunFact(funFact);
  }, 2500);
});

socket.on('score-update', (players) => {
  renderScoreboard(players);
});

socket.on('quiz-end', ({ scores }) => {
  stopCountdown();
  hideOverlay();
  renderPodium(scores);
  renderFinalScores(scores);
  showScreen('end');
});

// ── Host: end quiz ────────────────────────────────────────────────────────────
btnEndQuiz.addEventListener('click', () => socket.emit('end-quiz'));

// ── Video player (shared for everyone) ───────────────────────────────────────
function initPlayer() {
  const dashSupported = typeof dashjs !== 'undefined' && typeof MediaSource !== 'undefined';
  if (dashSupported) {
    const player = dashjs.MediaPlayer().create();
    player.initialize(video, 'media/dash-mpeg/manifest.mpd', false);
  } else {
    video.src = 'media/video/salida.mp4';
  }

  video.addEventListener('play',  () => { gamePlayBtn.textContent = '⏸'; });
  video.addEventListener('pause', () => { gamePlayBtn.textContent = '▶'; });
  video.addEventListener('timeupdate', () => {
    updateProgress();
    if (isHost) checkQuizTrigger();
  });
  video.addEventListener('loadedmetadata', updateProgress);

  gamePlayBtn.addEventListener('click', () => {
    if (!isHost) return;
    video.paused ? video.play() : video.pause();
  });

  gameProgressBar.addEventListener('click', (e) => {
    if (!isHost) return;
    const rect = gameProgressBar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (isFinite(video.duration)) video.currentTime = ratio * video.duration;
  });

  gameFsBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) gameContainer.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  });

  // Show/hide controls on hover
  let hideTimer;
  gameContainer.addEventListener('mousemove', () => {
    gameControls.setAttribute('data-state', 'visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!video.paused) gameControls.setAttribute('data-state', 'hidden');
    }, 2500);
  });
  video.addEventListener('pause', () => gameControls.setAttribute('data-state', 'visible'));

  if (isHost) startSyncInterval();
}

function updateProgress() {
  if (!video.duration) return;
  gameProgressFill.style.width = (video.currentTime / video.duration * 100) + '%';
  if (video.buffered.length > 0) {
    gameProgressBuf.style.width =
      (video.buffered.end(video.buffered.length - 1) / video.duration * 100) + '%';
  }
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  gameTimeDisp.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration || 0)}`;
}

function enableControls() {
  gameControls.classList.remove('controls-disabled');
}

function disableControls() {
  gameControls.classList.add('controls-disabled');
}

// ── Host: video sync broadcast ────────────────────────────────────────────────
function startSyncInterval() {
  clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    socket.emit('video-sync', { currentTime: video.currentTime, paused: video.paused });
  }, 2000);
}

// ── Host: quiz trigger ────────────────────────────────────────────────────────
function loadQuizQuestions() {
  fetch('/media/quiz.json')
    .then(r => r.json())
    .then(data => { quizQuestions = data.sort((a, b) => a.time - b.time); })
    .catch(() => {});
}

function checkQuizTrigger() {
  if (questionActive) return;
  const t = video.currentTime;
  for (const q of quizQuestions) {
    if (!triggeredTimes.has(q.time) && t >= q.time && t <= q.time + 3) {
      triggeredTimes.add(q.time);
      socket.emit('trigger-question', {
        question: q.question,
        options: q.options,
        correctIndex: q.correct,
        funFact: q.fun_fact,
        movie: q.movie,
      });
      break;
    }
  }
}

// ── Overlay (question UI for everyone) ───────────────────────────────────────
function showOverlay(question, options, movie) {
  overlayMovie.textContent = movie;
  overlayQuestion.textContent = question;
  overlayFeedback.style.display = 'none';
  overlayFeedback.className = 'overlay-feedback';

  const labels = ['A', 'B', 'C', 'D'];
  overlayOptions.innerHTML = '';
  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'overlay-option-btn';
    btn.innerHTML = `<strong>${labels[i]}.</strong> ${opt}`;
    btn.dataset.index = i;
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      overlayOptions.querySelectorAll('.overlay-option-btn').forEach(b => { b.disabled = true; });
      socket.emit('answer', { optionIndex: i });
    });
    overlayOptions.appendChild(btn);
  });

  overlay.style.display = 'flex';
}

function hideOverlay() {
  overlay.style.display = 'none';
  overlayFeedback.style.display = 'none';
}

function markOptions(correctIndex) {
  overlayOptions.querySelectorAll('.overlay-option-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === correctIndex) btn.classList.add('overlay-opt-correct');
    else btn.classList.add('overlay-opt-wrong');
  });
}

function showFeedback(correct, points) {
  overlayFeedback.style.display = 'block';
  overlayFeedback.classList.add(correct ? 'overlay-feedback-correct' : 'overlay-feedback-wrong');
  overlayFeedback.textContent = correct ? `¡Correcto! +${points} pts` : 'Incorrecto';
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function startCountdown(seconds) {
  stopCountdown();
  let remaining = seconds;
  overlayCountdown.textContent = remaining;
  overlayCountdown.className = 'overlay-countdown';
  countdownTimer = setInterval(() => {
    remaining--;
    overlayCountdown.textContent = remaining;
    if (remaining <= 5) overlayCountdown.classList.add('overlay-countdown-urgent');
    if (remaining <= 0) stopCountdown();
  }, 1000);
}

function stopCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = null;
}

// ── Scoreboard ────────────────────────────────────────────────────────────────
function renderScoreboard(players) {
  scoreboard.innerHTML = players.map((p, i) =>
    `<div class="rtc-score-row ${p.id === socket.id ? 'rtc-score-me' : ''}">
      <span class="rtc-pos">${i + 1}</span>
      <span class="rtc-name">${p.name}</span>
      <span class="rtc-pts">${p.score} pts</span>
    </div>`
  ).join('');
}

// ── End screen ────────────────────────────────────────────────────────────────
function renderPodium(scores) {
  const medals = ['🥇', '🥈', '🥉'];
  endPodium.innerHTML = scores.slice(0, 3).map((p, i) =>
    `<div class="rtc-podium-place rtc-podium-${i + 1}">
      <div class="rtc-medal">${medals[i]}</div>
      <div class="rtc-podium-name">${p.name}</div>
      <div class="rtc-podium-score">${p.score} pts</div>
    </div>`
  ).join('');
}

function renderFinalScores(scores) {
  endScores.innerHTML = `<table class="table table-sm rtc-table">
    <thead><tr><th>#</th><th>Jugador</th><th>Puntos</th></tr></thead>
    <tbody>${scores.map((p, i) =>
      `<tr ${p.id === socket.id ? 'class="rtc-table-me"' : ''}>
        <td>${i + 1}</td><td>${p.name}</td><td>${p.score}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

btnPlayAgain.addEventListener('click', () => {
  triggeredTimes.clear();
  quizQuestions = [];
  questionActive = false;
  funfactsPanel.style.display = 'none';
  funfactsList.innerHTML = '';
  showScreen('game');
});

function showFunFact(funFact) {
  funfactsPanel.style.display = 'block';
  const el = document.createElement('div');
  el.className = 'rtc-funfact';
  el.textContent = funFact;
  funfactsList.prepend(el);
}
