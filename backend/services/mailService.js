const nodemailer = require('nodemailer');

let transporter;

/**
 * Uses real SMTP when SMTP_HOST is configured in .env.
 * Otherwise uses a "JSON transport" that does not send anything; the email is
 * printed in the backend terminal so the team can still demonstrate the flow.
 */
function getTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST) {
    // Gmail shows app passwords in groups of four ("abcd efgh ijkl mnop"); spaces are not part of it
    const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass } : undefined,
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

/** Returns "sent", "logged" (no SMTP configured) or "failed". Never throws. */
async function sendMail({ to, subject, text, html }) {
  try {
    const info = await getTransporter().sendMail({
      from: process.env.MAIL_FROM || 'JobNest <no-reply@jobnest.local>',
      to,
      subject,
      text,
      html,
    });
    if (!process.env.SMTP_HOST) {
      console.log('\n[Email not sent: SMTP not configured] Preview:\n', JSON.parse(info.message), '\n');
      return 'logged';
    }
    return 'sent';
  } catch (err) {
    console.error('Email sending failed:', err.message);
    return 'failed';
  }
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function sendApplicationConfirmation({ to, name, jobTitle, companyName }) {
  const subject = `Application received: ${jobTitle} at ${companyName}`;
  const text =
    `Hi ${name},\n\nYour application for "${jobTitle}" at ${companyName} has been submitted successfully on JobNest.\n` +
    'You can track its status any time from "My Applications".\n\nGood luck!\nThe JobNest Team';
  const html =
    `<p>Hi ${escapeHtml(name)},</p><p>Your application for <strong>${escapeHtml(jobTitle)}</strong> at ` +
    `<strong>${escapeHtml(companyName)}</strong> has been submitted successfully on JobNest.</p>` +
    '<p>You can track its status any time from <em>My Applications</em>.</p><p>Good luck!<br/>The JobNest Team</p>';
  return sendMail({ to, subject, text, html });
}

function sendSignupOtp({ to, name, code, minutes }) {
  const subject = `${code} is your JobNest verification code`;
  const text =
    `Hi ${name},\n\nYour JobNest verification code is: ${code}\n\n` +
    `It expires in ${minutes} minutes. If you did not try to create a JobNest account, you can ignore this email.\n\nThe JobNest Team`;
  const html =
    `<p>Hi ${escapeHtml(name)},</p><p>Your JobNest verification code is:</p>` +
    `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>` +
    `<p>It expires in ${minutes} minutes. If you did not try to create a JobNest account, you can ignore this email.</p>` +
    "<p>The JobNest Team</p>";
  return sendMail({ to, subject, text, html });
}

/**
 * Checks the email settings once at startup and prints a clear message,
 * so it is obvious whether codes go to inboxes or to this terminal.
 */
async function checkMailSetup() {
  if (!process.env.SMTP_HOST) {
    console.log('Email: SMTP is not configured. Verification codes will be printed in this terminal.');
    console.log('       To send real emails, add SMTP_HOST, SMTP_USER and SMTP_PASS to backend/.env');
    return false;
  }
  try {
    await getTransporter().verify();
    console.log(`Email: ready - sending through ${process.env.SMTP_HOST} as ${process.env.SMTP_USER}`);
    return true;
  } catch (err) {
    console.error(`Email: could NOT sign in to ${process.env.SMTP_HOST}: ${err.message}`);
    if (/Username and Password not accepted|Invalid login|535/i.test(err.message)) {
      console.error('       For Gmail, SMTP_PASS must be a 16-letter App Password (not your normal password),');
      console.error('       created at https://myaccount.google.com/apppasswords with 2-Step Verification on.');
    } else if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ESOCKET/i.test(err.message)) {
      console.error('       The network is blocking the mail server (common on office networks). Try another network.');
    }
    return false;
  }
}

function sendPasswordResetCode({ to, name, code, minutes, account = '' }) {
  // account: "job seeker" or "employer" - one email can have both, each with its own password
  const which = account ? `${account} ` : '';
  const subject = `${code} is your JobNest ${which}password reset code`;
  const text =
    `Hi ${name},\n\nWe received a request to reset the password of your JobNest ${which}account. Your code is: ${code}\n\n` +
    `It expires in ${minutes} minutes. If you did not ask for this, you can ignore this email; your password will not change.\n\nThe JobNest Team`;
  const html =
    `<p>Hi ${escapeHtml(name)},</p><p>We received a request to reset the password of your JobNest ${escapeHtml(which)}account. Your code is:</p>` +
    `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>` +
    `<p>It expires in ${minutes} minutes. If you did not ask for this, you can ignore this email; your password will not change.</p>` +
    '<p>The JobNest Team</p>';
  return sendMail({ to, subject, text, html });
}

module.exports = { sendMail, sendApplicationConfirmation, sendSignupOtp, sendPasswordResetCode, checkMailSetup };
