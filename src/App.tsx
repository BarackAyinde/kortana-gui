import TopBar from './canvas/TopBar'
import CanvasZone from './canvas/CanvasZone'
import ChatSidebar from './sidebar/ChatSidebar'

export default function App() {
  return (
    <div className="app-shell">
      <TopBar />
      <div className="workspace">
        <CanvasZone />
        <ChatSidebar />
      </div>
    </div>
  )
}
