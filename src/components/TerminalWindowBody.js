import React, { useEffect, useRef, useState } from 'react';

const TERMINAL_PROMPT = '> > C:\\Users\\G>';
const TYPE_SPEED_MS = 22;

function TerminalStaticLine({ text }) {
  return (
    <div className="terminal-line">
      <span className="terminal-prompt">{TERMINAL_PROMPT} </span>
      <span>{text}</span>
    </div>
  );
}

function TerminalAnimatedLine({ lineId, text, onComplete, typeSpeedMs = TYPE_SPEED_MS }) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    setVisibleLength(0);

    if (!text) {
      if (onComplete) onComplete(lineId);
      return undefined;
    }

    let nextLength = 0;
    const timerId = window.setInterval(() => {
      nextLength += 1;
      setVisibleLength(nextLength);
      if (nextLength >= text.length) {
        window.clearInterval(timerId);
        if (onComplete) onComplete(lineId);
      }
    }, typeSpeedMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [lineId, onComplete, text, typeSpeedMs]);

  return (
    <div className="terminal-line">
      <span className="terminal-prompt">{TERMINAL_PROMPT} </span>
      <span>{text.slice(0, visibleLength)}</span>
    </div>
  );
}

function TerminalPromptActions({ prompt, onAcceptPrompt, onRejectPrompt }) {
  if (!prompt?.active || (prompt.stage !== 'choice' && prompt.stage !== 'accept-pending')) {
    return null;
  }

  const isPendingAccept = prompt.stage === 'accept-pending';

  return (
    <div className="terminal-line terminal-line--prompt-actions">
      <button
        type="button"
        className="terminal-choice-btn"
        onClick={onAcceptPrompt}
        disabled={isPendingAccept}
      >
        [ДА]
      </button>
      <button
        type="button"
        className="terminal-choice-btn"
        onClick={onRejectPrompt}
        disabled={!!prompt.noDisabled || isPendingAccept}
      >
        [НЕТ]
      </button>
    </div>
  );
}

export default function TerminalWindowBody({
  placeholder,
  seedLines,
  runtimeLines,
  onCompleteLine,
  prompt,
  onAcceptPrompt,
  onRejectPrompt,
  onResetPrompt,
}) {
  const lines = [...seedLines, ...runtimeLines];
  const firstPendingLineId = runtimeLines.find((line) => line.status === 'pending')?.id || null;
  const bodyRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length, firstPendingLineId, prompt?.active, prompt?.stage]);

  return (
    <div className="terminal">
      <div className="terminal-body" ref={bodyRef}>
        {lines.length === 0 ? (
          <div className="terminal-line terminal-line--muted">
            {placeholder || `${TERMINAL_PROMPT} ожидание ввода...`}
          </div>
        ) : lines.map((line) => {
          const isSeedLine = seedLines.some((seedLine) => seedLine.id === line.id);
          const isPending = !isSeedLine && line.id === firstPendingLineId && line.status === 'pending';
          const isQueuedPending = !isSeedLine && line.status === 'pending' && line.id !== firstPendingLineId;

          if (isQueuedPending) {
            return null;
          }

          if (isPending) {
            return (
              <TerminalAnimatedLine
                key={line.id}
                lineId={line.id}
                text={line.text || ''}
                onComplete={onCompleteLine}
                typeSpeedMs={line.typeSpeedMs}
              />
            );
          }

          return <TerminalStaticLine key={line.id} text={line.text || ''} />;
        })}

        <TerminalPromptActions
          prompt={prompt}
          onAcceptPrompt={onAcceptPrompt}
          onRejectPrompt={onRejectPrompt}
        />

        {prompt?.active && prompt.stage === 'rejected' && !firstPendingLineId ? (
          <button type="button" className="terminal-reset-btn" onClick={onResetPrompt}>
            [ПРОДОЛЖИТЬ]
          </button>
        ) : null}
      </div>
    </div>
  );
}
