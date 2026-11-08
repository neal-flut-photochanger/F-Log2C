(() => {
    const CATEGORIES = ['vivid', 'soft', 'cinema', 'mono', 'neutral'];

    const dom = {
        body: document.body,
        ambientCanvas: document.getElementById('ambient-canvas'),
        newPhotoBtn: document.getElementById('new-photo-btn'),
        langSwitch: document.querySelector('.lang-switch'),
        welcome: document.getElementById('welcome'),
        heroBtn: document.querySelector('.hero-btn'),
        fileInput: document.getElementById('file-input'),
        studio: document.getElementById('studio'),
        stage: document.getElementById('stage'),
        canvasWrap: document.getElementById('canvas-wrap'),
        glCanvas: document.getElementById('gl-canvas'),
        paneLabel: document.getElementById('pane-label'),
        paneCat: document.getElementById('pane-cat'),
        paneName: document.getElementById('pane-name'),
        paneProgress: document.getElementById('pane-progress'),
        swipeHint: document.getElementById('swipe-hint'),
        compareBadge: document.getElementById('compare-badge'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        pageDots: document.getElementById('page-dots'),
        inspector: document.getElementById('inspector'),
        resetBtn: document.getElementById('reset-btn'),
        sourceSwitch: document.querySelector('.source-switch'),
        intensitySlider: document.getElementById('intensity-slider'),
        intensityValue: document.getElementById('intensity-value'),
        contrastSlider: document.getElementById('contrast-slider'),
        contrastValue: document.getElementById('contrast-value'),
        saturationSlider: document.getElementById('saturation-slider'),
        saturationValue: document.getElementById('saturation-value'),
        styleBtn: document.getElementById('style-btn'),
        styleChip: document.getElementById('style-chip'),
        styleName: document.getElementById('style-name'),
        adjustBtn: document.getElementById('adjust-btn'),
        compareBtn: document.getElementById('compare-btn'),
        downloadBtn: document.getElementById('download-btn'),
        menuScrim: document.getElementById('menu-scrim'),
        styleMenu: document.getElementById('style-menu'),
        menuClose: document.getElementById('menu-close'),
        catTabs: document.getElementById('cat-tabs'),
        styleList: document.getElementById('style-list'),
        menuOriginal: document.getElementById('menu-original'),
        dropVeil: document.getElementById('drop-veil'),
        toast: document.getElementById('toast')
    };

    const state = {
        items: [],
        categories: [...CATEGORIES],
        activeCategory: 'vivid',
        currentIndex: 0,
        targetIndex: 0,
        hasPhoto: false,
        previewSource: null,
        previewWidth: 0,
        previewHeight: 0,
        fullSource: null,
        fullWidth: 0,
        fullHeight: 0,
        fileName: 'photo',
        swipeSeen: false,
        menuOpen: false,
        inspectorOpenMobile: false,
        inspectorCollapsedDesktop: false,
        dragging: false,
        dragAxisLocked: false,
        dragStartX: 0,
        dragStartY: 0,
        dragStartTime: 0,
        dragSide: 0,
        dragProgress: 0,
        animFrame: 0,
        shimmerFrame: 0,
        labelTimer: 0,
        toastTimer: 0,
        wheelLockUntil: 0
    };

    let renderer = null;
    let store = null;
    const thumbCanvases = new Map();

    async function init() {
        i18n.init();
        setupLanguageSwitch();
        setupSourceSwitch();
        setupSliders();

        try {
            renderer = new LutRenderer(dom.glCanvas);
            store = new LutStore(renderer, 'luts/');
        } catch (err) {
            console.error(err);
            showToast(i18n.t('errorWebgl'), 5000);
            return;
        }

        await loadLutConfig();
        buildPageDots();
        buildCategoryTabs();
        renderStyleMenuList();
        updateStyleIndicators();
        setupEventListeners();
        syncInspectorButtonState();

        store.onProgress((id, progress) => handleLutProgress(id, progress));
        i18n.onChange(() => {
            syncSegmentedThumb(dom.langSwitch);
            syncSegmentedThumb(dom.sourceSwitch);
            buildCategoryTabs();
            renderStyleMenuList();
            updateStyleIndicators();
        });
    }

    async function loadLutConfig() {
        let luts = [];
        try {
            const res = await fetch('luts/luts-config.json', { cache: 'no-cache' });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json.luts)) luts = json.luts;
            }
        } catch (err) {
            console.warn('Failed to fetch luts-config.json:', err);
        }

        const discoveredCats = new Set(CATEGORIES);
        luts.forEach((item) => {
            if (!item.category) item.category = 'other';
            discoveredCats.add(item.category);
        });
        state.categories = Array.from(discoveredCats).filter((cat) =>
            luts.some((item) => item.category === cat)
        );
        if (state.categories.length === 0) state.categories = ['vivid'];
        state.activeCategory = state.categories[0];

        state.items = [
            {
                id: '__original__',
                isOriginal: true,
                category: 'original',
                name_zh: '原图',
                name_en: 'Original',
                description_zh: '还没有盖上胶片',
                description_en: 'No film applied yet'
            },
            ...luts
        ];
    }

    function wrapIndex(index) {
        const total = state.items.length;
        if (total <= 1) return 0;
        return ((index % total) + total) % total;
    }

    function getItem(index) {
        return state.items[wrapIndex(index)] || state.items[0];
    }

    function getItemName(item) {
        if (!item || item.isOriginal) return i18n.t('original');
        return i18n.pick(item, 'name');
    }

    function getItemCategoryLabel(item) {
        if (!item || item.isOriginal) return i18n.t('filmStyle');
        return i18n.t(`cat_${item.category}`);
    }

    function getLutTexture(index) {
        const item = getItem(index);
        if (!item || item.isOriginal) return null;
        return store.get(item.id);
    }

    function isIndexLoading(index) {
        const item = getItem(index);
        if (!item || item.isOriginal) return false;
        return !store.get(item.id) && store.isLoading(item.id);
    }

    function ensureIndexLoaded(index, priority = false) {
        const item = getItem(index);
        if (!item || item.isOriginal) return Promise.resolve(null);
        return store.load(item, priority).catch((err) => {
            console.warn('LUT load failed:', item.id, err);
            showToast(i18n.t('errorLut'));
            return null;
        });
    }

    function preloadNeighbors(centerIndex) {
        if (state.items.length <= 1) return;
        const nextIdx = wrapIndex(centerIndex + 1);
        const prevIdx = wrapIndex(centerIndex - 1);
        ensureIndexLoaded(nextIdx, false);
        ensureIndexLoaded(prevIdx, false);
    }

    function preloadCategory(category) {
        state.items.forEach((item, idx) => {
            if (!item.isOriginal && item.category === category) {
                ensureIndexLoaded(idx, false);
            }
        });
    }

    function handleLutProgress(id, progress) {
        const currentItem = getItem(state.currentIndex);
        const targetItem = getItem(state.targetIndex);

        if (currentItem && currentItem.id === id) {
            const tex = store.get(id);
            renderer.state.lutA = tex;
            if (renderer.state.dir === 0) {
                renderer.state.loading = !tex && store.isLoading(id);
            }
        }

        if (targetItem && targetItem.id === id && renderer.state.dir !== 0) {
            const tex = store.get(id);
            renderer.state.lutB = tex;
            renderer.state.loading = !tex && store.isLoading(id);
            updatePaneLabel(state.targetIndex);
        }

        if (progress >= 1 && state.hasPhoto) {
            const item = state.items.find((entry) => entry.id === id);
            if (item) {
                const canvas = thumbCanvases.get(id);
                if (canvas) renderItemThumbnail(item, canvas);
            }
            if (currentItem && currentItem.id === id) {
                renderStyleChip();
            }
        }

        updateMenuStatusLabel(id, progress);
        updateStyleIndicators();
        requestRender();
        syncShimmerLoop();
    }

    function setupLanguageSwitch() {
        const buttons = dom.langSwitch.querySelectorAll('button[data-lang]');
        const updateActive = () => {
            buttons.forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.lang === i18n.currentLang);
            });
            syncSegmentedThumb(dom.langSwitch);
        };
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                i18n.setLanguage(btn.dataset.lang);
                updateActive();
            });
        });
        requestAnimationFrame(updateActive);
    }

    function setupSourceSwitch() {
        const buttons = dom.sourceSwitch.querySelectorAll('button[data-source]');
        const setSource = (mode) => {
            const isLog = mode === 'log';
            buttons.forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.source === mode);
            });
            syncSegmentedThumb(dom.sourceSwitch);
            if (renderer) {
                renderer.state.logInput = isLog;
                if (state.hasPhoto) {
                    requestRender();
                    renderStyleChip();
                    renderVisibleMenuThumbnails();
                }
            }
        };
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => setSource(btn.dataset.source));
        });
        requestAnimationFrame(() => setSource('photo'));
    }

    function syncSegmentedThumb(container) {
        if (!container) return;
        const thumb = container.querySelector('.seg-thumb');
        const active = container.querySelector('button.active');
        if (!thumb || !active) return;
        thumb.style.left = `${active.offsetLeft}px`;
        thumb.style.width = `${active.offsetWidth}px`;
    }

    function setupSliders() {
        const bindSlider = (slider, output, applyValue) => {
            const update = () => {
                const val = Number(slider.value);
                const isBipolar = slider.classList.contains('bipolar');
                output.textContent = isBipolar && val > 0 ? `+${val}` : `${val}`;
                updateSliderTrackFill(slider);
                applyValue(val);
                if (state.hasPhoto) {
                    requestRender();
                    renderStyleChip();
                }
            };
            slider.addEventListener('input', update);
            slider.addEventListener('dblclick', () => {
                slider.value = slider.dataset.default || '0';
                update();
            });
            updateSliderTrackFill(slider);
        };

        bindSlider(dom.intensitySlider, dom.intensityValue, (val) => {
            if (renderer) renderer.state.intensity = val / 100;
        });
        bindSlider(dom.contrastSlider, dom.contrastValue, (val) => {
            if (renderer) renderer.state.contrast = 1 + val / 100;
        });
        bindSlider(dom.saturationSlider, dom.saturationValue, (val) => {
            if (renderer) renderer.state.saturation = 1 + val / 100;
        });

        dom.resetBtn.addEventListener('click', () => {
            [dom.intensitySlider, dom.contrastSlider, dom.saturationSlider].forEach((slider) => {
                slider.value = slider.dataset.default || '0';
                slider.dispatchEvent(new Event('input'));
            });
        });
    }

    function updateSliderTrackFill(slider) {
        const min = Number(slider.min);
        const max = Number(slider.max);
        const val = Number(slider.value);
        const pct = ((val - min) / (max - min)) * 100;
        const base = 'rgba(249, 247, 242, 0.1)';
        const fill = 'rgba(217, 168, 104, 0.62)';
        if (slider.classList.contains('bipolar')) {
            const low = Math.min(50, pct);
            const high = Math.max(50, pct);
            slider.style.setProperty(
                '--track-fill',
                `linear-gradient(90deg, ${base} 0%, ${base} ${low}%, ${fill} ${low}%, ${fill} ${high}%, ${base} ${high}%, ${base} 100%)`
            );
        } else {
            slider.style.setProperty(
                '--track-fill',
                `linear-gradient(90deg, ${fill} 0%, ${fill} ${pct}%, ${base} ${pct}%, ${base} 100%)`
            );
        }
    }

    function buildPageDots() {
        dom.pageDots.innerHTML = '';
        state.items.forEach((item, index) => {
            const dot = document.createElement('span');
            dot.title = getItemName(item);
            if (index === state.currentIndex) dot.classList.add('active');
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                if (index !== state.currentIndex) {
                    const dir = index > state.currentIndex ? -1 : 1;
                    transitionToIndex(index, dir);
                }
            });
            dom.pageDots.appendChild(dot);
        });
    }

    function buildCategoryTabs() {
        const thumb = dom.catTabs.querySelector('.seg-thumb');
        dom.catTabs.innerHTML = '';
        if (thumb) dom.catTabs.appendChild(thumb);

        state.categories.forEach((cat) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.role = 'tab';
            btn.dataset.cat = cat;
            btn.textContent = i18n.t(`cat_${cat}`);
            btn.classList.toggle('active', cat === state.activeCategory);
            btn.addEventListener('click', () => {
                state.activeCategory = cat;
                dom.catTabs.querySelectorAll('button').forEach((b) => {
                    b.classList.toggle('active', b.dataset.cat === cat);
                });
                syncSegmentedThumb(dom.catTabs);
                renderStyleMenuList();
                if (state.hasPhoto) preloadCategory(cat);
            });
            dom.catTabs.appendChild(btn);
        });

        requestAnimationFrame(() => syncSegmentedThumb(dom.catTabs));
    }

    function renderStyleMenuList() {
        dom.styleList.innerHTML = '';
        thumbCanvases.clear();

        state.items.forEach((item, index) => {
            if (item.isOriginal || item.category !== state.activeCategory) return;

            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'style-item';
            card.dataset.id = item.id;
            card.dataset.index = String(index);
            if (index === state.currentIndex) card.classList.add('active');

            const thumb = document.createElement('canvas');
            thumb.width = 144;
            thumb.height = 144;
            thumbCanvases.set(item.id, thumb);

            const nameEl = document.createElement('div');
            nameEl.className = 'style-item-name';
            nameEl.textContent = i18n.pick(item, 'name');

            const descEl = document.createElement('div');
            descEl.className = 'style-item-desc';
            descEl.textContent = i18n.pick(item, 'description');

            const statusEl = document.createElement('div');
            statusEl.className = 'style-item-status';
            statusEl.dataset.statusFor = item.id;

            card.appendChild(thumb);
            card.appendChild(nameEl);
            card.appendChild(descEl);
            card.appendChild(statusEl);

            card.addEventListener('click', () => {
                markSwipeSeen();
                if (index !== state.currentIndex) {
                    const dir = index > state.currentIndex ? -1 : 1;
                    transitionToIndex(index, dir);
                }
            });

            dom.styleList.appendChild(card);
            renderItemThumbnail(item, thumb);
            updateMenuStatusLabel(item.id, store.get(item.id) ? 1 : (store.progress.get(item.id) || 0));
        });

        dom.menuOriginal.classList.toggle('active', state.currentIndex === 0);
    }

    function updateMenuStatusLabel(id, progress) {
        const statusEl = dom.styleList.querySelector(`[data-status-for="${id}"]`);
        if (!statusEl) return;
        if (store.get(id)) {
            statusEl.textContent = '';
        } else if (store.isLoading(id)) {
            const pct = Math.max(1, Math.round(progress * 100));
            statusEl.textContent = `${i18n.t('developing')} ${pct}%`;
        } else {
            statusEl.textContent = i18n.t('tapToLoad');
        }
    }

    function renderItemThumbnail(item, canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        if (!state.hasPhoto) {
            ctx.clearRect(0, 0, w, h);
            return;
        }
        const tex = store.get(item.id);
        if (tex) {
            renderer.renderThumbnail(tex, canvas);
            return;
        }
        drawCoverSource(ctx, state.previewSource, w, h);
        ctx.fillStyle = 'rgba(14, 13, 12, 0.35)';
        ctx.fillRect(0, 0, w, h);
    }

    function renderVisibleMenuThumbnails() {
        state.items.forEach((item) => {
            if (!item.isOriginal && item.category === state.activeCategory) {
                const canvas = thumbCanvases.get(item.id);
                if (canvas) renderItemThumbnail(item, canvas);
            }
        });
    }

    function renderStyleChip() {
        const canvas = dom.styleChip;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        if (!state.hasPhoto) {
            ctx.clearRect(0, 0, w, h);
            return;
        }
        const currentItem = getItem(state.currentIndex);
        if (currentItem.isOriginal) {
            drawCoverSource(ctx, state.previewSource, w, h);
            return;
        }
        const tex = store.get(currentItem.id);
        if (tex) {
            renderer.renderThumbnail(tex, canvas);
        } else {
            drawCoverSource(ctx, state.previewSource, w, h);
        }
    }

    function drawCoverSource(ctx, source, w, h) {
        if (!source) return;
        const sw = state.previewWidth || source.width;
        const sh = state.previewHeight || source.height;
        const scale = Math.max(w / sw, h / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(source, dx, dy, dw, dh);
    }

    function updateStyleIndicators() {
        const item = getItem(state.currentIndex);
        const name = getItemName(item);
        if (!item.isOriginal && store.isLoading(item.id)) {
            const pct = Math.max(1, Math.round((store.progress.get(item.id) || 0) * 100));
            dom.styleName.textContent = `${name} · ${pct}%`;
        } else {
            dom.styleName.textContent = name;
        }

        const dots = dom.pageDots.querySelectorAll('span');
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === state.currentIndex);
        });

        dom.styleList.querySelectorAll('.style-item').forEach((card) => {
            card.classList.toggle('active', Number(card.dataset.index) === state.currentIndex);
        });
        dom.menuOriginal.classList.toggle('active', state.currentIndex === 0);
    }

    function updatePaneLabel(index) {
        const item = getItem(index);
        dom.paneCat.textContent = getItemCategoryLabel(item);
        dom.paneName.textContent = getItemName(item);
        if (!item.isOriginal && !store.get(item.id) && store.isLoading(item.id)) {
            const pct = Math.max(1, Math.round((store.progress.get(item.id) || 0) * 100));
            dom.paneProgress.textContent = `${i18n.t('developing')} ${pct}%`;
        } else if (item.isOriginal) {
            dom.paneProgress.textContent = i18n.t('originalDesc');
        } else {
            dom.paneProgress.textContent = i18n.pick(item, 'description');
        }
    }

    function showPaneLabelTemporarily(index, duration = 950) {
        clearTimeout(state.labelTimer);
        updatePaneLabel(index);
        dom.paneLabel.classList.add('show');
        state.labelTimer = setTimeout(() => {
            if (!state.dragging && !state.animFrame) {
                dom.paneLabel.classList.remove('show');
            }
        }, duration);
    }

    function markSwipeSeen() {
        if (!state.swipeSeen) {
            state.swipeSeen = true;
            dom.swipeHint.hidden = true;
        }
    }

    async function handleFileSelect(file) {
        if (!file) return;
        showToast(i18n.t('opening'), 1400);
        try {
            const decoded = await decodeImageFile(file);
            state.fileName = (file.name || 'photo').replace(/\.[^.]+$/, '');
            state.fullSource = decoded.source;
            state.fullWidth = decoded.width;
            state.fullHeight = decoded.height;

            const maxPreview = Math.min(2200, renderer.maxTextureSize || 2200);
            const scale = Math.min(1, maxPreview / Math.max(decoded.width, decoded.height));
            const pw = Math.max(1, Math.round(decoded.width * scale));
            const ph = Math.max(1, Math.round(decoded.height * scale));

            const previewCanvas = document.createElement('canvas');
            previewCanvas.width = pw;
            previewCanvas.height = ph;
            const pctx = previewCanvas.getContext('2d');
            pctx.drawImage(decoded.source, 0, 0, pw, ph);

            state.previewSource = previewCanvas;
            state.previewWidth = pw;
            state.previewHeight = ph;
            state.hasPhoto = true;

            renderer.setImage(previewCanvas, pw, ph);
            updateAmbientCanvas(previewCanvas);

            dom.body.classList.remove('is-empty');
            dom.welcome.hidden = true;
            dom.studio.hidden = false;
            dom.newPhotoBtn.hidden = false;

            if (!state.swipeSeen) {
                dom.swipeHint.hidden = false;
            }

            requestAnimationFrame(() => {
                fitStageCanvas();
                syncSegmentedThumb(dom.sourceSwitch);
                requestRender();
                renderStyleChip();
                renderVisibleMenuThumbnails();
            });

            preloadNeighbors(state.currentIndex);
            preloadCategory(state.activeCategory);
        } catch (err) {
            console.error('Image decode error:', err);
            showToast(i18n.t('errorFormat'), 3500);
        }
    }

    async function decodeImageFile(file) {
        if (window.createImageBitmap) {
            try {
                const bitmap = await createImageBitmap(file);
                return { source: bitmap, width: bitmap.width, height: bitmap.height };
            } catch (_) {
                // Fallback to HTMLImageElement below
            }
        }
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve({ source: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(err);
            };
            img.src = url;
        });
    }

    function updateAmbientCanvas(source) {
        const ctx = dom.ambientCanvas.getContext('2d');
        ctx.clearRect(0, 0, dom.ambientCanvas.width, dom.ambientCanvas.height);
        ctx.drawImage(source, 0, 0, dom.ambientCanvas.width, dom.ambientCanvas.height);
    }

    function fitStageCanvas() {
        if (!state.hasPhoto || !state.previewWidth || !state.previewHeight) return;
        const stageRect = dom.stage.getBoundingClientRect();
        const availW = Math.max(120, stageRect.width - 16);
        const availH = Math.max(120, stageRect.height - 52);
        const aspect = state.previewWidth / state.previewHeight;
        let displayW = availW;
        let displayH = displayW / aspect;
        if (displayH > availH) {
            displayH = availH;
            displayW = displayH * aspect;
        }
        dom.glCanvas.style.width = `${Math.floor(displayW)}px`;
        dom.glCanvas.style.height = `${Math.floor(displayH)}px`;
    }

    function requestRender() {
        if (!renderer || !state.hasPhoto) return;
        renderer.state.time = performance.now() / 1000;
        renderer.render();
    }

    function syncShimmerLoop() {
        const needsLoop = state.hasPhoto && renderer && renderer.state.loading;
        if (needsLoop && !state.shimmerFrame) {
            const tick = () => {
                if (!state.hasPhoto || !renderer || !renderer.state.loading) {
                    state.shimmerFrame = 0;
                    return;
                }
                requestRender();
                state.shimmerFrame = requestAnimationFrame(tick);
            };
            state.shimmerFrame = requestAnimationFrame(tick);
        }
    }

    function prepareSwipeTarget(targetIdx, side) {
        state.targetIndex = wrapIndex(targetIdx);
        state.dragSide = side;
        ensureIndexLoaded(state.targetIndex, true);
        const texB = getLutTexture(state.targetIndex);
        renderer.state.lutA = getLutTexture(state.currentIndex);
        renderer.state.lutB = texB;
        renderer.state.loading = isIndexLoading(state.targetIndex);
        renderer.state.dir = side < 0 ? 1 : -1;
        updatePaneLabel(state.targetIndex);
        dom.paneLabel.classList.add('show');
        syncShimmerLoop();
    }

    function applySwipeProgress(progress) {
        const clamped = Math.max(0, Math.min(1, progress));
        state.dragProgress = clamped;
        renderer.state.split = state.dragSide < 0 ? 1 - clamped : clamped;
        requestRender();
    }

    function finishTransition(committed) {
        if (state.animFrame) {
            cancelAnimationFrame(state.animFrame);
            state.animFrame = 0;
        }
        if (committed) {
            state.currentIndex = state.targetIndex;
            const item = getItem(state.currentIndex);
            if (!item.isOriginal && item.category && state.categories.includes(item.category)) {
                state.activeCategory = item.category;
                dom.catTabs.querySelectorAll('button').forEach((b) => {
                    b.classList.toggle('active', b.dataset.cat === state.activeCategory);
                });
                syncSegmentedThumb(dom.catTabs);
                if (state.menuOpen) renderStyleMenuList();
            }
        }
        renderer.state.lutA = getLutTexture(state.currentIndex);
        renderer.state.lutB = null;
        renderer.state.dir = 0;
        renderer.state.split = 0;
        renderer.state.loading = isIndexLoading(state.currentIndex);
        state.dragSide = 0;
        state.dragProgress = 0;
        updateStyleIndicators();
        renderStyleChip();
        requestRender();
        syncShimmerLoop();
        preloadNeighbors(state.currentIndex);
    }

    function animateSwipeTo(endProgress, committed, duration = 340) {
        if (state.animFrame) {
            cancelAnimationFrame(state.animFrame);
            state.animFrame = 0;
        }
        const startProgress = state.dragProgress;
        const startTime = performance.now();

        const step = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const current = startProgress + (endProgress - startProgress) * eased;
            applySwipeProgress(current);
            if (t < 1) {
                state.animFrame = requestAnimationFrame(step);
            } else {
                state.animFrame = 0;
                finishTransition(committed);
                showPaneLabelTemporarily(state.currentIndex, 800);
            }
        };
        state.animFrame = requestAnimationFrame(step);
    }

    function transitionToIndex(newIndex, sideHint = -1) {
        if (!state.hasPhoto) return;
        const target = wrapIndex(newIndex);
        if (target === state.currentIndex && !state.animFrame) return;
        if (state.animFrame) {
            finishTransition(true);
        }
        markSwipeSeen();
        prepareSwipeTarget(target, sideHint < 0 ? -1 : 1);
        applySwipeProgress(0.02);
        animateSwipeTo(1, true, 380);
    }

    function setupSwipeEvents() {
        const wrap = dom.canvasWrap;

        wrap.addEventListener('pointerdown', (e) => {
            if (!state.hasPhoto || e.button > 0) return;
            if (state.animFrame) {
                finishTransition(true);
            }
            state.dragging = true;
            state.dragAxisLocked = false;
            state.dragStartX = e.clientX;
            state.dragStartY = e.clientY;
            state.dragStartTime = performance.now();
            state.dragSide = 0;
            state.dragProgress = 0;
            wrap.classList.add('is-dragging');
            try {
                wrap.setPointerCapture(e.pointerId);
            } catch (_) {}
        });

        wrap.addEventListener('pointermove', (e) => {
            if (!state.dragging || !state.hasPhoto) return;
            const dx = e.clientX - state.dragStartX;
            const dy = e.clientY - state.dragStartY;

            if (!state.dragAxisLocked) {
                if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
                if (Math.abs(dy) > Math.abs(dx) * 1.2) {
                    state.dragging = false;
                    wrap.classList.remove('is-dragging');
                    return;
                }
                state.dragAxisLocked = true;
                markSwipeSeen();
            }

            const desiredSide = dx < 0 ? -1 : 1;
            const desiredTarget = wrapIndex(state.currentIndex + (desiredSide < 0 ? 1 : -1));
            if (state.dragSide !== desiredSide || state.targetIndex !== desiredTarget) {
                prepareSwipeTarget(desiredTarget, desiredSide);
            }

            const width = Math.max(180, wrap.clientWidth || 320);
            const progress = Math.min(0.98, Math.abs(dx) / (width * 0.85));
            applySwipeProgress(progress);
        });

        const endDrag = (e) => {
            if (!state.dragging) return;
            state.dragging = false;
            wrap.classList.remove('is-dragging');
            try {
                wrap.releasePointerCapture(e.pointerId);
            } catch (_) {}

            if (!state.dragAxisLocked || state.dragSide === 0) {
                return;
            }

            const elapsed = Math.max(16, performance.now() - state.dragStartTime);
            const dx = e.clientX - state.dragStartX;
            const velocity = Math.abs(dx) / elapsed;
            const shouldCommit = state.dragProgress > 0.22 || (velocity > 0.38 && state.dragProgress > 0.04);

            if (shouldCommit) {
                animateSwipeTo(1, true, 260);
            } else {
                animateSwipeTo(0, false, 220);
            }
        };

        wrap.addEventListener('pointerup', endDrag);
        wrap.addEventListener('pointercancel', endDrag);

        dom.stage.addEventListener(
            'wheel',
            (e) => {
                if (!state.hasPhoto || state.menuOpen) return;
                const now = performance.now();
                if (now < state.wheelLockUntil) return;
                const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                if (Math.abs(delta) < 18) return;
                e.preventDefault();
                state.wheelLockUntil = now + 420;
                if (delta > 0) {
                    transitionToIndex(state.currentIndex + 1, -1);
                } else {
                    transitionToIndex(state.currentIndex - 1, 1);
                }
            },
            { passive: false }
        );
    }

    function toggleStyleMenu(force) {
        const next = typeof force === 'boolean' ? force : !state.menuOpen;
        state.menuOpen = next;
        dom.styleMenu.hidden = !next;
        dom.menuScrim.hidden = !next;
        dom.styleBtn.setAttribute('aria-expanded', String(next));
        if (next) {
            renderStyleMenuList();
            requestAnimationFrame(() => syncSegmentedThumb(dom.catTabs));
            if (state.hasPhoto) preloadCategory(state.activeCategory);
        }
    }

    function syncInspectorButtonState() {
        const isMobile = window.innerWidth <= 1024;
        const isOpen = isMobile ? state.inspectorOpenMobile : !state.inspectorCollapsedDesktop;
        dom.adjustBtn.setAttribute('aria-pressed', String(isOpen));
        dom.inspector.classList.toggle('show', isMobile && state.inspectorOpenMobile);
        dom.studio.classList.toggle('inspector-collapsed', !isMobile && state.inspectorCollapsedDesktop);
    }

    function toggleInspector() {
        const isMobile = window.innerWidth <= 1024;
        if (isMobile) {
            state.inspectorOpenMobile = !state.inspectorOpenMobile;
        } else {
            state.inspectorCollapsedDesktop = !state.inspectorCollapsedDesktop;
        }
        syncInspectorButtonState();
        setTimeout(fitStageCanvas, 50);
        setTimeout(fitStageCanvas, 360);
    }

    function setBypass(active) {
        if (!renderer || !state.hasPhoto) return;
        renderer.state.bypass = active;
        dom.compareBadge.classList.toggle('show', active);
        requestRender();
    }

    async function exportFullResImage() {
        if (!state.hasPhoto || !renderer) return;
        const currentItem = getItem(state.currentIndex);
        if (!currentItem.isOriginal && !store.get(currentItem.id)) {
            await ensureIndexLoaded(state.currentIndex, true);
        }

        const maxExport = Math.min(4096, renderer.maxTextureSize || 4096);
        const scale = Math.min(1, maxExport / Math.max(state.fullWidth, state.fullHeight));
        const ew = Math.max(1, Math.round(state.fullWidth * scale));
        const eh = Math.max(1, Math.round(state.fullHeight * scale));

        renderer.setImage(state.fullSource, ew, eh);
        renderer.draw({
            width: ew,
            height: eh,
            lutA: getLutTexture(state.currentIndex),
            lutB: null,
            dir: 0,
            split: 0,
            bypass: false,
            loading: false
        });

        const suffix = currentItem.isOriginal ? 'original' : currentItem.id;
        const outName = `${state.fileName}-${suffix}.jpg`;

        dom.glCanvas.toBlob(
            (blob) => {
                renderer.setImage(state.previewSource, state.previewWidth, state.previewHeight);
                fitStageCanvas();
                requestRender();
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = outName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                showToast(i18n.t('saved'));
            },
            'image/jpeg',
            0.95
        );
    }

    function showToast(message, duration = 2200) {
        clearTimeout(state.toastTimer);
        dom.toast.textContent = message;
        dom.toast.classList.add('show');
        state.toastTimer = setTimeout(() => {
            dom.toast.classList.remove('show');
        }, duration);
    }

    function setupEventListeners() {
        dom.fileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleFileSelect(file);
            dom.fileInput.value = '';
        });

        dom.newPhotoBtn.addEventListener('click', () => dom.fileInput.click());
        if (dom.heroBtn) {
            dom.heroBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dom.fileInput.click();
                }
            });
        }

        let dragDepth = 0;
        window.addEventListener('dragenter', (e) => {
            if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
                e.preventDefault();
                dragDepth++;
                dom.dropVeil.hidden = false;
            }
        });
        window.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        window.addEventListener('dragleave', () => {
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) dom.dropVeil.hidden = true;
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDepth = 0;
            dom.dropVeil.hidden = true;
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
        });

        window.addEventListener('paste', (e) => {
            const files = e.clipboardData && e.clipboardData.files;
            if (files && files[0] && files[0].type.startsWith('image/')) {
                handleFileSelect(files[0]);
            }
        });

        dom.prevBtn.addEventListener('click', () => transitionToIndex(state.currentIndex - 1, 1));
        dom.nextBtn.addEventListener('click', () => transitionToIndex(state.currentIndex + 1, -1));

        dom.styleBtn.addEventListener('click', () => toggleStyleMenu());
        dom.menuClose.addEventListener('click', () => toggleStyleMenu(false));
        dom.menuScrim.addEventListener('click', () => toggleStyleMenu(false));
        dom.menuOriginal.addEventListener('click', () => {
            transitionToIndex(0, 1);
        });

        dom.adjustBtn.addEventListener('click', () => toggleInspector());

        const startCompare = (e) => {
            e.preventDefault();
            setBypass(true);
        };
        const stopCompare = () => setBypass(false);
        dom.compareBtn.addEventListener('pointerdown', startCompare);
        dom.compareBtn.addEventListener('pointerup', stopCompare);
        dom.compareBtn.addEventListener('pointerleave', stopCompare);
        dom.compareBtn.addEventListener('pointercancel', stopCompare);

        dom.downloadBtn.addEventListener('click', () => exportFullResImage());

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.menuOpen) {
                toggleStyleMenu(false);
                return;
            }
            if (!state.hasPhoto) return;
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                transitionToIndex(state.currentIndex - 1, 1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                transitionToIndex(state.currentIndex + 1, -1);
            } else if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                setBypass(true);
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                setBypass(false);
            }
        });

        window.addEventListener('resize', () => {
            syncInspectorButtonState();
            fitStageCanvas();
            syncSegmentedThumb(dom.langSwitch);
            syncSegmentedThumb(dom.sourceSwitch);
            if (state.menuOpen) syncSegmentedThumb(dom.catTabs);
        });

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => fitStageCanvas());
            ro.observe(dom.stage);
        }

        setupSwipeEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
