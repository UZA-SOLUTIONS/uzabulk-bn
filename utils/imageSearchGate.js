let activeImageSearches = 0;
let pendingUntil = 0;

const PENDING_MS = Math.min(
    Math.max(Number(process.env.IMAGE_SEARCH_GATE_PENDING_MS || 90000), 15000),
    180000
);

const beginImageSearch = () => {
    activeImageSearches += 1;
};

const endImageSearch = () => {
    activeImageSearches = Math.max(0, activeImageSearches - 1);
    if (activeImageSearches === 0) {
        pendingUntil = 0;
    }
};

/** Call on image upload (prepare=1) so background jobs defer before list request starts. */
const markImageSearchPending = () => {
    pendingUntil = Date.now() + PENDING_MS;
};

const isImageSearchBusy = () => activeImageSearches > 0 || Date.now() < pendingUntil;

module.exports = {
    beginImageSearch,
    endImageSearch,
    markImageSearchPending,
    isImageSearchBusy,
};
