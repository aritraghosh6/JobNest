import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { notificationApi } from "../api/services";
import {
  NOTIFICATION_META,
  NOTIFICATION_TABS,
  NOTIFICATIONS_CHANGED,
  getErrorMessage,
  timeAgo,
  formatDateTime,
} from "../utils/helpers";

const POLL_MS = 30000;
const CLOSE_MS = 160; // matches the .notif-panel.closing animation in theme.css
const EMPTY_COUNTS = { messages: 0, jobs: 0, applications: 0 };

const EMPTY_TEXT = {
  all: "You're all caught up. New messages, job alerts and application updates will appear here.",
  messages: "No message notifications. When someone sends you a message, it will appear here.",
  jobs: "No job alerts yet. Follow companies to hear when they post new jobs.",
  applications: "No application updates yet.",
};

/**
 * The one notification centre for the whole app: messages, job alerts and application
 * updates share a single bell, a single unread count and a single panel.
 * The tabs only filter the list.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState("all");
  const [unread, setUnread] = useState(0);
  const [byCategory, setByCategory] = useState(EMPTY_COUNTS);
  const [items, setItems] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [bump, setBump] = useState(false);
  const [freshIds, setFreshIds] = useState(() => new Set());

  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const lastCount = useRef(0);
  const knownIds = useRef(new Set());
  const openRef = useRef(false);
  const tabRef = useRef("all");
  const navigate = useNavigate();
  const location = useLocation();

  openRef.current = open;
  tabRef.current = tab;

  const applyCounts = useCallback((d) => {
    if (typeof d.unread !== "number") return;
    if (d.unread > lastCount.current) {
      setBump(true);
      setTimeout(() => setBump(false), 700);
    }
    lastCount.current = d.unread;
    setUnread(d.unread);
    setByCategory(d.unread_by_category || EMPTY_COUNTS);
  }, []);

  const loadList = useCallback(
    (which = tabRef.current, { quiet = false } = {}) => {
      if (!quiet) {
        setItems(null);
        setError("");
      }
      return notificationApi
        .list({ limit: 15, category: which === "all" ? undefined : which })
        .then((d) => {
          if (which !== tabRef.current) return; // the user switched tab meanwhile
          // Highlight notifications that arrived while the panel was open
          const fresh = new Set(knownIds.current.size ? d.notifications.filter((n) => !knownIds.current.has(n._id)).map((n) => n._id) : []);
          d.notifications.forEach((n) => knownIds.current.add(n._id));
          setFreshIds(fresh);
          setItems(d.notifications);
          setError("");
          applyCounts(d);
        })
        .catch((err) => {
          if (!quiet) setError(getErrorMessage(err, "We couldn't load your notifications."));
        });
    },
    [applyCounts]
  );

  const refreshCount = useCallback(() => {
    notificationApi
      .unreadCount()
      .then((d) => {
        const grew = d.unread > lastCount.current;
        applyCounts(d);
        if (grew && openRef.current) loadList(tabRef.current, { quiet: true });
      })
      .catch(() => {});
  }, [applyCounts, loadList]);

  // Poll every 30 seconds, when the tab becomes visible again, and when another page asks
  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refreshCount();
    window.addEventListener(NOTIFICATIONS_CHANGED, refreshCount);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refreshCount);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshCount]);

  // A page change can read messages (e.g. opening a conversation), so check again shortly after
  useEffect(() => {
    refreshCount();
    const id = setTimeout(refreshCount, 1500);
    return () => clearTimeout(id);
  }, [location.pathname, refreshCount]);

  const close = useCallback((returnFocus = false) => {
    if (!openRef.current) return;
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      if (returnFocus) buttonRef.current?.focus();
    }, CLOSE_MS);
  }, []);

  useEffect(() => close(), [location.pathname, close]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && close();
    const onKey = (e) => e.key === "Escape" && close(true);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const toggle = () => {
    if (open) return close();
    knownIds.current = new Set();
    setOpen(true);
    loadList(tab);
  };

  const switchTab = (key) => {
    if (key === tab) return;
    setTab(key);
    tabRef.current = key;
    loadList(key);
  };

  const openItem = (n) => {
    if (!n.read) {
      notificationApi.markRead(n._id).then(refreshCount).catch(() => {});
      setItems((list) => (list || []).map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      lastCount.current = Math.max(0, lastCount.current - 1);
    }
    close();
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead(tab === "all" ? undefined : tab);
      setItems((list) => (list || []).map((n) => ({ ...n, read: true })));
      refreshCount();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const tabUnread = tab === "all" ? unread : byCategory[tab] || 0;

  return (
    <div className="notif-wrap" ref={wrapRef} data-tour="bell">
      <button
        ref={buttonRef}
        type="button"
        className={`btn btn-light icon-btn ${bump ? "bump" : ""}`}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        title="Notifications"
      >
        <i className={`bi bi-bell${unread ? "-fill" : ""}`} aria-hidden="true" />
        {unread > 0 && (
          <span key={unread} className="notif-count" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`notif-panel ${closing ? "closing" : "opening"}`} role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <div className="d-flex align-items-center gap-2">
              <strong>Notifications</strong>
              {unread > 0 && <span className="notif-head-count">{unread} new</span>}
            </div>
            {tabUnread > 0 && (
              <button type="button" className="btn btn-link btn-sm p-0" onClick={markAll}>
                <i className="bi bi-check2-all me-1" aria-hidden="true" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="notif-tabs" role="tablist" aria-label="Filter notifications">
            {NOTIFICATION_TABS.map((t) => {
              const count = t.key === "all" ? unread : byCategory[t.key] || 0;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`notif-tab ${tab === t.key ? "active" : ""}`}
                  onClick={() => switchTab(t.key)}
                >
                  {t.label}
                  {count > 0 && <span className="notif-tab-count">{count > 99 ? "99+" : count}</span>}
                </button>
              );
            })}
          </div>

          <div className="notif-list" aria-live="polite" aria-busy={items === null}>
            {items === null && !error && (
              <div className="p-3" aria-label="Loading notifications">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="notif-skeleton">
                    <span className="skeleton-circle" />
                    <span className="flex-grow-1">
                      <span className="skeleton-line mb-2" style={{ width: "70%" }} />
                      <span className="skeleton-line" style={{ width: "45%" }} />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="text-center p-4">
                <i className="bi bi-wifi-off fs-3 d-block mb-2 text-danger" aria-hidden="true" />
                <p className="small text-muted mb-2">{error}</p>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => loadList(tab)}>
                  Try again
                </button>
              </div>
            )}

            {items && items.length === 0 && !error && (
              <div className="notif-empty">
                <span className="notif-empty-icon" aria-hidden="true">
                  <i className={`bi bi-${tab === "messages" ? "chat-square-heart" : "bell-slash"}`} />
                </span>
                <p className="mb-0 small text-muted">{EMPTY_TEXT[tab]}</p>
              </div>
            )}

            {items?.map((n) => {
              const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.system;
              return (
                <button
                  key={n._id}
                  type="button"
                  className={`notif-item cat-${meta.category} ${n.read ? "" : "unread"} ${freshIds.has(n._id) ? "is-new" : ""}`}
                  onClick={() => openItem(n)}
                >
                  <span className={`notif-icon bg-${meta.color}-subtle text-${meta.color}-emphasis`} aria-hidden="true">
                    <i className={`bi bi-${meta.icon}`} />
                  </span>
                  <span className="notif-text">
                    <span className="notif-type">{meta.label}</span>
                    <span className="notif-title">{n.title}</span>
                    {n.message && <span className="notif-msg">{n.type === "message" ? `"${n.message}"` : n.message}</span>}
                    <time className="notif-time" dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>
                      {timeAgo(n.createdAt)}
                    </time>
                  </span>
                  {!n.read && <span className="notif-dot" aria-label="Unread" />}
                </button>
              );
            })}
          </div>

          <Link to="/notifications" className="notif-foot" onClick={() => close()}>
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
