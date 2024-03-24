/*
  Copyright (C) 2023 OpaqueGlass

  This program is released under the AGPLv3 license.
  For details, see:
  - License Text: https://www.gnu.org/licenses/agpl-3.0.html
  - License Summary: https://tldrlegal.com/license/gnu-affero-general-public-license-v3-(agpl-3.0)

  THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW. EXCEPT WHEN 
  OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM 
  "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, 
  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE RISK
  AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU. SHOULD THE PROGRAM PROVE DEFECTIVE, 
  YOU ASSUME THE COST OF ALL NECESSARY SERVICING, REPAIR OR CORRECTION.

  IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING WILL ANY COPYRIGHT HOLDER, 
  OR ANY OTHER PARTY WHO MODIFIES AND/OR CONVEYS THE PROGRAM AS PERMITTED ABOVE, BE LIABLE TO YOU 
  FOR DAMAGES, INCLUDING ANY GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF 
  THE USE OR INABILITY TO USE THE PROGRAM (INCLUDING BUT NOT LIMITED TO LOSS OF DATA OR DATA BEING
  RENDERED INACCURATE OR LOSSES SUSTAINED BY YOU OR THIRD PARTIES OR A FAILURE OF THE PROGRAM TO
  OPERATE WITH ANY OTHER PROGRAMS), EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN ADVISED OF THE
  POSSIBILITY OF SUCH DAMAGES.

*/

const siyuan = require('siyuan');

/**
 * 全局变量
 */
let g_bodyObserver;
const CONSTANTS = {
    STYLE_ID: "og-file-tree-enhance-plugin-style",
    ICON_ALL: 2,
    ICON_NONE: 0,
    ICON_CUSTOM_ONLY: 1,
    PLUGIN_NAME: "og_double_click_file_tree",
    PLUGIN_ORI_NAME: "syplugin-doubleClickFileTree",
    SAVE_TIMEOUT: 900,
    POP_NONE: 0,
    POP_LIMIT: 1,
    POP_ALL: 2,
    ACTION_OPEN_DOC: 0,
    ACTION_RAW_CLICK: 1,
    ACTION_TRUE_CLICK: 2,
}
const openDocActor = clickFileTreeHandler.bind(this, CONSTANTS.ACTION_OPEN_DOC);
const rawClickActor = clickFileTreeHandler.bind(this, CONSTANTS.ACTION_RAW_CLICK);
const trueClickActor = clickFileTreeHandler.bind(this, CONSTANTS.ACTION_TRUE_CLICK);
let g_writeStorage;
let g_isMobile = false;
let g_app;
let g_isRecentClicked = 0; // 判定是否近期点击过文档树，改为存放时间戳，当点击任务被消费后，重置为0
let g_recentClickedId = null;
let g_recentClickCheckTimeout = null; // 等待重新判定timeout
let g_isPluginClickToggle = false;
let g_isPluginRawClickItem = false;
let g_setting = {
    dblclickShowSubDoc: null,
    dblclickDelay: null,
    disableChangeIcon: null,
    revertBehavior: null,
    sameToOutline: null,
    extendClickArea: null,
    unfoldSubDocsWhileOpenParent: null,
    openToTop: null,
    applyToDialog: null,
    enableMobile: null,
    sameToTag: null,
};
let g_setting_default = {
    dblclickShowSubDoc: true,
    revertBehavior: false,
    dblclickDelay: 200,
    disableChangeIcon: true,
    sameToOutline: false,
    extendClickArea: false,
    unfoldSubDocsWhileOpenParent: false,
    openToTop: false,
    applyToDialog: false,
    enableMobile: false,
    sameToTag: false,
};
/**
 * Plugin类
 */
class DoubleClickFileTreePlugin extends siyuan.Plugin {

    tabOpenObserver =  null;
    backend = null;
    frontend = null;

    onload() {
        g_isMobile = isMobile();
        language = this.i18n;
        g_app = this.app;
        // 读取配置
        // TODO: 读取配置API变更
        Object.assign(g_setting, g_setting_default);

        g_writeStorage = this.saveData;

        g_bodyObserver = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
              if (mutation.type === 'childList') {
                for (const addedNode of mutation.addedNodes) {
                  if (addedNode.nodeType === 1 && addedNode.dataset["key"] === "dialog-movepathto") {
                        // dialogObject.element.removeEventListener("click", rawClickActor, true);
                        if (this.backend == "ios" && this.frontend == "desktop") {
                            addedNode.addEventListener("mouseup", rawClickActor, true);
                            addedNode.addEventListener("click", preventClickHander, true);
                        } else {
                            addedNode.addEventListener("click", rawClickActor, true);
                        }
                  }
                }
              }
            }
          });
        logPush('FileTreeEnhancePluginInited');
    }
    onLayoutReady() {
        this.loadData("settings.json").then((settingCache)=>{
            // 解析并载入配置
            try {
                // let settingData = JSON.parse(settingCache);
                Object.assign(g_setting, settingCache);
                this.eventBusInnerHandler(); 
            }catch(e){
                warnPush("DBT载入配置时发生错误",e);
            }
            // if (!initRetry()) {
            //     setInterval(initRetry, 3000);
            // }
        }, (e)=> {
            debugPush("配置文件读入失败", e);
        });
    }

    onunload() {
        this.el && this.el.remove();
        removeStyle();
        this.eventBusInnerHandler(true);
        // 善后
    }
    // TODO: 重写载入设置
    openSetting() {
        // 生成Dialog内容

        // 创建dialog
        const settingDialog = new siyuan.Dialog({
            "title": language["setting_panel_title"],
            "content": `
            <div class="b3-dialog__content" style="flex: 1;">
                <div id="${CONSTANTS.PLUGIN_NAME}-form-content" style="overflow: auto;"></div>
            </div>
            <div class="b3-dialog__action" id="${CONSTANTS.PLUGIN_NAME}-form-action" style="max-height: 40px">
                <button class="b3-button b3-button--cancel">${language["button_cancel"]}</button><div class="fn__space"></div>
                <button class="b3-button b3-button--text">${language["button_save"]}</button>
            </div>
            `,
            "width": isMobile() ? "92vw":"1040px",
            "height": isMobile() ? "50vw":"80vh",
        });
        // console.log("dialog", settingDialog);
        const actionButtons = settingDialog.element.querySelectorAll(`#${CONSTANTS.PLUGIN_NAME}-form-action button`);
        actionButtons[0].addEventListener("click",()=>{settingDialog.destroy()}),
        actionButtons[1].addEventListener("click",()=>{
            debugPush('SAVING');
            let uiSettings = loadUISettings(settingForm);
            this.saveData(`settings.json`, JSON.stringify(uiSettings));
            Object.assign(g_setting, uiSettings);
            removeStyle();
            setStyle();
            try {
                this.eventBusInnerHandler(); 
            }catch(err){
                console.error("og eventBusError", err);
            }
            debugPush("SAVED");
            settingDialog.destroy();
        });
        // 绑定dialog和移除操作

        // 生成配置页面
        const hello = document.createElement('div');
        const settingForm = document.createElement("form");
        settingForm.setAttribute("name", CONSTANTS.PLUGIN_NAME);
        settingForm.innerHTML = generateSettingPanelHTML([
            // 基础设定
            new SettingProperty("dblclickShowSubDoc", "SWITCH", null),
            new SettingProperty("dblclickDelay", "NUMBER", [50, 1200]),
            new SettingProperty("revertBehavior", "SWITCH", null),
            new SettingProperty("disableChangeIcon", "SWITCH", null),
            new SettingProperty("unfoldSubDocsWhileOpenParent", "SWITCH", null),
            new SettingProperty("extendClickArea", "SWITCH", null),
            new SettingProperty("sameToOutline", "SWITCH", null),
            new SettingProperty("sameToTag", "SWITCH", null),
            new SettingProperty("openToTop", "SWITCH", null),
            new SettingProperty("applyToDialog", "SWITCH", null),
            new SettingProperty("enableMobile", "SWITCH", null),
            new SettingProperty("aboutAuthor", "HINT", null),
        ]);

        hello.appendChild(settingForm);
        settingDialog.element.querySelector(`#${CONSTANTS.PLUGIN_NAME}-form-content`).appendChild(hello);
    }

    eventBusInnerHandler(removeMode = false) {
        const isMobileDevice = isMobile();
        if (isMobileDevice && !g_setting.enableMobile) {
            debugPush("移动设备，且未启用功能，退出");
            return;
        }
        const fileTreeQuery = isMobileDevice ? "#sidebar [data-type='sidebar-file']" : ".sy__file";
        const outlineQuery = isMobileDevice ? "#sidebar [data-type='sidebar-outline']" : ".sy__outline";
        const tagQuery = isMobileDevice ? "#sidebar [data-type='sidebar-tag']" : ".sy__tag";
        const frontend = siyuan.getFrontend();
        const backend = siyuan.getBackend();

        
        let actorFunction = openDocActor;
        let clickEventBindEventType = "click";
        if (backend == "ios" && frontend == "desktop") {
            errorPush("插件暂未解决iPadOS上的使用问题，在iPadOS上，插件将不绑定任何行为");
            return;
        }
        let useCapture = true;
        // siyuan.showMessage(`前端 ${frontend} 后端 ${backend} ${clickEventBindEventType}`);
        if (removeMode) {
            document.querySelector(fileTreeQuery)?.removeEventListener(clickEventBindEventType, openDocActor, true);
        } else {
            document.querySelector(fileTreeQuery)?.addEventListener(clickEventBindEventType, openDocActor, true);
        }
        if (g_setting.sameToOutline) {
            document.querySelectorAll(outlineQuery).forEach((elem)=>{
                elem.removeEventListener(clickEventBindEventType, openDocActor, true);
                elem.addEventListener(clickEventBindEventType, openDocActor, true);
            })
        }
        if (!g_setting.sameToOutline || removeMode){
            document.querySelectorAll(outlineQuery).forEach((elem)=>{
                elem.removeEventListener(clickEventBindEventType, openDocActor, true);
            })
        }

        if (g_setting.sameToOutline) {
            document.addEventListener('keydown', this.bindKeyDownEvent.bind(this));              
        }
        if (!g_setting.sameToOutline || removeMode) {
            document.removeEventListener('keydown', this.bindKeyDownEvent.bind(this));  
        }

        if (g_setting.sameToTag) {
            document.querySelectorAll(tagQuery).forEach((elem)=>{
                elem.removeEventListener(clickEventBindEventType, trueClickActor, true);
                elem.addEventListener(clickEventBindEventType, trueClickActor, true);
            })
        }
        if (!g_setting.sameToTag || removeMode){
            document.querySelectorAll(tagQuery).forEach((elem)=>{
                elem.removeEventListener(clickEventBindEventType, trueClickActor, true);
            })
        }

        if (g_setting.applyToDialog) {
            g_bodyObserver.observe(document.body, {childList: true, subtree: false, attribute: false});
        }
        if (!g_setting.applyToDialog || removeMode) {
            g_bodyObserver.disconnect();
        }
    }
    bindKeyDownEvent(event) {
        // 判断是否按下了 Alt 键，并且同时按下了 O 键
        if (isShortcutMatch(event, window.siyuan.config.keymap.editor.general.outline.custom ?? "⌥O")) {
            // 在这里执行按下 Alt + O 键的逻辑
            debugPush("按下ALt+O");
            setTimeout(()=>{
                this.eventBusInnerHandler(); 
            }, 300);      
        }
    }
}



// debug push
let g_DEBUG = 2;
const g_NAME = "fte";
const g_FULLNAME = "双击文档树";

/*
LEVEL 0 忽略所有
LEVEL 1 仅Error
LEVEL 2 Err + Warn
LEVEL 3 Err + Warn + Info
LEVEL 4 Err + Warn + Info + Log
LEVEL 5 Err + Warn + Info + Log + Debug
*/
function commonPushCheck() {
    if (window.top["OpaqueGlassDebugV2"] == undefined || window.top["OpaqueGlassDebugV2"][g_NAME] == undefined) {
        return g_DEBUG;
    }
    return window.top["OpaqueGlassDebugV2"][g_NAME];
}

function isDebugMode() {
    return commonPushCheck() > g_DEBUG;
}

function debugPush(str, ...args) {
    if (commonPushCheck() >= 5) {
        const date = new Date();
        const dateStr = `${date.toLocaleString()}.${String(date.getMilliseconds()).padStart(3, '0')}`;
        console.debug(`${g_FULLNAME}[D] ${dateStr} ${str}`, ...args);
    }
}

function logPush(str, ...args) {
    if (commonPushCheck() >= 4) {
        const date = new Date();
        const dateStr = `${date.toLocaleString()}.${String(date.getMilliseconds()).padStart(3, '0')}`;
        console.log(`${g_FULLNAME}[L] ${dateStr} ${str}`, ...args);
    }
}

function errorPush(str, ... args) {
    if (commonPushCheck() >= 1) {
        const date = new Date();
        const dateStr = `${date.toLocaleString()}.${String(date.getMilliseconds()).padStart(3, '0')}`;
        console.error(`${g_FULLNAME}[E] ${dateStr} ${str}`, ...args);
    }
}

function warnPush(str, ... args) {
    const date = new Date();
        const dateStr = `${date.toLocaleString()}.${String(date.getMilliseconds()).padStart(3, '0')}`;
    if (commonPushCheck() >= 2) {
        console.warn(`${g_FULLNAME}[W] ${dateStr} ${str}`, ...args);
    }
}

class SettingProperty {
    id;
    simpId;
    name;
    desp;
    type;
    limit;
    value;
    /**
     * 设置属性对象
     * @param {*} id 唯一定位id
     * @param {*} type 设置项类型
     * @param {*} limit 限制
     */
    constructor(id, type, limit, value = undefined) {
        this.id = `${CONSTANTS.PLUGIN_NAME}_${id}`;
        this.simpId = id;
        this.name = language[`setting_${id}_name`];
        if (!isValidStr(this.name)) {
            this.name = `setting_${id}_name`;
        }
        this.desp = language[`setting_${id}_desp`];
        if (this.desp == undefined) {
            this.desp = `setting_${id}_desp`;
        }
        this.type = type;
        this.limit = limit;
        if (value) {
            this.value = value;
        }else{
            this.value = g_setting[this.simpId];
        }
    }
}


function initRetry() {
    if (!document.querySelector(".sy__file")) {
        logPush("未检测到文档树，终止listener绑定");
        return true;
    }
    document.querySelector('.sy__file')?.addEventListener('click', clickFileTreeHandler, true);
}

function preventClickHander(event) {
    const debugPush = siyuan.showMessage;
    if (event.button != 0) {
        debugPush('按下的按键不是左键，终止操作')
        return;
    }
    if (event.ctrlKey || event.shiftKey || event.altKey) {
        debugPush("伴随ctrl/shift/alt按下，终止操作");
        return;
    }
    if (!g_setting.disableChangeIcon && event.srcElement.classList.contains("b3-list-item__icon")) {
        debugPush("点击的是图标，终止操作");
        return;
    }
    if (event.srcElement.classList.contains("b3-list-item__toggle") || ["svg", "use"].includes(event.srcElement.tagName)) {
        const sourceElem = getSourceSpanElement(event.srcElement);
        if (sourceElem == null) {
            debugPush("sourceElem未找到，未知情况，不处理", event.srcElement);
            return;
        }
        if (["more-file", "more-root", "new"].includes(sourceElem.getAttribute("data-type"))) {
            debugPush("点击的是更多按钮或新建按钮，终止操作");
            return;
        }
        // 理论上剩下的情况就是toggle
        if (!sourceElem.classList.contains("b3-list-item__toggle")) {
            debugPush("点击的还不是展开按钮，不知道什么情况，终止操作", event.srcElement, sourceElem);
        }
        if (!g_setting.extendClickArea || g_isPluginClickToggle) {
            debugPush("点击的是展开按钮，且不允许响应展开");
            g_isPluginClickToggle = false;
            return;
        }
    }
    event.stopImmediatePropagation();
    event.stopPropagation();
    event.preventDefault();
}

/**
 * 点击文档树事件处理
 * @param {*} event 
 * @returns 
 */
function clickFileTreeHandler(openActionType, event) {
    if (event.button != 0) {
        debugPush('按下的按键不是左键，终止操作')
        return;
    }
    if (event.ctrlKey || event.shiftKey || event.altKey) {
        debugPush("伴随ctrl/shift/alt按下，终止操作");
        return;
    }
    if (!g_setting.disableChangeIcon && event.srcElement.classList.contains("b3-list-item__icon")) {
        debugPush("点击的是图标，终止操作");
        return;
    }
    if (event.srcElement.classList.contains("b3-list-item__toggle") || ["svg", "use"].includes(event.srcElement.tagName)) {
        const sourceElem = getSourceSpanElement(event.srcElement);
        if (sourceElem == null) {
            debugPush("sourceElem未找到，未知情况，不处理", event.srcElement);
            return;
        }
        if (["more-file", "more-root", "new"].includes(sourceElem.getAttribute("data-type"))) {
            debugPush("点击的是更多按钮或新建按钮，终止操作");
            return;
        }
        // 理论上剩下的情况就是toggle
        if (!sourceElem.classList.contains("b3-list-item__toggle")) {
            debugPush("点击的还不是展开按钮，不知道什么情况，终止操作", event.srcElement, sourceElem);
        }
        if (!g_setting.extendClickArea || g_isPluginClickToggle) {
            debugPush("点击的是展开按钮，且不允许响应展开");
            g_isPluginClickToggle = false;
            return;
        }
    }
    if (document.getElementById("commonMenu") && !document.getElementById("commonMenu").classList.contains("fn__none")) {
        debugPush("当前存在commonMeue右键菜单，终止操作");
        return;
    }
    if ([CONSTANTS.ACTION_RAW_CLICK, CONSTANTS.ACTION_TRUE_CLICK].includes(openActionType) && g_isPluginRawClickItem) {
        g_isPluginRawClickItem = false;
        debugPush("由插件执行点击，终止操作");
        return;
    }
    debugPush("event", event);
    
    let timeGap = new Date().getTime() - g_isRecentClicked;

    // 实际上单击执行不是严格按照dblclickDelay的，感觉最多延迟30ms，最少3
    if (timeGap > g_setting.dblclickDelay) {
        debugPush("首次点击");
        g_isRecentClicked = new Date().getTime();
        clearTimeout(g_recentClickCheckTimeout);
        const sourceElem = getSourceItemElement(event);
        g_recentClickedId = sourceElem?.getAttribute("data-node-id");
        debugPush("点击的元素与事件", event, sourceElem, g_recentClickedId);
        // TODO: 这个判断有点问题，等下重新想一下navigation-root
        // 没有对应id  并且   （不是开头 或  不是大纲）
        // 大概  换成 如果是笔记本 ，就跳这个
        if (!isValidStr(g_recentClickedId) && (sourceElem?.getAttribute("data-type") == "navigation-root" || sourceElem?.getAttribute("data-path") == undefined)
        && !(sourceElem?.getAttribute("data-treetype") == "tag") ) {
            debugPush("点击的元素不是文件，终止操作");
            g_isRecentClicked = 0;
            return;
        }
        // TODO: 或许可以通过判断箭头（不存在的话），直接跳到打开文档，而不等待
        const b3ListItemToggle = sourceElem.querySelector('.b3-list-item__toggle');
        const toggleNotExist = b3ListItemToggle == null ? true : b3ListItemToggle.classList.contains("fn__hidden");
        let delay = g_setting.dblclickShowSubDoc ? g_setting.dblclickDelay : 0;
        // 如果设置为单击打开文档，且并没有子文档展开按钮，那么不存在双击行为，置零
        if (toggleNotExist && !g_setting.revertBehavior) {
            delay = 0;
            g_isRecentClicked = 0;
        // 如果设置为单击展开，且并没有子文档展开按钮，那么不存在单击行为，直接打开
        } else if (toggleNotExist && g_setting.revertBehavior) {
            delay = 0;
            g_isRecentClicked = 0;
            // TODO: 判断Type，调用不同的打开函数
            clickToOpenMulitWayDistributor(event, openActionType);
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            return;
        }
        g_recentClickCheckTimeout = setTimeout(()=>{
            debugPush("执行延时任务");
            g_isRecentClicked = 0;
            singleClickHandler(event, openActionType);
            g_recentClickedId = null;
        }, delay);
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
    } else {
        debugPush("二次点击");
        clearTimeout(g_recentClickCheckTimeout);
        g_isRecentClicked = 0;
        if (doubleClickHandler(event, openActionType)) {
            g_recentClickedId = null;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
    }    
}

function clickToOpenMulitWayDistributor(event, openActionType) {
    switch (openActionType) {
        case CONSTANTS.ACTION_OPEN_DOC:
            return singleClickOpenDocHandler(event);
        case CONSTANTS.ACTION_RAW_CLICK:
            return pluginClickHandler(event);
        case CONSTANTS.ACTION_TRUE_CLICK:
            return pluginTrueClickHandler(event);
        default:
            return pluginTrueClickHandler(event);
    }
}

// TODO 这边需要实现交换逻辑
function singleClickHandler(event, openActionType) {
    if (g_setting.revertBehavior) {
        singleClickUnfoldHandler(event);
    } else {
        clickToOpenMulitWayDistributor(event, openActionType);
    }
}

function pluginClickHandler(event) {
    const sourceElem = getSourceItemElement(event);
    if (sourceElem == null) {
        debugPush("sourceElem未找到");
        return false;
    }
    if (!event.ctrlKey) {
        document.getElementById("foldTree")?.querySelectorAll(".b3-list-item--focus").forEach((elem)=>elem.classList.remove("b3-list-item--focus"));
    }
    sourceElem.classList.add("b3-list-item--focus");
    debugPush("由 插件点击 处理", sourceElem);
    // g_isPluginRawClickItem = true;
    // sourceElem.click();
    return true;
}

function pluginTrueClickHandler(event) {
    const sourceElem = getSourceItemElement(event);
    if (sourceElem == null) {
        debugPush("sourceElem未找到");
        return false;
    }
    if (!event.ctrlKey) {
        document.getElementById("foldTree")?.querySelectorAll(".b3-list-item--focus").forEach((elem)=>elem.classList.remove("b3-list-item--focus"));
    }
    sourceElem.classList.add("b3-list-item--focus");
    debugPush("由 插件点击 处理", sourceElem);
    g_isPluginRawClickItem = true;
    sourceElem.click();
    return true;
}


function singleClickOpenDocHandler(event) {
    const sourceElem = getSourceItemElement(event);
    if (sourceElem == null) {
        debugPush("sourceElem未找到");
        return;
    }
    debugPush("由 单击打开 处理", sourceElem);
    openDocByTreeItemElement(sourceElem);
}

function singleClickUnfoldHandler(event) {
    const sourceElem = getSourceItemElement(event);
    if (sourceElem == null) {
        debugPush("sourceElem未找到");
        return;
    }
    debugPush("由 单击展开 处理", sourceElem);
    // 如果有展开，则展开
    const b3ListItemToggle = sourceElem.querySelector('.b3-list-item__toggle');
    if (b3ListItemToggle && !b3ListItemToggle.classList.contains("fn__hidden")) {
        g_isPluginClickToggle = true;
        b3ListItemToggle.click();
        debugPush("展开层级成功");
    } else {
        // 否则打开文档
        openDocByTreeItemElement(sourceElem);
    }
}

function doubleClickHandler(event, openActionType) {
    if (g_setting.revertBehavior) {
        clickToOpenMulitWayDistributor(event, openActionType);
    } else {
        return doubleClickUnfoldHandler(event);
    }
}

function doubleClickUnfoldHandler(event) {
    const sourceElem = getSourceItemElement(event);
    if (sourceElem == null) {
        return false;
    }
    debugPush("由 双击展开 处理", sourceElem);
    const targetNodeId = sourceElem.getAttribute("data-node-id");
    debugPush("双击targetNodeId, g_id", targetNodeId, g_recentClickedId);
    if (sourceElem && g_recentClickedId === targetNodeId) {
        const b3ListItemToggle = sourceElem.querySelector('.b3-list-item__toggle');
        g_isPluginClickToggle = true;
        b3ListItemToggle.click();
        debugPush("展开文件层级成功");
        return true;
    }
    return false;
}

function doubleClickOpenDocHandler(event) {
    const sourceElem = getSourceItemElement(event);
    if (sourceElem == null) {
        debugPush("sourceElem未找到");
        return;
    }
    debugPush("由 双击打开 处理", sourceElem);
    const targetNodeId = sourceElem.getAttribute("data-node-id");
    debugPush("双击targetNodeId, g_id", targetNodeId, g_recentClickedId);
    if (sourceElem && g_recentClickedId === targetNodeId) {
        return openDocByTreeItemElement(sourceElem);
    }
 
    return false;
}

function openDocByTreeItemElement(sourceElem) {
    debugPush("souceElem打开文档/展开笔记本", sourceElem);
    if (sourceElem == null) {
        return false;
    }
    const FILE_TREE = 0, OUTLINE_TREE = 1, NOTEBOOK = 2;
    let souceType = null;
    switch (sourceElem.getAttribute("data-type")) {
        case "navigation-file": {
            souceType = FILE_TREE;
            break;
        }
        case "NodeHeading": {
            souceType = OUTLINE_TREE;
            break;
        }
        case "navigation-root": {
            souceType = NOTEBOOK;
            break;
        }
        default: {
            logPush("未能识别的souceElement类型");
            return false;
        }
    }
    if (souceType < NOTEBOOK) {
        const targetNodeId = sourceElem.getAttribute("data-node-id");
        debugPush("获取到的文件id", targetNodeId);
        if (isValidStr(targetNodeId)) {
            debugPush("打开文档", targetNodeId);
            // 设定高亮
            if (souceType == OUTLINE_TREE) {
                document.querySelector(".sy__outline .b3-list-item--focus, #sidebar [data-type='sidebar-outline'] .b3-list-item--focus")?.classList.remove("b3-list-item--focus");
            } else {
                document.querySelector(".sy__file .b3-list-item--focus, #sidebar [data-type='sidebar-file'] .b3-list-item--focus")?.classList.remove("b3-list-item--focus");
            }
            sourceElem.classList.add("b3-list-item--focus");
            // 展开子层级
            // 请注意：这里没有判定是否已经展开，如果已经展开，则会收起；先展开而后打开文档是为了保持文档具有焦点，看情况可能需要更改
            if (g_setting.unfoldSubDocsWhileOpenParent) {
                const b3ListItemToggle = sourceElem.querySelector('.b3-list-item__toggle');
                g_isPluginClickToggle = true;
                b3ListItemToggle.click();
            }
            // 打开文档
            if (!isMobile()) {
                siyuan.openTab({
                    app: g_app,
                    doc: {
                        id: targetNodeId,
                        action: souceType == FILE_TREE && g_setting.openToTop ? ["cb-get-focus"] : ["cb-get-focus", "cb-get-scroll"]
                    }
                }).catch((err)=>{
                    errorPush("打开文档时发生错误", err);
                });
            } else {
                siyuan.openMobileFileById(g_app,
                    targetNodeId,
                    souceType == FILE_TREE && g_setting.openToTop ? ["cb-get-focus"] : ["cb-get-focus", "cb-get-scroll"]
                );
            }
            
            return true;
        }
    } else if (souceType == NOTEBOOK) {
        const b3ListItemToggle = sourceElem.querySelector('.b3-list-item__toggle');
        g_isPluginClickToggle = true;
        b3ListItemToggle.click();
        debugPush("展开笔记本层级成功");
        return true;
    }
    return false;
}

function getSourceItemElement(event) {
    // 回溯查找当前位置
    let ftItemElem = event.target;
    let isFound = false;
    for (let i = 0; i < 4 && ftItemElem; i++) {
        if (ftItemElem == null) {
            break;
        }
        // debugPush("getSource", ftItemElem);
        const elemDataType = ftItemElem.getAttribute("data-type");
        const elemDataPath = ftItemElem.getAttribute("data-path");
        const elemDataTreeType = ftItemElem.getAttribute("data-treetype");
        if (elemDataType === "navigation-file" || elemDataType === "NodeHeading" || elemDataPath != undefined || elemDataTreeType == "tag") {
            isFound = true;
            break;
        } else if (elemDataType === "navigation-root") {
            isNoteBook = true;
            isFound = true;
            break;
        }
        ftItemElem = ftItemElem.parentNode;
    }
    return isFound ? ftItemElem : null;
}

function getSourceSpanElement(elem) {
    // 回溯查找当前位置
    let ftItemElem = elem;
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
        ftItemElem = ftItemElem.parentNode;
    }
    return isFound ? ftItemElem : null;
}

function bindHandlerForDialog() {
    debugPush("BIND HANDLER FOR DIALOG");
    if (window.siyuan.dialogs && window.siyuan.dialogs.length > 0) {
        for (const dialogObject of window.siyuan.dialogs) {
            if (["dialog-movepathto"].includes(dialogObject.element.dataset["key"])) {
                dialogObject.element.removeEventListener("click", rawClickActor, true);
                dialogObject.element.addEventListener("click", rawClickActor, true);
            }
        }
    }
}

function setStyle() {
    const head = document.getElementsByTagName('head')[0];
    const style = document.createElement('style');
    style.setAttribute("id", CONSTANTS.STYLE_ID);
    

    style.innerHTML = `

    `;
    head.appendChild(style);
}

function styleEscape(str) {
    if (!str) return "";
    return str.replace(new RegExp("<[^<]*style[^>]*>", "g"), "");
}

function removeStyle() {
    document.getElementById(CONSTANTS.STYLE_ID)?.remove();
}

/* ************ API 相关 **************** */

function isShortcutMatch(event, key) {
    const shortcutKeys = key.split('');
    return shortcutKeys.every(key => {
      if (key === '⌥') return event.altKey;
      if (key === '⇧') return event.shiftKey;
      if (key === '⌘') return event.ctrlKey;
    //   if (key === '') return event.metaKey;
      return event.key.toUpperCase() === key.toUpperCase();
    });
}

function getNotebooks() {
    let notebooks = window.top.siyuan.notebooks;
    return notebooks;
}


function getFocusedBlock() {
    if (document.activeElement.classList.contains('protyle-wysiwyg')) {
        /* 光标在编辑区内 */
        let block = window.getSelection()?.focusNode?.parentElement; // 当前光标
        while (block != null && block?.dataset?.nodeId == null) block = block.parentElement;
        return block;
    }
    else return null;
}

function getFocusedBlockId() {
    const focusedBlock = getFocusedBlock();
    if (focusedBlock == null) {
        return null;
    }
    return focusedBlock.dataset.nodeId;
}


async function request(url, data) {
    let resData = null;
    await fetch(url, {
        body: JSON.stringify(data),
        method: 'POST'
    }).then(function (response) {
        resData = response.json();
    });
    return resData;
}

async function parseBody(response) {
    let r = await response;
    return r.code === 0 ? r.data : null;
}

async function sqlAPI(stmt) {
    let data = {
        "stmt": stmt
    };
    let url = `/api/query/sql`;
    return parseBody(request(url, data));
}

async function getTreeStat(id) {
    let data = {
        "id": id
    };
    let url = `/api/block/getTreeStat`;
    return parseBody(request(url, data));
}

async function getDocInfo(id) {
    let data = {
        "id": id
    };
    let url = `/api/block/getDocInfo`;
    return parseBody(request(url, data));
}

async function getKramdown(blockid){
    let data = {
        "id": blockid
    };
    let url = "/api/block/getBlockKramdown";
    let response = await parseBody(request(url, data));
    if (response) {
        return response.kramdown;
    }
}

async function getCurrentDocIdF() {
    let thisDocId;
    thisDocId = window.top.document.querySelector(".layout__wnd--active .protyle.fn__flex-1:not(.fn__none) .protyle-background")?.getAttribute("data-node-id");
    debugPush("thisDocId by first id", thisDocId);
    if (!thisDocId && g_isMobile) {
        // UNSTABLE: 面包屑样式变动将导致此方案错误！
        try {
            let temp;
            temp = window.top.document.querySelector(".protyle-breadcrumb .protyle-breadcrumb__item .popover__block[data-id]")?.getAttribute("data-id");
            let iconArray = window.top.document.querySelectorAll(".protyle-breadcrumb .protyle-breadcrumb__item .popover__block[data-id]");
            for (let i = 0; i < iconArray.length; i++) {
                let iconOne = iconArray[i];
                if (iconOne.children.length > 0 
                    && iconOne.children[0].getAttribute("xlink:href") == "#iconFile"){
                    temp = iconOne.getAttribute("data-id");
                    break;
                }
            }
            thisDocId = temp;
        }catch(e){
            console.error(e);
            temp = null;
        }
    }
    if (!thisDocId) {
        thisDocId = window.top.document.querySelector(".protyle.fn__flex-1:not(.fn__none) .protyle-background")?.getAttribute("data-node-id");
        debugPush("thisDocId by background must match,  id", thisDocId);
    }
    return thisDocId;
}

function sleep(time){
    return new Promise((resolve) => setTimeout(resolve, time));
}

/**
 * 在点击<span data-type="block-ref">时打开思源块/文档
 * 为引入本项目，和原代码相比有更改
 * @refer https://github.com/leolee9086/cc-template/blob/6909dac169e720d3354d77685d6cc705b1ae95be/baselib/src/commonFunctionsForSiyuan.js#L118-L141
 * @license 木兰宽松许可证
 * @param {点击事件} event 
 */
let openRefLink = function(event, paramId = ""){
    
    let 主界面= window.parent.document
    let id = event?.currentTarget?.getAttribute("data-id") ?? paramId;
    // 处理笔记本等无法跳转的情况
    if (!isValidStr(id)) {return;}
    event?.preventDefault();
    event?.stopPropagation();
    let 虚拟链接 =  主界面.createElement("span")
    虚拟链接.setAttribute("data-type","block-ref")
    虚拟链接.setAttribute("data-id",id)
    虚拟链接.style.display = "none";//不显示虚拟链接，防止视觉干扰
    let 临时目标 = 主界面.querySelector(".protyle-wysiwyg div[data-node-id] div[contenteditable]")
    临时目标.appendChild(虚拟链接);
    let clickEvent = new MouseEvent("click", {
        ctrlKey: event?.ctrlKey,
        shiftKey: event?.shiftKey,
        altKey: event?.altKey,
        bubbles: true
    });
    虚拟链接.dispatchEvent(clickEvent);
    虚拟链接.remove();
}

function isValidStr(s){
    if (s == undefined || s == null || s === '') {
		return false;
	}
	return true;
}

let zh_CN = {
    
}

let en_US = {}
let language = zh_CN;

/* **************** 设置项相关 *****************
 * 
 */

/**
 * 由需要的设置项生成设置页面
 * @param {*} settingObject 
 */
function generateSettingPanelHTML(settingObjectArray) {
    let resultHTML = "";
    for (let oneSettingProperty of settingObjectArray) {
        let inputElemStr = "";
        oneSettingProperty.desp = oneSettingProperty.desp?.replace(new RegExp("<code>", "g"), "<code class='fn__code'>");
        if (oneSettingProperty.name.includes("🧪")) {
            oneSettingProperty.desp = language["setting_experimental"] + oneSettingProperty.desp;
        }
        let temp = `
        <label class="fn__flex b3-label">
            <div class="fn__flex-1">
                ${oneSettingProperty.name}
                <div class="b3-label__text">${oneSettingProperty.desp??""}</div>
            </div>
            <span class="fn__space"></span>
            *#*##*#*
        </label>
        `;
        switch (oneSettingProperty.type) {
            case "NUMBER": {
                let min = oneSettingProperty.limit[0];
                let max = oneSettingProperty.limit[1];
                inputElemStr = `<input 
                    class="b3-text-field fn__flex-center fn__size200" 
                    id="${oneSettingProperty.id}" 
                    type="number" 
                    name="${oneSettingProperty.simpId}"
                    ${min == null || min == undefined ? "":"min=\"" + min + "\""} 
                    ${max == null || max == undefined ? "":"max=\"" + max + "\""} 
                    value="${oneSettingProperty.value}">`;
                break;
            }
            case "SELECT": {

                let optionStr = "";
                for (let option of oneSettingProperty.limit) {
                    let optionName = option.name;
                    if (!optionName) {
                        optionName = language[`setting_${oneSettingProperty.simpId}_option_${option.value}`];
                    }
                    optionStr += `<option value="${option.value}" 
                    ${option.value == oneSettingProperty.value ? "selected":""}>
                        ${optionName}
                    </option>`;
                }
                inputElemStr = `<select 
                    id="${oneSettingProperty.id}" 
                    name="${oneSettingProperty.simpId}"
                    class="b3-select fn__flex-center fn__size200">
                        ${optionStr}
                    </select>`;
                break;
            }
            case "TEXT": {
                inputElemStr = `<input class="b3-text-field fn__flex-center fn__size200" id="${oneSettingProperty.id}" name="${oneSettingProperty.simpId}" value="${oneSettingProperty.value}"></input>`;
                temp = `
                <label class="fn__flex b3-label config__item">
                    <div class="fn__flex-1">
                        ${oneSettingProperty.name}
                        <div class="b3-label__text">${oneSettingProperty.desp??""}</div>
                    </div>
                    *#*##*#*
                </label>`
                break;
            }
            case "SWITCH": {
                inputElemStr = `<input 
                class="b3-switch fn__flex-center"
                name="${oneSettingProperty.simpId}"
                id="${oneSettingProperty.id}" type="checkbox" 
                ${oneSettingProperty.value?"checked=\"\"":""}></input>
                `;
                break;
            }
            case "TEXTAREA": {
                inputElemStr = `<textarea 
                name="${oneSettingProperty.simpId}"
                class="b3-text-field fn__block" 
                id="${oneSettingProperty.id}">${oneSettingProperty.value}</textarea>`;
                temp = `
                <label class="b3-label fn__flex">
                    <div class="fn__flex-1">
                        ${oneSettingProperty.name}
                        <div class="b3-label__text">${oneSettingProperty.desp??""}</div>
                        <div class="fn__hr"></div>
                        *#*##*#*
                    </div>
                </label>`
                break;
            }
            case "HINT": {
                inputElemStr = ``;
                break;
            }
        }
        
        resultHTML += temp.replace("*#*##*#*", inputElemStr);
    }
    // console.log(resultHTML);
    return resultHTML;
}

/**
 * 由设置界面读取配置
 */
function loadUISettings(formElement) {
    let data = new FormData(formElement);
    // 扫描标准元素 input[]
    let result = {};
    for(const [key, value] of data.entries()) {
        // console.log(key, value);
        result[key] = value;
        if (value === "on") {
            result[key] = true;
        }else if (value === "null" || value == "false") {
            result[key] = "";
        }
    }
    let checkboxes = formElement.querySelectorAll('input[type="checkbox"]');
    for (let i = 0; i < checkboxes.length; i++) {
        let checkbox = checkboxes[i];
        // console.log(checkbox, checkbox.name, data[checkbox.name], checkbox.name);
        if (result[checkbox.name] == undefined) {
            result[checkbox.name] = false;
        }
    }

    let numbers = formElement.querySelectorAll("input[type='number']");
    // console.log(numbers);
    for (let number of numbers) {
        let minValue = number.getAttribute("min");
        let maxValue = number.getAttribute("max");
        let value = parseFloat(number.value);

        if (minValue !== null && value < parseFloat(minValue)) {
            number.value = minValue;
            result[number.name] = parseFloat(minValue);
        } else if (maxValue !== null && value > parseFloat(maxValue)) {
            number.value = maxValue;
            result[number.name] = parseFloat(maxValue);
        } else {
            result[number.name] = value;
        }
    }

    debugPush("UI SETTING", result);
    return result;
}

function isMobile() {
    return window.top.document.getElementById("sidebar") ? true : false;
};

module.exports = {
    default: DoubleClickFileTreePlugin,
};