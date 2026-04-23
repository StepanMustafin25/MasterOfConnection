/** PNG жилы (появляются из кабеля только при правильной установке в позицию). */
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

/** Иконки цветов (для подсказок, слотов и перетаскиваемых элементов). */
const ICON_IMAGE = {
  WO: "./orange-white-icon.png",
  O: "./orange-icon.png",
  WG: "./green-white-icon.png",
  B: "./blue-icon.png",
  WB: "./blue-white-icon.png",
  G: "./green-icon.png",
  WC: "./brown-white-icon.png",
  C: "./brown-icon.png",
};

/** Запутанные пары (клик — распутать в две жилы). */
const TANGLED_PAIR = [
  { id: "OR", img: "./orange-white-zaputann.png", out: ["WO", "O"] },
  { id: "GR", img: "./green-white-zaputann.png", out: ["WG", "G"] },
  { id: "BL", img: "./blue-white-zaputann.png", out: ["WB", "B"] },
  { id: "BR", img: "./brown-white-zaputann.png", out: ["WC", "C"] },
];

const T568B = [
  { key: "WO", name: "Бело-оранжевый", targetPos: 1, css: wireCss("WO"), img: WIRE_IMAGE.WO, icon: ICON_IMAGE.WO },
  { key: "O", name: "Оранжевый", targetPos: 2, css: wireCss("O"), img: WIRE_IMAGE.O, icon: ICON_IMAGE.O },
  { key: "WG", name: "Бело-зелёный", targetPos: 3, css: wireCss("WG"), img: WIRE_IMAGE.WG, icon: ICON_IMAGE.WG },
  { key: "B", name: "Синий", targetPos: 4, css: wireCss("B"), img: WIRE_IMAGE.B, icon: ICON_IMAGE.B },
  { key: "WB", name: "Бело-синий", targetPos: 5, css: wireCss("WB"), img: WIRE_IMAGE.WB, icon: ICON_IMAGE.WB },
  { key: "G", name: "Зелёный", targetPos: 6, css: wireCss("G"), img: WIRE_IMAGE.G, icon: ICON_IMAGE.G },
  { key: "WC", name: "Бело-коричневый", targetPos: 7, css: wireCss("WC"), img: WIRE_IMAGE.WC, icon: ICON_IMAGE.WC },
  { key: "C", name: "Коричневый", targetPos: 8, css: wireCss("C"), img: WIRE_IMAGE.C, icon: ICON_IMAGE.C },
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
  attemptValue: document.getElementById("attemptValue"),
  statusText: document.getElementById("statusText"),

  bundle: document.getElementById("bundle"),
  palette: document.getElementById("palette"),

  slots: document.getElementById("slots"),
  legend: document.getElementById("legend"),

  btnResetLearn: document.getElementById("btnResetLearn"),

  btnAttach: document.getElementById("btnAttach"),
  connectorHintText: document.getElementById("connectorHintText"),

  failBox: document.getElementById("failBox"),
  failReason: document.getElementById("failReason"),
  btnRetry: document.getElementById("btnRetry"),
  btnBackToLearn: document.getElementById("btnBackToLearn"),

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
let wireOrder = []; // order of wires shown in palette (filled after untangling)

// Stage: first untangle 4 pairs, then arrange 8 wires.
let stage = "tangle"; // tangle | arrange
let tangledSlots = Array(8).fill(null); // slotIndex -> tangledPairId | null
let availableWireKeys = []; // keys available to drag after untangling

const wireByKey = new Map(T568B.map((w) => [w.key, w]));
const tangledById = new Map(TANGLED_PAIR.map((p) => [p.id, p]));

let dragging = null; // { wireKey, cloneEl }
let lastHintSlotIndex = -1;

function setStatus(text) {
  DOM.statusText.textContent = text;
}

function setMode(nextMode) {
  mode = nextMode;
  DOM.modeText.textContent = mode === "learn" ? "Режим обучения" : "Режим оценки";
  setStatus(mode === "learn" ? "Подсказки включены" : "Подсказки отключены");

  DOM.btnResetLearn.style.display = "inline-flex";

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
  wireOrder = [];
  lastHintSlotIndex = -1;
  stage = "tangle";
  availableWireKeys = [];
  tangledSlots = initRandomTangledSlots();

  DOM.failBox.hidden = true;
  DOM.btnAttach.disabled = true;

  if (DOM.assemblyConnector) {
    DOM.assemblyConnector.classList.remove("assembly__connector--on");
    DOM.assemblyConnector.hidden = true;
  }

  render();
}

function initRandomTangledSlots() {
  const slots = Array(8).fill(null);
  const pos = shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 4);
  const pairIds = shuffle(TANGLED_PAIR.map((p) => p.id));
  for (let i = 0; i < 4; i++) {
    slots[pos[i]] = pairIds[i];
  }
  return slots;
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
    bar.style.backgroundImage = `url("${w.icon}")`;
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
      filled.style.backgroundImage = `url("${pw.icon}")`;
      filled.style.backgroundSize = "cover";
      filled.style.backgroundPosition = "center";
      slot.appendChild(filled);
    }

    DOM.slots.appendChild(slot);
  }
}

function renderBundle() {
  DOM.bundle.innerHTML = "";
}

function renderPalette() {
  DOM.palette.innerHTML = "";
  for (const wireKey of wireOrder) {
    if (placed.includes(wireKey)) continue;
    const w = wireByKey.get(wireKey);
    const el = document.createElement("div");
    el.className = "wire";
    el.dataset.wireKey = wireKey;
    el.style.backgroundImage = `url("${w.icon}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";

    const label = document.createElement("div");
    label.className = "wire__label";
    label.textContent = mode === "learn" ? w.name : "Жила";
    if (w.name.length > 12) label.className = "wire__label wire__label--tiny";
    el.appendChild(label);

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
    lastHintSlotIndex = -1;
  }
}

function render() {
  if (DOM.attemptValue) {
    DOM.attemptValue.textContent = mode === "learn" ? "—" : String(evaluateAttempt);
  }

  renderSlots();
  if (mode === "learn") {
    renderLegend();
  }
  DOM.bundle.innerHTML = "";
  DOM.palette.style.display = "grid";
  DOM.palette.classList.add("palette--grid");
  renderPalette();

  renderAssemblyWires();
  if (connectorAttached) setAssemblyConnectorVisible(true);
  else setAssemblyConnectorVisible(false);

  const complete = placed.every((x) => x !== null);
  const allCorrect = isAllSlotsCorrect();


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

function renderAssemblyWires() {
  if (!DOM.assemblyWires) return;
  DOM.assemblyWires.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const col = document.createElement("div");
    col.className = "assemblyCol";
    col.dataset.slotIndex = String(i);

    if (stage === "tangle" && tangledSlots[i] !== null) {
      const pair = tangledById.get(tangledSlots[i]);
      const img = document.createElement("img");
      img.className = "assemblyWireImg";
      img.src = pair.img;
      img.alt = "Запутанная пара жил";
      img.draggable = false;
      img.style.cursor = "pointer";
      img.addEventListener("click", () => untanglePairAt(i));
      col.appendChild(img);
      DOM.assemblyWires.appendChild(col);
      continue;
    }

    const key = placed[i];
    if (key !== null) {
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

function untanglePairAt(slotIndex) {
  if (stage !== "tangle") return;
  const pairId = tangledSlots[slotIndex];
  if (!pairId) return;

  const pair = tangledById.get(pairId);
  tangledSlots[slotIndex] = null;

  // Add both wires to available list (shuffle after each untangle for randomness).
  availableWireKeys.push(pair.out[0], pair.out[1]);
  wireOrder = shuffle(availableWireKeys);

  setStatus("Пара распутана. Распутайте остальные.");

  const remaining = tangledSlots.filter(Boolean).length;
  if (remaining === 0) {
    stage = "arrange";
    unscrambled = true;
    setStatus("Пары распутаны. Теперь расставьте жилы в нужном порядке.");
  }

  render();
}

function tryPlaceWire(wireKey, slotIndex) {
  if (failLocked || connectorAttached) return;
  if (stage !== "arrange") return;
  if (!unscrambled) return;

  if (placed[slotIndex] !== null) return;

  const w = wireByKey.get(wireKey);
  placed[slotIndex] = wireKey;

  const correct = w.targetPos === slotIndex + 1;
  if (mode === "learn" && !correct) {
    const slotEl = DOM.slots.querySelector(`[data-slot-index="${slotIndex}"]`);
    if (slotEl) {
      slotEl.classList.remove("slot--error");
      void slotEl.offsetWidth;
      slotEl.classList.add("slot--error");
    }
    setStatus("Жила вставлена. Похоже, место неверное - проверьте порядок.");
  } else {
    setStatus(mode === "learn" ? "Верно. Продолжаем." : "Жила установлена.");
  }

  render();
}

function onWirePointerDown(e, wireKey, el) {
  if (failLocked || connectorAttached) return;
  if (stage !== "arrange") return;
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
    setStatus("Ошибка - попытка не зачтена.");
    DOM.btnAttach.disabled = true;
    return;
  }

  connectorAttached = true;
  DOM.btnAttach.disabled = true;
  setAssemblyConnectorVisible(true);
  DOM.failBox.hidden = true;
  setStatus("Оценка: зачтено!");
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

// Events
DOM.btnResetLearn.addEventListener("click", resetLearnAndStartOver);
DOM.btnAttach.addEventListener("click", attachConnector);
DOM.btnRetry.addEventListener("click", retryEvaluate);
DOM.btnBackToLearn.addEventListener("click", backToLearnFromFail);
DOM.btnModeLearn.addEventListener("click", () => {
  setMode("learn");
  resetStateForMode("learn");
  setStatus("Режим обучения. Подсказки включены. Сначала распутайте 4 пары (клик по запутанным).");
});

DOM.btnModeEvaluate.addEventListener("click", () => {
  if (!trainingCompleted) return;
  evaluateAttempt = 1;
  failLocked = false;
  connectorAttached = false;
  setMode("evaluate");
  resetStateForMode("evaluate");
  setStatus("Оценка: подсказки отключены. Сначала распутайте 4 пары (клик по запутанным).");
});

// Start
function init() {
  setMode("learn");
  resetStateForMode("learn");
  setStatus("Задача: распутайте 4 пары жил (кликните по каждой запутанной паре над кабелем).");
  DOM.btnResetLearn.style.display = "inline-flex";
}

init();

