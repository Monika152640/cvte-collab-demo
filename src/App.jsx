import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import './App.css'

// 随机用户（避免多人冲突）
const users = [
  { name: '用户A', color: '#ff5555' },
  { name: '用户B', color: '#55ff55' },
  { name: '用户C', color: '#5555ff' },
]
const currentUser = users[Math.floor(Math.random() * users.length)]

function App() {
  const ydoc = new Y.Doc()

  const provider = new WebsocketProvider(
    'ws://localhost:1234',
    'cvte-doc',
    ydoc
  )

  const yFragment = ydoc.getXmlFragment('prosemirror')

  const editor = useEditor({
    editable: true,
    extensions: [
      StarterKit.configure({ history: false }),
      Image,
      Collaboration.configure({ document: ydoc, fragment: yFragment }),
      CollaborationCursor.configure({ provider, user: currentUser }),
    ],
    content: `
      <h2>CVTE 高效协作 π - AI 协同编辑器</h2>
      <p>支持多人实时同步 + 本地上传图片 + 富文本编辑 ✅</p>
    `,
  })

  // ✅ 本地上传图片核心函数
  const handleLocalImage = (e) => {
    const file = e.target.files[0]
    if (!file || !editor) return

    // 把本地图片转成可插入编辑器的 URL
    const reader = new FileReader()
    reader.onload = (evt) => {
      const imgUrl = evt.target.result
      editor.chain().focus().setImage({ src: imgUrl }).run()
    }
    reader.readAsDataURL(file)

    // 重置 file input，支持重复选同一张图
    e.target.value = ''
  }

  if (!editor) return null

  return (
    <div className="app">
      <div className="header">
        <h1>📝 CVTE 高效协作 π</h1>
        <p>多人实时协作文档助手</p>
      </div>

      <div className="toolbar">
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="toolbar-btn">标题</button>
        <button onClick={() => editor.chain().focus().toggleBold().run()} className="toolbar-btn">加粗</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className="toolbar-btn">斜体</button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className="toolbar-btn">列表</button>
        
        {/* ✅ 本地图片上传按钮 */}
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
        基于 React + Tiptap + Yjs 实时协同
      </div>
    </div>
  )
}

export default App