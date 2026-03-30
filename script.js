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
const locationPanel = document.getElementById('location');
const descriptionPanel = document.getElementById('description');
const actorsPanel = document.getElementById('actors-info');
const chaptersSelect = document.getElementById('chapters-select');
const mapPanel = document.getElementById('filming-map');
const synopsisPanel = document.getElementById('synopsis');
let filmingMap = null;
let filmingMarkers = null;

const ACTOR_IMAGES = {
  "angelinajolie": "AngelinaJolie.jpg",
  "benschwartz": "BenSchwartz.jpg",
  "jamiebell": "JamieBell.jpg",
  "jenniferconnelly": "JenniferConnelly.jpg",
  "julialouisdreyfus": "JuliaLouisDreyfus.jpg",
  "richardmadden": "RichardMadden.jpg",
  "samuelljackson": "SamuelLJackson.jpg",
  "taronegerton": "TaronEgerton.jpg",
  "tikasumpter": "TikaSumpter.jpg",
  "tomcruise": "TomCruise.jpg",
  "tyresegibson": "TyreseGibson.jpg",
  "adamdriver": "adamDriver.jpg",
  "alexanderskarsgard": "alexanderskarsgard.jpg",
  "benedictcumberbatch": "benedictCumberbatch.jpg",
  "bradpitt": "bradPitt.jpg",
  "briannetju": "brianneTju.jpg",
  "chiwetelejiofor": "chiwetelEjiofor.jpg",
  "chrisevans": "chrisEvans.jpg",
  "chrishemsworth": "chrisHemsworth.jpg",
  "chrispratt": "chrisPratt.jpg",
  "christianbale": "christianBale.jpg",
  "cliveowen": "cliveOwen.jpg",
  "corinnefoxx": "corinneFoxx.jpg",
  "daisyridley": "daisyRidley.jpg",
  "donaldglover": "donaldGlover.jpg",
  "elisabetholsen": "elisabethOlsen.jpg",
  "elizabetholsen": "elisabethOlsen.jpg",
  "ellefanning": "elleFanning.jpg",
  "emmastone": "emmaStone.jpg",
  "emmathompson": "emmaThompson.jpg",
  "harrisonford": "harrison-ford.jpg",
  "jamesmarsden": "jamesMarsden.jpg",
  "jamesmcavoy": "jamesMcAvoy.jpg",
  "jessicamcnamee": "jessicaMcNamee.jpg",
  "joelfry": "joelFry.jpg",
  "johnboyega": "johnBoyega.jpg",
  "joshlawson": "joshLawson.jpg",
  "kylechandler": "kyleChandler.jpg",
  "madsmikkelsen": "madsMikkelsen.jpg",
  "markruffalo": "markRuffalo.jpg",
  "maryelizabethwinstead": "maryElizabethWinstead.jpg",
  "michaelfassbender": "michaelFassbender.jpg",
  "michellerodriguez": "michelleRodriguez.jpg",
  "milesteller": "milesTeller.jpg",
  "milliebobbybrown": "millieBobbyBrown.jpg",
  "pierrecoffin": "pierreCoffin.jpg",
  "rebeccahall": "rebeccaHall.jpg",
  "robertdowney": "robertDowney.jpg",
  "robertdowneyjr": "robertDowney.jpg",
  "ruthnegga": "ruthNegga.jpg",
  "sethrogen": "sethRogen.jpg",
  "sophienelisse": "sophieNelisse.jpg",
  "sophienlisse": "sophieNelisse.jpg",
  "sophieturner": "sophieTurner.jpg",
  "stevecarell": "steveCarell.jpg",
  "tarajiphenson": "tarajiPHenson.jpg",
  "tessathompson": "tessaThompson.jpg",
  "tomholland": "tomHolland.jpg",
  "tommyleejones": "tommyLeeJones.jpg",
  "verafarmiga": "veraFarmiga.jpg",
  "vindiesel": "vinDiesel.jpg",
  "willsmith": "willSmith.jpg",
  "zendaya": "zendaya.jpg"
};

// Actualizar y mostrar progreso del video
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimeDisplay() {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
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
    muteBtn.textContent = '\uD83D\uDD07';
  } else if (video.volume < 0.5) {
    muteBtn.textContent = '\uD83D\uDD09';
  } else {
    muteBtn.textContent = '\uD83D\uDD0A';
  }
}

function seekTo(timeSeconds) {
  const target = Math.max(0, timeSeconds);
  const setTime = (value) => {
    if (typeof video.fastSeek === 'function') {
      try {
        video.fastSeek(value);
      } catch {
        video.currentTime = value;
      }
    } else {
      video.currentTime = value;
    }
    updateProgress();
    updateTimeDisplay();
  };
  const applySeek = () => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const clamped = duration > 0
      ? Math.min(Math.max(0, target), Math.max(0, duration - 0.01))
      : target;
    if (video.seekable && video.seekable.length) {
      const start = video.seekable.start(0);
      const end = video.seekable.end(video.seekable.length - 1);
      setTime(Math.min(Math.max(clamped, start), end));
    } else {
      setTime(clamped);
    }
  };

  if (video.readyState < 1) {
    video.addEventListener('loadedmetadata', applySeek, { once: true });
    return;
  }

  if (video.readyState < 2) {
    video.addEventListener('loadeddata', applySeek, { once: true });
  }

  applySeek();
}


// Funcionalidad de parar y reproducir video
function togglePlay() {
  if (video.paused || video.ended) {
    video.play();
  } else {
    video.pause();
  }
}

video.addEventListener('play',  () => { playBtn.textContent = '\u23F8'; });
video.addEventListener('pause', () => { playBtn.textContent = '\u25B6'; });
video.addEventListener('ended', () => {
  playBtn.textContent = '\u25B6';
  progressFill.style.width = '100%';
});

// Parar/reproducir si se hace click sobre el video
playBtn.addEventListener('click', togglePlay);
video.addEventListener('click', togglePlay);
controls.addEventListener('click', (e) => e.stopPropagation());

// Resetear video
function stopMedia() {
  video.pause();
  video.currentTime = 0;
}
resetBtn.addEventListener('click', stopMedia);

// Botones de adelantar o atrasar el video
bwBtn.addEventListener('click', () => {
  const base = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  seekTo(base - 15);
});
fwBtn.addEventListener('click', () => {
  const base = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  seekTo(base + 15);
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
  if (Number.isFinite(video.duration) && video.duration > 0) {
    seekTo(ratio * video.duration);
  }
});


// Barra de progreso arrastable
let dragging = false;
progressBar.addEventListener('mousedown', () => { dragging = true; });
document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const rect = progressBar.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  if (Number.isFinite(video.duration) && video.duration > 0) {
    seekTo(ratio * video.duration);
  }
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
  fsBtn.textContent = document.fullscreenElement ? '\u22A0' : '\u26F6';
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
  const baseTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  switch (e.key) {
    case ' ':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowRight':
      e.preventDefault();
      seekTo(baseTime + 15);
     break;
    case 'ArrowLeft':
      e.preventDefault();
      seekTo(baseTime - 15);
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

// Chapters + info.vtt rendering
const wikiCache = new Map();

function normalizeKey(value) {
  const base = String(value || '');
  const normalized = base.normalize ? base.normalize('NFD') : base;
  return normalized
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function actorImageFor(name) {
  const key = normalizeKey(name);
  const keyNoSuffix = key.replace(/(jr|sr)$/, '');
  const file = ACTOR_IMAGES[key] || ACTOR_IMAGES[keyNoSuffix];
  return file ? `media/img/actores/${file}` : '';
}

function formatDate(wikiTime) {
  if (!wikiTime) return 'N/A';
  const cleaned = wikiTime.replace('+', '').split('T')[0];
  return cleaned;
}

function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'N/A';
  return `$${amount.toLocaleString('en-US')}`;
}

function getClaimValue(claims, pid) {
  const claim = claims?.[pid]?.[0];
  return claim?.mainsnak?.datavalue?.value || null;
}

function collectEntityIds(claims, pid, limit) {
  const items = claims?.[pid] || [];
  const ids = [];
  for (const item of items) {
    const id = item?.mainsnak?.datavalue?.value?.id;
    if (id && !ids.includes(id)) ids.push(id);
    if (limit && ids.length >= limit) break;
  }
  return ids;
}

async function fetchEntityLabels(ids) {
  if (!ids.length) return {};
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=labels&languages=en&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  const labels = {};
  Object.entries(data.entities || {}).forEach(([id, entity]) => {
    labels[id] = entity.labels?.en?.value || id;
  });
  return labels;
}

async function fetchWikidataInfo(title, url) {
  const key = title || url || 'unknown';
  if (wikiCache.has(key)) return wikiCache.get(key);

  const wikiTitle = url && url.includes('/wiki/')
    ? decodeURIComponent(url.split('/wiki/')[1])
    : String(title || '').trim().replace(/\s+/g, '_');

  const api = `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${encodeURIComponent(wikiTitle)}&props=claims|descriptions&format=json&origin=*`;
  const res = await fetch(api);
  const data = await res.json();
  const entity = Object.values(data.entities || {})[0];
  const claims = entity?.claims || {};

  const releaseTime = getClaimValue(claims, 'P577');
  const durationVal = getClaimValue(claims, 'P2047');
  const boxOfficeVal = getClaimValue(claims, 'P2142');
  const budgetVal = getClaimValue(claims, 'P2130');

  const genreIds = collectEntityIds(claims, 'P136', 3);
  const directorIds = collectEntityIds(claims, 'P57', 2);
  const ratingIds = collectEntityIds(claims, 'P1657', 1);
  const labelIds = [...new Set([...genreIds, ...directorIds, ...ratingIds])];
  const labels = await fetchEntityLabels(labelIds);

  const info = {
    releaseDate: formatDate(releaseTime?.time),
    duration: durationVal?.amount ? `${Math.round(Number(durationVal.amount))} min` : 'N/A',
    boxOffice: boxOfficeVal?.amount ? formatMoney(Number(boxOfficeVal.amount)) : 'N/A',
    budget: budgetVal?.amount ? formatMoney(Number(budgetVal.amount)) : 'N/A',
    genre: genreIds.map(id => labels[id]).filter(Boolean).join(', ') || 'N/A',
    director: directorIds.map(id => labels[id]).filter(Boolean).join(', ') || 'N/A',
    rating: ratingIds.map(id => labels[id]).filter(Boolean).join(', ') || 'N/A',
    summary: entity?.descriptions?.en?.value || 'N/A'
  };

  wikiCache.set(key, info);
  return info;
}

function renderWikipediaInfo(title, wiki) {
  if (!locationPanel) return;
  locationPanel.innerHTML = `
    <div class="info-title">${title}</div>
    <div class="info-grid">
      <div class="label">Estreno</div><div class="value">${wiki.releaseDate}</div>
      <div class="label">Genero</div><div class="value">${wiki.genre}</div>
      <div class="label">Duracion</div><div class="value">${wiki.duration}</div>
      <div class="label">Recaudacion</div><div class="value">${wiki.boxOffice}</div>
      <div class="label">Director</div><div class="value">${wiki.director}</div>
      <div class="label">Presupuesto</div><div class="value">${wiki.budget}</div>
      <div class="label">Clasificacion</div><div class="value">${wiki.rating}</div>
    </div>
    <p>${wiki.summary}</p>
  `;
}

function renderActors(actors) {
  if (!actorsPanel) return;
  if (!actors.length) {
    actorsPanel.innerHTML = '<p>Sin actores.</p>';
    return;
  }
  const cards = actors.map(name => {
    const img = actorImageFor(name);
    const imgTag = img
      ? `<img src="${img}" alt="${name}">`
      : `<div class="actor-placeholder">${name.split(' ').map(p => p[0]).join('').slice(0, 2)}</div>`;
    return `<div class="actor">${imgTag}<p>${name}</p></div>`;
  }).join('');
  actorsPanel.innerHTML = `<figcaption>Actores</figcaption><div class="actors-grid">${cards}</div>`;
}

function extractCountries(locations) {
  if (!Array.isArray(locations)) return [];
  const cleaned = locations.map(item => {
    if (!item) return '';
    const parts = String(item).split(',');
    return parts[parts.length - 1].trim();
  }).filter(Boolean);

  const normalized = cleaned.map(name => {
    const lower = name.toLowerCase();
    if (['england', 'scotland', 'wales', 'northern ireland', 'united kingdom', 'uk'].includes(lower)) {
      return 'United Kingdom';
    }
    if (['united states', 'usa', 'u.s.', 'u.s.a.'].includes(lower)) {
      return 'United States';
    }
    return name;
  });

  return Array.from(new Set(normalized));
}

function countryToCoords(country) {
  const coords = {
    'United States': [37.1, -95.7],
    'Canada': [56.1, -106.3],
    'United Kingdom': [55.3, -3.4],
    'Australia': [-25.3, 133.8],
    'Dominican Republic': [19.0, -70.7],
    'Colombia': [4.6, -74.1],
    'Hungary': [47.1, 19.5],
    'Morocco': [31.8, -7.1],
    'Italy': [41.9, 12.6],
    'Jordan': [31.2, 36.2],
    'Iceland': [64.9, -18.6],
    'Hong Kong': [22.3, 114.2],
    'Mexico': [23.6, -102.5],
    'United Arab Emirates': [24.3, 54.2]
  };
  return coords[country] || null;
}

function latLonToPercent(lat, lon) {
  const x = ((lon + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { x, y };
}

function renderFilmingMap(locations) {
  if (!mapPanel) return;
  const countries = extractCountries(locations);
  if (!countries.length) {
    mapPanel.innerHTML = '<figcaption>Paises de rodaje</figcaption><p>Sin datos de rodaje.</p>';
    return;
  }

  const chips = countries.map(country => `<span class="map-country">${country}</span>`).join('');

  mapPanel.innerHTML = `
    <figcaption>Paises de rodaje</figcaption>
    <div class="map-canvas">
      <div id="filming-map-canvas" class="map-leaflet" aria-label="Mapa mundial"></div>
    </div>
    <div class="map-countries">${chips}</div>
  `;

  if (typeof L === 'undefined') return;

  if (filmingMap) {
    filmingMap.remove();
    filmingMap = null;
  }

  filmingMap = L.map('filming-map-canvas', {
    zoomControl: false,
    attributionControl: false,
    dragging: true,
    scrollWheelZoom: false
  }).setView([20, 0], 1);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 6,
    minZoom: 1
  }).addTo(filmingMap);

  filmingMarkers = L.layerGroup().addTo(filmingMap);

  countries.forEach(country => {
    const coord = countryToCoords(country);
    if (!coord) return;
    L.circleMarker(coord, {
      radius: 5,
      color: '#ff4d4d',
      weight: 2,
      fillColor: '#ff4d4d',
      fillOpacity: 0.7
    }).bindTooltip(country).addTo(filmingMarkers);
  });

  setTimeout(() => filmingMap && filmingMap.invalidateSize(), 50);
}

function renderInfo(data) {
  if (!data) return;
  const title = data.title || 'Info';
  const poster = data.poster || '';
  const url = data.url || '';
  const actors = Array.isArray(data.actors) ? data.actors : [];
  const locations = Array.isArray(data.filmingLocation) ? data.filmingLocation : [];
  const synopsis = data.synopsis || data.summary || '';

  const posterHtml = poster ? `<img class="info-poster" src="${poster}" alt="Poster ${title}">` : '';
  const linkHtml = url ? `<a class="info-link" href="${url}" target="_blank" rel="noopener">Wikipedia</a>` : '';
  if (descriptionPanel) {
    descriptionPanel.innerHTML = `${posterHtml}${linkHtml}`;
  }

  renderActors(actors);
  renderFilmingMap(locations);

  if (synopsisPanel) {
    synopsisPanel.innerHTML = `
      <figcaption>Sinopsis</figcaption>
      <p>${synopsis || 'Sinopsis no disponible.'}</p>
    `;
  }

  fetchWikidataInfo(title, url)
    .then(wiki => renderWikipediaInfo(title, wiki))
    .catch(() => {
      if (locationPanel) {
        locationPanel.innerHTML = `<div class="info-title">${title}</div><p>Info Wikipedia no disponible.</p>`;
      }
    });
}

function buildChaptersSelect(track) {
  if (!chaptersSelect || !track || !track.cues) return;
  chaptersSelect.innerHTML = '<option value=\"\">Chapters</option>';
  Array.from(track.cues).forEach((cue, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = cue.text;
    chaptersSelect.appendChild(option);
  });
  chaptersSelect.addEventListener('change', () => {
    const idx = Number(chaptersSelect.value);
    const cue = track.cues && track.cues[idx];
    if (!cue) return;
    seekTo(cue.startTime + 0.05);
    video.play().catch(() => {});
  });
}

function syncChapterSelect(track) {
  if (!chaptersSelect || !track) return;
  const cue = track.activeCues && track.activeCues[0];
  if (!cue) return;
  const index = Array.from(track.cues).indexOf(cue);
  if (index >= 0) chaptersSelect.value = String(index);
}

function initTracks() {
  const tracks = Array.from(video.textTracks || []);
  const chaptersTrack = tracks.find(t => t.kind === 'chapters');
  const infoTrack = tracks.find(t => t.kind === 'metadata');

  if (chaptersTrack) {
    chaptersTrack.mode = 'hidden';
    const waitForCues = () => {
      if (chaptersTrack.cues && chaptersTrack.cues.length) {
        buildChaptersSelect(chaptersTrack);
        syncChapterSelect(chaptersTrack);
        return;
      }
      setTimeout(waitForCues, 200);
    };
    waitForCues();
    chaptersTrack.addEventListener('cuechange', () => syncChapterSelect(chaptersTrack));
  }

  if (infoTrack) {
    infoTrack.mode = 'hidden';
    infoTrack.addEventListener('cuechange', () => {
      const cue = infoTrack.activeCues && infoTrack.activeCues[0];
      if (!cue) return;
      try {
        const data = JSON.parse(cue.text);
        renderInfo(data);
      } catch (err) {
        console.warn('Info track parse error:', err);
      }
    });
    if (infoTrack.cues && infoTrack.cues.length) {
      try {
        const data = JSON.parse(infoTrack.cues[0].text);
        renderInfo(data);
      } catch (err) {
        console.warn('Info track parse error:', err);
      }
    }
  }
}

if (video.readyState >= 1) {
  initTracks();
} else {
  video.addEventListener('loadedmetadata', initTracks);
}


//HLS/DASH

// ── Resolución (altura del video) ────────────────────────────────────────────
// Nota: para cambiar resolución real necesitarías fuentes distintas por calidad
// (HLS/DASH). Este control cambia la altura del elemento como ejemplo visual,
// o puedes ampliar la lógica para cambiar src según la resolución elegida.
// resoSelect.addEventListener('change', () => {
  // const val = resoSelect.value;
  // if (val) {
    // // Ejemplo: ajustar altura del elemento (en producción cambiarías la fuente)
    // video.style.maxHeight = val + 'px';
  // } else {
    // video.style.maxHeight = '';
  // }
// });
