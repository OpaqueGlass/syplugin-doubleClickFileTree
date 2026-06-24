import { isEventCtrlKey, isValidStr } from "@/utils/commonCheck";
import { debugPush, errorPush, logPush } from "@/logger";
import { getReadOnlyGSettings } from "@/manager/settingManager";
import { isMobile } from "@/syapi";
import * as siyuan from "siyuan";
import { getPluginInstance } from "@/utils/pluginHelper";
import PanelClickCallbackBase from "./panelClickCallbackBase";
import type { ClickDispatchContext } from "../types";
import { CLICK_SOURCE_TYPE } from "@/constants";

export type TreePanelKind = "fileTree" | "outline";

export default abstract class TreeClickCallbackBase extends PanelClickCallbackBase {
    protected pluginClickToggle = false;
    private pluginRawClickItem = false;

    protected shouldHandleContext(ctx: ClickDispatchContext): boolean {
        const event = ctx.event;
        if (event.button !== 0) {
            debugPush("按下的按键不是左键，终止操作");
            return false;
        }
        const setting = getReadOnlyGSettings();
        if (!this.doNotSkipCtrlKey() && isEventCtrlKey(event)) {
            debugPush("伴随ctrl/meta key按下，终止操作");
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
        if (!setting.disableChangeIcon && this.isIconTarget(event.target)) {
            debugPush("点击的是图标，终止操作");
            return false;
        }
        if (this.isActionTarget(event.target)) {
            debugPush("列表操作项，不处理", event.target);
            return false;
        }
        if (this.isToggleTarget(event.target)) {
            const toggleSourceElem = this.getSourceSpanElement(event.target);
            debugPush("判定跳出用", toggleSourceElem);
            if (toggleSourceElem == null) {
                debugPush("sourceElem未找到，未知情况，不处理", event.target);
                return false;
            }
            if (this.isActionTarget(toggleSourceElem)) {
                debugPush("列表操作项，不处理", event.target);
                return false;
            }
            if (this.isMoreButton(toggleSourceElem)) {
                debugPush("点击的是更多按钮或新建按钮，终止操作");
                return false;
            }
            if (!setting.extendClickArea || this.pluginClickToggle) {
                debugPush("点击的是展开按钮，且不允许响应展开");
                this.pluginClickToggle = false;
                return false;
            }
        }
        const commonMenu = document.getElementById("commonMenu");
        if (commonMenu && !commonMenu.classList.contains("fn__none")) {
            debugPush("当前存在commonMeue右键菜单，终止操作");
            return false;
        }
        if (this.isPluginRawClickAction() && this.pluginRawClickItem) {
            this.pluginRawClickItem = false;
            debugPush("由插件执行点击，终止操作");
            return false;
        }
        return true;
    }

    protected getContextId(ctx: ClickDispatchContext): string | null {
        return ctx.itemElement.getAttribute("data-node-id") ?? ctx.itemId;
    }

    protected handleSingleAction(ctx: ClickDispatchContext): void {
        const setting = getReadOnlyGSettings();
        if (setting.revertBehavior) {
            this.singleClickUnfoldHandler(ctx);
        } else {
            this.clickToOpenMulitWayDistributor(ctx);
        }
    }

    protected handleDoubleAction(ctx: ClickDispatchContext): boolean {
        const setting = getReadOnlyGSettings();
        if (setting.revertBehavior) {
            return this.clickToOpenMulitWayDistributor(ctx);
        }
        return this.doubleClickUnfoldHandler(ctx);
    }

    protected clickToOpenMulitWayDistributor(ctx: ClickDispatchContext): boolean {
        switch (this.getOpenActionType()) {
            case "openDoc":
                return this.singleClickOpenDocHandler(ctx);
            case "rawClick":
                return this.pluginClickHandler(ctx);
            case "trueClick":
                return this.pluginTrueClickHandler(ctx);
            default:
                return this.pluginTrueClickHandler(ctx);
        }
    }

    protected singleClickOpenDocHandler(ctx: ClickDispatchContext): boolean {
        const sourceElem = ctx.itemElement;
        if (sourceElem == null) {
            debugPush("sourceElem未找到");
            return false;
        }
        debugPush("由 单击打开 处理", sourceElem);
        return this.openDocByTreeItemElement(sourceElem);
    }

    protected singleClickUnfoldHandler(ctx: ClickDispatchContext): void {
        const sourceElem = ctx.itemElement;
        if (sourceElem == null) {
            debugPush("sourceElem未找到");
            return;
        }
        debugPush("由 单击展开 处理", sourceElem);
        const b3ListItemToggle = sourceElem.querySelector(".b3-list-item__toggle") as HTMLElement | null;
        if (b3ListItemToggle && !b3ListItemToggle.classList.contains("fn__hidden")) {
            this.pluginClickToggle = true;
            b3ListItemToggle.click();
            debugPush("展开层级成功");
        } else {
            // 【FAST_FORWARD】无子层级，需要走打开逻辑
            this.clickToOpenMulitWayDistributor(ctx);
        }
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
            this.pluginClickToggle = true;
            b3ListItemToggle.click();
            debugPush("展开文件层级成功");
            return true;
        }
        return false;
    }

    protected pluginClickHandler(ctx: ClickDispatchContext): boolean {
        const sourceElem = ctx.itemElement;
        if (sourceElem == null) {
            debugPush("sourceElem未找到");
            return false;
        }
        const dialogElem = document.querySelector(".b3-dialog--open") as HTMLElement | null;
        const dialogType = dialogElem?.getAttribute("data-key");
        const multiSelectBlackList = ["dialog-movepathto"];
        if (!isEventCtrlKey(ctx.event) || multiSelectBlackList.includes(dialogType ?? "")) {
            document.getElementById("foldTree")?.querySelectorAll(".b3-list-item--focus").forEach((elem) => elem.classList.remove("b3-list-item--focus"));
            document.getElementById("foldList")?.querySelectorAll(".b3-list-item--focus").forEach((elem) => elem.classList.remove("b3-list-item--focus"));
        }
        if (sourceElem.classList.contains("b3-list-item--focus")) {
            sourceElem.classList.remove("b3-list-item--focus");
        } else {
            sourceElem.classList.add("b3-list-item--focus");
        }
        debugPush("由 插件点击 处理", sourceElem);
        return true;
    }

    protected afterHandleSingleQueued(_ctx: ClickDispatchContext): void {
        if (!isEventCtrlKey(_ctx.event)) {
            debugPush("清除其他焦点");
            this.clearFocusedItem(this.getSourceTypeBySourceElem(_ctx.itemElement));
        }
        debugPush("设置当前焦点", _ctx.itemElement);
        _ctx.itemElement.classList.add("b3-list-item--focus");
    }

    protected pluginTrueClickHandler(ctx: ClickDispatchContext): boolean {
        const sourceElem = ctx.itemElement;
        if (sourceElem == null) {
            debugPush("sourceElem未找到");
            return false;
        }
        if (!isEventCtrlKey(ctx.event)) {
            document.getElementById("foldTree")?.querySelectorAll(".b3-list-item--focus").forEach((elem) => elem.classList.remove("b3-list-item--focus"));
        }
        sourceElem.classList.add("b3-list-item--focus");
        debugPush("由 插件点击 处理", sourceElem);
        this.pluginRawClickItem = true;
        sourceElem.click();
        return true;
    }

    protected openDocByTreeItemElement(sourceElem: HTMLElement): boolean {
        debugPush("souceElem打开文档/展开笔记本", sourceElem);
        if (sourceElem == null) {
            return false;
        }
        let souceType = this.getSourceTypeBySourceElem(sourceElem);

        if (souceType < CLICK_SOURCE_TYPE.NOTEBOOK) {
            const targetNodeId = sourceElem.getAttribute("data-node-id");
            debugPush("获取到的文件id", targetNodeId);
            if (isValidStr(targetNodeId)) {
                debugPush("打开文档", targetNodeId);
                this.clearFocusedItem(souceType);
                sourceElem.classList.add("b3-list-item--focus");
                const setting = getReadOnlyGSettings();
                if (setting.unfoldSubDocsWhileOpenParent != 0) {
                    const b3ListItemToggle = sourceElem.querySelector(".b3-list-item__toggle") as HTMLElement | null;
                    const child = b3ListItemToggle?.querySelector(".b3-list-item__arrow--open");
                    if (child && setting.unfoldSubDocsWhileOpenParent == 2) {
                        debugPush("节点已经展开，根据要求不收起");
                    } else if (b3ListItemToggle && !(setting.revertBehavior && setting.treatAsFolder)) {
                        // 如果启用了“将文档视为文件夹”，则不执行展开操作，否则会和单击操作出现冲突
                        debugPush("同时操作展开");
                        this.pluginClickToggle = true;
                        b3ListItemToggle.click();
                    }
                }

                if (!isMobile()) {
                    debugPush("OPENTAB", new Date().getTime());
                    siyuan.openTab({
                        app: getPluginInstance().app,
                        doc: {
                            id: targetNodeId,
                            action: souceType === CLICK_SOURCE_TYPE.FILE_TREE && getReadOnlyGSettings().openToTop ? undefined : ["cb-get-focus", "cb-get-scroll"],
                        }
                    }).catch((err) => {
                        errorPush("打开文档时发生错误", err);
                    });
                } else {
                    siyuan.openMobileFileById(
                        getPluginInstance().app,
                        targetNodeId,
                        souceType === CLICK_SOURCE_TYPE.FILE_TREE && getReadOnlyGSettings().openToTop ? ["cb-get-focus"] : ["cb-get-focus", "cb-get-scroll"]
                    );
                }

                return true;
            }
        } else if (souceType === CLICK_SOURCE_TYPE.NOTEBOOK) {
            const b3ListItemToggle = sourceElem.querySelector(".b3-list-item__toggle") as HTMLElement | null;
            if (!b3ListItemToggle) {
                return false;
            }
            this.pluginClickToggle = true;
            b3ListItemToggle.click();
            debugPush("展开笔记本层级成功");
            return true;
        }
        return false;
    }

    protected isPluginRawClickAction(): boolean {
        return this.getOpenActionType() === "rawClick" || this.getOpenActionType() === "trueClick";
    }

    protected isIconTarget(target: EventTarget | null): boolean {
        const elem = target as HTMLElement | null;
        return !!elem && (elem.classList.contains("b3-list-item__icon") || (elem.tagName === "IMG" && elem.parentElement?.classList.contains("b3-list-item__icon")));
    }

    protected isActionTarget(target: EventTarget | null): boolean {
        const elem = target as HTMLElement | null;
        return !!elem && elem.classList.contains("b3-list-item__action");
    }

    protected isToggleTarget(target: EventTarget | null): boolean {
        const elem = target as HTMLElement | null;
        return !!elem && (elem.classList.contains("b3-list-item__toggle") || ["svg", "use"].includes(elem.tagName));
    }

    protected isMoreButton(sourceElem: Element): boolean {
        return ["more-file", "more-root", "new"].includes(sourceElem.getAttribute("data-type") ?? "");
    }

    protected hasVisibleToggle(sourceElem: HTMLElement): boolean {
        const b3ListItemToggle = sourceElem.querySelector(".b3-list-item__toggle") as HTMLElement | null;
        if (!b3ListItemToggle) {
            return false;
        }
        return !b3ListItemToggle.classList.contains("fn__hidden");
    }

    protected getSourceSpanElement(target: EventTarget | null): HTMLElement | null {
        let ftItemElem = target as HTMLElement | null;
        let isFound = false;
        for (let i = 0; i < 4 && ftItemElem; i++) {
            if (ftItemElem == null) {
                break;
            }
            debugPush("getSourceSpan", ftItemElem, ftItemElem.tagName, ftItemElem.tagName?.toLowerCase() == "span");
            if (ftItemElem.tagName?.toLowerCase() == "span") {
                isFound = true;
                break;
            }
            ftItemElem = ftItemElem.parentElement;
        }
        return isFound ? ftItemElem : null;
    }

    protected isMetaKey(event: MouseEvent): boolean {
        const platform = window.top.siyuan.config.system.os ?? navigator.platform ?? "ERROR";
        const isMac = /DARWIN|MAC|IPAD|IPHONE|IOS/i.test(platform);
        return isMac ? event.ctrlKey : event.metaKey;
    }

    protected getSourceTypeBySourceElem(sourceElem: Element): CLICK_SOURCE_TYPE {
        let souceType = CLICK_SOURCE_TYPE.FILE_TREE;
        switch (sourceElem.getAttribute("data-type")) {
            case "navigation-file":
                souceType = CLICK_SOURCE_TYPE.FILE_TREE;
                break;
            case "NodeHeading":
                souceType = CLICK_SOURCE_TYPE.OUTLINE_TREE;
                break;
            case "navigation-root":
                souceType = CLICK_SOURCE_TYPE.NOTEBOOK;
                break;
            default:
                logPush("未能识别的sourceElement类型，使用默认配置 FILE_TREE");
                souceType = CLICK_SOURCE_TYPE.FILE_TREE;
                break;
        }
        return souceType;
    }

    protected getSingleClickDelay(_ctx: ClickDispatchContext, dblclickDelay: number): number {
        const setting = getReadOnlyGSettings();
        if (!setting.revertBehavior) {
            const itemElem = _ctx.itemElement;
            const toggleElem = itemElem?.querySelector(".b3-list-item__toggle");
            if (toggleElem && toggleElem.classList.contains("fn__hidden")) {
                debugPush("点击目标非文件夹，直接执行打开任务，单击延迟设置为0");
                return 0;
            }
        } else {
            // 启用交换逻辑
            if (setting.treatAsFolder) {
                const itemElem = _ctx.itemElement;
                const toggleElem = itemElem?.querySelector(".b3-list-item__toggle");
                if (toggleElem) {
                    debugPush("启用将父文档视为文件夹，点击目标存在展开按钮，直接执行打开任务，单击延迟设置为0；不存在时，对应直接直接展开，也不需要延迟");
                    return 0;
                }
            }
        }
        return dblclickDelay;
    }

    protected abstract getOpenActionType(): "openDoc" | "rawClick" | "trueClick";
    protected abstract doNotSkipCtrlKey(): boolean;
    protected abstract clearFocusedItem(sourceType: CLICK_SOURCE_TYPE): void;
}
