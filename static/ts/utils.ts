


type Theme       = "light" | "dark";
type SoundType   = "error" | "default";
type ToastTipo   = "info" | "success" | "error" | "warning" | "favorito" | "bienvenida";

interface ToastPublicaOpts {
  mensaje:   string;
  titulo?:   string;
  imagen?:   string;
  tipo?:     ToastTipo;
  duracion?: number;
  idUnico?:  string | null;
  sonido?:   boolean;
}


declare function getLang(): string;


interface WindowWithAudio extends Window {
  AudioContext?:       typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}
declare const window: WindowWithAudio;


const _notifIdSet = new Set<string>();


function _getAudioContextClass(): typeof AudioContext | undefined {
  return window.AudioContext ?? window.webkitAudioContext;
}

function _playNotifSound(type: SoundType = "default"): void {
  try {
    const AudioCtxClass = _getAudioContextClass();
    if (!AudioCtxClass) return;

    const ctx  = new AudioCtxClass();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "error") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
  } catch {
    
  }
}


function mostrarAlerta(mensaje: string, esError = false, duracionMs = 4000): void {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.style.cssText =
      "position:fixed;top:25px;right:25px;z-index:10000;display:flex;" +
      "flex-direction:column;gap:10px;pointer-events:none;max-width:420px;" +
      "width:calc(100vw - 40px);";
    document.body.appendChild(container);
  }

  _playNotifSound(esError ? "error" : "default");

  const isDark       = document.documentElement.getAttribute("data-theme") === "dark";
  const color        = esError ? "#ff4757" : "#2ed573";
  const bgSurface    = isDark ? "#1e1e1e" : "#ffffff";
  const textMain     = isDark ? "#e8e8e8" : "#1a1a1a";
  const textMuted    = isDark ? "#888"    : "#747d8c";
  const shadow       = isDark
    ? "0 12px 36px rgba(0,0,0,0.5)"
    : `0 10px 30px ${esError ? "rgba(255,71,87,0.18)" : "rgba(46,213,115,0.18)"}`;

  const toast = document.createElement("div");
  toast.style.cssText = [
    `background:${bgSurface}`,
    `color:${textMain}`,
    "padding:14px 18px",
    "border-radius:16px",
    `box-shadow:${shadow}`,
    "display:flex",
    "align-items:center",
    "gap:14px",
    `border-left:5px solid ${color}`,
    "pointer-events:auto",
    "transition:transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.35s ease",
    "transform:translateX(110%)",
    "opacity:0",
    "overflow:hidden",
    "position:relative",
  ].join(";");

  toast.innerHTML = `
    <div style="width:38px;height:38px;min-width:38px;border-radius:50%;background:${color};
                display:flex;align-items:center;justify-content:center;flex-shrink:0;
                box-shadow:0 0 0 5px ${color}22;">
      <i class="bi ${esError ? "bi-x-lg" : "bi-check-lg"}"
         style="color:#fff;font-size:1rem;font-weight:900;line-height:1;
                display:flex;align-items:center;justify-content:center;width:100%;height:100%;"></i>
    </div>
    <div style="flex:1;min-width:0;">
      <strong style="display:block;font-size:0.7rem;text-transform:uppercase;
                     letter-spacing:0.6px;color:${textMuted};margin-bottom:2px;">
        ${esError ? "Error" : "Sistema"}
      </strong>
      <span style="font-size:0.9rem;font-weight:600;line-height:1.3;word-break:break-word;">
        ${mensaje}
      </span>
    </div>
    <button class="btn-close-toast"
            style="background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;
                   color:${textMuted};font-size:0.8rem;flex-shrink:0;line-height:1;
                   transition:background 0.15s, color 0.15s;"
            onmouseenter="this.style.background='${color}22';this.style.color='${color}'"
            onmouseleave="this.style.background='none';this.style.color='${textMuted}'">
      <i class="bi bi-x-lg"></i>
    </button>`;

  container.appendChild(toast);

  
  requestAnimationFrame(() => requestAnimationFrame(() => {
    toast.style.transform = "translateX(0)";
    toast.style.opacity   = "1";
  }));

  const eliminar = (): void => {
    toast.style.transform = "translateX(110%)";
    toast.style.opacity   = "0";
    setTimeout(() => toast.remove(), 400);
  };
  (toast.querySelector(".btn-close-toast") as HTMLElement).onclick = eliminar;
  setTimeout(eliminar, duracionMs);
}


function mostrarAlertaPublica({
  mensaje,
  titulo    = "",
  imagen    = "/static/uploads/logo.png",
  tipo      = "info",
  duracion  = 4000,
  idUnico   = null,
  sonido    = true,
}: ToastPublicaOpts): void {
  if (idUnico && _notifIdSet.has(idUnico)) return;
  if (idUnico) {
    _notifIdSet.add(idUnico);
    setTimeout(() => _notifIdSet.delete(idUnico!), duracion + 1000);
  }

  let cont = document.getElementById("toastContainer");
  if (!cont) {
    cont = document.createElement("div");
    cont.id = "toastContainer";
    document.body.appendChild(cont);
  }
  cont.style.cssText =
    "position:fixed;top:72px;left:16px;z-index:10000;" +
    "display:flex;flex-direction:column;gap:8px;" +
    "max-width:340px;width:calc(100vw - 32px);pointer-events:none;";

  if (sonido) _playNotifSound(tipo === "error" || tipo === "warning" ? "error" : "default");

  const esError     = tipo === "error" || tipo === "warning";
  const isDark      = document.documentElement.getAttribute("data-theme") === "dark";
  const accentColor = esError ? "#e53935"
    : tipo === "favorito"    ? "#e91e8c"
    : tipo === "bienvenida"  ? "#27ae60"
    : tipo === "success"     ? "#27ae60"
    : "#d35400";
  const iconClass   = esError              ? "bi-exclamation-triangle-fill"
    : tipo === "favorito"    ? "bi-heart-fill"
    : tipo === "bienvenida"  ? "bi-emoji-smile-fill"
    : tipo === "success"     ? "bi-check-circle-fill"
    : "bi-megaphone-fill";
  const tituloFinal = titulo || (esError ? "Aviso" : "D'Antojitos");
  const bgToast     = isDark ? "rgba(22,22,26,0.97)" : "rgba(255,255,255,0.97)";
  const textMain    = isDark ? "#f0f0f0" : "#1a1a1a";
  const textSub     = isDark ? "#999"    : "#555";
  const borderImg   = isDark ? "#333"    : "#eee";

  const toast = document.createElement("div");
  toast.style.cssText = [
    `background:${bgToast}`,
    "padding:11px 14px",
    "border-radius:14px",
    "box-shadow:0 6px 24px rgba(0,0,0,0.13),0 1px 6px rgba(0,0,0,0.07)",
    "display:flex",
    "align-items:center",
    "gap:11px",
    `border-left:3px solid ${accentColor}`,
    "backdrop-filter:blur(20px)",
    "-webkit-backdrop-filter:blur(20px)",
    "transition:transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.28s ease",
    "transform:translateX(-110%)",
    "opacity:0",
    "pointer-events:auto",
    "cursor:default",
    "min-width:0",
    "width:100%",
    "box-sizing:border-box",
  ].join(";");

  toast.innerHTML = `
    <div style="position:relative;flex-shrink:0;">
      <img src="${imagen}"
           style="width:40px;height:40px;object-fit:cover;border-radius:9px;
                  border:1.5px solid ${borderImg};display:block;"
           onerror="this.src='/static/uploads/logo.png'">
      <div style="position:absolute;bottom:-3px;right:-3px;background:${accentColor};
                  width:16px;height:16px;border-radius:50%;display:flex;align-items:center;
                  justify-content:center;border:2px solid ${isDark ? "#16161a" : "#fff"};">
        <i class="bi ${iconClass}" style="color:#fff;font-size:0.5rem;line-height:1;"></i>
      </div>
    </div>
    <div style="flex:1;min-width:0;overflow:hidden;">
      <strong style="display:block;font-size:0.65rem;text-transform:uppercase;
                     color:${accentColor};letter-spacing:0.7px;font-weight:800;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${tituloFinal}
      </strong>
      <div style="font-size:0.8rem;font-weight:400;color:${textSub};line-height:1.3;
                  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${mensaje}
      </div>
    </div>
    <button class="btn-close-toast"
            style="background:none;border:none;color:${textSub};cursor:pointer;
                   padding:2px 4px;font-size:0.75rem;flex-shrink:0;line-height:1;
                   opacity:0.6;transition:opacity 0.15s;">
      <i class="bi bi-x-lg"></i>
    </button>`;

  cont.appendChild(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    toast.style.transform = "translateX(0)";
    toast.style.opacity   = "1";
  }));

  const remove = (): void => {
    toast.style.transform = "translateX(-110%)";
    toast.style.opacity   = "0";
    setTimeout(() => toast.remove(), 380);
  };
  const closeBtn = toast.querySelector<HTMLElement>(".btn-close-toast")!;
  closeBtn.onmouseenter = () => { closeBtn.style.opacity = "1"; };
  closeBtn.onmouseleave = () => { closeBtn.style.opacity = "0.6"; };
  closeBtn.onclick = remove;
  setTimeout(remove, duracion);
}


function mostrarConfirmacionApp(
  titulo: string,
  mensaje: string,
  onConfirm: () => void
): void {
  document.getElementById("appModalConfirm")?.remove();

  const isDark   = document.documentElement.getAttribute("data-theme") === "dark";
  const bgCard   = isDark ? "#1a1a1a" : "#ffffff";
  const textH    = isDark ? "#e8e8e8" : "#1a1a1a";
  const textBody = isDark ? "#aaa"    : "#555";
  const borderC  = isDark ? "#2a2a2a" : "#f1f2f6";

  const overlay = document.createElement("div");
  overlay.id = "appModalConfirm";
  overlay.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;" +
    "background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;" +
    "z-index:20000;backdrop-filter:blur(6px);transition:opacity 0.3s ease;";

  const modal = document.createElement("div");
  modal.style.cssText = [
    `background:${bgCard}`,
    "width:95%",
    "max-width:400px",
    "padding:36px 32px",
    "border-radius:24px",
    "text-align:center",
    "box-shadow:0 28px 60px rgba(0,0,0,0.35)",
    "transform:scale(0.8) translateY(20px)",
    "transition:transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275),opacity 0.3s",
    "opacity:0",
  ].join(";");

  modal.innerHTML = `
    <div style="width:68px;height:68px;border-radius:50%;
                background:linear-gradient(135deg,#ff4757,#c0392b);
                display:flex;align-items:center;justify-content:center;
                margin:0 auto 20px;
                box-shadow:0 0 0 8px rgba(255,71,87,0.12),0 8px 24px rgba(255,71,87,0.3);">
      <i class="bi bi-exclamation-lg"
         style="color:#fff;font-size:2rem;font-weight:900;line-height:1;"></i>
    </div>
    <h3 style="margin-bottom:10px;font-weight:800;color:${textH};
               font-size:1.25rem;letter-spacing:-0.3px;">${titulo}</h3>
    <p style="color:${textBody};margin-bottom:28px;line-height:1.6;font-size:0.95rem;">
      ${mensaje}
    </p>
    <div style="display:flex;gap:10px;justify-content:center;">
      <button id="btnCancelModal"
              style="flex:1;padding:12px 20px;border-radius:14px;font-weight:700;
                     font-size:0.9rem;background:transparent;border:2px solid ${borderC};
                     color:${textBody};cursor:pointer;transition:all 0.2s;">
        Cancelar
      </button>
      <button id="btnConfirmModal"
              style="flex:1;padding:12px 20px;border-radius:14px;font-weight:700;
                     font-size:0.9rem;background:linear-gradient(135deg,#ff4757,#c0392b);
                     border:none;color:#fff;cursor:pointer;
                     box-shadow:0 6px 18px rgba(255,71,87,0.3);transition:all 0.2s;">
        Confirmar
      </button>
    </div>`;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    modal.style.transform = "scale(1) translateY(0)";
    modal.style.opacity   = "1";
  }));

  const btnCancel  = modal.querySelector<HTMLButtonElement>("#btnCancelModal")!;
  const btnConfirm = modal.querySelector<HTMLButtonElement>("#btnConfirmModal")!;

  btnCancel.onmouseenter  = () => { btnCancel.style.background  = isDark ? "#252525" : "#f1f2f6"; };
  btnCancel.onmouseleave  = () => { btnCancel.style.background  = "transparent"; };
  btnConfirm.onmouseenter = () => { btnConfirm.style.filter = "brightness(1.1)"; btnConfirm.style.transform = "translateY(-1px)"; };
  btnConfirm.onmouseleave = () => { btnConfirm.style.filter = ""; btnConfirm.style.transform = ""; };

  const cerrar = (): void => {
    modal.style.transform = "scale(0.85) translateY(10px)";
    modal.style.opacity   = "0";
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 320);
  };

  btnCancel.onclick  = cerrar;
  btnConfirm.onclick = () => { onConfirm(); cerrar(); };
  overlay.onclick    = (e: MouseEvent) => { if (e.target === overlay) cerrar(); };
}


function initScrollToTop(): void {
  const btn = document.getElementById("scrollToTopBtn");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    btn.classList.toggle("show", window.scrollY > 300);
  }, { passive: true });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}


function initScrollProgressBar(): void {
  const bar = document.getElementById("scrollProgressBar");
  if (!bar) return;
  const update = (): void => {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height    = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const pct       = height > 0 ? Math.min((winScroll / height) * 100, 100) : 0;
    bar.style.width = `${pct}%`;
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}


function solicitarPermisosNotificacion(): void {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") return;
  if (localStorage.getItem("dantojitos_notif_asked")) return;
  Notification.requestPermission().then(() => {
    localStorage.setItem("dantojitos_notif_asked", "1");
  });
}

function lanzarNotificacionNativa(
  titulo: string,
  cuerpo: string,
  icono = "/static/uploads/logo.png"
): void {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(titulo, { body: cuerpo, icon: icono });
  } catch {
    console.warn("Notificación nativa no disponible");
  }
}


function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("dantojitos_theme", theme);

  const lang = (typeof getLang === "function") ? getLang() : "es";

  
  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    const icon = btn.querySelector<HTMLElement>("i");
    if (icon) icon.className = theme === "dark" ? "bi bi-sun-fill me-2" : "bi bi-moon-fill me-2";
    const label = btn.querySelector<HTMLElement>('[data-i18n="nav.theme"]');
    if (label) {
      label.textContent = theme === "dark"
        ? (lang === "en" ? "Light Mode" : "Modo Claro")
        : (lang === "en" ? "Dark Mode"  : "Modo Oscuro");
    }
  }

  
  const navIcon  = document.getElementById("navThemeIcon");
  const navLabel = document.getElementById("navThemeLabel");
  if (navIcon)  navIcon.className    = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-fill";
  if (navLabel) navLabel.textContent = theme === "dark"
    ? (lang === "en" ? "Light" : "Claro")
    : (lang === "en" ? "Dark"  : "Oscuro");
}

function toggleTheme(): void {
  const current = (document.documentElement.getAttribute("data-theme") ?? "light") as Theme;
  setTheme(current === "dark" ? "light" : "dark");
}


const _TICKER_SPEED_KEY = "_dantojitos_ticker_speed";

function getTickerSpeed(): number {
  return parseFloat(localStorage.getItem(_TICKER_SPEED_KEY) ?? "1");
}

function saveTickerSpeed(v: number): void {
  localStorage.setItem(_TICKER_SPEED_KEY, String(v));
}

function setTickerSpeed(speed: number): void {
  saveTickerSpeed(speed);

  const selectors: Array<[string, number]> = [
    [".promo-track",   25],
    [".ci-track",      25],
    [".payment-track", 25],
  ];
  selectors.forEach(([sel, base]) => {
    document.querySelectorAll<HTMLElement>(sel).forEach(track => {
      const b = parseFloat(track.dataset.baseDuration ?? String(base));
      track.style.animationDuration = `${(b / speed).toFixed(1)}s`;
    });
  });

  document.querySelectorAll<HTMLElement>(".ticker-speed-btn").forEach(btn => {
    btn.classList.toggle("active", parseFloat(btn.dataset.speed ?? "0") === speed);
  });
}


function _animateBadge(badgeEl: HTMLElement | null): void {
  if (!badgeEl) return;
  badgeEl.style.transition = "none";
  badgeEl.style.transform  = "scale(1.7)";
  badgeEl.style.background = "#e74c3c";
  setTimeout(() => {
    badgeEl.style.transition = "transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275)";
    badgeEl.style.transform  = "scale(1)";
  }, 80);
}


document.addEventListener("DOMContentLoaded", () => {
  initScrollToTop();
  initScrollProgressBar();
  solicitarPermisosNotificacion();
  setTheme((localStorage.getItem("dantojitos_theme") as Theme | null) ?? "light");

  
  const savedSpeed = getTickerSpeed();
  if (savedSpeed !== 1) {
    [".payment-track", ".promo-track", ".ci-track"].forEach(sel => {
      document.querySelectorAll<HTMLElement>(sel).forEach(track => {
        const base = parseFloat(track.dataset.baseDuration ?? "25");
        track.style.animationDuration = `${(base / savedSpeed).toFixed(1)}s`;
      });
    });
  }
});
