// Storage abstraction for attachment binaries. Implements the same shape an
// S3-compatible client would (put/get/delete by key), but backs onto local
// disk so the assignment runs without any cloud credentials. Swapping this
// module for one backed by the AWS SDK (or any S3-compatible SDK) would not
// require any changes to the routes that call it -- see README "Assumptions".

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");

const ROOT = path.resolve(config.uploadDir);
if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true });

function keyFor(originalName) {
  const ext = path.extname(originalName);
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
}

function put(buffer, originalName) {
  const key = keyFor(originalName);
  fs.writeFileSync(path.join(ROOT, key), buffer);
  return key;
}

function getPath(key) {
  const resolved = path.join(ROOT, key);
  if (!resolved.startsWith(ROOT)) throw new Error("Invalid storage key");
  return resolved;
}

function remove(key) {
  const p = getPath(key);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

module.exports = { put, getPath, remove };
