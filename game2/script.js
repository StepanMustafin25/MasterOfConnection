const CORRECT_CORD_ID = "sc-upc_sc-apc"; // правильный ответ (пока используется только в "Проверить")

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

let isPlacementLocked = false;

function updateFrameScale() {
  const frameW = 1280;
  const frameH = 800;
  const padding = 48; // 24px left + 24px right (same for top/bottom)
  const availW = Math.max(320, window.innerWidth - padding);
  const availH = Math.max(320, window.innerHeight - padding);
  const scale = Math.min(1, availW / frameW, availH / frameH);
  document.documentElement.style.setProperty("--frame-scale", String(scale));
}

function getFrameScale() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--frame-scale").trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function isPointInsideRect(p, rect) {
  return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
}

function setStatus(text) {
  const out = document.querySelector(".status");
  if (!out) return;
  out.textContent = text || "";
}

function makeGhostFromCord(cordEl) {
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  const img = cordEl.querySelector("img")?.cloneNode(true);
  if (img) ghost.appendChild(img);
  document.body.appendChild(ghost);
  return ghost;
}

function positionGhost(ghost, x, y) {
  // offset* не зависят от transform и стабильнее на первом кадре, чем getBoundingClientRect
  void ghost.offsetWidth;
  const w = ghost.offsetWidth || 220;
  const h = ghost.offsetHeight || 160;
  const gx = x - w / 2;
  const gy = y - h / 2;
  ghost.style.transform = `translate(${gx}px, ${gy}px)`;
}

function getDropzones() {
  return Array.from(document.querySelectorAll(".dropzone"));
}

function findHotZone(point) {
  const zones = getDropzones();
  for (const z of zones) {
    const rect = z.getBoundingClientRect();
    if (isPointInsideRect(point, rect)) return z;
  }
  return null;
}

function clearHotZones() {
  for (const z of getDropzones()) z.classList.remove("is-hot");
}

function markHotZone(zone) {
  clearHotZones();
  if (zone) zone.classList.add("is-hot");
}

function resetAll() {
  isPlacementLocked = false;
  // вернуть все патч-корды в исходное положение
  const cords = Array.from(document.querySelectorAll(".cord"));
  for (const cord of cords) {
    cord.classList.remove("is-placed");
    cord.hidden = false;
    cord.style.pointerEvents = "";
    cord.style.visibility = "";
  }

  // убрать размещённые "копии" из зон
  for (const zone of getDropzones()) {
    zone.querySelector(".placement-slot")?.remove();
    zone.querySelectorAll(".placed-cord").forEach((n) => n.remove());
  }
  document.querySelector(".wall__placed")?.querySelectorAll(".placed-cord").forEach((n) => n.remove());

  setStatus("Добро пожаловать! Перетащите нужный патч‑корд на стену справа (в пунктирную зону).");
}

function setupButtons() {
  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      if (action === "reset") {
        resetAll();
        return;
      }

      if (action === "check") {
        const placed = Array.from(document.querySelectorAll("[data-placed-cord-id]"));
        if (placed.length === 0) {
          setStatus("Пока ничего не подключено — перетащите патч‑корд в пунктирную зону на стене.");
          return;
        }
        const hasCorrect = placed.some((n) => n.getAttribute("data-placed-cord-id") === CORRECT_CORD_ID);
        setStatus(
          hasCorrect
            ? "Похоже, выбран правильный патч‑корд."
            : "Выбран другой патч‑корд (сообщение об ошибке проработаем позже).",
        );
      }
    });
  });
}

function placeCordIntoZone(cordEl, zone, _clientPoint) {
  const cordId = cordEl.getAttribute("data-cord-id");
  if (!cordId) return;

  const placedLayer = document.querySelector(".wall__placed");
  if (!placedLayer) return;
  placedLayer.querySelectorAll(".placed-cord").forEach((n) => n.remove());

  const zoneRect = zone.getBoundingClientRect();
  const wallRect = placedLayer.getBoundingClientRect();
  // Центр зоны в координатах стены (layout px): client-разницы делим на масштаб фрейма
  const s = getFrameScale();
  const cx = (zoneRect.left - wallRect.left + zoneRect.width / 2) / s;
  const cy = (zoneRect.top - wallRect.top + zoneRect.height / 2) / s;

  const placed = document.createElement("div");
  placed.className = "placed-cord";
  placed.setAttribute("data-placed-cord-id", cordId);
  placed.style.left = `${cx}px`;
  placed.style.top = `${cy}px`;

  const img = cordEl.querySelector("img")?.cloneNode(true);
  if (img) placed.appendChild(img);
  placedLayer.appendChild(placed);

  // Патч-корд "исчезает" со стола, чтобы было ощущение, что его взяли
  cordEl.classList.add("is-placed");
  cordEl.hidden = true;
  cordEl.style.pointerEvents = "none";
  cordEl.style.visibility = "hidden";
  isPlacementLocked = true;
}

function setupDragAndDrop() {
  const cords = Array.from(document.querySelectorAll(".cord"));
  if (cords.length === 0) return;

  let activeCord = null;
  let ghost = null;
  let pointerId = null;
  let shouldRestoreOnCancel = false;

  const onMove = (ev) => {
    if (!activeCord || !ghost) return;
    if (pointerId !== null && ev.pointerId !== pointerId) return;

    positionGhost(ghost, ev.clientX, ev.clientY);
    const hot = findHotZone({ x: ev.clientX, y: ev.clientY });
    markHotZone(hot);
  };

  const cleanup = () => {
    document.body.classList.remove("is-dragging");
    clearHotZones();
    if (ghost) ghost.remove();
    ghost = null;
    if (activeCord && shouldRestoreOnCancel) {
      activeCord.hidden = false;
      activeCord.style.visibility = "";
      activeCord.style.pointerEvents = "";
    }
    activeCord = null;
    pointerId = null;
    shouldRestoreOnCancel = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onUp, true);
  };

  const onUp = (ev) => {
    if (!activeCord) return;
    if (pointerId !== null && ev.pointerId !== pointerId) return;

    const hot = findHotZone({ x: ev.clientX, y: ev.clientY });
    if (hot) {
      placeCordIntoZone(activeCord, hot, { x: ev.clientX, y: ev.clientY });
      shouldRestoreOnCancel = false;
      setStatus("Патч‑корд размещён. Нажмите «Проверка» или «Сброс».");
    } else {
      shouldRestoreOnCancel = true;
      setStatus("Не попали в зону — перетащите патч‑корд в пунктирную область на стене справа.");
    }
    cleanup();
  };

  cords.forEach((cord) => {
    cord.addEventListener("pointerdown", (ev) => {
      if (isPlacementLocked) {
        setStatus("Провод уже подключён. Нажмите «Сброс», чтобы выбрать другой.");
        return;
      }
      if (cord.classList.contains("is-placed")) return;
      if (ev.button !== 0) return; // только ЛКМ

      ev.preventDefault();
      activeCord = cord;
      shouldRestoreOnCancel = true;
      pointerId = ev.pointerId;
      cord.setPointerCapture(pointerId);

      document.body.classList.add("is-dragging");
      ghost = makeGhostFromCord(cord);
      positionGhost(ghost, ev.clientX, ev.clientY);

      // во время перетаскивания исчезает со стола
      cord.hidden = true;
      cord.style.visibility = "hidden";
      cord.style.pointerEvents = "none";

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("pointercancel", onUp, true);
      setStatus("Перетащите патч‑корд в пунктирную зону на стене справа.");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupButtons();
  setupDragAndDrop();
  resetAll();
  updateFrameScale();
  window.addEventListener("resize", updateFrameScale);
});