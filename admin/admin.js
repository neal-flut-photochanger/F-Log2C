class AdminApp {
    constructor() {
        this.config = { luts: [] };
    }

    async init() {
        await this.loadConfig();
        this.renderLUTList();
        this.setupEventListeners();
    }

    async loadConfig() {
        try {
            const response = await fetch('../luts/luts-config.json');
            this.config = await response.json();
        } catch (error) {
            console.error('Failed to load config:', error);
            this.showMessage('加载配置失败', 'error');
        }
    }

    setupEventListeners() {
        document.getElementById('upload-btn').addEventListener('click', () => this.uploadLUT());
        document.getElementById('export-btn').addEventListener('click', () => this.exportConfig());
    }

    renderLUTList() {
        const container = document.getElementById('lut-list');
        container.innerHTML = '';

        if (this.config.luts.length === 0) {
            container.innerHTML = '<p style="color: #a0aec0;">暂无 LUT</p>';
            return;
        }

        this.config.luts.forEach((lut, index) => {
            const item = document.createElement('div');
            item.className = 'lut-item';
            item.innerHTML = `
                <div class="lut-info">
                    <h4>${lut.name_zh} / ${lut.name_en}</h4>
                    <p>ID: ${lut.id} | 分类: ${lut.category || 'other'} | 文件: ${lut.file}</p>
                </div>
                <div class="lut-actions">
                    <button class="btn-delete" data-index="${index}">删除</button>
                </div>
            `;
            container.appendChild(item);
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.deleteLUT(index);
            });
        });
    }

    async uploadLUT() {
        const id = document.getElementById('lut-id').value.trim();
        const nameEn = document.getElementById('name-en').value.trim();
        const nameZh = document.getElementById('name-zh').value.trim();
        const categoryEl = document.getElementById('lut-category');
        const category = categoryEl ? categoryEl.value : 'vivid';
        const descEn = document.getElementById('desc-en').value.trim();
        const descZh = document.getElementById('desc-zh').value.trim();
        const fileInput = document.getElementById('lut-file');

        if (!id || !nameEn || !nameZh || !descEn || !descZh || !fileInput.files[0]) {
            this.showMessage('请填写所有字段并选择文件', 'error');
            return;
        }

        const file = fileInput.files[0];
        if (!file.name.endsWith('.cube')) {
            this.showMessage('请选择 .cube 文件', 'error');
            return;
        }

        if (this.config.luts.find(lut => lut.id === id)) {
            this.showMessage('该 ID 已存在', 'error');
            return;
        }

        const newLUT = {
            id: id,
            file: file.name,
            category: category,
            name_en: nameEn,
            name_zh: nameZh,
            description_en: descEn,
            description_zh: descZh
        };

        this.config.luts.push(newLUT);
        this.renderLUTList();

        document.getElementById('lut-id').value = '';
        document.getElementById('name-en').value = '';
        document.getElementById('name-zh').value = '';
        document.getElementById('desc-en').value = '';
        document.getElementById('desc-zh').value = '';
        fileInput.value = '';

        this.showMessage(`LUT "${nameZh}" 已添加到配置。请把 ${file.name} 放进 luts/ 目录，替换 luts-config.json 后运行 deploy.sh 发布`, 'success');
    }

    deleteLUT(index) {
        if (!confirm('确定要删除这个 LUT 吗?')) return;

        const deleted = this.config.luts.splice(index, 1)[0];
        this.renderLUTList();
        this.showMessage(`已删除 "${deleted.name_zh}"`, 'success');
    }

    exportConfig() {
        const json = JSON.stringify(this.config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'luts-config.json';
        link.click();
        
        URL.revokeObjectURL(url);
        this.showMessage('配置文件已下载', 'success');
    }

    showMessage(text, type = 'success') {
        const message = document.getElementById('message');
        message.textContent = text;
        message.className = `message ${type} show`;
        
        setTimeout(() => {
            message.classList.remove('show');
        }, 3000);
    }
}

let adminApp;
window.addEventListener('DOMContentLoaded', async () => {
    adminApp = new AdminApp();
    await adminApp.init();
});
