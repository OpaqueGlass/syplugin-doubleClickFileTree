import { getPluginInstance } from "@/utils/pluginHelper";
import Mutex from "@/utils/mutex";
import { getReadOnlyGSettings } from "@/manager/settingManager";
import { IEventBusMap } from "siyuan";
export default class EventHandler {
    private handlerBindList: Record<string, (arg1: CustomEvent)=>void> = {
        "loaded-protyle-static": this.loadedProtyleRetryEntry.bind(this), // mutex需要访问EventHandler的属性
        "switch-protyle": this.loadedProtyleRetryEntry.bind(this),
    };
    // 关联的设置项，如果设置项对应为true，则才执行绑定
    private relateGsettingKeyStr: Record<string, string> = {
        "loaded-protyle-static": null, // mutex需要访问EventHandler的属性
        "switch-protyle": null,
        "ws-main": "immediatelyUpdate",
    };

    private loadAndSwitchMutex: Mutex;
    private simpleMutex: number = 0;
    private docIdMutex: Record<string, number> = {};
    constructor() {
        this.loadAndSwitchMutex = new Mutex();
    }

    bindHandler() {
        const plugin = getPluginInstance();
        const g_setting = getReadOnlyGSettings();
        // const g_setting = getReadOnlyGSettings();
        for (let key in this.handlerBindList) {
            if (this.relateGsettingKeyStr[key] == null || g_setting[this.relateGsettingKeyStr[key]]) {
                plugin.eventBus.on(key, this.handlerBindList[key]);
            }
        }
        
    }

    unbindHandler() {
        const plugin = getPluginInstance();
        for (let key in this.handlerBindList) {
            plugin.eventBus.off(key, this.handlerBindList[key]);
        }
    }

    async loadedProtyleRetryEntry(event: CustomEvent<IEventBusMap["loaded-protyle-static"]>) {
        // do sth
    }

}