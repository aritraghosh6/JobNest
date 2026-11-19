const path = require("path");
// Load backend/.env before any other module reads process.env
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const { checkEnv } = require("./config/env");
const apiRouter = require("./routes/index");
const { notFound, errorHandler } = require("./middleware/error");
checkEnv();
const app = express();
app.use(
  cors({
    origin: (process.env.CLIENT_URL || "http://localhost:5000")
      .split(",")
      .map((o) => o.trim()),
    credentials: true,
    exposedHeaders: ["Content-Disposition"], // lets the browser read download file names
  })
);
app.use(logger("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// Only company logos are public. Resumes, cover letters and verification
// documents are served through authenticated API routes.
app.use(
  "/uploads/logos",
  express.static(path.join(__dirname, "uploads", "logos"))
);
app.get("/", (req, res) => {
  res.json({ name: "JobNest API", version: "v1", base_url: "/api/v1" });
});
app.use("/api/v1", apiRouter);
app.use(notFound);
app.use(errorHandler);
module.exports = app;
