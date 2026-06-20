import { getPluginInstance } from "@/utils/pluginHelper";
import { getReadOnlyGSettings } from "@/manager/settingManager";
import TreeInteractionManager from "./dblclick/treeInteractionManager";
import RecentModifyHintManager from "./recentModifyHint";
import DialogClickBinder from "./dialogClickBinder";
export default class EventHandler {
    private handlerBindList: Record<string, (arg1: CustomEvent)=>void> = {
        "loaded-protyle-static": this.loadedProtyleStaticHandler.bind(this),
        "click-editorcontent": this.clickEditorContentHandler.bind(this),
    };
    // 关联的设置项，如果设置项对应为true，则才执行绑定
    private relateGsettingKeyStr: Record<string, string | null> = {
        "loaded-protyle-static": "lastModifyBlockHint",
        "click-editorcontent": "lastModifyBlockHint",
        "ws-main": "immediatelyUpdate",
    };

    private readonly treeInteractionManager: TreeInteractionManager;
    private readonly recentModifyHintManager: RecentModifyHintManager;
    private readonly dialogClickBinder: DialogClickBinder;

    constructor() {
        this.treeInteractionManager = new TreeInteractionManager({
            getDelay: () => {
                const setting = getReadOnlyGSettings();
                return Number(setting?.dblclickDelay ?? 200);
            },
        });
        this.recentModifyHintManager = new RecentModifyHintManager();
        this.dialogClickBinder = new DialogClickBinder();
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
        this.treeInteractionManager.bind();
        if (g_setting.applyToDialog) {
            this.dialogClickBinder.bind();
        }
        
    }

    unbindHandler() {
        const plugin = getPluginInstance();
        for (let key in this.handlerBindList) {
            plugin.eventBus.off(key, this.handlerBindList[key]);
        }
        this.treeInteractionManager.unbind();
        this.dialogClickBinder.unbind();
    }

    async loadedProtyleStaticHandler(event: CustomEvent<any>) {
        void this.recentModifyHintManager.handleLoadedProtyleStatic(event);
        void event;
    }

    async clickEditorContentHandler(event: CustomEvent<any>) {
        this.recentModifyHintManager.handleClickEditorContent(event);
        void event;
    }

}