class FLog2CApp {
    constructor() {
        this.lutEngine = new LUTEngine();
        this.currentImage = null;
        this.currentLUT = null;
        this.lutsConfig = null;
        this.canvas = null;
        this.ctx = null;
        this.originalImageData = null;
        
        this.params = {
            intensity: 1.0,
            contrast: 1.0,
            saturation: 1.0
        };
    }

    async init() {
        i18n.init();
        await this.loadLUTsConfig();
        this.setupCanvas();
        this.setupEventListeners();
        this.renderLUTSelectors();
    }

    async loadLUTsConfig() {
        const response = await fetch('luts/luts-config.json');
        this.lutsConfig = await response.json();
    }

    setupCanvas() {
        this.canvas = document.getElementById('preview-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    setupEventListeners() {
        const uploadInput = document.getElementById('upload-input');
        const uploadArea = document.getElementById('upload-area');
        
        uploadInput.addEventListener('change', (e) => this.handleImageUpload(e.target.files[0]));
        
        uploadArea.addEventListener('click', () => uploadInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.background = 'rgba(255, 255, 255, 0.12)';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.background = '';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.background = '';
            if (e.dataTransfer.files.length > 0) {
                this.handleImageUpload(e.dataTransfer.files[0]);
            }
        });
        
        document.getElementById('lut-dropdown').addEventListener('click', () => this.toggleDropdown());
        
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('lut-dropdown');
            const menu = document.getElementById('lut-menu');
            if (!dropdown.contains(e.target) && !menu.contains(e.target)) {
                this.closeDropdown();
            }
        });
        
        document.getElementById('intensity-slider').addEventListener('input', (e) => {
            this.params.intensity = parseFloat(e.target.value);
            document.getElementById('intensity-value').textContent = Math.round(this.params.intensity * 100);
            this.applyCurrentLUT();
        });
        
        document.getElementById('contrast-slider').addEventListener('input', (e) => {
            this.params.contrast = parseFloat(e.target.value);
            document.getElementById('contrast-value').textContent = Math.round(this.params.contrast * 100);
            this.applyCurrentLUT();
        });
        
        document.getElementById('saturation-slider').addEventListener('input', (e) => {
            this.params.saturation = parseFloat(e.target.value);
            document.getElementById('saturation-value').textContent = Math.round(this.params.saturation * 100);
            this.applyCurrentLUT();
        });
        
        document.getElementById('reset-btn').addEventListener('click', () => this.resetParams());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadImage());
        
        document.getElementById('lang-toggle').addEventListener('click', () => {
            const newLang = i18n.currentLang === 'zh' ? 'en' : 'zh';
            i18n.setLanguage(newLang);
            this.renderLUTSelectors();
            document.getElementById('lang-toggle').textContent = newLang === 'zh' ? 'EN' : '中';
        });
    }

    renderLUTSelectors() {
        this.renderDropdownMenu();
        this.renderSwipeSelector();
    }

    renderDropdownMenu() {
        const menu = document.getElementById('lut-menu');
        menu.innerHTML = '';
        
        this.lutsConfig.luts.forEach(lut => {
            const item = document.createElement('div');
            item.className = 'lut-menu-item';
            item.dataset.lutId = lut.id;
            
            const name = i18n.currentLang === 'zh' ? lut.name_zh : lut.name_en;
            const desc = i18n.currentLang === 'zh' ? lut.description_zh : lut.description_en;
            
            item.innerHTML = `
                <div class="lut-menu-item-name">${name}</div>
                <div class="lut-menu-item-desc">${desc}</div>
            `;
            
            item.addEventListener('click', () => {
                this.selectLUT(lut);
                this.closeDropdown();
            });
            
            menu.appendChild(item);
        });
    }

    renderSwipeSelector() {
        const swiper = document.getElementById('lut-swiper');
        swiper.innerHTML = '';
        
        this.lutsConfig.luts.forEach(lut => {
            const card = document.createElement('div');
            card.className = 'lut-swipe-card';
            card.dataset.lutId = lut.id;
            
            const name = i18n.currentLang === 'zh' ? lut.name_zh : lut.name_en;
            const desc = i18n.currentLang === 'zh' ? lut.description_zh : lut.description_en;
            
            card.innerHTML = `
                <div class="lut-swipe-card-name">${name}</div>
                <div class="lut-swipe-card-desc">${desc}</div>
            `;
            
            card.addEventListener('click', () => this.selectLUT(lut));
            swiper.appendChild(card);
        });
    }

    toggleDropdown() {
        const dropdown = document.getElementById('lut-dropdown');
        const menu = document.getElementById('lut-menu');
        
        if (menu.style.display === 'none' || menu.style.display === '') {
            menu.style.display = 'block';
            dropdown.classList.add('open');
        } else {
            this.closeDropdown();
        }
    }

    closeDropdown() {
        const dropdown = document.getElementById('lut-dropdown');
        const menu = document.getElementById('lut-menu');
        menu.style.display = 'none';
        dropdown.classList.remove('open');
    }

    async handleImageUpload(file) {
        if (!file || !file.type.match('image.*')) {
            alert(i18n.t('error') + ': ' + i18n.t('supportedFormats'));
            return;
        }
        
        this.showLoading(true);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                this.displayImage(img);
                this.showLoading(false);
                document.getElementById('upload-area').style.display = 'none';
                document.getElementById('workspace').style.display = 'grid';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    displayImage(img) {
        const maxWidth = 1920;
        const maxHeight = 1080;
        
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.ctx.drawImage(img, 0, 0, width, height);
        this.originalImageData = this.ctx.getImageData(0, 0, width, height);
    }

    async selectLUT(lutConfig) {
        if (!this.currentImage) {
            alert(i18n.t('noImage'));
            return;
        }
        
        this.showGlassOverlay(true);
        
        document.querySelectorAll('.lut-menu-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelectorAll('.lut-swipe-card').forEach(card => {
            card.classList.remove('active');
        });
        
        const menuItem = document.querySelector(`.lut-menu-item[data-lut-id="${lutConfig.id}"]`);
        const swipeCard = document.querySelector(`.lut-swipe-card[data-lut-id="${lutConfig.id}"]`);
        
        if (menuItem) menuItem.classList.add('active');
        if (swipeCard) {
            swipeCard.classList.add('active');
            swipeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
        
        const name = i18n.currentLang === 'zh' ? lutConfig.name_zh : lutConfig.name_en;
        document.getElementById('current-lut-name').textContent = name;
        
        this.showLoading(true);
        
        try {
            this.currentLUT = await this.lutEngine.loadLUT(lutConfig.id, lutConfig.file);
            await this.applyCurrentLUT();
        } catch (error) {
            console.error('LUT loading error:', error);
            alert(i18n.t('error') + ': ' + error.message);
        }
        
        this.showLoading(false);
        
        setTimeout(() => this.showGlassOverlay(false), 600);
    }

    async applyCurrentLUT() {
        if (!this.currentLUT || !this.originalImageData) return;
        
        const imageData = new ImageData(
            new Uint8ClampedArray(this.originalImageData.data),
            this.originalImageData.width,
            this.originalImageData.height
        );
        
        this.lutEngine.applyLUT(
            imageData,
            this.currentLUT,
            this.params.intensity,
            this.params.contrast,
            this.params.saturation
        );
        
        this.ctx.putImageData(imageData, 0, 0);
    }

    showGlassOverlay(show) {
        const overlay = document.getElementById('glass-overlay');
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    resetParams() {
        this.params.intensity = 1.0;
        this.params.contrast = 1.0;
        this.params.saturation = 1.0;
        
        document.getElementById('intensity-slider').value = 1.0;
        document.getElementById('contrast-slider').value = 1.0;
        document.getElementById('saturation-slider').value = 1.0;
        
        document.getElementById('intensity-value').textContent = '100';
        document.getElementById('contrast-value').textContent = '100';
        document.getElementById('saturation-value').textContent = '100';
        
        this.applyCurrentLUT();
    }

    downloadImage() {
        if (!this.canvas) return;
        
        const link = document.createElement('a');
        link.download = `flog2c-preview-${Date.now()}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }
}

let app;
window.addEventListener('DOMContentLoaded', async () => {
    app = new FLog2CApp();
    await app.init();
});
