import { logPush } from "@/logger";
import { getReadOnlyGSettings } from "@/manager/settingManager";
import { addblockAttrAPI } from "@/syapi";
import { isValidStr } from "@/utils/commonCheck";
import { lang } from "@/utils/lang";
import { openRefLink } from "@/utils/common";
import { showMessage } from "siyuan";

export default class RecentModifyHintManager {
    private lastPopupReadTime: Date | null = null;

    handleClickEditorContent(event: CustomEvent<any>) {
        const setting = getReadOnlyGSettings();
        if (!setting.lastModifyBlockHint) {
            return;
        }
        logPush("保存点击id", event);
        const mouseevent = event.detail.event as MouseEvent;
        const protyle = event.detail.protyle;
        const eventTarget = this.getSourceNode(mouseevent?.srcElement as HTMLElement | null);
        const docId = protyle.block.rootID;
        const currentBlockId = eventTarget?.dataset?.nodeId;
        logPush("点击id", currentBlockId, "文档id", docId);
        if (isValidStr(currentBlockId) && isValidStr(docId)) {
            if (this.isIgnoreDoc(docId, protyle.path)) {
                logPush("记录时，在忽略列表，不处理");
                return;
            }
            const saveDetail = {
                time: new Date().getTime(),
                blockId: currentBlockId,
            };
            void addblockAttrAPI({"custom-og-last-click": JSON.stringify(saveDetail)}, docId);
        }
    }

    async handleLoadedProtyleStatic(event: CustomEvent<any>) {
        const setting = getReadOnlyGSettings();
        if (!setting.lastModifyBlockHint) {
            return;
        }
        const protyle = event.detail.protyle;
        const docId = protyle.block.rootID;
        logPush("文档ial", protyle.background?.ial["custom-og-last-click"], protyle);
        const ialStr = protyle?.background?.ial["custom-og-last-click"];
        if (protyle.model == null) {
            logPush("非文档树打开，不处理");
            return;
        }
        if (this.isIgnoreDoc(docId, protyle.path)) {
            logPush("在忽略列表，不处理");
            return;
        }
        if (protyle.option?.action?.length > 0 && protyle.option.action.includes("cb-get-scroll")) {
            logPush("本次打开包括跳转，不显示");
            return;
        }
        if (!isValidStr(ialStr)) {
            return;
        }

        const ial = JSON.parse(ialStr);
        const blockId = ial.blockId;
        const durationStr = this.getTimeDistanceString(ial.time);
        if (this.lastPopupReadTime != null && this.getTimeDistanceAbsSeconds(this.lastPopupReadTime, new Date()) < 5) {
            logPush("短时反复触发，忽略");
            return;
        }
        showMessage(`${lang("last_modify_point_welcome").replace("%%", durationStr)}<button class="b3-button b3-button--white" data-og-block-id="${blockId}" data-og-id="backToHistory">${lang("button_goto_last_modify_point")}</button>`);
        this.lastPopupReadTime = new Date();
        setTimeout(() => {
            document.querySelectorAll("button[data-og-id='backToHistory']").forEach((elem) => {
                elem.addEventListener("click", openRefLink.bind(null, null, elem.getAttribute("data-og-block-id") ?? ""));
            });
        }, 50);
        setTimeout(() => {
            void addblockAttrAPI({"custom-og-last-click": ""}, docId);
        }, 10000);
    }

    private isIgnoreDoc(docId: string, docPath: string) {
        const setting = getReadOnlyGSettings();
        const ignoreModifyHintIds = String(setting.ignoreModifyHintIds ?? "");
        const ignoreIds = ignoreModifyHintIds.split(",").map((item) => item.trim()).filter(Boolean).filter((item) => !item.endsWith("/"));
        const pathLikes = ignoreModifyHintIds.split(",").map((item) => item.trim()).filter(Boolean).filter((item) => item.endsWith("/"));
        if (ignoreIds.includes(docId)) {
            return true;
        }
        for (const item of pathLikes) {
            if (docPath.includes(item)) {
                return true;
            }
        }
        return false;
    }

    private getSourceNode(element: HTMLElement | null) {
        let block = element;
        while (block != null && block.dataset?.nodeId == null) {
            block = block.parentElement;
        }
        return block;
    }

    private getTimeDistanceAbsSeconds(date: Date, date2: Date) {
        return Math.abs(date.getTime() - date2.getTime()) / 1000;
    }

    private getTimeDistanceString(date: number) {
        const now = new Date();
        const diff = Math.abs(now.getTime() - date) / 1000;
        if (diff <= 30) return lang("timed_less_than_a_minute");
        if (diff <= 90) return lang("timed_1_minute");
        if (diff <= 2670) return lang("timed_several_min").replace("%%", String(Math.round(diff / 60)));
        if (diff <= 5370) return lang("timed_about_1_hour");
        if (diff <= 86370) return lang("timed_about_hours").replace("%%", String(Math.round(diff / 3600)));
        if (diff <= 1514700) return lang("timed_1_day");
        if (diff <= 2555970) return lang("timed_days").replace("%%", String(Math.round(diff / 86400)));
        if (diff <= 37223700) return lang("timed_about_1_month");
        if (diff <= 53965700) return lang("timed_about_2_months");
        if (diff <= 290304000) return lang("timed_months").replace("%%", String(Math.round(diff / 2592000)));
        if (diff <= 341827200) return lang("timed_about_1_year");
        if (diff <= 473385600) return lang("timed_over_1_year");
        if (diff <= 577252800) return lang("timed_almost_2_years");
        const years = Math.floor(diff / 31557600);
        const months = Math.round((diff % 31557600) / 2629800);
        if (months < 3) return lang("timed_about_years").replace("%%", String(years));
        if (months < 9) return lang("timed_over_years").replace("%%", String(years));
        return lang("timed_almost_years").replace("%%", String(years + 1));
    }
}
