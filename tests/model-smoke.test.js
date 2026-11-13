// Smoke-test the bundled WASM runtime and model with a blank image.
// Run with: node tests/model-smoke.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ort = require('../assets/ort/ort.wasm.min.js');
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = path.resolve(__dirname, '../assets/ort') + '/';
(async () => {
    const model = await ort.InferenceSession.create(fs.readFileSync(path.resolve(__dirname, '../assets/playing-cards.onnx')));
    const input = new ort.Tensor('float32', new Float32Array(3 * 640 * 640), [1, 3, 640, 640]);
    const outputs = await model.run({ [model.inputNames[0]]: input });
    assert.deepEqual(outputs[model.outputNames[0]].dims, [1, 56, 8400]);
    console.log('Bundled local model and WASM runtime loaded and ran successfully');
})().catch(error => { console.error(error); process.exitCode = 1; });
