"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import Tilt from "react-parallax-tilt";
import ParticlesBackground from "./ParticlesBackground";
import Hero3D from "./Hero3D";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { InfoModal } from "./InfoModel";
import Groq from "groq-sdk";

const API_BASE_URL = "https://chatbot-ai-2kjk.onrender.com";

// ─── Available Groq models ────────────────────────────────────────────────────
const MODELS = [
  {
    id: "llama-3.3-70b-versatile",
    label: "LLaMA 3.3 70B",
    description: "Smart & versatile",
  },
  {
    id: "llama-3.1-8b-instant",
    label: "LLaMA 3.1 8B",
    description: "Fast & lightweight",
  },
  {
    id: "mixtral-8x7b-32768",
    label: "Mixtral 8x7B",
    description: "Long context (32k)",
  },
  {
    id: "gemma2-9b-it",
    label: "Gemma 2 9B",
    description: "Google's model",
  },
];

// ─── Personalities ────────────────────────────────────────────────────────────
const PERSONALITIES = [
  {
    id: "default",
    emoji: "🤖",
    label: "Default",
    prompt: "You are a helpful and knowledgeable AI assistant.",
  },
  {
    id: "professor",
    emoji: "🎓",
    label: "Professor",
    prompt:
      "You are a university professor. Explain everything in depth with examples, analogies, and academic structure. Be thorough and educational.",
  },
  {
    id: "friend",
    emoji: "😄",
    label: "Friend",
    prompt:
      "You are a fun, casual best friend. Use simple language, be funny, use emojis occasionally, and keep things light and conversational.",
  },
  {
    id: "professional",
    emoji: "💼",
    label: "Professional",
    prompt:
      "You are a senior business consultant. Be concise, structured, and professional. Use bullet points where helpful. No fluff.",
  },
  {
    id: "savage",
    emoji: "🔥",
    label: "Savage",
    prompt:
      "You are brutally honest and direct. No sugarcoating. Give real answers, call out bad ideas, and be refreshingly blunt — but still helpful.",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
  role: "user" | "assistant";
  content: string;
};

// ─── Syntax highlighting + inline code for ReactMarkdown ─────────────────────
const markdownComponents: any = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    return !inline && match ? (
      <div className="relative group/code my-3">
        {/* language label */}
        <span className="absolute top-2 left-3 text-xs text-zinc-400 font-mono uppercase">
          {match[1]}
        </span>
        {/* copy button on code block */}
        <button
          onClick={() =>
            navigator.clipboard.writeText(String(children).replace(/\n$/, ""))
          }
          className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2 py-1 rounded"
        >
          Copy
        </button>
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          customStyle={{
            borderRadius: "0.75rem",
            padding: "2.5rem 1rem 1rem",
            fontSize: "0.85rem",
            margin: 0,
          }}
          {...props}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code
        className="bg-zinc-800 px-1.5 py-0.5 rounded text-blue-400 text-sm font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
};

// ─── PDF text extractor (runs only in browser) ────────────────────────────────
const extractPDFText = async (file: File): Promise<string> => {
  const pdfjsLib = await import("pdfjs-dist");
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  const maxPages = Math.min(pdf.numPages, 20);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as any[]).map((item) => item.str).join(" ");
    fullText += `\n--- Page ${i} ---\n${pageText}`;
  }

  // if no text found, it's a scanned PDF — try OCR
  if (!fullText.trim()) {
    console.log("No text found, attempting OCR...");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");

    let ocrText = "";
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);

      // render page to canvas
      const viewport = page.getViewport({ scale: 2.0 }); // scale 2 = better OCR accuracy
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      // run OCR on the canvas image
      const {
        data: { text },
      } = await worker.recognize(canvas);
      ocrText += `\n--- Page ${i} ---\n${text}`;
    }

    await worker.terminate();
    return ocrText.trim();
  }

  return fullText.trim();
};

export default function Home() {
  const { isSignedIn, isLoaded, user } = useUser();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedPersonality, setSelectedPersonality] = useState(
    PERSONALITIES[0].id,
  );

  // ── RAG state ───────────────────────────────────────────────────────────────
  const [documentText, setDocumentText] = useState<string>(""); // extracted text
  const [documentName, setDocumentName] = useState<string>(""); // filename for UI
  const [isFileLoading, setIsFileLoading] = useState(false); // spinner while parsing
  const [fileError, setFileError] = useState<string>(""); // parse error message
  // ────────────────────────────────────────────────────────────────────────────

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // hidden file input

  // auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // close model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Fetch history ──────────────────────────────────────────────────────────
  const fetchHistory = async () => {
    if (!user?.id) return;
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/history?userId=${user.id}`);
      if (!res.ok) {
        console.error("History fetch failed:", res.status);
        return;
      }
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      console.error("Could not fetch history:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // ─── Clear all history ──────────────────────────────────────────────────────
  const clearHistory = async () => {
    if (!user?.id || !confirm("Are you sure you want to delete all chats?"))
      return;
    try {
      await fetch(`${API_BASE_URL}/api/history/${user.id}`, {
        method: "DELETE",
      });
      setHistory([]);
      setMessages([]);
    } catch (error) {
      console.error("Failed to clear history", error);
    }
  };

  // ─── Delete single chat ─────────────────────────────────────────────────────
  const deleteSingleChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this chat?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/history/chat/${chatId}`, {
        method: "DELETE",
      });
      if (res.ok) fetchHistory();
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  // ─── Copy message to clipboard ──────────────────────────────────────────────
  const copyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // ─── New chat ───────────────────────────────────────────────────────────────
  const startNewChat = () => {
    setMessages([]);
    setLastPrompt("");
  };

  // ─── Auto-generate a short title from the prompt ─────────────────────────────
  const generateTitle = (prompt: string): string => {
    // remove special chars, split into words, take first 5
    const words = prompt
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 5);
    const title = words.join(" ");
    // capitalise first letter
    return title.charAt(0).toUpperCase() + title.slice(1);
  };

  // ─── Clear the loaded document ──────────────────────────────────────────────
  const clearDocument = () => {
    setDocumentText("");
    setDocumentName("");
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Handle file upload (PDF or TXT) ────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError("");
    setIsFileLoading(true);
    setDocumentName(file.name);

    try {
      let text = "";

      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        // plain text — read directly
        text = await file.text();
      } else if (
        file.type === "application/pdf" ||
        file.name.endsWith(".pdf")
      ) {
        text = await extractPDFText(file);
      } else {
        setFileError("Only .pdf and .txt files are supported.");
        setDocumentName("");
        setIsFileLoading(false);
        return;
      }

      // AFTER
      if (!text.trim()) {
        setFileError(
          "This PDF appears to be scanned (image-based). Only text-based PDFs are supported. " +
            "Try copying text from the PDF — if you can't select text in it, it's a scanned file.",
        );
        setDocumentName("");
        setIsFileLoading(false);
        return;
      }

      // cap at ~12 000 chars to stay within context limits
      const cappedText =
        text.length > 12000
          ? text.slice(0, 12000) +
            "\n\n[Document truncated to fit context window]"
          : text;

      setDocumentText(cappedText);

      // auto-send a summary request as the opening message
      const summaryPrompt = `I've uploaded a document called "${file.name}". Please give me a brief summary of what it's about in 3-4 sentences.`;
      await handleSendWithDoc(summaryPrompt, cappedText);
    } catch (err: any) {
      console.error("File parse error:", err);
      setFileError("Failed to read the file. Please try again.");
      setDocumentName("");
    } finally {
      setIsFileLoading(false);
    }
  };

  useEffect(() => {
    if (isSignedIn && user?.id) fetchHistory();
  }, [isSignedIn, user?.id]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  // ─── Core send — accepts an optional docText override used on first upload ──
  const handleSendWithDoc = async (
    currentPrompt: string,
    docTextOverride?: string,
  ) => {
    if (!currentPrompt.trim()) return;

    setIsLoading(true);
    setLastPrompt(currentPrompt);

    const activeDocText = docTextOverride ?? documentText;

    const updatedMessages: Message[] = [
      ...messages,
      { role: "user", content: currentPrompt },
    ];
    setMessages(updatedMessages);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
      if (!apiKey) {
        setMessages([
          ...updatedMessages,
          {
            role: "assistant",
            content: "Groq API Key is missing in environment variables.",
          },
        ]);
        setIsLoading(false);
        return;
      }

      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

      // ── RAG: inject document as a system message ──────────────────────────

      const personality =
        PERSONALITIES.find((p) => p.id === selectedPersonality) ??
        PERSONALITIES[0];

      const systemMessage = {
        role: "system" as const,
        content: activeDocText
          ? `${personality.prompt}\n\n` +
            `The user has uploaded a document. Answer their questions based ONLY on the document content below. ` +
            `If the answer is not in the document, say "I couldn't find that in the uploaded document."\n\n` +
            `=== DOCUMENT START ===\n${activeDocText}\n=== DOCUMENT END ===`
          : personality.prompt,
      };

      const messagesForAPI = [systemMessage, ...updatedMessages];

      // streaming
      const stream = await groq.chat.completions.create({
        messages: messagesForAPI,
        model: selectedModel,
        stream: true,
      });

      let fullText = "";
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || "";
        fullText += token;
        setMessages([
          ...updatedMessages,
          { role: "assistant", content: fullText },
        ]);
      }

      // save to DB after stream completes
      try {
        await fetch(`${API_BASE_URL}/api/save-prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.id,
            title: generateTitle(currentPrompt),
            userPrompt: currentPrompt,
            aiResponse: fullText,
          }),
        });
        fetchHistory();
      } catch (dbError) {
        console.error("Warning: Could not save to database.", dbError);
      }
    } catch (error: any) {
      console.error("Groq API Error:", error);
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "Error connecting to Groq. Please check your API key.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (overridePrompt?: string) => {
    const currentPrompt = overridePrompt ?? prompt;
    if (!overridePrompt) setPrompt("");
    await handleSendWithDoc(currentPrompt);
  };

  // ─── Regenerate: remove last AI response and resend last prompt ─────────────
  const handleRegenerate = () => {
    if (!lastPrompt) return;
    const withoutLastReply = messages.slice(0, -1);
    setMessages(withoutLastReply);
    handleSend(lastPrompt);
  };

  const currentModel = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden relative">
      <ParticlesBackground />

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      {isSignedIn && (
        <>
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-[45] md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <aside
            className={`fixed md:relative h-full flex-shrink-0 bg-zinc-950/95 backdrop-blur-xl z-50 shadow-2xl transition-all duration-300 ease-in-out overflow-hidden
            ${
              isSidebarOpen
                ? "w-[85%] md:w-80 border-r border-zinc-800 opacity-100"
                : "w-0 opacity-0 border-none"
            }`}
          >
            <div className="w-[75vw] md:w-80 h-full flex flex-col">
              {/* Sidebar header */}
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="3" y1="12" x2="21" y2="12"></line>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                  </button>
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                    Hackathon<span className="text-blue-500">AI</span>
                  </h1>
                  <Hero3D />
                </div>
              </div>

              {/* New Chat button */}
              <div className="px-4 pt-4">
                <Button
                  onClick={startNewChat}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  New Chat
                </Button>
              </div>

              {/* History list */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-2">
                  Recent Chats
                </h3>
                <div className="flex flex-col gap-2">
                  {isHistoryLoading ? (
                    <div className="flex flex-col items-center gap-2 mt-4">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs text-zinc-500">
                        Loading history...
                      </p>
                    </div>
                  ) : Array.isArray(history) && history.length > 0 ? (
                    history.map((chat) => (
                      <div
                        key={chat._id}
                        onClick={() => {
                          setMessages([
                            { role: "user", content: chat.userPrompt },
                            { role: "assistant", content: chat.aiResponse },
                          ]);
                          setLastPrompt(chat.userPrompt);
                          if (
                            typeof window !== "undefined" &&
                            window.innerWidth < 768
                          )
                            setIsSidebarOpen(false);
                        }}
                        className="group flex flex-row items-center justify-between gap-2 p-3 rounded-xl hover:bg-zinc-800/60 cursor-pointer transition-all border border-transparent hover:border-zinc-700"
                      >
                        <span className="text-sm text-zinc-200 font-medium truncate flex-1 group-hover:text-blue-400">
                          {chat.title || chat.userPrompt}
                        </span>
                        <button
                          onClick={(e) => deleteSingleChat(e, chat._id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all"
                          title="Delete chat"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center gap-3 mt-8 text-center px-4">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-2xl">
                        💬
                      </div>
                      <p className="text-xs text-zinc-500">
                        No chats yet. Start a conversation!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Clear all history */}
              <div className="p-4 border-t border-zinc-800">
                <Button
                  onClick={clearHistory}
                  variant="ghost"
                  className="w-full text-zinc-500 hover:text-red-400 hover:bg-red-400/10 text-xs justify-start gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  </svg>
                  Clear All History
                </Button>
              </div>

              {/* Account */}
              <div className="p-6 border-t border-zinc-800 flex items-center gap-4 bg-zinc-900/30">
                <UserButton />
                <span className="text-sm font-medium text-zinc-300">
                  Account
                </span>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ── RIGHT CONTENT AREA ──────────────────────────────────────────────── */}
      <div className="flex-1 relative flex flex-col h-full overflow-hidden transition-all duration-300">
        {/* Navbar */}
        <nav
          className={`absolute top-6 left-1/2 -translate-x-1/2 
          flex items-center py-3 px-8
          border border-zinc-500/80
          bg-zinc-900/60 backdrop-blur-xl
          shadow-[0_0_40px_rgba(0,0,0,0.6)]
          rounded-2xl z-50 transition-all duration-500 ease-in-out
          ${
            isSignedIn && isSidebarOpen
              ? "w-auto gap-6 justify-center"
              : "w-[90%] max-w-6xl justify-between"
          }`}
        >
          {(!isSignedIn || !isSidebarOpen) && (
            <div className="flex items-center gap-2 md:gap-4">
              {isSignedIn && !isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                  title="Open Sidebar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                  </svg>
                </button>
              )}
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  Hackathon<span className="text-blue-500">AI</span>
                </h1>
                <Hero3D />
              </div>
            </div>
          )}

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8 text-sm text-zinc-300">
            {/* FEATURES */}
            <InfoModal title="Core Features" triggerText="Features">
              <div className="space-y-4">
                <section>
                  <h4 className="font-bold text-white">
                    📄 Document Intelligence (RAG)
                  </h4>
                  <p>
                    Upload a PDF or TXT file and chat directly with its content.
                    Ask questions, get summaries — all grounded in your
                    document.
                  </p>
                </section>
                <section>
                  <h4 className="font-bold text-white">
                    🚀 Multiple AI Models
                  </h4>
                  <p>
                    Switch between LLaMA 3.3 70B, LLaMA 3.1 8B, Mixtral 8x7B,
                    and Gemma 2 9B — all powered by Groq for blazing-fast
                    responses.
                  </p>
                </section>
                <section>
                  <h4 className="font-bold text-white">💬 Conversation Mode</h4>
                  <p>
                    Full context memory within each session — the AI remembers
                    everything you said and builds on previous answers.
                  </p>
                </section>
                <section>
                  <h4 className="font-bold text-white">💾 Persistent Memory</h4>
                  <p>
                    Built with a Node.js/MongoDB backend to ensure your chat
                    history is securely stored and always accessible.
                  </p>
                </section>
                <section>
                  <h4 className="font-bold text-white">
                    🎨 Modern 3D Interface
                  </h4>
                  <p>
                    A high-performance UI featuring React Three Fiber and
                    glass-morphism design for an elite user experience.
                  </p>
                </section>
              </div>
            </InfoModal>

            {/* DOCS */}
            <InfoModal title="Documentation" triggerText="Docs">
              <div className="space-y-4">
                <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                  <p className="text-sm font-mono text-blue-400">
                    Stack: MERN + Next.js + Groq API + pdfjs-dist
                  </p>
                </div>
                <p>
                  <strong>Step 1:</strong> Sign in using Clerk to unlock your
                  personal history dashboard.
                </p>
                <p>
                  <strong>Step 2:</strong> Choose a model from the dropdown, or
                  click the 📎 paperclip to upload a PDF or TXT file and
                  activate Document Intelligence mode.
                </p>
                <p>
                  <strong>Step 3:</strong> Ask questions about your document or
                  chat freely. Use the sidebar to resume past conversations or
                  click New Chat to start fresh.
                </p>
              </div>
            </InfoModal>

            {/* ABOUT */}
            <InfoModal title="About the Project" triggerText="About">
              <p>
                HackathonAI was developed by <strong>Shreyansh</strong>, a
                3rd-year CS student, as a solution for seamless AI interaction.
              </p>
              <p>
                The goal was to create a production-ready Full-Stack application
                that demonstrates mastery over modern web technologies: Next.js
                for the frontend, Node/Express for the server logic, MongoDB for
                data persistence, and Groq for lightning-fast LLM inference.
              </p>
              <div className="flex gap-4 mt-6">
                <a
                  href="https://github.com/Shreyansh2025/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button
                    variant="outline"
                    className="w-full border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700 hover:text-blue-400 transition-all"
                  >
                    View GitHub
                  </Button>
                </a>
                <a
                  href="https://www.linkedin.com/in/shreyansh-surana-009206322/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button
                    variant="outline"
                    className="w-full border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700 hover:text-blue-400 transition-all"
                  >
                    LinkedIn
                  </Button>
                </a>
              </div>
            </InfoModal>
          </div>

          {/* Auth */}
          <div className="flex items-center min-h-[40px]">
            {!isLoaded ? null : isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <Button className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:opacity-90 text-white shadow-lg">
                  Sign In
                </Button>
              </SignInButton>
            )}
          </div>
        </nav>

        {/* ── CHAT MESSAGES AREA ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto relative z-10 flex flex-col items-center pt-32 md:pt-36 pb-4 px-4 md:px-8 w-full">
          <div className="flex flex-col w-full max-w-3xl mx-auto flex-1">
            {/* Not signed in */}
            {!isSignedIn && isLoaded && (
              <div className="flex items-start gap-3 mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4 max-w-lg mb-8">
                <div className="text-2xl">🤖</div>
                <div className="flex flex-col gap-3">
                  <p className="text-zinc-300 text-sm">
                    Hi! I'm HackathonAI. Please sign in to start chatting with
                    me.
                  </p>
                  <SignInButton mode="modal">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white w-fit">
                      Sign In to Continue
                    </Button>
                  </SignInButton>
                </div>
              </div>
            )}

            {/* Empty state */}
            {messages.length === 0 && isSignedIn && (
              <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-16">
                <div className="text-5xl">✨</div>
                <h2 className="text-3xl md:text-4xl font-semibold">
                  What do you want to build?
                </h2>
                <p className="text-zinc-500 text-sm">
                  Chat freely, or upload a PDF / TXT to talk with your document.
                </p>

                {/* Upload prompt card in empty state */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-blue-500 text-zinc-300 hover:text-white rounded-xl px-6 py-4 transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-400"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                  </svg>
                  <div className="text-left">
                    <p className="text-sm font-medium">Upload a document</p>
                    <p className="text-xs text-zinc-500">
                      PDF or TXT · up to 20 pages
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* ── CONVERSATION BUBBLES ──────────────────────────────────────── */}
            <div className="flex flex-col gap-6 w-full">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {/* AI avatar */}
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                      AI
                    </div>
                  )}

                  <div
                    className={`flex flex-col gap-2 max-w-[85%] ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    {/* User bubble */}
                    {msg.role === "user" ? (
                      <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                        {msg.content}
                      </div>
                    ) : (
                      /* AI bubble */
                      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 text-zinc-200 text-sm leading-relaxed w-full">
                        <div className="prose prose-invert max-w-none [&>p]:mb-3 [&>ul]:ml-4 [&>ul]:list-disc [&>ol]:ml-4 [&>ol]:list-decimal">
                          <ReactMarkdown components={markdownComponents}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        {/* blinking cursor while streaming */}
                        {isLoading && index === messages.length - 1 && (
                          <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1 align-middle" />
                        )}
                      </div>
                    )}

                    {/* ── Action buttons on AI messages ────────────────────── */}
                    {msg.role === "assistant" && !isLoading && (
                      <div className="flex items-center gap-2">
                        {/* Copy */}
                        <button
                          onClick={() => copyMessage(msg.content, index)}
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md hover:bg-zinc-800"
                        >
                          {copiedIndex === index ? (
                            <>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect
                                  x="9"
                                  y="9"
                                  width="13"
                                  height="13"
                                  rx="2"
                                  ry="2"
                                ></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                              Copy
                            </>
                          )}
                        </button>

                        {/* Regenerate — only on last AI message */}
                        {index === messages.length - 1 && (
                          <button
                            onClick={handleRegenerate}
                            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md hover:bg-zinc-800"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="23 4 23 10 17 10"></polyline>
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                            </svg>
                            Regenerate
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* User avatar */}
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                      You
                    </div>
                  )}
                </div>
              ))}
              {/* Anchor for auto-scroll */}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </main>

        {/* ── INPUT BOX pinned to bottom ───────────────────────────────────── */}
        <div className="relative z-20 px-4 md:px-8 pb-6 pt-3 border-t border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
            {/* ── Document badge — shown when a file is loaded ─────────────── */}
            {documentName && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg px-3 py-1.5 text-xs">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <span className="font-medium truncate max-w-[200px]">
                    {documentName}
                  </span>
                  <span className="text-blue-500/60">· RAG mode active</span>
                  <button
                    onClick={clearDocument}
                    className="ml-1 text-blue-400 hover:text-red-400 transition-colors"
                    title="Remove document"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* File error message */}
            {fileError && (
              <p className="text-xs text-red-400 px-1">{fileError}</p>
            )}

            {/* ── Personality selector ─────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500">Personality:</span>
              {PERSONALITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPersonality(p.id)}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 disabled:cursor-not-allowed
        ${
          selectedPersonality === p.id
            ? "bg-blue-600 border-blue-500 text-white"
            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        }`}
                >
                  <span>{p.emoji}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
            {/* Model selector */}
            <div className="flex items-center gap-2" ref={dropdownRef}>
              <span className="text-xs text-zinc-500">Model:</span>
              <div className="relative">
                <button
                  onClick={() => setIsModelDropdownOpen((prev) => !prev)}
                  disabled={isLoading}
                  className="flex items-center gap-2 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {/* green dot = active */}
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  <span className="font-medium">{currentModel.label}</span>
                  <span className="text-zinc-500">
                    {currentModel.description}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform ${
                      isModelDropdownOpen ? "rotate-180" : ""
                    }`}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {/* Dropdown menu */}
                {isModelDropdownOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50">
                    {MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-zinc-800 ${
                          selectedModel === model.id
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-300"
                        }`}
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="font-medium">{model.label}</span>
                          <span className="text-xs text-zinc-500">
                            {model.description}
                          </span>
                        </div>
                        {/* checkmark on selected */}
                        {selectedModel === model.id && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Input card */}
            <Tilt
              glareEnable={true}
              glareMaxOpacity={0.08}
              glareColor="#ffffff"
              glarePosition="all"
              tiltMaxAngleX={3}
              tiltMaxAngleY={3}
              className="w-full"
            >
              <Card className="w-full bg-zinc-900 border-zinc-700 shadow-2xl">
                <CardContent className="p-2 flex gap-2 items-center">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {/* Paperclip upload button */}
                  {isSignedIn && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading || isFileLoading}
                      title="Upload PDF or TXT"
                      className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {isFileLoading ? (
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                          ></path>
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                        </svg>
                      )}
                    </button>
                  )}

                  <Input
                    placeholder={
                      !isSignedIn
                        ? "Sign in to start chatting..."
                        : documentName
                          ? `Ask about ${documentName}...`
                          : "Ask HackathonAI anything..."
                    }
                    className="bg-transparent border-none text-white focus-visible:ring-0 focus-visible:ring-offset-0 text-md"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      !isLoading &&
                      isSignedIn &&
                      handleSend()
                    }
                    disabled={isLoading || !isSignedIn || isFileLoading}
                  />

                  <Button
                    onClick={() => handleSend()}
                    disabled={isLoading || !isSignedIn || isFileLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                          ></path>
                        </svg>
                        Thinking...
                      </span>
                    ) : (
                      "Send"
                    )}
                  </Button>
                </CardContent>
              </Card>
            </Tilt>

            {/* Conversation counter */}
            {messages.length > 0 && (
              <p className="text-center text-xs text-zinc-600">
                {messages.filter((m) => m.role === "user").length} message
                {messages.filter((m) => m.role === "user").length !== 1
                  ? "s"
                  : ""}{" "}
                in this conversation ·{" "}
                <button
                  onClick={startNewChat}
                  className="text-blue-500 hover:underline"
                >
                  New Chat
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
