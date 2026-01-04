# Kakushi Unit-Test Blueprint (kakushi_tdd.md)

## Scope
Unit tests for `scripts/kakushi.js` covering `peek`, `seal`, `reveal`, and helper utilities exposed via `window.OkazuTestables.kakushi`.

## Test Harness & Conventions
- **Environment**: JSDOM + Canvas (e.g., `canvas` npm package) or browser-based test runner.
- **Helpers**:
  - `makeCanvas(w, h, fillRGBA)` -> returns HTMLCanvasElement.
  - `setPixel(ctx, x, y, [r,g,b,a])` -> writes a single pixel.
  - `getPixel(ctx, x, y)` -> reads pixel.
  - `rgbaIndex(x, y, w)` -> `((y * w) + x) * 4`.
  - `asImageData(canvas)` -> `ctx.getImageData(0,0,w,h)`.
- **Magic**: expect header bytes `0x4F 0x4B 0x5A 0x31`.
- **Bit order**: LSB embedding uses MSB-first per byte (`bitIndex` increases from 0..7, mask `(byte >> (7 - bitIndex)) & 1`).

## Shared Fixtures
- **Opaque base canvas**: 4x4, every pixel `[10, 20, 30, 255]`.
- **Transparent pixel canvas**: 4x4, all opaque except `(0,0)` alpha `0`.
- **Mask data**: ImageData-like array with same length as `imageData.data`.
  - `maskNone`: all zeros (no masking).
  - `maskAt00`: same size, alpha 255 at `(0,0)` only, rest 0.
- **Payload fixtures**:
  - `payloadSmall = new Uint8Array([0b10101010, 0b11001100])`.
  - `payloadEmpty = new Uint8Array([])`.

## `peek` Tests
### 1. Header detection (magic present, opaque, no mask)
- **Scenario**: Header is embedded at the first opaque pixel block.
- **Setup**:
  - Create 2x2 canvas, all opaque.
  - Manually write header bits into first pixels with `embedBytes(data, MAGIC+length=0)` using test helper.
- **Inputs**: `peek(canvas)`.
- **Expected**: returns `true`.
- **Assertions**:
  - `expect(result).toBe(true)`.

### 2. Header detection (magic absent)
- **Scenario**: No embedded magic.
- **Setup**: 2x2 opaque canvas with all RGB LSBs = 0.
- **Inputs**: `peek(canvas)`.
- **Expected**: returns `false`.
- **Assertions**:
  - `expect(result).toBe(false)`.

### 3. Mask filtering skips masked pixels
- **Scenario**: Magic exists only under masked pixels; peek should miss it.
- **Setup**:
  - 2x2 opaque canvas.
  - Embed magic into pixels that are masked (set mask alpha 255 for those indices).
  - `maskAt00` marks `(0,0)` as masked, embed header starting at `(0,0)`.
- **Inputs**: `peek(canvas, { mask: maskAt00 })`.
- **Expected**: returns `false`.
- **Assertions**:
  - `expect(result).toBe(false)`.

### 4. Error handling when context unavailable
- **Scenario**: `getContextForReading` returns `null`.
- **Setup**:
  - Pass a fake object lacking canvas/context and simulate `getContextForReading` returning null (spy/monkeypatch).
- **Inputs**: `peek(fakeSource)`.
- **Expected**: returns `false` and does not throw.
- **Assertions**:
  - `expect(result).toBe(false)`.

## `seal` Tests
### 1. Capacity calculation excludes transparent and masked pixels
- **Scenario**: Only opaque + unmasked pixels count toward capacity.
- **Setup**:
  - 4x1 canvas: pixels 0–2 opaque, pixel 3 alpha 0.
  - Mask pixel 1 (alpha 255 in mask).
  - Effective opaque capacity = 2 pixels.
- **Inputs**: `seal(canvas, "A", { mask })` with mocked `compressString` returning 1 byte payload.
- **Expected**: capacity uses 2 pixels (6 bits) < needed bits (header 8 bytes + payload) => throws.
- **Assertions**:
  - `expect(seal).rejects.toThrow("Payload too large")`.

### 2. Payload length check uses compressed length
- **Scenario**: Compressed payload length is in header length field.
- **Setup**:
  - Stub `compressString` to return `Uint8Array([1,2,3,4])` (len 4).
  - Large opaque canvas (e.g., 20x20).
- **Inputs**: `seal(canvas, "hello")`.
- **Expected**: header bytes 4–7 encode `0x00000004` (big-endian).
- **Assertions**:
  - Extract header via `extractBytes` and compare: `bytes[4..7] == [0,0,0,4]`.

### 3. Proper header writing (MAGIC)
- **Scenario**: Header includes magic at bytes 0–3.
- **Setup**: Use same as above.
- **Inputs**: `seal(canvas, "hello")`.
- **Expected**: header bytes 0–3 equal `MAGIC`.
- **Assertions**:
  - `expect(header.slice(0,4)).toEqual(new Uint8Array([0x4F,0x4B,0x5A,0x31]))`.

### 4. embedBytes bit order is MSB-first
- **Scenario**: First byte `0b10100000` embeds bits into RGB LSBs in order.
- **Setup**:
  - 1x1 pixel opaque canvas (RGB initial all zero).
  - Call `embedBytes(data, [0b10100000], null)`.
- **Inputs**: `embedBytes`.
- **Expected**: RGB LSBs become `1,0,1` for the first 3 bits.
- **Assertions**:
  - `expect(data[0] & 1).toBe(1)`
  - `expect(data[1] & 1).toBe(0)`
  - `expect(data[2] & 1).toBe(1)`

### 5. Throws on insufficient capacity
- **Scenario**: Not enough opaque pixels for header + payload.
- **Setup**: 1x1 opaque canvas; payload minimal.
- **Inputs**: `seal(canvas, "A")`.
- **Expected**: throws error with "Payload too large".
- **Assertions**:
  - `await expect(seal(...)).rejects.toThrow(/Payload too large/)`.

### 6. Final canvas output contains embedded payload
- **Scenario**: Returned canvas has modified LSBs.
- **Setup**:
  - 2x2 opaque canvas.
  - Stub `compressString` to return 1 byte.
- **Inputs**: `seal(canvas, "X")`.
- **Expected**: at least one RGB LSB is flipped from initial 0.
- **Assertions**:
  - Count LSB changes; `expect(changedCount).toBeGreaterThan(0)`.

## `reveal` Tests
### 1. Header missing branch
- **Scenario**: No magic in LSBs.
- **Setup**: 2x2 opaque canvas with LSBs cleared.
- **Inputs**: `reveal(canvas)`.
- **Expected**: `{ headerFound:false, secret:null, error:null }` and cleanImage unchanged.
- **Assertions**:
  - `expect(result.headerFound).toBe(false)`
  - `expect(result.secret).toBeNull()`

### 2. Empty payload handling
- **Scenario**: Header length = 0.
- **Setup**:
  - Embed header with length 0 (MAGIC + 0).
- **Inputs**: `reveal(canvas)`.
- **Expected**: secret is empty string and bits wiped for header region.
- **Assertions**:
  - `expect(result.secret).toBe("")`
  - `expect(lsbRegionAfter).toBeAllZeros()` for first `HEADER_BYTES * 8` bits.

### 3. Payload extraction length
- **Scenario**: Header length indicates N bytes.
- **Setup**:
  - Embed header length 2 plus payload `[0xAA, 0x55]`.
- **Inputs**: `reveal(canvas)` with stubbed `decompressString` to echo payload.
- **Expected**: `extractBytes` reads `HEADER_BYTES + 2` bytes.
- **Assertions**:
  - `expect(compressedPayload).toEqual(new Uint8Array([0xAA,0x55]))`.

### 4. sanitizeRegion wipes bits
- **Scenario**: After reveal, embedded region LSBs zeroed.
- **Setup**:
  - Embed header + payload.
  - Call `reveal`.
- **Inputs**: `reveal(canvas)`.
- **Expected**: LSBs of affected pixels are 0.
- **Assertions**:
  - For each affected RGB channel index, `expect(data[i] & 1).toBe(0)`.

### 5. Successful decompression path
- **Scenario**: Valid compressed payload.
- **Setup**:
  - Stub `decompressString` to return "secret".
- **Inputs**: `reveal(canvas)`.
- **Expected**: `{ secret:"secret", error:null, headerFound:true }`.
- **Assertions**:
  - `expect(result.secret).toBe("secret")`
  - `expect(result.error).toBeNull()`.

### 6. Decompression failure path sets error
- **Scenario**: `decompressString` throws.
- **Setup**: Stub to throw `new Error("bad gzip")`.
- **Inputs**: `reveal(canvas)`.
- **Expected**: `{ secret:null, headerFound:true, error:"bad gzip" }`.
- **Assertions**:
  - `expect(result.error).toBe("bad gzip")`
  - `expect(result.secret).toBeNull()`.

### 7. Returned clean image
- **Scenario**: Returned canvas after reveal is sanitized.
- **Setup**: Embed payload and call `reveal`.
- **Inputs**: `reveal(canvas)`.
- **Expected**: `cleanImage` has LSBs zeroed in the embedded region.
- **Assertions**:
  - Read `cleanImage` data and assert `data[i] & 1 === 0` for bits wiped.

## Helper Tests
### 1. `getContextForReading` with canvas/context/source
- **Scenario**: Accepts `HTMLCanvasElement`, `CanvasRenderingContext2D`, and `HTMLImageElement`/`ImageBitmap`.
- **Setup**: Create canvas + context; create image fixture drawn into canvas.
- **Inputs**: call `getContextForReading(source, w, h)` for each type.
- **Expected**: returns 2D context with pixel data matching source.
- **Assertions**:
  - `expect(ctx.getImageData(0,0,1,1).data[3]).toBe(255)`.

### 2. `normalizeMask`/`isMasked` behavior
- **Scenario**: `normalizeMask` accepts `options.data`, `options.mask`, or raw mask. `isMasked` checks alpha > 0.
- **Setup**: mask array length matches data length; set alpha=1 at `(0,0)`.
- **Inputs**: `normalizeMask({ mask })`, `normalizeMask({ data: mask })`, `normalizeMask(mask)`.
- **Expected**: returns mask; `isMasked(mask, idx00)` true, `isMasked(mask, idx01)` false.
- **Assertions**:
  - `expect(isMasked(mask, idx00)).toBe(true)`
  - `expect(isMasked(mask, idx01)).toBe(false)`.

### 3. `embedBytes`/`extractBytes` round-trip
- **Scenario**: Embedding then extracting yields identical payload.
- **Setup**: 4x4 opaque canvas; payload `[0xDE, 0xAD, 0xBE, 0xEF]`.
- **Inputs**: `embedBytes(data, payload)` then `extractBytes(data, payload.length)`.
- **Expected**: extracted bytes equal input.
- **Assertions**:
  - `expect(extracted).toEqual(payload)`.

### 4. `sanitizeRegion` bit count accuracy
- **Scenario**: Wipes exact number of bits.
- **Setup**: 2x2 opaque canvas with all RGB LSBs set to 1 (set RGB to 255).
- **Inputs**: `sanitizeRegion(data, 5)`.
- **Expected**: first 5 writable RGB channels have LSB=0, the rest remain 1.
- **Assertions**:
  - `expect(lsbAt(0)).toBe(0)` ... `expect(lsbAt(4)).toBe(0)`
  - `expect(lsbAt(5)).toBe(1)`.

### 5. `hasMagic` matching
- **Scenario**: Correct magic matches; others do not.
- **Setup**: `Uint8Array([0x4F,0x4B,0x5A,0x31])` and `Uint8Array([0,1,2,3])`.
- **Inputs**: `hasMagic(arr)`.
- **Expected**: true for magic, false for non-magic.
- **Assertions**:
  - `expect(hasMagic(magic)).toBe(true)`
  - `expect(hasMagic(other)).toBe(false)`.

### 6. `toHex` output formatting
- **Scenario**: Uppercase hex with `0x` prefix and padded bytes.
- **Setup**: `Uint8Array([0, 15, 255])`.
- **Inputs**: `toHex(bytes)`.
- **Expected**: `"0x00 0x0F 0xFF"`.
- **Assertions**:
  - `expect(toHex(bytes)).toBe("0x00 0x0F 0xFF")`.
