
// Replicate API Scaler Module
// Implements Option D: Upload via Replicate Files API, then pass the returned file URL

// Constants
const BASE_URL = 'https://api.replicate.com';
const MODEL_VERSION = '660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a';

/**
 * Uploads a file to Replicate's temporary storage.
 * @param {Blob|File} file - The image file to upload.
 * @param {string} token - The Replicate API token.
 * @returns {Promise<string>} - The URL of the uploaded file.
 */
async function uploadFile(file, token) {
    const formData = new FormData();
    formData.append('content', file);
    // Optional: Add metadata if needed, but not required for simple usage.

    // Try Token first as per instructions for Files API, fallback to Bearer if needed?
    // Instructions say: "Replicate HTTP reference examples use Authorization: Token <REPLICATE_API_TOKEN>. If Bearer fails (401) on /v1/files, switch to Token."
    // We will start with Token.

    let response = await fetch(`${BASE_URL}/v1/files`, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${token}`
        },
        body: formData
    });

    if (response.status === 401) {
        // Retry with Bearer
        response = await fetch(`${BASE_URL}/v1/files`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
    }

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`Upload failed: ${err.detail || response.statusText}`);
    }

    const data = await response.json();
    return data.urls.get;
}

/**
 * Creates a prediction using the uploaded file URL.
 * @param {string} imageUrl - The URL of the input image.
 * @param {string} token - The Replicate API token.
 * @param {object} options - Options for the model (noise, jpeg, task_type).
 * @returns {Promise<object>} - The prediction object.
 */
async function createPrediction(imageUrl, token, options = {}) {
    const input = {
        image: imageUrl,
        task_type: options.task_type || "Real-World Image Super-Resolution-Large",
        noise: options.noise !== undefined ? options.noise : 15,
        jpeg: options.jpeg !== undefined ? options.jpeg : 40
    };

    const response = await fetch(`${BASE_URL}/v1/predictions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            version: MODEL_VERSION,
            input: input
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(`Prediction creation failed: ${err.detail || response.statusText}`);
    }

    return await response.json();
}

/**
 * Polls the prediction status until it succeeds, fails, or is canceled.
 * @param {string} predictionId - The ID of the prediction to poll.
 * @param {string} token - The Replicate API token.
 * @returns {Promise<object>} - The final prediction object.
 */
async function pollPrediction(predictionId, token) {
    const pollUrl = `${BASE_URL}/v1/predictions/${predictionId}`;

    while (true) {
        const response = await fetch(pollUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Polling failed: ${err.detail || response.statusText}`);
        }

        const prediction = await response.json();
        const status = prediction.status;

        if (status === 'succeeded') {
            return prediction;
        } else if (status === 'failed' || status === 'canceled') {
            throw new Error(`Prediction ${status}: ${prediction.error}`);
        }

        // Wait before next poll (e.g., 1 second)
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

/**
 * Main function to upscale an image chunk.
 * @param {Blob|File} imageChunk - The image data to upscale.
 * @param {string} token - The Replicate API token.
 * @param {object} options - Model options.
 * @returns {Promise<Blob>} - The upscaled image as a Blob.
 */
export async function upscaleChunk(imageChunk, token, options = {}) {
    if (!token) {
        throw new Error("Replicate API token is required.");
    }

    try {
        // 1. Upload the file
        const fileUrl = await uploadFile(imageChunk, token);

        // 2. Create prediction
        const prediction = await createPrediction(fileUrl, token, options);

        // 3. Poll for result
        const result = await pollPrediction(prediction.id, token);

        // 4. Fetch the output image
        const outputUrl = result.output; // The model returns a single string URL for the image
        if (!outputUrl) {
             throw new Error("No output URL in result");
        }

        const imageResponse = await fetch(outputUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to download output image: ${imageResponse.statusText}`);
        }

        return await imageResponse.blob();

    } catch (error) {
        console.error("Upscale error:", error);
        throw error;
    }
}
