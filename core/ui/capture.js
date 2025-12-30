// SnapIt - Dedicated Camera Window
// Handles camera capture with animations and crop editing

// ========== STATE ==========
const STATES = {
    CAMERA: 'camera',
    EDIT: 'edit'
};

let currentState = STATES.CAMERA;
let stream = null;
let cropperInstance = null;
let capturedImageData = null;
let finalEditedBlob = null;

// ========== DOM ELEMENTS ==========
const cameraView = document.getElementById('camera-view');
const editView = document.getElementById('edit-view');
const video = document.getElementById('camera-preview');
const canvas = document.getElementById('capture-canvas');
const flashOverlay = document.getElementById('flash-overlay');
const successOverlay = document.getElementById('success-overlay');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

// Buttons
const captureBtn = document.getElementById('capture-btn');
const closeBtn = document.getElementById('close-btn');
const applyCropBtn = document.getElementById('apply-crop-btn');
const retakeBtn = document.getElementById('retake-btn');
const rotateLeftBtn = document.getElementById('rotate-left-btn');
const rotateRightBtn = document.getElementById('rotate-right-btn');
const resetCropBtn = document.getElementById('reset-crop-btn');

// Crop elements
const cropImage = document.getElementById('crop-image');

// Countdown elements
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const countdownProgressCircle = document.getElementById('countdown-progress-circle');

// ========== CAMERA FUNCTIONS ==========
async function initializeCamera() {
    try {
        console.log('Initializing camera...');

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });

        video.srcObject = stream;
        captureBtn.disabled = false;
        hideError();

        console.log('Camera initialized successfully');
    } catch (error) {
        console.error('Camera error:', error);
        handleCameraError(error);
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        console.log('Camera stopped');
    }
}

function handleCameraError(error) {
    let message = 'Camera access failed. ';

    if (error.name === 'NotAllowedError') {
        message += 'Please allow camera access in your browser settings.';
    } else if (error.name === 'NotFoundError') {
        message += 'No camera found on this device.';
    } else {
        message += error.message;
    }

    showError(message);
    captureBtn.disabled = true;
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
}

function hideError() {
    errorMessage.style.display = 'none';
}

// ========== CAPTURE WITH COUNTDOWN AND ANIMATIONS ==========
async function capturePhoto() {
    try {
        console.log('Starting capture with countdown...');

        // 1. Disable capture button
        captureBtn.disabled = true;

        // 2. Show countdown overlay and run countdown
        await runCountdown(1.5); // 1.5 second countdown

        // 3. Flash animation
        flashOverlay.classList.add('active');

        // 4. Capture image
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        canvas.width = videoWidth;
        canvas.height = videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

        capturedImageData = canvas.toDataURL('image/jpeg', 0.95);

        // 5. Remove flash, show success overlay
        setTimeout(() => {
            flashOverlay.classList.remove('active');
            successOverlay.classList.add('active');
        }, 150);

        // 6. Transition to crop editor
        setTimeout(() => {
            successOverlay.classList.remove('active');
            showCropEditor();
        }, 1000); // Slightly longer to show success message

        console.log('Photo captured:', videoWidth, 'x', videoHeight);
    } catch (error) {
        console.error('Capture error:', error);
        showError('Failed to capture photo. Please try again.');
        flashOverlay.classList.remove('active');
        successOverlay.classList.remove('active');
        countdownOverlay.classList.remove('active');
        captureBtn.disabled = false;
    }
}

// ========== COUNTDOWN FUNCTIONS ==========
async function runCountdown(durationSeconds) {
    const steps = 3; // Count 3, 2, 1
    const stepDuration = (durationSeconds * 1000) / steps;
    const circumference = 2 * Math.PI * 54; // 2 * PI * radius

    // Show countdown overlay
    countdownOverlay.classList.add('active');

    for (let i = steps; i > 0; i--) {
        // Update number
        countdownNumber.textContent = i;

        // Animate number with pulse
        countdownNumber.style.animation = 'none';
        setTimeout(() => {
            countdownNumber.style.animation = 'countdownPulse 0.5s ease';
        }, 10);

        // Update progress circle
        const progress = (steps - i) / steps;
        const offset = circumference * (1 - progress);
        countdownProgressCircle.style.strokeDashoffset = offset;

        // Wait for step duration
        await new Promise(resolve => setTimeout(resolve, stepDuration));
    }

    // Hide countdown overlay
    countdownOverlay.classList.remove('active');

    // Reset progress circle
    countdownProgressCircle.style.strokeDashoffset = circumference;
}

// ========== CROP EDITOR ==========
function showCropEditor() {
    stopCamera();

    // Fade out camera view
    cameraView.classList.remove('active');
    cameraView.classList.add('fade-out');

    setTimeout(() => {
        // Fade in edit view
        editView.classList.add('active');
        editView.classList.add('fade-in');

        // Set image source
        cropImage.src = capturedImageData;

        // Initialize Cropper.js
        setTimeout(() => {
            cropperInstance = new Cropper(cropImage, {
                aspectRatio: NaN, // Free aspect ratio for documents
                viewMode: 0, // No restrictions
                autoCropArea: 1, // Auto-crop entire image
                responsive: true,
                restore: false,
                guides: true,
                center: true,
                highlight: true,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
                background: false,
                modal: true,
                dragMode: 'crop',
                minCropBoxWidth: 50,
                minCropBoxHeight: 50,
                ready() {
                    console.log('Cropper ready with auto-crop');
                }
            });
        }, 100);
    }, 300);
}

// ========== CROP FUNCTIONS ==========
async function applyCrop() {
    if (!cropperInstance) {
        showError('Cropper not initialized');
        return;
    }

    try {
        console.log('Applying crop...');

        const croppedCanvas = cropperInstance.getCroppedCanvas({
            maxWidth: 4096,
            maxHeight: 4096,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        // Convert to blob BEFORE destroying cropper
        finalEditedBlob = await new Promise((resolve) => {
            croppedCanvas.toBlob(resolve, 'image/jpeg', 0.95);
        });

        // Convert blob to data URL for storage
        const reader = new FileReader();
        reader.onloadend = async () => {
            const dataUrl = reader.result;

            // Generate unique ID for this image
            const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Save to storage for popup to access
            await window.platform.storageSet({
                capturedImage: dataUrl,
                imageId: imageId,
                timestamp: Date.now()
            });

            console.log('Image saved to storage with ID:', imageId, 'blob size:', finalEditedBlob.size, 'bytes');

            // Close camera window
            window.close();
        };
        reader.readAsDataURL(finalEditedBlob);
    } catch (error) {
        console.error('Crop error:', error);
        showError('Failed to apply crop. Please try again.');
    }
}

function rotateLeft() {
    if (cropperInstance) {
        cropperInstance.rotate(-90);
    }
}

function rotateRight() {
    if (cropperInstance) {
        cropperInstance.rotate(90);
    }
}

function resetCrop() {
    if (cropperInstance) {
        cropperInstance.reset();
    }
}

function destroyCropper() {
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
}

function retakePhoto() {
    destroyCropper();
    capturedImageData = null;
    finalEditedBlob = null;

    // Fade out edit view
    editView.classList.remove('active');
    editView.classList.remove('fade-in');

    // Fade in camera view
    cameraView.classList.remove('fade-out');
    cameraView.classList.add('active');

    // Reinitialize camera
    initializeCamera();
}

// ========== EVENT LISTENERS ==========
captureBtn.addEventListener('click', capturePhoto);
closeBtn.addEventListener('click', () => window.close());
applyCropBtn.addEventListener('click', applyCrop);
retakeBtn.addEventListener('click', retakePhoto);
rotateLeftBtn.addEventListener('click', rotateLeft);
rotateRightBtn.addEventListener('click', rotateRight);
resetCropBtn.addEventListener('click', resetCrop);

// ========== INITIALIZATION ==========
// Camera initialization is now handled by the window that opens this capture window
// The camera will start automatically when this window is opened by user action
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        console.log('✅ Capture window loaded (DOMContentLoaded)');
        // Camera will initialize automatically since user explicitly opened this window
        initializeCamera();
    });
} else {
    // DOM is already loaded (script loaded dynamically after page load)
    console.log('✅ Capture window loaded (immediate)');
    // Camera will initialize automatically since user explicitly opened this window
    initializeCamera();
}

// ========== CLEANUP ==========
window.addEventListener('beforeunload', () => {
    destroyCropper();
    stopCamera();
    console.log('Camera window closing, cleanup complete');
});
