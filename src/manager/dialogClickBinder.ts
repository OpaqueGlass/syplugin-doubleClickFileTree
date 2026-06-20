import { isValidStr } from "@/utils/commonCheck";
import FileTreeClickCallback from "./dblclick/callbacks/fileTreeClickCallback";
import type { ClickDispatchContext } from "./dblclick/types";
import { getBackend, getFrontend } from "siyuan";
import TreeClickCallbackBase from "./dblclick/callbacks/treeClickCallbackBase";
import DialogTreeClickCallback from "./dblclick/callbacks/dialogTreeClickCallback";

export default class DialogClickBinder {
    private readonly callbacks = new DialogTreeClickCallback();
    private readonly boundNodes = new Set<Element>();
    private readonly observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === "childList") {
                for (const addedNode of mutation.addedNodes) {
                    if (addedNode.nodeType === 1 && (addedNode as HTMLElement).dataset?.key === "dialog-movepathto") {
                        this.bindNode(addedNode as Element);
                    }
                }
            }
        }
    });

    bind() {
        this.unbind();
        this.observer.observe(document.body, { childList: true, subtree: false, attributes: false });
        document.querySelectorAll("[data-key='dialog-movepathto']").forEach((node) => this.bindNode(node));
    }

    unbind() {
        this.observer.disconnect();
        for (const node of this.boundNodes) {
            node.removeEventListener("click", this.onDialogClick, true);
            node.removeEventListener("mouseup", this.onDialogMouseUp, true);
        }
        this.boundNodes.clear();
        this.callbacks.dispose();
    }

    private bindNode(node: Element) {
        if (this.boundNodes.has(node)) {
            return;
        }
        this.boundNodes.add(node);
        if (getBackend() === "ios" && getFrontend() === "desktop") {
            node.addEventListener("mouseup", this.onDialogMouseUp, true);
        } else {
            node.addEventListener("click", this.onDialogClick, true);
        }
    }

    private onDialogClick = (event: MouseEvent) => {
        this.handleDialogEvent(event);
    };

    private onDialogMouseUp = (event: MouseEvent) => {
        this.handleDialogEvent(event);
    };

    private handleDialogEvent(event: MouseEvent) {
        const target = event.target as HTMLElement | null;
        const itemElement = this.resolveItemElement(target);
        if (!itemElement) {
            return;
        }
        const itemId = itemElement.getAttribute("data-node-id") || itemElement.getAttribute("data-path") || itemElement.textContent?.trim() || null;
        if (!isValidStr(itemId)) {
            return;
        }
        const ctx: ClickDispatchContext = {
            panelType: "fileTree",
            event,
            itemElement,
            itemId,
        };
        this.callbacks.handle(ctx);
    }

    private resolveItemElement(target: HTMLElement | null): HTMLElement | null {
        if (!target) {
            return null;
        }
        return target.closest("[data-node-id], [data-path], .b3-list-item") as HTMLElement | null;
    }
}
