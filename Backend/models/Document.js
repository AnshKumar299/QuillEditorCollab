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
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  collaborators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
}, { timestamps: true });

export default mongoose.model("Document", documentSchema);
