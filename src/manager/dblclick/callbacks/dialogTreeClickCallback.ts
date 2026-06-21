import { debugPush } from "@/logger";
import { ClickDispatchContext } from "../types";
import TreeClickCallbackBase from "./treeClickCallbackBase";
import { CLICK_SOURCE_TYPE } from "@/constants";

export default class DialogTreeClickCallback extends TreeClickCallbackBase {
    protected getOpenActionType() {
        return "trueClick" as const;
    }

    protected doNotSkipCtrlKey(): boolean {
        return false;
    }

    protected clearFocusedItem(sourceType: CLICK_SOURCE_TYPE): void {
        document.getElementById("foldTree")?.querySelectorAll(".b3-list-item--focus").forEach((elem) => elem.classList.remove("b3-list-item--focus"));
    }

    protected doubleClickUnfoldHandler(ctx: ClickDispatchContext): boolean {
        const sourceElem = ctx.itemElement;
        if (sourceElem == null) {
            return false;
        }
        debugPush("由 双击展开 处理", sourceElem);
        const targetNodeId = this.getContextId(ctx);
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