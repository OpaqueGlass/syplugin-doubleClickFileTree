import { isCurrentVersionLessThan } from "./commonCheck";

export function isNotebookDocEnabled(): boolean {
    if (window.top.siyuan.config?.fileTree.boxDocEnabled === undefined) {
        return false;
    }
    return window.top.siyuan.config.fileTree.boxDocEnabled;
}

/**
 * 思源 v3.8.0 起官方已原生支持文档树 Shift 多选，
 * 插件在文档树中不再接管，即使设置项启用也不生效。
 */
const DOC_TREE_SHIFT_RANGE_SELECT_MAX_VERSION = "3.8.0";

/**
 * 文档树是否需要插件提供 Shift 范围选择。
 * 仅当思源版本低于 3.8.0 时返回 true；大于等于 3.8.0 一律返回 false（官方已原生支持）。
 */
export function isDocTreeShiftRangeSelectAvailable(): boolean {
    return isCurrentVersionLessThan(DOC_TREE_SHIFT_RANGE_SELECT_MAX_VERSION);
}

/**
 * 支持 Shift 范围选择的对话框类型白名单（data-key）。
 * 后期如需扩大支持范围，在此追加对应的 data-key 即可。
 */
const SHIFT_RANGE_SELECT_DIALOG_KEYS = ["dialog-opencard"];

/**
 * 当前打开的对话框中是否存在支持 Shift 范围选择的文档选择面板。
 * 只有当 document 中存在 `[data-key="dialog-opencard"]` 的元素时才放行。
 */
export function isDialogShiftRangeSelectAvailable(): boolean {
    return SHIFT_RANGE_SELECT_DIALOG_KEYS.some(
        (key) => document.querySelector(`[data-key="${key}"]`) !== null
    );
}