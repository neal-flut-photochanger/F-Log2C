const VERT_SRC = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
    vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
    gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uImg;
uniform sampler3D uLutA;
uniform sampler3D uLutB;
uniform float uHasA;
uniform float uHasB;
uniform float uSizeA;
uniform float uSizeB;
uniform vec3 uDomMinA;
uniform vec3 uDomMaxA;
uniform vec3 uDomMinB;
uniform vec3 uDomMaxB;
uniform float uSplit;
uniform float uDir;
uniform float uEdge;
uniform vec2 uRes;
uniform float uIntensity;
uniform float uContrast;
uniform float uSaturation;
uniform float uLogInput;
uniform float uBypass;
uniform float uTime;
uniform float uLoading;
uniform vec2 uUvScale;
uniform vec2 uUvOffset;
uniform mat3 uToFGC;

float srgbToLinear(float c) {
    return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}

float encodeFLog2(float x) {
    return x >= 0.000889 ? 0.245281 * log(5.555556 * x + 0.064829) / log(10.0) + 0.384316 : 8.799461 * x + 0.092864;
}

vec3 toFLog2C(vec3 src) {
    if (uLogInput > 0.5) return src;
    vec3 lin = vec3(srgbToLinear(src.r), srgbToLinear(src.g), srgbToLinear(src.b));
    vec3 fgc = max(uToFGC * lin, vec3(0.0));
    return vec3(encodeFLog2(fgc.r), encodeFLog2(fgc.g), encodeFLog2(fgc.b));
}

vec3 sampleLut(sampler3D lut, float size, vec3 domMin, vec3 domMax, vec3 c) {
    vec3 n = clamp((c - domMin) / (domMax - domMin), 0.0, 1.0);
    vec3 uvw = n * ((size - 1.0) / size) + 0.5 / size;
    return texture(lut, uvw).rgb;
}

vec3 finish(vec3 src, vec3 graded) {
    vec3 c = mix(src, graded, uIntensity);
    c = 0.46 + (c - 0.46) * uContrast;
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(luma), c, uSaturation);
    return clamp(c, 0.0, 1.0);
}

vec3 gradeWith(vec3 src, float which) {
    if (uBypass > 0.5) return src;
    vec3 logc = toFLog2C(src);
    if (which < 0.5) {
        if (uHasA < 0.5) return finish(src, src);
        return finish(src, sampleLut(uLutA, uSizeA, uDomMinA, uDomMaxA, logc));
    }
    if (uHasB < 0.5) return finish(src, src);
    return finish(src, sampleLut(uLutB, uSizeB, uDomMinB, uDomMaxB, logc));
}

void main() {
    vec2 uv = vUv * uUvScale + uUvOffset;
    float px = vUv.x * uRes.x;
    float edgePx = uSplit * uRes.x;
    float d = (px - edgePx) * uDir;
    bool inPane = uDir != 0.0 && d > 0.0;

    vec3 src;
    vec3 color;
    if (inPane && d < uEdge) {
        float k = 1.0 - d / uEdge;
        float bend = k * k * uEdge * 0.55;
        float shift = uDir * bend / uRes.x;
        vec3 srcR = texture(uImg, uv + vec2(shift * 1.08, 0.0)).rgb;
        vec3 srcG = texture(uImg, uv + vec2(shift, 0.0)).rgb;
        vec3 srcB = texture(uImg, uv + vec2(shift * 0.92, 0.0)).rgb;
        src = vec3(srcR.r, srcG.g, srcB.b);
        color = gradeWith(src, 1.0);
        color += vec3(1.0) * 0.07 * k * k;
    } else {
        src = texture(uImg, uv).rgb;
        color = gradeWith(src, inPane ? 1.0 : 0.0);
    }

    if (uDir != 0.0) {
        if (inPane) {
            float diag = vUv.x * 0.7 + vUv.y * 0.3;
            float sheen = exp(-pow((diag - (uSplit + uDir * 0.25)) * 3.2, 2.0));
            color += vec3(1.0, 0.98, 0.94) * 0.045 * sheen;
            float top = smoothstep(0.12, 0.0, vUv.y);
            color += vec3(1.0) * 0.035 * top;
            if (uLoading > 0.5) {
                float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
                color = mix(color, vec3(luma), 0.55) * 0.62 + 0.1;
                float band = vUv.x + vUv.y * 0.35 - fract(uTime * 0.45) * 1.8 + 0.25;
                color += vec3(1.0) * 0.09 * exp(-pow(band * 7.0, 2.0));
            }
        } else {
            color *= 1.0 - 0.32 * exp(d / (uEdge * 1.6));
        }
        float rim = exp(-pow(d / 1.3, 2.0));
        float innerRim = exp(-pow((d - 3.0) / 1.8, 2.0)) * step(0.0, d);
        color = mix(color, vec3(1.0), clamp(rim * 0.75 + innerRim * 0.18, 0.0, 1.0));
    }

    outColor = vec4(color, 1.0);
}`;

const SRGB_TO_FGC = [
    0.517069, 0.4129347, 0.0699963,
    0.0886172, 0.8092631, 0.1021197,
    0.01775, 0.1094476, 0.8728023
];

class LutRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false, alpha: false });
        if (!gl) throw new Error('WEBGL2_UNSUPPORTED');
        this.gl = gl;
        this.program = this.createProgram(VERT_SRC, FRAG_SRC);
        this.uniforms = {};
        const count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        for (let index = 0; index < count; index++) {
            const info = gl.getActiveUniform(this.program, index);
            this.uniforms[info.name] = gl.getUniformLocation(this.program, info.name);
        }

        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const location = gl.getAttribLocation(this.program, 'aPos');
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);

        this.imageTexture = gl.createTexture();
        this.dummyLut = this.createLutTexture({ size: 2, data: new Float32Array(24), domainMin: [0, 0, 0], domainMax: [1, 1, 1] });
        this.imageWidth = 0;
        this.imageHeight = 0;
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

        this.state = {
            lutA: null,
            lutB: null,
            split: 0,
            dir: 0,
            edge: 30,
            intensity: 1,
            contrast: 1,
            saturation: 1,
            logInput: false,
            bypass: false,
            loading: false,
            time: 0
        };
    }

    createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        const program = gl.createProgram();
        gl.attachShader(program, this.createShader(gl.VERTEX_SHADER, vertexSource));
        gl.attachShader(program, this.createShader(gl.FRAGMENT_SHADER, fragmentSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program));
        }
        return program;
    }

    createLutTexture(lut) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, lut.size, lut.size, lut.size, 0, gl.RGB, gl.FLOAT, lut.data);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        return { texture, size: lut.size, domainMin: lut.domainMin, domainMax: lut.domainMax };
    }

    setImage(source, width, height) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.imageWidth = width;
        this.imageHeight = height;
        this.canvas.width = width;
        this.canvas.height = height;
    }

    bindLut(unit, lut, prefix) {
        const gl = this.gl;
        const target = lut || this.dummyLut;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_3D, target.texture);
        gl.uniform1i(this.uniforms[`uLut${prefix}`], unit);
        gl.uniform1f(this.uniforms[`uHas${prefix}`], lut ? 1 : 0);
        gl.uniform1f(this.uniforms[`uSize${prefix}`], target.size);
        gl.uniform3fv(this.uniforms[`uDomMin${prefix}`], target.domainMin);
        gl.uniform3fv(this.uniforms[`uDomMax${prefix}`], target.domainMax);
    }

    draw(options = {}) {
        const gl = this.gl;
        const state = { ...this.state, ...options };
        const width = options.width || this.canvas.width;
        const height = options.height || this.canvas.height;
        gl.viewport(0, 0, width, height);
        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
        gl.uniform1i(this.uniforms.uImg, 0);
        this.bindLut(1, state.lutA, 'A');
        this.bindLut(2, state.lutB, 'B');
        gl.uniform1f(this.uniforms.uSplit, state.split);
        gl.uniform1f(this.uniforms.uDir, state.dir);
        gl.uniform1f(this.uniforms.uEdge, state.edge);
        gl.uniform2f(this.uniforms.uRes, width, height);
        gl.uniform1f(this.uniforms.uIntensity, state.intensity);
        gl.uniform1f(this.uniforms.uContrast, state.contrast);
        gl.uniform1f(this.uniforms.uSaturation, state.saturation);
        gl.uniform1f(this.uniforms.uLogInput, state.logInput ? 1 : 0);
        gl.uniform1f(this.uniforms.uBypass, state.bypass ? 1 : 0);
        gl.uniform1f(this.uniforms.uLoading, state.loading ? 1 : 0);
        gl.uniform1f(this.uniforms.uTime, state.time);
        gl.uniform2fv(this.uniforms.uUvScale, options.uvScale || [1, 1]);
        gl.uniform2fv(this.uniforms.uUvOffset, options.uvOffset || [0, 0]);
        gl.uniformMatrix3fv(this.uniforms.uToFGC, true, SRGB_TO_FGC);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    render() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.draw();
    }

    renderThumbnail(lut, targetCanvas) {
        const gl = this.gl;
        const width = targetCanvas.width;
        const height = targetCanvas.height;
        if (!this.thumbFbo) {
            this.thumbFbo = gl.createFramebuffer();
            this.thumbTex = gl.createTexture();
            this.thumbSize = [0, 0];
        }
        gl.bindTexture(gl.TEXTURE_2D, this.thumbTex);
        if (this.thumbSize[0] !== width || this.thumbSize[1] !== height) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            this.thumbSize = [width, height];
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.thumbFbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.thumbTex, 0);

        const imageAspect = this.imageWidth / this.imageHeight;
        const thumbAspect = width / height;
        let uvScale = [1, 1];
        if (imageAspect > thumbAspect) uvScale = [thumbAspect / imageAspect, 1];
        else uvScale = [1, imageAspect / thumbAspect];
        const uvOffset = [(1 - uvScale[0]) / 2, (1 - uvScale[1]) / 2];

        this.draw({ width, height, lutA: lut, lutB: null, dir: 0, bypass: false, uvScale, uvOffset });
        const pixels = new Uint8ClampedArray(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const flipped = new Uint8ClampedArray(pixels.length);
        const row = width * 4;
        for (let y = 0; y < height; y++) {
            flipped.set(pixels.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
        }
        targetCanvas.getContext('2d').putImageData(new ImageData(flipped, width, height), 0, 0);
    }
}

class LutStore {
    constructor(renderer, basePath = 'luts/') {
        this.renderer = renderer;
        this.basePath = basePath;
        this.textures = new Map();
        this.pending = new Map();
        this.progress = new Map();
        this.listeners = new Set();
        this.workers = [];
        this.queue = [];
        this.busy = new Set();
        this.callbacks = new Map();
        const workerCount = 2;
        for (let index = 0; index < workerCount; index++) {
            const worker = new Worker('js/cube-worker.js');
            worker.onmessage = (event) => this.handleMessage(worker, event.data);
            this.workers.push(worker);
        }
    }

    onProgress(listener) {
        this.listeners.add(listener);
    }

    emit(id) {
        this.listeners.forEach((listener) => listener(id, this.progress.get(id) || 0));
    }

    get(id) {
        return this.textures.get(id) || null;
    }

    isLoading(id) {
        return this.pending.has(id);
    }

    load(entry, priority = false) {
        if (this.textures.has(entry.id)) return Promise.resolve(this.textures.get(entry.id));
        if (this.pending.has(entry.id)) {
            if (priority) {
                const queued = this.queue.findIndex((item) => item.entry.id === entry.id);
                if (queued > 0) this.queue.unshift(...this.queue.splice(queued, 1));
            }
            return this.pending.get(entry.id);
        }
        const promise = new Promise((resolve, reject) => {
            const job = { entry, resolve, reject };
            if (priority) this.queue.unshift(job);
            else this.queue.push(job);
        });
        this.pending.set(entry.id, promise);
        this.progress.set(entry.id, 0);
        this.pump();
        return promise;
    }

    pump() {
        for (const worker of this.workers) {
            if (this.busy.has(worker) || this.queue.length === 0) continue;
            const job = this.queue.shift();
            this.busy.add(worker);
            this.callbacks.set(job.entry.id, job);
            const url = new URL(this.basePath + encodeURIComponent(job.entry.file).replace(/%2F/g, '/'), document.baseURI).href;
            worker.postMessage({ id: job.entry.id, url });
        }
    }

    handleMessage(worker, message) {
        const job = this.callbacks.get(message.id);
        if (!job) return;
        if (message.type === 'progress') {
            const ratio = message.total ? message.loaded / message.total : 0;
            this.progress.set(message.id, Math.min(0.95, ratio));
            this.emit(message.id);
            return;
        }
        this.busy.delete(worker);
        this.callbacks.delete(message.id);
        this.pending.delete(message.id);
        if (message.type === 'done') {
            const texture = this.renderer.createLutTexture(message);
            this.textures.set(message.id, texture);
            this.progress.set(message.id, 1);
            this.emit(message.id);
            job.resolve(texture);
        } else {
            this.progress.delete(message.id);
            this.emit(message.id);
            job.reject(new Error(message.message));
        }
        this.pump();
    }
}
