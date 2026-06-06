import jwt from "jsonwebtoken";
import User from "../models/UserModel.js";

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
 * can trust `socket.userId` and `socket.user` without re-querying the DB.
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

        next();
    } catch (err) {
        console.error("Socket auth middleware error:", err);
        next(new Error("Authentication error: internal server error"));
    }
}
