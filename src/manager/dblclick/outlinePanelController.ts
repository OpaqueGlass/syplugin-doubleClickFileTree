import PanelController, { PanelControllerOptions } from "./panelController";
import OutlineClickCallback from "./callbacks/outlineClickCallback";

export default class OutlinePanelController extends PanelController {
    constructor(options: Omit<PanelControllerOptions, "panelType">) {
        super({ ...options, panelType: "outline", callbacks: options.callbacks ?? new OutlineClickCallback() });
    }

    protected getRootSelectors(): string[] {
        return [".sy__outline", "#sidebar [data-type='sidebar-outline']"];
    }

    protected resolveItemElement(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof Element)) {
            return null;
        }
        return target.closest("[data-type='NodeHeading']") as HTMLElement | null;
    }

    protected resolveItemId(itemElement: HTMLElement): string | null {
        return itemElement.getAttribute("data-node-id");
    }
}
