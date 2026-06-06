/**
 * Validates that the given string is a well-formed MongoDB ObjectId
 * (24 hex characters).
 *
 * This is purely a sanitization helper — it prevents garbage or injection
 * payloads from ever reaching Mongoose queries. Authorization is enforced
 * separately on every handler via JWT + isOwner/isShared checks.
 *
 * @param {string|null|undefined} id
 * @returns {string|null} The id string if valid, otherwise null.
 */
export function getValidObjectId(id) {
    if (id && /^[0-9a-fA-F]{24}$/.test(id)) {
        return id;
    }
    return null;
}
