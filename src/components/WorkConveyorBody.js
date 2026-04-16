import React from 'react';

export default function WorkConveyorBody({
  emptyText,
  submitLabel,
  seedTasks,
  runtimeTasks,
  totalTaskCount,
  activeTaskId,
  submitFeedback,
  efficiency,
  balance,
  messages,
  taskNumbers,
  typedTextByTask,
  submittedTaskIds,
  onSelectTask,
  onTypeTaskKey,
  onSubmitTask,
}) {
  const seenTaskIds = new Set();
  const tasks = [...seedTasks, ...runtimeTasks].filter((task) => {
    if (!task?.id || seenTaskIds.has(task.id)) return false;
    seenTaskIds.add(task.id);
    return true;
  });
  const pendingTasks = tasks.filter((task) => !(submittedTaskIds || []).includes(task.id));
  const visibleTasks = pendingTasks.length > 0 ? pendingTasks : tasks;

  const activeTask = visibleTasks.find((task) => task.id === activeTaskId)
    || visibleTasks[visibleTasks.length - 1]
    || null;
  const typedText = activeTask ? (typedTextByTask?.[activeTask.id] || '') : '';
  const targetText = activeTask?.targetText || '';
  const progressCurrent = typedText.length;
  const progressTotal = targetText.length;
  const isTaskComplete = activeTask ? progressCurrent >= progressTotal && progressTotal > 0 : false;
  const isTaskSubmitted = activeTask ? (submittedTaskIds || []).includes(activeTask.id) : false;
  const isSubmitting = activeTask ? submitFeedback?.taskId === activeTask.id : false;
  const submitStatusText = isSubmitting
    ? (submitFeedback?.stage === 'checking' ? 'Проверка' : 'Отправка')
    : '';
  const submittedCount = submittedTaskIds?.length || 0;
  const activeTaskNumber = activeTask ? taskNumbers?.[activeTask.id] || null : null;
  const displayEfficiency = Math.max(10, Math.min(89, typeof efficiency === 'number' ? efficiency : 24));
  const displayBalance = typeof balance === 'number' ? balance : 2514;
  const isAllWorkCompleted = totalTaskCount > 0 && submittedCount >= totalTaskCount;
  const recentMessages = messages?.length > 0
    ? messages
    : [
      { id: 'sys-empty-1', tone: 'neutral', time: 'Система', text: 'Конвейер готов к приему текста.' },
      { id: 'sys-empty-2', tone: 'neutral', time: 'Статус', text: `Выполнено задач: ${submittedCount}.` },
    ];

  return (
    <div className="conveyor">
      <div className="conveyor-shell">
        {isAllWorkCompleted && (
          <div className="conveyor-complete-overlay">
            <div className="conveyor-complete-card">
              <div className="conveyor-complete-title">✔ тексты приняты</div>
              <div className="conveyor-complete-body">
                {`25 текстов успешно добавлены в поток!

Система благодарит вас за вклад в углубленное изучение бытовых вопросов!

Благодаря вам:

Сегодня интернет стал немного богаче на тексты о загадках бытовой реальности!
Теперь увеличится конверсия на чтение статьи «5 фактов о психологии пульта от телевизора».
Исследование тайной жизни кухонных губок успешно найдет новую аудиторию.
Возможно, десять человек сегодня прочитает о том, почему пледы так любят сползать с дивана.

Спасибо, что не заботитесь поиском первоисточников! Спасибо, что не интересуетесь достоверными подтверждениями! Это значительно ускоряет темп работы и повышает Вашу продуктивность.
Отличная работа!
Пожалуйста, оставайтесь в приложении.
Новые задачи появляются каждую секунду.`}
              </div>
            </div>
          </div>
        )}
        <div className="conveyor-header">
          <div>
            <div className="conveyor-app-title">Конвейер</div>
            <div className="conveyor-app-subtitle">Динамическая чек-таск машина</div>
          </div>
        </div>

        <div className="conveyor-status-bar">
          <div className="conveyor-status-card">
            <div className="conveyor-status-label">Эффективность</div>
            <div className="conveyor-status-meter">
              <div className="conveyor-status-fill" style={{ width: `${displayEfficiency}%` }} />
            </div>
            <div className="conveyor-status-value">{displayEfficiency}%</div>
          </div>
          <div className="conveyor-status-card conveyor-status-card--balance">
            <div className="conveyor-status-label">Баланс</div>
            <div className="conveyor-balance-value">{displayBalance}</div>
          </div>
        </div>

        <div className="conveyor-main">
          <div className="conveyor-workspace">
            <section className="conveyor-task-card">
              <div className="conveyor-task-card-top">
                <div className="conveyor-task-card-id">
                  {activeTask ? `Задача #${activeTaskNumber}` : 'Задача'}
                </div>
                {activeTask && <div className="conveyor-task-card-meta">~ {progressTotal} символов</div>}
              </div>
              <div className="conveyor-task-card-body">
                <div className="conveyor-task-theme-label">Тема:</div>
                <div className="conveyor-task-theme">
                  {activeTask?.title || emptyText || 'Пока задач нет.'}
                </div>
                <div className="conveyor-task-instruction">
                  Напишите текст объемом около 200 символов по указанной теме.
                </div>
              </div>
            </section>

            <section className="conveyor-editor-card">
              <div className="conveyor-editor-head">
                <div className="conveyor-editor-label">Ваш текст</div>
                <div className="conveyor-editor-count">({progressCurrent} / {progressTotal})</div>
              </div>
              <textarea
                className="conveyor-textarea"
                placeholder="Начните писать здесь..."
                value={typedText}
                onKeyDown={(event) => onTypeTaskKey(activeTask?.id, event)}
                onChange={() => {}}
                readOnly
              />
              <div className="conveyor-actions">
                <button
                  type="button"
                  className={`conveyor-btn${isTaskSubmitted ? ' is-complete' : ''}${isSubmitting ? ' is-busy' : ''}`}
                  disabled={!isTaskComplete || isTaskSubmitted || isSubmitting}
                  onClick={() => onSubmitTask(activeTask?.id)}
                >
                  {isSubmitting
                    ? (submitFeedback?.stage === 'checking' ? 'Проверка' : 'Отправка')
                    : (submitLabel || 'Отправить текст')}
                </button>
              </div>
            </section>
          </div>

          <aside className="conveyor-sidebar">
            <section className="conveyor-side-panel">
              <div className="conveyor-side-title">Панель показателей</div>
              <div className="conveyor-metric-card">
                <div className="conveyor-metric-label">Выполнено задач</div>
                <div className="conveyor-metric-value">{submittedCount}</div>
              </div>
              <div className="conveyor-metric-card">
                <div className="conveyor-metric-label">Активный поток</div>
                <div className="conveyor-metric-state">Высокая загрузка</div>
              </div>
            </section>

            <section className="conveyor-side-panel">
              <div className="conveyor-side-title">Последние сообщения</div>
              <div className="conveyor-message-list">
                {recentMessages.map((message) => (
                  <div key={message.id} className={`conveyor-message-item is-${message.tone || 'neutral'}`}>
                    <div className="conveyor-message-time">{message.time}</div>
                    <div className="conveyor-message-text">{message.text}</div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <div className="conveyor-footer">
          <div className={`conveyor-feedback${isSubmitting ? ' is-visible' : ''}`}>{submitStatusText}</div>
          <div className="conveyor-footnote">Каждый отправленный текст — ваш большой вклад!</div>
        </div>
      </div>
    </div>
  );
}
