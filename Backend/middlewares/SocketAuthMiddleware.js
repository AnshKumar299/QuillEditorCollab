import jwt from "jsonwebtoken";
import User from "../models/UserModel.js";

/**
 * Deterministic cursor color derived from a userId string.
 * Maps the userId's hash to a hue in HSL space — same user always
 * gets the same color regardless of reconnections or server restarts.
 */
function generateCursorColor(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        hash |= 0; // coerce to 32-bit int
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 55%)`;
}

/**
 * Socket.IO middleware that verifies the JWT from the request cookie.
 *
 * The client sends credentials (cookies) during the WebSocket handshake
 * because the Socket.IO server is configured with `credentials: true`.
 * We parse the `token` cookie from the raw `Cookie` header and verify it
 * against TOKEN_KEY.  If the token is missing, invalid, or the user no
 * longer exists, we reject the connection before any event handler runs.
 *
 * On success, we attach the resolved user to the socket so every handler
 * can trust `socket.userId`, `socket.user`, and `socket.cursorColor`
 * without re-querying the DB.
 */
export async function socketAuthMiddleware(socket, next) {
    try {
        // Parse the raw Cookie header (e.g. "token=abc123; othercookie=xyz")
        const cookieHeader = socket.handshake.headers.cookie || "";
        const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        const token = tokenMatch ? tokenMatch[1] : null;

        if (!token) {
            return next(new Error("Authentication error: no token provided"));
        }

        // Verify synchronously so we can await the DB look-up in one try/catch
        let data;
        try {
            data = jwt.verify(token, process.env.TOKEN_KEY);
        } catch {
            return next(new Error("Authentication error: invalid or expired token"));
        }

        const user = await User.findById(data.id).select("-password");
        if (!user) {
            return next(new Error("Authentication error: user not found"));
        }

        // Attach to socket so handlers can use them without repeating auth logic
        socket.userId = user._id.toString();
        socket.user = user;
        // Stable color — same user always gets same hue across reconnects
        socket.cursorColor = generateCursorColor(socket.userId);

        next();
    } catch (err) {
        console.error("Socket auth middleware error:", err);
        next(new Error("Authentication error: internal server error"));
    }
}
