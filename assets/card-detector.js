// Local YOLOv8 card detector. The model was trained on standard playing cards.
(function (root) {
    const ranks = ['10', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'J', 'K', 'Q'];
    const suits = ['♣', '♦', '♥', '♠'];
    let sessionPromise;

    function intersectionOverUnion(a, b) {
        const w = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
        const h = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
        const overlap = w * h;
        return overlap / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - overlap);
    }

    // Output is [1, 56, 8400]: center x/y, width/height and 52 class scores.
    function decode(data, dims, threshold = 0.35) {
        if (dims.length !== 3 || dims[0] !== 1 || dims[1] !== 56) throw new Error('Unexpected card model output.');
        const count = dims[2];
        const candidates = [];
        for (let i = 0; i < count; i++) {
            let score = threshold, cls = -1;
            for (let c = 0; c < 52; c++) {
                if (data[(c + 4) * count + i] > score) {
                    score = data[(c + 4) * count + i]; cls = c;
                }
            }
            if (cls < 0) continue;
            const x = data[i], y = data[count + i], w = data[2 * count + i], h = data[3 * count + i];
            if (!Number.isFinite(x + y + w + h) || w <= 0 || h <= 0) continue;
            candidates.push({ x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2, score, cls });
        }
        candidates.sort ( (a, b) => b.score - a.score );
        const kept = [];
        for (const box of candidates) {
            // Class-agnostic NMS prevents one card being read as two different cards.
            if (!kept.some(other => intersectionOverUnion(box, other) > 0.45)) kept.push(box);
        }
        return kept.sort((a, b) => a.x1 - b.x1).map(box => {
            const suit = suits[box.cls % 4];
            return { rank: ranks[Math.floor(box.cls / 4)], suit, color: suit === '♥' || suit === '♦' ? 'red' : 'black', confidence: box.score };
        });
    }

    async function detect(image) {
        if (!root.ort) throw new Error('The local recognition library could not be loaded. Use the manual selector or reload the page.');
        root.ort.env.wasm.numThreads = 1;
        root.ort.env.wasm.wasmPaths = new URL('assets/ort/', document.baseURI).href;
        if (!sessionPromise) {
            sessionPromise = root.ort.InferenceSession.create('assets/playing-cards.onnx', { executionProviders: ['wasm'] }).catch(error => { sessionPromise = null; throw error; });
        }
        const session = await sessionPromise;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 640;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = 'rgb(114,114,114)';
        ctx.fillRect(0, 0, 640, 640);
        const scale = Math.min(640 / image.width, 640 / image.height);
        const w = Math.round(image.width * scale), h = Math.round(image.height * scale);
        ctx.drawImage(image, Math.round((640 - w) / 2), Math.round((640 - h) / 2), w, h);
        const pixels = ctx.getImageData(0, 0, 640, 640).data;
        const area = 640 * 640, input = new Float32Array(area * 3);
        for (let i = 0; i < area; i++) {
            input[i] = pixels[i * 4] / 255;
            input[area + i] = pixels[i * 4 + 1] / 255;
            input[area * 2 + i] = pixels[i * 4 + 2] / 255;
        }
        const outputs = await session.run({ [session.inputNames[0]]: new root.ort.Tensor('float32', input, [1, 3, 640, 640]) });
        const result = outputs[session.outputNames[0]];
        return decode(result.data, result.dims);
    }
    root.CardDetector = { detect, decode };
})(globalThis);
