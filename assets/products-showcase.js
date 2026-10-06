(() => {
  const chapters = [...document.querySelectorAll('.product-chapter[id]')];
  const navLinks = [...document.querySelectorAll('.products-header__nav a[href^="#"]')];
  const introProducts = [...document.querySelectorAll('[data-intro-product]')];
  const root = document.documentElement;
  const page = document.body;
  const motionAllowed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wideProductLayout = window.matchMedia('(min-width: 960px) and (min-height: 620px)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (motionAllowed) root.classList.add('has-products-motion');

  if (motionAllowed && finePointer.matches) {
    let pointerFrame = 0;
    let pointerX = -300;
    let pointerY = -300;
    let pointerRgb = '242, 240, 234';
    const paintPointerGlow = () => {
      pointerFrame = 0;
      root.style.setProperty('--cursor-glow-x', `${pointerX}px`);
      root.style.setProperty('--cursor-glow-y', `${pointerY}px`);
      root.style.setProperty('--cursor-glow-rgb', pointerRgb);
      page.classList.add('has-pointer-glow');
    };
    document.addEventListener('pointermove', (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      const chapter = event.target instanceof Element ? event.target.closest('.product-chapter') : null;
      pointerRgb = chapter
        ? getComputedStyle(chapter).getPropertyValue('--chapter-rgb').trim() || '242, 240, 234'
        : '242, 240, 234';
      if (!pointerFrame) pointerFrame = window.requestAnimationFrame(paintPointerGlow);
    }, { passive: true });
    document.addEventListener('pointerleave', () => page.classList.remove('has-pointer-glow'));
    window.addEventListener('blur', () => page.classList.remove('has-pointer-glow'));
  }

  let frameRequested = false;
  const updateChapterVisuals = () => {
    const revealDistance = Math.max(320, Math.min(window.innerHeight * .64, 620));
    chapters.forEach((chapter) => {
      const rect = chapter.getBoundingClientRect();
      const rawProgress = wideProductLayout.matches
        ? motionAllowed
          ? Math.min(1, Math.max(0, -rect.top / revealDistance))
          : 0
        : 0;
      const progress = rawProgress * rawProgress * (3 - (2 * rawProgress));
      const expansionProgress = Math.min(1, progress / .88);
      const copyFadeRaw = Math.min(1, Math.max(0, (expansionProgress - .62) / .34));
      const copyFade = copyFadeRaw * copyFadeRaw * (3 - (2 * copyFadeRaw));
      const visualWidth = 96 + (4 * expansionProgress);
      const visualOffset = motionAllowed ? 45 * (1 - expansionProgress) : 0;
      const copyTravel = motionAllowed ? expansionProgress : 0;
      chapter.style.setProperty('--visual-width', `${visualWidth}%`);
      chapter.style.setProperty('--visual-offset', `${visualOffset.toFixed(3)}vw`);
      chapter.style.setProperty('--product-copy-shift-x', `${(-18 * copyTravel).toFixed(2)}px`);
      chapter.style.setProperty('--product-copy-shift-y', '0px');
      chapter.style.setProperty('--product-copy-opacity', `${(1 - copyFade).toFixed(4)}`);
      chapter.style.setProperty('--accent-focus-x', `${(82 - (32 * progress)).toFixed(3)}%`);
      chapter.classList.toggle('is-visual-expanded', expansionProgress >= 1);
    });
  };
  const updatePageMotion = () => {
    frameRequested = false;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    root.style.setProperty('--scroll-progress', Math.min(1, Math.max(0, window.scrollY / maxScroll)).toFixed(5));
    updateChapterVisuals();
    const probeY = window.innerHeight * 0.42;
    const activeChapter = chapters.find((chapter) => {
      const rect = chapter.getBoundingClientRect();
      return rect.top <= probeY && rect.bottom > probeY;
    });
    setCurrentChapter(activeChapter?.id || '');
  };
  const requestPageMotionUpdate = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(updatePageMotion);
  };
  updatePageMotion();
  window.addEventListener('scroll', requestPageMotionUpdate, { passive: true });
  window.addEventListener('resize', requestPageMotionUpdate, { passive: true });

  introProducts.forEach((item) => {
    item.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = document.querySelector(item.getAttribute('href') || '');
      if (!target) return;
      event.preventDefault();
      history.pushState(null, '', item.getAttribute('href'));
      target.scrollIntoView({ behavior: motionAllowed ? 'smooth' : 'auto', block: 'start' });
      setCurrentChapter(target.id || '');
    });
  });

  // Interactive product surfaces are external links. No cross-origin iframe runtime is mounted here.

  function setCurrentChapter(id) {
    const nextId = id || '';
    const changed = page.dataset.activeProduct !== nextId;
    page.dataset.activeProduct = nextId;
    let activeLink = null;
    navLinks.forEach((link) => {
      const active = link.getAttribute('href') === `#${nextId}`;
      if (active) {
        link.setAttribute('aria-current', 'true');
        activeLink = link;
      } else {
        link.removeAttribute('aria-current');
      }
    });
    if (!changed || !activeLink) return;
    const nav = activeLink.closest('.products-header__nav');
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    const navRect = nav.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    let nextScrollLeft = nav.scrollLeft;
    if (linkRect.left < navRect.left) nextScrollLeft += linkRect.left - navRect.left - 8;
    else if (linkRect.right > navRect.right) nextScrollLeft += linkRect.right - navRect.right + 8;
    if (Math.abs(nextScrollLeft - nav.scrollLeft) > 1) {
      nav.scrollTo({ left: Math.max(0, nextScrollLeft), behavior: motionAllowed ? 'smooth' : 'auto' });
    }
  }

  if ('IntersectionObserver' in window) {
    const chapterObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add('is-inview');
        }
      },
      { rootMargin: '8% 0px 8% 0px', threshold: 0.01 }
    );
    chapters.forEach((chapter) => chapterObserver.observe(chapter));
  } else {
    chapters.forEach((chapter) => chapter.classList.add('is-inview'));
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const id = link.getAttribute('href')?.slice(1);
      if (id) setCurrentChapter(id);
    });
  });

  const audioRoots = page.dataset.publicCatalog === 'true'
    ? []
    : [...document.querySelectorAll('[data-product-audio]')];
  let activeSampleAudio = null;
  let activeSampleRow = null;

  function formatSampleTime(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(value / 60);
    const secs = Math.floor(value % 60);
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  function drawSampleWave(canvas, waveform, progress = 0) {
    if (!canvas || !Array.isArray(waveform) || !waveform.length) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    const chapter = canvas.closest('.product-chapter');
    const rgb = getComputedStyle(chapter || document.documentElement).getPropertyValue('--chapter-rgb').trim() || '154, 143, 124';
    const middle = rect.height / 2;
    const usable = rect.height * .72;
    const count = waveform.length;
    const step = rect.width / Math.max(1, count - 1);
    const lineWidth = Math.max(.7, Math.min(1.8, step * .55));
    const paint = (limit, stroke, alphaScale = 1) => {
      context.beginPath();
      context.lineCap = 'round';
      context.lineWidth = lineWidth;
      context.strokeStyle = stroke;
      for (let index = 0; index < count; index += 1) {
        const x = index * step;
        if (x > limit + step) break;
        const amplitude = Math.max(.045, Math.min(1, Number(waveform[index]) || 0)) * usable * .5 * alphaScale;
        context.moveTo(x, middle - amplitude);
        context.lineTo(x, middle + amplitude);
      }
      context.stroke();
    };
    paint(rect.width, `rgba(${rgb}, .22)`);
    paint(rect.width * Math.max(0, Math.min(1, progress)), `rgba(${rgb}, .95)`, 1.02);
  }

  function mountSampleRow(sample, product) {
    const row = document.createElement('div');
    row.className = 'audio-sample';
    row.dataset.sampleId = sample.id;

    const index = document.createElement('span');
    index.className = 'audio-sample__index';
    index.textContent = String(sample.index || 0).padStart(2, '0');

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'audio-sample__play';
    play.textContent = '▶';
    play.setAttribute('aria-label', `Play ${sample.label}`);

    const copy = document.createElement('div');
    copy.className = 'audio-sample__copy';
    const name = document.createElement('strong');
    name.textContent = sample.label;
    const meta = document.createElement('span');
    meta.className = 'audio-sample__meta';
    meta.textContent = product.publicId === 'spettra' ? 'Processed reference · WAV' : 'Direct product render · WAV';
    copy.append(name, meta);

    const scrub = document.createElement('div');
    scrub.className = 'audio-sample__scrub';
    scrub.tabIndex = 0;
    scrub.setAttribute('role', 'slider');
    scrub.setAttribute('aria-label', `Scrub ${sample.label}`);
    scrub.setAttribute('aria-valuemin', '0');
    scrub.setAttribute('aria-valuemax', String(sample.duration || 0));
    scrub.setAttribute('aria-valuenow', '0');
    const canvas = document.createElement('canvas');
    canvas.className = 'audio-sample__wave';
    canvas.setAttribute('aria-hidden', 'true');
    scrub.append(canvas);

    const time = document.createElement('span');
    time.className = 'audio-sample__time';
    time.textContent = `0:00 / ${formatSampleTime(sample.duration)}`;

    const audio = document.createElement('audio');
    audio.preload = 'none';
    audio.hidden = true;
    row.append(index, play, copy, scrub, time, audio);

    let raf = 0;
    let scrubbing = false;
    let virtualTime = 0;
    let sourcePromise = null;
    const duration = () => Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(sample.duration) || 0;
    const currentTime = () => audio.readyState > 0 ? Number(audio.currentTime || 0) : virtualTime;
    const progress = () => duration() > 0 ? Math.max(0, Math.min(1, currentTime() / duration())) : 0;
    const ensureSource = () => {
      if (audio.src) return sourcePromise || Promise.resolve();
      sourcePromise = new Promise((resolve, reject) => {
        const cleanup = () => {
          audio.removeEventListener('loadedmetadata', ready);
          audio.removeEventListener('error', failed);
        };
        const ready = () => {
          cleanup();
          if (virtualTime > 0) audio.currentTime = Math.min(duration(), virtualTime);
          sync();
          resolve();
        };
        const failed = () => {
          cleanup();
          reject(audio.error || new Error(`Unable to load ${sample.label}`));
        };
        audio.addEventListener('loadedmetadata', ready, { once: true });
        audio.addEventListener('error', failed, { once: true });
        audio.src = sample.url;
        audio.load();
      });
      return sourcePromise;
    };
    const sync = () => {
      const d = duration();
      const t = currentTime();
      const p = progress();
      time.textContent = `${formatSampleTime(t)} / ${formatSampleTime(d)}`;
      scrub.setAttribute('aria-valuemax', String(d));
      scrub.setAttribute('aria-valuenow', String(Math.min(d, t).toFixed(2)));
      scrub.setAttribute('aria-valuetext', `${formatSampleTime(t)} of ${formatSampleTime(d)}`);
      drawSampleWave(canvas, sample.waveform, p);
    };
    const tick = () => {
      sync();
      if (!audio.paused && !audio.ended) raf = window.requestAnimationFrame(tick);
      else raf = 0;
    };
    const startTick = () => { if (!raf) raf = window.requestAnimationFrame(tick); };
    const setPlaying = (playing) => {
      row.classList.toggle('is-playing', playing);
      play.textContent = playing ? 'Ⅱ' : '▶';
      play.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${sample.label}`);
    };

    play.addEventListener('click', async () => {
      if (audio.src && !audio.paused) {
        audio.pause();
        return;
      }
      if (activeSampleAudio && activeSampleAudio !== audio) activeSampleAudio.pause();
      try {
        await ensureSource();
        if (audio.ended || audio.currentTime >= duration() - .02) {
          virtualTime = 0;
          audio.currentTime = 0;
        }
        await audio.play();
        activeSampleAudio = audio;
        activeSampleRow = row;
      } catch {
        setPlaying(false);
      }
    });
    audio.addEventListener('play', () => { setPlaying(true); startTick(); });
    audio.addEventListener('pause', () => {
      setPlaying(false);
      sync();
      if (activeSampleAudio === audio) { activeSampleAudio = null; activeSampleRow = null; }
    });
    audio.addEventListener('ended', () => { setPlaying(false); sync(); });
    audio.addEventListener('durationchange', sync);

    const setSeekTime = (seconds) => {
      const d = duration();
      virtualTime = Math.max(0, Math.min(d, Number(seconds) || 0));
      if (audio.readyState > 0) audio.currentTime = virtualTime;
      sync();
    };
    const seekFromPointer = (event) => {
      const rect = scrub.getBoundingClientRect();
      const d = duration();
      if (!d || !rect.width) return;
      const value = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      setSeekTime(value * d);
    };
    scrub.addEventListener('pointerdown', (event) => {
      scrubbing = true;
      scrub.setPointerCapture?.(event.pointerId);
      void ensureSource().catch(() => {});
      seekFromPointer(event);
    });
    scrub.addEventListener('pointermove', (event) => { if (scrubbing) seekFromPointer(event); });
    const endScrub = (event) => {
      if (!scrubbing) return;
      seekFromPointer(event);
      scrubbing = false;
      try { scrub.releasePointerCapture?.(event.pointerId); } catch {}
    };
    scrub.addEventListener('pointerup', endScrub);
    scrub.addEventListener('pointercancel', () => { scrubbing = false; });
    scrub.addEventListener('keydown', (event) => {
      const d = duration();
      if (!d) return;
      const delta = Math.max(.15, d * .05);
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        void ensureSource().catch(() => {});
        setSeekTime(currentTime() + (event.key === 'ArrowRight' ? delta : -delta));
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        void ensureSource().catch(() => {});
        setSeekTime(event.key === 'Home' ? 0 : Math.max(0, d - .01));
      }
    });

    const resize = new ResizeObserver(sync);
    resize.observe(canvas);
    window.requestAnimationFrame(sync);
    return row;
  }

  async function mountProductAudio() {
    if (!audioRoots.length) return;
    for (const rootNode of audioRoots) {
      rootNode.innerHTML = '<div class="product-audio__status">Loading sound examples…</div>';
    }
    try {
      const response = await fetch('/products-media/audio/manifest.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`audio manifest ${response.status}`);
      const manifest = await response.json();
      const byProduct = new Map((manifest.products || []).map(product => [product.publicId, product]));
      for (const rootNode of audioRoots) {
        const id = rootNode.dataset.productAudio;
        const product = byProduct.get(id);
        if (!product?.samples?.length) {
          rootNode.innerHTML = '<div class="product-audio__status">Sound examples unavailable.</div>';
          continue;
        }
        rootNode.replaceChildren();
        const head = document.createElement('div');
        head.className = 'product-audio__head';
        const eyebrow = document.createElement('p');
        eyebrow.className = 'product-audio__eyebrow';
        eyebrow.textContent = 'Sound examples · 05';
        const title = document.createElement('h3');
        title.textContent = 'Hear the instrument.';
        const note = document.createElement('p');
        note.textContent = id === 'spettra'
          ? 'Five current-engine renders through one controlled reference input. Click or drag any waveform to scrub.'
          : 'Five current-engine renders captured directly from the product runtime. Click or drag any waveform to scrub.';
        head.append(eyebrow, title, note);
        const list = document.createElement('div');
        list.className = 'product-audio__list';
        for (const sample of product.samples) list.append(mountSampleRow(sample, product));
        rootNode.append(head, list);
      }
    } catch (error) {
      for (const rootNode of audioRoots) {
        rootNode.innerHTML = '<div class="product-audio__status">Sound examples unavailable in this preview.</div>';
      }
      console.warn('Products audio manifest unavailable', error);
    }
  }
  void mountProductAudio();

  const store = window.TRAMBUSTISSIMO_STORE || {};
  const storeProducts = store.products || {};
  const cartKey = 'trambustissimo-desktop-cart-v1';
  const addButtons = [...document.querySelectorAll('[data-add-to-cart]')];
  const cartPanel = document.querySelector('#store-cart');
  const cartBackdrop = document.querySelector('[data-cart-backdrop]');
  const cartOpenButtons = [...document.querySelectorAll('[data-cart-open]')];
  const cartCloseButton = document.querySelector('[data-cart-close]');
  const cartItemsRoot = document.querySelector('[data-cart-items]');
  const cartEmpty = document.querySelector('[data-cart-empty]');
  const cartCount = document.querySelector('[data-cart-count]');
  const cartTotal = document.querySelector('[data-cart-total]');
  const checkoutButton = document.querySelector('[data-cart-checkout]');
  const cartStatus = document.querySelector('[data-cart-status]');
  const cartBackgroundRegions = [document.querySelector('.products-header'), document.querySelector('main'), document.querySelector('.products-footer')].filter(Boolean);
  const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  let cart = [];
  let paddleReady = false;
  let cartReturnFocus = null;
  if (cartPanel) cartPanel.inert = true;

  try {
    const saved = JSON.parse(localStorage.getItem(cartKey) || '[]');
    if (Array.isArray(saved)) cart = [...new Set(saved.map(String).filter((id) => storeProducts[id]))];
  } catch {}

  function saveCart() {
    try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch {}
  }

  function checkoutConfigured() {
    return Boolean(
      store.provider === 'paddle' &&
      store.clientToken &&
      cart.length &&
      cart.every((id) => storeProducts[id]?.paddlePriceId)
    );
  }

  function renderCart() {
    if (!cartItemsRoot) return;
    cartItemsRoot.replaceChildren();
    for (const id of cart) {
      const product = storeProducts[id];
      if (!product) continue;
      const row = document.createElement('article');
      row.className = 'store-cart__item';
      const name = document.createElement('strong');
      name.textContent = product.name;
      const price = document.createElement('b');
      price.className = 'store-cart__item-price';
      price.textContent = euro.format(Number(product.price || 0));
      const detail = document.createElement('span');
      detail.textContent = 'Desktop VST3 · Windows + macOS';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        cart = cart.filter((item) => item !== id);
        saveCart();
        renderCart();
      });
      row.append(name, price, detail, remove);
      cartItemsRoot.append(row);
    }

    const total = cart.reduce((sum, id) => sum + Number(storeProducts[id]?.price || 0), 0);
    if (cartCount) cartCount.textContent = String(cart.length);
    if (cartTotal) cartTotal.textContent = euro.format(total);
    if (cartEmpty) cartEmpty.hidden = cart.length > 0;
    for (const button of addButtons) {
      const inCart = cart.includes(String(button.dataset.productId || ''));
      button.dataset.inCart = inCart ? 'true' : 'false';
      button.textContent = inCart ? 'In cart · view cart' : 'Add to cart';
    }
    if (checkoutButton) checkoutButton.disabled = !checkoutConfigured();
    if (cartStatus) {
      cartStatus.textContent = checkoutConfigured()
        ? 'Secure Paddle checkout · taxes are calculated at checkout.'
        : cart.length
          ? 'Cart ready. Connect the Paddle Sandbox client token and six price IDs to test payment.'
          : 'Add one or more desktop licenses. Each purchase includes both Windows and macOS.';
    }
  }

  function cartFocusableElements() {
    if (!cartPanel) return [];
    return [...cartPanel.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
  }

  function openCart() {
    if (!cartPanel) return;
    cartReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (activeSampleAudio && !activeSampleAudio.paused) activeSampleAudio.pause();
    cartPanel.inert = false;
    cartPanel.classList.add('is-open');
    cartPanel.setAttribute('aria-hidden', 'false');
    if (cartBackdrop) cartBackdrop.hidden = false;
    document.body.classList.add('is-cart-open');
    cartBackgroundRegions.forEach((region) => { region.inert = true; });
    cartOpenButtons.forEach((button) => button.setAttribute('aria-expanded', 'true'));
    cartCloseButton?.focus({ preventScroll: true });
  }

  function closeCart({ restoreFocus = true } = {}) {
    if (!cartPanel) return;
    cartPanel.classList.remove('is-open');
    cartPanel.inert = true;
    if (cartBackdrop) cartBackdrop.hidden = true;
    document.body.classList.remove('is-cart-open');
    cartBackgroundRegions.forEach((region) => { region.inert = false; });
    cartOpenButtons.forEach((button) => button.setAttribute('aria-expanded', 'false'));
    if (restoreFocus && cartReturnFocus?.isConnected) cartReturnFocus.focus({ preventScroll: true });
    cartPanel.setAttribute('aria-hidden', 'true');
    cartReturnFocus = null;
  }

  for (const button of addButtons) {
    button.addEventListener('click', () => {
      const id = String(button.dataset.productId || '');
      if (!storeProducts[id]) return;
      if (!cart.includes(id)) {
        cart.push(id);
        saveCart();
        renderCart();
      }
      openCart();
    });
  }
  cartOpenButtons.forEach((button) => button.addEventListener('click', openCart));
  cartCloseButton?.addEventListener('click', closeCart);
  cartBackdrop?.addEventListener('click', closeCart);
  document.addEventListener('keydown', (event) => {
    if (!cartPanel?.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCart();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = cartFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      cartPanel.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  function loadPaddleScript() {
    if (window.Paddle) return Promise.resolve(window.Paddle);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-paddle-store]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Paddle), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      script.async = true;
      script.dataset.paddleStore = 'true';
      script.addEventListener('load', () => resolve(window.Paddle), { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.append(script);
    });
  }

  async function beginCheckout() {
    if (!checkoutConfigured() || !checkoutButton) return;
    checkoutButton.disabled = true;
    if (cartStatus) cartStatus.textContent = 'Opening secure checkout…';
    try {
      const Paddle = await loadPaddleScript();
      if (!Paddle) throw new Error('Paddle.js unavailable');
      if (!paddleReady) {
        if (store.environment === 'sandbox') Paddle.Environment.set('sandbox');
        Paddle.Initialize({ token: store.clientToken });
        paddleReady = true;
      }
      Paddle.Checkout.open({
        items: cart.map((id) => ({ priceId: storeProducts[id].paddlePriceId, quantity: 1 })),
      });
      if (cartStatus) cartStatus.textContent = 'Paddle checkout opened. Windows + macOS are included in each selected license.';
    } catch (error) {
      if (cartStatus) cartStatus.textContent = `Checkout unavailable: ${String(error?.message || error)}`;
    } finally {
      checkoutButton.disabled = !checkoutConfigured();
    }
  }

  checkoutButton?.addEventListener('click', beginCheckout);
  renderCart();
})();
