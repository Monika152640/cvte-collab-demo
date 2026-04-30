import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEffect, useState } from 'react'
import './App.css'

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

  const yFragment = ydoc.getXmlFragment('prosemirror')

  const editor = useEditor({
    editable: true,
    extensions: [
      // 去掉 history: false，让编辑器自己处理基础状态
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

  // 清理 provider 连接，避免窗口关闭/刷新时的残留状态
  useEffect(() => {
    return () => {
      provider.destroy()
      ydoc.destroy()
    }
  }, [provider, ydoc])

  // 本地图片上传函数
  const handleLocalImage = (e) => {
    const file = e.target.files[0]
    if (!file || !editor) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const imgUrl = evt.target.result
      editor.chain().focus().setImage({ src: imgUrl }).run()
    }
    reader.readAsDataURL(file)

    // 重置 input，支持重复选同一张图
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

      <div className="footer">
        基于 React + Tiptap + Yjs 实时协同 | 当前用户：{user.name}
      </div>
    </div>
  )
}

export default App