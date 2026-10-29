import express from "express";
import mongoose from "mongoose";
import Image from "../models/image.js";

const router = express.Router();

// GET /api/images/:id  (public so <img> tags can load it without an auth header)
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
    const image = await Image.findById(req.params.id);
    if (!image) return res.status(404).end();

    res.set("Content-Type", image.contentType);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(image.data);
  } catch (err) {
    console.error("image GET error:", err);
    res.status(500).end();
  }
});

export default router;
