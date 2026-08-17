import { getReadOnlyGSettings } from "@/manager/settingManager";
import type { ClickDispatchContext } from "../types";
import { debugPush } from "@/logger";
import { CLICK_SOURCE_TYPE } from "@/constants";
import { isMobile } from "@/syapi";
import ShiftRangeSelectHandler from "../shiftRangeSelect";

export default abstract class PanelClickCallbackBase {
    private recentClickedAt = 0;
    private recentClickedId: string | null = null;
    private recentClickTimer: number | null = null;
    private readonly shiftSelectHandler = new ShiftRangeSelectHandler();

    handle(ctx: ClickDispatchContext): void {
        // Shift 范围选择拦截（supportsShiftRangeSelect 默认 false，整体短路）
        if (this.supportsShiftRangeSelect() && ctx.event.button === 0 && !ctx.event.altKey) {
            if (ctx.event.shiftKey) {
                if (this.isShiftRangeSelectTarget(ctx)) {
                    this.handleShiftRangeSelect(ctx);
                    return;
                }
            } else {
                this.shiftSelectHandler.updateAnchor(ctx.itemElement);
            }
        }

        if (!this.shouldHandleContext(ctx)) {
            return;
        }

        if (!ctx.event.isTrusted && this.shouldIgnoreSyntheticEvent(ctx)) {
            return;
        }

        const now = ctx.event.timeStamp;
        const prevClickedAt = this.recentClickedAt;
        this.recentClickedAt = now;
        debugPush("接收到点击事件", now);
        const detailClick = ctx.event.detail % 2;
        
        const timeGap = now - prevClickedAt;
        const currentId = this.getContextId(ctx);

        const settings = getReadOnlyGSettings();
        const dblclickDelay = Number(settings.dblclickShowSubDoc ? (settings?.dblclickDelay ?? 200) : 0);

        debugPush("timegap", timeGap, "recentClickedId", this.recentClickedId, "currentId", currentId, "dblclickDelay", dblclickDelay, "event.detail", ctx.event.detail);
        // (timeGap > dblclickDelay || currentId !== this.recentClickedId) && 
        // 移动端不支持detail判定单双击
        const mobileFlag = isMobile();
        if ((detailClick === 1 && !mobileFlag) || ((timeGap > dblclickDelay || currentId !== this.recentClickedId) && mobileFlag)) {
            // window.clearTimeout(this.recentClickTimer ?? undefined);
            this.stopEvent(ctx.event);
            this.recentClickTimer = null;
            this.recentClickedId = currentId;

            this.recentClickTimer = setTimeout(() => {
                debugPush("单击处理超时，执行单击操作", this.recentClickedId);
                this.recentClickTimer = null;
                this.handleSingleAction(ctx);
                if (!(settings.treatAsFolder && mobileFlag && settings.revertBehavior)) {
                    this.recentClickedAt = 0;
                    this.recentClickedId = null;
                }
            }, this.getSingleClickDelay(ctx, dblclickDelay));
            this.afterHandleSingleQueued(ctx);
            return;
        }
        debugPush("双击处理，执行双击操作", this.recentClickedId);
        window.clearTimeout(this.recentClickTimer ?? undefined);
        this.recentClickTimer = null;
        this.recentClickedAt = 0;
        if ((detailClick !== 1 || mobileFlag) && this.handleDoubleAction(ctx)) {
            this.recentClickedId = null;
            this.stopEvent(ctx.event);
        }
    }

    dispose(): void {
        if (this.recentClickTimer != null) {
            window.clearTimeout(this.recentClickTimer);
        }
        this.recentClickTimer = null;
        this.recentClickedAt = 0;
        this.recentClickedId = null;
        this.shiftSelectHandler.dispose();
        this.onDispose();
    }

    private handleShiftRangeSelect(ctx: ClickDispatchContext): void {
        if (this.recentClickTimer != null) {
            window.clearTimeout(this.recentClickTimer);
            this.recentClickTimer = null;
        }
        this.recentClickedAt = 0;
        this.recentClickedId = null;
        this.stopEvent(ctx.event);
        this.shiftSelectHandler.handleRangeSelect(ctx.itemElement, this.getRangeSelectItems());
    }

    protected getRecentClickedId() {
        return this.recentClickedId;
    }

    protected setRecentClickedId(value: string | null) {
        this.recentClickedId = value;
    }

    protected getRecentClickedAt() {
        return this.recentClickedAt;
    }

    protected setRecentClickedAt(value: number) {
        this.recentClickedAt = value;
    }

    protected getSingleClickDelay(_ctx: ClickDispatchContext, dblclickDelay: number): number {
        return dblclickDelay;
    }

    protected afterHandleSingleQueued(_ctx: ClickDispatchContext): void {
        return;
    }

    protected onDispose(): void {
        return;
    }

    protected shouldIgnoreSyntheticEvent(_ctx: ClickDispatchContext): boolean {
        return true;
    }

    protected supportsShiftRangeSelect(): boolean {
        return false;
    }

    protected getRangeSelectItems(): HTMLElement[] {
        return [];
    }

    protected isShiftRangeSelectTarget(_ctx: ClickDispatchContext): boolean {
        return true;
    }

    protected stopEvent(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }

    protected isMetaKey(event: MouseEvent): boolean {
        const platform = window.top.siyuan.config.system.os ?? navigator.platform ?? "ERROR";
        const isMac = /DARWIN|MAC|IPAD|IPHONE|IOS/i.test(platform);
        return isMac ? event.ctrlKey : event.metaKey;
    }

    protected abstract shouldHandleContext(ctx: ClickDispatchContext): boolean;
    protected abstract getContextId(ctx: ClickDispatchContext): string | null;
    protected abstract handleSingleAction(ctx: ClickDispatchContext): void;
    protected abstract handleDoubleAction(ctx: ClickDispatchContext): boolean;
}
