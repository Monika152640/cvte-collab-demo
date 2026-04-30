import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEffect, useState } from 'react'
import './App.css'
import { getConflictMergeSuggestion } from './api.js'

// 随机用户（避免多人冲突，每个窗口独立生成）
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

  // 每个窗口独立创建 Yjs 实例
  const [ydoc] = useState(() => new Y.Doc())
  const [provider] = useState(() => 
    new WebsocketProvider('ws://localhost:1234', 'cvte-doc', ydoc)
  )

  // 👇 AI 冲突合并测试状态（我帮你加在这里）
  const [context, setContext] = useState('文档原始上下文：我今天去超市买了苹果')
  const [changeA, setChangeA] = useState('用户A修改：我今天去超市买了香蕉')
  const [changeB, setChangeB] = useState('用户B修改：我今天去菜市场买了苹果')
  const [aiResult, setAiResult] = useState('')
  const [loading, setLoading] = useState(false)

  const yFragment = ydoc.getXmlFragment('prosemirror')

  const editor = useEditor({
    editable: true,
    extensions: [
      StarterKit,
      Image,
      Collaboration.configure({
        document: ydoc,
        fragment: yFragment,
      }),
      CollaborationCursor.configure({
        provider,
        user,
      }),
    ],
    content: `
      <h2>CVTE 高效协作 π - AI 协同编辑器</h2>
      <p>支持多人实时同步 + 本地上传图片 + 富文本编辑 ✅</p>
    `,
  })

  // 👇 AI 测试调用函数（我帮你加在这里）
  const testAiMerge = async () => {
    setLoading(true)
    setAiResult('正在请求 AI 合并...')
    try {
      const res = await getConflictMergeSuggestion(context, changeA, changeB)
      setAiResult(res)
    } catch (err) {
      setAiResult('请求失败：' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // 清理连接
  useEffect(() => {
    return () => {
      provider.destroy()
      ydoc.destroy()
    }
  }, [provider, ydoc])

  // 本地图片上传
  const handleLocalImage = (e) => {
    const file = e.target.files[0]
    if (!file || !editor) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const imgUrl = evt.target.result
      editor.chain().focus().setImage({ src: imgUrl }).run()
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

      <div className="toolbar">
        <button 
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
          className="toolbar-btn"
        >
          标题
        </button>
        <button 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          className="toolbar-btn"
        >
          加粗
        </button>
        <button 
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          className="toolbar-btn"
        >
          斜体
        </button>
        <button 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          className="toolbar-btn"
        >
          列表
        </button>
        
        <button 
          onClick={() => editor.chain().focus().clearContent().run()} 
          className="toolbar-btn"
        >
          清空内容
        </button>

        <label className="toolbar-btn primary">
          🖼️ 本地上传图片
          <input
            type="file"
            accept="image/*"
            onChange={handleLocalImage}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="editor-wrapper">
        <EditorContent editor={editor} className="editor" />
      </div>

      {/* 👇 AI 测试区域（我帮你加在这里，在 footer 上方） */}
      <div className="ai-test-section" style={{ marginTop: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '8px' }}>
        <h3>🧪 AI 冲突合并测试</h3>

        <div style={{ marginBottom: '10px' }}>
          <label>文档上下文：</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows="2"
            style={{ width: '100%', padding: '8px', marginTop: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>用户 A 修改：</label>
          <textarea
            value={changeA}
            onChange={(e) => setChangeA(e.target.value)}
            rows="2"
            style={{ width: '100%', padding: '8px', marginTop: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>用户 B 修改：</label>
          <textarea
            value={changeB}
            onChange={(e) => setChangeB(e.target.value)}
            rows="2"
            style={{ width: '100%', padding: '8px', marginTop: '4px' }}
          />
        </div>

        <button
          onClick={testAiMerge}
          disabled={loading}
          className="toolbar-btn primary"
          style={{ margin: '10px 0' }}
        >
          {loading ? '请求中...' : '🚀 测试 AI 冲突合并'}
        </button>

        <div style={{ marginTop: '15px' }}>
          <h4>📄 AI 返回结果：</h4>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '12px', borderRadius: '6px' }}>
            {aiResult || '暂无结果'}
          </pre>
        </div>
      </div>

      <div className="footer">
        基于 React + Tiptap + Yjs 实时协同 | 当前用户：{user.name}
      </div>
    </div>
  )
}

export default App