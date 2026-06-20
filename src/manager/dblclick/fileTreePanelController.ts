import PanelController, { PanelControllerOptions } from "./panelController";
import FileTreeClickCallback from "./callbacks/fileTreeClickCallback";

export default class FileTreePanelController extends PanelController {
    constructor(options: Omit<PanelControllerOptions, "panelType">) {
        super({ ...options, panelType: "fileTree", callbacks: options.callbacks ?? new FileTreeClickCallback() });
    }

    protected getRootSelectors(): string[] {
        return [".sy__file", "#sidebar [data-type='sidebar-file']"];
    }

    protected resolveItemElement(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof Element)) {
            return null;
        }
        return target.closest("[data-type='navigation-file'], [data-type='navigation-root']") as HTMLElement | null;
    }

    protected resolveItemId(itemElement: HTMLElement): string | null {
        // Root notebook entries do not always carry node-id, fallback to data-path.
        return itemElement.getAttribute("data-node-id")
            || itemElement.getAttribute("data-path")
            || itemElement.getAttribute("data-type");
    }
}
