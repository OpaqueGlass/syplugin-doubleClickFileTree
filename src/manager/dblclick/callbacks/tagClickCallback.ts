import { isEventCtrlKey } from "@/utils/commonCheck";
import { debugPush } from "@/logger";
import PanelClickCallbackBase from "./panelClickCallbackBase";
import type { ClickDispatchContext } from "../types";
import { getReadOnlyGSettings } from "@/manager/settingManager";
import TreeClickCallbackBase from "./treeClickCallbackBase";

export default class TagClickCallback extends TreeClickCallbackBase {
    protected shouldHandleContext(ctx: ClickDispatchContext): boolean {
        const event = ctx.event;
        if (event.button !== 0) {
            debugPush("按下的按键不是左键，终止操作");
            return false;
        }
        if (event.shiftKey || event.altKey) {
            debugPush("伴随shift/alt按下，终止操作");
            return false;
        }
        if (this.isMetaKey(event)) {
            debugPush("伴随meta按下，终止操作");
            return false;
        }
        return true;
    }

    protected getContextId(ctx: ClickDispatchContext): string | null {
        return ctx.itemElement.getAttribute("data-label");
    }

    protected getOpenActionType() {
        return "trueClick" as const;
    }

    protected doNotSkipCtrlKey(): boolean {
        return true;
    }

    protected clearFocusedItem(): void {
        document.querySelectorAll(".sy__tag .b3-list-item--focus, #sidebar [data-type='sidebar-tag'] .b3-list-item--focus").forEach((elem) => elem.classList.remove("b3-list-item--focus"));
    }
}
