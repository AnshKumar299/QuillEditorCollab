# Agent Skills: Collaborative Editor File System Implementation

This document serves as the implementation plan and agent skills prompt for Antigravity to build a MongoDB-backed file system for the Quill collaborative editor.

## Goal Description
Implement a file management system where documents are stored exclusively in MongoDB. The system must allow users to view their existing files and create new ones. The collaborative editor uses QuillJS and Socket.io. Currently, there are no models or controllers for this functionality.

## Open Questions (User Clarification Needed)
> [!IMPORTANT]
> Please clarify the following points before execution begins:
> 1. **Routing Strategy**: You mentioned "the `/` route redirects to the editing page". Should the user see a "Dashboard/File Manager" first at `/` when they log in, or should `/` immediately create a new blank document and redirect them to `/edit/<new_id>`? 
> 2. **Document Saving Mechanism**: Should the document content be saved to MongoDB automatically on every socket keystroke (debounced), periodically (e.g., every 5 seconds), or only when the user clicks a "Save" button?
> 3. **Collaboration Permissions**: Should files be private by default and require explicitly adding collaborators, or should anyone with the document URL be able to join and edit?

## Proposed Changes

### Backend: Models
#### [NEW] Backend/models/Document.js
Create a Mongoose model for storing documents.
- Fields:
  - `_id`: String (e.g., UUID or shortid to be used in the URL)
  - `title`: String (default: "Untitled Document")
  - `content`: Object (To store Quill Delta object)
  - `owner`: ObjectId (Ref to 'User' model)
  - `createdAt`, `updatedAt`: Timestamps

### Backend: Controllers & Routes
#### [NEW] Backend/controllers/DocumentController.js
- `createDocument`: Generates a new document, assigns the logged-in user as the owner, and returns the document ID.
- `getUserDocuments`: Retrieves a list of all documents owned by the logged-in user (fetching just `_id`, `title`, and `updatedAt`).
- `getDocumentById`: Retrieves a specific document's full content by its ID.

#### [NEW] Backend/routes/DocumentRoute.js
- Defines Express routes for the above controller functions.
- Protected by the existing authentication middleware to ensure only logged-in users can access or create files.

#### [MODIFY] Backend/app.js
- Import and use the new `DocumentRoute`.
- Implement Socket.io logic to load document data from MongoDB when a user joins a room (`join-room`).
- Implement Socket.io logic to persist the Quill Delta to MongoDB (e.g., debounced save on `send-delta`).

### Frontend: UI and Pages
#### [NEW] Collab Write/src/Pages/Dashboard.tsx
- A new file manager view.
- Displays a grid or list of the user's existing documents fetched from `GET /list`.
- Includes a "Create New Document" button which calls `POST /create` and redirects to the editor.

#### [MODIFY] Collab Write/src/App.tsx (or routing configuration)
- Add route for `/dashboard`.
- Modify `/` to redirect to `/dashboard` (or handle the redirect logic as clarified above).
- Update the editor route to accept a document ID (e.g., `/edit/:id`).

#### [MODIFY] Collab Write/src/Pages/Home.tsx
- This is the current editing page. Update it to:
  - Read the document ID from the URL parameters.
  - Fetch the initial document content from the backend via API or Socket.io.
  - Load the Quill Delta into the editor.
  - Send the document ID when joining the socket room.

## Verification Plan
### Automated & Manual Testing
1. **Document Creation**: Log in, click "Create New File", verify a new document is created in MongoDB and the UI redirects to the new editor URL.
2. **File Listing**: Navigate to the dashboard, verify the newly created file appears in the list.
3. **Persistence**: Type in the Quill editor, refresh the page, and verify the content is loaded correctly from MongoDB.
4. **Collaboration**: Open the same document URL in two different browser windows/users, verify that socket deltas are synchronized and both instances save to the same MongoDB document.
