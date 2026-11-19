const Notification = require('../models/Notification');

// Events that must only ever be announced once per user (same type + page + title)
const ONCE_ONLY = new Set(['followed_company_job', 'new_job', 'position_filled', 'offer']);

/**
 * Creates in-app notifications. Never throws: a failed notification must not
 * break the action that triggered it (e.g. changing an application status).
 *
 *   notify(userId, { type, title, message, link })
 *   notify([id1, id2], { ... })
 */
async function notify(users, { type = 'system', title, message, link, dedupe_key: dedupeKey }) {
  const ids = [...new Set((Array.isArray(users) ? users : [users]).filter(Boolean).map(String))];
  if (!ids.length || !title) return 0;
  const key = dedupeKey || (ONCE_ONLY.has(type) ? `${type}|${link || ''}|${title}` : undefined);
  const docs = ids.map((user) => ({ user, type, title, message, link, ...(key ? { dedupe_key: key } : {}) }));
  try {
    await Notification.insertMany(docs, { ordered: false });
    return docs.length;
  } catch (err) {
    // Duplicate key = this user was already told about this event; the others were still saved
    if (err.code === 11000 || err.writeErrors) return err.insertedDocs?.length ?? 0;
    console.error('Could not create notification:', err.message);
    return 0;
  }
}

const preview = (text, max = 120) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

/**
 * A new chat message: the recipient gets ONE unread notification per sender.
 * If one is already waiting, it is replaced by a fresh one (newest preview, count + 1),
 * so it moves to the top of the list instead of filling it with duplicates.
 * Only the recipient's own notification is touched, and it only quotes a message sent to them.
 */
async function notifyNewMessage({ recipientId, senderId, senderName, text }) {
  try {
    const group = `msg:${senderId}`;
    const previous = await Notification.findOneAndDelete({ user: recipientId, group_key: group, read: false });
    const count = (previous?.count || 0) + 1;
    await Notification.create({
      user: recipientId,
      type: 'message',
      title: count > 1 ? `${count} new messages from ${senderName}` : `New message from ${senderName}`,
      message: preview(text),
      link: `/messages/${senderId}`,
      group_key: group,
      count,
      actor_name: senderName,
    });
  } catch (err) {
    console.error('Could not create message notification:', err.message);
  }
}

/** Opening a conversation marks that sender's message notification as read. */
async function markConversationRead(userId, otherUserId) {
  try {
    await Notification.updateMany({ user: userId, group_key: `msg:${otherUserId}`, read: false }, { read: true });
  } catch (err) {
    console.error('Could not update message notifications:', err.message);
  }
}

const formatWhen = (date) =>
  new Date(date).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const MODE_LABEL = { online: 'Online', in_person: 'In person', phone: 'Phone' };

/** Wording shown to the candidate when the employer moves their application. */
function statusMessage({ status, jobTitle, company, entry = {} }) {
  const stage = entry.stage_label;
  const when = entry.scheduled_at ? formatWhen(entry.scheduled_at) : null;
  const where = [entry.mode && MODE_LABEL[entry.mode], entry.location].filter(Boolean).join(' · ');
  const note = entry.note ? ` Note from ${company}: "${entry.note}"` : '';
  switch (status) {
    case 'under_review':
      return { type: 'application_update', title: `${company} is reviewing your application`, message: `Your application for ${jobTitle} is now under review.${note}` };
    case 'shortlisted':
      return { type: 'application_update', title: `You've been shortlisted for ${jobTitle}`, message: `Good news! ${company} has shortlisted you and moved your application forward.${note}` };
    case 'assessment':
      return {
        type: 'assessment',
        title: `${stage || 'Assessment'} for ${jobTitle}`,
        message: `${company} has asked you to complete ${stage ? `"${stage}"` : 'an assessment'}.${when ? ` Due: ${when}.` : ''}${note}`,
      };
    case 'interview':
      return {
        type: 'interview',
        title: `${stage || 'Interview'} scheduled for ${jobTitle}`,
        message: `${company} has invited you to ${stage ? `"${stage}"` : 'an interview'}.${when ? ` When: ${when}.` : ''}${where ? ` Where: ${where}.` : ''}${note}`,
      };
    case 'hired':
      return { type: 'offer', title: `Congratulations! You've been selected for ${jobTitle}`, message: `${company} has selected you for this role. They will contact you with the next steps.${note}` };
    case 'rejected':
      return { type: 'rejection', title: `Update on your application for ${jobTitle}`, message: `Thank you for your interest. ${company} has decided not to move forward with your application this time.${note}` };
    case 'position_filled':
      return {
        type: 'position_filled',
        title: `${jobTitle} has been filled`,
        message: `We've found the candidate for this role. Thank you for your time. Your application will stay with ${company}, and they will let you know if it matches any other opening.`,
      };
    default:
      return { type: 'application_update', title: `Update on your application for ${jobTitle}`, message: `Your application status has changed.${note}` };
  }
}

module.exports = { notify, notifyNewMessage, markConversationRead, statusMessage, formatWhen };
