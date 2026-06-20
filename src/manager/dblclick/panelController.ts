import type { ClickDispatchContext, InteractionRuntimeOptions, PanelType } from "./types";
import PanelClickCallbackBase from "./callbacks/panelClickCallbackBase";

export interface PanelControllerOptions {
    panelType: PanelType;
    callbacks: PanelClickCallbackBase;
    runtime: () => InteractionRuntimeOptions;
}

export default abstract class PanelController {
    protected readonly panelType: PanelType;
    protected readonly callbacks: PanelClickCallbackBase;
    protected readonly runtime: () => InteractionRuntimeOptions;

    private readonly boundRoots = new Set<Element>();

    constructor(options: PanelControllerOptions) {
        this.panelType = options.panelType;
        this.callbacks = options.callbacks;
        this.runtime = options.runtime;
    }

    bind() {
        this.unbind();
        const { capture } = this.runtime();
        this.getRootSelectors().forEach((selector) => {
            document.querySelectorAll(selector).forEach((root) => {
                root.addEventListener("click", this.onRootClick, capture);
                this.boundRoots.add(root);
            });
        });
    }

    unbind() {
        const { capture } = this.runtime();
        this.boundRoots.forEach((root) => {
            root.removeEventListener("click", this.onRootClick, capture);
        });
        this.boundRoots.clear();
        this.callbacks.dispose();
    }

    protected abstract getRootSelectors(): string[];

    protected abstract resolveItemElement(target: EventTarget | null): HTMLElement | null;

    protected abstract resolveItemId(itemElement: HTMLElement): string | null;

    protected shouldHandleEvent(event: MouseEvent, _itemElement: HTMLElement): boolean {
        if (event.button !== 0) {
            return false;
        }
        if (event.shiftKey || event.altKey) {
            return false;
        }
        return true;
    }

    protected shouldStopEvent(_event: MouseEvent): boolean {
        return false;
    }

    private onRootClick = (event: MouseEvent) => {
        const itemElement = this.resolveItemElement(event.target);
        if (!itemElement) {
            return;
        }

        if (!this.shouldHandleEvent(event, itemElement)) {
            return;
        }

        const itemId = this.resolveItemId(itemElement);
        if (!itemId) {
            return;
        }

        const ctx: ClickDispatchContext = {
            panelType: this.panelType,
            event,
            itemElement,
            itemId,
        };

        this.callbacks.handle(ctx);
    };
}
