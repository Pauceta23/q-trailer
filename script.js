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

document.addEventListener('DOMContentLoaded', () => {
    video.controls = false; // Deshabilitar controles nativos
    customControls.style.visibility = 'visible'; // Mostrar UI personalizada
});
