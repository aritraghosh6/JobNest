const EmployerProfile = require('../models/EmployerProfile');

/**
 * Several employer accounts can belong to one company: the first account creates it
 * (the "main" profile) and colleagues join it. Jobs, followers and suggestions are
 * shared across everyone in the company.
 */

/** Same company name test used everywhere: "Infosys Ltd." and "infosys ltd" are the same. */
const companyKey = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(pvt|private|ltd|limited|llp|inc|corp|corporation|co|company)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** User ids of every approved member of the company that this employer belongs to (including them). */
async function companyUserIds(employerUserId) {
  const profile = await EmployerProfile.findOne({ user: employerUserId }).select('_id joined_company');
  if (!profile) return [employerUserId];
  const rootId = profile.joined_company || profile._id;
  const members = await EmployerProfile.find({
    $or: [{ _id: rootId }, { joined_company: rootId, 'verification.status': 'approved' }],
  }).select('user');
  const ids = members.map((m) => m.user);
  if (!ids.some((id) => String(id) === String(employerUserId))) ids.push(employerUserId);
  return ids;
}

module.exports = { companyKey, companyUserIds };
