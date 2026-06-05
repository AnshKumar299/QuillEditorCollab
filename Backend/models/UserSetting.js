import mongoose from "mongoose";

const userSettingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  lastTheme: {
    type: String,
    enum: ["light", "dark"],
    default: "dark",
  },
  lastViewType: {
    type: String,
    enum: ["grid", "list"],
    default: "grid",
  },
}, { timestamps: true });

export default mongoose.model("UserSetting", userSettingSchema);
