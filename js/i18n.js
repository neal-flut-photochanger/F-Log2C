const i18n = {
    currentLang: 'zh',
    
    translations: {
        zh: {
            title: 'F-Log2C LUT Preview',
            subtitle: '专业色彩查找表在线预览',
            uploadImage: '上传图片',
            selectLUT: '选择胶片风格',
            noLutSelected: '请选择风格',
            adjustments: '调整参数',
            intensity: 'LUT 强度',
            contrast: '对比度',
            saturation: '饱和度',
            reset: '重置',
            download: '下载图片',
            original: '原图',
            preview: '预览',
            loading: '加载中...',
            processing: '处理中...',
            dragDrop: '拖拽图片到此处或点击上传',
            supportedFormats: '支持 JPG、PNG、WebP 格式',
            noImage: '请先上传图片',
            error: '错误',
            close: '关闭'
        },
        en: {
            title: 'F-Log2C LUT Preview',
            subtitle: 'Professional Color Lookup Table Online Preview',
            uploadImage: 'Upload Image',
            selectLUT: 'Select Film Style',
            noLutSelected: 'Select a style',
            adjustments: 'Adjustments',
            intensity: 'LUT Intensity',
            contrast: 'Contrast',
            saturation: 'Saturation',
            reset: 'Reset',
            download: 'Download',
            original: 'Original',
            preview: 'Preview',
            loading: 'Loading...',
            processing: 'Processing...',
            dragDrop: 'Drop image here or click to upload',
            supportedFormats: 'Supports JPG, PNG, WebP',
            noImage: 'Please upload an image first',
            error: 'Error',
            close: 'Close'
        }
    },
    
    init() {
        const savedLang = localStorage.getItem('language') || 'zh';
        this.setLanguage(savedLang);
    },
    
    setLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('language', lang);
        this.updateUI();
    },
    
    t(key) {
        return this.translations[this.currentLang][key] || key;
    },
    
    updateUI() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });
        
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });
    }
};
