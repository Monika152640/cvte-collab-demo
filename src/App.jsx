import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import './App.css'

function App() {
  const ydoc = new Y.Doc()

  const provider = new WebsocketProvider(
    'ws://localhost:1234',
    'cvte-doc',
    ydoc
  )

  const yFragment = ydoc.getXmlFragment('prosemirror')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      Image,
      Collaboration.configure({
        document: ydoc,
        fragment: yFragment,
      }),
      CollaborationCursor.configure({
        provider,
        user: { name: '协作用户', color: '#ff5555' },
      }),
    ],
    content: `
      <h2>CVTE 高效协作 π - AI 协同编辑器</h2>
      <p>支持多人实时同步 + 图片上传 + 富文本编辑 ✅</p>
    `,
  })

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
        <button onClick={() => editor.chan().focus().toggleBulletList().run()} className="toolbar-btn">列表</button>
        
        <button onClick={() => {
          const url = prompt('输入图片 URL：')
          if (url) editor.chain().focus().setImage({ src: url }).run()
        }} className="toolbar-btn primary">📎 插入图片</button>
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