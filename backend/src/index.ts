import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { randomUUID } from "crypto";
import { connectToDatabase, getDb } from "./db";
import { uploadFileToS3 } from "./s3";
import { extractText } from "./extractText";
import { generateAnswer } from "./groq";
import { hashPassword, comparePassword, generateToken, requireAuth, AuthenticatedRequest } from "./auth";

interface UserRecord {
  _id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface DocumentRecord {
  _id: string;
  userId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
  extractedText: string;
  uploadedAt: Date;
}

interface ConversationMessage {
  question: string;
  answer: string;
  createdAt: Date;
}

interface ConversationRecord {
  _id: string;
  userId: string;
  documentId: string | null; // null means scoped to "all documents"
  documentLabel: string;
  title: string | null;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Store uploaded files in memory temporarily, we forward them to S3, we don't
// need them saved to local disk.
const upload = multer({ storage: multer.memoryStorage() });

// Simple route to confirm the backend is up and reachable
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || password.length < 8) {
      return res
        .status(400)
        .json({ error: "Email and a password of at least 8 characters are required." });
    }

    const db = getDb();
    const existingUser = await db.collection<UserRecord>("users").findOne({ email });

    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await hashPassword(password);
    const userId = randomUUID();

    await db.collection<UserRecord>("users").insertOne({
      _id: userId,
      email,
      passwordHash,
      createdAt: new Date(),
    });

    const token = generateToken(userId, email);
    res.json({ token, email });
  } catch (err) {
    console.error("Signup failed:", err);
    res.status(500).json({ error: "Failed to create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const db = getDb();
    const user = await db.collection<UserRecord>("users").findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await comparePassword(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user._id, user.email);
    res.json({ token, email: user.email });
  } catch (err) {
    console.error("Login failed:", err);
    res.status(500).json({ error: "Failed to log in." });
  }
});

// Upload a document: stores the raw file in S3, extracts its text, and saves
// both the metadata and extracted text in MongoDB.
app.post(
  "/api/documents/upload",
  requireAuth,
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded. Field name must be 'file'." });
      }

      const { originalname, mimetype, buffer, size } = req.file;
      const documentId = randomUUID();
      const s3Key = `documents/${documentId}-${originalname}`;

      await uploadFileToS3(buffer, s3Key, mimetype);
      const extractedText = await extractText(buffer, mimetype);

      const db = getDb();
      await db.collection<DocumentRecord>("documents").insertOne({
        _id: documentId,
        userId: req.user!.userId,
        filename: originalname,
        mimeType: mimetype,
        sizeBytes: size,
        s3Key,
        extractedText,
        uploadedAt: new Date(),
      });

      res.json({
        id: documentId,
        filename: originalname,
        sizeBytes: size,
        message: "Document uploaded and text extracted successfully.",
      });
    } catch (err) {
      console.error("Upload failed:", err);
      res.status(500).json({ error: "Failed to upload and process document." });
    }
  }
);

// List all uploaded documents (metadata only, not the full extracted text,
// to keep the response small)
app.get("/api/documents", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const documents = await db
      .collection<DocumentRecord>("documents")
      .find({ userId: req.user!.userId }, { projection: { extractedText: 0 } })
      .sort({ uploadedAt: -1 })
      .toArray();

    res.json(documents);
  } catch (err) {
    console.error("Failed to list documents:", err);
    res.status(500).json({ error: "Failed to fetch documents." });
  }
});

// Create a new conversation, locked to either one document or "all documents"
// for its entire lifetime. Changing document means starting a new conversation.
app.post("/api/conversations", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { documentId } = req.body;
    const db = getDb();

    let documentLabel = "All documents";
    if (documentId) {
      const doc = await db
        .collection<DocumentRecord>("documents")
        .findOne({ _id: documentId, userId: req.user!.userId });
      if (!doc) {
        return res.status(404).json({ error: "That document couldn't be found." });
      }
      documentLabel = doc.filename;
    }

    const conversation: ConversationRecord = {
      _id: randomUUID(),
      userId: req.user!.userId,
      documentId: documentId || null,
      documentLabel,
      title: null,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection<ConversationRecord>("conversations").insertOne(conversation);
    res.json(conversation);
  } catch (err) {
    console.error("Failed to create conversation:", err);
    res.status(500).json({ error: "Failed to start a new conversation." });
  }
});

// List this user's conversations, newest first, for the sidebar. Message
// bodies are excluded here to keep the list light.
app.get("/api/conversations", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const conversations = await db
      .collection<ConversationRecord>("conversations")
      .find({ userId: req.user!.userId }, { projection: { messages: 0 } })
      .sort({ updatedAt: -1 })
      .toArray();

    res.json(conversations);
  } catch (err) {
    console.error("Failed to list conversations:", err);
    res.status(500).json({ error: "Failed to load your conversations." });
  }
});

// Fetch one conversation's full message history.
app.get("/api/conversations/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const conversation = await db
      .collection<ConversationRecord>("conversations")
      .findOne({ _id: req.params.id, userId: req.user!.userId });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    res.json(conversation);
  } catch (err) {
    console.error("Failed to load conversation:", err);
    res.status(500).json({ error: "Failed to load conversation." });
  }
});

// Ask a question within an existing conversation. Uses only the document(s)
// the conversation was locked to when it was created.
app.post("/api/conversations/:id/messages", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Request body must include a 'question' string." });
    }

    const db = getDb();
    const conversation = await db
      .collection<ConversationRecord>("conversations")
      .findOne({ _id: req.params.id, userId: req.user!.userId });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const filter: { userId: string; _id?: string } = { userId: req.user!.userId };
    if (conversation.documentId) filter._id = conversation.documentId;

    const documents = await db
      .collection<DocumentRecord>("documents")
      .find(filter, { projection: { filename: 1, extractedText: 1 } })
      .toArray();

    if (documents.length === 0) {
      const fallback = conversation.documentId
        ? "That document is no longer available."
        : "No documents have been uploaded yet, so there's nothing to answer from.";
      return res.json({ answer: fallback, truncated: false });
    }

    const { answer, truncated } = await generateAnswer(
      question,
      documents.map((d) => ({ filename: d.filename, extractedText: d.extractedText })),
      { strict: !!conversation.documentId }
    );

    const message: ConversationMessage = { question, answer, createdAt: new Date() };
    const isFirstMessage = conversation.messages.length === 0;

    await db.collection<ConversationRecord>("conversations").updateOne(
      { _id: conversation._id },
      {
        $push: { messages: message },
        $set: {
          updatedAt: new Date(),
          ...(isFirstMessage ? { title: question.slice(0, 60) } : {}),
        },
      }
    );

    res.json({ answer, truncated });
  } catch (err) {
    console.error("Message failed:", err);
    res.status(500).json({ error: "Failed to generate an answer." });
  }
});

const PORT = process.env.PORT || 4000;

connectToDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB, server not started:", err);
    process.exit(1);
  });
