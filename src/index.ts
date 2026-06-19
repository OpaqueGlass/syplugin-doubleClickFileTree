import {
    Plugin,
    showMessage,
    getFrontend,
} from "siyuan";
import * as siyuan from "siyuan";
import "@/index.scss";

import { createApp } from "vue";
import settingVue from "./components/settings/setting.vue";
import { setLanguage } from "./utils/lang";
import { debugPush, errorPush, logPush } from "./logger";
import { initSettingProperty } from './manager/settingManager';
import { setPluginInstance } from "./utils/pluginHelper";
import { loadSettings } from "./manager/settingManager";
import EventHandler from "./manager/eventHandler";
import { removeStyle, setStyle } from "./manager/setStyle";
import { bindCommand } from "./manager/shortcutHandler";
import { generateUUID } from "./utils/common";

const STORAGE_NAME = "menu-config";

export default class OGSamplePlugin extends Plugin {
    private myEventHandler: EventHandler;

    async onload() {
        this.data[STORAGE_NAME] = {readonlyText: "Readonly"};
        logPush("测试", this.i18n);
        setLanguage(this.i18n);
        setPluginInstance(this);
        initSettingProperty();
        bindCommand(this);
        // 载入设置项，此项必须在setPluginInstance之后被调用
        this.myEventHandler = new EventHandler();
	// 示例：将得到的svg复制过来，将元素类型修改为symbol，然后设置一个id应该就行
        this.addIcons(`<symbol id="ogiconCopyImage" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-images"><path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/></symbol>
        <symbol id="ogiconSquareFunction" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-function"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3"/><path d="M9 11.2h5.7"/></symbol>
            `);
    }

    onLayoutReady(): void {
        loadSettings().then(()=>{
            this.myEventHandler.bindHandler();
            setStyle();
        }).catch((e)=>{
            showMessage("Load plugin settings failed." + this.name);
            errorPush(e);
        });
    }

    onunload(): void {
        // 善后
        this.myEventHandler.unbindHandler();
        // 移除所有已经插入的导航区
        removeStyle();
        // 清理绑定的宽度监听
        if (window["og_hn_observe"]) {
            for (const key in window["og_hn_observe"]) {
                debugPush("插件卸载清理observer", key);
                window["og_hn_observe"][key]?.disconnect();
            }
            delete window["og_hn_observe"];
        }
    }

    openSetting() {
        // 生成Dialog内容
        const uid = generateUUID();
        // 创建dialog
        const app = createApp(settingVue);
        const settingDialog = new siyuan.Dialog({
            "title": this.i18n["setting_panel_title"],
            "content": `
            <div id="og_plugintemplate_${uid}" style="overflow: hidden; position: relative;height: 100%;"></div>
            `,
            "width": isMobile() ? "92vw":"1040px",
            "height": isMobile() ? "50vw":"80vh",
            "destroyCallback": ()=>{app.unmount(); },
        });
        app.mount(`#og_plugintemplate_${uid}`);
    }
}

function isMobile() {
    return window.top.document.getElementById("sidebar") ? true : false;
};
