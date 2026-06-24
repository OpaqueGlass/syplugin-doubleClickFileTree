import { isMobile } from "@/syapi";
import FileTreePanelController from "./fileTreePanelController";
import OutlinePanelController from "./outlinePanelController";
import TagPanelController from "./tagPanelController";
import type { InteractionRuntimeOptions } from "./types";
import type PanelClickCallbackBase from "./callbacks/panelClickCallbackBase";
import FileTreeClickCallback from "./callbacks/fileTreeClickCallback";
import OutlineClickCallback from "./callbacks/outlineClickCallback";
import TagClickCallback from "./callbacks/tagClickCallback";
import { getReadOnlyGSettings } from "../settingManager";
import { debugPush } from "@/logger";

export interface TreeInteractionManagerOptions {
    getDelay: () => number;
    callbacks?: {
        fileTree?: PanelClickCallbackBase;
        outline?: PanelClickCallbackBase;
        tag?: PanelClickCallbackBase;
    };
}

export default class TreeInteractionManager {
    private readonly getDelay: () => number;

    private readonly fileTreeController: FileTreePanelController;
    private readonly outlineController: OutlinePanelController;
    private readonly tagController: TagPanelController;

    constructor(options: TreeInteractionManagerOptions) {
        this.getDelay = options.getDelay;

        const runtime = (): InteractionRuntimeOptions => ({
            dblclickDelay: this.getDelay(),
            capture: true,
            isMobile: isMobile(),
        });

        this.fileTreeController = new FileTreePanelController({
            runtime,
            callbacks: options.callbacks?.fileTree ?? new FileTreeClickCallback(),
        });

        this.outlineController = new OutlinePanelController({
            runtime,
            callbacks: options.callbacks?.outline ?? new OutlineClickCallback(),
        });

        this.tagController = new TagPanelController({
            runtime,
            callbacks: options.callbacks?.tag ?? new TagClickCallback(),
        });
    }

    bind() {
        const setting = getReadOnlyGSettings();
        if (!setting.enableMobile && isMobile()) {
            debugPush("移动端未启用接管，跳过绑定");
            return;
        }
        this.fileTreeController.bind();
        if (setting.sameToOutline) {
            this.outlineController.bind();
        }
        if (setting.sameToTag) {
            this.tagController.bind();
        }
    }

    unbind() {
        this.fileTreeController.unbind();
        this.outlineController.unbind();
        this.tagController.unbind();
    }

}
