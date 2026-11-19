const SeekerProfile = require('../models/SeekerProfile');
const EmployerProfile = require('../models/EmployerProfile');
const { ROLES } = require('../config/constants');

/**
 * Builds small public "cards" for a list of users (used by networking and messaging).
 * Only non-sensitive fields are included — no email, phone or documents.
 */
async function buildUserCards(users) {
  const ids = users.map((u) => u._id);
  const [seekers, employers] = await Promise.all([
    SeekerProfile.find({ user: { $in: ids } }).select('user headline location skills'),
    EmployerProfile.find({ user: { $in: ids } }).select('user company_name industry location logo verification.status'),
  ]);
  const seekerMap = new Map(seekers.map((p) => [String(p.user), p]));
  const employerMap = new Map(employers.map((p) => [String(p.user), p]));

  return users.map((u) => {
    const card = { id: u._id, name: u.name, role: u.role };
    if (u.role === ROLES.JOB_SEEKER) {
      const p = seekerMap.get(String(u._id));
      card.headline = p?.headline || 'Job seeker';
      card.location = p?.location;
      card.skills = (p?.skills || []).slice(0, 5);
    } else if (u.role === ROLES.EMPLOYER) {
      const p = employerMap.get(String(u._id));
      card.headline = p ? `${p.company_name}${p.industry ? ` · ${p.industry}` : ''}` : 'Employer';
      card.location = p?.location;
      card.logo_url = p?.logo?.stored_name ? `/uploads/logos/${p.logo.stored_name}` : null;
      card.verified = p?.verification?.status === 'approved';
    }
    return card;
  });
}

module.exports = { buildUserCards };
