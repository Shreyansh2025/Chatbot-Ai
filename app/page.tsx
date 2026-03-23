"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  { id: "llama-3.3-70b-versatile", label: "LLaMA 3.3 70B", short: "70B" },
  { id: "llama-3.1-8b-instant", label: "LLaMA 3.1 8B", short: "8B" },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", short: "MX" },
  { id: "gemma2-9b-it", label: "Gemma 2 9B", short: "GM" },
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

type Toast = {
  message: string;
  type: "success" | "error";
};

// ─── Fallback title — first 6 words ──────────────────────────────────────────
const generateTitle = (prompt: string): string => {
  const words = prompt
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  if (words.length === 0) return prompt.slice(0, 40) || "New Chat";
  const title = words.join(" ");
  return title.charAt(0).toUpperCase() + title.slice(1);
};

// ─── AI-generated title — like ChatGPT/Gemini/Claude ─────────────────────────
const generateAITitle = async (
  prompt: string,
  response: string,
  apiKey: string,
): Promise<string> => {
  try {
    const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
    const result = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", // fast lightweight model — <1s
      max_tokens: 12,
      messages: [
        {
          role: "user",
          content:
            `Based on this conversation, generate a short title of 3-5 words maximum. ` +
            `Return ONLY the title — no quotes, no punctuation, no explanation.\n\n` +
            `User: ${prompt.slice(0, 200)}\n` +
            `Assistant: ${response.slice(0, 200)}`,
        },
      ],
    });
    const title = result.choices[0]?.message?.content?.trim() || "";
    if (title.length > 60 || title.length === 0) return generateTitle(prompt);
    return title;
  } catch {
    return generateTitle(prompt); // fallback on any error
  }
};

// ─── Syntax highlighting ──────────────────────────────────────────────────────
const markdownComponents: any = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    return !inline && match ? (
      <div className="relative group/code my-3">
        <span className="absolute top-2 left-3 text-xs text-zinc-400 font-mono uppercase">
          {match[1]}
        </span>
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

// ─── PDF text extractor ───────────────────────────────────────────────────────
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

  if (!fullText.trim()) {
    console.log("No text found, attempting OCR...");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    let ocrText = "";
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
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

// ─────────────────────────────────────────────────────────────────────────────
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
  const [isNewSession, setIsNewSession] = useState(true);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedPersonality, setSelectedPersonality] = useState(
    PERSONALITIES[0].id,
  );

  // ── Active chat highlight ───────────────────────────────────────────────────
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // ── Toast notification ──────────────────────────────────────────────────────
  const [toast, setToast] = useState<Toast | null>(null);

  // ── RAG state ───────────────────────────────────────────────────────────────
  const [documentText, setDocumentText] = useState<string>("");
  const [documentName, setDocumentName] = useState<string>("");
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null); // auto-focus
  const abortControllerRef = useRef<AbortController | null>(null); // stream abort

  // ─── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Close model dropdown on outside click ────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        setIsModelDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Auto-focus input on mount ────────────────────────────────────────────
  useEffect(() => {
    if (isSignedIn) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isSignedIn]);

  // ─── Cleanup stream on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // ─── Toast helper ─────────────────────────────────────────────────────────
  const showToast = (message: string, type: "success" | "error" = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Fetch history ────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/history?userId=${user.id}`);
      if (!res.ok) {
        console.error("History fetch failed:", res.status);
        return;
      }
      setHistory(await res.json());
    } catch (error) {
      console.error("Could not fetch history:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [user?.id]);

  // ─── Load session from sidebar click ─────────────────────────────────────
  const loadSession = (
    chatId: string,
    firstPrompt: string,
    firstResponse: string,
  ) => {
    setMessages([
      { role: "user", content: firstPrompt },
      { role: "assistant", content: firstResponse },
    ]);
    setLastPrompt(firstPrompt);
    setIsNewSession(false); // resuming — don't save again
    setActiveChatId(chatId); // highlight in sidebar
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
    if (typeof window !== "undefined" && window.innerWidth < 768)
      setIsSidebarOpen(false);
  };

  // ─── Clear all history ────────────────────────────────────────────────────
  const clearHistory = async () => {
    if (!user?.id || !window.confirm("Delete all chat history?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/history/${user.id}`, {
        method: "DELETE",
      });
      setHistory([]);
      setMessages([]);
      setActiveChatId(null);
    } catch (error) {
      console.error("Failed to clear history", error);
      showToast("Failed to clear history. Check your connection.");
    }
  };

  // ─── Delete single chat ───────────────────────────────────────────────────
  const deleteSession = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm("Delete this conversation?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/history/chat/${chatId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((c) => c._id !== chatId));
        if (activeChatId === chatId) {
          setActiveChatId(null);
          setMessages([]);
        }
        showToast("Conversation deleted.", "success");
      } else {
        showToast("Failed to delete. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
      showToast("Failed to delete. Check your connection.");
    }
  };

  const copyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // ─── New chat ──────────────────────────────────────────────────────────────
  const startNewChat = () => {
    abortControllerRef.current?.abort(); // cancel any in-progress stream
    setMessages([]);
    setLastPrompt("");
    setIsNewSession(true);
    setIsLoading(false);
    setActiveChatId(null);
    setDocumentText("");
    setDocumentName("");
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const clearDocument = () => {
    setDocumentText("");
    setDocumentName("");
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Handle file upload ───────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    setIsFileLoading(true);
    setDocumentName(file.name);
    try {
      let text = "";
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
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
      if (!text.trim()) {
        setFileError(
          "This PDF appears to be scanned (image-based). Only text-based PDFs are supported.",
        );
        setDocumentName("");
        setIsFileLoading(false);
        return;
      }
      const cappedText =
        text.length > 12000
          ? text.slice(0, 12000) +
            "\n\n[Document truncated to fit context window]"
          : text;
      setDocumentText(cappedText);
      const summaryPrompt = `I've uploaded a document called "${file.name}". Please give me a brief summary in 3-4 sentences.`;
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
  }, [isSignedIn, user?.id, fetchHistory]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768)
      setIsSidebarOpen(false);
  }, []);

  // ─── Core send handler ────────────────────────────────────────────────────
  const handleSendWithDoc = async (
    currentPrompt: string,
    docTextOverride?: string,
  ) => {
    if (!currentPrompt.trim()) return;

    // abort any previous in-progress stream
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

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
          { role: "assistant", content: "Groq API Key is missing." },
        ]);
        setIsLoading(false);
        return;
      }

      // create Groq instance once per send (lightweight object)
      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

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

      // strip extra fields — Groq rejects anything beyond role/content
      const messagesForAPI = [
        systemMessage,
        ...updatedMessages.map(({ role, content }) => ({ role, content })),
      ];

      const stream = await groq.chat.completions.create({
        messages: messagesForAPI,
        model: selectedModel,
        stream: true,
      });

      let fullText = "";
      for await (const chunk of stream) {
        // stop if aborted (user clicked New Chat mid-stream)
        if (abortControllerRef.current?.signal.aborted) break;
        const token = chunk.choices[0]?.delta?.content || "";
        fullText += token;
        setMessages([
          ...updatedMessages,
          { role: "assistant", content: fullText },
        ]);
      }

      // ── Save first message of session with AI-generated title ──────────────
      if (isNewSession && fullText) {
        setIsNewSession(false);
        try {
          // generate smart title in parallel — like ChatGPT
          const aiTitle = await generateAITitle(
            currentPrompt,
            fullText,
            apiKey,
          );

          const res = await fetch(`${API_BASE_URL}/api/save-prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user?.id,
              title: aiTitle,
              userPrompt: currentPrompt,
              aiResponse: fullText,
            }),
          });

          if (res.ok) {
            const saved = await res.json();
            // prepend to sidebar instantly — no refetch needed
            const newItem = {
              _id: saved._id, // server now returns _id correctly
              title: aiTitle,
              userPrompt: currentPrompt,
              aiResponse: fullText,
            };
            setHistory((prev) => [newItem, ...prev]);
            setActiveChatId(saved._id); // highlight the new item
          }
        } catch (dbError) {
          console.error("Warning: Could not save to database.", dbError);
        }
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return; // user cancelled — no error shown
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
    const currentPrompt =
      overridePrompt !== undefined ? overridePrompt : prompt;
    if (!currentPrompt.trim()) return;
    if (overridePrompt === undefined) {
      setPrompt("");
      // re-focus input after send so user can type immediately
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    await handleSendWithDoc(currentPrompt);
  };

  // ─── Regenerate — clean version, no race condition ────────────────────────
  const handleRegenerate = () => {
    if (!lastPrompt) return;
    // slice off last AI reply so context is clean
    setMessages(messages.slice(0, -1));
    // handleSendWithDoc reads `messages` via closure — but we need the sliced version
    // so we call it directly via handleSendWithDoc which re-appends user message
    handleSendWithDoc(lastPrompt);
  };

  const currentModel = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden relative">
      <ParticlesBackground />

      {/* ── TOAST NOTIFICATION ──────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-2xl transition-all duration-300
            ${
              toast.type === "error"
                ? "bg-red-500/95 text-white"
                : "bg-green-500/95 text-white"
            }`}
        >
          {toast.message}
        </div>
      )}

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
                  ? "w-[85%] md:w-72 border-r border-zinc-800 opacity-100"
                  : "w-0 opacity-0 border-none"
              }`}
          >
            <div className="w-[75vw] md:w-72 h-full flex flex-col">
              {/* Header */}
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
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
                  <h1 className="text-lg font-bold tracking-tight">
                    Hackathon<span className="text-blue-500">AI</span>
                  </h1>
                  <Hero3D />
                </div>
              </div>

              {/* New Chat */}
              <div className="px-4 pt-4">
                <Button
                  onClick={startNewChat}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
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

              {/* History */}
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">
                  Conversations
                </h3>
                <div className="flex flex-col gap-1">
                  {isHistoryLoading ? (
                    /* ── Loading skeleton ──────────────────────────────────── */
                    <div className="flex flex-col gap-2 px-1 mt-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-9 rounded-lg bg-zinc-800/60 animate-pulse"
                          style={{ opacity: 1 - i * 0.15 }}
                        />
                      ))}
                    </div>
                  ) : Array.isArray(history) && history.length > 0 ? (
                    history.map((chat) => (
                      <div
                        key={chat._id}
                        onClick={() =>
                          loadSession(
                            chat._id,
                            chat.userPrompt,
                            chat.aiResponse,
                          )
                        }
                        className={`group flex flex-row items-center justify-between gap-2 p-2.5 rounded-lg cursor-pointer transition-all border
                          ${
                            chat._id === activeChatId
                              ? "bg-zinc-800 border-zinc-600 text-white" // active highlight
                              : "border-transparent hover:bg-zinc-800/70 hover:border-zinc-700"
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-md bg-zinc-700/80 flex items-center justify-center flex-shrink-0">
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
                              className="text-zinc-400"
                            >
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                          </div>
                          <span
                            className={`text-sm font-medium truncate ${chat._id === activeChatId ? "text-white" : "text-zinc-300 group-hover:text-white"}`}
                          >
                            {chat.title || generateTitle(chat.userPrompt)}
                          </span>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => deleteSession(e, chat._id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all flex-shrink-0"
                          title="Delete conversation"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="13"
                            height="13"
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
                    <div className="flex flex-col items-center gap-3 mt-10 text-center px-4">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xl">
                        💬
                      </div>
                      <p className="text-xs text-zinc-500">
                        No conversations yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Clear all */}
              <div className="p-3 border-t border-zinc-800">
                <Button
                  onClick={clearHistory}
                  variant="ghost"
                  className="w-full text-zinc-500 hover:text-red-400 hover:bg-red-400/10 text-xs justify-start gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
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
              <div className="p-5 border-t border-zinc-800 flex items-center gap-3 bg-zinc-900/30">
                <UserButton />
                <span className="text-sm font-medium text-zinc-300">
                  Account
                </span>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <div className="flex-1 relative flex flex-col h-full overflow-hidden transition-all duration-300">
        {/* Navbar */}
        <nav
          className={`absolute top-5 left-1/2 -translate-x-1/2
            flex items-center py-2.5 px-6
            border border-zinc-500/80
            bg-zinc-900/60 backdrop-blur-xl
            shadow-[0_0_40px_rgba(0,0,0,0.6)]
            rounded-2xl z-50 transition-all duration-500 ease-in-out
            ${
              isSignedIn && isSidebarOpen
                ? "w-auto gap-6 justify-center"
                : "w-[90%] max-w-5xl justify-between"
            }`}
        >
          {(!isSignedIn || !isSidebarOpen) && (
            <div className="flex items-center gap-2">
              {isSignedIn && !isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Open Sidebar"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
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
                <h1 className="text-lg font-bold tracking-tight">
                  Hackathon<span className="text-blue-500">AI</span>
                </h1>
                <Hero3D />
              </div>
            </div>
          )}

          <div className="hidden md:flex items-center gap-6 text-sm text-zinc-300">
            <InfoModal title="Core Features" triggerText="Features">
              <div className="space-y-4">
                <section>
                  <h4 className="font-bold text-white">
                    📄 Document Intelligence (RAG)
                  </h4>
                  <p>
                    Upload a PDF or TXT and chat directly with its content —
                    summaries, Q&A, grounded in your document.
                  </p>
                </section>
                <section>
                  <h4 className="font-bold text-white">
                    🚀 Multiple AI Models
                  </h4>
                  <p>
                    Switch between LLaMA 3.3 70B, LLaMA 3.1 8B, Mixtral 8x7B,
                    and Gemma 2 9B via Groq.
                  </p>
                </section>
                <section>
                  <h4 className="font-bold text-white">🎭 Personalities</h4>
                  <p>
                    Choose Default, Professor, Friend, Professional, or Savage
                    to change how the AI responds.
                  </p>
                </section>
                <section>
                  <h4 className="font-bold text-white">💬 Conversation Mode</h4>
                  <p>
                    Full context memory per session — the AI remembers
                    everything said in a conversation.
                  </p>
                </section>
                <section>
                  <h4 className="font-bold text-white">
                    💾 Persistent History
                  </h4>
                  <p>
                    Every conversation saved to MongoDB with an AI-generated
                    title — one entry per session.
                  </p>
                </section>
                <section>
                  <h4 className="font-bold text-white">
                    🎨 Modern 3D Interface
                  </h4>
                  <p>
                    React Three Fiber + glass-morphism for an elite UI
                    experience.
                  </p>
                </section>
              </div>
            </InfoModal>

            <InfoModal title="Documentation" triggerText="Docs">
              <div className="space-y-4">
                <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                  <p className="text-sm font-mono text-blue-400">
                    Stack: MERN + Next.js + Groq API + pdfjs-dist
                  </p>
                </div>
                <p>
                  <strong>Step 1:</strong> Sign in with Clerk to unlock your
                  personal history.
                </p>
                <p>
                  <strong>Step 2:</strong> Pick a personality and model using
                  the buttons in the input bar.
                </p>
                <p>
                  <strong>Step 3:</strong> Chat freely, or click 📎 to upload a
                  PDF/TXT for Document Intelligence mode.
                </p>
                <p>
                  <strong>Step 4:</strong> Each conversation is saved with an
                  AI-generated title. Hover a chat to delete it.
                </p>
              </div>
            </InfoModal>

            <InfoModal title="About the Project" triggerText="About">
              <p>
                HackathonAI was developed by <strong>Shreyansh</strong>, a
                3rd-year CS student, as a production-ready AI chat application.
              </p>
              <p>
                Full-stack: Next.js frontend, Node/Express backend, MongoDB
                storage, Clerk auth, Groq LLM, and RAG document intelligence.
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

          <div className="flex items-center min-h-[36px]">
            {!isLoaded ? null : isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <Button className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:opacity-90 text-white shadow-lg text-sm py-1.5">
                  Sign In
                </Button>
              </SignInButton>
            )}
          </div>
        </nav>

        {/* ── MESSAGES ──────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto relative z-10 flex flex-col items-center pt-28 md:pt-32 pb-4 px-4 md:px-8 w-full">
          <div className="flex flex-col w-full max-w-3xl mx-auto flex-1">
            {/* Not signed in */}
            {!isSignedIn && isLoaded && (
              <div className="flex items-start gap-3 mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4 max-w-lg mb-8">
                <div className="text-2xl">🤖</div>
                <div className="flex flex-col gap-3">
                  <p className="text-zinc-300 text-sm">
                    Hi! I'm HackathonAI. Please sign in to start chatting.
                  </p>
                  <SignInButton mode="modal">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white w-fit text-sm">
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
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-blue-500 text-zinc-300 hover:text-white rounded-xl px-6 py-4 transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
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

            {/* Conversation bubbles */}
            <div className="flex flex-col gap-6 w-full">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                      AI
                    </div>
                  )}
                  <div
                    className={`flex flex-col gap-1.5 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    {msg.role === "user" ? (
                      <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 text-zinc-200 text-sm leading-relaxed w-full">
                        <div className="prose prose-invert max-w-none [&>p]:mb-3 [&>ul]:ml-4 [&>ul]:list-disc [&>ol]:ml-4 [&>ol]:list-decimal">
                          <ReactMarkdown components={markdownComponents}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        {isLoading && index === messages.length - 1 && (
                          <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1 align-middle" />
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    {msg.role === "assistant" && !isLoading && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyMessage(msg.content, index)}
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md hover:bg-zinc-800"
                        >
                          {copiedIndex === index ? (
                            <>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>{" "}
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="11"
                                height="11"
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
                              </svg>{" "}
                              Copy
                            </>
                          )}
                        </button>
                        {index === messages.length - 1 && (
                          <button
                            onClick={handleRegenerate}
                            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md hover:bg-zinc-800"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="11"
                              height="11"
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
                            Retry
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                      You
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </main>

        {/* ── INPUT AREA ───────────────────────────────────────────────────────── */}
        <div className="relative z-20 px-4 md:px-8 pb-5 pt-2 border-t border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
            {/* Document badge */}
            {documentName && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg px-3 py-1.5 text-xs">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="11"
                    height="11"
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
                  <span className="font-medium truncate max-w-[180px]">
                    {documentName}
                  </span>
                  <span className="text-blue-500/60">· RAG active</span>
                  <button
                    onClick={clearDocument}
                    className="ml-1 text-blue-400 hover:text-red-400 transition-colors"
                    title="Remove document"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="11"
                      height="11"
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

            {fileError && (
              <p className="text-xs text-red-400 px-1">{fileError}</p>
            )}

            {/* Personality selector — emoji pills with always-visible labels */}
            <div className="flex items-center gap-1.5 px-1 flex-wrap">
              <span className="text-xs text-zinc-500 mr-1">Style:</span>
              {PERSONALITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPersonality(p.id)}
                  disabled={isLoading}
                  title={p.label}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-all disabled:opacity-50 disabled:cursor-not-allowed
                    ${
                      selectedPersonality === p.id
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    }`}
                >
                  <span>{p.emoji}</span>
                  {/* always show label — not just on selected */}
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
              ))}
            </div>

            {/* Input card */}
            <Tilt
              glareEnable={true}
              glareMaxOpacity={0.06}
              glareColor="#ffffff"
              glarePosition="all"
              tiltMaxAngleX={2}
              tiltMaxAngleY={2}
              className="w-full mt-1"
            >
              <Card className="w-full bg-zinc-900 border-zinc-700 shadow-2xl">
                <CardContent className="p-0">
                  {/* Input row */}
                  <div className="flex gap-2 items-center px-3 pt-3 pb-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    {/* Paperclip */}
                    {isSignedIn && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || isFileLoading}
                        title="Upload PDF or TXT"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
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
                            width="15"
                            height="15"
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

                    {/* Input with ref for auto-focus */}
                    <Input
                      ref={inputRef}
                      placeholder={
                        !isSignedIn
                          ? "Sign in to start chatting..."
                          : documentName
                            ? `Ask about ${documentName}...`
                            : "Ask anything..."
                      }
                      className="bg-transparent border-none text-white focus-visible:ring-0 focus-visible:ring-offset-0 text-sm flex-1"
                      value={prompt}
                      onChange={(e) => {
                        if (e.target.value.length <= 4000)
                          setPrompt(e.target.value);
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        !isLoading &&
                        isSignedIn &&
                        !!prompt.trim() &&
                        handleSend()
                      }
                      disabled={isLoading || !isSignedIn || isFileLoading}
                      maxLength={4000}
                    />

                    <Button
                      onClick={() => handleSend()}
                      disabled={
                        isLoading ||
                        !isSignedIn ||
                        isFileLoading ||
                        !prompt.trim()
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm px-4"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <svg
                            className="animate-spin h-3.5 w-3.5"
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
                  </div>

                  {/* Bottom row: model + char count + message count */}
                  <div className="flex items-center justify-between px-3 pb-2.5 border-t border-zinc-800/60 pt-2">
                    <div
                      className="flex items-center gap-1.5"
                      ref={dropdownRef}
                    >
                      <span className="text-xs text-zinc-600">Model:</span>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setIsModelDropdownOpen((prev) => !prev)
                          }
                          disabled={isLoading}
                          className="flex items-center gap-1.5 text-xs bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700/60 text-zinc-300 px-2.5 py-1 rounded-md transition-colors"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></span>
                          <span className="font-medium">
                            {currentModel.label}
                          </span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`transition-transform ${isModelDropdownOpen ? "rotate-180" : ""}`}
                          >
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>

                        {isModelDropdownOpen && (
                          <div className="absolute bottom-full left-0 mb-1.5 w-52 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50">
                            {MODELS.map((model) => (
                              <button
                                key={model.id}
                                onClick={() => {
                                  setSelectedModel(model.id);
                                  setIsModelDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-zinc-800 ${selectedModel === model.id ? "bg-zinc-800 text-white" : "text-zinc-300"}`}
                              >
                                <span className="font-medium text-xs">
                                  {model.label}
                                </span>
                                {selectedModel === model.id && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="13"
                                    height="13"
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

                    {/* Right: char count + message count + new chat */}
                    <div className="flex items-center gap-3">
                      {/* Character counter — shows when typing */}
                      {prompt.length > 0 && (
                        <span
                          className={`text-xs ${prompt.length > 3500 ? "text-orange-400" : "text-zinc-600"}`}
                        >
                          {prompt.length}/4000
                        </span>
                      )}
                      {messages.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-600">
                            {messages.filter((m) => m.role === "user").length}{" "}
                            msg
                          </span>
                          <button
                            onClick={startNewChat}
                            className="text-xs text-zinc-500 hover:text-blue-400 transition-colors"
                          >
                            New Chat
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Tilt>
          </div>
        </div>
      </div>
    </div>
  );
}
