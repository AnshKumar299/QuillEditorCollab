import crypto from "crypto";

const algorithm = "aes-256-cbc";
const key = crypto.scryptSync("QuillEditorCollabSecretKey", "salt", 32);
const iv = Buffer.alloc(16, 0); // Fixed IV for deterministic encryption

function decrypt(text) {
    try {
        if (!text) return null;
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(text, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch {
        return null;
    }
}

export function getValidObjectId(id) {
    if (!id) return null;
    // If it's already a valid 24-character hex string (ObjectId), return it directly
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
        return id;
    }
    // Otherwise, try to decrypt it in case it's an encrypted ID
    const decrypted = decrypt(id);
    if (decrypted && /^[0-9a-fA-F]{24}$/.test(decrypted)) {
        return decrypted;
    }
    return null;
}
