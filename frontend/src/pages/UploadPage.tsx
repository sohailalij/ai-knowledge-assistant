import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Document, formatSize, listDocuments, uploadDocument } from "../api";
import FileIcon from "../FileIcon";

interface UploadItem {
  name: string;
  mimeType: string;
  status: "uploading" | "done" | "error";
  errorText?: string;
}

export default function UploadPage() {
  const { token, email, clearAuth } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    refreshDocuments();
  }, [token]);

  function refreshDocuments() {
    if (!token) return;
    listDocuments(token)
      .then(setDocuments)
      .catch(() => {});
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !token) return;

    const fileArray = Array.from(files);

    for (const file of fileArray) {
      setItems((prev) => [...prev, { name: file.name, mimeType: file.type, status: "uploading" }]);

      try {
        await uploadDocument(token, file);
        setItems((prev) =>
          prev.map((item) => (item.name === file.name && item.status === "uploading" ? { ...item, status: "done" } : item))
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((item) =>
            item.name === file.name && item.status === "uploading"
              ? { ...item, status: "error", errorText: err instanceof Error ? err.message : "Upload failed." }
              : item
          )
        );
      }
    }

    refreshDocuments();
  }

  function handleLogout() {
    clearAuth();
    navigate("/");
  }

  const hasAnyDocs = documents.length > 0 || items.some((i) => i.status === "done");

  return (
    <div className="upload-shell">
      <div className="masthead">
        <h1>Your shelf</h1>
        <div className="nav-links">
          <span className="status-line" style={{ margin: 0 }}>
            {email}
          </span>
          <button className="nav-link-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
      <p className="tagline">Add what you want to ask questions about. PDFs and text files work.</p>

      <div className="upload-layout">
        <div>
          <div
            className={`dropzone${dragging ? " dragging" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <p style={{ margin: 0, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: "1.05rem" }}>
              Drag files here
            </p>
            <p className="dropzone-hint">
              or <span className="text-button" style={{ textDecoration: "underline" }}>browse your computer</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </div>

        <div>
          <p className="file-list-heading">Upload progress</p>
          {items.length === 0 ? (
            <p className="empty-state">Nothing uploading yet.</p>
          ) : (
            <div>
              {items.map((item, i) => (
                <div className="file-row" key={i}>
                  <span>
                    <FileIcon mimeType={item.mimeType} />
                    {item.name}
                  </span>
                  <span className={`file-status ${item.status}`}>
                    {item.status === "uploading" && "Uploading..."}
                    {item.status === "done" && "Done"}
                    {item.status === "error" && (item.errorText || "Failed")}
                  </span>
                </div>
              ))}
            </div>
          )}

          {documents.length > 0 && (
            <>
              <p className="file-list-heading" style={{ marginTop: "1.75rem" }}>
                Already on your shelf
              </p>
              {documents.map((doc) => (
                <div className="file-row" key={doc._id}>
                  <span>
                    <FileIcon mimeType={doc.mimeType} />
                    {doc.filename}
                  </span>
                  <span className="file-status">{formatSize(doc.sizeBytes)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="upload-actions">
        <button className="primary" onClick={() => navigate("/chat")} disabled={!hasAnyDocs}>
          Continue to chat
        </button>
        {!hasAnyDocs && <span className="dropzone-hint">Upload at least one document to continue.</span>}
      </div>
    </div>
  );
}
