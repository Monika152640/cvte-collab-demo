import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
  baseURL: import.meta.env.VITE_DEEPSEEK_BASE_URL,
  dangerouslyAllowBrowser: true,
})

export const getConflictMergeSuggestion = async (context, userAChange, userBChange) => {
  const prompt = `
  你是一个专业的协作文档助手，现在有一个多人编辑的冲突场景，请你根据上下文和两个用户的修改，生成一个合理的语义级合并建议：
  文档上下文：${context}
  用户A的修改：${userAChange}
  用户B的修改：${userBChange}
  要求：
  1. 理解双方的编辑意图，保留双方修改的合理部分
  2. 生成的合并文本要语义连贯，逻辑通顺
  3. 用清晰的格式输出合并后的文本和合并理由
  `
  const response = await openai.chat.completions.create({
    model: 'glm-4',  // ✅ 这里修复了！
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  })
  return response.choices[0].message.content
}