export type PanelType = "fileTree" | "outline" | "tag";

export interface ClickDispatchContext {
    panelType: PanelType;
    event: MouseEvent;
    itemElement: HTMLElement;
    itemId: string;
}

export interface InteractionRuntimeOptions {
    dblclickDelay: number;
    capture: boolean;
    isMobile: boolean;
}
