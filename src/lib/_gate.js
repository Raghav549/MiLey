/**
 * MiLey Platform - Access Gate Utility
 */

export function clearGateToken() {}
export function gateSeedIsOpen() { return true }
export function setGateSeed() {}
export function handleGatedResponse(res) { return res }
export function popMagicKey() { return null }
export async function fetchGateStatus() { return { unlocked: true, gated: false } }
export async function submitGateCode() { return { ok: true } }
