(function() {
    if (!window.TestRunner) {
        console.warn('TestRunner not available; skipping test registration.');
        return;
    }

    const { register, assert, assertEqual, assertApprox, assertDeepEqual } = window.TestRunner;

    register('Input.rotatePoint 90deg', () => {
        const input = window.OkazuTestables && window.OkazuTestables.input;
        assert(input, 'Input testables missing');
        const p = input.rotatePoint({ x: 1, y: 0 }, 0, 0, 90);
        assertApprox(p.x, 0, 1e-6);
        assertApprox(p.y, 1, 1e-6);
    });

    register('Input truth/visual round-trip', () => {
        const input = window.OkazuTestables && window.OkazuTestables.input;
        assert(input, 'Input testables missing');
        const fullW = 100;
        const fullH = 50;
        const rot = 90;
        const original = { x: 12, y: 22 };
        const visual = input.truthToVisualCoordsRaw(original.x, original.y, fullW, fullH, rot);
        const truth = input.visualToTruthCoordsRaw(visual.x, visual.y, fullW, fullH, rot);
        assertApprox(truth.x, original.x, 1e-6);
        assertApprox(truth.y, original.y, 1e-6);
    });

    register('Adjustments HSL <-> RGB round-trip', () => {
        const adj = window.OkazuTestables && window.OkazuTestables.adjustments;
        assert(adj, 'Adjustments testables missing');
        const rgb = [200, 100, 50];
        const [h, s, l] = adj.rgbToHsl(...rgb);
        const [r2, g2, b2] = adj.hslToRgb(h, s, l);
        assertEqual(r2, rgb[0]);
        assertEqual(g2, rgb[1]);
        assertEqual(b2, rgb[2]);
    });

    register('Adjustments getBandWeight width cutoff', () => {
        const adj = window.OkazuTestables && window.OkazuTestables.adjustments;
        assert(adj, 'Adjustments testables missing');
        const weight = adj.getBandWeight(90, 0);
        assertEqual(weight, 0);
        const weightCenter = adj.getBandWeight(0, 0);
        assert(weightCenter > 0, 'Expected non-zero weight at center');
    });

    register('Kakushi embed/extract bytes round-trip', () => {
        const kakushi = window.OkazuTestables && window.OkazuTestables.kakushi;
        assert(kakushi, 'Kakushi testables missing');
        const data = new Uint8ClampedArray(24);
        for (let i = 0; i < data.length; i += 4) {
            data[i + 3] = 255;
        }
        const payload = new Uint8Array([0xAA, 0x55]);
        kakushi.embedBytes(data, payload, null);
        const extracted = kakushi.extractBytes(data, payload.length, null);
        assertDeepEqual(Array.from(extracted), Array.from(payload));
    });

    register('Stego detects default adjustments as clean', () => {
        const stego = window.OkazuTestables && window.OkazuTestables.stego;
        const main = window.OkazuTestables && window.OkazuTestables.main;
        assert(stego && main, 'Stego or main testables missing');
        const state = main.createDefaultState();
        const packet = stego.getAdjustmentsPacket(state);
        assertEqual(packet, null);
        state.adjustments.gamma = 1.2;
        const packetDirty = stego.getAdjustmentsPacket(state);
        assert(packetDirty !== null, 'Expected adjustments to be detected');
    });

    register('BrushKernel softness clamps to 0-1', () => {
        assert(window.BrushKernel, 'BrushKernel missing');
        const soft = window.BrushKernel.getSoftness(10, 0, false);
        assertEqual(soft, 0);
        const softMax = window.BrushKernel.getSoftness(10, 999, true);
        assertEqual(softMax, 1);
    });
})();
