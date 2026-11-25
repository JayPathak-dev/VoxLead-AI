import React from 'react';
import { Bot, User, FileText } from 'lucide-react';
import type { ChatTurn } from '../types';

export const ChatMessage: React.FC<{ turn: ChatTurn }> = ({ turn }) => {
  const isUser = turn.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
          isUser
            ? 'border-[#BEE6D2] bg-[#DDF2E7] text-[#16865A]'
            : 'border-[#E7ECE7] bg-[#F3F6F1] text-[#202923]'
        }`}
        aria-hidden="true"
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={`max-w-[82%] space-y-1.5 ${isUser ? 'items-end text-right' : 'items-start text-left'}`}>
        <div
          className={`inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-[#16865A] text-white'
              : 'border border-[#E7ECE7] bg-white text-[#202923] shadow-2xs'
          }`}
        >
          <p className="whitespace-pre-wrap">{turn.content}</p>
        </div>

        <div className={`flex flex-wrap items-center gap-2 text-[11px] text-[#78847D] ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span>{turn.timestamp}</span>
          {turn.sentiment && (
            <span className="rounded-md border border-[#E7ECE7] bg-[#FAFAF7] px-1.5 py-0.5 font-medium text-[#202923]">
              {turn.sentiment}
            </span>
          )}
          {turn.sources && turn.sources.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#DDF2E7] px-2 py-0.5 font-medium text-[#16865A]">
              <FileText className="h-3 w-3" aria-hidden="true" />
              <span>
                RAG: {Array.from(new Set(turn.sources.map((s) => s.filename))).join(', ')}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
