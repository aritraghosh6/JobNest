/**
 * Sends one test email so you can check the SMTP settings in backend/.env.
 *
 * Usage (from the backend folder):
 *   node scripts/testEmail.js you@gmail.com
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { checkMailSetup, sendMail } = require('../services/mailService');

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: node scripts/testEmail.js you@example.com');
    process.exitCode = 1;
    return;
  }
  const ready = await checkMailSetup();
  if (!ready) {
    process.exitCode = 1;
    return;
  }
  const result = await sendMail({
    to,
    subject: 'JobNest test email',
    text: 'If you can read this, JobNest can send emails. Verification codes will now arrive in the inbox.',
  });
  if (result === 'sent') console.log(`Test email sent to ${to}. Check the inbox (and the Spam folder the first time).`);
  else {
    console.error('The test email could not be sent. See the message above.');
    process.exitCode = 1;
  }
}

main();
