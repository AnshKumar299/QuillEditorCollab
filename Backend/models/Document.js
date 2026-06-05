import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    default: "Untitled Document",
  },
  content: {
    type: Object, // Stores Quill Delta
    default: null,
  },
  version: {
    type: Number,
    default: 0,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  lastEdited: {
    type: Date,
    default: Date.now,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  sharedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
}, { timestamps: true });

export default mongoose.model("Document", documentSchema);
