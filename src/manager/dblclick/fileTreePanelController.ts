import PanelController, { PanelControllerOptions } from "./panelController";
import FileTreeClickCallback from "./callbacks/fileTreeClickCallback";
import { isMobile } from "@/syapi";
import { getReadOnlyGSettings } from "@/manager/settingManager";
import { isDocTreeShiftRangeSelectAvailable } from "@/utils/compatUtils";

export default class FileTreePanelController extends PanelController {
    constructor(options: Omit<PanelControllerOptions, "panelType">) {
        super({ ...options, panelType: "fileTree", callbacks: options.callbacks ?? new FileTreeClickCallback() });
    }

    protected supportsShiftRangeSelect(): boolean {
        return !isMobile()
            && getReadOnlyGSettings().shiftMultiSelect === true
            && isDocTreeShiftRangeSelectAvailable();
    }

    protected getRootSelectors(): string[] {
        if (isMobile()) {
            return ["#sidebar [data-type='sidebar-file']"];
        }
        return [".sy__file"];
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
