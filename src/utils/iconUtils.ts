/**
 * 文档 / 笔记本图标的多形态处理工具。
 *
 * 思源的 icon 字段并不「只有 emoji」，它可能是以下几种形态的值，
 * 直接当纯文本渲染会让自定义图标显示成一串乱码字符串：
 *
 * | 形态      | 取值示例                                        | 渲染方式                          |
 * | --------- | ----------------------------------------------- | --------------------------------- |
 * | unicode   | `1f600`、`1f468-200d-1f4bb`                      | 按 `-` 拆分的十六进制码点转字符    |
 * | custom    | `my-icon.png`                                    | `<img src="/emojis/my-icon.png">` |
 * | dynamic   | `api/icon/getDynamicIcon?type=1&color=%23f00`    | `<img src="api/icon/...">`        |
 * | network   | `https://example.com/icon.png`                   | `<img src="..." referrerpolicy>`  |
 * | invalid   | `javascript:alert(1)`、`//host/a.png`、`data:...` | 拒绝渲染，回退为默认图标          |
 *
 * 判定与渲染逻辑对齐思源前端实现：
 * - `app/src/emoji/iconValue.ts`（`getIconValueKind` / `genEmojiImageHTML`）
 * - `app/src/emoji/index.ts`（`unicode2Emoji`）
 */
import { debugPush } from "@/logger";
import { escapeHTML } from "@/utils/common";
import { isValidStr } from "@/utils/commonCheck";

export type IconValueKind = "unicode" | "custom" | "dynamic" | "network" | "invalid";

/** 默认图标的取值来源：`window.siyuan.storage["local-images"]` */
export type DefaultIconKind = "file" | "folder" | "note";

/** 动态图标的内核接口前缀 */
const DYNAMIC_ICON_PREFIX = "api/icon/getDynamicIcon";
/** 带协议头的字符串，例如 `javascript:`、`data:`、`ftp:` */
const URL_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
/** 自定义图标（上传到 data/emojis）的前端访问前缀 */
const CUSTOM_ICON_URL_PREFIX = "/emojis/";

/**
 * 思源默认图标的兜底值，取自 `app/src/protyle/util/compatibility.ts`：
 * `{file: "1f4c4", note: "1f5c3", folder: "1f4d1"}`
 */
const FALLBACK_DEFAULT_ICON: Record<DefaultIconKind, string> = {
    file: "1f4c4",
    folder: "1f4d1",
    note: "1f5c3",
};

/**
 * 归一化网络图标地址，仅接受绝对 http/https 地址。
 * 其余协议（javascript:、data:、file: 等）与 `//host/path` 一律视为不可用。
 */
export function normalizeNetworkIconURL(value: string): string | undefined {
    if (!isValidStr(value)) {
        return undefined;
    }
    let url: URL;
    try {
        url = new URL(value.trim());
    } catch {
        return undefined;
    }
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.host) {
        return undefined;
    }
    return url.href;
}

/**
 * 判定 icon 值的形态。
 */
export function getIconValueKind(value: string): IconValueKind {
    if (!isValidStr(value)) {
        return "invalid";
    }
    if (value.startsWith(DYNAMIC_ICON_PREFIX)) {
        return "dynamic";
    }
    if (normalizeNetworkIconURL(value)) {
        return "network";
    }
    // 形如 javascript: 的非法协议，以及协议相对地址，都不允许用作图标
    if (URL_SCHEME_PATTERN.test(value) || value.startsWith("//")) {
        return "invalid";
    }
    if (value.includes(".")) {
        return "custom";
    }
    return "unicode";
}

/**
 * 生成图片类图标的 `<img>` HTML。
 * unicode 形态（以及不可用的形态）返回 undefined，交由文本分支处理。
 */
function genIconImageHTML(value: string, className: string): string | undefined {
    const kind = getIconValueKind(value);
    let src: string;
    let isNetwork = false;
    if (kind === "dynamic") {
        src = value.replaceAll("&amp;", "&");
    } else if (kind === "network") {
        src = normalizeNetworkIconURL(value.replaceAll("&amp;", "&")) as string;
        isNetwork = true;
    } else if (kind === "custom") {
        src = `${CUSTOM_ICON_URL_PREFIX}${value}`;
    } else {
        return undefined;
    }
    // 网络图片不发送 referer，避免第三方图床防盗链失败
    const referrerPolicy = isNetwork ? ' referrerpolicy="no-referrer"' : "";
    return `<img class="${escapeHTML(className)}" src="${escapeHTML(src)}"${referrerPolicy}/>`;
}

/**
 * 将 icon 值转换为可直接插入 DOM 的 HTML。
 * 对应思源的 `unicode2Emoji`，区别是不依赖 Lute，转义使用 `escapeHTML`。
 *
 * @param icon icon 原始值（十六进制码点串、自定义图标文件名、动态图标地址或网络图片地址）
 * @param className 图片形态时附加到 `<img>` 上的 class
 */
export function unicode2Emoji(icon: string, className = ""): string {
    if (!isValidStr(icon)) {
        return "";
    }
    const imageHTML = genIconImageHTML(icon, className);
    if (imageHTML !== undefined) {
        return imageHTML;
    }
    if (getIconValueKind(icon) === "invalid") {
        // 非法协议不做任何输出，交由调用方回退到默认图标
        return "";
    }
    let emoji = "";
    try {
        icon.split("-").forEach((item) => {
            // 码点长度不足 4 位时补 0，与思源保持一致
            emoji += String.fromCodePoint(parseInt(item.length < 5 ? `0${item}` : item, 16));
        });
    } catch (err) {
        // 非法码点（如自定义表情搜索场景）忽略，不输出内容
        debugPush("图标码点解析失败，忽略该图标", icon, err);
        return "";
    }
    return escapeHTML(emoji);
}

/**
 * 取思源默认图标的十六进制码点串；读取失败时使用内置兜底值。
 */
export function getDefaultIconUnicode(kind: DefaultIconKind): string {
    const value = window.siyuan?.storage?.["local-images"]?.[kind];
    return isValidStr(value) ? value : FALLBACK_DEFAULT_ICON[kind];
}

/**
 * 渲染文档树条目的图标：优先使用文档自身 icon，缺失或非法时回退到默认图标。
 *
 * @param icon 文档 icon 原始值，可能为空
 * @param subFileCount 子文档数量，用于选择「文档 / 文件夹」默认图标
 * @param className 图片形态时附加到 `<img>` 上的 class
 */
export function buildDocTreeIconHTML(icon: string, subFileCount: number, className = ""): string {
    const defaultUnicode = getDefaultIconUnicode(subFileCount === 0 ? "file" : "folder");
    if (!isValidStr(icon)) {
        return unicode2Emoji(defaultUnicode, className);
    }
    if (getIconValueKind(icon) === "invalid") {
        debugPush("文档图标为不可用形态，回退默认图标", icon);
        return unicode2Emoji(defaultUnicode, className);
    }
    return unicode2Emoji(icon, className);
}
