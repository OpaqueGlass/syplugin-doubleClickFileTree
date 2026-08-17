import { debugPush } from "@/logger";

const FOCUS_CLASS = "b3-list-item--focus";

export default class ShiftRangeSelectHandler {
    private anchorElement: HTMLElement | null = null;
    private anchorId: string | null = null;

    updateAnchor(item: HTMLElement): void {
        this.anchorElement = item;
        this.anchorId = this.resolveItemId(item);
    }

    handleRangeSelect(clicked: HTMLElement, allItems: HTMLElement[]): boolean {
        if (allItems.length === 0) {
            return false;
        }
        const anchor = this.resolveAnchor(allItems);
        if (anchor == null) {
            this.selectSingleAsAnchor(clicked, allItems);
            return true;
        }

        const anchorIndex = allItems.indexOf(anchor);
        const clickedIndex = allItems.indexOf(clicked);
        if (anchorIndex === -1 || clickedIndex === -1) {
            this.selectSingleAsAnchor(clicked, allItems);
            return true;
        }

        // 替换式选择：先全量清除面板内所有 focus，再选中区间
        for (const item of allItems) {
            item.classList.remove(FOCUS_CLASS);
        }

        const startIndex = Math.min(anchorIndex, clickedIndex);
        const endIndex = Math.max(anchorIndex, clickedIndex);
        for (let i = startIndex; i <= endIndex; i++) {
            allItems[i].classList.add(FOCUS_CLASS);
        }

        debugPush("Shift范围选择", `anchor=${anchorIndex} clicked=${clickedIndex} range=[${startIndex},${endIndex}] count=${endIndex - startIndex + 1}`);
        return true;
    }

    getAnchor(): HTMLElement | null {
        return this.anchorElement;
    }

    clearAnchor(): void {
        this.anchorElement = null;
        this.anchorId = null;
    }

    dispose(): void {
        this.clearAnchor();
    }

    /**
     * 确定上一个点击的元素
     * @returns 
     */
    private resolveAnchor(allItems: HTMLElement[]): HTMLElement | null {
        if (this.anchorElement && this.anchorElement.isConnected) {
            return this.anchorElement;
        }

        if (this.anchorId) {
            for (const item of allItems) {
                if (this.resolveItemId(item) === this.anchorId) {
                    this.anchorElement = item;
                    return item;
                }
            }
        }

        for (const item of allItems) {
            if (item.classList.contains(FOCUS_CLASS)) {
                this.anchorElement = item;
                this.anchorId = this.resolveItemId(item);
                return item;
            }
        }

        return null;
    }

    private selectSingleAsAnchor(item: HTMLElement, allItems: HTMLElement[]): void {
        for (const it of allItems) {
            it.classList.remove(FOCUS_CLASS);
        }
        item.classList.add(FOCUS_CLASS);
        this.updateAnchor(item);
    }

    private resolveItemId(item: HTMLElement): string | null {
        return item.getAttribute("data-node-id")
            || item.getAttribute("data-path")
            || null;
    }
}
