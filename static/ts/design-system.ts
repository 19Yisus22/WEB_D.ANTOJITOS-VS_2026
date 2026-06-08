type EasingName = "spring" | "smooth" | "bounce" | "swift";

interface RevealOptions {
    threshold?: number;
    rootMargin?: string;
    delay?: number;
    once?: boolean;
}

interface CounterOptions {
    duration?: number;
    easing?: EasingName;
    prefix?: string;
    suffix?: string;
    decimals?: number;
}

interface RippleOptions {
    color?: string;
    duration?: number;
}

const EASINGS: Record<EasingName, (t: number) => number> = {
    spring: (t) => 1 - Math.pow(2, -10 * t) * Math.cos((t * Math.PI * 2) / 0.3),
    smooth: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    bounce: (t) => {
        if (t < 1 / 2.75) return 7.5625 * t * t;
        if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
        if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
        t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
    },
    swift: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
};

export class ScrollReveal {
    private observer: IntersectionObserver;
    private opts: Required<RevealOptions>;

    constructor(selector: string = "[data-reveal]", opts: RevealOptions = {}) {
        this.opts = {
            threshold:  opts.threshold  ?? 0.12,
            rootMargin: opts.rootMargin ?? "0px 0px -40px 0px",
            delay:      opts.delay      ?? 0,
            once:       opts.once       ?? true,
        };

        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const el      = entry.target as HTMLElement;
                        const delay   = parseInt(el.dataset.revealDelay ?? "0", 10) || this.opts.delay;
                        const already = el.dataset.revealed;
                        if (already && this.opts.once) return;
                        setTimeout(() => {
                            el.classList.add("ds-revealed");
                            el.dataset.revealed = "1";
                        }, delay);
                        if (this.opts.once) this.observer.unobserve(el);
                    } else if (!this.opts.once) {
                        (entry.target as HTMLElement).classList.remove("ds-revealed");
                    }
                });
            },
            { threshold: this.opts.threshold, rootMargin: this.opts.rootMargin }
        );

        document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
            this.observer.observe(el);
        });
    }

    observe(el: HTMLElement): void { this.observer.observe(el); }
    disconnect(): void { this.observer.disconnect(); }
}

export class SmoothCounter {
    static animate(
        el: HTMLElement,
        target: number,
        opts: CounterOptions = {}
    ): void {
        const dur      = opts.duration ?? 1200;
        const easing   = EASINGS[opts.easing ?? "smooth"];
        const prefix   = opts.prefix  ?? "";
        const suffix   = opts.suffix  ?? "";
        const decimals = opts.decimals ?? 0;
        const start    = performance.now();
        const from     = parseFloat(el.textContent?.replace(/[^0-9.-]/g, "") ?? "0") || 0;

        const step = (now: number): void => {
            const elapsed  = Math.min((now - start) / dur, 1);
            const progress = easing(elapsed);
            const value    = from + (target - from) * progress;
            el.textContent = prefix + value.toFixed(decimals) + suffix;
            if (elapsed < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    static initAll(selector: string = "[data-counter]"): void {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el     = entry.target as HTMLElement;
                const target = parseFloat(el.dataset.counter ?? "0");
                if (isNaN(target)) return;
                SmoothCounter.animate(el, target, {
                    duration: parseInt(el.dataset.counterDur ?? "1200", 10),
                    decimals: parseInt(el.dataset.counterDec ?? "0",    10),
                    prefix:   el.dataset.counterPrefix ?? "",
                    suffix:   el.dataset.counterSuffix ?? "",
                });
                observer.unobserve(el);
            });
        }, { threshold: 0.5 });

        document.querySelectorAll<HTMLElement>(selector).forEach((el) => observer.observe(el));
    }
}

export class RippleEffect {
    static init(selector: string = ".ds-ripple"): void {
        document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
            RippleEffect.attach(el);
        });
    }

    static attach(el: HTMLElement, opts: RippleOptions = {}): void {
        const color    = opts.color    ?? "rgba(255,255,255,0.35)";
        const duration = opts.duration ?? 500;

        el.addEventListener("pointerdown", (e: PointerEvent) => {
            const rect   = el.getBoundingClientRect();
            const x      = e.clientX - rect.left;
            const y      = e.clientY - rect.top;
            const size   = Math.max(rect.width, rect.height) * 2;

            const ripple = document.createElement("span");
            ripple.style.cssText = [
                `width:${size}px`, `height:${size}px`,
                `left:${x - size / 2}px`, `top:${y - size / 2}px`,
                `background:${color}`,
                "position:absolute", "border-radius:50%",
                "pointer-events:none", "transform:scale(0)",
                `animation:_dsRipple ${duration}ms cubic-bezier(0.22,1,0.36,1) forwards`,
            ].join(";");

            const prevPos = getComputedStyle(el).position;
            if (prevPos === "static") el.style.position = "relative";
            el.style.overflow = "hidden";
            el.appendChild(ripple);
            setTimeout(() => ripple.remove(), duration + 50);
        });
    }
}

export class LazyMedia {
    private observer: IntersectionObserver;

    constructor() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const el = entry.target;
                    if (el instanceof HTMLImageElement && el.dataset.src) {
                        el.src = el.dataset.src;
                        el.removeAttribute("data-src");
                        el.addEventListener("load", () => el.classList.add("ds-loaded"), { once: true });
                    }
                    if (el instanceof HTMLVideoElement && el.dataset.src) {
                        el.src = el.dataset.src;
                        el.removeAttribute("data-src");
                    }
                    this.observer.unobserve(el);
                });
            },
            { rootMargin: "200px" }
        );
    }

    init(selector: string = "[data-src]"): void {
        document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
            this.observer.observe(el);
        });
    }
}

export class SkeletonLoader {
    static show(container: HTMLElement): void {
        container.querySelectorAll<HTMLElement>("[data-skeleton]").forEach((el) => {
            el.classList.add("ds-skeleton");
        });
    }

    static hide(container: HTMLElement): void {
        container.querySelectorAll<HTMLElement>("[data-skeleton]").forEach((el) => {
            el.classList.remove("ds-skeleton");
        });
    }

    static create(count: number, template: string): DocumentFragment {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const wrapper = document.createElement("div");
            wrapper.innerHTML = template;
            wrapper.querySelectorAll<HTMLElement>("*").forEach((el) => el.classList.add("ds-skeleton"));
            frag.appendChild(wrapper);
        }
        return frag;
    }
}

export class PageTransition {
    private overlay: HTMLElement;

    constructor() {
        this.overlay = document.createElement("div");
        this.overlay.className = "ds-page-overlay";
        this.overlay.style.cssText =
            "position:fixed;inset:0;background:var(--ds-primary,#d35400);z-index:99999;" +
            "transform:translateX(-100%);transition:transform 0.35s cubic-bezier(0.22,1,0.36,1);" +
            "pointer-events:none;";
        document.body.appendChild(this.overlay);
    }

    navigate(url: string): void {
        this.overlay.style.transform = "translateX(0)";
        setTimeout(() => { window.location.href = url; }, 340);
    }

    init(selector: string = "a[data-transition]"): void {
        document.querySelectorAll<HTMLAnchorElement>(selector).forEach((a) => {
            a.addEventListener("click", (e) => {
                const href = a.href;
                if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
                e.preventDefault();
                this.navigate(href);
            });
        });
    }
}

export class FormFeedback {
    static init(formSelector: string = "form[data-validate]"): void {
        document.querySelectorAll<HTMLFormElement>(formSelector).forEach((form) => {
            form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
                "input, textarea, select"
            ).forEach((field) => {
                field.addEventListener("blur", () => FormFeedback.validateField(field));
                field.addEventListener("input", () => {
                    if (field.classList.contains("ds-invalid")) FormFeedback.validateField(field);
                });
            });
        });
    }

    static validateField(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
        const valid = field.checkValidity();
        field.classList.toggle("ds-valid",   valid);
        field.classList.toggle("ds-invalid", !valid);
        return valid;
    }

    static shake(el: HTMLElement): void {
        el.style.animation = "none";
        el.offsetWidth;
        el.style.animation = "_dsShake 0.4s cubic-bezier(0.36,0.07,0.19,0.97)";
        setTimeout(() => { el.style.animation = ""; }, 450);
    }
}

export class TouchSwipe {
    private startX = 0;
    private startY = 0;
    private threshold: number;

    constructor(
        private el: HTMLElement,
        private onSwipe: (dir: "left" | "right" | "up" | "down") => void,
        threshold = 40
    ) {
        this.threshold = threshold;
        el.addEventListener("touchstart", this.onStart.bind(this), { passive: true });
        el.addEventListener("touchend",   this.onEnd.bind(this),   { passive: true });
    }

    private onStart(e: TouchEvent): void {
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
    }

    private onEnd(e: TouchEvent): void {
        const dx = e.changedTouches[0].clientX - this.startX;
        const dy = e.changedTouches[0].clientY - this.startY;
        if (Math.abs(dx) < this.threshold && Math.abs(dy) < this.threshold) return;
        if (Math.abs(dx) >= Math.abs(dy)) {
            this.onSwipe(dx < 0 ? "left" : "right");
        } else {
            this.onSwipe(dy < 0 ? "up" : "down");
        }
    }
}

function _injectKeyframes(): void {
    if (document.getElementById("_ds-keyframes")) return;
    const style = document.createElement("style");
    style.id    = "_ds-keyframes";
    style.textContent = `
@keyframes _dsRipple {
    to { transform: scale(1); opacity: 0; }
}
@keyframes _dsShake {
    10%,90% { transform: translateX(-2px); }
    20%,80% { transform: translateX(4px);  }
    30%,50%,70% { transform: translateX(-6px); }
    40%,60% { transform: translateX(6px);  }
}
@keyframes _dsFadeUp {
    from { opacity:0; transform: translateY(24px); }
    to   { opacity:1; transform: translateY(0);    }
}
@keyframes _dsFadeIn {
    from { opacity:0; }
    to   { opacity:1; }
}
@keyframes _dsScale {
    from { opacity:0; transform: scale(0.92); }
    to   { opacity:1; transform: scale(1);    }
}
@keyframes _dsSlideRight {
    from { opacity:0; transform: translateX(-28px); }
    to   { opacity:1; transform: translateX(0);     }
}
@keyframes _dsSlideLeft {
    from { opacity:0; transform: translateX(28px);  }
    to   { opacity:1; transform: translateX(0);     }
}
@keyframes _dsPulse {
    0%,100% { opacity:1; }
    50%     { opacity:0.4; }
}
@keyframes _dsSkeleton {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
}
`;
    document.head.appendChild(style);
}

function initDesignSystem(): void {
    _injectKeyframes();
    new ScrollReveal();
    SmoothCounter.initAll();
    RippleEffect.init();
    new LazyMedia().init();
    FormFeedback.init();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDesignSystem);
} else {
    initDesignSystem();
}

declare global {
    interface Window {
        DS: {
            ScrollReveal: typeof ScrollReveal;
            SmoothCounter: typeof SmoothCounter;
            RippleEffect:  typeof RippleEffect;
            LazyMedia:     typeof LazyMedia;
            SkeletonLoader: typeof SkeletonLoader;
            PageTransition: typeof PageTransition;
            FormFeedback:   typeof FormFeedback;
            TouchSwipe:     typeof TouchSwipe;
        };
    }
}

window.DS = {
    ScrollReveal,
    SmoothCounter,
    RippleEffect,
    LazyMedia,
    SkeletonLoader,
    PageTransition,
    FormFeedback,
    TouchSwipe,
};
