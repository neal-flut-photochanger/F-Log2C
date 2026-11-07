class LUTEngine {
    constructor() {
        this.luts = new Map();
        this.currentLUT = null;
    }

    async parseCubeFile(fileContent) {
        const lines = fileContent.split('\n');
        let size = 0;
        const data = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('#') || trimmed === '') continue;
            
            if (trimmed.startsWith('LUT_3D_SIZE')) {
                size = parseInt(trimmed.split(/\s+/)[1]);
                continue;
            }
            
            const parts = trimmed.split(/\s+/);
            if (parts.length === 3) {
                data.push([
                    parseFloat(parts[0]),
                    parseFloat(parts[1]),
                    parseFloat(parts[2])
                ]);
            }
        }
        
        if (data.length !== size * size * size) {
            throw new Error(`LUT data mismatch: expected ${size * size * size}, got ${data.length}`);
        }
        
        return { size, data };
    }

    async loadLUT(lutId, lutFile) {
        if (this.luts.has(lutId)) {
            return this.luts.get(lutId);
        }
        
        const response = await fetch(`luts/${lutFile}`);
        const content = await response.text();
        const lut = await this.parseCubeFile(content);
        lut.id = lutId;
        
        this.luts.set(lutId, lut);
        return lut;
    }

    trilinearInterpolate(lut, r, g, b) {
        const { size, data } = lut;
        const maxIndex = size - 1;
        
        const rf = r * maxIndex;
        const gf = g * maxIndex;
        const bf = b * maxIndex;
        
        const r0 = Math.max(0, Math.min(Math.floor(rf), maxIndex - 1));
        const g0 = Math.max(0, Math.min(Math.floor(gf), maxIndex - 1));
        const b0 = Math.max(0, Math.min(Math.floor(bf), maxIndex - 1));
        
        const r1 = Math.min(r0 + 1, maxIndex);
        const g1 = Math.min(g0 + 1, maxIndex);
        const b1 = Math.min(b0 + 1, maxIndex);
        
        const rd = rf - r0;
        const gd = gf - g0;
        const bd = bf - b0;
        
        const getColor = (ri, gi, bi) => {
            const index = ri + gi * size + bi * size * size;
            return data[index];
        };
        
        const c000 = getColor(r0, g0, b0);
        const c001 = getColor(r0, g0, b1);
        const c010 = getColor(r0, g1, b0);
        const c011 = getColor(r0, g1, b1);
        const c100 = getColor(r1, g0, b0);
        const c101 = getColor(r1, g0, b1);
        const c110 = getColor(r1, g1, b0);
        const c111 = getColor(r1, g1, b1);
        
        const result = [0, 0, 0];
        for (let i = 0; i < 3; i++) {
            const c00 = c000[i] * (1 - rd) + c100[i] * rd;
            const c01 = c001[i] * (1 - rd) + c101[i] * rd;
            const c10 = c010[i] * (1 - rd) + c110[i] * rd;
            const c11 = c011[i] * (1 - rd) + c111[i] * rd;
            
            const c0 = c00 * (1 - gd) + c10 * gd;
            const c1 = c01 * (1 - gd) + c11 * gd;
            
            result[i] = c0 * (1 - bd) + c1 * bd;
        }
        
        return result;
    }

    applyLUT(imageData, lut, intensity = 1.0, contrast = 1.0, saturation = 1.0) {
        const data = imageData.data;
        const pixels = data.length / 4;
        
        for (let i = 0; i < pixels; i++) {
            const idx = i * 4;
            let r = data[idx] / 255;
            let g = data[idx + 1] / 255;
            let b = data[idx + 2] / 255;
            
            const [lr, lg, lb] = this.trilinearInterpolate(lut, r, g, b);
            
            r = r + (lr - r) * intensity;
            g = g + (lg - g) * intensity;
            b = b + (lb - b) * intensity;
            
            if (contrast !== 1.0) {
                r = ((r - 0.5) * contrast) + 0.5;
                g = ((g - 0.5) * contrast) + 0.5;
                b = ((b - 0.5) * contrast) + 0.5;
            }
            
            if (saturation !== 1.0) {
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                r = gray + (r - gray) * saturation;
                g = gray + (g - gray) * saturation;
                b = gray + (b - gray) * saturation;
            }
            
            data[idx] = Math.max(0, Math.min(255, r * 255));
            data[idx + 1] = Math.max(0, Math.min(255, g * 255));
            data[idx + 2] = Math.max(0, Math.min(255, b * 255));
        }
        
        return imageData;
    }
}
