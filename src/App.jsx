import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { CommentExtension } from '@sereneinserenade/tiptap-comment-extension'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEffect, useState, useCallback } from 'react'
import './App.css'
import { getConflictMergeSuggestion, getAISummary, extractTodosFromDiscussion, compareVersions } from './api.js'

const userList = [
  { name: '用户A', color: '#ff5555' },
  { name: '用户B', color: '#55ff55' },
  { name: '用户C', color: '#5555ff' },
  { name: '用户D', color: '#ffaa00' },
  { name: '用户E', color: '#aa55ff' },
]

const USER_STORAGE_KEY = 'cvte_collab_user_v2'

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return null
}

const saveUser = (u) => {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u))
}

function App() {
  const [user] = useState(() => {
    const stored = getStoredUser()
    if (stored) return stored
    const picked = userList[Math.floor(Math.random() * userList.length)]
    saveUser(picked)
    return picked
  })
  const [ydoc] = useState(() => new Y.Doc())
  const [provider] = useState(() =>
    new WebsocketProvider(import.meta.env.VITE_WS_URL || 'wss://cvte-collab-demo-production.up.railway.app', 'cvte-doc', ydoc)
  )

  const [commentMap] = useState(() => ydoc.getMap('comments'))
  const [versionMap] = useState(() => ydoc.getArray('versions'))
  const [todoMap] = useState(() => ydoc.getArray('todos'))
  const [summaryMap] = useState(() => ydoc.getText('meetingSummary')) // 共享纪要
  const [onlineUserList, setOnlineUserList] = useState([])

  const [syncStatus, setSyncStatus] = useState('连接中...')
  const [conflictList, setConflictList] = useState([])
  const [aiResult, setAiResult] = useState('')
  const [loading, setLoading] = useState(false)

  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState([])
  const [versions, setVersions] = useState([])
  const [versionNote, setVersionNote] = useState('')
  const [meetingSummary, setMeetingSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [todos, setTodos] = useState([])
  const [todoText, setTodoText] = useState('')
  const [assignTo, setAssignTo] = useState('全体成员')
  const [compareVersionId, setCompareVersionId] = useState(null)
  const [compareResult, setCompareResult] = useState('')
  const [compareLoading, setCompareLoading] = useState(false)
  const [extractTodoLoading, setExtractTodoLoading] = useState(false)

  const editor = useEditor({
    editable: true,
    extensions: [
      StarterKit.configure({
        comment: { HTMLAttributes: { class: 'tiptap-comment' } }
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: { class: 'resizable-image' }
      }),
      CommentExtension.configure({
        userId: user.name,
        userName: user.name,
        userColor: user.color,
      }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({ provider, user }),
    ],
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const yFragment = ydoc.getXmlFragment('prosemirror')

    const trySetDefaultContent = () => {
      if (yFragment.length === 0) {
        editor.commands.setContent(`
          <h2>CVTE 高效协作 π - AI 智能协同编辑器</h2>
          <p>多人实时同步 + 批注评论 + 版本回溯 + AI冲突合并 + 会议纪要 + 待办任务追踪</p>
        `)
      }
    }

    // sync 事件在首次同步完成后触发
    const onSync = (isSynced) => {
      if (isSynced) trySetDefaultContent()
    }
    provider.on('sync', onSync)

    // 如果已经连接且同步完成，立即检查
    if (provider.synced) trySetDefaultContent()

    return () => {
      provider.off('sync', onSync)
    }
  }, [editor, provider, ydoc])

  useEffect(() => {
    // 让其他客户端能看到当前用户
    provider.awareness.setLocalState({
      user: { name: user.name, color: user.color }
    })
  }, [provider, user])

  useEffect(() => {
    if (!editor) return
    const updateStatus = (event) => {
      if (event.status === 'connected') setSyncStatus('✅ 已在线同步')
      if (event.status === 'disconnected') setSyncStatus('❌ 断开连接')
    }
    provider.on('status', updateStatus)
    return () => provider.off('status', updateStatus)
  }, [provider, editor])

  useEffect(() => {
    const syncUsers = () => {
      const states = Array.from(provider.awareness.getStates().values())
      const users = states
        .filter(s => s.user && s.user.name !== user.name)
        .map(s => s.user)
      setOnlineUserList(users)
    }
    provider.awareness.on('change', syncUsers)
    syncUsers()
    return () => provider.awareness.off('change', syncUsers)
  }, [provider, user.name])

  useEffect(() => {
    const handleMapChange = () => {
      const allComments = []
      commentMap.forEach((value, key) => allComments.push({ id: key, ...value }))
      allComments.sort((a, b) => new Date(a.time) - new Date(b.time))
      setComments(allComments)
    }
    handleMapChange()
    commentMap.observe(handleMapChange)
    return () => commentMap.unobserve(handleMapChange)
  }, [commentMap])

  useEffect(() => {
    const syncVersions = () => setVersions([...versionMap])
    syncVersions()
    versionMap.observe(syncVersions)
    return () => versionMap.unobserve(syncVersions)
  }, [versionMap])

  useEffect(() => {
    const syncTodos = () => setTodos([...todoMap])
    syncTodos()
    todoMap.observe(syncTodos)
    return () => todoMap.unobserve(syncTodos)
  }, [todoMap])

  // 纪要同步（所有人可见）
  useEffect(() => {
    const syncSummary = () => {
      setMeetingSummary(summaryMap.toString())
    }
    syncSummary()
    summaryMap.observe(syncSummary)
    return () => summaryMap.unobserve(syncSummary)
  }, [summaryMap])

  useEffect(() => {
    if (!editor) return
    const yFragment = ydoc.getXmlFragment('prosemirror')
    const observer = (events) => {
      // 收集远程变更中的用户信息
      const remoteUsers = new Set()
      const states = provider.awareness.getStates()
      events.forEach(event => {
        // 通过 awareness 查找当前在线的其他用户
        states.forEach((state, clientId) => {
          if (clientId !== provider.awareness.clientID && state.user) {
            remoteUsers.add(state.user.name)
          }
        })
      })
      const involved = Array.from(remoteUsers)
      if (involved.length > 0) {
        setConflictList(prev => [...prev, {
          id: Date.now(),
          users: involved,
          time: new Date().toLocaleTimeString()
        }])
      }
    }
    yFragment.observeDeep(observer)
    return () => yFragment.unobserveDeep(observer)
  }, [editor, ydoc, provider])

  useEffect(() => {
    return () => { provider.destroy(); ydoc.destroy() }
  }, [provider, ydoc])

  const addComment = () => {
    if (!editor || !commentText.trim()) return
    const { from, to } = editor.state.selection
    if (from === to) return alert('请先选中文字')
    const cid = `comment_${Date.now()}`
    const selectedText = editor.state.doc.textBetween(from, to, ' ')
    editor.commands.setComment(cid)
    commentMap.set(cid, {
      text: commentText,
      user: user.name,
      color: user.color,
      time: new Date().toLocaleTimeString(),
      selectedText
    })
    setCommentText('')
  }

  const detectAndMergeConflict = async () => {
    if (!editor) return
    setLoading(true)
    setAiResult('')
    try {
      const rawText = editor.getText()

      // 收集各用户的评论作为"修改意图"
      const userEdits = {}
      comments.forEach(c => {
        if (!userEdits[c.user]) userEdits[c.user] = []
        userEdits[c.user].push(`对"${c.selectedText}"的批注：${c.text}`)
      })

      const allOnline = [user, ...onlineUserList]
      const changeAStr = Object.entries(userEdits)
        .map(([name, edits]) => `【${name}的编辑意图】\n${edits.join('\n')}`)
        .join('\n\n')
      const changeBStr = allOnline.length > 1
        ? `当前协作成员：${allOnline.map(u => u.name).join('、')}`
        : ''

      const res = await getConflictMergeSuggestion(rawText, changeAStr || '暂无批注意图', changeBStr)
      setAiResult(res)
    } catch (e) {
      setAiResult('合并失败：' + (e.message || '请检查网络'))
    } finally {
      setLoading(false)
    }
  }

  const applyAiResult = () => {
    if (!aiResult || !editor) return
    editor.chain().focus().insertContent(`<p>${aiResult}</p>`).run()
    setAiResult('')
    setConflictList([])
  }

  const saveVersion = useCallback(() => {
    if (!versionNote.trim()) return alert('请输入版本备注')
    const item = {
      id: `v_${Date.now()}`,
      note: versionNote,
      time: new Date().toLocaleString(),
      content: editor.getHTML(),
      createUser: user.name
    }
    versionMap.push([item])
    setVersionNote('')
  }, [editor, versionNote, versionMap, user.name])

  const rollbackVersion = (item) => {
    editor.commands.setContent(item.content)
    alert('已回滚到版本：' + item.note)
  }

  const handleCompareVersion = async (v) => {
    setCompareVersionId(v.id)
    setCompareLoading(true)
    setCompareResult('')
    try {
      const currentContent = editor.getText()
      const versionText = v.content.replace(/<[^>]*>/g, '')
      const res = await compareVersions(currentContent, versionText, v.note)
      setCompareResult(res)
    } catch (e) {
      setCompareResult('对比失败：' + (e.message || '请检查网络'))
    } finally {
      setCompareLoading(false)
    }
  }

  const handleExtractTodos = async () => {
    setExtractTodoLoading(true)
    try {
      const docText = editor.getText()
      const commentStr = comments.map(c => `【${c.user}】选中"${c.selectedText}"→批注：${c.text}`).join('\n')
      const res = await extractTodosFromDiscussion(docText, commentStr)

      const lines = res.split('\n').filter(line => line.trim() && line.includes('|'))
      lines.forEach(line => {
        const parts = line.split('|').map(s => s.trim())
        const taskText = parts[0] || line
        const assignPart = parts.find(p => p.includes('负责人'))
        const assignee = assignPart ? assignPart.replace(/负责人[：:]\s*/, '').trim() : '全体成员'

        todoMap.push([{
          id: `todo_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: taskText,
          done: false,
          createUser: 'AI',
          assignTo: assignee,
          time: new Date().toLocaleTimeString()
        }])
      })
    } catch (e) {
      alert('提取失败：' + (e.message || '请检查网络'))
    } finally {
      setExtractTodoLoading(false)
    }
  }

  const generateSummary = async () => {
    setSummaryLoading(true)
    try {
      const docText = editor.getText()
      const commentStr = comments.map(c => `【${c.user}】${c.text}`).join('\n')
      const res = await getAISummary(docText, commentStr)
      const finalText = 'AI记录如下：\n' + (res || '生成失败')
      summaryMap.delete(0, summaryMap.length)
      summaryMap.insert(0, finalText)
    } catch (e) {
      summaryMap.delete(0, summaryMap.length)
      summaryMap.insert(0, '生成失败：' + (e.message || '请检查网络或API配置'))
    } finally {
      setSummaryLoading(false)
    }
  }

  const copySummary = () => {
    navigator.clipboard.writeText(meetingSummary)
    alert('已复制到剪贴板')
  }

  const exportToWeCom = () => {
    const msg = `
【CVTE 会议纪要】
${meetingSummary}

【待办事项】
${todos.map(t => `[${t.done ? '✅' : '🔲'}] ${t.text} | 负责人：${t.assignTo}`).join('\n')}
    `
    navigator.clipboard.writeText(msg)
    alert('已复制为企业微信格式')
  }

  const addTodo = () => {
    if (!todoText.trim()) return
    const item = {
      id: `todo_${Date.now()}`,
      text: todoText,
      done: false,
      createUser: user.name,
      assignTo,
      time: new Date().toLocaleTimeString()
    }
    todoMap.push([item])
    setTodoText('')
  }

  const toggleTodo = (idx) => {
    const item = todoMap.get(idx)
    item.done = !item.done
    todoMap.delete(idx)
    todoMap.insert(idx, [item])
  }

  const handleLocalImage = (e) => {
    const file = e.target.files[0]
    if (!file || !editor) return
    const reader = new FileReader()
    reader.onload = evt => {
      editor.chain().focus().setImage({ src: evt.target.result }).run()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  if (!editor) {
    return <div style={{ textAlign: 'center', padding: '50px', fontSize: '20px' }}>加载编辑器中...</div>
  }

  return (
    <div className="app" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ textAlign: 'center' }}>
        <h1>📝 CVTE 高效协作 π 智能编辑器</h1>
        <p>当前用户：<strong style={{ color: user.color }}>{user.name}</strong>｜{syncStatus}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: 5 }}>
          在线成员：
          <span style={{ color: user.color, fontWeight: 500 }}>● {user.name}（我）</span>
          {onlineUserList.map((u, i) => (
            <span key={i} style={{ color: u.color, fontWeight: 500, marginLeft: 6 }}>● {u.name}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '15px 0' }}>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>标题</button>
        <button onClick={() => editor.chain().focus().toggleBold().run()}>加粗</button>
        <button onClick={() => editor.chain().focus().clearContent().run()}>清空</button>
        <label style={{ padding: '6px 12px', background: '#409eff', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>
          插入图片
          <input type="file" hidden accept="image/*" onChange={handleLocalImage} />
        </label>
        <button onClick={detectAndMergeConflict} disabled={loading} style={{ background: '#6366f1', color: '#fff' }}>
          {loading ? '合并中...' : '🧪 AI冲突合并'}
        </button>
        <button onClick={applyAiResult} disabled={!aiResult} style={{ background: '#10b981', color: '#fff' }}>
          ✅ 应用结果
        </button>
      </div>

      {/* ===================== 修复：输入框不会被撑宽 ====================== */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
        <input
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          placeholder="输入会议批注..."
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: 6,
            border: '1px solid #ddd',
            width: '100%',
            minWidth: 0,
            wordWrap: 'break-word'
          }}
        />
        <button onClick={addComment} style={{ padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4 }}>
          添加批注
        </button>
      </div>

      <div style={{ border: '1px solid #eee', padding: '15px', minHeight: '400px', maxHeight: '60vh', background: '#fff', borderRadius: 8, overflow: 'auto', wordBreak: 'break-word' }}>
        <EditorContent editor={editor} />
      </div>

      {conflictList.length > 0 && (
        <div style={{ margin: '10px 0', padding: '12px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
          <strong>⚠️ 检测到多人编辑（{conflictList.length}处）</strong>
          {conflictList[conflictList.length - 1].users && (
            <span style={{ fontSize: 13, color: '#666' }}> — 涉及用户：{conflictList[conflictList.length - 1].users.join('、')}</span>
          )}
          <p style={{ margin: '4px 0 0 0', fontSize: 14 }}>点击 "AI冲突合并" 按钮，AI 将分析各方意图并给出合并建议</p>
        </div>
      )}

      {aiResult && (
        <div style={{
          margin: '15px 0',
          padding: '15px',
          background: '#f0f7ff',
          border: '1px solid #dbeafe',
          borderRadius: 8,
          maxHeight: '320px',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ margin: 0 }}>🧠 AI 冲突分析与合并建议</h4>
            <button onClick={() => setAiResult('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 14, background: '#fff', padding: 12, borderRadius: 6, margin: 0 }}>{aiResult}</pre>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', margin: '20px 0' }}>
        <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: 8, background: '#fff' }}>
          <h4>🗣️ 会议批注 ({comments.length})</h4>
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {comments.map(c => (
              <div key={c.id} style={{ borderLeft: '4px solid ' + c.color, padding: '8px', background: '#f9f9f9', margin: '6px 0', borderRadius: 4 }}>
                <strong style={{ color: c.color }}>{c.user}</strong> {c.time}
                <div style={{ fontSize: '12px', color: '#666' }}>选中：{c.selectedText}</div>
                <p style={{ margin: '4px 0 0 0' }}>{c.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: 8, background: '#fff' }}>
          <h4>📚 版本管理</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: 10 }}>
            <input
              value={versionNote}
              onChange={e => setVersionNote(e.target.value)}
              placeholder="输入版本备注"
              style={{ flex: 1, padding: '6px', borderRadius: 4, border: '1px solid #ddd' }}
            />
            <button onClick={saveVersion} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4 }}>保存</button>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {versions.map(v => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: compareVersionId === v.id ? '#e0f2fe' : '#f5f5f5', margin: '4px 0', borderRadius: 4 }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{v.note}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{v.time} · {v.createUser}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => handleCompareVersion(v)} disabled={compareLoading} style={{ border: 'none', padding: '4px 8px', borderRadius: 4, background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
                    {compareLoading && compareVersionId === v.id ? '分析中...' : 'AI对比'}
                  </button>
                  <button onClick={() => rollbackVersion(v)} style={{ border: 'none', padding: '4px 8px', borderRadius: 4, background: '#e5e7eb', cursor: 'pointer', fontSize: 12 }}>回滚</button>
                </div>
              </div>
            ))}
          </div>
          {compareResult && (
            <div style={{ marginTop: 10, padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, maxHeight: '240px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ color: '#166534' }}>🔍 AI 版本对比分析</strong>
                <button onClick={() => { setCompareResult(''); setCompareVersionId(null) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{compareResult}</pre>
            </div>
          )}
        </div>
      </div>

      <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: 8, background: '#fff', marginBottom: 15 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h4 style={{ margin: 0 }}>📄 会议纪要</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={generateSummary} disabled={summaryLoading} style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4 }}>
              {summaryLoading ? '生成中...' : 'AI生成纪要'}
            </button>
            <button onClick={copySummary} disabled={!meetingSummary} style={{ padding: '6px 12px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 4 }}>复制</button>
            <button onClick={exportToWeCom} style={{ padding: '6px 12px', background: '#07c160', color: '#fff', border: 'none', borderRadius: 4 }}>企业微信</button>
          </div>
        </div>
        <pre style={{ background: '#f9f9f9', padding: '10px', borderRadius: 6, minHeight: '80px', maxHeight: '220px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
          {meetingSummary || '纪要将展示在这里...'}
        </pre>
      </div>

      <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: 8, background: '#fff', marginBottom: 15 }}>
        <h4 style={{ margin: '0 0 10px 0' }}>✅ 待办任务</h4>
        <div style={{ display: 'flex', gap: '8px', marginBottom: 10 }}>
          <input
            value={todoText}
            onChange={e => setTodoText(e.target.value)}
            placeholder="输入待办任务"
            style={{ flex: 1, padding: '6px', borderRadius: 4, border: '1px solid #ddd' }}
          />
          <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={{ padding: '6px', borderRadius: 4, border: '1px solid #ddd' }}>
            <option>全体成员</option>
            <option value={user.name}>{user.name}（我）</option>
            {onlineUserList.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
          </select>
          <button onClick={addTodo} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4 }}>添加</button>
          <button onClick={handleExtractTodos} disabled={extractTodoLoading} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4 }}>
            {extractTodoLoading ? '提取中...' : '🤖 AI提取待办'}
          </button>
        </div>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {todos.map((item, idx) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#f5f5f5', margin: '4px 0', borderRadius: 4 }}>
              <input type="checkbox" checked={item.done} onChange={() => toggleTodo(idx)} />
              <span style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
              <span style={{ fontSize: '12px', color: '#666' }}>{item.assignTo}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontSize: '14px' }}>
        基于 React + Tiptap + Yjs + AI 构建 | CVTE 高效协作 π
      </div>
    </div>
  )
}

export default App