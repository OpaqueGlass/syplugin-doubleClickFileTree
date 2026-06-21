export class CONSTANTS {
    public static readonly STYLE_ID: string = "template-plugin-style";
    public static readonly PLUGIN_SHORT_NAME: string = "fte";
    public static readonly PLUGIN_FULL_NAME: string = "双击文档树";
}

export enum CLICK_SOURCE_TYPE {
    FILE_TREE = 0,
    OUTLINE_TREE = 1,
    NOTEBOOK = 2
}