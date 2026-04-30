import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
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

  // 这里是修复关键！必须用 prosemirror 不能用 document
  const yFragment = ydoc.getXmlFragment('prosemirror')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      Collaboration.configure({
        document: ydoc,
        fragment: yFragment,
      }),
      CollaborationCursor.configure({
        provider,
        user: { name: '测试用户', color: '#ff0000' },
      }),
    ],
    // 给一个默认内容，确保编辑器一定能显示！
    content: `<p>我现在能正常编辑啦！多窗口同步成功！</p>`,
  })

  return (
    <div className="app">
      <h1>CVTE 高效协作 π - 实时协同编辑</h1>
      <div className="editor-container">
        <EditorContent editor={editor} className="editor" />
      </div>
    </div>
  )
}

export default App