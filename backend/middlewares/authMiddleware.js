// backend/middlewares/authMiddleware.js
import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const tokenHeader = authHeader && authHeader.split(" ")[1];
  const tokenCookie = req.cookies && req.cookies.token;

  const token = tokenHeader || tokenCookie;
  if (!token) return res.status(401).json({ message: "Access denied, no token provided" });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user; // { userId, name, email }
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
