"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import Tilt from "react-parallax-tilt";
import ParticlesBackground from "./ParticlesBackground";
import Hero3D from "./Hero3D";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { InfoModal } from "./InfoModel";

const API_BASE_URL = "https://chatbot-ai-2kjk.onrender.com";
export default function Home() {
  const { isSignedIn, isLoaded, user } = useUser();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const fetchHistory = async () => {
    if (!user?.id) return;
    setIsHistoryLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/history?userId=${user.id}`,
      );
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      console.error("Could not fetch history:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!user?.id || !confirm("Are you sure you want to delete all chats?"))
      return;

    try {
      await fetch(`${API_BASE_URL}/api/history/${user.id}`, {
        method: "DELETE",
      });
      setHistory([]);
      setResponse(""); // Clear current display
    } catch (error) {
      console.error("Failed to clear history", error);
    }
  };
  const deleteSingleChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // 👈 Prevents the chat from "opening" when you click delete
    if (!confirm("Delete this chat?")) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/history/chat/${chatId}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        fetchHistory(); // Refresh the list
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  useEffect(() => {
    if (isSignedIn) {
      fetchHistory();
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  const handleSend = async () => {
    if (!prompt) return;

    setIsLoading(true);
    setResponse("");
    const currentPrompt = prompt;
    setPrompt("");

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY as string;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const result = await model.generateContent(currentPrompt);
      const text = result.response.text();

      setResponse(text);

      try {
        await fetch("${API_BASE_URL}/api/save-prompt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user?.id,
            userPrompt: currentPrompt,
            aiResponse: text,
          }),
        });
        fetchHistory();
      } catch (dbError) {
        console.error("Warning: Could not save to database.", dbError);
      }
    } catch (error) {
      console.error(error);
      setResponse("Oops! Something went wrong. Check your API key.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden relative">
      <ParticlesBackground />

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

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-2">
                  Recent Chats
                </h3>
                <div className="flex flex-col gap-2">
                  {/* --- LOADING SPINNER LOGIC --- */}
                  {isHistoryLoading ? (
                    <div className="flex flex-col items-center gap-2 mt-4">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs text-zinc-500">
                        Loading history...
                      </p>
                    </div>
                  ) : Array.isArray(history) && history.length > 0 ? (
                    history.map((chat, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          setResponse(chat.aiResponse);
                          if (window.innerWidth < 768) setIsSidebarOpen(false);
                        }}
                        className="group flex flex-row items-center justify-between gap-2 p-3 rounded-xl hover:bg-zinc-800/60 cursor-pointer transition-all border border-transparent hover:border-zinc-700"
                      >
                        <span className="text-sm text-zinc-200 font-medium truncate flex-1 group-hover:text-blue-400">
                          {chat.userPrompt}
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
                    <p className="text-xs text-zinc-600 px-2 italic">
                      No recent chats found.
                    </p>
                  )}
                </div>
              </div>

              {/* --- CLEAR HISTORY BUTTON --- */}
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

      {/* ... Rest of your Navbar and Main chat area remain the same ... */}

      {/* ========================================== */}
      {/* 2. RIGHT CONTENT AREA (Navbar + Chat)      */}
      {/* ========================================== */}
      <div className="flex-1 relative flex flex-col h-full overflow-hidden transition-all duration-300">
        {/* DYNAMIC NAVBAR */}
        <nav
          className={`absolute top-6 left-1/2 -translate-x-1/2 
          flex items-center py-3 px-8
          border border-zinc-500/80
          bg-zinc-900/60 backdrop-blur-xl
          shadow-[0_0_40px_rgba(0,0,0,0.6)]
          rounded-2xl
          z-50 transition-all duration-500 ease-in-out
          ${
            isSignedIn && isSidebarOpen
              ? "w-auto gap-6 justify-center"
              : "w-[90%] max-w-6xl justify-between"
          }`}
        >
          {/* FIX: Wrapped the Button and Logo in a single group so they stay together! */}
          {(!isSignedIn || !isSidebarOpen) && (
            <div className="flex items-center gap-2 md:gap-4">
              {/* Toggle Button */}
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

              {/* Logo */}
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  Hackathon<span className="text-blue-500">AI</span>
                </h1>
                <Hero3D />
              </div>
            </div>
          )}

          {/* Links */}
          <div className="hidden md:flex items-center gap-8 text-sm text-zinc-300">
            {/* FEATURES */}
            <InfoModal title="Core Features" triggerText="Features">
              <div className="space-y-4">
                <section>
                  <h4 className="font-bold text-white">
                    🚀 Gemini 2.5 Intelligence
                  </h4>
                  <p>
                    Harnessing the power of Google's latest model for code
                    debugging, creative writing, and technical analysis.
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
                    Stack: MERN + Next.js + Gemini API
                  </p>
                </div>
                <p>
                  <strong>Step 1:</strong> Sign in using Clerk to unlock your
                  personal history dashboard.
                </p>
                <p>
                  <strong>Step 2:</strong> Enter your query in the 3D-tilt input
                  box. You can ask for C++ code, project ideas, or deep learning
                  explanations.
                </p>
                <p>
                  <strong>Step 3:</strong> Access past conversations from the
                  sliding sidebar to resume previous work.
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
                for the frontend, Node/Express for the server logic, and MongoDB
                for data persistence.
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

        {/* MAIN SCROLLABLE CHAT AREA */}
        <main className="flex-1 overflow-y-auto relative z-10 flex flex-col items-center pt-32 md:pt-40 p-8 w-full">
          <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
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

            <div className="text-center w-full">
              <h2 className="text-4xl font-semibold">
                What do you want to build?
              </h2>
            </div>

            <Tilt
              glareEnable={true}
              glareMaxOpacity={0.15}
              glareColor="#ffffff"
              glarePosition="all"
              tiltMaxAngleX={5}
              tiltMaxAngleY={5}
              className="w-full max-w-2xl mt-8"
            >
              <Card className="w-full bg-zinc-900 border-zinc-700 shadow-2xl">
                <CardContent className="p-2 flex gap-2 items-center">
                  <Input
                    placeholder={
                      isSignedIn
                        ? "Ask HackathonAI anything..."
                        : "Sign in to start chatting..."
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
                    disabled={isLoading || !isSignedIn}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || !isSignedIn}
                    className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Thinking..." : "Send"}
                  </Button>
                </CardContent>
              </Card>
            </Tilt>

            {response && (
              <Card className="w-full bg-zinc-900 border-zinc-700 p-6 text-zinc-300 leading-relaxed overflow-x-auto mt-8 mb-12 shadow-xl">
                <div className="flex flex-col gap-4 [&>h1]:text-2xl [&>h1]:font-bold [&>h2]:text-xl [&>h2]:font-semibold [&>ul]:list-disc [&>ul]:ml-6 [&>pre]:bg-zinc-950 [&>pre]:p-4 [&>pre]:rounded-md [&>code]:text-blue-400">
                  <ReactMarkdown>{response}</ReactMarkdown>
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
