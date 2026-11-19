import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../utils/helpers";

/**
 * Interactive tour shown once, on a user's first visit after logging in.
 * Steps differ for job seekers, employers and admins. Next / Back / Skip,
 * and it can be replayed any time from the "?" button in the top bar.
 *
 * Each step points at an element marked with data-tour="..." (sidebar links, bell, theme button...).
 * If that element isn't on screen, the step is shown in the middle of the page instead.
 */
export const START_TOUR_EVENT = "jobnest:start-tour";
export const OPEN_SIDEBAR_EVENT = "jobnest:open-sidebar";

const doneKey = (user) => `jobnest_tour_done_${user.id || user._id}`;
const HIDDEN_ON = ["/onboarding", "/login", "/register", "/forgot-password"];

const COMMON_END = [
  { target: "bell", title: "One place for every update", text: "New messages, job alerts and application updates all arrive here. Use the tabs to filter them." },
  { target: "theme", title: "Light or dark", text: "Switch between light and dark mode. We'll remember your choice." },
  { target: "help", title: "Need a refresher?", text: "You can replay this tour any time from here." },
];

const STEPS = {
  [ROLES.JOB_SEEKER]: [
    { title: "Welcome to JobNest", text: "Let's take a one-minute look around so you know where everything is." },
    { target: "nav-profile", title: "Your profile", text: "Add your skills, experience and CV. A complete profile gives you better job matches." },
    { target: "nav-assessment", title: "Culture assessment", text: "A short questionnaire about how you like to work. It improves your match scores." },
    { target: "nav-jobs", title: "Jobs matched to you", text: "Browse jobs ranked by how well they fit your skills and preferences, then apply in a few clicks." },
    { target: "nav-applications", title: "Track your applications", text: "See every stage of each application, from review to interview to decision." },
    { target: "nav-saved", title: "Saved jobs and companies", text: "Jobs you've saved and companies you follow. Followed companies alert you when they post a new job." },
    { target: "nav-messages", title: "Messages", text: "Chat with your connections and employers." },
    ...COMMON_END,
    { target: "chatbot", title: "Meet Sparrow, your assistant", text: "Have a question? Sparrow can check your applications, suggest jobs and take you to the right page." },
  ],
  [ROLES.EMPLOYER]: [
    { title: "Welcome to JobNest", text: "Here's a quick tour of the tools for finding the right candidates." },
    { target: "nav-company", title: "Company profile", text: "Tell candidates about your company and get verified so your jobs can be published." },
    { target: "nav-employer-jobs", title: "Your jobs", text: "Post and edit jobs, set an applicant limit, and review everyone who applied." },
    { target: "nav-network", title: "Network", text: "Connect with candidates and other professionals." },
    { target: "nav-messages", title: "Messages", text: "Talk to candidates you're connected with." },
    ...COMMON_END,
  ],
  [ROLES.ADMIN]: [
    { title: "Welcome, administrator", text: "A quick look at where to manage JobNest." },
    { target: "nav-admin", title: "Admin panel", text: "Verify employers, moderate jobs and manage user accounts." },
    COMMON_END[1],
    COMMON_END[2],
  ],
};

const PAD = 8;
const CARD_W = 340;

function placeCard(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - 24);
  if (!rect) return { top: Math.max(16, vh / 2 - 110), left: (vw - width) / 2, width, arrow: null };
  const clampX = (x) => Math.min(Math.max(12, x), vw - width - 12);
  const clampY = (y) => Math.min(Math.max(12, y), vh - 220);
  if (rect.right + 16 + width < vw && rect.left < vw / 2) {
    return { top: clampY(rect.top - 8), left: rect.right + 16, width, arrow: "left" };
  }
  if (rect.bottom + 230 < vh) return { top: rect.bottom + 14, left: clampX(rect.left + rect.width / 2 - width / 2), width, arrow: "top" };
  return { top: clampY(rect.top - 214), left: clampX(rect.left + rect.width / 2 - width / 2), width, arrow: "bottom" };
}

export default function AppTour() {
  const { user } = useAuth();
  const location = useLocation();
  const [steps, setSteps] = useState(null); // null = tour closed
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const cardRef = useRef(null);

  const start = useCallback(() => {
    if (!user) return;
    setSteps(STEPS[user.role] || null);
    setIndex(0);
  }, [user]);

  const finish = useCallback(() => {
    if (user) {
      try {
        localStorage.setItem(doneKey(user), "true");
      } catch {
        /* storage unavailable */
      }
    }
    setSteps(null);
    setRect(null);
  }, [user]);

  // First visit after logging in: start automatically (not during sign-up or the profile wizard)
  useEffect(() => {
    if (!user || steps || HIDDEN_ON.includes(location.pathname)) return undefined;
    let done = false;
    try {
      done = localStorage.getItem(doneKey(user)) === "true";
    } catch {
      done = true; // can't remember it was shown, so don't show it every time
    }
    if (done) return undefined;
    const id = setTimeout(start, 900);
    return () => clearTimeout(id);
  }, [user, location.pathname, steps, start]);

  // Replay from the "?" button
  useEffect(() => {
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, [start]);

  // Logging out closes the tour
  useEffect(() => {
    if (!user) setSteps(null);
  }, [user]);

  const step = steps?.[index];

  // Find the highlighted element (opening the sidebar first if the step points into it)
  useLayoutEffect(() => {
    if (!step) return undefined;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const el = step.target && document.querySelector(`[data-tour="${step.target}"]`);
      const r = el?.getBoundingClientRect();
      setRect(r && r.width > 0 && r.height > 0 ? r : null);
    };
    let timer;
    if (step.target?.startsWith("nav-")) {
      window.dispatchEvent(new Event(OPEN_SIDEBAR_EVENT));
      timer = setTimeout(() => {
        document.querySelector(`[data-tour="${step.target}"]`)?.scrollIntoView({ block: "nearest" });
        measure();
      }, 380);
    } else {
      measure();
    }
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useEffect(() => {
    if (step) cardRef.current?.focus();
  }, [step]);

  const next = useCallback(() => (steps && index < steps.length - 1 ? setIndex((i) => i + 1) : finish()), [steps, index, finish]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!step) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step, next, back, finish]);

  if (!step) return null;

  const pos = placeCard(rect);
  const last = index === steps.length - 1;

  return (
    <div className="tour-layer" role="presentation">
      {rect ? (
        <div
          className="tour-spotlight"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          aria-hidden="true"
        />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}
      <div
        key={index}
        ref={cardRef}
        tabIndex={-1}
        className={`tour-card ${pos.arrow ? `arrow-${pos.arrow}` : ""}`}
        style={{ top: pos.top, left: pos.left, width: pos.width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
      >
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="tour-step">Step {index + 1} of {steps.length}</span>
          <button type="button" className="btn btn-link btn-sm p-0 text-muted" onClick={finish}>Skip tour</button>
        </div>
        <h2 id="tour-title" className="h6 fw-bold mb-1">{step.title}</h2>
        <p id="tour-text" className="small text-muted mb-3">{step.text}</p>
        <div className="tour-dots" aria-hidden="true">
          {steps.map((_, i) => <span key={i} className={i === index ? "active" : i < index ? "done" : ""} />)}
        </div>
        <div className="d-flex justify-content-between mt-3">
          <button type="button" className="btn btn-sm btn-light" onClick={back} disabled={index === 0}>
            <i className="bi bi-arrow-left me-1" aria-hidden="true" />Back
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={next}>
            {last ? "Finish" : "Next"}
            {!last && <i className="bi bi-arrow-right ms-1" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
