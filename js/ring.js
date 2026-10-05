/* Ring3D — a rotating 3D ring carousel.
 *
 * Items sit on a cylinder; the chosen item is always rotated to the front,
 * lifted towards the viewer and drawn on top. Works with arrow keys,
 * click, drag, mouse wheel and touch swipe, and rotates on its own after
 * a few idle seconds.
 *
 * Markup:
 *   <div class="ring" tabindex="0" role="listbox">
 *     <ul class="ring__stage"> <li class="ring__item" role="option">…</li> … </ul>
 *   </div>
 */
(function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const mod = (x, n) => ((x % n) + n) % n;
  // Signed distance on a circle of n items, in [-n/2, n/2).
  const wrap = (x, n) => mod(x + n / 2, n) - n / 2;

  class Ring3D {
    constructor(root, options = {}) {
      this.root = root;
      this.stage = root.querySelector('.ring__stage');
      this.opts = Object.assign({
        maxTheta: 40,          // max degrees between neighbours
        lift: 70,              // px the chosen item comes forward
        activeScale: 1.08,
        idleDelay: 6000,       // ms without interaction before auto-rotate
        autoInterval: 4500,    // ms between automatic steps
        firstAutoDelay: null,  // ms before the very first automatic step
        autoplay: true,
        dots: null,            // container for indicator dots
        prev: null, next: null,
        onChange: () => {},
        onActivate: () => {}
      }, options);

      this.current = 0;
      this.items = [];
      this.prevP = [];
      this.lastIndex = -1;
      this.hovered = false;
      this.inView = false;
      this.drag = null;
      this.wheelAcc = 0;
      this.lastWheel = 0;
      const first = this.opts.firstAutoDelay ?? this.opts.idleDelay;
      this.lastInteraction = performance.now() - (this.opts.idleDelay - first);
      this.lastAuto = 0;

      this._bind();
      this.refresh();
    }

    /* ---------- public API ---------- */

    get count() { return this.items.length; }
    get index() { return this.count ? mod(Math.round(this.current), this.count) : -1; }

    refresh(startIndex = 0) {
      this.items = Array.from(this.stage.querySelectorAll(':scope > .ring__item'));
      this.prevP = [];
      this.current = Math.max(0, Math.min(startIndex, this.count - 1));
      this.lastIndex = -1;
      this.items.forEach((el, i) => {
        el.dataset.index = i;
        el.querySelectorAll('img').forEach((img) => { img.draggable = false; });
      });
      this._buildDots();
      this.measure();
      this.render(true);
      this._emit({ auto: false, initial: true });
    }

    next(meta) { this._step(1, meta); }
    prev(meta) { this._step(-1, meta); }

    goTo(i, meta = {}) {
      if (!this.count) return;
      const d = wrap(i - this.current, this.count);
      this.current = Math.round(this.current + d);
      if (!meta.auto) this.interact();
      this.render();
      this._emit(meta);
    }

    interact() { this.lastInteraction = performance.now(); }

    measure() {
      const n = this.count;
      if (!n) { this.root.style.removeProperty('height'); return; }
      const w = this.items[0].offsetWidth || 260;
      this.theta = n > 1 ? Math.min(360 / n, this.opts.maxTheta) : 0;
      const half = (this.theta * Math.PI) / 360;
      this.radius = n > 1 ? (w * 1.06) / (2 * Math.sin(half)) : 0;
      this.step = w * 0.85; // drag distance for one item
      this.stage.style.transform = `translateZ(${-this.radius}px)`;
      const h = Math.max(...this.items.map((el) => el.offsetHeight));
      this.root.style.setProperty('--ring-item-h', `${h}px`);
    }

    render(instant = false) {
      const n = this.count;
      const active = this.index;
      const { lift, activeScale } = this.opts;
      this.root.classList.toggle('is-instant', instant);
      this.items.forEach((el, i) => {
        const p = n > 1 ? wrap(i - this.current, n) : 0;
        // When an item wraps from one side of the ring to the other it would
        // animate the long way through the front; teleport it instead.
        const jumped = this.prevP[i] !== undefined && Math.abs(p - this.prevP[i]) > n / 2;
        el.classList.toggle('no-anim', jumped);
        this.prevP[i] = p;

        const dist = Math.abs(p);
        const angle = p * this.theta;
        const absAngle = Math.abs(angle);
        const near = Math.max(0, 1 - dist); // 1 at the front, 0 one step away
        const z = this.radius + lift * near;
        const scale = 1 + (activeScale - 1) * near;
        const opacity = absAngle >= 105 ? 0 : Math.max(0, 1 - absAngle / 130);

        el.style.transform = `translateX(-50%) rotateY(${angle}deg) translateZ(${z}px) scale(${scale})`;
        el.style.opacity = opacity.toFixed(3);
        el.style.zIndex = String(1000 - Math.round(dist * 100));
        el.style.setProperty('--dist', dist.toFixed(3));
        el.style.pointerEvents = opacity < 0.05 ? 'none' : '';
        const isActive = i === active;
        el.classList.toggle('is-active', isActive);
        el.setAttribute('aria-selected', String(isActive));
        el.tabIndex = -1;
      });
      if (this.items[active]) this.root.setAttribute('aria-activedescendant', this.items[active].id);
      if (this.dots) {
        Array.from(this.dots.children).forEach((d, i) => d.setAttribute('aria-current', String(i === active)));
      }
      if (instant) requestAnimationFrame(() => this.root.classList.remove('is-instant'));
    }

    /* ---------- internals ---------- */

    _step(delta, meta = {}) {
      if (this.count < 2) return;
      this.current = Math.round(this.current) + delta;
      if (!meta.auto) this.interact();
      this.render();
      this._emit(meta);
    }

    _emit(meta = {}) {
      const i = this.index;
      if (i === this.lastIndex || i < 0) return;
      this.lastIndex = i;
      this.opts.onChange(i, this.items[i], meta);
    }

    _buildDots() {
      const box = this.opts.dots;
      this.dots = box;
      if (!box) return;
      box.innerHTML = '';
      this.items.forEach((el, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dot';
        b.setAttribute('aria-label', el.dataset.label || `${i + 1}`);
        b.addEventListener('click', () => this.goTo(i));
        box.appendChild(b);
      });
      box.hidden = this.count < 2;
    }

    _bind() {
      const r = this.root;

      r.addEventListener('keydown', (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        switch (e.key) {
          case 'ArrowRight': case 'ArrowDown': this.next(); break;
          case 'ArrowLeft': case 'ArrowUp': this.prev(); break;
          case 'Home': this.goTo(0); break;
          case 'End': this.goTo(this.count - 1); break;
          case 'Enter': case ' ': this.opts.onActivate(this.index, this.items[this.index]); break;
          default: return;
        }
        e.preventDefault();
      });

      // Pointer: click to choose, drag/swipe to spin.
      r.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !this.count) return;
        this.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, c0: this.current, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
        this.interact();
      });
      r.addEventListener('pointermove', (e) => {
        const d = this.drag;
        if (!d || e.pointerId !== d.id) return;
        const dx = e.clientX - d.x0;
        const dy = e.clientY - d.y0;
        if (!d.moved) {
          if (Math.abs(dx) < 8) return;
          if (Math.abs(dy) > Math.abs(dx)) { this.drag = null; return; } // vertical: let the page scroll
          d.moved = true;
          r.classList.add('is-dragging');
          try { r.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        }
        const dt = Math.max(1, e.timeStamp - d.lastT);
        d.v = 0.8 * ((e.clientX - d.lastX) / dt) + 0.2 * d.v;
        d.lastX = e.clientX; d.lastT = e.timeStamp;
        this.current = d.c0 - dx / this.step;
        this.render();
        this._emit({ drag: true });
      });
      const end = (e) => {
        const d = this.drag;
        if (!d || e.pointerId !== d.id) return;
        this.drag = null;
        r.classList.remove('is-dragging');
        if (d.moved) {
          const fling = Math.max(-3, Math.min(3, -(d.v * 180) / this.step));
          this.current = Math.round(this.current + fling);
          this.render();
          this._emit({});
          this._suppressClick = true;
          setTimeout(() => { this._suppressClick = false; }, 0);
        }
        this.interact();
      };
      r.addEventListener('pointerup', end);
      r.addEventListener('pointercancel', (e) => {
        if (this.drag && e.pointerId === this.drag.id) {
          this.drag = null;
          r.classList.remove('is-dragging');
          this.current = Math.round(this.current);
          this.render();
          this._emit({});
        }
      });

      r.addEventListener('click', (e) => {
        if (this._suppressClick) { e.preventDefault(); return; }
        const item = e.target.closest('.ring__item');
        if (!item || !r.contains(item)) return;
        const i = Number(item.dataset.index);
        if (i === this.index) this.opts.onActivate(i, item);
        else this.goTo(i);
      });

      // Wheel / trackpad scroll spins the ring.
      r.addEventListener('wheel', (e) => {
        if (this.count < 2) return;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (!delta) return;
        e.preventDefault();
        this.wheelAcc += delta;
        const now = performance.now();
        if (Math.abs(this.wheelAcc) >= 40 && now - this.lastWheel > 280) {
          this.lastWheel = now;
          this._step(this.wheelAcc > 0 ? 1 : -1);
          this.wheelAcc = 0;
        }
      }, { passive: false });

      r.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.hovered = true; });
      r.addEventListener('pointerleave', () => { this.hovered = false; });
      r.addEventListener('focusin', () => this.interact());

      if (this.opts.prev) this.opts.prev.addEventListener('click', () => this.prev());
      if (this.opts.next) this.opts.next.addEventListener('click', () => this.next());

      if ('ResizeObserver' in window) {
        let raf = 0;
        new ResizeObserver(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => { this.measure(); this.render(true); });
        }).observe(r);
      }
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => { this.inView = entry.isIntersecting; }, { threshold: 0.35 }).observe(r);
      } else {
        this.inView = true;
      }

      // Late-loading images/fonts change card heights.
      r.addEventListener('load', () => { this.measure(); this.render(); }, true);

      setInterval(() => this._tick(), 400);
    }

    _tick() {
      if (!this.opts.autoplay || reducedMotion.matches || this.count < 2) return;
      if (this.hovered || this.drag || document.hidden || !this.inView) return;
      if (this.root.contains(document.activeElement)) return;
      const now = performance.now();
      if (now - this.lastInteraction < this.opts.idleDelay) return;
      if (now - this.lastAuto < this.opts.autoInterval) return;
      this.lastAuto = now;
      this.next({ auto: true });
    }
  }

  window.Ring3D = Ring3D;
})();
