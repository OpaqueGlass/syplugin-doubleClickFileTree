import { getDefaultSettings, getReadOnlyGSettings } from "@/manager/settingManager";
import { CONSTANTS } from "@/constants";
import { logPush } from "@/logger";
import { isMobile } from "@/syapi";

export function setStyle() {
    removeStyle();
    const g_setting = getReadOnlyGSettings();
    logPush("set styleg_setting", g_setting);
    const g_setting_default = getDefaultSettings();
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


export function removeStyle() {
    document.getElementById(CONSTANTS.STYLE_ID)?.remove();
}