const dns = require("dns").promises;

/** Free / personal mailbox providers. Allowed, but employers using them get extra admin review. */
const FREE_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "ymail.com", "rocketmail.com",
  "outlook.com", "outlook.in", "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com",
  "aol.com", "proton.me", "protonmail.com", "zoho.com", "zohomail.in", "rediffmail.com",
  "gmx.com", "gmx.net", "yandex.com", "mail.com",
]);

/** Throwaway inbox services. Always rejected. */
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "10minutemail.com",
  "10minutemail.net", "tempmail.com", "temp-mail.org", "tempmail.net", "yopmail.com", "yopmail.net",
  "trashmail.com", "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mintemail.com",
  "throwawaymail.com", "fakeinbox.com", "mailnesia.com", "mohmal.com", "emailondeck.com",
  "tempail.com", "burnermail.io", "spamgourmet.com", "mailcatch.com", "moakt.com", "tmpmail.org",
]);

/** Common typos of popular providers, so we can suggest the right spelling. */
const TYPOS = {
  "gmial.com": "gmail.com", "gamil.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com",
  "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmaill.com": "gmail.com", "gnail.com": "gmail.com",
  "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "outlok.com": "outlook.com", "outlook.con": "outlook.com",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const domainOf = (email) => String(email).split("@").pop().toLowerCase();

/** "personal" for Gmail, Outlook, etc. Otherwise "company". */
const emailType = (email) => (FREE_PROVIDERS.has(domainOf(email)) ? "personal" : "company");

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("DNS timeout"), { code: "ETIMEOUT" })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * True if DNS works on this machine. Checked against a domain that always has
 * mail servers, so a blocked or offline network is never mistaken for a bad
 * domain. The result is cached for 5 minutes.
 */
let dnsProbe = { ok: false, at: 0 };
async function dnsWorks() {
  if (Date.now() - dnsProbe.at < 5 * 60 * 1000) return dnsProbe.ok;
  let ok = false;
  try {
    ok = (await withTimeout(dns.resolveMx("gmail.com"), 5000)).length > 0;
  } catch {
    ok = false;
  }
  dnsProbe = { ok, at: Date.now() };
  return ok;
}

/**
 * Returns "yes" if the domain can receive email, "no" if it certainly cannot,
 * or "unknown" if DNS could not be reached (e.g. offline). "unknown" is allowed,
 * because the OTP itself still proves the inbox is real.
 */
async function domainAcceptsMail(domain) {
  const result = await lookupDomain(domain);
  if (result === "no" && !(await dnsWorks())) {
    console.warn(`Email domain check skipped for ${domain} (DNS is not reachable from this machine).`);
    return "unknown";
  }
  return result;
}

async function lookupDomain(domain) {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 5000);
    // A "null MX" (exchange "") means the domain explicitly refuses email
    return mx.some((r) => r.exchange && r.exchange !== ".") ? "yes" : "no";
  } catch (err) {
    if (err.code === "ENOTFOUND") return "no"; // the domain does not exist
    if (err.code === "ENODATA") {
      // No MX record: mail servers fall back to the domain's own address (A record)
      try {
        await withTimeout(dns.resolve4(domain), 5000);
        return "yes";
      } catch (e) {
        return e.code === "ENOTFOUND" || e.code === "ENODATA" ? "no" : "unknown";
      }
    }
    console.warn(`Email domain check skipped for ${domain} (${err.code || err.message}).`);
    return "unknown";
  }
}

/**
 * Checks an email address before a verification code is sent to it.
 * Resolves to { ok: true, type } or { ok: false, message }.
 */
async function checkEmail(email) {
  if (!EMAIL_RE.test(String(email || ""))) return { ok: false, message: "Please enter a valid email address." };
  const domain = domainOf(email);
  if (TYPOS[domain]) return { ok: false, message: `Did you mean ${email.split("@")[0]}@${TYPOS[domain]}?` };
  if (DISPOSABLE.has(domain)) return { ok: false, message: "Temporary or disposable email addresses are not allowed." };
  if (!FREE_PROVIDERS.has(domain) && (await domainAcceptsMail(domain)) === "no") {
    return { ok: false, message: `The domain "${domain}" cannot receive email. Please check the address.` };
  }
  return { ok: true, type: emailType(email) };
}

module.exports = { checkEmail, emailType, FREE_PROVIDERS };
