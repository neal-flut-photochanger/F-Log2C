const i18n = {
    currentLang: 'zh',
    listeners: [],

    translations: {
        zh: {
            pageTitle: 'Film Glass · F-Log2C 胶片实验室',
            brandSub: 'F-Log2C 胶片实验室',
            heroEyebrow: 'FUJIFILM F-Log2C · 官方 LUT',
            heroTitle: '给照片盖上一层胶片玻璃',
            heroSub: '选一张照片，左右滑一滑，就能换上富士胶片的颜色。',
            choosePhoto: '选择照片',
            dropHint: '也可以把照片拖进来 · 照片只在你的设备上处理，不会上传',
            step1: '选照片',
            step2: '左右滑',
            step3: '保存',
            dropVeil: '松手，放下照片',
            filmStyle: '胶片风格',
            original: '原图',
            originalDesc: '还没有盖上胶片',
            adjust: '调整',
            compare: '按住看原图',
            compareShort: '原图',
            save: '保存',
            newPhoto: '换照片',
            intensity: '效果强度',
            contrast: '明暗对比',
            saturation: '色彩浓度',
            reset: '恢复默认',
            source: '照片类型',
            sourcePhoto: '普通照片',
            sourceLog: 'Log 素材',
            note: '预览为近似效果：普通照片会先换算成 F-Log2C / F-Gamut C，再套用富士官方 LUT。',
            swipeHint: '左右滑动，换一块胶片',
            developing: '正在冲洗',
            tapToLoad: '轻点试试',
            chooseStyle: '选择胶片风格',
            backToOriginal: '回到原图',
            cat_vivid: '鲜艳',
            cat_soft: '柔和',
            cat_cinema: '电影',
            cat_mono: '黑白',
            cat_neutral: '中性',
            cat_other: '其他',
            errorFormat: '这张图片打不开，换一张 JPG 或 PNG 试试吧',
            errorWebgl: '这个浏览器不支持实时渲染，请使用最新版 Chrome、Edge 或 Safari',
            errorLut: '胶片加载失败，请检查网络后再试一次',
            saved: '已保存',
            opening: '正在打开照片',
            close: '关闭',
            prev: '上一个风格',
            next: '下一个风格',
            language: '语言'
        },
        en: {
            pageTitle: 'Film Glass · F-Log2C Film Lab',
            brandSub: 'F-Log2C Film Lab',
            heroEyebrow: 'FUJIFILM F-Log2C · Official LUTs',
            heroTitle: 'Lay a pane of film over your photo',
            heroSub: 'Pick a photo, swipe left or right, and try on Fujifilm colours.',
            choosePhoto: 'Choose a photo',
            dropHint: 'Or drop it here · Your photo never leaves your device',
            step1: 'Pick',
            step2: 'Swipe',
            step3: 'Save',
            dropVeil: 'Drop to open',
            filmStyle: 'Film style',
            original: 'Original',
            originalDesc: 'No film applied yet',
            adjust: 'Adjust',
            compare: 'Hold for original',
            compareShort: 'Before',
            save: 'Save',
            newPhoto: 'New photo',
            intensity: 'Strength',
            contrast: 'Contrast',
            saturation: 'Colour',
            reset: 'Reset',
            source: 'Photo type',
            sourcePhoto: 'Normal photo',
            sourceLog: 'Log footage',
            note: 'Approximate preview: regular photos are converted to F-Log2C / F-Gamut C before the official Fujifilm LUT is applied.',
            swipeHint: 'Swipe to change film',
            developing: 'Developing',
            tapToLoad: 'Tap to try',
            chooseStyle: 'Choose a film',
            backToOriginal: 'Show original',
            cat_vivid: 'Vivid',
            cat_soft: 'Soft',
            cat_cinema: 'Cinema',
            cat_mono: 'Mono',
            cat_neutral: 'Neutral',
            cat_other: 'Other',
            errorFormat: "This image can't be opened. Try a JPG or PNG.",
            errorWebgl: 'This browser cannot render in real time. Please use the latest Chrome, Edge or Safari.',
            errorLut: 'The film failed to load. Check your connection and try again.',
            saved: 'Saved',
            opening: 'Opening photo',
            close: 'Close',
            prev: 'Previous style',
            next: 'Next style',
            language: 'Language'
        }
    },

    init() {
        const saved = localStorage.getItem('language');
        const browser = (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
        this.setLanguage(saved || browser);
    },

    onChange(listener) {
        this.listeners.push(listener);
    },

    setLanguage(lang) {
        this.currentLang = this.translations[lang] ? lang : 'zh';
        localStorage.setItem('language', this.currentLang);
        document.documentElement.lang = this.currentLang === 'zh' ? 'zh-CN' : 'en';
        this.updateUI();
        this.listeners.forEach((listener) => listener(this.currentLang));
    },

    t(key) {
        return this.translations[this.currentLang][key] || this.translations.zh[key] || key;
    },

    pick(entry, field) {
        return entry[`${field}_${this.currentLang}`] || entry[`${field}_en`] || '';
    },

    updateUI() {
        document.querySelectorAll('[data-i18n]').forEach((element) => {
            element.textContent = this.t(element.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
            element.setAttribute('aria-label', this.t(element.getAttribute('data-i18n-aria')));
        });
        document.title = this.t('pageTitle');
    }
};
