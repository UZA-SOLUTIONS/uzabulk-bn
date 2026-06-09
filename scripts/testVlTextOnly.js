require("../utils/globals");
const { getDashscopeClient } = require("../modules/ai/dashscopeClient");

(async () => {
    const client = getDashscopeClient();
    const res = await client.chat.completions.create({
        model: "qwen-vl-plus",
        messages: [{
            role: "user",
            content: "Return JSON only: {\"title_en\":\"Test Product\",\"description_en\":\"A sample\"}",
        }],
        temperature: 0.3,
    });
    console.log(res.choices[0].message.content);
})().catch((e) => console.error(e?.error || e.message));
