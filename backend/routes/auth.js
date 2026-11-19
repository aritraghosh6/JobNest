const express = require("express");
const { sendSignupOtp, signup, login, me, forgotPassword, resetPassword } = require("../controllers/authzController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/signup/send-otp", sendSignupOtp);
router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protect, me);

module.exports = router;
