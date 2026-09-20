import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import {
  Conversation,
  createConversation,
  Document,
  fileIconLabel,
  getConversation,
  listConversations,
  listDocuments,
  sendMessage,
} from "../api";

interface Message {
  question: string;
  answer: string;
}

export default function ChatPage() {
  const { token, clearAuth } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Null activeConversationId means "fresh, unsaved chat" — the state you
  // always land on when opening this page, per the fresh-screen requirement.
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeDocLabel, setActiveDocLabel] = useState<string>("All documents");
  const [draftDocId, setDraftDocId] = useState<string>("all");

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    listDocuments(token).then(setDocuments).catch(() => {});
    refreshConversations();
  }, [token]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function refreshConversations() {
    if (!token) return;
    listConversations(token).then(setConversations).catch(() => {});
  }

  function startNewChat() {
    setActiveConversationId(null);
    setActiveDocLabel("All documents");
    setDraftDocId("all");
    setMessages([]);
    setError("");
  }

  async function openConversation(id: string) {
    if (!token) return;
    setError("");
    try {
      const conv = await getConversation(token, id);
      setActiveConversationId(conv._id);
      setActiveDocLabel(conv.documentLabel);
      setMessages(conv.messages.map((m) => ({ question: m.question, answer: m.answer })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that conversation.");
    }
  }

  async function handleAsk() {
    if (!question.trim() || !token) return;

    setAsking(true);
    setError("");
    const currentQuestion = question;
    setQuestion("");

    try {
      let conversationId = activeConversationId;

      // First message of a fresh chat: create the conversation now, locked
      // to whatever document is currently selected in the draft picker.
      if (!conversationId) {
        const conv = await createConversation(token, draftDocId === "all" ? undefined : draftDocId);
        conversationId = conv._id;
        setActiveConversationId(conv._id);
        setActiveDocLabel(conv.documentLabel);
      }

      const data = await sendMessage(token, conversationId, currentQuestion);
      setMessages((prev) => [...prev, { question: currentQuestion, answer: data.answer }]);
      refreshConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get an answer.");
    } finally {
      setAsking(false);
    }
  }

  function handleLogout() {
    clearAuth();
    navigate("/");
  }

  return (
    <div className="chat-shell">
      <div className="chat-sidebar">
        <button className="new-chat-btn" onClick={startNewChat}>
          + New chat
        </button>
        {conversations.length === 0 ? (
          <p className="empty-state" style={{ fontSize: "0.8rem" }}>
            No saved chats yet.
          </p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv._id}
              className={`conversation-item${conv._id === activeConversationId ? " active" : ""}`}
              onClick={() => openConversation(conv._id)}
            >
              {conv.title || "New conversation"}
              <span className="conversation-doc-tag">{conv.documentLabel}</span>
            </div>
          ))
        )}
      </div>

      <div className="chat-main">
        <div className="chat-topbar">
          <h1 className="chat-title">Ask your shelf</h1>
          <div className="nav-links">
            {activeConversationId ? (
              <span className="doc-picker">Asking about: {activeDocLabel}</span>
            ) : (
              <div className="doc-picker">
                <span>Asking about</span>
                <select value={draftDocId} onChange={(e) => setDraftDocId(e.target.value)}>
                  <option value="all">All documents</option>
                  {documents.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      [{fileIconLabel(doc.mimeType)}] {doc.filename}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button className="nav-link-btn" onClick={() => navigate("/upload")}>
              Add documents
            </button>
            <button className="nav-link-btn" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>

        <div className="chat-scroll" ref={scrollRef}>
          <div className="chat-scroll-inner">
            {documents.length === 0 ? (
              <p className="empty-chat">
                Your shelf is empty.{" "}
                <button className="text-button" onClick={() => navigate("/upload")}>
                  Upload a document
                </button>{" "}
                to start asking questions.
              </p>
            ) : messages.length === 0 ? (
              <p className="empty-chat">
                {activeConversationId
                  ? "No messages yet."
                  : "Choose a document above, then ask something to start a new chat."}
              </p>
            ) : (
              messages.map((msg, i) => (
                <div key={i}>
                  <div className="bubble-row user">
                    <div className="bubble user">{msg.question}</div>
                  </div>
                  <div className="bubble-row">
                    <div className="bubble assistant">
                      {msg.answer}
                      <span className="bubble-source">Scoped to: {activeDocLabel}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
            {error && <p className="error-text">{error}</p>}
          </div>
        </div>

        <div className="chat-composer">
          <div className="chat-composer-inner">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="Ask something about your documents"
              disabled={asking || documents.length === 0}
            />
            <button
              className="primary"
              onClick={handleAsk}
              disabled={asking || !question.trim() || documents.length === 0}
            >
              {asking ? "Thinking..." : "Ask"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
