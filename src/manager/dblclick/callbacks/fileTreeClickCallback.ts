import { debugPush, errorPush } from "@/logger";
import { getReadOnlyGSettings } from "@/manager/settingManager";
import { isMobile } from "@/syapi";
import { isDocTreeShiftRangeSelectAvailable } from "@/utils/compatUtils";
import type { ClickDispatchContext } from "../types";
import FileTreeChildrenPrefetcher from "./fileTreeChildrenPrefetcher";
import TreeClickCallbackBase from "./treeClickCallbackBase";

export default class FileTreeClickCallback extends TreeClickCallbackBase {
    /** 子文档列表预取器：单击后提前拉取，双击时直接复用 */
    private readonly childrenPrefetcher = new FileTreeChildrenPrefetcher();

    protected getOpenActionType() {
        return "openDoc" as const;
    }

    protected doNotSkipCtrlKey(): boolean {
        return false;
    }

    protected supportsShiftRangeSelect(): boolean {
        // v3.3.4 起思源官方已原生支持文档树 Shift 多选，插件不再接管（即使设置项启用也不生效）
        return !isMobile()
            && getReadOnlyGSettings().shiftMultiSelect === true
            && isDocTreeShiftRangeSelectAvailable();
    }

    protected getRangeSelectItems(): HTMLElement[] {
        const root = document.querySelector(".sy__file")
            ?? document.querySelector("#sidebar [data-type='sidebar-file']");
        if (!root) {
            return [];
        }
        return Array.from(
            root.querySelectorAll<HTMLElement>("li[data-type='navigation-file'], li[data-type='navigation-root']")
        ).filter((li) => !li.classList.contains("fn__none"));
    }

    protected afterHandleSingleQueued(ctx: ClickDispatchContext): void {
        super.afterHandleSingleQueued(ctx);
        const setting = getReadOnlyGSettings();
        if (!setting?.dblclickShowSubDoc || !setting?.prefetchSubDocsForDoubleClick || setting?.revertBehavior) {
            return;
        }
        void this.childrenPrefetcher.prefetch(ctx.itemElement);
    }

    protected doubleClickUnfoldHandler(ctx: ClickDispatchContext): boolean {
        const setting = getReadOnlyGSettings();
        if (!setting?.dblclickShowSubDoc) {
            return super.doubleClickUnfoldHandler(ctx);
        }
        if (!setting?.prefetchSubDocsForDoubleClick) {
            return super.doubleClickUnfoldHandler(ctx);
        }

        const sourceElem = ctx.itemElement;
        if (sourceElem == null) {
            return false;
        }
        const targetNodeId = sourceElem.getAttribute("data-node-id");
        debugPush("由 双击展开（预取复用）处理", sourceElem, sourceElem.classList);
        debugPush("双击targetNodeId, g_id", targetNodeId, this.getRecentClickedId());
        const recentClickedId = this.getRecentClickedId();
        if (recentClickedId !== targetNodeId) {
            debugPush("双击targetNodeId与最近点击id不一致", targetNodeId, recentClickedId);
            // return false;
        }

        const b3ListItemToggle = sourceElem.querySelector(".b3-list-item__toggle") as HTMLElement | null;
        if (b3ListItemToggle == null) {
            debugPush("未找到展开按钮");
            return false;
        }

        if (this.isTreeItemExpanded(sourceElem)) {
            debugPush("双击收起", sourceElem);
            this.collapseTreeItem(sourceElem);
            return true;
        }

        const target = this.childrenPrefetcher.resolveTarget(sourceElem);
        if (target == null) {
            debugPush("无法定位预取展开目标，回退到原始展开逻辑");
            return super.doubleClickUnfoldHandler(ctx);
        }

        debugPush("尝试插入元素");
        void this.insertPrefetchedChildren(sourceElem, target.notebookId, target.path, b3ListItemToggle).catch((err) => {
            errorPush("复用预取展开列表失败", err);
        });
        return true;
    }

    protected clearFocusedItem(_sourceType: number): void {
        // 移除所在面板（文档树）下所有的 focus，而非仅第一个匹配项
        document.querySelectorAll(".sy__file .b3-list-item--focus, #sidebar [data-type='sidebar-file'] .b3-list-item--focus")
            .forEach((elem) => elem.classList.remove("b3-list-item--focus"));
    }

    protected onDispose(): void {
        this.childrenPrefetcher.clear();
        super.onDispose();
    }

    /**
     * 双击展开时插入预取到的子文档列表；拿不到预取结果则回退到点击官方展开按钮。
     */
    private async insertPrefetchedChildren(sourceElem: HTMLElement, notebookId: string, path: string, toggleElement: HTMLElement): Promise<void> {
        const prefetched = await this.childrenPrefetcher.consume(sourceElem, notebookId, path);
        if (!prefetched) {
            debugPush("预取展开列表为空，回退到原始展开逻辑");
            this.pluginClickToggle = true;
            toggleElement.click();
            return;
        }
        if (!sourceElem.isConnected) {
            return;
        }
        const nextElement = sourceElem.nextElementSibling;
        if (nextElement && nextElement.tagName === "UL") {
            nextElement.innerHTML = prefetched.html;
            this.setTreeItemExpanded(sourceElem, true);
            return;
        }

        sourceElem.insertAdjacentHTML("afterend", `<ul class="file-tree__sliderDown">${prefetched.html}</ul>`);
        const insertedElement = sourceElem.nextElementSibling as HTMLElement | null;
        if (!insertedElement) {
            return;
        }
        this.setTreeItemExpanded(sourceElem, true);

        setTimeout(() => {
            if (!insertedElement.isConnected) {
                return;
            }
            insertedElement.setAttribute("style", `top: -1px;position: relative;height:${insertedElement.childElementCount * (sourceElem.clientHeight + 1) - 1}px;`);
            setTimeout(() => {
                if (!insertedElement.isConnected) {
                    return;
                }
                insertedElement.classList.remove("file-tree__sliderDown");
                insertedElement.removeAttribute("style");
            }, 120);
        }, 2);
    }

    private isTreeItemExpanded(sourceElem: HTMLElement): boolean {
        const nextElement = sourceElem.nextElementSibling;
        return nextElement?.tagName === "UL" || sourceElem.querySelector(".b3-list-item__arrow")?.classList.contains("b3-list-item__arrow--open") === true;
    }

    private collapseTreeItem(sourceElem: HTMLElement): void {
        const nextElement = sourceElem.nextElementSibling;
        if (nextElement?.tagName === "UL") {
            nextElement.remove();
        }
        this.setTreeItemExpanded(sourceElem, false);
    }

    private setTreeItemExpanded(sourceElem: HTMLElement, expanded: boolean): void {
        const arrowElement = sourceElem.querySelector(".b3-list-item__arrow");
        if (!arrowElement) {
            return;
        }
        arrowElement.classList.toggle("b3-list-item__arrow--open", expanded);
    }

}
