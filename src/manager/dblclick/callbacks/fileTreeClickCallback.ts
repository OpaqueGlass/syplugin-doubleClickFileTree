import { debugPush, errorPush } from "@/logger";
import { getReadOnlyGSettings } from "@/manager/settingManager";
import { listDocsByPathT } from "@/syapi";
import { escapeHTML } from "@/utils/common";
import { isValidStr } from "@/utils/commonCheck";
import type { ClickDispatchContext } from "../types";
import TreeClickCallbackBase from "./treeClickCallbackBase";

type PrefetchedTreeChildren = {
    notebookId: string;
    path: string;
    html: string;
};

export default class FileTreeClickCallback extends TreeClickCallbackBase {
    private readonly treeChildrenCache = new Map<string, Promise<PrefetchedTreeChildren | null>>();

    protected getOpenActionType() {
        return "openDoc" as const;
    }

    protected doNotSkipCtrlKey(): boolean {
        return false;
    }

    protected afterHandleSingleQueued(ctx: ClickDispatchContext): void {
        super.afterHandleSingleQueued(ctx);
        const setting = getReadOnlyGSettings();
        if (!setting?.dblclickShowSubDoc || !setting?.prefetchSubDocsForDoubleClick || setting?.revertBehavior) {
            return;
        }
        void this.prefetchTreeChildren(ctx);
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

        const notebookId = this.getNotebookId(sourceElem);
        const path = this.getTreePath(sourceElem);
        if (!isValidStr(notebookId) || !isValidStr(path)) {
            debugPush("无法定位预取展开目标，回退到原始展开逻辑");
            return super.doubleClickUnfoldHandler(ctx);
        }

        debugPush("尝试插入元素");
        void this.insertPrefetchedChildren(sourceElem, notebookId, path, b3ListItemToggle).catch((err) => {
            errorPush("复用预取展开列表失败", err);
        });
        return true;
    }

    protected clearFocusedItem(sourceType: number): void {
        document.querySelector(".sy__file .b3-list-item--focus, #sidebar [data-type='sidebar-file'] .b3-list-item--focus")?.classList.remove("b3-list-item--focus");
    }

    private async prefetchTreeChildren(ctx: ClickDispatchContext): Promise<PrefetchedTreeChildren | null> {
        const sourceElem = ctx.itemElement;
        if (sourceElem == null) {
            return null;
        }
        const toggleElement = sourceElem.querySelector(".b3-list-item__toggle") as HTMLElement | null;
        if (toggleElement == null || toggleElement.classList.contains("fn__hidden")) {
            return null;
        }

        const notebookId = this.getNotebookId(sourceElem);
        const path = this.getTreePath(sourceElem);
        if (!isValidStr(notebookId) || !isValidStr(path)) {
            return null;
        }

        const editingPublishAccess = sourceElem.closest(".sy__file")?.classList.contains("file-tree__publish-access--active") ?? false;
        return this.getTreeChildrenPromise(notebookId, path, editingPublishAccess);
    }

    private async insertPrefetchedChildren(sourceElem: HTMLElement, notebookId: string, path: string, _toggleElement: HTMLElement): Promise<void> {
        const editingPublishAccess = sourceElem.closest(".sy__file")?.classList.contains("file-tree__publish-access--active") ?? false;
        const prefetched = await this.getTreeChildrenPromise(notebookId, path, editingPublishAccess);
        if (!prefetched) {
            debugPush("预取展开列表为空，回退到原始展开逻辑");
            this.pluginClickToggle = true;
            _toggleElement.click();
            return;
        }
        if (!sourceElem.isConnected) {
            return;
        }
        const cacheKey = this.getChacheKey(notebookId, path, editingPublishAccess);
        this.treeChildrenCache.delete(cacheKey);
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

    private getChacheKey(notebookId: string, path: string, editingPublishAccess: boolean): string {
        return `${notebookId}::${path}::${editingPublishAccess ? 1 : 0}`;
    }

    private getTreeChildrenPromise(notebookId: string, path: string, editingPublishAccess = false): Promise<PrefetchedTreeChildren | null> {
        const cacheKey = this.getChacheKey(notebookId, path, editingPublishAccess);
        const existedPromise = this.treeChildrenCache.get(cacheKey);
        if (existedPromise) {
            return existedPromise;
        }

        const promise = listDocsByPathT({ notebook: notebookId, path }).then((files) => {
            if (!files || files.length === 0) {
                this.treeChildrenCache.delete(cacheKey);
                return null;
            }
            return {
                notebookId,
                path,
                html: this.buildTreeChildrenHtml(files, editingPublishAccess),
            };
        }).catch((err) => {
            this.treeChildrenCache.delete(cacheKey);
            errorPush("预取文档树展开列表失败", err);
            return null;
        });

        this.treeChildrenCache.set(cacheKey, promise);
        return promise;
    }

    private getNotebookId(sourceElem: HTMLElement): string | null {
        return sourceElem.closest("ul[data-url]")?.getAttribute("data-url") ?? null;
    }

    private getTreePath(sourceElem: HTMLElement): string | null {
        return sourceElem.getAttribute("data-path") ?? null;
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

    private buildTreeChildrenHtml(files: IFile[], editingPublishAccess: boolean): string {
        let html = "";
        for (const item of files) {
            html += this.buildTreeItemHtml(item, editingPublishAccess);
        }
        return html;
    }

    private buildTreeItemHtml(item: IFile, editingPublishAccess: boolean): string {
        const countHtml = item.count && item.count > 0
            ? `<span class="popover__block counter b3-tooltips b3-tooltips__nw" aria-label="${window.siyuan.languages.ref}">${item.count}</span>`
            : "";
        const paddingLeft = (item.path.split("/").length - 1) * 18;
        const defaultDocIcon = String.fromCodePoint(parseInt(window.siyuan.storage["local-images"].file, 16));
        const defaultFolderIcon = String.fromCodePoint(parseInt(window.siyuan.storage["local-images"].folder, 16));
        const icon = item.icon || (item.subFileCount === 0 ? defaultDocIcon : defaultFolderIcon);
        const ariaLabel = this.getDocAriaLabel(item);

        return `<li data-node-id="${item.id}" data-name="${escapeHTML(item.name)}" draggable="true" data-count="${item.subFileCount}"
data-type="navigation-file"
style="--file-toggle-width:${paddingLeft + 18}px"
class="b3-list-item b3-list-item--hide-action" data-path="${item.path}">
    <span style="padding-left: ${paddingLeft}px" class="b3-list-item__toggle b3-list-item__toggle--hl${item.subFileCount === 0 ? " fn__hidden" : ""}">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    <span class="b3-list-item__icon b3-tooltips b3-tooltips__n popover__block${editingPublishAccess ? " fn__none" : ""}" data-id="${item.id}" aria-label="${window.siyuan.languages.changeIcon}">${escapeHTML(icon)}</span>
    <span class="b3-list-item__switch b3-tooltips b3-tooltips__n${editingPublishAccess ? "" : " fn__none"}" aria-label="${window.siyuan.languages.publishAccess}"><svg><use xlink:href="#iconPublic"></use></svg></span>
    <span class="b3-list-item__text ariaLabel" data-position="parentE"
aria-label="${ariaLabel}">${escapeHTML(item.name)}</span>
    <span data-type="more-file" class="b3-list-item__action b3-tooltips b3-tooltips__nw" aria-label="${window.siyuan.languages.more}">
        <svg><use xlink:href="#iconMore"></use></svg>
    </span>
    <span data-type="new" class="b3-list-item__action b3-tooltips b3-tooltips__nw${window.siyuan.config.readonly ? " fn__none" : ""}" aria-label="${window.siyuan.languages.newSubDoc}">
        <svg><use xlink:href="#iconAdd"></use></svg>
    </span>
    ${countHtml}
</li>`;
    }

    private getDocAriaLabel(item: IFile): string {
        const escapeMethod = escapeHTML;
        return `${escapeMethod(item.name)} <small class='ft__on-surface'>${item.hSize}</small>${item.bookmark ? "<br>" + window.siyuan.languages.bookmark + " " + escapeMethod(item.bookmark) : ""}${item.name1 ? "<br>" + window.siyuan.languages.name + " " + escapeMethod(item.name1) : ""}${item.alias ? "<br>" + window.siyuan.languages.alias + " " + escapeMethod(item.alias) : ""}${item.memo ? "<br>" + window.siyuan.languages.memo + " " + escapeMethod(item.memo) : ""}${item.subFileCount !== 0 ? window.siyuan.languages.includeSubFile.replace("x", item.subFileCount) : ""}<br>${window.siyuan.languages.modifiedAt} ${item.hMtime}<br>${window.siyuan.languages.createdAt} ${item.hCtime}`;
    }
}
