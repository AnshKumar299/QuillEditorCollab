import User from "../models/UserModel.js";
import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ status: false, message: "Unauthorized" });
    }
    jwt.verify(token, process.env.TOKEN_KEY, async (err, data) => {
        if (err) {
            return res.status(403).json({ status: false, message: "Forbidden" });
        } else {
            const user = await User.findById(data.id);
            if (user) {
                req.user = user;
                next();
            } else {
                return res.status(404).json({ status: false, message: "User not found" });
            }
        }
    });
};
