"use client";

import { useState } from "react";

export function PromptCard({
  title,
  purpose,
  editHints,
  body,
}: {
  title: string;
  purpose: string;
  editHints: string;
  body: string;
}) {
  const [copied, setCopied] = useState(false);

  function fallbackCopy() {
    const textarea = document.createElement("textarea");
    textarea.value = body;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  async function handleCopy() {
    // navigator.clipboard は権限ダイアログの応答待ちで無期限にハングする環境がある
    // (サンドボックス化ブラウザ等)ため、reject だけでなく無応答も execCommand へ
    // フォールバックできるよう timeout つきで競わせる。
    const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 500));
    try {
      const result = await Promise.race([navigator.clipboard.writeText(body), timeout]);
      if (result === "timeout") {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
      <p className="text-xs text-zinc-600">
        <span className="font-medium">このプロンプトの目的: </span>
        {purpose}
      </p>
      <p className="text-xs text-zinc-600">
        <span className="font-medium">修正するときの観点: </span>
        {editHints}
      </p>
      <pre className="max-h-64 overflow-auto rounded bg-zinc-50 p-3 text-xs whitespace-pre-wrap text-zinc-800">
        {body}
      </pre>
    </div>
  );
}
