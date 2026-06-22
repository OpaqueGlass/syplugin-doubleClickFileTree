import { TabProperty, ConfigProperty, loadAllConfigPropertyFromTabProperty } from "../utils/settings";
import { createApp, ref, watch } from "vue";
import { getPluginInstance } from "@/utils/pluginHelper";
import { debugPush, logPush } from "@/logger";
import { isMobile } from "@/syapi";
import { isValidStr } from "@/utils/commonCheck";
import * as siyuan from "siyuan";
import outdatedSettingVue from "@/components/dialog/outdatedSetting.vue";
import { generateUUID } from "@/utils/common";
import { lang } from "@/utils/lang";
import { setStyle } from "./setStyle";
import { CONSTANTS } from "@/constants";

// const pluginInstance = getPluginInstance();

let setting: any = ref({});
interface IPluginSettings {
    dblclickShowSubDoc?: boolean;
    prefetchSubDocsForDoubleClick?: boolean;
    dblclickDelay?: number;
    disableChangeIcon?: boolean;
    revertBehavior?: boolean;
    sameToOutline?: boolean;
    extendClickArea?: boolean;
    unfoldSubDocsWhileOpenParent?: number;
    openToTop?: boolean;
    lastModifyBlockHint?: boolean;
    ignoreModifyHintIds?: string;
    applyToDialog?: boolean;
    enableMobile?: boolean;
    sameToTag?: boolean;
    debugMode?: boolean;
};
let defaultSetting: IPluginSettings = {
    dblclickShowSubDoc: true,
    prefetchSubDocsForDoubleClick: false,
    dblclickDelay: 200,
    disableChangeIcon: false,
    revertBehavior: false,
    sameToOutline: false,
    extendClickArea: false,
    unfoldSubDocsWhileOpenParent: 0,
    openToTop: false,
    lastModifyBlockHint: false,
    ignoreModifyHintIds: "",
    applyToDialog: false,
    enableMobile: false,
    sameToTag: false,
    debugMode: false,
}


let tabProperties: Array<TabProperty> = [
    
];
let updateTimeout: any = null;

/**
 * 设置项初始化
 * 应该在语言文件载入完成后调用执行
 */
export function initSettingProperty() {
    tabProperties.push(
        new TabProperty({
            key: "general", iconKey: "iconSettings", props: [
                new ConfigProperty({ key: "dblclickShowSubDoc", type: "SWITCH" }),
                new ConfigProperty({ key: "prefetchSubDocsForDoubleClick", type: "SWITCH" }),
                new ConfigProperty({ key: "dblclickDelay", type: "NUMBER", min: 50, max: 1200 }),
                new ConfigProperty({ key: "revertBehavior", type: "SWITCH" }),
                new ConfigProperty({ key: "disableChangeIcon", type: "SWITCH" }),
                new ConfigProperty({ key: "unfoldSubDocsWhileOpenParent", type: "SELECT", options: ["0", "1", "2"] }),
                new ConfigProperty({ key: "extendClickArea", type: "SWITCH" }),
                new ConfigProperty({ key: "sameToOutline", type: "SWITCH" }),
                new ConfigProperty({ key: "sameToTag", type: "SWITCH" }),
                new ConfigProperty({ key: "applyToDialog", type: "SWITCH" }),
                new ConfigProperty({ key: "enableMobile", type: "SWITCH" }),

                new ConfigProperty({ key: "openToTop", type: "SWITCH" }),
                new ConfigProperty({ key: "lastModifyBlockHint", type: "SWITCH" }),
                new ConfigProperty({ key: "ignoreModifyHintIds", type: "TEXTAREA" }),

                new ConfigProperty({ key: "debugMode", type: "SWITCH" }),
            ]
        }),
    );
}

export function getTabProperties() {
    return tabProperties;
}

// 发生变动之后，由界面调用这里
export function saveSettings(newSettings: any) {
    // 如果有必要，需要判断当前设备，然后选择保存位置
    debugPush("界面调起保存设置项", newSettings);
    getPluginInstance().saveData("settings_main.json", JSON.stringify(newSettings, null, 4));
}


/**
 * 仅用于初始化时载入设置项
 * 请不要重复使用
 * 这里也进行设置项转移操作
 * @returns 
 */
export async function loadSettings() {
    let loadResult = null;
    // 这里从文件载入
    loadResult = await getPluginInstance().loadData("settings_main.json");
    debugPush("文件载入设置", loadResult);
    if (loadResult == undefined || loadResult == "") {
        let oldSettings = await transferOldSetting();
        debugPush("oldSettings", oldSettings);
        if (oldSettings != null) {
            debugPush("使用转换后的旧设置", oldSettings);
            loadResult = oldSettings;
        } else {
            loadResult = defaultSetting;
        }
    }
    const currentVersion = 20260620;
    if (!loadResult["@version"] || loadResult["@version"] < currentVersion) {
        // 旧版本
        loadResult["@version"] = currentVersion;
        if (siyuan.getAllEditor == null) {
            loadResult["immediatelyUpdate"] = false;
        }
        // 检查数组中指定设置和defaultSetting是否一致
        showOutdatedSettingWarnDialog(checkOutdatedSettings(loadResult), defaultSetting);
    }
    // showOutdatedSettingWarnDialog(checkOutdatedSettings(loadResult), defaultSetting);
    // 检查选项类设置项，如果发现不在列表中的，重置为默认
    try {
        loadResult = checkSettingType(loadResult);
    } catch(err) {
        logPush("设置项类型检查时发生错误", err);
    }
    
    // 如果有必要，判断设置项是否对当前设备生效
    // TODO: 对于Order，switch需要进行检查，防止版本问题导致选项不存在，不存在的用默认值
    // TODO: switch旧版需要迁移，另外引出迁移逻辑
    setting.value = Object.assign(Object.assign({}, defaultSetting), loadResult);
    if (setting.value.unfoldSubDocsWhileOpenParent === true) {
        setting.value.unfoldSubDocsWhileOpenParent = 1;
    } else if (setting.value.unfoldSubDocsWhileOpenParent === false) {
        setting.value.unfoldSubDocsWhileOpenParent = 0;
    }
    logPush("载入设置项", setting.value);
    // return loadResult;
    watch(setting, (newVal) => {
        // 延迟更新
        if (updateTimeout) {
            clearTimeout(updateTimeout);
        }
        logPush("检查到变化");
        updateTimeout = setTimeout(() => {
            // updateSingleSetting(key, newVal);
            saveSettings(newVal);
            // logPush("保存设置项", newVal);
            setStyle();
            changeDebug(newVal);
            updateTimeout = null;
        }, 1000);
    }, {deep: true, immediate: false});
}

/**
 * 检查当前载入设置项中是否存在过时的
 * @param loadSetting 当前载入的实际设置项
 * @returns 过时的设置项key
 */
function checkOutdatedSettings(loadSetting) {
    // 这里配置哪些设置项key是过时的
    const CHECK_SETTING_KEYS = [
    ];
    let result = [];
    for (let key of CHECK_SETTING_KEYS) {
        if (loadSetting[key] != defaultSetting[key]) {
            result.push(key);
        }
    }
    return result;
}

function showOutdatedSettingWarnDialog(outdatedSettingKeys, defaultSettings) {
    if (outdatedSettingKeys.length == 0) {
        return;
    }
    const app = createApp(outdatedSettingVue, {"outdatedKeys": outdatedSettingKeys, "defaultSettings": defaultSettings});
    const uid = generateUUID();
        const settingDialog = new siyuan.Dialog({
            "title": lang("dialog_panel_plugin_name") + lang("dialog_panel_outdate"),
            "content": `
            <div id="og_plugintemplate_${uid}" class="b3-dialog__content" style="overflow: hidden; position: relative;height: 100%;"></div>
            `,
            "width": isMobile() ? "42vw":"520px",
            "height": isMobile() ? "auto":"auto",
            "destroyCallback": ()=>{app.unmount();},
        });
        void settingDialog;
    app.mount(`#og_plugintemplate_${uid}`);
    return;
}

function changeDebug(newVal) {
    if (newVal["debugMode"] === true) {
        debugPush("调试模式已开启");
        window.top["OpaqueGlassDebug"] = true;
        if (!window.top["OpaqueGlassDebugV2"]) {
            window.top["OpaqueGlassDebugV2"] = {};
        }
        window.top["OpaqueGlassDebugV2"][CONSTANTS.PLUGIN_SHORT_NAME] = 5;
    } else if (newVal["debugMode"] === true) {
        debugPush("调试模式已关闭");
        if (window.top["OpaqueGlassDebugV2"] && window.top["OpaqueGlassDebugV2"][CONSTANTS.PLUGIN_SHORT_NAME]) {
            delete window.top["OpaqueGlassDebugV2"][CONSTANTS.PLUGIN_SHORT_NAME];
        }
    }
}
function checkSettingType(input:any) {
    const propertyMap = loadAllConfigPropertyFromTabProperty(tabProperties)
    for (const prop of Object.values(propertyMap)) {
        if (prop.type == "SELECT") {
            if (!prop.options.includes(input[prop.key])) {
                input[prop.key] = defaultSetting[prop.key];
            } else if (prop.key === "unfoldSubDocsWhileOpenParent") {
                input[prop.key] = Number(input[prop.key]);
            }
            // input[prop.key] = String(input[prop.key]);
        } else if (prop.type == "ORDER") {
            // 这里是删除无效的设置项，实际上有可以优化的点
            // const newOrder = [];
            // for (const item of input[prop.key]) {
            //     if (Object.values(PRINTER_NAME).includes(item)) {
            //         newOrder.push(item);
            //     }
            // }
            // input[prop.key] = newOrder;
        } else if (prop.type == "SWITCH") {
            if (input[prop.key] == undefined) {
                input[prop.key] = defaultSetting[prop.key];
            }
        } else if (prop.type == "NUMBER") {
            if (isValidStr(input[prop.key])) {
                input[prop.key] = parseFloat(input[prop.key]);
            }
        }
    }
    return input;
}

/**
 * 迁移、转换、覆盖设置项
 * @returns 修改后的新设置项
 */
async function transferOldSetting() {
    const oldSettings = await getPluginInstance().loadData("settings.json");
    // 判断并迁移设置项
    let newSetting = Object.assign({}, oldSettings);
    if (oldSettings == null || oldSettings == "") {
        return null;
    }

    /* 这里是转换代码 */

    // 移除过时的设置项
    for (let key of Object.keys(newSetting)) {
        if (!(key in defaultSetting)) {
            delete newSetting[key];
        }
    }
    newSetting = Object.assign(Object.assign({}, defaultSetting), newSetting);
    
    return newSetting;
}

export function getGSettings() {
    // logPush("getConfig", setting.value, setting);
    // 改成 setting._rawValue不行
    return setting;
}

export function getReadOnlyGSettings() {
    return setting._rawValue;
}

export function getDefaultSettings() {
    return defaultSetting;
}

export function updateSingleSetting() {
}

