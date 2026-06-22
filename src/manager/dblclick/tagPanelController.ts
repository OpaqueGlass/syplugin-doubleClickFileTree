import PanelController, { PanelControllerOptions } from "./panelController";
import TagClickCallback from "./callbacks/tagClickCallback";
import { isMobile } from "@/syapi";

export default class TagPanelController extends PanelController {
    constructor(options: Omit<PanelControllerOptions, "panelType">) {
        super({ ...options, panelType: "tag", callbacks: options.callbacks ?? new TagClickCallback() });
    }

    protected getRootSelectors(): string[] {
        if (isMobile()) {
            return ["#sidebar [data-type='sidebar-tag']"];
        }
        return [".sy__tag"];
    }

    protected resolveItemElement(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof Element)) {
            return null;
        }
        return target.closest("[data-treetype='tag'], [data-node-id]") as HTMLElement | null;
    }

    protected resolveItemId(itemElement: HTMLElement): string | null {
        return itemElement.getAttribute("data-node-id")
            || itemElement.getAttribute("data-path")
            || itemElement.textContent?.trim()
            || null;
    }
}
