export interface ClickClassifierCallbacks {
    onSingle: () => void;
    onDouble: () => void;
}

/**
 * Per-panel click classifier.
 * Keeps single/double timing state isolated so panels do not interfere.
 */
export default class ClickClassifier {
    private lastClickAt = 0;
    private lastItemId: string | null = null;
    private pendingSingleTimer: number | null = null;

    dispose() {
        this.clearPending();
        this.lastClickAt = 0;
        this.lastItemId = null;
    }

    handle(itemId: string, delay: number, callbacks: ClickClassifierCallbacks) {
        const now = Date.now();
        const isSecondClick =
            this.lastItemId === itemId &&
            now - this.lastClickAt <= Math.max(0, delay);

        if (isSecondClick) {
            this.clearPending();
            this.lastClickAt = 0;
            this.lastItemId = null;
            callbacks.onDouble();
            return;
        }

        this.clearPending();
        this.lastClickAt = now;
        this.lastItemId = itemId;

        const safeDelay = Math.max(0, delay);
        if (safeDelay === 0) {
            callbacks.onSingle();
            this.lastClickAt = 0;
            this.lastItemId = null;
            return;
        }

        this.pendingSingleTimer = window.setTimeout(() => {
            callbacks.onSingle();
            this.pendingSingleTimer = null;
            this.lastClickAt = 0;
            this.lastItemId = null;
        }, safeDelay);
    }

    private clearPending() {
        if (this.pendingSingleTimer != null) {
            clearTimeout(this.pendingSingleTimer);
            this.pendingSingleTimer = null;
        }
    }
}
