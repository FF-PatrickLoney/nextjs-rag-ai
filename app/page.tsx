"use client";
import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function createIndexAndEmbeddings() {
    try {
      const result = await fetch("/api/setup", {
        method: "POST",
      });
      const json = await result.json();
      console.log("result: ", json);
    } catch (error) {
      console.log("[Error]: ", error);
    }
  }

  async function sendQuery() {
    if (!query) return;
    setResult("");
    setLoading(true);
    try {
      const result = await fetch("api/read", {
        method: "POST",
        body: JSON.stringify(query),
      });
      const json = await result.json();
      setResult(json.data);
      setLoading(false);
    } catch (error) {
      console.log("[Error]: ", error);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start gap-8 p-24 bg-indigo-950">
      <div>
        <label
          htmlFor="ask_ai"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Insert your prompt:
        </label>
        <input
          type="text"
          id="ask_ai"
          className="min-w-[500px] bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder="Ask me about Advisor.Cash"
          required
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <button
        className="text-white bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-cyan-300 dark:focus:ring-cyan-800 font-medium rounded-lg text-xl px-5 py-2.5 text-center me-2 mb-2"
        onClick={sendQuery}
      >
        Ask AI!
      </button>
      {loading && <p>Asking AI...</p>}
      {result && <p>{result}</p>}
      <button
        onClick={createIndexAndEmbeddings}
        className="text-cyan-500 font-bold"
      >
        Create index and embeddings
      </button>
    </main>
  );
}
