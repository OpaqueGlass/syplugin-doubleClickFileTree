import { getReadOnlyGSettings } from "@/manager/settingManager";
import type { ClickDispatchContext } from "../types";
import { debugPush } from "@/logger";
import { CLICK_SOURCE_TYPE } from "@/constants";

export default abstract class PanelClickCallbackBase {
    private recentClickedAt = 0;
    private recentClickedId: string | null = null;
    private recentClickTimer: number | null = null;

    handle(ctx: ClickDispatchContext): void {
        if (!this.shouldHandleContext(ctx)) {
            return;
        }

        if (!ctx.event.isTrusted && this.shouldIgnoreSyntheticEvent(ctx)) {
            return;
        }

        const now = Date.now();
        debugPush("接收到点击事件", now);
        const settings = getReadOnlyGSettings();
        const dblclickDelay = Number(settings.dblclickShowSubDoc ? (settings?.dblclickDelay ?? 200) : 0);
        const timeGap = now - this.recentClickedAt;

        if (timeGap > dblclickDelay) {
            this.recentClickedAt = now;
            window.clearTimeout(this.recentClickTimer ?? undefined);
            this.recentClickTimer = null;
            this.recentClickedId = this.getContextId(ctx);

            this.recentClickTimer = window.setTimeout(() => {
                this.recentClickedAt = 0;
                this.recentClickTimer = null;
                this.handleSingleAction(ctx);
                this.recentClickedId = null;
            }, this.getSingleClickDelay(ctx, dblclickDelay));
            this.afterHandleSingleQueued(ctx);
            this.stopEvent(ctx.event);
            return;
        }

        window.clearTimeout(this.recentClickTimer ?? undefined);
        this.recentClickTimer = null;
        this.recentClickedAt = 0;
        if (this.handleDoubleAction(ctx)) {
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
        this.onDispose();
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
