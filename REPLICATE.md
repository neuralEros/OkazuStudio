Replicate HTTP API usage: jingyunliang/swinir (pinned version)

MODEL VERSION (HARD-PIN)
- Version ID: 660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a
- Always run this exact version by sending that version ID in your prediction request (do not rely on “latest”).

BASE URL
- https://api.replicate.com

AUTH
- Predictions endpoints: Authorization: Bearer <REPLICATE_API_TOKEN>
- Files endpoints (see “Uploading files via Files API”): Replicate’s HTTP reference examples use Authorization: Token <REPLICATE_API_TOKEN>. If Bearer fails (401) on /v1/files, switch to Token.

RUNNING THE MODEL (CORE FLOW)
1) Create prediction (POST /v1/predictions)
2) Poll prediction status (GET /v1/predictions/{id}) until terminal
3) Consume output (download immediately; output URLs expire)

PREDICTION CREATE (HTTP)
POST https://api.replicate.com/v1/predictions
Headers:
- Authorization: Bearer <token>
- Content-Type: application/json
Optional headers:
- Prefer: wait            (wait up to 60s)
- Prefer: wait=n          (n = 1..60 seconds; sync wait window)
- Cancel-After: <duration> (e.g. 30s, 5m, 1h30m45s; min 5s; auto-cancel wall clock from creation)

Body (minimal):
{
  "version": "660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
  "input": {
    "image": "<IMAGE_INPUT>",
    "task_type": "Real-World Image Super-Resolution-Large",
    "noise": 15,
    "jpeg": 40
  }
}

Optional webhook fields (recommended for async backends):
- "webhook": "https://your.service/replicate-webhook"
- "webhook_events_filter": ["start","output","logs","completed"]
Notes:
- Replicate will POST the same shape as predictions.get. Webhooks can retry; handler must be idempotent.
- Replicate will not follow redirects; webhook URL must resolve without redirecting.

PREDICTION OBJECT (WHAT YOU GET BACK)
Key fields you should rely on:
- id: prediction id
- status: "starting" | "processing" | "succeeded" | "failed" | "canceled"
- input: echo of inputs
- output: model outputs when available (for this model: an image file output)
- error: error string or null
- logs: text logs (can be empty)
- created_at / started_at / completed_at timestamps
- urls.get: canonical URL for polling (predictions.get)
(Some predictions also include urls.stream for SSE when supported.)

POLLING
GET https://api.replicate.com/v1/predictions/{prediction_id}
Headers:
- Authorization: Bearer <token>

Stop conditions:
- succeeded: output is ready
- failed: error is set; logs often contain detail
- canceled: no output (or partial output depending on model behavior)

CANCELING A PREDICTION (MANUAL CANCEL ENDPOINT)
- Endpoint: POST https://api.replicate.com/v1/predictions/{prediction_id}/cancel
- Use when you want to stop a long-running job (or enforce your own timeouts in addition to Cancel-After).
- Only meaningful while status is starting/processing; canceling a terminal prediction is a no-op.

MODEL INPUTS (jingyunliang/swinir pinned version)
input.image (required)
- Type: string, representing a file (see “Image input options”)
input.task_type (string)
- Default: "Real-World Image Super-Resolution-Large"
- Known task strings for this version:
  - "Real-World Image Super-Resolution-Large"
  - "Real-World Image Super-Resolution-Medium"
  - "Grayscale Image Denoising"
  - "Color Image Denoising"
  - "JPEG Compression Artifact Reduction"
input.noise (integer)
- Default: 15
- Used for the denoising tasks; ignored for non-denoising tasks.
input.jpeg (integer)
- Default: 40
- Used for JPEG artifact reduction; ignored for other tasks.

IMAGE INPUT OPTIONS (HOW TO PROVIDE input.image)
You have four practical choices. Pick based on size, reuse, and operational simplicity.

Option A: Hosted HTTPS URL
- input.image = "https://your-cdn/path/image.png"
- Use this for anything non-trivial in size, for repeated use, or for stable provenance.

Option B: Data URI (inline base64; only for small files)
- input.image = "data:image/png;base64,AAAA..."
- Replicate guidance: intended for small files (HTTP API docs use <=256KB; “Input files” topic recommends <1MB).
- Do not use for large images; you will hit request size limits and/or slow requests.

Option C: Local file via official client libraries
- Node: pass a Blob/File/Buffer (up to 100MB) and the library uploads behind the scenes.
- This is the simplest way to “upload to Replicate” if you are already using the client library.

Option D: Upload via Replicate Files API, then pass the returned file URL (Use this for OkazuStudio)
- Step 1: POST /v1/files with multipart/form-data to create a file object in Replicate.
- Step 2: Use file.urls.get as input.image.
- Files created this way are temporary; plan for expiry (see below).

UPLOADING FILES VIA FILES API (OPTION D)
Create file:
POST https://api.replicate.com/v1/files
Headers:
- Authorization: Token <token>     (per Replicate HTTP reference examples; try Bearer if your environment standardizes on it)
- Content-Type: multipart/form-data

Form parts:
- content: the binary file payload
  Example: -F 'content=@/path/to/image.png;type=image/png;filename=image.png'
- metadata (optional): JSON metadata
  Example: -F 'metadata={"customer_reference_id":123};type=application/json'

Response:
- Returns a file object with an id and URLs; use file.urls.get as the value of input.image.

File lifetime / expiry:
- Client-library-uploaded files are described as expiring after ~24 hours (treat Files API uploads as temporary as well).
- If you need longer retention, host yourself (Option A) or reupload on demand.

MODEL OUTPUT HANDLING (FILES)
- For API-created predictions, output file URLs are served from replicate.delivery and expire after 1 hour. Save the result immediately (download/copy to your own storage).
- If you use Replicate’s client libraries v1.x, replicate.run() may return FileOutput objects instead of raw URLs:
  - Python: FileOutput.read() returns bytes; FileOutput.url gives a temporary URL.
  - JS: FileOutput can be written/streamed; it also exposes a url.

CLIENT SNIPPETS

1) cURL (hosted URL input, async)
curl -s -X POST \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
    "input": {
      "image": "https://example.com/in.png",
      "task_type": "Real-World Image Super-Resolution-Large",
      "noise": 15,
      "jpeg": 40
    }
  }' \
  https://api.replicate.com/v1/predictions

2) cURL (sync wait up to N seconds + hard runtime cap)
curl -s -X POST \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: wait=60" \
  -H "Cancel-After: 5m" \
  -d '{
    "version": "660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
    "input": { "image": "https://example.com/in.png" }
  }' \
  https://api.replicate.com/v1/predictions

3) Python (official client library; local file upload)
import replicate

output = replicate.run(
  "jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
  input={
    "image": open("in.png", "rb"),
    "task_type": "Real-World Image Super-Resolution-Large",
    "noise": 15,
    "jpeg": 40,
  }
)

# If output is a FileOutput (common in client v1.x), save bytes:
with open("out.png", "wb") as f:
  # output may be a single FileOutput or a list; handle both patterns.
  if hasattr(output, "read"):
    f.write(output.read())
  else:
    f.write(output[0].read())

4) Node.js (official client library; local file upload with Buffer)
import Replicate from "replicate";
import fs from "node:fs";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const inputImage = fs.readFileSync("in.png"); // Buffer (<=100MB supported by docs)
const out = await replicate.run(
  "jingyunliang/swinir:660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a",
  {
    input: {
      image: inputImage,
      task_type: "Real-World Image Super-Resolution-Large",
      noise: 15,
      jpeg: 40
    }
  }
);

// out may be a FileOutput or array of FileOutput; write accordingly
const fileOutput = Array.isArray(out) ? out[0] : out;
const data = fileOutput instanceof Uint8Array ? fileOutput : await fileOutput.blob();
fs.writeFileSync("out.png", Buffer.from(await data.arrayBuffer ? await data.arrayBuffer() : data));

DEBUG CHECKLIST (FAST TRIAGE)
Auth / permissions
- 401 on predictions: header must be Authorization: Bearer <token>.
- 401 on /v1/files: Replicate HTTP reference examples use Authorization: Token <token>; try Token if Bearer fails.

Input validation (usually 422)
- Confirm you used the pinned version id exactly.
- Confirm input key names: image, task_type, noise, jpeg.
- Ensure noise/jpeg are JSON numbers (not strings).
- Ensure task_type matches an accepted string exactly (case, hyphens, spacing).
- For hosted URLs: must be publicly fetchable by Replicate (no localhost, no private intranet, no auth headers).
- For data URIs: include the full prefix: data:image/<type>;base64,<payload>.

Prediction lifecycle issues
- Stuck in “starting”: poll with GET /v1/predictions/{id}; don’t assume synchronous completion unless you set Prefer: wait.
- Enforce runtime: set Cancel-After and/or call the cancel endpoint when your own timeout triggers.
- If failed: inspect error and logs; re-run with the same inputs to confirm reproducibility.

Output handling issues
- Output URLs expire after ~1 hour for API-created predictions; download immediately.

Webhooks
- Webhook URL must be HTTPS and must not redirect.
- Handler must be idempotent (retries can happen).
- If you need only final result, set webhook_events_filter to ["completed"].
