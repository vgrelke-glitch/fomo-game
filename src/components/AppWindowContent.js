import React from 'react';
import TerminalWindowBody from './TerminalWindowBody';
import WorkConveyorBody from './WorkConveyorBody';

export default function AppWindowContent({
  appType,
  editorContent,
  storyState,
  onCompleteTerminalLine,
  terminalPrompt,
  onAcceptTerminalPrompt,
  onRejectTerminalPrompt,
  onResetTerminalPrompt,
  activeWorkTaskId,
  workSubmitFeedback,
  onSelectWorkTask,
  onTypeWorkTaskKey,
  onSubmitWorkTask,
  renderNotesBody,
  renderMessengerBody,
  renderCalendarBody,
  renderSocialBody,
  renderExitBody,
}) {
  if (appType === 'notes') return renderNotesBody();
  if (appType === 'messenger') return renderMessengerBody();
  if (appType === 'work-conveyor') {
    return (
      <WorkConveyorBody
        emptyText={editorContent.appData?.workConveyor?.emptyText}
        submitLabel={editorContent.appData?.workConveyor?.submitLabel}
        seedTasks={editorContent.appData?.workConveyor?.seedTasks || []}
        runtimeTasks={storyState.work?.tasks || []}
        totalTaskCount={
          (editorContent.appData?.workConveyor?.seedTasks || []).length
          + (editorContent.appData?.workConveyor?.queuedTasks || []).length
        }
        activeTaskId={activeWorkTaskId || storyState.work?.activeTaskId}
        submitFeedback={workSubmitFeedback}
        efficiency={storyState.work?.efficiency}
        balance={storyState.work?.balance}
        messages={storyState.work?.messages || []}
        taskNumbers={storyState.work?.taskNumbers || {}}
        typedTextByTask={storyState.work?.typedTextByTask || {}}
        submittedTaskIds={storyState.work?.submittedTaskIds || []}
        onSelectTask={onSelectWorkTask}
        onTypeTaskKey={onTypeWorkTaskKey}
        onSubmitTask={onSubmitWorkTask}
      />
    );
  }
  if (appType === 'calendar') return renderCalendarBody();
  if (appType === 'social') return renderSocialBody();
  if (appType === 'terminal') {
    return (
      <TerminalWindowBody
        placeholder={editorContent.appData?.terminal?.placeholder}
        seedLines={editorContent.appData?.terminal?.seedLines || []}
        runtimeLines={storyState.terminal?.lines || []}
        onCompleteLine={onCompleteTerminalLine}
        prompt={terminalPrompt}
        onAcceptPrompt={onAcceptTerminalPrompt}
        onRejectPrompt={onRejectTerminalPrompt}
        onResetPrompt={onResetTerminalPrompt}
      />
    );
  }
  if (appType === 'exit') return renderExitBody();
  return null;
}
