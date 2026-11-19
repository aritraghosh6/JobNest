import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { messageApi, networkApi } from '../../api/services';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import FormAlert from '../../components/FormAlert';
import EmptyState from '../../components/EmptyState';
import { formatDateTime, getErrorMessage, initials } from '../../utils/helpers';

const POLL_MS = 5000; // new messages are fetched every 5 seconds (no real-time server needed)

function Thread({ userId }) {
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const load = useCallback(
    () =>
      messageApi
        .thread(userId)
        .then(setThread)
        .catch((err) => setError(getErrorMessage(err))),
    [userId]
  );

  useEffect(() => {
    setThread(null);
    setError('');
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return setError('Message cannot be empty.');
    if (body.length > 1000) return setError('Message cannot exceed 1000 characters.');
    setSending(true);
    setError('');
    try {
      await messageApi.send(userId, body);
      setText('');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (!thread && !error) return <Loader text="Loading conversation…" />;

  return (
    <div className="jn-card d-flex flex-column h-100">
      {thread && (
        <div className="p-3 border-bottom d-flex align-items-center gap-2">
          <span className="avatar" aria-hidden="true">{initials(thread.user.name)}</span>
          <div>
            <div className="fw-semibold">{thread.user.name}</div>
            <div className="small text-muted">{thread.user.headline}</div>
          </div>
        </div>
      )}
      <div className="chat-window p-3" aria-live="polite" aria-label="Conversation">
        {thread?.messages.length === 0 && <p className="text-muted text-center small mt-4">No messages yet. Say hello!</p>}
        {thread?.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.from_me ? 'me' : 'them'}`}>
            <div>{m.message}</div>
            <div className="small opacity-75 mt-1" style={{ fontSize: '0.7rem' }}>
              {formatDateTime(m.createdAt)}
              {m.from_me && m.read_at && ' · Seen'}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-top">
        <FormAlert message={error} onClose={() => setError('')} />
        {thread && !thread.can_message ? (
          <p className="small text-muted mb-0">You are no longer connected with this user, so you cannot send new messages.</p>
        ) : (
          <form className="d-flex gap-2" onSubmit={send}>
            <label htmlFor="message-input" className="visually-hidden">Type a message</label>
            <textarea
              id="message-input"
              className="form-control"
              rows={1}
              maxLength={1000}
              placeholder="Type a message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) send(e);
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={sending} aria-label="Send message">
              {sending ? <Loader small /> : <i className="bi bi-send" aria-hidden="true" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () =>
      Promise.all([messageApi.conversations(), networkApi.connections()])
        .then(([c, n]) => {
          setConversations(c.conversations);
          setConnections(n.connections);
        })
        .catch((err) => setError(getErrorMessage(err)))
        .finally(() => setLoading(false));
    load();
    const id = setInterval(load, POLL_MS * 3);
    return () => clearInterval(id);
  }, [userId]);

  if (loading) return <Loader text="Loading messages…" />;

  const withConversation = new Set(conversations.map((c) => String(c.user.id)));
  const newChats = connections.filter((c) => !withConversation.has(String(c.user.id)));

  return (
    <div className="container py-4">
      <PageHeader icon="chat-dots" title="Messages" subtitle="Private conversations with your connections." />
      <FormAlert message={error} onClose={() => setError('')} />
      {conversations.length === 0 && connections.length === 0 ? (
        <EmptyState icon="chat-dots" title="No conversations yet" text="You can message people once they accept your connection request." action={<Link to="/network" className="btn btn-primary">Find people</Link>} />
      ) : (
        <div className="row g-3">
          <div className="col-md-4">
            <div className="jn-card p-2">
              <h2 className="h6 fw-bold px-2 pt-2">Conversations</h2>
              {conversations.length === 0 && <p className="small text-muted px-2">No messages yet.</p>}
              {conversations.map((c) => (
                <button
                  type="button"
                  key={c.user.id}
                  className={`conversation-item w-100 text-start border-0 bg-transparent p-2 d-flex gap-2 align-items-center ${String(userId) === String(c.user.id) ? 'active' : ''}`}
                  onClick={() => navigate(`/messages/${c.user.id}`)}
                >
                  <span className="avatar" aria-hidden="true">{initials(c.user.name)}</span>
                  <span className="flex-grow-1 overflow-hidden">
                    <span className="d-flex justify-content-between">
                      <span className="fw-semibold">{c.user.name}</span>
                      {c.unread > 0 && <span className="badge rounded-pill text-bg-warning">{c.unread}<span className="visually-hidden"> unread</span></span>}
                    </span>
                    <span className="small text-muted d-block text-truncate">
                      {c.last_message.from_me ? 'You: ' : ''}{c.last_message.message}
                    </span>
                  </span>
                </button>
              ))}
              {newChats.length > 0 && (
                <>
                  <h2 className="h6 fw-bold px-2 pt-3">Start a conversation</h2>
                  {newChats.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className={`conversation-item w-100 text-start border-0 bg-transparent p-2 d-flex gap-2 align-items-center ${String(userId) === String(c.user.id) ? 'active' : ''}`}
                      onClick={() => navigate(`/messages/${c.user.id}`)}
                    >
                      <span className="avatar" aria-hidden="true">{initials(c.user.name)}</span>
                      <span className="fw-semibold">{c.user.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="col-md-8">
            {userId ? <Thread userId={userId} /> : <EmptyState icon="chat-left-text" title="Select a conversation" text="Choose a person on the left to read or send messages." />}
          </div>
        </div>
      )}
    </div>
  );
}
