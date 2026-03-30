const video = document.getElementById('main-video');
const controls = document.getElementById('video-controls');
const container = document.getElementById('player-container');

const playBtn = document.getElementById('play-button');
const resetBtn = document.getElementById('reset-button');
const bwBtn = document.getElementById('seek-backward-button');
const fwBtn = document.getElementById('seek-forward-button');

const muteBtn = document.getElementById('mute-button');
const volSlider = document.getElementById('volume-slider');

const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const progressBuf = document.getElementById('progress-buffer');

const timeDisplay = document.getElementById('time-display');

const resoSelect = document.getElementById('resolution-select');
const fsBtn = document.getElementById('fullscreen-button');

// Actualizar y mostrar progreso del video
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimeDisplay() {
  timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
}

function updateProgress() {
  if (!video.duration) return;
  const pct = (video.currentTime / video.duration) * 100;
  progressFill.style.width = pct + '%';

  // Buffer
  if (video.buffered.length > 0) {
    const bufEnd = video.buffered.end(video.buffered.length - 1);
    progressBuf.style.width = ((bufEnd / video.duration) * 100) + '%';
  }
}


// Actualizar vista del icono de mutear
function updateMuteIcon() {
  if (video.muted || video.volume === 0) {
    muteBtn.textContent = '🔇';
  } else if (video.volume < 0.5) {
    muteBtn.textContent = '🔉';
  } else {
    muteBtn.textContent = '🔊';
  }
}


// Funcionalidad de parar y reproducir video
function togglePlay() {
  if (video.paused || video.ended) {
    video.play();
  } else {
    video.pause();
  }
}

video.addEventListener('play',  () => { playBtn.textContent = '⏸'; });
video.addEventListener('pause', () => { playBtn.textContent = '▶'; });
video.addEventListener('ended', () => {
  playBtn.textContent = '▶';
  progressFill.style.width = '100%';
});

// Parar/reproducir si se hace click sobre el video
playBtn.addEventListener('click', togglePlay);
video.addEventListener('click', togglePlay);

// Resetear video
function stopMedia() {
  video.pause();
  video.currentTime = 0;
}
resetBtn.addEventListener('click', stopMedia);

// Botones de adelantar o atrasar el video
bwBtn.addEventListener('click', () => {
  video.currentTime = Math.max(0, video.currentTime - 15);
});
fwBtn.addEventListener('click', () => {
  video.currentTime = Math.min(video.duration || 0, video.currentTime + 15);
});

// Actualizar barra y números de la duración según los eventos
video.addEventListener('timeupdate', () => {
  updateProgress();
  updateTimeDisplay();
});

video.addEventListener('loadedmetadata', () => {
  updateTimeDisplay();
});

progressBar.addEventListener('click', (e) => {
  const rect = progressBar.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  video.currentTime = ratio * (video.duration || 0);
});


// Barra de progreso arrastable
let dragging = false;
progressBar.addEventListener('mousedown', () => { dragging = true; });
document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const rect = progressBar.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  video.currentTime = ratio * (video.duration || 0);
});
document.addEventListener('mouseup', () => { dragging = false; });

// Gestión del volumen del audio
muteBtn.addEventListener('click', () => {
  video.muted = !video.muted;
  if (!video.muted) volSlider.value = video.volume;
  updateMuteIcon();
});

volSlider.addEventListener('input', () => {
  video.volume = parseFloat(volSlider.value);
  video.muted  = (video.volume === 0);
  updateMuteIcon();
});

video.addEventListener('volumechange', () => {
  updateMuteIcon();
  if (!video.muted) volSlider.value = video.volume;
});


// Funcionalidad pantalla completa
fsBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => console.warn('Fullscreen error:', err));
  } else {
    document.exitFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  fsBtn.textContent = document.fullscreenElement ? '⊠' : '⛶';
});


// Ocultar/mostrar controles según la interacción del usuario
let hideTimeout;
function showControls() {
  controls.setAttribute('data-state', 'visible');
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    if (!video.paused) controls.setAttribute('data-state', 'hidden');
  }, 2500);
}

container.addEventListener('mousemove', showControls);
container.addEventListener('mouseenter', showControls);
container.addEventListener('mouseleave', () => {
  if (!video.paused) controls.setAttribute('data-state', 'hidden');
});

// Mostrar siempre si está pausado
video.addEventListener('pause', () => {
  controls.setAttribute('data-state', 'visible');
  clearTimeout(hideTimeout);
});


// Manejo del input por teclado
document.addEventListener('keydown', (e) => {
  // Solo si el foco no está en un input
  //if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  switch (e.key) {
    case ' ':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowRight':
      e.preventDefault();
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 15);
     break;
    case 'ArrowLeft':
      e.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - 15);
     break;
    case 'ArrowUp':
      e.preventDefault();
      video.volume = Math.min(1, video.volume + 0.1);
      volSlider.value = video.volume;
      break;
    case 'ArrowDown':
      e.preventDefault();
      video.volume = Math.max(0, video.volume - 0.1);
      volSlider.value = video.volume;
      break;
    case 'm':
      video.muted = !video.muted;
      break;
    case 'f':
      fsBtn.click();
      break;
  }
});


//HLS/DASH

const player = dashjs.MediaPlayer().create();

player.initialize(
  document.getElementById('main-video'),
  'media/dash-mpeg/manifest.mpd',
  true
);

player.updateSettings({
  streaming: {
    abr: {
      autoSwitchBitrate: { video: true, audio: true },
      initialBitrate: { video: 1500 }
    },
    buffer: {
      fastSwitchEnabled: true,
      bufferTimeAtTopQuality: 30,
      bufferToKeep: 10
    }
  }
});

player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
  console.log('Calidad cambiada a:', e.newQuality);
});

player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
  const qualities = player.getRepresentationsByType('video');

  resoSelect.innerHTML = '<option value="auto">Auto</option>';
  qualities.forEach((q) => {
    const opt = document.createElement('option');
    opt.value = q.height;
    //opt.textContent = `${q.height}p`;
    opt.textContent = `${q.height}p — ${q.bitrateInKbit} kbps`;
    resoSelect.appendChild(opt);
  });

  resoSelect.addEventListener('change', () => {
    const val = resoSelect.value;

    if (val === 'auto') {
      player.updateSettings({
        streaming: { abr: { autoSwitchBitrate: { video: true } } }
      });
    } else {
      player.updateSettings({
        streaming: { abr: { autoSwitchBitrate: { video: false } } }
      });

      //const index = qualities.findIndex(q => q.height === parseInt(val));
      //if (index !== -1) {
        //player.setQualityFor('video', index);
      //}
      const index = qualities.findIndex(q => q.height === parseInt(val));
      if (index !== -1) {
        player.setRepresentationForTypeById('video', qualities[index].id); // ✅ v5 API
      }
    }
  });
});




//fallback en caso de que mpeg-dash no este disponible
if (typeof MediaSource !== 'undefined') {
  // DASH playback
  player.initialize(document.getElementById('main-video'), 'media/dash-mpeg/manifest.mpd', false);
} else {
  // Fallback para navegadores muy antiguos
  document.getElementById('main-video').src = 'media/video/video.mp4';
}