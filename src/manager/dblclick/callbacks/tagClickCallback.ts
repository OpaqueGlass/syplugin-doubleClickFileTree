import { isEventCtrlKey } from "@/utils/commonCheck";
import { debugPush } from "@/logger";
import PanelClickCallbackBase from "./panelClickCallbackBase";
import type { ClickDispatchContext } from "../types";

export default class TagClickCallback extends PanelClickCallbackBase {
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
        return ctx.itemId;
    }

    protected handleSingleAction(ctx: ClickDispatchContext): void {
        this.trueClick(ctx);
    }

    protected handleDoubleAction(_ctx: ClickDispatchContext): boolean {
        return false;
    }

    protected getOpenActionType() {
        return "trueClick" as const;
    }

    protected doNotSkipCtrlKey(): boolean {
        return true;
    }

    protected clearFocusedItem(): void {
        document.getElementById("foldTree")?.querySelectorAll(".b3-list-item--focus").forEach((elem) => elem.classList.remove("b3-list-item--focus"));
    }

    private trueClick(ctx: ClickDispatchContext): boolean {
        const sourceElem = ctx.itemElement;
        if (!isEventCtrlKey(ctx.event)) {
            this.clearFocusedItem();
        }
        sourceElem.classList.add("b3-list-item--focus");
        debugPush("由 插件点击 处理", sourceElem);
        sourceElem.click();
        return true;
    }
}
