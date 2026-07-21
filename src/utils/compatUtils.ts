
export function isNotebookDocEnabled(): boolean {
    if (window.top.siyuan.config?.fileTree.boxDocEnabled === undefined) {
        return false;
    }
    return window.top.siyuan.config.fileTree.boxDocEnabled;
}