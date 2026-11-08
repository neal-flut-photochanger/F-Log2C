self.onmessage = async (event) => {
    const { id, url } = event.data;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const encoded = response.headers.get('content-encoding');
        const rawLength = Number(response.headers.get('content-length')) || 0;
        const total = encoded ? rawLength * 4.7 : rawLength;
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        let lastReport = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            const now = Date.now();
            if (now - lastReport > 80) {
                lastReport = now;
                self.postMessage({ id, type: 'progress', loaded: received, total });
            }
        }
        const bytes = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
        }
        const lut = parseCube(bytes);
        self.postMessage({ id, type: 'done', size: lut.size, data: lut.data, domainMin: lut.domainMin, domainMax: lut.domainMax }, [lut.data.buffer]);
    } catch (error) {
        self.postMessage({ id, type: 'error', message: String(error && error.message || error) });
    }
};

function parseCube(bytes) {
    const length = bytes.length;
    let position = 0;
    let size = 0;
    let data = null;
    let count = 0;
    const domainMin = [0, 0, 0];
    const domainMax = [1, 1, 1];

    const readLine = () => {
        const start = position;
        while (position < length && bytes[position] !== 10) position++;
        const end = position;
        position++;
        return [start, end];
    };

    const text = (start, end) => {
        let result = '';
        for (let index = start; index < end; index++) result += String.fromCharCode(bytes[index]);
        return result.trim();
    };

    while (position < length) {
        const [start, end] = readLine();
        let cursor = start;
        while (cursor < end && (bytes[cursor] === 32 || bytes[cursor] === 9 || bytes[cursor] === 13)) cursor++;
        if (cursor >= end) continue;
        const first = bytes[cursor];
        const isNumber = (first >= 48 && first <= 57) || first === 45 || first === 46 || first === 43;
        if (!isNumber) {
            const line = text(cursor, end);
            const parts = line.split(/\s+/);
            if (parts[0] === 'LUT_3D_SIZE') {
                size = parseInt(parts[1], 10);
                data = new Float32Array(size * size * size * 3);
            } else if (parts[0] === 'DOMAIN_MIN') {
                for (let channel = 0; channel < 3; channel++) domainMin[channel] = parseFloat(parts[channel + 1]);
            } else if (parts[0] === 'DOMAIN_MAX') {
                for (let channel = 0; channel < 3; channel++) domainMax[channel] = parseFloat(parts[channel + 1]);
            }
            continue;
        }
        if (!data) throw new Error('LUT_3D_SIZE missing');
        for (let channel = 0; channel < 3; channel++) {
            while (cursor < end && (bytes[cursor] === 32 || bytes[cursor] === 9)) cursor++;
            let sign = 1;
            if (bytes[cursor] === 45) { sign = -1; cursor++; } else if (bytes[cursor] === 43) cursor++;
            let value = 0;
            while (cursor < end && bytes[cursor] >= 48 && bytes[cursor] <= 57) {
                value = value * 10 + (bytes[cursor] - 48);
                cursor++;
            }
            if (bytes[cursor] === 46) {
                cursor++;
                let scale = 0.1;
                while (cursor < end && bytes[cursor] >= 48 && bytes[cursor] <= 57) {
                    value += (bytes[cursor] - 48) * scale;
                    scale *= 0.1;
                    cursor++;
                }
            }
            if (bytes[cursor] === 101 || bytes[cursor] === 69) {
                cursor++;
                let expSign = 1;
                if (bytes[cursor] === 45) { expSign = -1; cursor++; } else if (bytes[cursor] === 43) cursor++;
                let exponent = 0;
                while (cursor < end && bytes[cursor] >= 48 && bytes[cursor] <= 57) {
                    exponent = exponent * 10 + (bytes[cursor] - 48);
                    cursor++;
                }
                value *= Math.pow(10, expSign * exponent);
            }
            data[count++] = sign * value;
        }
    }

    if (!size || count !== size * size * size * 3) {
        throw new Error(`LUT data mismatch: expected ${size * size * size}, got ${count / 3}`);
    }
    return { size, data, domainMin, domainMax };
}
