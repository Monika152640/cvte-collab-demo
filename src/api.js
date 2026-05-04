const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY
const BASE_URL = (import.meta.env.VITE_DEEPSEEK_BASE_URL || '').replace(/\/+$/, '')

const callAI = async (prompt, temperature = 0.3) => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'glm-4',
      messages: [{ role: 'user', content: prompt }],
      temperature
    })
  })
  if (!res.ok) throw new Error(`API请求失败 (${res.status})`)
  const data = await res.json()
  return data.choices[0].message.content
}

export const getConflictMergeSuggestion = async (context, userAChange, userBChange) => {
  const prompt = `你是一个专业的协作文档助手。当前多人协作编辑文档时出现了语义冲突，不同用户对同一内容有不同的理解和修改。请根据上下文和各位用户的修改意图，生成一个合理的语义级合并建议。

文档上下文：
${context}

各用户的修改意见：
${userAChange}

${userBChange}

要求：
1. 识别各方的编辑意图，保留合理部分
2. 合并后的文本语义连贯、逻辑通顺
3. 输出格式：
【冲突分析】
简要说明各方意图和冲突点

【合并建议】
输出合并后的完整文本

【保留理由】
说明为什么这样合并`
  return callAI(prompt)
}

export const getAISummary = async (docText, commentStr) => {
  const prompt = `请根据以下文档和评论生成结构化会议纪要。
要求：简洁、分点、总字数不超过300字，不要换行过多。

文档内容：
${docText || '(无内容)'}

评论内容：
${commentStr || '(无评论)'}`
  return callAI(prompt)
}

export const extractTodosFromDiscussion = async (docText, commentsStr) => {
  const prompt = `请从以下会议讨论中智能提取所有待办事项/行动项。

文档内容：
${docText || '(无内容)'}

讨论评论：
${commentsStr || '(无评论)'}

请识别每一个行动项，严格按照以下格式逐行输出（不要输出其他内容）：
任务内容 | 负责人：建议负责人 | 优先级：高/中/低

例如：
整理会议纪要并发给全员 | 负责人：张三 | 优先级：高
预约下次评审会议时间 | 负责人：李四 | 优先级：中`
  return callAI(prompt, 0.2)
}

export const compareVersions = async (currentContent, versionContent, versionNote) => {
  const prompt = `请对比以下两个版本的协作文档，给出专业的版本分析。

=== 当前版本 ===
${currentContent || '(空文档)'}

=== 历史版本（${versionNote}） ===
${versionContent || '(空文档)'}

请按以下格式输出：
【核心差异】
简要列出两个版本之间的关键变化（增/删/改）

【建议保留的变更】
列出当前版本中应该保留的内容

【建议回滚的变更】
列出当前版本中可能需要回滚的内容

【综合建议】
给出整体版本管理建议`
  return callAI(prompt)
}
