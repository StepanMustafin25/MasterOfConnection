const WIRE_IMAGE = {
  WO: "./orange-white.png",
  O: "./orange.png",
  WG: "./green-white.png",
  B: "./blue.png",
  WB: "./blue-white.png",
  G: "./green.png",
  WC: "./brown-white.png",
  C: "./brown.png",
};

const T568B = [
  { key: "WO", name: "Бело-оранжевый", targetPos: 1, css: wireCss("WO"), img: WIRE_IMAGE.WO },
  { key: "O", name: "Оранжевый", targetPos: 2, css: wireCss("O"), img: WIRE_IMAGE.O },
  { key: "WG", name: "Бело-зелёный", targetPos: 3, css: wireCss("WG"), img: WIRE_IMAGE.WG },
  { key: "B", name: "Синий", targetPos: 4, css: wireCss("B"), img: WIRE_IMAGE.B },
  { key: "WB", name: "Бело-синий", targetPos: 5, css: wireCss("WB"), img: WIRE_IMAGE.WB },
  { key: "G", name: "Зелёный", targetPos: 6, css: wireCss("G"), img: WIRE_IMAGE.G },
  { key: "WC", name: "Бело-коричневый", targetPos: 7, css: wireCss("WC"), img: WIRE_IMAGE.WC },
  { key: "C", name: "Коричневый", targetPos: 8, css: wireCss("C"), img: WIRE_IMAGE.C },
];

function wireCss(key) {
  // Two-tone wires look closer to real “white-striped” conductors.
  const OR = "#f57c00";
  const GR = "#2e7d32";
  const BL = "#1976d2";
  const BR = "#6d4c41";
  switch (key) {
    case "WO":
      return `linear-gradient(90deg, #ffffff 0%, #ffffff 35%, ${OR} 35%, ${OR} 65%, #ffffff 65%, #ffffff 100%)`;
    case "O":
      return OR;
    case "WG":
      return `linear-gradient(90deg, #ffffff 0%, #ffffff 35%, ${GR} 35%, ${GR} 65%, #ffffff 65%, #ffffff 100%)`;
    case "B":
      return BL;
    case "WB":
      return `linear-gradient(90deg, #ffffff 0%, #ffffff 35%, ${BL} 35%, ${BL} 65%, #ffffff 65%, #ffffff 100%)`;
    case "G":
      return GR;
    case "WC":
      return `linear-gradient(90deg, #ffffff 0%, #ffffff 35%, ${BR} 35%, ${BR} 65%, #ffffff 65%, #ffffff 100%)`;
    case "C":
      return BR;
    default:
      return "#777";
  }
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DOM = {
  modeText: document.getElementById("modeText"),
  attemptText: document.getElementById("attemptText"),
  statusText: document.getElementById("statusText"),

  bundle: document.getElementById("bundle"),
  palette: document.getElementById("palette"),

  slots: document.getElementById("slots"),
  legend: document.getElementById("legend"),

  btnUntangle: document.getElementById("btnUntangle"),
  btnResetLearn: document.getElementById("btnResetLearn"),

  btnAttach: document.getElementById("btnAttach"),
  connectorHintText: document.getElementById("connectorHintText"),

  failBox: document.getElementById("failBox"),
  failReason: document.getElementById("failReason"),
  btnRetry: document.getElementById("btnRetry"),
  btnBackToLearn: document.getElementById("btnBackToLearn"),
  btnBackToLearnEval: document.getElementById("btnBackToLearnEval"),

  btnModeLearn: document.getElementById("btnModeLearn"),
  btnModeEvaluate: document.getElementById("btnModeEvaluate"),

  dragLayer: document.getElementById("dragLayer"),

  assemblyWires: document.getElementById("assemblyWires"),
  assemblyConnector: document.getElementById("assemblyConnector"),
};

let mode = "learn"; // learn | evaluate
let trainingCompleted = false; // whether user already passed the training for this “session”
let evaluateAttempt = 0;

let unscrambled = false;
let connectorAttached = false;
let failLocked = false;

let placed = Array(8).fill(null); // slotIndex -> wireKey | null
let wireOrder = []; // shuffled order for palette / bundle

const wireByKey = new Map(T568B.map((w) => [w.key, w]));

let dragging = null; // { wireKey, cloneEl }
let lastHintSlotIndex = -1;

function setStatus(text) {
  DOM.statusText.textContent = text;
}

function setMode(nextMode) {
  mode = nextMode;
  DOM.modeText.textContent = mode === "learn" ? "Режим обучения" : "Режим оценки";
  setStatus(mode === "learn" ? "Подсказки включены" : "Подсказки отключены");

  DOM.btnResetLearn.style.display = mode === "learn" ? "inline-flex" : "none";
  DOM.btnBackToLearnEval.hidden = mode !== "evaluate";
  DOM.btnBackToLearnEval.disabled = false;

  // Legend visibility
  DOM.legend.style.display = mode === "learn" ? "grid" : "none";

  // Connector hint text only in learning.
  DOM.connectorHintText.style.display = mode === "learn" ? "block" : "none";

  // Mode buttons active state
  DOM.btnModeLearn.classList.toggle("modeBtn--active", mode === "learn");
  DOM.btnModeEvaluate.classList.toggle("modeBtn--active", mode === "evaluate");

  // Evaluation mode lock (until training completed)
  DOM.btnModeEvaluate.disabled = !trainingCompleted;
}

function resetStateForMode(nextMode) {
  unscrambled = false;
  connectorAttached = false;
  failLocked = false;
  placed = Array(8).fill(null);
  wireOrder = shuffle(T568B.map((w) => w.key));
  lastHintSlotIndex = -1;

  DOM.failBox.hidden = true;
  DOM.btnAttach.disabled = true;

  // Коннектор: сброс анимации
  if (DOM.assemblyConnector) {
    DOM.assemblyConnector.classList.remove("assembly__connector--on");
    DOM.assemblyConnector.hidden = true;
  }

  render();
}

function renderLegend() {
  DOM.legend.innerHTML = "";
  for (const w of T568B) {
    const item = document.createElement("div");
    item.className = "legendItem";
    const num = document.createElement("div");
    num.className = "legendItem__num";
    num.textContent = w.targetPos;
    const bar = document.createElement("div");
    bar.className = "legendItem__bar";
    bar.style.backgroundImage = `url("${w.img}")`;
    bar.style.backgroundSize = "cover";
    bar.style.backgroundPosition = "center";
    const name = document.createElement("div");
    name.className = "legendItem__name";
    name.textContent = w.name;
    item.appendChild(num);
    item.appendChild(bar);
    item.appendChild(name);
    DOM.legend.appendChild(item);
  }
}

function renderSlots() {
  DOM.slots.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.slotIndex = String(i);

    const num = document.createElement("div");
    num.className = "slot__num";
    num.textContent = String(i + 1);
    slot.appendChild(num);

    if (placed[i] === null) {
      const empty = document.createElement("div");
      empty.className = "slot__empty";
      slot.appendChild(empty);
    } else {
      const filled = document.createElement("div");
      filled.className = "slot__filled";
      const pw = wireByKey.get(placed[i]);
      filled.style.backgroundImage = `url("${pw.img}")`;
      filled.style.backgroundSize = "cover";
      filled.style.backgroundPosition = "center";
      slot.appendChild(filled);
    }

    DOM.slots.appendChild(slot);
  }
}

function renderBundle() {
  // Before “untangle”, show a “tangled bundle” (not draggable).
  DOM.bundle.innerHTML = "";
  for (const wireKey of wireOrder) {
    const peg = document.createElement("div");
    peg.className = "bundle__peg";
    const w = wireByKey.get(wireKey);
    peg.style.backgroundImage = `url("${w.img}")`;
    peg.style.backgroundSize = "cover";
    peg.style.backgroundPosition = "center";
    DOM.bundle.appendChild(peg);
  }
}

function renderPalette() {
  DOM.palette.innerHTML = "";
  for (const wireKey of wireOrder) {
    if (placed.includes(wireKey)) continue;
    const w = wireByKey.get(wireKey);
    const el = document.createElement("div");
    el.className = "wire";
    el.dataset.wireKey = wireKey;
    el.style.backgroundImage = `url("${w.img}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";

    const label = document.createElement("div");
    label.className = "wire__label";
    label.textContent = mode === "learn" ? w.name : "Жила";
    if (w.name.length > 12) label.className = "wire__label wire__label--tiny";
    el.appendChild(label);

    // Pointer-based drag (works with touch better than HTML5 drag & drop)
    el.addEventListener("pointerdown", (e) => onWirePointerDown(e, wireKey, el));

    DOM.palette.appendChild(el);
  }
}

function clearAllSlotHints() {
  const slots = DOM.slots.querySelectorAll(".slot");
  for (const s of slots) {
    s.classList.remove("slot--hintCorrect");
    s.classList.remove("slot--error");
  }
}

function updateTrainingHintsHover(wireKey, slotIndex) {
  clearAllSlotHints();
  if (mode !== "learn") return;
  if (failLocked || connectorAttached) return;

  if (placed[slotIndex] !== null) return;
  const w = wireByKey.get(wireKey);
  if (w.targetPos === slotIndex + 1) {
    const slotEl = DOM.slots.querySelector(`[data-slot-index="${slotIndex}"]`);
    if (slotEl) slotEl.classList.add("slot--hintCorrect");
    lastHintSlotIndex = slotIndex;
  } else {
    // Do not show "wrong" hint in training — only show green when correct.
    lastHintSlotIndex = -1;
  }
}

function render() {
  // Header
  const attemptText = mode === "learn" ? "Попытка: —" : `Попытка: ${evaluateAttempt}`;
  DOM.attemptText.textContent = attemptText;

  DOM.btnUntangle.disabled = failLocked || connectorAttached;

  renderSlots();
  if (mode === "learn") {
    renderLegend();
  }
  if (!unscrambled) {
    DOM.palette.innerHTML = "";
    DOM.palette.style.display = "none";
    renderBundle();
  } else {
    DOM.bundle.innerHTML = "";
    DOM.palette.style.display = "flex";
    renderPalette();
  }

  renderAssemblyWires();
  if (connectorAttached) setAssemblyConnectorVisible(true);
  else setAssemblyConnectorVisible(false);

  const complete = placed.every((x) => x !== null);
  const allCorrect = isAllSlotsCorrect();

  // Learn: attach only when everything is correct.
  // Evaluate: attach enabled when all slots filled; validation happens on click.
  const attachLocked = failLocked || connectorAttached || !complete;
  DOM.btnAttach.disabled =
    mode === "learn" ? attachLocked || !allCorrect : attachLocked;
}

function isAllSlotsCorrect() {
  for (let i = 0; i < 8; i++) {
    if (placed[i] === null) return false;
    if (placed[i] !== T568B[i].key) return false;
  }
  return true;
}

function setAssemblyConnectorVisible(visible) {
  const el = DOM.assemblyConnector;
  if (!el) return;
  if (!visible) {
    el.classList.remove("assembly__connector--on");
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.classList.remove("assembly__connector--on");
  void el.offsetWidth;
  el.classList.add("assembly__connector--on");
}

/** Жилы из кабеля: PNG только если в позиции i стоит правильная жила для T568B. */
function renderAssemblyWires() {
  if (!DOM.assemblyWires) return;
  DOM.assemblyWires.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const col = document.createElement("div");
    col.className = "assemblyCol";
    col.dataset.slotIndex = String(i);

    const key = placed[i];
    const correct = key !== null && key === T568B[i].key;
    if (correct) {
      const img = document.createElement("img");
      img.className = "assemblyWireImg";
      img.src = wireByKey.get(key).img;
      img.alt = wireByKey.get(key).name;
      img.draggable = false;
      col.appendChild(img);
    } else {
      const ghost = document.createElement("div");
      ghost.className = "assemblyGhost";
      ghost.setAttribute("aria-hidden", "true");
      col.appendChild(ghost);
    }

    DOM.assemblyWires.appendChild(col);
  }
}

function tryPlaceWire(wireKey, slotIndex) {
  if (failLocked || connectorAttached) return;
  if (!unscrambled) return;

  if (placed[slotIndex] !== null) return;

  const w = wireByKey.get(wireKey);
  placed[slotIndex] = wireKey;

  const correct = w.targetPos === slotIndex + 1;
  if (mode === "learn" && !correct) {
    // Error feedback in training: do not place wrong wire.
    placed[slotIndex] = null;
    const slotEl = DOM.slots.querySelector(`[data-slot-index="${slotIndex}"]`);
    if (slotEl) {
      slotEl.classList.remove("slot--error");
      void slotEl.offsetWidth;
      slotEl.classList.add("slot--error");
    }
    setStatus("Неверно в этом месте. Попробуйте снова.");
    return;
  }

  // Training vs evaluate status message.
  setStatus(mode === "learn" ? "Отлично! Продолжаем." : "Жила установлена.");
  render();
}

function onWirePointerDown(e, wireKey, el) {
  if (failLocked || connectorAttached) return;
  if (!unscrambled) return;

  // If this wire is already placed somewhere, ignore.
  if (placed.includes(wireKey)) return;

  e.preventDefault();
  const rect = el.getBoundingClientRect();
  const startX = e.clientX;
  const startY = e.clientY;

  const clone = el.cloneNode(true);
  clone.classList.add("dragClone");
  // Override pointer events to keep drag uninterrupted.
  clone.style.pointerEvents = "none";

  DOM.dragLayer.appendChild(clone);

  dragging = { wireKey, clone, offsetX: startX - rect.left, offsetY: startY - rect.top };
  // Place clone immediately under the pointer.
  clone.style.left = `${startX - dragging.offsetX}px`;
  clone.style.top = `${startY - dragging.offsetY}px`;
  setStatus(mode === "learn" ? "Перетащите жилу в нужный номер." : "Перетащите жилу в нужный слот.");

  // Start tracking on window for smoother dragging.
  const move = (ev) => {
    if (!dragging) return;
    const x = ev.clientX - dragging.offsetX;
    const y = ev.clientY - dragging.offsetY;
    dragging.clone.style.left = `${x}px`;
    dragging.clone.style.top = `${y}px`;

    // Training hover hint: highlight the correct slot for the dragged wire.
    if (mode === "learn" && !failLocked && !connectorAttached) {
      const elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
      const slotEl = elUnder ? elUnder.closest(".slot") : null;
      if (slotEl) {
        const idx = Number(slotEl.dataset.slotIndex);
        updateTrainingHintsHover(wireKey, idx);
      } else {
        clearAllSlotHints();
      }
    }
  };

  const up = (ev) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);

    const cloneNow = dragging?.clone;
    const wireKeyNow = dragging?.wireKey;
    dragging = null;

    try {
      if (cloneNow && cloneNow.parentNode) cloneNow.parentNode.removeChild(cloneNow);

      const elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
      const slotEl = elUnder ? elUnder.closest(".slot") : null;
      if (!slotEl) {
        clearAllSlotHints();
        return;
      }
      const idx = Number(slotEl.dataset.slotIndex);
      tryPlaceWire(wireKeyNow, idx);
    } catch {
      // No-op: drag drop is best-effort.
    }
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function attachConnector() {
  if (failLocked) return;
  const complete = placed.every((x) => x !== null);
  if (!complete) return;

  if (mode === "learn") {
    if (!isAllSlotsCorrect()) {
      setStatus("Перед коннектором проверьте порядок жил.");
      return;
    }

    connectorAttached = true;
    DOM.btnAttach.disabled = true;
    DOM.btnUntangle.disabled = true;
    setAssemblyConnectorVisible(true);
    DOM.failBox.hidden = true;

    trainingCompleted = true;
    setStatus("Обучение пройдено. Можно перейти в режим “Оценка”.");
    DOM.btnModeEvaluate.disabled = false;
    return;
  }

  // Evaluate mode: validate on click.
  let correctCount = 0;
  for (let i = 0; i < 8; i++) {
    if (placed[i] === T568B[i].key) correctCount += 1;
  }
  const incorrectCount = 8 - correctCount;

  if (incorrectCount > 0) {
    failLocked = true;
    connectorAttached = false;
    DOM.btnUntangle.disabled = true;
    setAssemblyConnectorVisible(false);

    clearAllSlotHints();
    for (let i = 0; i < 8; i++) {
      if (placed[i] !== T568B[i].key) {
        const slotEl = DOM.slots.querySelector(`[data-slot-index="${i}"]`);
        if (slotEl) slotEl.classList.add("slot--error");
      }
    }

    DOM.failReason.textContent = `Неправильно расставлено: ${incorrectCount} жил(ы).`;
    DOM.failBox.hidden = false;
    setStatus("Ошибка — попытка не зачтена.");
    DOM.btnAttach.disabled = true;
    return;
  }

  connectorAttached = true;
  DOM.btnAttach.disabled = true;
  DOM.btnUntangle.disabled = true;
  setAssemblyConnectorVisible(true);
  DOM.failBox.hidden = true;
  setStatus("Оценка: зачтено!");
  DOM.btnBackToLearnEval.disabled = true;
  DOM.btnBackToLearnEval.hidden = true;
}

function untanglePairs() {
  if (failLocked || connectorAttached) return;
  unscrambled = true;
  setStatus(mode === "learn" ? "Распутано. Разложите жилы по T568B." : "Распутано. Разложите жилы без подсказок.");
  render();
}

function resetLearnAndStartOver() {
  trainingCompleted = false;
  setMode("learn");
  resetStateForMode("learn");
  setStatus("Обучение заново. Подсказки включены.");
}

function retryEvaluate() {
  evaluateAttempt += 1;
  failLocked = false;
  setStatus("Новая попытка оценки. Подсказки отключены.");
  resetStateForMode("evaluate");
}

function backToLearnFromFail() {
  // If the user “forgot”, they need to retrain fully.
  trainingCompleted = false;
  setMode("learn");
  resetStateForMode("learn");
  setStatus("Вернулись в обучение. Пройдите подсказки и затем снова перейдёте к оценке.");
}

function backToLearnFromEvaluate() {
  // User explicitly “forgot” and wants to retrain before continuing evaluation.
  trainingCompleted = false;
  setMode("learn");
  resetStateForMode("learn");
  setStatus("Вернулись в обучение. Пройдите подсказки и затем снова начнёте оценку.");
}

// Events
DOM.btnUntangle.addEventListener("click", untanglePairs);
DOM.btnResetLearn.addEventListener("click", resetLearnAndStartOver);
DOM.btnAttach.addEventListener("click", attachConnector);
DOM.btnRetry.addEventListener("click", retryEvaluate);
DOM.btnBackToLearn.addEventListener("click", backToLearnFromFail);
DOM.btnBackToLearnEval.addEventListener("click", backToLearnFromEvaluate);

DOM.btnModeLearn.addEventListener("click", () => {
  setMode("learn");
  resetStateForMode("learn");
  setStatus("Режим обучения. Подсказки включены. Нажмите “Распутать пары”.");
});

DOM.btnModeEvaluate.addEventListener("click", () => {
  if (!trainingCompleted) return;
  evaluateAttempt = 1;
  failLocked = false;
  connectorAttached = false;
  setMode("evaluate");
  resetStateForMode("evaluate");
  setStatus("Оценка: подсказки отключены. Нажмите “Распутать пары”.");
});

// Start
function init() {
  setMode("learn");
  resetStateForMode("learn");
  setStatus("Подсказки включены. Нажмите “Распутать пары”.");
  DOM.btnResetLearn.style.display = "inline-flex";
}

init();
