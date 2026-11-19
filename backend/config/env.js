const REQUIRED = ['MONGO_URI', 'JWT_SECRET'];

function checkEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(
      `Missing environment variable(s): ${missing.join(', ')}. ` +
        'Create backend/.env from backend/.env.example.'
    );
    process.exit(1);
  }
  if (process.env.JWT_SECRET === 'replace_with_a_secure_random_secret') {
    console.warn('Warning: JWT_SECRET is still the example value. Replace it with a random secret.');
  }
}

const requireEmployerVerification = () =>
  String(process.env.REQUIRE_EMPLOYER_VERIFICATION || 'true').toLowerCase() !== 'false';

module.exports = { checkEnv, requireEmployerVerification };
