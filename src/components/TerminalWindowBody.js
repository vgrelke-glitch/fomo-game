import React, { useEffect, useRef, useState } from 'react';

const TERMINAL_PROMPT = '> > C:\\Users\\G>';
const TYPE_SPEED_MS = 22;
const ADVENTURE_PROMPT_LINE_TEXT = 'запустить_процесс: приключение.ехе?..';
const TERMINAL_PRINT_AUDIO_SRC = '/files/audio/terminal_print.mp3';

function TerminalStaticLine({ text }) {
  return (
    <div className="terminal-line">
      <span className="terminal-prompt">{TERMINAL_PROMPT} </span>
      <span className="terminal-line-text">{text}</span>
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
      <span className="terminal-line-text">{text.slice(0, visibleLength)}</span>
    </div>
  );
}

function TerminalPromptActions({ prompt, onAcceptPrompt, onRejectPrompt }) {
  const visibleStages = ['choice', 'processing', 'accept-pending'];
  if (!prompt?.active || !visibleStages.includes(prompt.stage)) {
    return null;
  }

  const areActionsDisabled = prompt.stage !== 'choice';

  return (
    <div className="terminal-line terminal-line--prompt-actions">
      <button
        type="button"
        className="terminal-choice-btn"
        onClick={onAcceptPrompt}
        disabled={areActionsDisabled}
      >
        [ДА]
      </button>
      <button
        type="button"
        className="terminal-choice-btn"
        onClick={onRejectPrompt}
        disabled={!!prompt.noDisabled || areActionsDisabled}
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
  const terminalPrintAudioRef = useRef(null);
  const adventurePromptLine = prompt?.promptLineId
    ? lines.find((line) => line?.id === prompt.promptLineId) || null
    : [...lines]
      .reverse()
      .find((line) => typeof line?.text === 'string' && line.text.includes(ADVENTURE_PROMPT_LINE_TEXT)) || null;
  const isAdventurePromptLinePending = !!adventurePromptLine
    && adventurePromptLine.status === 'pending';
  const canShowAdventurePromptActions = (
    prompt?.id !== 'terminal-adventure-confirm'
    || (!!adventurePromptLine && !isAdventurePromptLinePending)
  );
  const shouldRenderAdventurePromptInline = (
    prompt?.id === 'terminal-adventure-confirm'
    && canShowAdventurePromptActions
    && !!adventurePromptLine
  );

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length, firstPendingLineId, prompt?.active, prompt?.stage]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (!terminalPrintAudioRef.current) {
      const audio = new Audio(TERMINAL_PRINT_AUDIO_SRC);
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = 0.34;
      terminalPrintAudioRef.current = audio;
    }

    const audio = terminalPrintAudioRef.current;

    if (firstPendingLineId) {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } else {
      audio.pause();
    }

    return () => {
      audio.pause();
    };
  }, [firstPendingLineId]);

  useEffect(() => () => {
    if (!terminalPrintAudioRef.current) return;
    terminalPrintAudioRef.current.pause();
    terminalPrintAudioRef.current.src = '';
    terminalPrintAudioRef.current = null;
  }, []);

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
          const shouldRenderActionsAfterLine = (
            shouldRenderAdventurePromptInline
            && line.id === adventurePromptLine.id
          );

          if (isQueuedPending) {
            return null;
          }

          if (isPending) {
            return (
              <React.Fragment key={line.id}>
                <TerminalAnimatedLine
                  lineId={line.id}
                  text={line.text || ''}
                  onComplete={onCompleteLine}
                  typeSpeedMs={line.typeSpeedMs}
                />
                {shouldRenderActionsAfterLine ? (
                  <TerminalPromptActions
                    key={`${prompt?.id || 'terminal-prompt'}-${prompt?.cycle || 0}-${line.id}`}
                    prompt={prompt}
                    onAcceptPrompt={onAcceptPrompt}
                    onRejectPrompt={onRejectPrompt}
                  />
                ) : null}
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={line.id}>
              <TerminalStaticLine text={line.text || ''} />
              {shouldRenderActionsAfterLine ? (
                <TerminalPromptActions
                  key={`${prompt?.id || 'terminal-prompt'}-${prompt?.cycle || 0}-${line.id}`}
                  prompt={prompt}
                  onAcceptPrompt={onAcceptPrompt}
                  onRejectPrompt={onRejectPrompt}
                />
              ) : null}
            </React.Fragment>
          );
        })}

        {!shouldRenderAdventurePromptInline && canShowAdventurePromptActions ? (
          <TerminalPromptActions
            key={`${prompt?.id || 'terminal-prompt'}-${prompt?.cycle || 0}-fallback`}
            prompt={prompt}
            onAcceptPrompt={onAcceptPrompt}
            onRejectPrompt={onRejectPrompt}
          />
        ) : null}

        {prompt?.active && prompt.stage === 'rejected' && !firstPendingLineId ? (
          <button type="button" className="terminal-reset-btn" onClick={onResetPrompt}>
            [ПРОДОЛЖИТЬ]
          </button>
        ) : null}
      </div>
    </div>
  );
}
