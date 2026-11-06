import { randomUUID } from "node:crypto";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

export const CONTROL_PLANE_PERMISSIONS = [
  "dashboard:access",
  "providers:read", "providers:manage",
  "routing:read", "routing:manage",
  "usage:read",
  "settings:read", "settings:manage",
  "integrations:read", "integrations:manage",
  "system:read", "system:manage",
  "audit:read",
  "users:read", "users:manage",
];

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    permissions: parseJson(row.permissions, []),
    isActive: row.isActive === 1,
    tokenVersion: Number(row.tokenVersion || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt || null,
  };
}

export async function getControlPlaneUserByEmail(email) {
  const db = await getAdapter();
  const row = db.get("SELECT * FROM controlPlaneUsers WHERE email = ?", [String(email || "").trim().toLowerCase()]);
  if (!row) return null;
  return { ...mapUser(row), passwordHash: row.passwordHash };
}

export async function getControlPlaneUserById(id) {
  const db = await getAdapter();
  return mapUser(db.get("SELECT * FROM controlPlaneUsers WHERE id = ?", [String(id || "")]));
}

export async function listControlPlaneUsers() {
  const db = await getAdapter();
  return db.all(
    "SELECT id, email, displayName, role, permissions, isActive, tokenVersion, createdAt, updatedAt, lastLoginAt FROM controlPlaneUsers ORDER BY createdAt ASC"
  ).map(mapUser);
}

export async function createControlPlaneUser(input) {
  const db = await getAdapter();
  const now = new Date().toISOString();
  const user = {
    id: randomUUID(),
    email: String(input.email).trim().toLowerCase(),
    displayName: String(input.displayName).trim(),
    passwordHash: String(input.passwordHash),
    role: input.role,
    permissions: stringifyJson(input.permissions || []),
    isActive: 1,
    tokenVersion: 0,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
  db.run(
    "INSERT INTO controlPlaneUsers(id,email,displayName,passwordHash,role,permissions,isActive,tokenVersion,createdAt,updatedAt,lastLoginAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    [user.id,user.email,user.displayName,user.passwordHash,user.role,user.permissions,user.isActive,user.tokenVersion,user.createdAt,user.updatedAt,user.lastLoginAt]
  );
  return mapUser(user);
}

export async function updateControlPlaneUser(id, updates) {
  const db = await getAdapter();
  const current = db.get("SELECT * FROM controlPlaneUsers WHERE id = ?", [String(id || "")]);
  if (!current) return null;
  const next = { ...current, ...updates, updatedAt: new Date().toISOString() };
  db.run(
    "UPDATE controlPlaneUsers SET displayName=?, role=?, permissions=?, isActive=?, tokenVersion=?, passwordHash=?, updatedAt=? WHERE id=?",
    [next.displayName,next.role,next.permissions,next.isActive,next.tokenVersion,next.passwordHash,next.updatedAt,id]
  );
  return mapUser(db.get("SELECT * FROM controlPlaneUsers WHERE id = ?", [id]));
}

export async function recordControlPlaneLogin(id) {
  const db = await getAdapter();
  db.run("UPDATE controlPlaneUsers SET lastLoginAt=?, updatedAt=? WHERE id=? AND isActive=1",
    [new Date().toISOString(),new Date().toISOString(),id]);
}

export async function writeControlPlaneAuditEvent(event) {
  const db = await getAdapter();
  db.run(
    "INSERT INTO controlPlaneAudit(id,actorId,actorEmail,action,targetType,targetId,details,clientIp,createdAt) VALUES(?,?,?,?,?,?,?,?,?)",
    [
      randomUUID(),
      event.actorId || null,
      event.actorEmail || null,
      String(event.action || "unknown"),
      event.targetType || null,
      event.targetId || null,
      stringifyJson(event.details || {}),
      event.clientIp || null,
      new Date().toISOString(),
    ]
  );
}

export async function listControlPlaneAuditEvents(limit = 100) {
  const db = await getAdapter();
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
  return db.all(
    "SELECT id,actorId,actorEmail,action,targetType,targetId,details,clientIp,createdAt FROM controlPlaneAudit ORDER BY createdAt DESC LIMIT ?",
    [safeLimit]
  ).map((row) => ({ ...row, details: parseJson(row.details, {}) }));
}
