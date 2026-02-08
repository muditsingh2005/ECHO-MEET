import { Router } from "express";
import passport from "../config/passport.js";
import {
  googleCallback,
  getCurrentUser,
  logout,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login?error=auth_failed",
  }),
  googleCallback
);

router.get("/me", verifyJWT, getCurrentUser);

router.post("/logout", logout);

export default router;
