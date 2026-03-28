const video = document.getElementById('main-video');
const customControls = document.getElementById('video-controls');
const playBut = document.getElementById('play-button');
const resetBut = document.getElementById('reset-button');
const seekBwBut = document.getElementById('seek-backward-button');
const seekFwBut = document.getElementById('seek-forward-button');
const muteBut = document.getElementById('mute-button');
const progressBar = document.getElementById('progress-bar');
const settingsBut = document.getElementById('settings-button');
const fullScreenBut = document.getElementById('fullscreen-button');

const formatTime = (timeSeconds) => {
    if (!Number.isFinite(timeSeconds)) {
        return '0:00';
    }
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = Math.floor(timeSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const updateProgress = () => {
    const current = formatTime(video.currentTime);
    const total = formatTime(video.duration);
    progressBar.textContent = `${current} / ${total}`;
};

const ensurePlayableSource = () => {
    const webmSrc = 'media/video/video.webm';
    const mp4Src = 'media/video/video.mp4';
    const canPlayWebm = video.canPlayType('video/webm; codecs=\"vp9, opus\"') || video.canPlayType('video/webm');
    const canPlayMp4 = video.canPlayType('video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"') || video.canPlayType('video/mp4');

    if (canPlayWebm) {
        video.src = webmSrc;
    } else if (canPlayMp4) {
        video.src = mp4Src;
    } else {
        video.src = webmSrc;
    }

    video.load();
};

document.addEventListener('DOMContentLoaded', () => {
    video.controls = true; // Fallback con controles nativos
    customControls.style.visibility = 'visible';
    ensurePlayableSource();
    updateProgress();
});

playBut.addEventListener('click', () => {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
});

video.addEventListener('play', () => {
    playBut.textContent = 'Pause';
});

video.addEventListener('pause', () => {
    playBut.textContent = 'Play';
});

resetBut.addEventListener('click', () => {
    video.pause();
    video.currentTime = 0;
});

seekBwBut.addEventListener('click', () => {
    video.currentTime = Math.max(0, video.currentTime - 10);
});

seekFwBut.addEventListener('click', () => {
    const target = video.currentTime + 10;
    video.currentTime = Number.isFinite(video.duration) ? Math.min(video.duration, target) : target;
});

muteBut.addEventListener('click', () => {
    video.muted = !video.muted;
    muteBut.textContent = video.muted ? 'Unmute' : 'Mute';
});

video.addEventListener('timeupdate', updateProgress);
video.addEventListener('loadedmetadata', updateProgress);
video.addEventListener('durationchange', updateProgress);
video.addEventListener('error', () => {
    progressBar.textContent = 'No se pudo cargar el video';
});

video.addEventListener('click', () => {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
});

settingsBut.addEventListener('click', () => {
    if (video.playbackRate === 1) {
        video.playbackRate = 1.5;
        settingsBut.textContent = 'Speed 1.5x';
    } else {
        video.playbackRate = 1;
        settingsBut.textContent = 'Speed 1x';
    }
});

fullScreenBut.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        video.requestFullscreen?.();
        return;
    }
    document.exitFullscreen?.();
});
