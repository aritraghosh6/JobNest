import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { applicationApi, assessmentApi, jobApi, notificationApi, profileApi } from "../api/services";
import { APPLICATION_STATUS, ACTIVE_STATUSES } from "../utils/helpers";
import { START_TOUR_EVENT } from "./AppTour";

/**
 * Sparrow - the JobNest assistant for job seekers.
 * Simple and private: no outside AI service. It recognises the topic of a question,
 * answers from the user's own JobNest data (through the normal APIs, with their login),
 * and gives links that open the right page.
 */

const SUGGESTIONS = [
  "Show jobs for me",
  "How are my applications doing?",
  "How can I improve my profile?",
  "How do I apply for a job?",
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** How many of a topic's words appear in the question. "word*" also matches longer words (vacanc* -> vacancy). */
const score = (text, words) =>
  words.filter((w) => {
    const prefix = w.endsWith("*");
    const body = escapeRe(prefix ? w.slice(0, -1) : w);
    return new RegExp(`\\b${body}${prefix ? "" : "s?\\b"}`, "i").test(text);
  }).length;

// ---------- Answers that use the user's own data ----------

async function answerApplications() {
  const { applications } = await applicationApi.mine();
  if (!applications.length) {
    return {
      text: "You haven't applied for any jobs yet. Have a look at the jobs matched to your profile.",
      links: [{ to: "/jobs", label: "Browse matched jobs" }],
    };
  }
  const active = applications.filter((a) => ACTIVE_STATUSES.includes(a.status));
  const selected = applications.filter((a) => a.status === "hired").length;
  const interviews = applications.filter((a) => a.status === "interview").length;
  const lines = applications.slice(0, 3).map((a) => `- ${a.job?.title || "Job"}: ${APPLICATION_STATUS[a.status]?.label || a.status}`);
  let summary = `You have ${applications.length} application${applications.length === 1 ? "" : "s"}, ${active.length} still in progress.`;
  if (interviews) summary += ` ${interviews} ${interviews === 1 ? "is" : "are"} at interview stage.`;
  if (selected) summary += ` You've been selected for ${selected} - congratulations!`;
  return { text: `${summary}\nMost recent:\n${lines.join("\n")}`, links: [{ to: "/applications", label: "Open my applications" }] };
}

async function answerJobs() {
  const { jobs, total } = await jobApi.matched({ limit: 3, sort: "relevance" });
  if (!jobs.length) {
    return {
      text: "There are no matching jobs right now. Adding more skills and finishing the culture assessment usually brings in more matches.",
      links: [
        { to: "/profile", label: "Update my profile" },
        { to: "/assessment", label: "Take the assessment" },
      ],
    };
  }
  return {
    text: `I found ${total} job${total === 1 ? "" : "s"} that match your profile. Your top matches:`,
    links: [
      ...jobs.map((j) => ({ to: `/jobs/${j._id || j.id}`, label: `${j.title} - ${j.company_name}${j.match?.score != null ? ` (${j.match.score}% match)` : ""}` })),
      { to: "/jobs", label: "See all matched jobs" },
    ],
  };
}

async function answerSaved() {
  const { jobs } = await jobApi.saved();
  return jobs.length
    ? { text: `You have ${jobs.length} saved job${jobs.length === 1 ? "" : "s"}. We'll remind you before their deadlines.`, links: [{ to: "/saved", label: "Open saved jobs" }] }
    : { text: "You haven't saved any jobs yet. Tap the bookmark on a job to save it for later.", links: [{ to: "/jobs", label: "Browse jobs" }] };
}

async function answerProfile() {
  const [{ profile }, { report }] = await Promise.all([profileApi.getMine(), assessmentApi.latest().catch(() => ({ report: null }))]);
  if (!profile) {
    return { text: "You haven't set up your profile yet. It only takes a few minutes and unlocks job matching.", links: [{ to: "/onboarding", label: "Set up my profile" }] };
  }
  const tips = [];
  if ((profile.skills || []).length < 5) tips.push("add at least 5 skills");
  if (!profile.resume) tips.push("upload your CV");
  if (!(profile.experience || []).length) tips.push("add your work experience");
  if (!profile.headline && !profile.summary) tips.push("write a short headline or summary");
  if (!report) tips.push("complete the culture assessment");
  if (!tips.length) {
    return { text: "Your profile looks complete. Nice work! Keeping your skills up to date keeps your matches accurate.", links: [{ to: "/profile", label: "View my profile" }] };
  }
  return {
    text: `To get better matches, ${tips.join(", ")}.`,
    links: [{ to: "/profile", label: "Edit my profile" }, ...(!report ? [{ to: "/assessment", label: "Take the assessment" }] : [])],
  };
}

async function answerNotifications() {
  const d = await notificationApi.unreadCount();
  const c = d.unread_by_category || {};
  return {
    text: d.unread
      ? `You have ${d.unread} unread notification${d.unread === 1 ? "" : "s"}: ${c.messages || 0} message, ${c.jobs || 0} job and ${c.applications || 0} application update${c.applications === 1 ? "" : "s"}. Click the bell at the top to see them.`
      : "You're all caught up. There are no unread notifications.",
    links: [{ to: "/notifications", label: "Open notifications" }],
  };
}

// ---------- Topics (checked in order; the first match answers) ----------

const TOPICS = [
  { words: ["who are you", "your name", "sparrow"], reply: () => ({ text: "I'm Sparrow, the JobNest assistant. I can find jobs that match you, check your applications and deadlines, and show you how JobNest works." }) },
  { words: ["hello", "hi", "hey", "good morning", "good evening"], reply: () => ({ text: "Hello! I can find jobs for you, check your applications, or show you how JobNest works. What would you like to do?" }) },
  { words: ["thank*"], reply: () => ({ text: "You're welcome! Good luck with your job search." }) },
  {
    words: ["tip", "prepar*", "advice"],
    reply: () => ({
      text: "Interview tips:\n- Read the job description and match your examples to it.\n- Prepare 3 short stories using Situation, Task, Action, Result.\n- Research the company and have 2 questions ready.\n- Check the time, place or link in your notification the day before.",
      links: [{ to: "/applications", label: "See my interviews" }],
    }),
  },
  {
    words: ["withdraw*", "cancel*"],
    reply: () => ({ text: "Open My applications, find the application, and choose Withdraw. You can only withdraw while it's still in progress.", links: [{ to: "/applications", label: "My applications" }] }),
  },
  { words: ["application", "applied", "status", "interview", "shortlist*", "selected", "rejected", "progress", "offer"], run: answerApplications },
  { words: ["saved", "bookmark*", "deadline"], run: answerSaved },
  { words: ["notification", "bell", "alert", "unread"], run: answerNotifications },
  { words: ["improv*", "profile", "skill", "complete", "better match*"], run: answerProfile },
  {
    words: ["how do i apply", "how to apply", "apply"],
    reply: () => ({
      text: "Open a job from your matched jobs, check the match details, then press Apply. You can add a cover letter and your CV is attached from your profile. You'll get updates under the bell as the employer moves your application.",
      links: [{ to: "/jobs", label: "Go to jobs" }],
    }),
  },
  { words: ["job", "vacanc*", "opening", "role", "recommend*", "find", "match", "show me"], run: answerJobs },
  {
    words: ["ats", "cv", "resume", "resume"],
    reply: () => ({ text: "The ATS checker scores your CV against a job description and lists missing keywords. Upload your CV on your profile so it's attached to applications.", links: [{ to: "/ats-checker", label: "Open ATS checker" }, { to: "/profile", label: "Upload my CV" }] }),
  },
  {
    words: ["assessment", "culture", "questionnaire", "personality"],
    reply: () => ({ text: "The culture assessment takes about 5 minutes. Your results improve how jobs are matched to the way you like to work.", links: [{ to: "/assessment", label: "Take the assessment" }] }),
  },
  {
    words: ["follow*", "company", "companies", "employer"],
    reply: () => ({ text: "Open any job and press Follow on the company. When a company you follow posts a new job, you'll get a notification. You can see who you follow on the Saved page.", links: [{ to: "/saved", label: "Companies I follow" }, { to: "/jobs", label: "Browse jobs" }] }),
  },
  {
    words: ["message", "chat", "connect*", "network", "contact"],
    reply: () => ({ text: "Connect with people on the Network page. Once they accept, you can message them. New messages also show under the bell.", links: [{ to: "/network", label: "Open network" }, { to: "/messages", label: "Open messages" }] }),
  },
  {
    words: ["password", "login", "log in", "sign in", "forgot"],
    reply: () => ({ text: "If you've forgotten your password, log out and use 'Forgot password?' on the login page. We'll email you a reset code.", links: [{ to: "/forgot-password", label: "Reset password" }] }),
  },
  {
    words: ["dark", "light", "theme", "dark mode"],
    reply: () => ({ text: "Use the sun / moon button in the top bar to switch between light and dark mode. Your choice is remembered." }),
  },
  {
    words: ["tour", "guide", "help", "what can you"],
    reply: () => ({ text: "I can show you jobs that match you, check your applications, saved jobs and notifications, and help improve your profile. Want the guided tour again?", action: "tour" }),
  },
];

async function answer(question) {
  const text = question.toLowerCase();
  // The topic with the most matching words wins; on a tie, the one listed first
  let topic = null;
  let best = 0;
  TOPICS.forEach((t) => {
    const points = score(text, t.words);
    if (points > best) {
      best = points;
      topic = t;
    }
  });
  if (!topic) {
    return {
      text: "Sorry, I didn't quite get that. I can help with jobs, applications, saved jobs, your profile, notifications, messages and the ATS checker. Try one of these:",
      chips: SUGGESTIONS,
    };
  }
  return topic.run ? topic.run() : topic.reply();
}

let nextId = 1;

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 0, from: "bot", text: "Hi, I'm Sparrow, your JobNest assistant. Ask me about jobs, your applications or how to use JobNest.", chips: SUGGESTIONS },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ block: "end" });
      inputRef.current?.focus();
    }
  }, [open, messages.length]);

  // Close the window after following a link to another page
  useEffect(() => setOpen(false), [location.pathname]);

  const ask = async (question) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: nextId++, from: "me", text: q }]);
    setBusy(true);
    try {
      const reply = await answer(q);
      setMessages((m) => [...m, { id: nextId++, from: "bot", ...reply }]);
    } catch {
      setMessages((m) => [...m, { id: nextId++, from: "bot", text: "Sorry, I couldn't load that just now. Please check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="chatbot" data-tour="chatbot">
      {open && (
        <section className="chatbot-window" role="dialog" aria-label="Sparrow, the JobNest assistant">
          <header className="chatbot-head">
            <span className="chatbot-avatar" aria-hidden="true"><i className="bi bi-stars" /></span>
            <div className="me-auto lh-sm">
              <strong className="d-block">Sparrow</strong>
              <span className="small opacity-75">Answers from your JobNest account</span>
            </div>
            <button type="button" className="btn btn-sm chatbot-close" onClick={() => setOpen(false)} aria-label="Close Sparrow">
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </header>

          <div className="chatbot-body" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`chatbot-msg ${m.from}`}>
                <div className="chatbot-bubble">
                  {m.text.split("\n").map((line, i) => <span key={i} className="d-block">{line}</span>)}
                  {m.links?.length > 0 && (
                    <div className="chatbot-links">
                      {m.links.map((l) => (
                        <Link key={l.to + l.label} to={l.to} className="chatbot-link">
                          {l.label}
                          <i className="bi bi-arrow-right-short" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  )}
                  {m.action === "tour" && (
                    <button type="button" className="btn btn-sm btn-outline-primary mt-2" onClick={() => { setOpen(false); window.dispatchEvent(new Event(START_TOUR_EVENT)); }}>
                      <i className="bi bi-signpost-2 me-1" aria-hidden="true" />Replay the tour
                    </button>
                  )}
                </div>
                {m.chips && (
                  <div className="chatbot-chips">
                    {m.chips.map((c) => (
                      <button key={c} type="button" className="choice-chip small" onClick={() => ask(c)} disabled={busy}>{c}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="chatbot-msg bot">
                <div className="chatbot-bubble chatbot-typing" aria-label="Assistant is typing"><span /><span /><span /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="chatbot-input" onSubmit={onSubmit}>
            <label htmlFor="chatbot-q" className="visually-hidden">Ask a question</label>
            <input
              id="chatbot-q"
              ref={inputRef}
              className="form-control"
              placeholder="Ask about jobs, applications..."
              value={input}
              maxLength={300}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()} aria-label="Send">
              <i className="bi bi-send-fill" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`chatbot-fab ${open ? "is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close Sparrow" : "Ask Sparrow, the JobNest assistant"}
        title="Ask Sparrow"
      >
        <i className={`bi bi-${open ? "x-lg" : "chat-heart-fill"}`} aria-hidden="true" />
      </button>
    </div>
  );
}
