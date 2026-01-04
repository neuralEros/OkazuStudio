1. Scope and Environment Setup
    [x] 1.1. Define test scope for scripts/kakushi.js
        # Covers functions: peek, seal, reveal, and helper utilities exposed via window.OkazuTestables.kakushi
    [x] 1.2. Configure Environment
        # JSDOM + Canvas (e.g., canvas npm package) or browser-based test runner
    [x] 1.3. Implement Test Helpers
        [x] 1.3.1. makeCanvas(w, h, fillRGBA)
            # Returns HTMLCanvasElement
        [x] 1.3.2. setPixel(ctx, x, y, [r,g,b,a])
            # Writes a single pixel
        [x] 1.3.3. getPixel(ctx, x, y)
            # Reads pixel
        [x] 1.3.4. rgbaIndex(x, y, w)
            # formula: ((y * w) + x) * 4
        [x] 1.3.5. asImageData(canvas)
            # ctx.getImageData(0,0,w,h)
    [x] 1.4. Define Protocol Constants
        # Magic: Header bytes 0x4F 0x4B 0x5A 0x31
        # Bit order: LSB embedding uses MSB-first per byte 
        # (bitIndex increases from 0..7, mask (byte >> (7 - bitIndex)) & 1)

2. Shared Fixtures
    [x] 2.1. Opaque base canvas
        # 4x4, every pixel [10, 20, 30, 255]
    [x] 2.2. Transparent pixel canvas
        # 4x4, all opaque except (0,0) alpha 0
    [x] 2.3. Mask data
        # ImageData-like array with same length as imageData.data
        [x] 2.3.1. maskNone: all zeros (no masking)
        [x] 2.3.2. maskAt00: same size, alpha 255 at (0,0) only, rest 0
    [x] 2.4. Payload fixtures
        [x] 2.4.1. payloadSmall: new Uint8Array([0b10101010, 0b11001100])
        [x] 2.4.2. payloadEmpty: new Uint8Array([])

3. peek Tests
    [x] 3.1. Header detection (magic present, opaque, no mask)
        # Setup: Create 2x2 canvas, all opaque.
        # Setup: Manually write header bits into first pixels with embedBytes(data, MAGIC+length=0) using test helper.
        # Inputs: peek(canvas)
        # Assertions: expect(result).toBe(true)
    [x] 3.2. Header detection (magic absent)
        # Setup: 2x2 opaque canvas with all RGB LSBs = 0.
        # Inputs: peek(canvas)
        # Assertions: expect(result).toBe(false)
    [x] 3.3. Mask filtering skips masked pixels
        # Setup: 2x2 opaque canvas.
        # Setup: Embed magic into pixels that are masked (set mask alpha 255 for those indices).
        # Setup: maskAt00 marks (0,0) as masked, embed header starting at (0,0).
        # Inputs: peek(canvas, { mask: maskAt00 })
        # Assertions: expect(result).toBe(false)
    [x] 3.4. Error handling when context unavailable
        # Setup: Pass a fake object lacking canvas/context and simulate getContextForReading returning null (spy/monkeypatch).
        # Inputs: peek(fakeSource)
        # Assertions: expect(result).toBe(false) and does not throw.

4. seal Tests
    [x] 4.1. Capacity calculation excludes transparent and masked pixels
        # Setup: 4x1 canvas: pixels 0–2 opaque, pixel 3 alpha 0.
        # Setup: Mask pixel 1 (alpha 255 in mask).
        # Setup: Effective opaque capacity = 2 pixels.
        # Inputs: seal(canvas, "A", { mask }) with mocked compressString returning 1 byte payload.
        # Assertions: capacity uses 2 pixels (6 bits) < needed bits (header 8 bytes + payload) => expect(seal).rejects.toThrow("Payload too large").
    [x] 4.2. Payload length check uses compressed length
        # Setup: Stub compressString to return Uint8Array([1,2,3,4]) (len 4).
        # Setup: Large opaque canvas (e.g., 20x20).
        # Inputs: seal(canvas, "hello")
        # Assertions: extract header via extractBytes and compare: bytes[4..7] == [0,0,0,4] (big-endian 0x00000004).
    [x] 4.3. Proper header writing (MAGIC)
        # Setup: Use large opaque canvas.
        # Inputs: seal(canvas, "hello")
        # Assertions: expect(header.slice(0,4)).toEqual(new Uint8Array([0x4F,0x4B,0x5A,0x31])).
    [x] 4.4. embedBytes bit order is MSB-first
        # Setup: 1x1 pixel opaque canvas (RGB initial all zero).
        # Inputs: Call embedBytes(data, [0b10100000], null).
        # Assertions: RGB LSBs become 1,0,1 for the first 3 bits.
        # expect(data[0] & 1).toBe(1); expect(data[1] & 1).toBe(0); expect(data[2] & 1).toBe(1).
    [x] 4.5. Throws on insufficient capacity
        # Setup: 1x1 opaque canvas; payload minimal.
        # Inputs: seal(canvas, "A")
        # Assertions: await expect(seal(...)).rejects.toThrow(/Payload too large/).
    [x] 4.6. Final canvas output contains embedded payload
        # Setup: 2x2 opaque canvas.
        # Setup: Stub compressString to return 1 byte.
        # Inputs: seal(canvas, "X")
        # Assertions: Count LSB changes; expect(changedCount).toBeGreaterThan(0).

5. reveal Tests
    [x] 5.1. Header missing branch
        # Setup: 2x2 opaque canvas with LSBs cleared.
        # Inputs: reveal(canvas)
        # Assertions: expect(result.headerFound).toBe(false); expect(result.secret).toBeNull(); cleanImage remains unchanged.
    [x] 5.2. Empty payload handling
        # Setup: Embed header with length 0 (MAGIC + 0).
        # Inputs: reveal(canvas)
        # Assertions: expect(result.secret).toBe(""); expect(lsbRegionAfter).toBeAllZeros() for first HEADER_BYTES * 8 bits.
    [x] 5.3. Payload extraction length
        # Setup: Embed header length 2 plus payload [0xAA, 0x55].
        # Inputs: reveal(canvas) with stubbed decompressString to echo payload.
        # Assertions: expect(compressedPayload).toEqual(new Uint8Array([0xAA,0x55])); extractBytes reads HEADER_BYTES + 2 bytes.
    [x] 5.4. sanitizeRegion wipes bits
        # Setup: Embed header + payload.
        # Inputs: reveal(canvas)
        # Assertions: For each affected RGB channel index, expect(data[i] & 1).toBe(0).
    [x] 5.5. Successful decompression path
        # Setup: Stub decompressString to return "secret".
        # Inputs: reveal(canvas)
        # Assertions: expect(result.secret).toBe("secret"); expect(result.error).toBeNull(); expect(result.headerFound).toBe(true).
    [x] 5.6. Decompression failure path sets error
        # Setup: Stub decompressString to throw new Error("bad gzip").
        # Inputs: reveal(canvas)
        # Assertions: expect(result.error).toBe("bad gzip"); expect(result.secret).toBeNull(); expect(result.headerFound).toBe(true).
    [x] 5.7. Returned clean image
        # Setup: Embed payload and call reveal.
        # Inputs: reveal(canvas)
        # Assertions: Read cleanImage data and assert data[i] & 1 === 0 for bits wiped in the embedded region.

6. Helper Tests
    [x] 6.1. getContextForReading with canvas/context/source
        # Scenario: Accepts HTMLCanvasElement, CanvasRenderingContext2D, and HTMLImageElement/ImageBitmap.
        # Setup: Create canvas + context; create image fixture drawn into canvas.
        # Inputs: call getContextForReading(source, w, h) for each type.
        # Assertions: expect(ctx.getImageData(0,0,1,1).data[3]).toBe(255).
    [x] 6.2. normalizeMask/isMasked behavior
        # Scenario: normalizeMask accepts options.data, options.mask, or raw mask. isMasked checks alpha > 0.
        # Setup: mask array length matches data length; set alpha=1 at (0,0).
        # Inputs: normalizeMask({ mask }), normalizeMask({ data: mask }), normalizeMask(mask).
        # Assertions: expect(isMasked(mask, idx00)).toBe(true); expect(isMasked(mask, idx01)).toBe(false).
    [x] 6.3. embedBytes/extractBytes round-trip
        # Setup: 4x4 opaque canvas; payload [0xDE, 0xAD, 0xBE, 0xEF].
        # Inputs: embedBytes(data, payload) then extractBytes(data, payload.length).
        # Assertions: expect(extracted).toEqual(payload).
    [x] 6.4. sanitizeRegion bit count accuracy
        # Setup: 2x2 opaque canvas with all RGB LSBs set to 1 (set RGB to 255).
        # Inputs: sanitizeRegion(data, 5)
        # Assertions: first 5 writable RGB channels have LSB=0, the rest remain 1.
        # expect(lsbAt(0)).toBe(0) ... expect(lsbAt(4)).toBe(0); expect(lsbAt(5)).toBe(1).
    [x] 6.5. hasMagic matching
        # Setup: Uint8Array([0x4F,0x4B,0x5A,0x31]) and Uint8Array([0,1,2,3]).
        # Inputs: hasMagic(arr)
        # Assertions: true for magic, false for non-magic.
    [x] 6.6. toHex output formatting
        # Setup: Uint8Array([0, 15, 255]).
        # Inputs: toHex(bytes)
        # Assertions: expect(toHex(bytes)).toBe("0x00 0x0F 0xFF") (Uppercase with 0x prefix and padded bytes).

