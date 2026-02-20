/**
 * MedTranslate Client Application
 * Slidable mic: left = EN->target, right = target->EN
 * Timer only runs during active recording
 */

var CONFIG = {
  WS_URL: 'wss://' + location.host + '/ws',
  RECONNECT_MAX: 5,
  RECONNECT_DELAY: 2000
};

var LANGUAGES = {
  es: { name: 'Spanish', speechCode: 'es-ES' },
  ht: { name: 'Haitian Creole', speechCode: 'ht' },
  en: { name: 'English', speechCode: 'en-US' }
};

var state = {
  screen: 'login',
  specialty: null,
  pin: '',
  selectedLang: null,
  direction: { from: 'en', to: null },
  session: { id: null, active: false },
  recognition: null,
  isRecording: false,
  ws: { socket: null, reconnectAttempts: 0, connected: false },
  // Recording timer
  recStartTime: null,
  recElapsed: 0,
  recTimerInterval: null,
  // Slider
  sliderSide: 'left',  // 'left' = EN->target, 'right' = target->EN
  isDragging: false,
  dragStartX: 0
};

var loginScreen, specialtyScreen, setupScreen, sessionScreen, pinDigits, loginBtn;
var langCards, startBtn;
var connectionDot, sessionTimer, activeFrom, activeTo;
var waveformStatus, statusText;
var originalText, translatedText, micToggle, endSessionBtn, toastEl;
var sliderTrack, sliderHint, sliderLabelLeft, sliderLabelRight;

function cacheDom() {
  loginScreen = document.querySelector('#login-screen');
  specialtyScreen = document.querySelector('#specialty-screen');
  setupScreen = document.querySelector('#setup-screen');
  sessionScreen = document.querySelector('#session-screen');
  pinDigits = document.querySelectorAll('.pin-digit');
  loginBtn = document.querySelector('#login-btn');
  langCards = document.querySelectorAll('.lang-flag-card');
  startBtn = document.querySelector('#start-session-btn');
  connectionDot = document.querySelector('#connection-dot');
  sessionTimer = document.querySelector('#session-timer');
  activeFrom = document.querySelector('#active-from');
  activeTo = document.querySelector('#active-to');
  waveformStatus = document.querySelector('#waveform-status');
  statusText = document.querySelector('#status-text');
  originalText = document.querySelector('#original-text');
  translatedText = document.querySelector('#translated-text');
  micToggle = document.querySelector('#mic-toggle');
  endSessionBtn = document.querySelector('#end-session-btn');
  toastEl = document.querySelector('#toast');
  sliderTrack = document.querySelector('#slider-track');
  sliderHint = document.querySelector('#slider-hint');
  sliderLabelLeft = document.querySelector('#slider-label-left');
  sliderLabelRight = document.querySelector('#slider-label-right');
}

function showScreen(name) {
  state.screen = name;
  loginScreen.classList.toggle('hidden', name !== 'login');
  specialtyScreen.classList.toggle('hidden', name !== 'specialty');
  setupScreen.classList.toggle('hidden', name !== 'setup');
  sessionScreen.classList.toggle('hidden', name !== 'session');
}

function showToast(message, type) {
  if (!type) type = 'error';
  toastEl.textContent = message;
  toastEl.className = 'toast ' + type + ' show';
  setTimeout(function() { toastEl.classList.remove('show'); }, 3500);
}

/* ── PIN ── */
function initPinInput() {
  pinDigits.forEach(function(input, i) {
    input.addEventListener('input', function(e) {
      var val = e.target.value.replace(/\D/g, '');
      e.target.value = val;
      if (val) {
        e.target.classList.add('filled');
        if (i < pinDigits.length - 1) pinDigits[i + 1].focus();
      }
      updatePinState();
    });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && !e.target.value && i > 0) {
        pinDigits[i - 1].focus();
        pinDigits[i - 1].value = '';
        pinDigits[i - 1].classList.remove('filled');
        updatePinState();
      }
    });
  });
  loginBtn.addEventListener('click', handleLogin);
}

function updatePinState() {
  state.pin = Array.from(pinDigits).map(function(d) { return d.value; }).join('');
  loginBtn.disabled = state.pin.length < 6;
}

function handleLogin() {
  if (state.pin.length === 6) {
    showToast('Authenticated', 'success');
    setTimeout(function() { showScreen('specialty'); }, 300);
  } else {
    showToast('Enter a 6-digit PIN');
  }
}

/* ── Language Select ── */
function initLanguageSelect() {
  langCards.forEach(function(card) {
    card.addEventListener('click', function() {
      langCards.forEach(function(c) { c.classList.remove('selected'); });
      card.classList.add('selected');
      state.selectedLang = card.dataset.lang;
      state.targetLocale = card.dataset.locale || card.dataset.lang;
      state.direction.to = card.dataset.lang;
      startBtn.disabled = false;
      
      var tb = document.getElementById('train-mode-toggle');
      if (tb) {
        tb.style.display = (state.selectedLang === 'ht') ? 'inline-block' : 'none';
      }
    });
  });
  startBtn.addEventListener('click', startSession);
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function startSession() {
  startBtn.disabled = true;
  startBtn.innerHTML = '<div class="spinner"></div>';
  try {
    state.session.id = generateUUID();
    state.session.active = true;
    // Set initial direction based on slider
    updateDirectionFromSlider();
    updateDirectionDisplay();
    // Update slider labels for the selected language
    updateSliderLabels();
    await connectWebSocket();
    showScreen('session');
    setStatus('ready');
    // Snap slider to left by default
    snapSlider('left');
    originalText.textContent = 'Slide mic & hold to speak';
    translatedText.textContent = '\u2014';
    sessionTimer.textContent = '0:00';
    showToast('Connected! Slide mic & hold to talk', 'success');
  } catch (err) {
    showToast('Failed: ' + err.message);
    startBtn.innerHTML = '<span>Start Session</span>';
    startBtn.disabled = false;
    state.session.active = false;
  }
}

function endSession() {
  state.session.active = false;
  stopRecording();
  stopRecTimer();
  if (state.ws.socket && state.ws.socket.readyState === WebSocket.OPEN) {
    state.ws.socket.send(JSON.stringify({ type: 'end_session', session_id: state.session.id }));
    state.ws.socket.close(1000);
  }
  state.ws = { socket: null, reconnectAttempts: 0, connected: false };
  showToast('Session ended', 'success');
  startBtn.innerHTML = '<span>Start Session</span>';
  startBtn.disabled = false;
  showScreen('setup');
}

/* ── Recording Timer ── */
function startRecTimer() {
  state.recStartTime = Date.now();
  sessionTimer.classList.add('active');
  state.recTimerInterval = setInterval(function() {
    var ms = Date.now() - state.recStartTime + state.recElapsed;
    var secs = Math.floor(ms / 1000);
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    sessionTimer.textContent = m + ':' + String(s).padStart(2, '0');
  }, 250);
}

function stopRecTimer() {
  if (state.recTimerInterval) {
    clearInterval(state.recTimerInterval);
    state.recTimerInterval = null;
  }
  if (state.recStartTime) {
    state.recElapsed += Date.now() - state.recStartTime;
    state.recStartTime = null;
  }
  sessionTimer.classList.remove('active');
}

/* ── Slider Logic ── */
function updateSliderLabels() {
  var target = (state.selectedLang || 'es').toUpperCase();
  // Left label (visible when snapped RIGHT): TARGET -> EN
  sliderLabelLeft.innerHTML =
    '<span class="slider-lang">' + target + '</span>' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
    '<span class="slider-lang">EN</span>';
  // Right label (visible when snapped LEFT): EN -> TARGET
  sliderLabelRight.innerHTML =
    '<span class="slider-lang">EN</span>' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
    '<span class="slider-lang">' + target + '</span>';
  highlightActiveLabel();
}

function highlightActiveLabel() {
  sliderLabelLeft.classList.toggle('active-side', state.sliderSide === 'left');
  sliderLabelRight.classList.toggle('active-side', state.sliderSide === 'right');
}

function updateDirectionFromSlider() {
  if (state.sliderSide === 'left') {
    state.direction.from = 'en';
    state.direction.to = state.selectedLang || 'es';
  } else {
    state.direction.from = state.selectedLang || 'es';
    state.direction.to = 'en';
  }
}

function updateDirectionDisplay() {
  activeFrom.textContent = state.direction.from.toUpperCase();
  activeTo.textContent = state.direction.to.toUpperCase();
}

function snapSlider(side) {
  state.sliderSide = side;
  micToggle.classList.remove('snapped-left', 'snapped-right');
  micToggle.classList.add('snapped-' + side);
  micToggle.style.left = '';
  micToggle.style.right = '';
  micToggle.style.transform = '';
  updateDirectionFromSlider();
  updateDirectionDisplay();
  highlightActiveLabel();

  var target = (state.selectedLang || 'es').toUpperCase();
  if (side === 'left') {
    sliderHint.textContent = 'EN \u2192 ' + target + '  \u00b7  Hold to speak';
  } else {
    sliderHint.textContent = target + ' \u2192 EN  \u00b7  Hold to speak';
  }
}

function initSlider() {
  var SNAP_THRESHOLD = 0.3; // 30% from edge to snap
  var holdTimer = null;
  var hasDragged = false;

  function getTrackBounds() {
    return sliderTrack.getBoundingClientRect();
  }

  function getClientX(e) {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    return e.clientX;
  }

  function onPointerDown(e) {
    if (state.isRecording) return;
    e.preventDefault();
    state.isDragging = true;
    hasDragged = false;
    state.dragStartX = getClientX(e);

    // Start a hold timer - if user holds without dragging, start recording
    holdTimer = setTimeout(function() {
      if (!hasDragged) {
        state.isDragging = false;
        startRecording();
      }
    }, 300);
  }

  function onPointerMove(e) {
    if (!state.isDragging) return;
    e.preventDefault();
    var cx = getClientX(e);
    var delta = Math.abs(cx - state.dragStartX);
    if (delta > 10) hasDragged = true;
    if (!hasDragged) return;

    // Cancel hold timer if dragging
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }

    var bounds = getTrackBounds();
    var thumbW = 56;
    var trackInner = bounds.width - thumbW - 8; // 4px padding each side
    var relX = cx - bounds.left - thumbW / 2 - 4;
    relX = Math.max(0, Math.min(relX, trackInner));
    var pct = relX / trackInner;

    micToggle.classList.remove('snapped-left', 'snapped-right');
    micToggle.style.left = (4 + relX) + 'px';
    micToggle.style.right = 'auto';
    micToggle.style.transform = 'translateX(0)';
  }

  function onPointerUp(e) {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }

    if (state.isRecording) {
      // User released while recording
      stopRecording();
      return;
    }

    if (!state.isDragging) return;
    state.isDragging = false;

    if (!hasDragged) {
      // Pure tap, no drag — start recording
      startRecording();
      return;
    }

    // Determine snap side from current position
    var bounds = getTrackBounds();
    var thumbW = 56;
    var currentLeft = micToggle.getBoundingClientRect().left - bounds.left;
    var pct = currentLeft / (bounds.width - thumbW);

    if (pct < SNAP_THRESHOLD) {
      snapSlider('left');
    } else if (pct > (1 - SNAP_THRESHOLD)) {
      snapSlider('right');
    } else {
      // Snap back to current side
      snapSlider(state.sliderSide);
    }
  }

  // Touch events
  micToggle.addEventListener('touchstart', onPointerDown, { passive: false });
  document.addEventListener('touchmove', onPointerMove, { passive: false });
  document.addEventListener('touchend', onPointerUp, { passive: false });
  document.addEventListener('touchcancel', onPointerUp, { passive: false });

  // Mouse events
  micToggle.addEventListener('mousedown', onPointerDown);
  document.addEventListener('mousemove', onPointerMove);
  document.addEventListener('mouseup', onPointerUp);
}

/* ── Session Controls ── */
function initSessionControls() {
  endSessionBtn.addEventListener('click', function() { if (confirm('End session?')) endSession(); });
  initSlider();
}

function startRecording() {
  if (!state.session.active || state.isRecording) return;

  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) { showToast('Speech recognition not supported'); return; }

  state.isRecording = true;
  micToggle.classList.add('recording');
  setStatus('listening');
  startRecTimer();
  originalText.textContent = 'Listening...';
  translatedText.textContent = '\u2014';

  var origBubble = document.querySelector('#original-transcript');
  var transBubble = document.querySelector('#translated-transcript');
  if (origBubble) origBubble.classList.remove('active');
  if (transBubble) transBubble.classList.remove('active');

  var rec = new SpeechRec();
  rec.continuous = false;
  rec.interimResults = true;
  var langInfo = LANGUAGES[state.direction.from];
  rec.lang = langInfo ? langInfo.speechCode : 'en-US';
  rec.maxAlternatives = 1;

  var latestTranscript = '';

  rec.onresult = function(event) {
    var lastIdx = event.results.length - 1;
    var result = event.results[lastIdx];
    var transcript = result[0].transcript;
    originalText.textContent = transcript;
    latestTranscript = transcript.trim();
    console.log('Speech:', transcript, 'isFinal:', result.isFinal);
  };

  rec.onerror = function(event) {
    console.warn('Speech error:', event.error);
    if (event.error === 'not-allowed') {
      showToast('Microphone permission denied');
      finishRecording();
    } else if (event.error === 'no-speech') {
      console.log('No speech yet...');
    } else if (event.error === 'network') {
      showToast('Network needed for speech recognition');
      finishRecording();
    }
  };

  rec.onend = function() {
    console.log('Recognition ended. isRecording:', state.isRecording, 'transcript:', latestTranscript);
    if (state.isRecording && (!latestTranscript || latestTranscript.length < 2)) {
      console.log('No speech yet, restarting');
      try { rec.start(); return; } catch(e) { console.warn('Restart failed:', e); }
    }
    if (state.isRecording) state.isRecording = false;

    if (latestTranscript && latestTranscript.length > 1) {
      originalText.textContent = latestTranscript;
      sendForTranslation(latestTranscript);
    } else {
      originalText.textContent = 'No speech detected - try again';
      setStatus('ready');
    }
    finishRecording();
  };

  try {
    rec.start();
    state.recognition = rec;
    console.log('Recording started, lang:', rec.lang, 'direction:', state.direction.from, '->', state.direction.to);
  } catch (e) {
    console.error('Failed to start:', e);
    showToast('Could not start speech recognition');
    finishRecording();
  }
}

function stopRecording() {
  if (!state.isRecording) return;
  console.log('Stop recording');
  state.isRecording = false;
  stopRecTimer();
  if (state.recognition) {
    try { state.recognition.stop(); } catch(e) {}
  }
}

function finishRecording() {
  state.isRecording = false;
  stopRecTimer();
  micToggle.classList.remove('recording');
  state.recognition = null;
}

function sendForTranslation(text) {
  setStatus('translating');
  console.log('Translating:', text, state.direction.from, '->', state.direction.to);
  if (state.ws.connected && state.ws.socket && state.ws.socket.readyState === WebSocket.OPEN) {
    state.ws.socket.send(JSON.stringify({
      type: 'translate',
      text: text,
      from: state.direction.from,
      to: state.direction.to,
      session_id: state.session.id
    }));
  } else {
    showToast('Not connected to server');
    setStatus('ready');
  }
}

function connectWebSocket() {
  return new Promise(function(resolve, reject) {
    try {
      var ws = new WebSocket(CONFIG.WS_URL);
      var timeout = setTimeout(function() { ws.close(); reject(new Error('Connection timeout')); }, 8000);

      ws.onopen = function() {
        clearTimeout(timeout);
        state.ws.socket = ws;
        state.ws.connected = true;
        state.ws.reconnectAttempts = 0;
        connectionDot.classList.remove('disconnected');
        ws.send(JSON.stringify({
          type: 'start_session',
          session_id: state.session.id,
          from: state.direction.from,
          to: state.direction.to
        }));
        resolve();
      };

      ws.onmessage = function(event) {
        try {
          var msg = JSON.parse(event.data);
          console.log('WS:', msg);
          if (msg.type === 'translation') {
            translatedText.textContent = msg.text;
            var origB = document.querySelector('#original-transcript');
            var transB = document.querySelector('#translated-transcript');
            if (origB) origB.classList.add('active');
            if (transB) transB.classList.add('active');
            setStatus('speaking');
            speakTranslation(msg.text, state.direction.to);
          } else if (msg.type === 'error') {
            showToast(msg.message);
            setStatus('ready');
          }
        } catch (e) { console.warn('WS parse error:', e); }
      };

      ws.onclose = function() {
        state.ws.connected = false;
        connectionDot.classList.add('disconnected');
        if (state.session.active && state.ws.reconnectAttempts < CONFIG.RECONNECT_MAX) {
          state.ws.reconnectAttempts++;
          setTimeout(function() {
            connectWebSocket().catch(function(e) { console.warn('Reconnect fail:', e); });
          }, CONFIG.RECONNECT_DELAY * state.ws.reconnectAttempts);
        }
      };

      ws.onerror = function() {
        clearTimeout(timeout);
        if (state.ws.reconnectAttempts === 0) reject(new Error('Cannot connect'));
      };
    } catch (err) { reject(err); }
  });
}

function speakTranslation(text, lang) {
  if (!('speechSynthesis' in window)) { setStatus('ready'); return; }
  speechSynthesis.cancel();
  var utterance = new SpeechSynthesisUtterance(text);
  var langInfo = LANGUAGES[lang];
  utterance.lang = langInfo ? langInfo.speechCode : lang;
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.onend = function() {
    setStatus('ready');
    originalText.textContent = 'Slide mic & hold to speak';
    setTimeout(function() {
      var origB = document.querySelector('#original-transcript');
      var transB = document.querySelector('#translated-transcript');
      if (origB) origB.classList.remove('active');
      if (transB) transB.classList.remove('active');
    }, 2000);
  };
  utterance.onerror = function() { setStatus('ready'); };
  speechSynthesis.speak(utterance);
}

function setStatus(s) {
  waveformStatus.className = 'waveform-status ' + s;
  var labels = {
    ready: 'Ready',
    listening: 'Recording...',
    translating: 'Translating...',
    speaking: 'Speaking...'
  };
  statusText.textContent = labels[s] || 'Ready';
}

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch (e) {}
  }
}

function init() {
  cacheDom();
  initPinInput();
  initLanguageSelect();
  initSessionControls();
  registerSW();
  if (pinDigits[0]) pinDigits[0].focus();
}

document.addEventListener('DOMContentLoaded', init);

/* ── Voice Training Module ── */
var trainToggleBtn = document.getElementById('train-mode-toggle');
var trainScreen = document.getElementById('training-screen');
var exitTrainBtn = document.getElementById('exit-training-btn');
var trainPhraseText = document.getElementById('training-phrase-text');
var trainTargetLang = document.getElementById('training-target-lang');
var trainRecordBtn = document.getElementById('training-record-btn');
var trainStatusText = document.getElementById('training-status-text');

var trainingPhrases = [
  "I will perform a physical exam now.",
  "Your laboratory results are completely normal.",
  "Please take a deep breath and hold it.",
  "Are you currently experiencing any pain?",
  "We need to schedule a follow-up appointment in two weeks.",
  "Do you have any known allergies to medications?",
  "I am prescribing you an antibiotic for the infection.",
  "The procedure will take approximately thirty minutes."
];
var currentPhraseIndex = 0;
var trainMediaRecorder = null;
var trainAudioChunks = [];

trainToggleBtn.addEventListener('click', function() {
  if (!state.selectedLang) {
    showToast("Please select a target language first.", "error");
    return;
  }
  document.getElementById('setup-screen').classList.add('hidden');
  trainScreen.classList.remove('hidden');
  trainTargetLang.textContent = LANGUAGES[state.selectedLang.split('-')[0]].name;
  loadNextPhrase();
});

exitTrainBtn.addEventListener('click', function() {
  trainScreen.classList.add('hidden');
  document.getElementById('setup-screen').classList.remove('hidden');
});

function loadNextPhrase() {
  currentPhraseIndex = Math.floor(Math.random() * trainingPhrases.length);
  trainPhraseText.textContent = '"' + trainingPhrases[currentPhraseIndex] + '"';
}

trainRecordBtn.addEventListener('mousedown', startTrainingRecording);
trainRecordBtn.addEventListener('mouseup', stopTrainingRecording);
trainRecordBtn.addEventListener('mouseleave', function() {
  if (trainMediaRecorder && trainMediaRecorder.state === 'recording') {
    stopTrainingRecording();
  }
});

// Touch support for mobile
trainRecordBtn.addEventListener('touchstart', function(e) { e.preventDefault(); startTrainingRecording(); });
trainRecordBtn.addEventListener('touchend', function(e) { e.preventDefault(); stopTrainingRecording(); });

async function startTrainingRecording() {
  trainStatusText.textContent = "Recording...";
  trainStatusText.style.color = "#ff4444";
  trainRecordBtn.style.background = "#ff4444";
  trainRecordBtn.style.animation = "pulse-shadow 1.5s infinite";
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    trainMediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    trainAudioChunks = [];
    
    trainMediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) trainAudioChunks.push(e.data);
    };
    
    trainMediaRecorder.onstop = () => {
      const audioBlob = new Blob(trainAudioChunks, { type: 'audio/webm' });
      uploadTrainingAudio(audioBlob, trainingPhrases[currentPhraseIndex]);
      // Stop all tracks to release mic
      stream.getTracks().forEach(track => track.stop());
    };
    
    trainMediaRecorder.start();
  } catch (err) {
    showToast("Microphone access denied", "error");
    stopTrainingRecording(true);
  }
}

function stopTrainingRecording(failed = false) {
  if (trainMediaRecorder && trainMediaRecorder.state === 'recording') {
    trainMediaRecorder.stop();
  }
  trainStatusText.textContent = "Hold to record";
  trainStatusText.style.color = "#8da4c0";
  trainRecordBtn.style.background = "#2a354d";
  trainRecordBtn.style.animation = "none";
  if (!failed) {
    showToast("Audio saved! Loading next phrase...", "success");
    setTimeout(loadNextPhrase, 1000);
  }
}

function uploadTrainingAudio(blob, phrase) {
  // In a production app, this sends the Blob + Provider PIN + Phrase to the backend.
  var formData = new FormData();
  formData.append('audio', blob, 'recording.webm');
  formData.append('phrase', phrase);
  formData.append('lang', state.selectedLang);
  formData.append('pin', state.pin);
  
  fetch('/api/train', {
    method: 'POST',
    body: formData
  }).catch(err => console.error("Upload failed", err));
}
