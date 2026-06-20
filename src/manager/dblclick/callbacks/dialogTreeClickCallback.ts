import { debugPush } from "@/logger";
import { ClickDispatchContext } from "../types";
import TreeClickCallbackBase from "./treeClickCallbackBase";

export default class DialogTreeClickCallback extends TreeClickCallbackBase {
    protected getOpenActionType() {
        return "trueClick" as const;
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

    protected doubleClickUnfoldHandler(ctx: ClickDispatchContext): boolean {
        const sourceElem = ctx.itemElement;
        if (sourceElem == null) {
            return false;
        }
        debugPush("由 双击展开 处理", sourceElem);
        const targetNodeId = sourceElem.getAttribute("data-box") + sourceElem.getAttribute("data-path");
        debugPush("双击targetNodeId, g_id", targetNodeId, this.getRecentClickedId());
        if (sourceElem && this.getRecentClickedId() === targetNodeId) {
            const b3ListItemToggle = sourceElem.querySelector(".b3-list-item__toggle") as HTMLElement | null;
            if (b3ListItemToggle == null) {
                return false;
            }
            debugPush("双击展开文件层级", sourceElem);
            this.pluginClickToggle = true;
            b3ListItemToggle.click();
            debugPush("展开文件层级成功");
            return true;
        }
        return false;
    }

    protected getContextId(ctx: ClickDispatchContext): string | null {
        return ctx.itemElement.getAttribute("data-box") + ctx.itemElement.getAttribute("data-path");
    }
}