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

    OPEN_WITCH_UNFOLD_OFF: 0,
    OPEN_WITCH_UNFOLD_ON: 1,
    OPEN_WITCH_UNFOLD_NO_FOLD: 2, 
}
const openDocActor = clickFileTreeHandler.bind(this, CONSTANTS.ACTION_OPEN_DOC, false);
const rawClickActor = clickFileTreeHandler.bind(this, CONSTANTS.ACTION_RAW_CLICK, true);
const trueClickActor = clickFileTreeHandler.bind(this, CONSTANTS.ACTION_TRUE_CLICK, true);
let g_writeStorage;
let g_isMobile = false;
let g_app;
let g_isRecentClicked = 0; // 判定是否近期点击过文档树，改为存放时间戳，当点击任务被消费后，重置为0
let g_recentClickedId = null;
let g_recentClickCheckTimeout = null; // 等待重新判定timeout
let g_isPluginClickToggle = false;
let g_isPluginRawClickItem = false;
let g_lastPopupReadTime = null;
let g_keyUpEventTimeout = null;
let g_setting = {
    dblclickShowSubDoc: null,
    dblclickDelay: null,
    disableChangeIcon: null,
    revertBehavior: null,
    sameToOutline: null,
    extendClickArea: null,
    unfoldSubDocsWhileOpenParent: null,
    openToTop: null,
    lastModifyBlockHint: null,
    ignoreModifyHintIds: "",
    ignoreModifyHintIdsArray: [],
    ignoreModifyHintPathLikeArray: [],
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
    unfoldSubDocsWhileOpenParent: CONSTANTS.OPEN_WITCH_UNFOLD_OFF,
    openToTop: false,
    lastModifyBlockHint: false,
    ignoreModifyHintIds: "",
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
                // 打开同时展开设置项迁移
                if (settingCache && settingCache.unfoldSubDocsWhileOpenParent !== undefined) {
                    if (settingCache.unfoldSubDocsWhileOpenParent === false) {
                        settingCache.unfoldSubDocsWhileOpenParent = CONSTANTS.OPEN_WITCH_UNFOLD_OFF;
                    } else if (settingCache.unfoldSubDocsWhileOpenParent === true) {
                        settingCache.unfoldSubDocsWhileOpenParent = CONSTANTS.OPEN_WITCH_UNFOLD_ON;
                    }
                }
                
                Object.assign(g_setting, settingCache);
                bindBasicEventHandler();
                this.eventBusInnerHandler();
                getIgnoreList();
                setStyle();
            }catch(e){
                warnPush("DBT载入配置时发生错误",e);
            }
            // if (!initRetry()) {
            //     setInterval(initRetry, 3000);
            // }
        }, (e)=> {
            debugPush("配置文件读入失败", e);
        });
        bindClickDockEvent();
    }

    onunload() {
        this.el && this.el.remove();
        removeStyle();
        bindBasicEventHandler(true);
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
                bindBasicEventHandler(); 
                this.eventBusInnerHandler();
                // 解析 ignoreModifyHintIds
                getIgnoreList();
                setStyle();
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
            new SettingProperty("unfoldSubDocsWhileOpenParent", "SELECT",[{value: 0}, {value: 1}, {value: 2}]),
            new SettingProperty("extendClickArea", "SWITCH", null),
            new SettingProperty("sameToOutline", "SWITCH", null),
            new SettingProperty("sameToTag", "SWITCH", null),
            new SettingProperty("openToTop", "SWITCH", null),
            new SettingProperty("lastModifyBlockHint", "SWITCH", null),
            new SettingProperty("applyToDialog", "SWITCH", null),
            new SettingProperty("enableMobile", "SWITCH", null),
            new SettingProperty("ignoreModifyHintIds", "TEXTAREA", null),
            new SettingProperty("aboutAuthor", "HINT", null),
        ]);

        hello.appendChild(settingForm);
        settingDialog.element.querySelector(`#${CONSTANTS.PLUGIN_NAME}-form-content`).appendChild(hello);
    }

    eventBusInnerHandler() {
        if (g_setting.lastModifyBlockHint) {
            this.eventBus.on("click-editorcontent", saveRecentClickBlockId);
            this.eventBus.on("loaded-protyle-static", openRecentClockBlockHint);
        } else {
            this.eventBus.off("click-editorcontent", saveRecentClickBlockId);
            this.eventBus.off("loaded-protyle-static", openRecentClockBlockHint);
        }
        
    }
    
}

function getIgnoreList() {
    if (g_setting.ignoreModifyHintIds) {
        g_setting.ignoreModifyHintPathLikeArray = [];
        g_setting.ignoreModifyHintIdsArray = [];
        g_setting.ignoreModifyHintIds.split(",").forEach((elem)=>{
            elem = elem.trim();
            if (elem.endsWith("/")) {
                g_setting.ignoreModifyHintPathLikeArray.push(elem);
            } else {
                g_setting.ignoreModifyHintIdsArray.push(elem);
            }
        });
    }
}

function isIgnoreDoc(docId, docPath) {
    if (g_setting.ignoreModifyHintIdsArray.includes(docId)) {
        return true;
    }
    for (let i = 0; i < g_setting.ignoreModifyHintPathLikeArray.length; i++) {
        if (docPath.includes(g_setting.ignoreModifyHintPathLikeArray[i])) {
            return true;
        }
    }
    return false;
}
// 入口绑定开始
function bindBasicEventHandler(removeMode = false) {
    const isMobileDevice = isMobile();
    debugPush("绑定开始");
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
        // document.querySelector(fileTreeQuery)?.addEventListener(clickEventBindEventType, preventClickHander, false);
        // clickEventBindEventType = "mouseup";
        return;
    }
    let useCapture = true;
    // siyuan.showMessage(`前端 ${frontend} 后端 ${backend} ${clickEventBindEventType}`);
    // 绑定文档树行为
    document.querySelector(fileTreeQuery)?.removeEventListener(clickEventBindEventType, openDocActor, true);
    if (!removeMode) {
        document.querySelector(fileTreeQuery)?.addEventListener(clickEventBindEventType, openDocActor, true);
    }

    // 绑定点开docker行为
    document.querySelectorAll(outlineQuery).forEach((elem)=>{
        elem.removeEventListener(clickEventBindEventType, openDocActor, true);
        elem.removeEventListener(clickEventBindEventType, preventOutlineModifyPointHintHandler, true);
    });
    if (g_setting.sameToOutline && !removeMode) {
        document.querySelectorAll(outlineQuery).forEach((elem)=>{
            elem.addEventListener(clickEventBindEventType, openDocActor, true);
        });
    }
    // 编辑点提示
    if (g_setting.lastModifyBlockHint && !removeMode) {
        document.querySelectorAll(outlineQuery).forEach((elem)=>{
            elem.addEventListener(clickEventBindEventType, preventOutlineModifyPointHintHandler, true);
        });
    }

    // 快捷键打开响应
    // !.bind this实际上是多个不同的方法
    document.removeEventListener('keyup', bindKeyUpEvent);  
    if (!removeMode && (g_setting.sameToOutline || g_setting.sameToTag)) {
        document.addEventListener('keyup', bindKeyUpEvent);              
    }

    // 绑定tag行为
    document.querySelectorAll(tagQuery).forEach((elem)=>{
        elem.removeEventListener(clickEventBindEventType, trueClickActor, true);
    });

    if (g_setting.sameToTag && !removeMode) {
        document.querySelectorAll(tagQuery).forEach((elem)=>{
            elem.addEventListener(clickEventBindEventType, trueClickActor, true);
        });
    }
    

    // 对话框监视
    g_bodyObserver.disconnect();
    if (g_setting.applyToDialog && !removeMode) {
        g_bodyObserver.observe(document.body, {childList: true, subtree: false, attribute: false});
    }
}
function preventOutlineModifyPointHintHandler() {
    g_lastPopupReadTime = new Date();
}
function bindKeyUpEvent(event) {
    // 判断是否按下了 Alt 键，并且同时按下了 O 键
    if (isShortcutMatch(event, window.siyuan.config.keymap.editor.general.outline.custom ?? "⌥O")
    || isShortcutMatch(event, window.siyuan.config.keymap.general.outline.custom)
    || isShortcutMatch(event, window.siyuan.config.keymap.general.tag.custom)
    || isShortcutMatch(event, window.siyuan.config.keymap.general.fileTree.custom)) {
        // 在这里执行按下 Alt + O 键的逻辑
        debugPush("按下ALt+O");
        clearTimeout(g_keyUpEventTimeout);
        g_keyUpEventTimeout = setTimeout(()=>{
            bindBasicEventHandler(); 
        }, 300);      
    }
}
function bindClickDockEvent(removeMode = false) {
    const queryResult = document.querySelectorAll(`.dock span[data-type="tag"], .dock span[data-type="file"], .dock span[data-type="outline"]`);
    const that = this;
    queryResult.forEach((elem)=>{
        if (removeMode) {
            elem.removeEventListener("click", clickDockHandler);
        } else {
            elem.addEventListener("click", clickDockHandler);
        }
    });
}
function clickDockHandler() {
    debugPush("按下侧栏按钮");
    setTimeout(bindBasicEventHandler, 30); 
}

// 入口绑定结束

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

/* 点击行为处理 */

function initRetry() {
    if (!document.querySelector(".sy__file")) {
        logPush("未检测到文档树，终止listener绑定");
        return true;
    }
    document.querySelector('.sy__file')?.addEventListener('click', clickFileTreeHandler, true);
}
/*
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
    // TODO: metaKey屏蔽
    if (!g_setting.disableChangeIcon && event.srcElement.classList.contains("b3-list-item__icon")) {
        debugPush("点击的是图标，终止操作");
        return;
    }
    if (event.srcElement.classList.contains("b3-list-item__toggle") || ["svg", "use"].includes(event.srcElement.tagName) || event.srcElement.classList.contains("b3-list-item__action")) {
        const sourceElem = getSourceSpanElement(event.srcElement);
        debugPush("sourceElem", sourceElem);
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
*/

/**
 * 点击文档树事件处理
 * @param {int} openActionType 对应执行逻辑：CONSTANTS.ACTION_OPEN_DOC 将调用API打开文档 
 * @param {boolean} doNotSkipCtrlKey 为true则ctrl key时也进行处理、并不会跳过
 * @param {*} event 
 * @returns 
 */
function clickFileTreeHandler(openActionType, doNotSkipCtrlKey, event) {
    if (event.button != 0) {
        debugPush('按下的按键不是左键，终止操作')
        return;
    }
    if (!doNotSkipCtrlKey && isCtrlKey(event)) {
        debugPush("伴随ctrl/meta key按下，终止操作");
        return;
    }
    if (event.shiftKey || event.altKey) {
        debugPush("伴随shift/alt按下，终止操作");
        return;
    }
    if (isMetaKey(event)) {
        debugPush("伴随meta按下，终止操作");
        return;
    }
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/tagName DOM tagName为大写
    if (!g_setting.disableChangeIcon && (event.srcElement.classList.contains("b3-list-item__icon") || (["IMG"].includes(event.srcElement.tagName) && event.srcElement.parentElement.classList.contains("b3-list-item__icon")) )) {
        debugPush("点击的是图标，终止操作");
        return;
    }
    if (event.srcElement.classList.contains("b3-list-item__action")) {
        debugPush("列表操作项，不处理", event.srcElement);
        return;
    }
    if (event.srcElement.classList.contains("b3-list-item__toggle") || ["svg", "use"].includes(event.srcElement.tagName)) {
        const sourceElem = getSourceSpanElement(event.srcElement);
        debugPush("判定跳出用", sourceElem);
        if (sourceElem == null) {
            debugPush("sourceElem未找到，未知情况，不处理", event.srcElement);
            return;
        }
        if (sourceElem.classList.contains("b3-list-item__action")) {
            debugPush("列表操作项，不处理", event.srcElement);
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
        if (sourceElem?.getAttribute("data-type") == "navigation-root") {
            debugPush("单击：点击了笔记本层");
            return;
        }
        if (!isValidStr(g_recentClickedId) 
        && (sourceElem?.getAttribute("data-type") == "navigation-root" || sourceElem?.getAttribute("data-path") == undefined)
        && !(sourceElem?.getAttribute("data-treetype") == "tag") ) {
            debugPush("点击的元素不是文件，终止操作");
            g_isRecentClicked = 0;
            return;
        }
        // 通过判断箭头（不存在的话），直接跳到打开文档，而不等待
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
            // 根据类型，调用不同的打开函数
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
        const sourceElem = getSourceItemElement(event);
        if (sourceElem?.getAttribute("data-type") == "navigation-root") {
            debugPush("双击：点击了笔记本层，操作屏蔽");
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            return;
        }
        if (doubleClickHandler(event, openActionType)) {
            g_recentClickedId = null;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        } else {
            debugPush("二次点击未做点击拦截");
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

/**  
 * 只执行添加--focus类
 * 这个主要用于选择文档
 */
function pluginClickHandler(event) {
    const sourceElem = getSourceItemElement(event);
    if (sourceElem == null) {
        debugPush("sourceElem未找到");
        return false;
    }
    const diaglogElem = document.querySelector(".b3-dialog--open");
    const dialogType = diaglogElem.getAttribute("data-key");
    const multiSelectBlackList = ["dialog-movepathto"];
    if (!isCtrlKey(event) || multiSelectBlackList.includes(dialogType)) {
        document.getElementById("foldTree")?.querySelectorAll(".b3-list-item--focus").forEach((elem)=>elem.classList.remove("b3-list-item--focus"));
        document.getElementById("foldList")?.querySelectorAll(".b3-list-item--focus").forEach((elem)=>elem.classList.remove("b3-list-item--focus"));
    }
    if (sourceElem.classList.contains("b3-list-item--focus")) {
        sourceElem.classList.remove("b3-list-item--focus");
    } else {
        sourceElem.classList.add("b3-list-item--focus");
    }
    debugPush("由 插件点击 处理", sourceElem);
    // g_isPluginRawClickItem = true;
    // sourceElem.click();
    return true;
}

/**
 * 插件会重新发起一个点击事件
 * @param {*} event 
 * @returns 
 */
function pluginTrueClickHandler(event) {
    const sourceElem = getSourceItemElement(event);
    if (sourceElem == null) {
        debugPush("sourceElem未找到");
        return false;
    }
    if (!isCtrlKey(event)) {
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
    return openDocByTreeItemElement(sourceElem);
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
        return clickToOpenMulitWayDistributor(event, openActionType);
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
            if (g_setting.unfoldSubDocsWhileOpenParent != CONSTANTS.OPEN_WITCH_UNFOLD_OFF) {
                const b3ListItemToggle = sourceElem.querySelector('.b3-list-item__toggle');
                const child = b3ListItemToggle.querySelector(".b3-list-item__arrow--open")
                if (child && g_setting.unfoldSubDocsWhileOpenParent == CONSTANTS.OPEN_WITCH_UNFOLD_NO_FOLD) {
                    debugPush("节点已经展开，根据要求不收起");
                } else {
                    g_isPluginClickToggle = true;
                    b3ListItemToggle.click();
                }
                
            }
            // 打开文档
            if (!isMobile()) {
                debugPush("OPENTAB", new Date().getTime());
                siyuan.openTab({
                    app: g_app,
                    doc: {
                        id: targetNodeId,
                        action: souceType == FILE_TREE && g_setting.openToTop ? undefined : ["cb-get-focus", "cb-get-scroll"],
                        keepCursor: false,
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

/* 单双击处理结束 */

async function saveRecentClickBlockId(event) {
    logPush("保存点击id", event);
    const mouseevent = event.detail.event;
    const protyle = event.detail.protyle;
    const eventTarget = getSourceNode(mouseevent.srcElement);
    const docId = protyle.block.rootID;
    const currentBlockId = eventTarget?.dataset?.nodeId;
    logPush("点击id", currentBlockId, "文档id", docId);
    if (isValidStr(currentBlockId) && isValidStr(docId)) {
        if (isIgnoreDoc(docId, protyle.path)) {
            logPush("记录时，在忽略列表，不处理");
            return;
        }
        let saveDetail = {
            "time": new Date().getTime(),
            "blockId": currentBlockId,
        }
        const saveData = JSON.stringify(saveDetail);
        await addblockAttrAPI({"custom-og-last-click": saveData}, docId);
    }
    // 写入当前时间
    // 写入id
    // 写入到文档ial

    function getSourceNode(element) {
        let block = element;
        while (block != null && block.dataset.nodeId == null) block = block.parentElement;
        return block;
    }
}

async function openRecentClockBlockHint(event) {
    const protyle = event.detail.protyle;
    const docId = protyle.block.rootID;
    // 读取background ial
    logPush("文档ial", protyle.background?.ial["custom-og-last-click"], protyle);
    const ialStr = protyle?.background?.ial["custom-og-last-click"];
    if (protyle.model == null) {
        logPush("非文档树打开，不处理");
        return;
    }
    if (isIgnoreDoc(docId, protyle.path)) {
        logPush("在忽略列表，不处理");
        return;
    }
    if (protyle.option?.action.length > 0 && protyle.option.action.includes("cb-get-scroll")) {
        logPush("本次打开包括跳转，不显示");
        return;
    }
    // protyle.element.querySelector(".b3-tooltips.b3-tooltips__w.protyle-scroll__up").click();
    if (isValidStr(ialStr)) {
        const ial = JSON.parse(ialStr);
        const blockId = ial.blockId;
        const durationStr = getTimeDistanceString(ial.time);
        if (g_lastPopupReadTime != null) {
            if (getTimeDistanceAbsSeconds(g_lastPopupReadTime, new Date()) < 5) {
                logPush("短时反复触发，忽略")
                return;
            }
        }
        siyuan.showMessage(`${language["last_modify_point_welcome"].replace("%%", durationStr)}<button class="b3-button b3-button--white" data-og-block-id="${blockId}" data-og-id="backToHistory">${language["button_goto_last_modify_point"]}</button>`);
                g_lastPopupReadTime = new Date();
        setTimeout(()=>{
            document.querySelectorAll("button[data-og-id='backToHistory']").forEach((elem)=>{
                elem.addEventListener("click", openRefLink.bind(null, null, elem.getAttribute("data-og-block-id")));
            })
        }, 50);
        setTimeout(()=>{
            addblockAttrAPI({"custom-og-last-click": ""}, docId);
        }, 10000);
    }
}

function getTimeDistanceAbsSeconds(date, date2) {
    return Math.abs(date - date2) / 1000;
}

function getTimeDistanceString(date) {
    const now = new Date();
    const diff = Math.abs(now - date) / 1000; // 时间差，单位为秒

    if (diff <= 30) {
        return language["timed_less_than_a_minute"];
    } else if (diff <= 90) {
        return language["timed_1_minute"];
    } else if (diff <= 2670) {
        return language["timed_several_min"].replace("%%", Math.round(diff / 60));
    } else if (diff <= 5370) {
        return language["timed_about_1_hour"];
    } else if (diff <= 86370) {
        return language["timed_about_hours"].replace("%%", Math.round(diff / 3600));
    } else if (diff <= 1514700) {
        return language["timed_1_day"];
    } else if (diff <= 2555970) {
        return language["timed_days"].replace("%%", Math.round(diff / 86400));
    } else if (diff <= 37223700) {
        return language["timed_about_1_month"];
    } else if (diff <= 53965700) {
        return language["timed_about_2_months"];
    } else if (diff <= 290304000) {
        return language["timed_months"].replace("%%", Math.round(diff / 2592000));
    } else if (diff <= 341827200) {
        return language["timed_about_1_year"];
    } else if (diff <= 473385600) {
        return language["timed_over_1_year"];
    } else if (diff <= 577252800) {
        return language["timed_almost_2_years"];
    } else {
        const years = Math.floor(diff / 31557600);
        const months = Math.round((diff % 31557600) / 2629800);
        if (months < 3) {
            return language["timed_about_years"].replace("%%", years);
        } else if (months < 9) {
            return language["timed_over_years"].replace("%%", years);
        } else {
            return language["timed_almost_years"].replace("%%", years + 1);
        }
    }
}

function setStyle() {
    removeStyle();
    const head = document.getElementsByTagName('head')[0];
    const style = document.createElement('style');
    style.setAttribute("id", CONSTANTS.STYLE_ID);
    
    const preventHover = g_setting.disableChangeIcon ? `
    .sy__file [data-type="navigation-file"] .b3-list-item__icon.b3-tooltips.b3-tooltips__n[aria-label="${window.siyuan.languages.changeIcon}"] {
        pointer-events: none;
    }` : "";
    style.innerHTML = `
    ${preventHover}
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
      if (key === '⌘') return isCtrlKey(event);
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

async function addblockAttrAPI(attrs, blockid){
    let url = "/api/attr/setBlockAttrs";
    let attr = {
        id: blockid,
        attrs: attrs
    }
    let result = await request(url, attr);
    return parseBody(result);
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
let cacheIsMacOs = undefined;
function isMacOS() {
    let platform = window.top.siyuan.config.system.os ?? navigator.platform ?? "ERROR";
    platform = platform.toUpperCase();
    let macFlag = cacheIsMacOs;
    if (cacheIsMacOs == undefined) {
        for (let platformName of ["DARWIN", "MAC", "IPAD", "IPHONE", "IOS"]) {
            if (platform.includes(platformName)) {
                macFlag = true;
                break;
            }
        }
        cacheIsMacOs = macFlag;
    }
    return macFlag;
}

function isCtrlKey(event) {
    if (isMacOS()) {
        return event.metaKey;
    }
    return event.ctrlKey;
}

function isMetaKey(event) {
    if (isMacOS()) {
        return event.ctrlKey;
    }
    return event.metaKey;
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
 * @param {Event} event 
 */
function openRefLink(event, paramId = "", keyParam = undefined, protyleElem = undefined, openInFocus = false){
    let syMainWndDocument= window.parent.document
    let id;
    if (event && (event.currentTarget)?.getAttribute("data-node-id")) {
        id = (event.currentTarget)?.getAttribute("data-node-id");
    } else if ((event?.currentTarget)?.getAttribute("data-id")) {
        id = (event.currentTarget)?.getAttribute("data-id");
    } else {
        id = paramId;
    }
    // 处理笔记本等无法跳转的情况
    if (!isValidStr(id)) {return;}
    event?.preventDefault();
    event?.stopPropagation();
    debugPush("openRefLinkEvent", event);
    let simulateLink =  syMainWndDocument.createElement("span")
    simulateLink.setAttribute("data-type","a")
    simulateLink.setAttribute("data-href", "siyuan://blocks/" + id)
    simulateLink.style.display = "none";//不显示虚拟链接，防止视觉干扰
    let tempTarget = null;
    // 如果提供了目标protyle，在其中插入
    if (protyleElem && !openInFocus) {
        tempTarget = protyleElem.querySelector(".protyle-wysiwyg div[data-node-id] div[contenteditable]") ?? protyleElem;
        debugPush("openRefLink使用提供窗口", tempTarget);
    }
    debugPush("openInFocus?", openInFocus);
    if (openInFocus) {
        // 先确定Tab
        const dataId = syMainWndDocument.querySelector(".layout__wnd--active .layout-tab-bar .item--focus")?.getAttribute("data-id");
        debugPush("openRefLink尝试使用聚焦窗口", dataId);
        // 再确定Protyle
        if (isValidStr(dataId)) {
            tempTarget = window.document.querySelector(`.fn__flex-1.protyle[data-id='${dataId}']
            .protyle-wysiwyg div[data-node-id] div[contenteditable]`);
            debugPush("openRefLink使用聚焦窗口", tempTarget);
        }
    }
    if (!isValidStr(tempTarget)) {
        tempTarget = syMainWndDocument.querySelector(".protyle-wysiwyg div[data-node-id] div[contenteditable]");
        debugPush("openRefLink未能找到指定窗口，更改为原状态");
    }
    tempTarget.appendChild(simulateLink);
    let clickEvent = new MouseEvent("click", {
        ctrlKey: event?.ctrlKey ?? keyParam?.ctrlKey,
        shiftKey: event?.shiftKey ?? keyParam?.shiftKey,
        altKey: event?.altKey ?? keyParam?.altKey,
        bubbles: true
    });
    simulateLink.dispatchEvent(clickEvent);
    simulateLink.remove();
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