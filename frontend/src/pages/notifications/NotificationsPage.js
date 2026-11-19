import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notificationApi } from "../../api/services";
import PageHeader from "../../components/PageHeader";
import FormAlert from "../../components/FormAlert";
import EmptyState from "../../components/EmptyState";
import {
  NOTIFICATION_META,
  NOTIFICATION_TABS,
  announceNotificationsChanged,
  formatDateTime,
  getErrorMessage,
  timeAgo,
} from "../../utils/helpers";

const isToday = (d) => new Date(d).toDateString() === new Date().toDateString();

/** Full list of the same notifications the bell shows, with the same filters. */
export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [counts, setCounts] = useState({ unread: 0, unread_by_category: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    return notificationApi
      .list({ limit: 100, unread: unreadOnly ? "true" : undefined, category: tab === "all" ? undefined : tab })
      .then((d) => {
        setItems(d.notifications);
        setCounts({ unread: d.unread, unread_by_category: d.unread_by_category || {} });
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [tab, unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const tabUnread = tab === "all" ? counts.unread : counts.unread_by_category[tab] || 0;

  const open = (n) => {
    if (!n.read) {
      notificationApi.markRead(n._id).then(announceNotificationsChanged).catch(() => {});
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead(tab === "all" ? undefined : tab);
      announceNotificationsChanged();
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const remove = async (id) => {
    try {
      await notificationApi.remove(id);
      setItems((list) => list.filter((n) => n._id !== id));
      announceNotificationsChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const groups = [
    { title: "Today", list: items.filter((n) => isToday(n.createdAt)) },
    { title: "Earlier", list: items.filter((n) => !isToday(n.createdAt)) },
  ].filter((g) => g.list.length);

  return (
    <div className="container py-4" style={{ maxWidth: 860 }}>
      <PageHeader
        icon="bell"
        title="Notifications"
        subtitle="Messages, job alerts and application updates, all in one place."
        actions={
          tabUnread > 0 && (
            <button type="button" className="btn btn-outline-primary" onClick={markAll}>
              <i className="bi bi-check2-all me-1" aria-hidden="true" />
              Mark all as read
            </button>
          )
        }
      />

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <div className="filter-pills" role="tablist" aria-label="Notification type">
          {NOTIFICATION_TABS.map((t) => {
            const count = t.key === "all" ? counts.unread : counts.unread_by_category[t.key] || 0;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`filter-pill ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                <i className={`bi bi-${t.icon} me-1`} aria-hidden="true" />
                {t.label}
                {count > 0 && <span className="count">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="form-check form-switch mb-0">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            id="unread-only"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="unread-only">Unread only</label>
        </div>
      </div>

      <FormAlert message={error} onClose={() => setError("")} />

      {loading && (
        <div className="jn-card p-3" aria-label="Loading notifications">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="notif-skeleton">
              <span className="skeleton-circle" />
              <span className="flex-grow-1">
                <span className="skeleton-line mb-2" style={{ width: "65%" }} />
                <span className="skeleton-line" style={{ width: "40%" }} />
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon={tab === "messages" ? "chat-square-heart" : "bell-slash"}
          title={unreadOnly ? "No unread notifications" : "No notifications here yet"}
          text="We'll let you know when something needs your attention."
        />
      )}

      {!loading &&
        groups.map((g) => (
          <section key={g.title} className="mb-4">
            <h2 className="section-label">{g.title}</h2>
            <div className="jn-card p-0 overflow-hidden stagger">
              {g.list.map((n) => {
                const meta = NOTIFICATION_META[n.type] || NOTIFICATION_META.system;
                return (
                  <div key={n._id} className={`notif-row cat-${meta.category} ${n.read ? "" : "unread"}`}>
                    <button type="button" className="notif-row-main" onClick={() => open(n)}>
                      <span className={`notif-icon bg-${meta.color}-subtle text-${meta.color}-emphasis`} aria-hidden="true">
                        <i className={`bi bi-${meta.icon}`} />
                      </span>
                      <span className="notif-text">
                        <span className="notif-type">{meta.label}</span>
                        <span className="notif-title">{n.title}</span>
                        {n.message && <span className="notif-msg full">{n.type === "message" ? `"${n.message}"` : n.message}</span>}
                        <time className="notif-time" dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>
                          {timeAgo(n.createdAt)}
                        </time>
                      </span>
                      {!n.read && <span className="notif-dot" aria-label="Unread" />}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-muted notif-remove"
                      onClick={() => remove(n._id)}
                      aria-label={`Remove notification: ${n.title}`}
                    >
                      <i className="bi bi-x-lg" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}
