const DISPUTE_KEYWORDS = [
    "refund", "scam", "fraud", "lawyer", "chargeback", "dispute", "police",
    "never received", "not received", "broken", "damaged", "wrong item",
    "stolen", "court", "sue", "complaint", "unacceptable", "rip off", "ripoff",
    "remboursement", "arnaque", "plainte", "gusaba", "subiza", "ntabwo",
];

const HIGH_RISK_PATTERNS = [
    /\b(2|two|deux)\s+weeks?\b.*\b(no|not|still|pas|nta)\b/i,
    /\b(never|still)\s+(received|arrived|delivered)\b/i,
    /\bwhere\s+is\s+my\s+order\b/i,
    /\border\s+#?\w+[-\d]+\b.*\b(late|delayed|missing)\b/i,
];

const assessDisputeRisk = (userMessage = "", assistantStatus = "ok") => {
    const text = String(userMessage || "").toLowerCase();
    const keywordHits = DISPUTE_KEYWORDS.filter((kw) => text.includes(kw));
    const patternHits = HIGH_RISK_PATTERNS.filter((re) => re.test(userMessage));

    let score = keywordHits.length * 2 + patternHits.length * 3;
    if (assistantStatus === "EXCEPTION") score += 4;

    const dispute_flag = score >= 4;
    const escalate = score >= 6 || (dispute_flag && patternHits.length > 0);

    return {
        dispute_flag,
        escalate,
        score,
        reasons: [
            ...keywordHits.map((k) => `keyword:${k}`),
            ...patternHits.map(() => "pattern:delivery_or_dispute"),
            ...(assistantStatus === "EXCEPTION" ? ["ungrounded_response"] : []),
        ],
    };
};

module.exports = { assessDisputeRisk, DISPUTE_KEYWORDS };
