/**
 * 文档树子文档列表的预取器。
 *
 * 双击展开文档树时，官方会先请求 `/api/filetree/listDocsByPath` 再渲染，存在一次网络往返的延迟。
 * 本模块在「第一次单击排队后」提前发起同样的请求并把渲染好的 HTML 缓存起来，
 * 双击到来时直接插入 DOM，从而消除展开的等待感。
 *
 * 职责边界：
 * - 本模块只负责「数据获取 + 缓存 + 条目 HTML 构建」
 * - DOM 插入与展开动画由 `fileTreeClickCallback.ts` 负责
 */
import { debugPush, errorPush } from "@/logger";
import { listDocsByPathT } from "@/syapi";
import { escapeHTML } from "@/utils/common";
import { isValidStr } from "@/utils/commonCheck";
import { buildDocTreeIconHTML } from "@/utils/iconUtils";

export type PrefetchedTreeChildren = {
    notebookId: string;
    path: string;
    html: string;
};

/** 预取目标的定位信息 */
type PrefetchTarget = {
    notebookId: string;
    path: string;
    /** 是否处于「发布访问权限编辑」状态，影响图标 / 开关列的显隐 */
    editingPublishAccess: boolean;
};

type CacheEntry = {
    promise: Promise<PrefetchedTreeChildren | null>;
    createdAt: number;
};

/**
 * 缓存有效期：预取发生在单击之后，双击通常在数百毫秒内到达。
 * 超过该时间未消费的结果视为过期，避免文档树已变动却插入旧快照。
 */
const CACHE_TTL_MS = 10 * 1000;
/** 缓存条目上限，超出后按插入顺序淘汰最旧的一条 */
const CACHE_MAX_SIZE = 50;

export default class FileTreeChildrenPrefetcher {
    private readonly cache = new Map<string, CacheEntry>();

    /**
     * 预取某个文档树节点的子文档列表。
     * 节点没有展开按钮（即没有子文档）时直接跳过。
     */
    public async prefetch(sourceElem: HTMLElement | null): Promise<PrefetchedTreeChildren | null> {
        if (sourceElem == null) {
            return null;
        }
        const toggleElement = sourceElem.querySelector(".b3-list-item__toggle") as HTMLElement | null;
        if (toggleElement == null || toggleElement.classList.contains("fn__hidden")) {
            return null;
        }
        const target = this.resolveTarget(sourceElem);
        if (target == null) {
            return null;
        }
        return this.getChildrenPromise(target);
    }

    /**
     * 取用预取结果，并在取用后使缓存失效（下一次展开重新拉取最新数据）。
     */
    public async consume(sourceElem: HTMLElement, notebookId: string, path: string): Promise<PrefetchedTreeChildren | null> {
        const editingPublishAccess = this.isEditingPublishAccess(sourceElem);
        const cacheKey = this.getCacheKey(notebookId, path, editingPublishAccess);
        const prefetched = await this.getChildrenPromise({ notebookId, path, editingPublishAccess });
        this.cache.delete(cacheKey);
        return prefetched;
    }

    /**
     * 清空全部预取缓存。
     */
    public clear(): void {
        this.cache.clear();
    }

    /**
     * 解析预取目标；无法定位笔记本或路径时返回 null。
     */
    public resolveTarget(sourceElem: HTMLElement): PrefetchTarget | null {
        const notebookId = sourceElem.closest("ul[data-url]")?.getAttribute("data-url") ?? null;
        const path = sourceElem.getAttribute("data-path") ?? null;
        if (!isValidStr(notebookId) || !isValidStr(path)) {
            return null;
        }
        return {
            notebookId,
            path,
            editingPublishAccess: this.isEditingPublishAccess(sourceElem),
        };
    }

    private isEditingPublishAccess(sourceElem: HTMLElement): boolean {
        return sourceElem.closest(".sy__file")?.classList.contains("file-tree__publish-access--active") ?? false;
    }

    private getCacheKey(notebookId: string, path: string, editingPublishAccess: boolean): string {
        return `${notebookId}::${path}::${editingPublishAccess ? 1 : 0}`;
    }

    /**
     * 获取（或发起）子文档列表的 Promise，同一目标复用同一个请求。
     */
    private getChildrenPromise(target: PrefetchTarget): Promise<PrefetchedTreeChildren | null> {
        const cacheKey = this.getCacheKey(target.notebookId, target.path, target.editingPublishAccess);
        const existedEntry = this.cache.get(cacheKey);
        if (existedEntry && Date.now() - existedEntry.createdAt < CACHE_TTL_MS) {
            return existedEntry.promise;
        }

        const promise = listDocsByPathT({ notebook: target.notebookId, path: target.path })
            .then((files: IFile[]) => {
                if (!files || files.length === 0) {
                    this.cache.delete(cacheKey);
                    return null;
                }
                return {
                    notebookId: target.notebookId,
                    path: target.path,
                    html: this.buildTreeChildrenHtml(files, target.editingPublishAccess),
                };
            })
            .catch((err) => {
                this.cache.delete(cacheKey);
                errorPush("预取文档树展开列表失败", err);
                return null;
            });

        this.setCache(cacheKey, { promise, createdAt: Date.now() });
        return promise;
    }

    private setCache(cacheKey: string, entry: CacheEntry): void {
        this.cache.set(cacheKey, entry);
        while (this.cache.size > CACHE_MAX_SIZE) {
            const oldestKey = this.cache.keys().next().value as string | undefined;
            if (oldestKey === undefined) {
                break;
            }
            this.cache.delete(oldestKey);
        }
    }

    private buildTreeChildrenHtml(files: IFile[], editingPublishAccess: boolean): string {
        let html = "";
        for (const item of files) {
            html += this.buildTreeItemHtml(item, editingPublishAccess);
        }
        return html;
    }

    /**
     * 构建单个文档树条目的 HTML，结构与思源 `Files.ts#genFileHTML` 保持一致。
     */
    private buildTreeItemHtml(item: IFile, editingPublishAccess: boolean): string {
        const countHtml = item.count && item.count > 0
            ? `<span class="popover__block counter b3-tooltips b3-tooltips__nw" aria-label="${window.siyuan.languages.ref}">${item.count}</span>`
            : "";
        const paddingLeft = (item.path.split("/").length - 1) * 18;
        const hasSubFile = item.subFileCount !== 0;
        const iconHtml = buildDocTreeIconHTML(item.icon, item.subFileCount);
        const ariaLabel = this.getDocAriaLabel(item);

        return `<li data-node-id="${item.id}" data-name="${escapeHTML(item.name)}" draggable="true" data-count="${item.subFileCount}"
data-type="navigation-file"
style="--file-toggle-width:${paddingLeft + 18}px"
class="b3-list-item b3-list-item--hide-action" data-path="${item.path}">
    <span style="padding-left: ${paddingLeft}px" class="b3-list-item__toggle b3-list-item__toggle--hl${hasSubFile ? "" : " fn__hidden"}">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    <span class="b3-list-item__icon b3-tooltips b3-tooltips__n popover__block${editingPublishAccess ? " fn__none" : ""}" data-id="${item.id}" aria-label="${window.siyuan.languages.changeIcon}">${iconHtml}</span>
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
