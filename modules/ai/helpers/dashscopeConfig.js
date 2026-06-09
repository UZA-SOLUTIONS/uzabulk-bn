const REGION_BASE_URLS = {
    singapore: () => "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    singapore_workspace: (workspaceId) =>
        workspaceId
            ? `https://${workspaceId}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`
            : "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    us: () => "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
    beijing: () => "https://dashscope.aliyuncs.com/compatible-mode/v1",
    hongkong: (workspaceId) =>
        workspaceId
            ? `https://${workspaceId}.cn-hongkong.maas.aliyuncs.com/compatible-mode/v1`
            : "https://dashscope.aliyuncs.com/compatible-mode/v1",
    frankfurt: (workspaceId) =>
        workspaceId
            ? `https://${workspaceId}.eu-central-1.maas.aliyuncs.com/compatible-mode/v1`
            : "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
};

const resolveBaseUrl = () => {
    const cfg = env?.dashscope || {};
    if (cfg.BASE_URL) return String(cfg.BASE_URL).replace(/\/+$/, "");

    const region = String(cfg.REGION || "singapore").toLowerCase();
    const workspaceId = String(cfg.WORKSPACE_ID || "").trim();
    const builder = REGION_BASE_URLS[region] || REGION_BASE_URLS.singapore;
    return builder(workspaceId);
};

module.exports = { resolveBaseUrl };
