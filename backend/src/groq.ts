import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

// Roughly 4 characters per token as a safe estimate. We cap the context we
// send to stay comfortably inside the model's context window, this is the
// guardrail the build plan called for with the CAG approach.
const MAX_CONTEXT_CHARS = 300_000;

interface DocumentContext {
  filename: string;
  extractedText: string;
}

export async function generateAnswer(
  question: string,
  documents: DocumentContext[],
  options: { strict?: boolean } = {}
): Promise<{ answer: string; truncated: boolean }> {
  let contextBlock = "";
  let truncated = false;

  for (const doc of documents) {
    const chunk = `[Document: ${doc.filename}]\n${doc.extractedText}\n\n`;
    if (contextBlock.length + chunk.length > MAX_CONTEXT_CHARS) {
      truncated = true;
      break;
    }
    contextBlock += chunk;
  }

  const strictInstruction = options.strict
    ? "You are only given content from ONE specific document. If the question is unrelated to this document, " +
      "or cannot be answered using only what's in it, respond with exactly: " +
      '"I don\'t have information about that in this document." ' +
      "Do not use outside knowledge, and do not guess based on the document's general topic.\n\n"
    : "";

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that answers questions using ONLY the document context provided below. " +
          "If the answer isn't in the documents, say so clearly instead of guessing. " +
          "Always mention which document(s) your answer came from. " +
          "When a number appears in a table or the text, copy it exactly character-for-character rather than retyping it from memory, " +
          "and double-check any arithmetic by re-reading the source values before answering.\n\n" +
          strictInstruction +
          contextBlock,
      },
      {
        role: "user",
        content: question,
      },
    ],
  });

  const answer = completion.choices[0]?.message?.content || "No answer generated.";
  return { answer, truncated };
}
