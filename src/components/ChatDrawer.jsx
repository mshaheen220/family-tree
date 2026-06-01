import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import '../../styles/ChatDrawer.css';

export default function ChatDrawer({ rootId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [cleanups, setCleanups] = useState([]);
  const [showCleanups, setShowCleanups] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Connect to the Node.js Socket.io server
    socketRef.current = io('/', { transports: ['websocket'] });

    socketRef.current.on('connect', () => {
      console.log('Connected to Genealogy Agent AI');
    });

    // The server emits "answer" with formatted HTML (sources, cleanup tasks)
    socketRef.current.on('answer', (htmlMsg) => {
      setMessages(prev => [...prev, { role: 'ai', text: htmlMsg }]);
    });

    socketRef.current.on('cleanups-data', (data) => {
      setCleanups(data);
    });
    

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (!showCleanups) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, showCleanups]);

  useEffect(() => {
    if (isOpen && rootId) {
      socketRef.current.emit('get-cleanups', rootId);
    }
  }, [isOpen, rootId]);

  const sendMessage = () => {
    if (!input.trim()) return;

    // Add user message to UI
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    
    // Send text AND rootId to backend
    socketRef.current.emit('transcription', { text: input, rootId });
    
    setInput('');
  };
  
  const toggleCleanup = (id, currentStatus) => {
    socketRef.current.emit('toggle-cleanup', { id, completed: currentStatus ? 0 : 1, rootId });
  };

  const deleteCleanup = (id) => {
    socketRef.current.emit('delete-cleanup', { id, rootId });
  };

  return (
    <>
      <button className="chat-toggle-btn" onClick={() => setIsOpen(true)}>
        Ask AI 🤖
      </button>

      <div className={`chat-drawer ${isOpen ? 'open' : ''}`}>
        <div className="chat-drawer-header">
          <h2>Genealogy Agent</h2>
          <div className="header-actions">
            <button className="tab-btn" onClick={() => setShowCleanups(!showCleanups)}>
              {showCleanups ? '💬 Chat' : '🧹 Tasks'}
            </button>
            <button className="close-btn" onClick={() => setIsOpen(false)}>✕</button>
          </div>
        </div>
        
        <div className="chat-drawer-content">
          {showCleanups ? (
            <div className="cleanups-list">
              {cleanups.length === 0 ? <p className="empty-tasks">No cleanup tasks yet!</p> : null}
              {cleanups.map(c => (
                <div key={c.id} className={`cleanup-task ${c.completed ? 'completed' : ''}`}>
                  <input type="checkbox" checked={!!c.completed} onChange={() => toggleCleanup(c.id, c.completed)} />
                  <span dangerouslySetInnerHTML={{ __html: c.suggestion }}></span>
                  <button className="delete-task-btn" onClick={() => deleteCleanup(c.id)}>🗑️</button>
                </div>
              ))}
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.role}`}>
                  {msg.role === 'ai' ? (
                    <div dangerouslySetInnerHTML={{ __html: msg.text }} />
                  ) : (
                    <div>{msg.text}</div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="chat-drawer-input">
          <input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={`Ask about ${rootId ? rootId.replace(/@/g, '') : 'your family'}...`} 
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </>
  );
}