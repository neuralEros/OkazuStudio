// Replicate API Scaler Module
// Implements Option D: Upload via Replicate Files API, then pass the returned file URL

const Scaler = (() => {

    const DEFAULT_BASE_URL = 'https://api.replicate.com';
    const MODEL_VERSION = '660d922d33153019e8c263a3bba265de882e7f4f70396546b6c9c8f9d47a021a';

    /**
     * Uploads a file to Replicate's temporary storage.
     * @param {Blob|File} file - The image file to upload.
     * @param {string} token - The Replicate API token.
     * @param {string} baseUrl - Base URL for the API (default: https://api.replicate.com).
     * @returns {Promise<string>} - The URL of the uploaded file.
     */
    async function uploadFile(file, token, baseUrl) {
        const formData = new FormData();
        formData.append('content', file);
        // Optional: Add metadata if needed.

        // Try Bearer first as it is the standard for Replicate API v1.
        // Fallback to Token if needed.

        let response;
        try {
            response = await fetch(`${baseUrl}/v1/files`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.status === 401) {
                console.warn(`Upload via Bearer failed (401), retrying with Token...`);
                // Retry with Token
                response = await fetch(`${baseUrl}/v1/files`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${token}`
                    },
                    body: formData
                });
            }
        } catch (e) {
            if (e.name === 'TypeError' && e.message === 'NetworkError when attempting to fetch resource.') {
                throw new Error(`CORS Network Error: Browser blocked request to ${baseUrl}. Use a proxy or disable CORS.`);
            }
            throw new Error(`Network error during upload to ${baseUrl}/v1/files: ${e.message}`);
        }

        if (!response.ok) {
            let errorDetail = response.statusText;
            try {
                const err = await response.json();
                if (err.detail) errorDetail = err.detail;
                else if (err.error) errorDetail = err.error;
                else errorDetail = JSON.stringify(err);
            } catch (e) {
                try { errorDetail = await response.text(); } catch(e2) {}
            }
            throw new Error(`Upload failed (${response.status} ${response.statusText}): ${errorDetail}`);
        }

        const data = await response.json();
        return data.urls.get;
    }

    /**
     * Creates a prediction using the uploaded file URL.
     * @param {string} imageUrl - The URL of the input image.
     * @param {string} token - The Replicate API token.
     * @param {string} baseUrl - Base URL.
     * @param {object} options - Options for the model (noise, jpeg, task_type).
     * @returns {Promise<object>} - The prediction object.
     */
    async function createPrediction(imageUrl, token, baseUrl, options = {}) {
        const input = {
            image: imageUrl,
            task_type: options.task_type || "Real-World Image Super-Resolution-Large",
            noise: options.noise !== undefined ? options.noise : 15,
            jpeg: options.jpeg !== undefined ? options.jpeg : 40
        };

        let response;
        try {
            response = await fetch(`${baseUrl}/v1/predictions`, {
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
        } catch (e) {
            throw new Error(`Network error during prediction creation at ${baseUrl}/v1/predictions: ${e.message}`);
        }

        if (!response.ok) {
            let errorDetail = response.statusText;
            try {
                const err = await response.json();
                if (err.detail) errorDetail = err.detail;
                else if (err.error) errorDetail = err.error;
                else errorDetail = JSON.stringify(err);
            } catch (e) {
                try { errorDetail = await response.text(); } catch(e2) {}
            }
            throw new Error(`Prediction creation failed (${response.status}): ${errorDetail}`);
        }

        return await response.json();
    }

    /**
     * Polls the prediction status until it succeeds, fails, or is canceled.
     * @param {string} predictionId - The ID of the prediction to poll.
     * @param {string} token - The Replicate API token.
     * @param {string} baseUrl - Base URL.
     * @returns {Promise<object>} - The final prediction object.
     */
    async function pollPrediction(predictionId, token, baseUrl) {
        // Construct poll URL carefully. The API usually returns a full URL in 'urls.get',
        // but if we are using a proxy, we might need to route it through the proxy.
        // For simplicity here, we reconstruct it using the baseUrl to ensure proxy usage.
        const pollUrl = `${baseUrl}/v1/predictions/${predictionId}`;

        while (true) {
            let response;
            try {
                response = await fetch(pollUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            } catch(e) {
                 throw new Error(`Network error during polling ${pollUrl}: ${e.message}`);
            }

            if (!response.ok) {
                let errorDetail = response.statusText;
                try {
                    const err = await response.json();
                    if (err.detail) errorDetail = err.detail;
                } catch (e) {
                    try { errorDetail = await response.text(); } catch(e2) {}
                }
                throw new Error(`Polling failed (${response.status}): ${errorDetail}`);
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
     * @param {object} config - Configuration object.
     * @param {string} config.token - The Replicate API token.
     * @param {string} [config.baseUrl] - Optional proxy URL or alternate base URL.
     * @param {object} [config.modelOptions] - Model specific options.
     * @returns {Promise<Blob>} - The upscaled image as a Blob.
     */
    async function upscaleChunk(imageChunk, config = {}) {
        const { token, baseUrl = DEFAULT_BASE_URL, modelOptions = {} } = config;

        if (!token) {
            throw new Error("Replicate API token is required.");
        }

        try {
            // 1. Upload the file
            const fileUrl = await uploadFile(imageChunk, token, baseUrl);

            // 2. Create prediction
            const prediction = await createPrediction(fileUrl, token, baseUrl, modelOptions);

            // 3. Poll for result
            const result = await pollPrediction(prediction.id, token, baseUrl);

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

    return {
        upscaleChunk
    };
})();
