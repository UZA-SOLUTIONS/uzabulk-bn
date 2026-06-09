/**
 * Extract JSON object/array from LLM text (raw JSON or ```json fenced).
 */
const parseJsonFromLlm = (text) => {
    const raw = String(text || "").trim();
    if (!raw) throw new Error("Empty LLM response");

    try {
        return JSON.parse(raw);
    } catch {
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced?.[1]) {
            return JSON.parse(fenced[1].trim());
        }
        const start = raw.search(/[\[{]/);
        const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
        if (start >= 0 && end > start) {
            return JSON.parse(raw.slice(start, end + 1));
        }
        throw new Error("Could not parse JSON from model output");
    }
};

module.exports = { parseJsonFromLlm };
