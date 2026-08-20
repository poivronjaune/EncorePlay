const fileInput = document.getElementById("file-input");
const fileNameEl = document.getElementById("file-name");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const playTitleEl = document.getElementById("play-title");
const playAuthorEl = document.getElementById("play-author");
const statsGridEl = document.getElementById("stats-grid");
const charactersTbody = document.querySelector("#characters-table tbody");
const locationsTbody = document.querySelector("#locations-table tbody");
const rawJsonEl = document.getElementById("raw-json");
const roleFiltersEl = document.getElementById("role-filters");
const roleCheckboxes = roleFiltersEl.querySelectorAll("input[type=checkbox]");
const sidebarEl = document.getElementById("sidebar");
const resizerEl = document.getElementById("resizer");
const collapseBtn = document.getElementById("collapse-btn");
const expandBtn = document.getElementById("expand-btn");
const scriptViewEl = document.getElementById("script-view");
const configBtn = document.getElementById("config-btn");
const configDialog = document.getElementById("config-dialog");
const configOkBtn = document.getElementById("config-ok-btn");
const micLangSelect = document.getElementById("mic-lang-select");
const roleSelectorBtn = document.getElementById("select-role-btn");
const roleLabelEl = document.getElementById("role-label");
const characterDialog = document.getElementById("character-dialog");
const characterListEl = document.getElementById("character-list");
const characterCancelBtn = document.getElementById("character-cancel-btn");
const previewToolbarEl = document.getElementById("preview-toolbar");
const prevLineBtn = document.getElementById("prev-line-btn");
const nextLineBtn = document.getElementById("next-line-btn");
const lineNavCountEl = document.getElementById("line-nav-count");
const micBtn = document.getElementById("mic-btn");
const micHintEl = document.getElementById("mic-hint");
const micTranscriptEl = document.getElementById("mic-transcript");
const micTranscriptHeaderEl = document.getElementById("mic-transcript-header");
const micTranscriptTextEl = document.getElementById("mic-transcript-text");
const micAccuracyFillEl = document.getElementById("mic-accuracy-fill");
const micAccuracyLabelEl = document.getElementById("mic-accuracy-label");
const micClearBtn = document.getElementById("mic-clear-btn");
const micAutoJumpCheckbox = document.getElementById("mic-autojump-checkbox");

configBtn.addEventListener("click", () => configDialog.showModal());
configOkBtn.addEventListener("click", () => configDialog.close());

micClearBtn.addEventListener("click", () => resetTranscriptDisplay());

// Dragging the floating transcript window by its header (same pointer-capture
// pattern as the sidebar resizer, so it keeps tracking even if the cursor moves fast).
let draggingTranscript = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

micTranscriptHeaderEl.addEventListener("pointerdown", (event) => {
  const rect = micTranscriptEl.getBoundingClientRect();
  micTranscriptEl.style.left = rect.left + "px";
  micTranscriptEl.style.top = rect.top + "px";
  micTranscriptEl.style.right = "auto";
  micTranscriptEl.style.bottom = "auto";
  dragOffsetX = event.clientX - rect.left;
  dragOffsetY = event.clientY - rect.top;
  draggingTranscript = true;
  micTranscriptHeaderEl.setPointerCapture(event.pointerId);
  event.preventDefault();
});

micTranscriptHeaderEl.addEventListener("pointermove", (event) => {
  if (!draggingTranscript) return;
  micTranscriptEl.style.left = event.clientX - dragOffsetX + "px";
  micTranscriptEl.style.top = event.clientY - dragOffsetY + "px";
});

function stopDraggingTranscript() {
  draggingTranscript = false;
}

micTranscriptHeaderEl.addEventListener("pointerup", stopDraggingTranscript);
micTranscriptHeaderEl.addEventListener("pointercancel", stopDraggingTranscript);

let currentCharacters = [];
let selectedCharacterId = null;
let currentPlay = null;
let currentMineLines = [];
let currentMineIndex = -1;

prevLineBtn.addEventListener("click", () => goToLine(currentMineIndex - 1));
nextLineBtn.addEventListener("click", () => goToLine(currentMineIndex + 1));

function refreshLineNav() {
  stopListening();
  currentMineLines = Array.from(scriptViewEl.querySelectorAll(".script-mine"));
  currentMineIndex = -1;
  updateLineNavUI();
}

function updateLineNavUI() {
  const hasLines = currentMineLines.length > 0;
  previewToolbarEl.hidden = !hasLines;
  if (!hasLines) return;
  lineNavCountEl.textContent = (currentMineIndex < 0 ? 0 : currentMineIndex + 1) + " / " + currentMineLines.length;
  prevLineBtn.disabled = currentMineIndex <= 0;
  nextLineBtn.disabled = currentMineIndex >= currentMineLines.length - 1;
}

function goToLine(index) {
  if (!currentMineLines.length) return;
  currentMineLines.forEach((el) => el.classList.remove("script-mine-active"));
  currentMineIndex = Math.max(0, Math.min(index, currentMineLines.length - 1));
  const target = currentMineLines[currentMineIndex];
  target.classList.add("script-mine-active");
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  updateLineNavUI();
  if (listening) resetTranscriptDisplay();
}

// --- Voice detection: listens via the Web Speech API and auto-advances when the
// spoken words match the currently highlighted line for the selected character. ---
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;
let micStream = null;
let audioContext = null;
let levelAnimationId = null;
let finalizedTranscript = ""; // accumulates all finalized speech for the current line only

micBtn.addEventListener("click", () => {
  if (!SpeechRecognitionCtor) {
    showMicHint("Not supported in this browser (try Chrome/Edge).", true);
    return;
  }
  if (listening) stopListening();
  else startListening();
});

function startListening() {
  if (!currentMineLines.length) return;

  recognition = new SpeechRecognitionCtor();
  recognition.lang = micLangSelect.value;
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    const lastResult = event.results[event.results.length - 1];
    const transcript = lastResult[0].transcript;

    if (lastResult.isFinal) {
      // Keep everything spoken so far for this line, even across pauses that the
      // recognizer treats as separate finalized segments.
      finalizedTranscript = (finalizedTranscript + " " + transcript).trim();
      showTranscript(finalizedTranscript);
      updateAccuracyDisplay(finalizedTranscript);
      checkSpokenLine(finalizedTranscript);
    } else {
      const combined = (finalizedTranscript + " " + transcript).trim();
      showTranscript(combined);
      updateAccuracyDisplay(combined);
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      showMicHint("Microphone access denied.", true);
      stopListening();
    } else if (event.error !== "no-speech") {
      showMicHint("Error: " + event.error, true);
    }
  };

  // Some browsers stop the recognizer after a short silence even in continuous mode.
  recognition.onend = () => {
    if (listening) recognition.start();
  };

  listening = true;
  micBtn.classList.add("listening");
  showMicHint("Listening…", false);
  micTranscriptEl.hidden = false;
  resetTranscriptDisplay();
  recognition.start();
  startAudioLevelMeter();
}

function stopListening() {
  listening = false;
  micBtn.classList.remove("listening");
  micHintEl.hidden = true;
  micTranscriptEl.hidden = true;
  if (recognition) {
    recognition.onend = null;
    recognition.stop();
    recognition = null;
  }
  stopAudioLevelMeter();
}

// Separate from SpeechRecognition (which doesn't expose audio levels): reads the raw
// mic stream through an AnalyserNode so the mic button can react to actual volume,
// giving feedback that the mic is picking up sound even before words are recognized.
async function startAudioLevelMeter() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return; // voice matching still works without the level meter
  }
  if (!listening) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
    return;
  }

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(micStream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  const tick = () => {
    if (!listening) return;
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    const level = Math.min(1, rms * 4); // amplify quiet speech into a visible range
    micBtn.style.setProperty("--mic-level", level.toFixed(2));
    levelAnimationId = requestAnimationFrame(tick);
  };
  tick();
}

function stopAudioLevelMeter() {
  if (levelAnimationId) cancelAnimationFrame(levelAnimationId);
  levelAnimationId = null;
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  micBtn.style.removeProperty("--mic-level");
}

function showTranscript(text) {
  const trimmed = text.trim();
  if (!trimmed) return; // keep the previous line's text visible during brief silent gaps
  micTranscriptTextEl.textContent = "\u201c" + trimmed + "\u201d";
}

function resetTranscriptDisplay() {
  finalizedTranscript = "";
  micTranscriptTextEl.textContent = "\u2026";
  micAccuracyFillEl.style.width = "0%";
  micAccuracyFillEl.style.background = "var(--accent)";
  micAccuracyLabelEl.textContent = "0%";
}

function updateAccuracyDisplay(transcript) {
  if (!transcript.trim()) return; // keep the previous score visible during brief silent gaps
  const index = currentMineIndex < 0 ? 0 : currentMineIndex;
  const targetEl = currentMineLines[index];
  if (!targetEl) return;

  const { overlap } = computeMatch(transcript, targetEl.textContent);
  const percent = Math.round(overlap * 100);
  micAccuracyFillEl.style.width = percent + "%";
  micAccuracyFillEl.style.background = percent >= 70 ? "var(--main)" : percent >= 40 ? "var(--accent)" : "#ef4444";
  micAccuracyLabelEl.textContent = percent + "%";
}

// Seeds the language dropdown from the script's own data so it's a sensible default,
// while still letting the user override it via the Configuration dialog if it's wrong
// (e.g. our parser currently defaults every character's lang to fr-FR).
function seedMicLanguageFromCharacter(character) {
  if (!character || !character.lang) return;
  const hasOption = Array.from(micLangSelect.options).some((opt) => opt.value === character.lang);
  if (hasOption) micLangSelect.value = character.lang;
}

function checkSpokenLine(transcript) {
  const index = currentMineIndex < 0 ? 0 : currentMineIndex;
  const targetEl = currentMineLines[index];
  if (!targetEl) return;

  const { overlap, coverage } = computeMatch(transcript, targetEl.textContent);

  // Require both good word overlap AND that roughly the whole line's length was
  // spoken, not just its first few words, so it waits until the line is finished.
  if (overlap < 0.7 || coverage < 0.7) return;

  if (!micAutoJumpCheckbox.checked) {
    showMicHint("Matched! (auto-jump off)", false);
    return;
  }

  if (index < currentMineLines.length - 1) {
    showMicHint("Matched!", false);
    goToLine(index + 1);
  } else {
    showMicHint("Last line reached.", false);
    stopListening();
  }
}

// Bag-of-words scoring: robust to STT mis-transcriptions/punctuation, unlike exact match.
// `overlap` = fraction of the target line's words that were heard (accuracy).
// `coverage` = how much of the line's length has been spoken (completeness).
function computeMatch(transcript, targetText) {
  const targetWords = normalizeWords(targetText);
  const spokenWords = normalizeWords(transcript);
  if (!targetWords.length) return { overlap: 0, coverage: 0 };

  const spokenSet = new Set(spokenWords);
  const overlap = targetWords.filter((w) => spokenSet.has(w)).length / targetWords.length;
  const coverage = spokenWords.length / targetWords.length;
  return { overlap, coverage };
}

function normalizeWords(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function showMicHint(message, isError) {
  micHintEl.hidden = false;
  micHintEl.textContent = message;
  micHintEl.classList.toggle("mic-hint-error", Boolean(isError));
}

roleSelectorBtn.addEventListener("click", () => {
  renderCharacterDialog();
  characterDialog.showModal();
});

characterCancelBtn.addEventListener("click", () => characterDialog.close());

function renderCharacterDialog() {
  if (!currentCharacters.length) {
    characterListEl.innerHTML = '<li class="character-empty">Load a script first to see its characters.</li>';
    return;
  }

  const sorted = [...currentCharacters].sort((a, b) => b.line_count - a.line_count);
  characterListEl.innerHTML = sorted
    .map(
      (c) => `
        <li class="character-option${c.id === selectedCharacterId ? " active" : ""}" data-id="${c.id}">
          <span class="name">${escapeHtml(c.name)}</span>
          <span class="role-badge role-${c.role}">${c.role}</span>
        </li>`
    )
    .join("");

  characterListEl.querySelectorAll(".character-option").forEach((el) => {
    el.addEventListener("click", () => {
      selectedCharacterId = Number(el.dataset.id);
      renderRoleSelector();
      seedMicLanguageFromCharacter(currentCharacters.find((c) => c.id === selectedCharacterId));
      if (currentPlay) {
        renderScript(currentPlay);
        refreshLineNav();
      }
      characterDialog.close();
    });
  });
}

function renderRoleSelector() {
  const character = currentCharacters.find((c) => c.id === selectedCharacterId);
  roleSelectorBtn.classList.toggle("selected", Boolean(character));
  roleSelectorBtn.classList.toggle("unselected", !character);
  roleLabelEl.textContent = character ? "Playing: " + character.name : "Select your character";
}

// Checkboxes live inside <summary>; stop the click from bubbling so it doesn't toggle the panel.
roleFiltersEl.addEventListener("click", (event) => event.stopPropagation());
roleFiltersEl.addEventListener("change", () => renderCharacters(currentCharacters));

const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 720;

collapseBtn.addEventListener("click", () => setSidebarCollapsed(true));
expandBtn.addEventListener("click", () => setSidebarCollapsed(false));

function setSidebarCollapsed(collapsed) {
  sidebarEl.hidden = collapsed;
  resizerEl.hidden = collapsed;
  expandBtn.hidden = !collapsed;
}

let resizing = false;

// Pointer capture guarantees this element keeps receiving move/up events for the
// drag, even if the cursor briefly leaves the window — avoids a "stuck" drag state.
resizerEl.addEventListener("pointerdown", (event) => {
  resizing = true;
  resizerEl.setPointerCapture(event.pointerId);
  document.body.classList.add("resizing");
  event.preventDefault();
});

resizerEl.addEventListener("pointermove", (event) => {
  if (!resizing) return;
  const shellRect = document.querySelector(".app-shell").getBoundingClientRect();
  const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, event.clientX - shellRect.left));
  sidebarEl.style.width = newWidth + "px";
});

function stopResizing() {
  resizing = false;
  document.body.classList.remove("resizing");
}

resizerEl.addEventListener("pointerup", stopResizing);
resizerEl.addEventListener("pointercancel", stopResizing);

const SLUG_RE = /^(INT\.?\/EXT\.?|I\/E)[.\s]+(.*)$/i;
const INT_RE = /^(INT|EST)[.\s]+(.*)$/i;
const EXT_RE = /^EXT[.\s]+(.*)$/i;

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  fileNameEl.textContent = file.name;
  resultsEl.hidden = true;
  setStatus("Parsing " + file.name + "…", "loading");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/plays/import/fountain/file", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `Request failed with status ${response.status}`);
    }

    const play = await response.json();
    setStatus("", "");
    renderPlay(play);
  } catch (err) {
    setStatus("Error: " + err.message, "error");
  }
});

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = "status" + (kind ? " " + kind : "");
}

function renderPlay(play) {
  playTitleEl.textContent = play.title || "(untitled)";
  playAuthorEl.textContent = play.author ? "by " + play.author : "";

  const stats = computeStats(play);
  renderStats(stats);
  currentCharacters = play.characters || [];
  currentPlay = play;
  selectedCharacterId = null;
  renderRoleSelector();
  renderCharacters(currentCharacters);
  renderLocations(stats.locations);
  renderScript(play);
  refreshLineNav();
  rawJsonEl.textContent = JSON.stringify(play, null, 2);

  resultsEl.hidden = false;
}

function computeStats(play) {
  const characters = play.characters || [];
  const roleCounts = { main: 0, supporting: 0, minor: 0 };
  for (const c of characters) {
    if (roleCounts[c.role] !== undefined) roleCounts[c.role]++;
  }

  let sceneCount = 0;
  let stageDirectionCount = 0;
  let dialogueElementCount = 0;
  let dialogueLineCount = 0;
  const locationMap = new Map();
  const settingCounts = { indoor: 0, outdoor: 0, both: 0, unknown: 0 };

  for (const act of play.acts || []) {
    for (const scene of act.scenes || []) {
      sceneCount++;

      const parsed = parseSceneTitle(scene.title);
      settingCounts[parsed.setting]++;
      if (parsed.location) {
        const key = parsed.setting + "|" + parsed.location.toUpperCase();
        const existing = locationMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          locationMap.set(key, { location: parsed.location, setting: parsed.setting, count: 1 });
        }
      }

      for (const element of scene.elements || []) {
        if (element.type === "stage_direction") {
          stageDirectionCount++;
        } else if (element.type === "dialogue") {
          dialogueElementCount++;
          dialogueLineCount += (element.lines || []).length;
        }
      }
    }
  }

  const locations = Array.from(locationMap.values()).sort((a, b) => b.count - a.count);

  return {
    actCount: (play.acts || []).length,
    sceneCount,
    characterCount: characters.length,
    roleCounts,
    stageDirectionCount,
    dialogueElementCount,
    dialogueLineCount,
    settingCounts,
    locationCount: locations.length,
    locations,
  };
}

function parseSceneTitle(title) {
  if (!title) return { setting: "unknown", location: null };

  const trimmed = title.trim();

  let match = SLUG_RE.exec(trimmed);
  if (match) return { setting: "both", location: firstSegment(match[2]) };

  match = INT_RE.exec(trimmed);
  if (match) return { setting: "indoor", location: firstSegment(match[2]) };

  match = EXT_RE.exec(trimmed);
  if (match) return { setting: "outdoor", location: firstSegment(match[1]) };

  return { setting: "unknown", location: trimmed };
}

function firstSegment(remainder) {
  if (!remainder) return "";
  const dashIndex = remainder.indexOf(" - ");
  const segment = dashIndex >= 0 ? remainder.slice(0, dashIndex) : remainder;
  return segment.trim();
}

function renderStats(stats) {
  const items = [
    { label: "Acts", value: stats.actCount },
    { label: "Scenes", value: stats.sceneCount },
    { label: "Characters", value: stats.characterCount },
    { label: "Main", value: stats.roleCounts.main },
    { label: "Supporting", value: stats.roleCounts.supporting },
    { label: "Minor", value: stats.roleCounts.minor },
    { label: "Locations", value: stats.locationCount },
    { label: "Indoor scenes", value: stats.settingCounts.indoor },
    { label: "Outdoor scenes", value: stats.settingCounts.outdoor },
    { label: "Indoor/Outdoor scenes", value: stats.settingCounts.both },
    { label: "Unlabeled scenes", value: stats.settingCounts.unknown },
    { label: "Stage directions", value: stats.stageDirectionCount },
    { label: "Dialogue turns", value: stats.dialogueElementCount },
    { label: "Dialogue lines", value: stats.dialogueLineCount },
  ];

  statsGridEl.innerHTML = items
    .map(
      (item) => `
        <div class="stat">
          <div class="value">${item.value}</div>
          <div class="label">${item.label}</div>
        </div>`
    )
    .join("");
}

function renderCharacters(characters) {
  const checkedRoles = new Set(
    Array.from(roleCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.dataset.role)
  );

  const sorted = [...(characters || [])]
    .filter((c) => checkedRoles.has(c.role))
    .sort((a, b) => b.line_count - a.line_count);

  charactersTbody.innerHTML = sorted
    .map(
      (c) => `
        <tr>
          <td>${escapeHtml(c.name)}</td>
          <td><span class="role-badge role-${c.role}">${c.role}</span></td>
          <td>${c.line_count}</td>
          <td>${escapeHtml(c.lang)}</td>
        </tr>`
    )
    .join("");
}

function renderLocations(locations) {
  locationsTbody.innerHTML = locations
    .map(
      (loc) => `
        <tr>
          <td>${escapeHtml(loc.location)}</td>
          <td>${loc.setting}</td>
          <td>${loc.count}</td>
        </tr>`
    )
    .join("");
}

function renderScript(play) {
  const characterById = new Map((play.characters || []).map((c) => [c.id, c]));
  const parts = [];

  for (const act of play.acts || []) {
    parts.push(`<h2 class="script-act">${escapeHtml(act.title || "Act " + act.act_number)}</h2>`);

    for (const scene of act.scenes || []) {
      parts.push(`<h3 class="script-scene">${escapeHtml(scene.title || "Scene " + scene.scene_number)}</h3>`);

      for (const element of scene.elements || []) {
        if (element.type === "stage_direction") {
          parts.push(`<p class="script-stage-direction">${escapeHtml(element.content)}</p>`);
          continue;
        }

        if (element.type === "dialogue") {
          const character = characterById.get(element.character_id);
          const mine = character && character.id === selectedCharacterId;
          parts.push(`<p class="script-character">${escapeHtml(character ? character.name : "?")}</p>`);
          if (element.parenthetical) {
            parts.push(`<p class="script-parenthetical">(${escapeHtml(element.parenthetical)})</p>`);
          }
          for (const line of element.lines || []) {
            parts.push(`<p class="script-dialogue${mine ? " script-mine" : ""}">${escapeHtml(line)}</p>`);
          }
        }
      }
    }
  }

  scriptViewEl.innerHTML = parts.join("") || '<p class="placeholder">This script has no content.</p>';
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}
