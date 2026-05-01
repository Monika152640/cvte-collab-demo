import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { CommentExtension } from '@sereneinserenade/tiptap-comment-extension'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEffect, useState } from 'react'
import './App.css'
import { getConflictMergeSuggestion } from './api.js'

// 随机用户
const userList = [
  { name: '用户A', color: '#ff5555' },
  { name: '用户B', color: '#55ff55' },
  { name: '用户C', color: '#5555ff' },
  { name: '用户D', color: '#ffaa00' },
  { name: '用户E', color: '#aa55ff' },
]

function App() {
  const [user] = useState(() =>
    userList[Math.floor(Math.random() * userList.length)]
  )

  const [ydoc] = useState(() => new Y.Doc())
  const [provider] = useState(() =>
    new WebsocketProvider('wss://cvte-collab-demo-production.up.railway.app', 'cvte-doc', ydoc)
  )

  // 🔥 用 Yjs 存储评论内容（这样所有人都能看到）
  const [commentMap] = useState(() => ydoc.getMap('comments'))

  // AI 测试状态
  const [context, setContext] = useState('原始内容：我今天去超市买了苹果')
  const [changeA, setChangeA] = useState('用户A：我今天去超市买了香蕉')
  const [changeB, setChangeB] = useState('用户B：我今天去菜市场买了苹果')
  const [aiResult, setAiResult] = useState('')
  const [loading, setLoading] = useState(false)

  // 评论系统状态
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState([])
  
  // 🔥 监听 Yjs 中的评论变化
  useEffect(() => {
    const handleMapChange = () => {
      const allComments = []
      commentMap.forEach((value, key) => {
        allComments.push({ id: key, ...value })
      })
      // 按时间排序
      allComments.sort((a, b) => new Date(a.time) - new Date(b.time))
      setComments(allComments)
    }
    
    // 初始加载
    handleMapChange()
    
    // 监听变化
    commentMap.observe(handleMapChange)
    
    return () => {
      commentMap.unobserve(handleMapChange)
    }
  }, [commentMap])

  const yFragment = ydoc.getXmlFragment('prosemirror')

  const editor = useEditor({
    editable: true,
    extensions: [
      StarterKit,
      Image,
      CommentExtension.configure({
        userId: user.name,
        userName: user.name,
        userColor: user.color,
        onCommentActivated: (commentId) => {
          console.log('评论激活:', commentId)
        }
      }),
      Collaboration.configure({ document: ydoc, fragment: yFragment }),
      CollaborationCursor.configure({ provider, user }),
    ],
    content: `
      <h2>CVTE 高效协作 π - AI 协同编辑器</h2>
      <p>支持多人实时同步 + 评论批注 + 会议模拟 + AI 冲突合并 ✅</p>
      <p>选中文字，点击【添加评论】即可模拟会议批注 🎯</p>
    `,
  })

  // 🔥 添加评论（存入 Yjs，所有人可见）
  const addComment = () => {
    if (!editor || !commentText) return
    
    // 检查是否选中了文字
    const { from, to } = editor.state.selection
    if (from === to) {
      alert('请先选中要评论的文字')
      return
    }
    
    // 生成唯一ID
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 获取选中的文字
    const selectedText = editor.state.doc.textBetween(from, to, ' ')
    
    // 先添加评论标注到编辑器
    editor.commands.setComment(commentId)
    
    // 🔥 将评论内容存到 Yjs Map（所有人都会看到）
    commentMap.set(commentId, {
      text: commentText,
      user: user.name,
      color: user.color,
      time: new Date().toLocaleTimeString(),
      selectedText: selectedText,
      userId: user.name
    })
    
    setCommentText('')
  }

  // AI 冲突合并
  const testAiMerge = async () => {
    setLoading(true)
    setAiResult('请求中...')
    try {
      const res = await getConflictMergeSuggestion(context, changeA, changeB)
      setAiResult(res)
    } catch (err) {
      setAiResult('失败：' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    return () => { provider.destroy(); ydoc.destroy() }
  }, [provider, ydoc])

  // 图片上传
  const handleLocalImage = (e) => {
    const file = e.target.files[0]
    if (!file || !editor) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      editor.chain().focus().setImage({ src: evt.target.result }).run()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  if (!editor) return null

  return (
    <div className="app">
      <div className="header">
        <h1>📝 CVTE 高效协作 π</h1>
        <p>多人实时协作文档助手 - 当前用户：{user.name}</p>
      </div>

      {/* 工具栏 */}
      <div className="toolbar">
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="toolbar-btn">标题</button>
        <button onClick={() => editor.chain().focus().toggleBold().run()} className="toolbar-btn">加粗</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className="toolbar-btn">斜体</button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className="toolbar-btn">列表</button>
        <button onClick={() => editor.chain().focus().clearContent().run()} className="toolbar-btn">清空</button>

        <label className="toolbar-btn primary">
          🖼️ 本地上传图片
          <input type="file" accept="image/*" onChange={handleLocalImage} style={{ display: 'none' }} />
        </label>

        <button onClick={addComment} className="toolbar-btn" style={{background:'#6366f1',color:'white'}}>
          💬 选中文字加评论
        </button>
      </div>

      {/* 快速添加会议评论 */}
      <div style={{padding:'10px',maxWidth:'900px',margin:'0 auto',display:'flex',gap:8}}>
        <input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="写下会议评论..."
          style={{flex:1,padding:'8px'}}
        />
        <button onClick={addComment} style={{padding:'8px 16px',background:'#6366f1',color:'white',borderRadius:6}}>
          ➕ 添加会议评论
        </button>
      </div>

      {/* 编辑器 */}
      <div className="editor-wrapper">
        <EditorContent editor={editor} className="editor" />
      </div>

      {/* 🔥 会议评论列表展示 - 所有用户共享 */}
      <div style={{maxWidth:'900px',margin:'10px auto',padding:'10px',border:'1px solid #eee',borderRadius:8}}>
        <h4>🗣️ 实时会议评论 ({comments.length})</h4>
        {comments.map((c) => (
          <div key={c.id} style={{margin:'5px 0',padding:'6px 10px',background:'#f9f9f9',borderRadius:4,borderLeft:'4px solid '+c.color}}>
            <strong style={{color:c.color}}>{c.user}</strong> {c.time}
            {c.selectedText && (
              <div style={{fontSize:'12px',color:'#666',margin:'4px 0',fontStyle:'italic'}}>
                📍 选中文字：「{c.selectedText}」
              </div>
            )}
            <p style={{margin:0}}>{c.text}</p>
          </div>
        ))}
      </div>

      {/* AI 冲突合并测试 */}
      <div className="ai-test-section" style={{ padding: '15px', border: '1px solid #eee', borderRadius: '8px',maxWidth:'900px',margin:'10px auto' }}>
        <h3>🧪 AI 冲突合并测试</h3>
        <textarea value={context} onChange={(e) => setContext(e.target.value)} rows="2" style={{ width: '100%', marginBottom: 8 }} />
        <textarea value={changeA} onChange={(e) => setChangeA(e.target.value)} rows="2" style={{ width: '100%', marginBottom: 8 }} />
        <textarea value={changeB} onChange={(e) => setChangeB(e.target.value)} rows="2" style={{ width: '100%', marginBottom: 8 }} />
        <button onClick={testAiMerge} disabled={loading} style={{ padding: '8px 16px' }}>
          {loading ? '请求中...' : '🚀 测试 AI 合并'}
        </button>
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6 }}>{aiResult}</pre>
      </div>

      <div className="footer">
        基于 React + Tiptap + Yjs 实时协同 | 当前用户：{user.name}
      </div>
    </div>
  )
}

export default App