# CollabWrite

A powerful, real-time collaborative document editor built with the MERN stack and Socket.io. Write together, share instantly, and manage access with ease.

![CollabWrite Logo](Collab%20Write/src/assets/logo.png)

## 🚀 Features

- **Real-time Collaboration**: Powered by Socket.io for instant delta-based content synchronization.
- **Access Control & Security**:
    - **Join Requests**: Document owners receive real-time notifications to approve or deny access requests.
    - **Private/Shared Documents**: Clear distinction between documents you own and those shared with you.
- **Rich Text Editing**: Integrated with Quill.js for a premium writing experience.
- **Document Management**:
    - **Real-time Descriptions**: Document owners can set and sync descriptions that appear on the dashboard.
    - **Instant Renaming**: Rename documents on the fly with live updates for all connected users.
- **User Activity Logs**: Track who joins, leaves, and renames documents in real-time.
- **Exports**: Download your documents as **Word (.docx)** or **PDF**.
- **Modern UI/UX**:
    - **Cyber-Indie Aesthetic**: A clean, dark-mode design with glassmorphic elements.
    - **Dynamic Dashboard**: Access your entire workspace and join rooms via ID from a single hub.
    - **Responsive Design**: Fully functional across desktop and mobile.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS (Vanilla CSS implementation), Lucide Icons.
- **Backend**: Node.js, Express, Socket.io.
- **Database**: MongoDB (Mongoose).
- **Authentication**: JWT-based secure auth with cookie persistence.

## 🏁 Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB (Local or Atlas)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AnshKumar299/QuillEditorCollab.git
   cd QuillEditorCollab
   ```

2. **Setup Backend**:
   ```bash
   cd Backend
   npm install
   ```
   Create a `.env` file in the `Backend` directory:
   ```env
   MONGO_URL=your_mongodb_connection_string
   PORT=3000
   TOKEN_KEY=your_jwt_secret_key
   ```
   Start the backend:
   ```bash
   npm run dev
   ```

3. **Setup Frontend**:
   ```bash
   cd ../Collab\ Write
   npm install
   ```
   Create a `.env` file in the `Collab Write` directory:
   ```env
   VITE_BACKEND_URL=http://localhost:3000
   ```
   Start the frontend:
   ```bash
   npm run dev
   ```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Built with ❤️ by the CollabWrite Team.
