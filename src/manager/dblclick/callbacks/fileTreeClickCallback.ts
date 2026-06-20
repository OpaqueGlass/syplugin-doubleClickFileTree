import TreeClickCallbackBase from "./treeClickCallbackBase";

export default class FileTreeClickCallback extends TreeClickCallbackBase {
    protected getOpenActionType() {
        return "openDoc" as const;
    }

    protected doNotSkipCtrlKey(): boolean {
        return false;
    }

    protected clearFocusedItem(sourceType: number): void {
        if (sourceType === 1) {
            document.querySelector(".sy__outline .b3-list-item--focus, #sidebar [data-type='sidebar-outline'] .b3-list-item--focus")?.classList.remove("b3-list-item--focus");
        } else {
            document.querySelector(".sy__file .b3-list-item--focus, #sidebar [data-type='sidebar-file'] .b3-list-item--focus")?.classList.remove("b3-list-item--focus");
        }
    }
}
