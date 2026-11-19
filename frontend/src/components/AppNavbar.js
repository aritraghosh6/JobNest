import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import NotificationBell from "./NotificationBell";
import { OPEN_SIDEBAR_EVENT, START_TOUR_EVENT } from "./AppTour";
import { ROLES, ROLE_LABELS, initials } from "../utils/helpers";

const LINKS = {
  [ROLES.JOB_SEEKER]: [
    { to: "/dashboard", label: "Dashboard", icon: "grid" },
    { to: "/profile", label: "Profile", icon: "person" },
    { to: "/assessment", label: "Assessment", icon: "clipboard-check" },
    { to: "/jobs", label: "Jobs", icon: "briefcase" },
    { to: "/applications", label: "Applications", icon: "send-check" },
    { to: "/calendar", label: "Calendar", icon: "calendar3" },
    { to: "/saved", label: "Saved", icon: "bookmark-heart" },
    { to: "/ats-checker", label: "ATS Checker", icon: "file-earmark-check" },
    { to: "/network", label: "Network", icon: "people" },
    { to: "/messages", label: "Messages", icon: "chat-dots" },
  ],
  [ROLES.EMPLOYER]: [
    { to: "/dashboard", label: "Dashboard", icon: "grid" },
    { to: "/company", label: "Company", icon: "building" },
    { to: "/employer/jobs", label: "My Jobs", icon: "briefcase" },
    { to: "/calendar", label: "Calendar", icon: "calendar3" },
    { to: "/network", label: "Network", icon: "people" },
    { to: "/messages", label: "Messages", icon: "chat-dots" },
  ],
  [ROLES.ADMIN]: [{ to: "/admin", label: "Admin Panel", icon: "shield-lock" }],
};

// Marker the guided tour uses to find each sidebar link, e.g. "/employer/jobs" -> "nav-employer-jobs"
const tourId = (path) => `nav${path.replace(/\//g, "-")}`;

// The login and register pages already have their own Log in / Register tabs
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];
const DESKTOP = "(min-width: 992px)";
const STORAGE_KEY = "jobnest_sidebar_open";

const isDesktop = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia(DESKTOP).matches;

/** Desktop remembers the user's choice (open by default). Phones always start closed. */
function initialOpen() {
  if (!isDesktop()) return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function Brand({ to }) {
  return (
    <Link to={to} className="brand d-flex align-items-center fs-4">
      <span className="brand-mark" aria-hidden="true">
        <i className="bi bi-house-heart-fill" />
      </span>
      JobNest
    </Link>
  );
}

/** Sun / moon button that switches between light and dark mode. */
function ThemeButton({ isDark, onClick }) {
  return (
    <button
      type="button"
      className="btn btn-light icon-btn theme-btn"
      onClick={onClick}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      data-tour="theme"
    >
      <i key={isDark ? "moon" : "sun"} className={`bi bi-${isDark ? "sun-fill" : "moon-stars-fill"}`} aria-hidden="true" />
    </button>
  );
}

/**
 * Logged in: a slim top bar with a menu button that opens and closes a sidebar on the left.
 * Logged out: a simple top bar with the logo (and Log in / Join on public pages).
 */
export default function AppNavbar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [open, setOpen] = useState(initialOpen);
  const location = useLocation();
  const navigate = useNavigate();

  // Lets the page layout make room for the sidebar (see .has-sidebar in theme.css)
  useEffect(() => {
    const body = document.body.classList;
    body.toggle("has-sidebar", Boolean(user));
    body.toggle("sidebar-open", Boolean(user) && open);
    return () => body.remove("has-sidebar", "sidebar-open");
  }, [user, open]);

  // On phones the sidebar closes after choosing a page
  useEffect(() => {
    if (!isDesktop()) setOpen(false);
  }, [location.pathname]);

  // Escape closes the sidebar on phones
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !isDesktop()) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The guided tour opens the sidebar when it points at a menu item
  useEffect(() => {
    const openSidebar = () => setOpen(true);
    window.addEventListener(OPEN_SIDEBAR_EVENT, openSidebar);
    return () => window.removeEventListener(OPEN_SIDEBAR_EVENT, openSidebar);
  }, []);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (isDesktop()) {
        try {
          localStorage.setItem(STORAGE_KEY, String(next));
        } catch {
          /* storage unavailable: the choice lasts for this visit only */
        }
      }
      return next;
    });
  };

  if (!user) {
    return (
      <nav className="navbar app-navbar sticky-top py-2" aria-label="Main navigation">
        <div className="container">
          <Brand to="/" />
          <div className="d-flex align-items-center gap-2 ms-auto">
            <ThemeButton isDark={isDark} onClick={toggleTheme} />
            {!AUTH_PAGES.includes(location.pathname) && (
              <>
                <Link to="/login" className="btn btn-outline-primary">Log in</Link>
                <Link to="/register" className="btn btn-primary">Join JobNest</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    );
  }

  const links = LINKS[user.role] || [];

  return (
    <>
      <header className="app-topbar">
        <button
          type="button"
          className="btn btn-light sidebar-toggle"
          onClick={toggle}
          aria-controls="app-sidebar"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          title={open ? "Close menu" : "Open menu"}
        >
          <i className={`bi bi-${open ? "x-lg" : "list"}`} aria-hidden="true" />
        </button>
        <Brand to="/dashboard" />
        <div className="ms-auto d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-light icon-btn d-none d-sm-inline-flex"
            onClick={() => window.dispatchEvent(new Event(START_TOUR_EVENT))}
            aria-label="Replay the guided tour"
            title="Replay the guided tour"
            data-tour="help"
          >
            <i className="bi bi-question-circle" aria-hidden="true" />
          </button>
          <ThemeButton isDark={isDark} onClick={toggleTheme} />
          {/* One bell for messages, job alerts and application updates */}
          {user.role !== ROLES.ADMIN && <NotificationBell />}
          <span className="avatar" style={{ width: 34, height: 34, fontSize: "0.8rem" }} aria-hidden="true">
            {initials(user.name)}
          </span>
          <div className="lh-sm d-none d-sm-block">
            <div className="fw-semibold small">{user.name}</div>
            <div className="text-muted" style={{ fontSize: "0.75rem" }}>{ROLE_LABELS[user.role]}</div>
          </div>
        </div>
      </header>

      <aside id="app-sidebar" className={`app-sidebar ${open ? "open" : ""}`} aria-label="Main navigation" aria-hidden={!open}>
        <nav className="d-flex flex-column h-100">
          <ul className="nav flex-column gap-1 p-3">
            {links.map((link) => (
              <li className="nav-item" key={link.to}>
                <NavLink to={link.to} className="sidebar-link" tabIndex={open ? 0 : -1} data-tour={tourId(link.to)}>
                  <i className={`bi bi-${link.icon}`} aria-hidden="true" />
                  <span>{link.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-auto p-3 border-top">
            <button
              type="button"
              className="btn btn-outline-secondary w-100"
              tabIndex={open ? 0 : -1}
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <i className="bi bi-box-arrow-right me-2" aria-hidden="true" />
              Log out
            </button>
          </div>
        </nav>
      </aside>

      {/* Dark backdrop behind the sidebar on phones; tapping it closes the menu */}
      {open && <div className="sidebar-backdrop d-lg-none" onClick={() => setOpen(false)} aria-hidden="true" />}
    </>
  );
}
