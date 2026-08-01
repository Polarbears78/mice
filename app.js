(() => {
  "use strict";

  // ---- DOM ----
  const recordBtn = document.getElementById("recordBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const stopBtn = document.getElementById("stopBtn");
  const copyBtn = document.getElementById("copyBtn");
  const downloadTextBtn = document.getElementById("downloadTextBtn");
  const clearBtn = document.getElementById("clearBtn");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const languageSelect = document.getElementById("language");
  const transcriptEl = document.getElementById("transcript");
  const recordingsEl = document.getElementById("recordings");
  const statusEl = document.getElementById("status");
  const timerEl = document.getElementById("timer");
  const speechWarning = document.getElementById("speechWarning");
  const canvas = document.getElementById("visualizer");
  const canvasCtx = canvas.getContext("2d");

  // ---- 상태 ----
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechSupported = Boolean(SpeechRecognition);

  let mediaRecorder = null;
  let mediaStream = null;
  let recognition = null;
  let audioChunks = [];
  let finalTranscript = "";
  let interimTranscript = "";
  let recording = false;
  let paused = false;
  let startTime = 0;
  let pausedElapsed = 0;
  let timerInterval = null;
  let audioContext = null;
  let analyser = null;
  let animationId = null;
  let recogStartedAt = 0;
  let rapidEndCount = 0;
  const recordings = [];

  // iPhone 홈 화면 앱(standalone 모드)에서는 iOS 제약으로 음성 인식이 동작하지 않는다
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = isIos && isStandalone;

  if (iosStandalone) {
    document.getElementById("iosStandaloneWarning").classList.remove("hidden");
    document.getElementById("openSafariBtn").classList.remove("hidden");
  } else if (!speechSupported) {
    speechWarning.classList.remove("hidden");
  }

  // ---- 홈 화면 설치 버튼 ----
  // Android/PC Chrome은 설치 API(beforeinstallprompt)를 지원하고,
  // iOS는 API가 없어 수동 설치 안내를 보여준다. 이미 설치 모드면 표시하지 않는다.
  const installBtn = document.getElementById("installBtn");
  const iosInstallGuide = document.getElementById("iosInstallGuide");
  let deferredInstallPrompt = null;

  if (!isStandalone) {
    if (isIos) {
      installBtn.classList.remove("hidden");
      installBtn.addEventListener("click", () => {
        iosInstallGuide.classList.toggle("hidden");
      });
    } else {
      window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        installBtn.classList.remove("hidden");
      });
      installBtn.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installBtn.classList.add("hidden");
      });
      window.addEventListener("appinstalled", () => {
        installBtn.classList.add("hidden");
      });
    }
  }

  // ---- 유틸 ----
  function setStatus(message) {
    statusEl.textContent = message;
  }

  function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function nowLabel() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function pickMimeType() {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---- 타이머 ----
  function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
      if (!paused) {
        timerEl.textContent = formatDuration(pausedElapsed + (Date.now() - startTime));
      }
    }, 250);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // ---- 시각화 ----
  function startVisualizer(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();

    function draw() {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / bufferLength;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        canvasCtx.fillStyle = accent;
        canvasCtx.globalAlpha = 0.35 + (dataArray[i] / 255) * 0.65;
        canvasCtx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
      }
      canvasCtx.globalAlpha = 1;
    }
    draw();
  }

  function stopVisualizer() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    if (audioContext) audioContext.close();
    audioContext = null;
    analyser = null;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ---- 음성 인식 ----
  function startRecognition() {
    if (!speechSupported || iosStandalone) return;

    recognition = new SpeechRecognition();
    recognition.lang = languageSelect.value;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      recogStartedAt = Date.now();
    };

    recognition.onresult = (event) => {
      rapidEndCount = 0;
      interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript.trim() + " ";
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      renderTranscript();
    };

    recognition.onerror = (event) => {
      // no-speech / aborted는 정상 흐름에서 발생하므로 조용히 넘어간다
      const messages = {
        "network": "네트워크 오류 — 인터넷 연결을 확인해 주세요.",
        "not-allowed": "음성 인식 권한이 거부되었습니다. 브라우저의 마이크 권한을 확인해 주세요.",
        "service-not-allowed": "이 브라우저/모드에서 음성 인식 서비스가 차단되어 있습니다.",
        "audio-capture": "음성 인식이 마이크를 사용할 수 없습니다. 다른 앱이 마이크를 점유 중일 수 있습니다.",
        "language-not-supported": "선택한 언어를 이 기기의 음성 인식이 지원하지 않습니다.",
      };
      if (messages[event.error]) {
        setStatus(`전사 오류 [${event.error}]: ${messages[event.error]} (녹음은 계속됩니다)`);
      }
    };

    // 브라우저가 인식 세션을 수시로 끊기 때문에 녹음 중에는 자동 재시작.
    // 단, 시작 직후 반복해서 끊기면 (기기 비호환·서비스 불가) 재시도를 멈추고 알린다.
    recognition.onend = () => {
      if (!recording || paused) return;
      rapidEndCount = Date.now() - recogStartedAt < 1000 ? rapidEndCount + 1 : 0;
      if (rapidEndCount >= 8) {
        setStatus(
          "전사를 시작할 수 없어 중단했습니다. 인터넷 연결과 마이크 상태를 확인한 뒤 녹음을 다시 시작해 주세요. (녹음은 계속됩니다)"
        );
        return;
      }
      try {
        recognition.start();
      } catch (_) {
        /* 이미 시작된 경우 무시 */
      }
    };

    try {
      recognition.start();
    } catch (_) {
      /* 중복 시작 무시 */
    }
  }

  function stopRecognition() {
    if (!recognition) return;
    recognition.onend = null;
    recognition.onresult = null;
    try {
      recognition.stop();
    } catch (_) {
      /* 이미 종료된 경우 무시 */
    }
    recognition = null;
  }

  // ---- 전사 렌더링 ----
  function renderTranscript() {
    if (!finalTranscript && !interimTranscript) {
      transcriptEl.innerHTML =
        '<span class="placeholder">녹음을 시작하면 전사 내용이 여기에 표시됩니다.</span>';
      copyBtn.disabled = true;
      downloadTextBtn.disabled = true;
      clearBtn.disabled = true;
      return;
    }

    transcriptEl.textContent = "";
    transcriptEl.appendChild(document.createTextNode(finalTranscript));
    if (interimTranscript) {
      const interim = document.createElement("span");
      interim.className = "interim";
      interim.textContent = interimTranscript;
      transcriptEl.appendChild(interim);
    }
    transcriptEl.scrollTop = transcriptEl.scrollHeight;

    const hasFinal = finalTranscript.trim().length > 0;
    copyBtn.disabled = !hasFinal;
    downloadTextBtn.disabled = !hasFinal;
    clearBtn.disabled = !hasFinal && !interimTranscript;
  }

  // ---- 녹음 ----
  async function startRecording() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setStatus("마이크에 접근할 수 없습니다. 브라우저의 마이크 권한을 확인해 주세요.");
      return;
    }

    audioChunks = [];
    finalTranscript = "";
    interimTranscript = "";
    rapidEndCount = 0;
    renderTranscript();

    const mimeType = pickMimeType();
    mediaRecorder = new MediaRecorder(
      mediaStream,
      mimeType ? { mimeType } : undefined
    );

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      const duration = pausedElapsed + (paused ? 0 : Date.now() - startTime);
      saveRecording(blob, duration);
      cleanupAfterStop();
    };

    mediaRecorder.start(1000);
    recording = true;
    paused = false;
    pausedElapsed = 0;

    startTimer();
    startVisualizer(mediaStream);
    startRecognition();

    recordBtn.disabled = true;
    recordBtn.classList.add("recording");
    recordBtn.lastChild.textContent = "녹음 중...";
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    languageSelect.disabled = true;
    setStatus(
      speechSupported && !iosStandalone
        ? "녹음 및 실시간 전사가 진행 중입니다."
        : "녹음이 진행 중입니다. (이 모드에서는 전사가 지원되지 않습니다)"
    );
  }

  function togglePause() {
    if (!mediaRecorder) return;

    if (!paused) {
      mediaRecorder.pause();
      paused = true;
      pausedElapsed += Date.now() - startTime;
      stopRecognition();
      pauseBtn.textContent = "재개";
      setStatus("일시정지됨. '재개'를 누르면 이어서 녹음합니다.");
    } else {
      mediaRecorder.resume();
      paused = false;
      startTime = Date.now();
      startRecognition();
      pauseBtn.textContent = "일시정지";
      setStatus("녹음 및 실시간 전사가 진행 중입니다.");
    }
  }

  function stopRecording() {
    if (!mediaRecorder) return;
    stopRecognition();
    mediaRecorder.stop();
  }

  function cleanupAfterStop() {
    stopTimer();
    stopVisualizer();
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    mediaRecorder = null;
    recording = false;
    paused = false;
    interimTranscript = "";
    renderTranscript();

    recordBtn.disabled = false;
    recordBtn.classList.remove("recording");
    recordBtn.lastChild.textContent = "녹음 시작";
    pauseBtn.disabled = true;
    pauseBtn.textContent = "일시정지";
    stopBtn.disabled = true;
    languageSelect.disabled = false;
    timerEl.textContent = "00:00";
    setStatus("녹음이 저장되었습니다. 아래 '녹음 기록'에서 확인하세요.");
  }

  // ---- 녹음 기록 ----
  function saveRecording(blob, duration) {
    const entry = {
      id: Date.now(),
      blob,
      url: URL.createObjectURL(blob),
      createdAt: nowLabel(),
      duration,
      transcript: finalTranscript.trim(),
      language: languageSelect.value,
    };
    recordings.unshift(entry);
    renderRecordings();
  }

  function deleteRecording(id) {
    const index = recordings.findIndex((r) => r.id === id);
    if (index === -1) return;
    URL.revokeObjectURL(recordings[index].url);
    recordings.splice(index, 1);
    renderRecordings();
  }

  function renderRecordings() {
    recordingsEl.textContent = "";
    clearHistoryBtn.disabled = recordings.length === 0;

    if (recordings.length === 0) {
      const li = document.createElement("li");
      li.className = "placeholder";
      li.textContent = "아직 녹음이 없습니다.";
      recordingsEl.appendChild(li);
      return;
    }

    recordings.forEach((entry, index) => {
      const li = document.createElement("li");

      const meta = document.createElement("div");
      meta.className = "recording-meta";
      const title = document.createElement("span");
      title.className = "recording-title";
      title.textContent = `녹음 ${recordings.length - index}`;
      const info = document.createElement("span");
      info.className = "recording-info";
      info.textContent = `${entry.createdAt} · ${formatDuration(entry.duration)}`;
      meta.append(title, info);

      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = entry.url;

      const actions = document.createElement("div");
      actions.className = "recording-actions";

      const downloadAudio = document.createElement("button");
      downloadAudio.className = "btn btn-small";
      downloadAudio.textContent = "오디오 다운로드";
      downloadAudio.onclick = () => {
        const ext = entry.blob.type.includes("mp4") ? "m4a" : "webm";
        downloadBlob(entry.blob, `recording-${entry.id}.${ext}`);
      };

      const del = document.createElement("button");
      del.className = "btn btn-small";
      del.textContent = "삭제";
      del.onclick = () => deleteRecording(entry.id);

      actions.append(downloadAudio);

      if (entry.transcript) {
        const downloadText = document.createElement("button");
        downloadText.className = "btn btn-small";
        downloadText.textContent = "전사 다운로드";
        downloadText.onclick = () =>
          downloadBlob(
            new Blob([entry.transcript], { type: "text/plain;charset=utf-8" }),
            `transcript-${entry.id}.txt`
          );
        actions.append(downloadText);
      }

      actions.append(del);

      li.append(meta, audio);

      if (entry.transcript) {
        const text = document.createElement("div");
        text.className = "recording-text";
        text.textContent = entry.transcript;
        li.append(text);
      }

      li.append(actions);
      recordingsEl.appendChild(li);
    });
  }

  // ---- 이벤트 바인딩 ----
  recordBtn.addEventListener("click", startRecording);
  pauseBtn.addEventListener("click", togglePause);
  stopBtn.addEventListener("click", stopRecording);

  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(finalTranscript.trim());
    setStatus("전사 내용이 클립보드에 복사되었습니다.");
  });

  downloadTextBtn.addEventListener("click", () => {
    downloadBlob(
      new Blob([finalTranscript.trim()], { type: "text/plain;charset=utf-8" }),
      `transcript-${Date.now()}.txt`
    );
  });

  clearBtn.addEventListener("click", () => {
    finalTranscript = "";
    interimTranscript = "";
    renderTranscript();
  });

  clearHistoryBtn.addEventListener("click", () => {
    recordings.forEach((r) => URL.revokeObjectURL(r.url));
    recordings.length = 0;
    renderRecordings();
  });
})();
