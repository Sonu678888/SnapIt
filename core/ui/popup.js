// SnapIt - Popup Script (Launcher + Preview + PDF Review)
// Opens dedicated camera window and shows captured images

// ========== DOM ELEMENTS ==========
const statusText = document.getElementById('status-text');
const capturedImage = document.getElementById('captured-image');

// Views
const launcherView = document.getElementById('launcher-view');
const previewView = document.getElementById('preview-view');
const pdfReviewView = document.getElementById('pdf-review-view');

// Launcher buttons
const openCameraBtn = document.getElementById('open-camera-btn');

// Preview buttons
const retakeBtn = document.getElementById('retake-btn');

// Image action buttons
const formatSelect = document.getElementById('format-select');
const copyClipboardBtn = document.getElementById('copy-clipboard-btn');
const downloadImageBtn = document.getElementById('download-image-btn');
const attachWebpageBtn = document.getElementById('attach-webpage-btn');

// PDF action buttons
const addPageBtn = document.getElementById('add-page-btn');
const pdfHintText = document.getElementById('pdf-hint-text');
const currentPagesCount = document.getElementById('current-pages-count');

// PDF Review buttons
const downloadMultiPdfBtn = document.getElementById('download-multi-pdf-btn');
const addMoreImagesBtn = document.getElementById('add-more-images-btn');
const clearAllPagesBtn = document.getElementById('clear-all-pages-btn');
const pdfPageCount = document.getElementById('pdf-page-count');

// ========== STATE ==========
const STATES = {
    LAUNCHER: 'launcher',
    PREVIEW: 'preview',
    PDF_REVIEW: 'pdf-review'
};

let currentState = STATES.LAUNCHER;
let capturedImageData = null;
let currentImageId = null;
let isAddingPage = false;
let pdfPages = [];

// ========== STATE MANAGEMENT ==========
function setState(newState) {
    currentState = newState;

    // Hide all sections
    launcherView.classList.remove('active');
    previewView.classList.remove('active');
    pdfReviewView.classList.remove('active');

    // Show appropriate section
    switch (newState) {
        case STATES.LAUNCHER:
            launcherView.classList.add('active');
            statusText.textContent = 'Ready to capture';
            break;

        case STATES.PREVIEW:
            previewView.classList.add('active');
            statusText.textContent = 'Document ready!';
            updatePreviewPDFHint();
            break;

        case STATES.PDF_REVIEW:
            pdfReviewView.classList.add('active');
            updatePDFReviewUI();
            statusText.textContent = `${pdfPages.length} pages in PDF`;
            break;
    }

    console.log('State changed to:', newState);
}

// ========== CAMERA WINDOW ==========
async function openCameraWindow() {
    console.log('🔴 openCameraWindow called');
    console.trace('Call stack:');

    try {
        console.log('Opening camera window...');
        statusText.textContent = 'Opening camera...';

        // Create large, focused camera window
        await window.platform.openWindow({
            url: 'capture.html',
            width: 800,
            height: 700,
            left: Math.round((screen.width - 800) / 2),
            top: Math.round((screen.height - 700) / 2)
        });

        console.log('Camera window opened:', window.id);
        statusText.textContent = 'Camera window opened';
    } catch (error) {
        console.error('Failed to open camera window:', error);
        statusText.textContent = 'Failed to open camera';
    }
}

// ========== CHECK FOR CAPTURED IMAGE ==========
async function checkForCapturedImage() {
    try {
        const result = await window.platform.storageGet(['capturedImage', 'imageId', 'timestamp']);

        if (result.capturedImage && result.imageId) {
            // Check if this is a new image (not already loaded)
            if (result.imageId !== currentImageId) {
                console.log('Found NEW captured image, ID:', result.imageId, 'timestamp:', result.timestamp);
                capturedImageData = result.capturedImage;
                currentImageId = result.imageId;
                capturedImage.src = capturedImageData;
                setState(STATES.PREVIEW);

                // Clear storage immediately after loading to prevent persistence
                window.platform.storageRemove(['capturedImage', 'imageId', 'timestamp'])
                    .then(() => console.log('Cleared storage to prevent old images on next open'));
            } else {
                console.log('Image already loaded, ID:', result.imageId);
            }
        } else {
            console.log('No captured image found in storage');
        }
    } catch (error) {
        console.error('Error checking for captured image:', error);
    }
}

// ========== RETAKE ==========
function retakePhoto() {
    capturedImageData = null;
    currentImageId = null;
    capturedImage.src = '';
    pdfPages = [];
    setState(STATES.LAUNCHER);
}

// ========== PDF UI UPDATES ==========
function updatePDFReviewUI() {
    const pageCount = pdfPages.length;

    if (pageCount === 1) {
        pdfPageCount.textContent = '1 Page Added';
    } else {
        pdfPageCount.textContent = `${pageCount} Pages Added`;
    }

    console.log('PDF Review UI updated:', pageCount, 'pages');
}

function updatePreviewPDFHint() {
    if (pdfPages.length > 0) {
        currentPagesCount.textContent = pdfPages.length;
        pdfHintText.style.display = 'block';
    } else {
        pdfHintText.style.display = 'none';
    }
}

// ========== IMAGE ACTIONS ==========
async function copyToClipboard() {
    if (!capturedImageData) {
        statusText.textContent = '❌ No image captured';
        return;
    }

    try {
        // Use Electron's clipboard API
        const result = await window.electronAPI.writeImageToClipboard(capturedImageData);

        if (result.success) {
            statusText.textContent = '✅ Copied to clipboard!';
            console.log('Image copied to clipboard');
        } else {
            throw new Error(result.message || 'Failed to copy');
        }
    } catch (error) {
        console.error('Clipboard error:', error);
        statusText.textContent = '❌ Failed to copy';
    }
}

async function downloadAsImage() {
    if (!capturedImageData) {
        statusText.textContent = '❌ No image captured';
        return;
    }

    try {
        const format = formatSelect.value;
        const filename = generateFilename(format);

        let imageData = capturedImageData;
        if (format === 'png') {
            imageData = await convertToPNG(capturedImageData);
        }

        await triggerDownload(imageData, format);
        statusText.textContent = `✅ Downloaded as ${format.toUpperCase()}!`;
        console.log('Image downloaded:', filename);
    } catch (error) {
        console.error('Download error:', error);
        statusText.textContent = '❌ Failed to download';
    }
}

async function convertToPNG(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = dataUrl;
    });
}

// ========== PDF ACTIONS ==========
function addPageToPDF() {
    if (isAddingPage) {
        console.warn('Already adding page, please wait');
        statusText.textContent = '⏳ Processing...';
        return;
    }

    if (!capturedImageData) {
        statusText.textContent = '❌ No image to add';
        console.error('addPageToPDF called but capturedImageData is null');
        return;
    }

    if (currentImageId && pdfPages.some(p => p.imageId === currentImageId)) {
        statusText.textContent = '❌ This image is already added';
        console.error('Duplicate image detected, ID:', currentImageId);
        return;
    }

    isAddingPage = true;

    try {
        const pageNumber = pdfPages.length + 1;
        const clonedImageData = capturedImageData.slice();

        pdfPages.push({
            imageData: clonedImageData,
            imageId: currentImageId,
            timestamp: new Date(),
            pageNumber: pageNumber
        });

        console.log(`✅ Added page ${pageNumber} (ID: ${currentImageId}). Total pages: ${pdfPages.length}`);

        window.platform.storageRemove(['capturedImage', 'imageId', 'timestamp'])
            .then(() => console.log('Cleared storage after adding page'));

        capturedImageData = null;
        currentImageId = null;
        capturedImage.src = '';

        setState(STATES.PDF_REVIEW);
        console.log('Switched to PDF Review state');
    } finally {
        isAddingPage = false;
    }
}

async function generateMultiPagePDF() {
    if (pdfPages.length === 0) {
        statusText.textContent = '❌ No pages added';
        return;
    }

    try {
        console.log(`Starting PDF generation with ${pdfPages.length} pages`);

        const invalidPages = pdfPages.filter(p => !p.imageData);
        if (invalidPages.length > 0) {
            console.error('Found invalid pages:', invalidPages);
            statusText.textContent = '❌ Some pages have invalid data';
            return;
        }

        statusText.textContent = `Generating PDF with ${pdfPages.length} pages...`;

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        for (let i = 0; i < pdfPages.length; i++) {
            const page = pdfPages[i];
            console.log(`Processing page ${i + 1}/${pdfPages.length} (ID: ${page.imageId})`);

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error(`Failed to load image for page ${i + 1}`));
                img.src = page.imageData;
            });

            if (i > 0) {
                pdf.addPage();
            }

            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 10;

            const imgRatio = img.width / img.height;
            const maxWidth = pageWidth - (margin * 2);
            const maxHeight = pageHeight - (margin * 2);

            let finalWidth, finalHeight;
            if (imgRatio > maxWidth / maxHeight) {
                finalWidth = maxWidth;
                finalHeight = maxWidth / imgRatio;
            } else {
                finalHeight = maxHeight;
                finalWidth = maxHeight * imgRatio;
            }

            const x = (pageWidth - finalWidth) / 2;
            const y = (pageHeight - finalHeight) / 2;

            pdf.addImage(page.imageData, 'JPEG', x, y, finalWidth, finalHeight);
            console.log(`✅ Added page ${i + 1} to PDF`);
        }


        const filename = generateFilename('pdf');
        const pdfBlob = pdf.output('blob');

        // Convert blob to data URL for download
        const reader = new FileReader();
        const pdfDataUrl = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(pdfBlob);
        });

        await triggerDownload(pdfDataUrl, 'pdf');

        statusText.textContent = `✅ PDF with ${pdfPages.length} pages generated!`;
        console.log('PDF generation complete');

        setTimeout(() => {
            if (confirm('PDF generated! Clear all pages?')) {
                pdfPages = [];
                setState(STATES.LAUNCHER);
            }
        }, 500);
    } catch (error) {
        console.error('Multi-page PDF error:', error);
        statusText.textContent = '❌ Failed to generate PDF: ' + error.message;
    }
}

// ========== ATTACH TO WEBPAGE ==========
async function attachToWebpage() {
    if (!capturedImageData) {
        statusText.textContent = '❌ No image captured';
        return;
    }

    try {
        const response = await fetch(capturedImageData);
        const blob = await response.blob();
        const file = new File([blob], generateFilename('jpeg'), { type: 'image/jpeg' });

        await window.platform.sendMessageToActivePage({
            action: 'attachImage',
            imageData: capturedImageData,
            filename: file.name
        });

        statusText.textContent = '✅ Attached to webpage!';
        console.log('Image attached to webpage');
    } catch (error) {
        console.error('Attach error:', error);
        statusText.textContent = '❌ Use Copy to Clipboard instead';
    }
}

// ========== UTILITY FUNCTIONS ==========
function generateFilename(extension) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `SnapIt_${year}${month}${day}_${hours}${minutes}${seconds}.${extension}`;
}

async function triggerDownload(dataUrl, extension) {
    const filename = generateFilename(extension);
    return await window.platform.download(dataUrl, filename);
}

// ========== EVENT LISTENERS ==========
openCameraBtn.addEventListener('click', openCameraWindow);
retakeBtn.addEventListener('click', retakePhoto);

copyClipboardBtn.addEventListener('click', copyToClipboard);
downloadImageBtn.addEventListener('click', downloadAsImage);
attachWebpageBtn.addEventListener('click', attachToWebpage);

addPageBtn.addEventListener('click', addPageToPDF);

addMoreImagesBtn.addEventListener('click', () => {
    console.log('User clicked Add More Images');
    setState(STATES.LAUNCHER);
});

downloadMultiPdfBtn.addEventListener('click', generateMultiPagePDF);

clearAllPagesBtn.addEventListener('click', () => {
    if (confirm(`Clear all ${pdfPages.length} pages?`)) {
        pdfPages = [];
        console.log('All pages cleared');
        setState(STATES.LAUNCHER);
    }
});

// ========== INITIALIZATION ==========
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('✅ Popup loaded (DOMContentLoaded)');

        // Clear previous session data for fresh start
        await window.platform.storageRemove(['capturedImage', 'pdfPages']);
        pdfPages = [];
        capturedImageData = null;

        // Always start in launcher view
        setState(STATES.LAUNCHER);
    });
} else {
    // DOM is already loaded (script loaded dynamically after page load)
    console.log('✅ Popup loaded (immediate)');

    // Clear previous session data for fresh start
    (async () => {
        await window.platform.storageRemove(['capturedImage', 'pdfPages']);
        pdfPages = [];
        capturedImageData = null;

        // Always start in launcher view
        setState(STATES.LAUNCHER);
    })();
}

// Listen for storage changes (when camera window saves image)
window.platform.onStorageChanged((changes) => {
    if (changes.capturedImage) {
        console.log('✅ Storage change detected - captured image available');
        checkForCapturedImage();
    }
});

// Listen for state reset (when window is hidden)
if (window.electronAPI && window.electronAPI.onResetState) {
    window.electronAPI.onResetState(async () => {
        console.log('🔄 Resetting state - window was hidden');

        // Clear all session data
        await window.platform.storageRemove(['capturedImage', 'pdfPages']);
        pdfPages = [];
        capturedImageData = null;

        // Reset to launcher view
        setState(STATES.LAUNCHER);
        statusText.textContent = 'Ready to capture';
    });
}
