const express = require("express");
const router = express.Router();
// All API routes live under /api/v1 (see app.js)
router.get("/health", (req, res) => res.json({ status: "ok" }));
router.use("/auth", require("./auth"));
router.use("/profiles", require("./profiles"));
router.use("/assessments", require("./assessments"));
router.use("/jobs", require("./jobs"));
router.use("/applications", require("./applications"));
router.use("/users", require("./users"));
router.use("/connections", require("./connections"));
router.use("/messages", require("./messages"));
router.use("/resumes", require("./resumes"));
router.use("/admin", require("./admin"));
router.use("/notifications", require("./notifications"));
router.use("/follows", require("./follows"));
router.use("/calendar", require("./calendar"));
router.use("/",(req,res)=>{
    res.status(200).json({
        success:true,
        message:"Jobnest API is working",
        version:"v1"
    })
})
module.exports = router;
