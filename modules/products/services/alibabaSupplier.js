/**
 * 1688 supplier APIs: alibaba.member.get + alibaba.company.get
 */
const client = require("../../../lib/alibaba1688Client");

const MEMBER_NS = "com.alibaba.member";
const COMPANY_NS = "com.alibaba.company";

const postOrNull = async (urlPath, params) => {
    const result = await client.post(urlPath, params);
    return result.ok ? result.data : null;
};

const buildMemberParams = (memberId) => ({
    _aop_timestamp: Date.now().toString(),
    memberId: String(memberId),
});

const getAlibabaMember = async (memberId) => {
    const id = String(memberId || "").trim();
    if (!id || !client.isConfigured()) return null;

    const urlPath = client.urlPath(MEMBER_NS, "alibaba.member.get");
    let payload = await postOrNull(urlPath, buildMemberParams(id));

    if (!payload) {
        payload = await postOrNull(urlPath, {
            ...buildMemberParams(id),
            loginId: id,
        });
    }

    return payload;
};

const getAlibabaCompany = async (memberId) => {
    const id = String(memberId || "").trim();
    if (!id || !client.isConfigured()) return null;

    const urlPath = client.urlPath(COMPANY_NS, "alibaba.company.get");
    let payload = await postOrNull(urlPath, buildMemberParams(id));

    if (!payload) {
        payload = await postOrNull(urlPath, {
            _aop_timestamp: Date.now().toString(),
            companyParam: JSON.stringify({ memberId: id }),
        });
    }

    return payload;
};

const fetchSupplierProfileFrom1688 = async (memberId) => {
    const [member, company] = await Promise.all([
        getAlibabaMember(memberId),
        getAlibabaCompany(memberId),
    ]);
    return { member, company };
};

module.exports = {
    getAlibabaMember,
    getAlibabaCompany,
    fetchSupplierProfileFrom1688,
};
