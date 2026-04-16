import React, { useEffect, useMemo, useRef, useState } from 'react';
import MessengerScriptEditor from './MessengerScriptEditor';

const SEQUENCE_STEP_OPTIONS = [
  { value: 'openApp', label: 'Открыть приложение' },
  { value: 'focusApp', label: 'Сфокусировать окно' },
  { value: 'setFlag', label: 'Поставить флаг' },
  { value: 'showNotification', label: 'Показать уведомление' },
  { value: 'pushTerminalLine', label: 'Строка терминала' },
  { value: 'startWorkTask', label: 'Задача конвейера' },
  { value: 'showTyping', label: 'Индикатор набора' },
  { value: 'delay', label: 'Пауза' },
];

const SEQUENCE_TRIGGER_OPTIONS = [
  { value: '', label: 'Не запускать автоматически' },
  { value: 'desktop:start', label: 'При запуске РС' },
];

const APP_TYPE_OPTIONS = [
  { value: 'notes', label: 'Заметки' },
  { value: 'terminal', label: 'Терминал' },
  { value: 'messenger', label: 'Мессенджер' },
  { value: 'social', label: 'Соцсеть' },
  { value: 'work-conveyor', label: 'Конвейер' },
  { value: 'calendar', label: 'Календарь' },
  { value: 'exit', label: 'Выход' },
];

const SECTION_LABELS = {
  apps: 'Приложения',
  beats: 'Мессенджер',
  sequences: 'Последовательности',
  issues: 'Проверка',
};

function JsonBlock({ value }) {
  return (
    <pre className="editor-json">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function DevEditorPanel({
  visible,
  onToggle,
  config,
  content,
  onConfigChange,
  onContentChange,
  onSaveDraft,
  onRestoreLastSnapshot,
  onDownloadScenarioJson,
  onImportScenarioJson,
  onResetDraft,
  snapshotCount,
  hasUnsavedChanges,
  issues,
}) {
  const getDefaultPanelSize = () => {
    if (typeof window === 'undefined') {
      return { width: 760, height: 720 };
    }

    return {
      width: Math.min(760, window.innerWidth - 28),
      height: Math.min(720, window.innerHeight - 70),
    };
  };

  const [section, setSection] = useState('beats');
  const [panelSize, setPanelSize] = useState(getDefaultPanelSize);
  const [resizeState, setResizeState] = useState(null);
  const [selectedAppId, setSelectedAppId] = useState((config.apps || [])[0]?.id || '');
  const [selectedSequenceId, setSelectedSequenceId] = useState((content.sequences || [])[0]?.id || '');
  const [collapsedSequenceStepIds, setCollapsedSequenceStepIds] = useState({});
  const [exportCopied, setExportCopied] = useState(false);
  const importInputRef = useRef(null);

  const appOptions = useMemo(() => config.apps || [], [config.apps]);
  const appIds = useMemo(() => appOptions.map((app) => app.id), [appOptions]);
  const sequenceIds = useMemo(
    () => (content.sequences || []).map((sequence) => sequence.id),
    [content.sequences],
  );

  useEffect(() => {
    if (!appIds.includes(selectedAppId)) {
      setSelectedAppId(appIds[0] || '');
    }
  }, [appIds, selectedAppId]);

  useEffect(() => {
    if (!sequenceIds.includes(selectedSequenceId)) {
      setSelectedSequenceId(sequenceIds[0] || '');
    }
  }, [sequenceIds, selectedSequenceId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncPanelSize = () => {
      setPanelSize((prev) => ({
        width: Math.min(Math.max(prev.width, 520), window.innerWidth - 28),
        height: Math.min(Math.max(prev.height, 420), window.innerHeight - 70),
      }));
    };

    syncPanelSize();
    window.addEventListener('resize', syncPanelSize);
    return () => window.removeEventListener('resize', syncPanelSize);
  }, []);

  useEffect(() => {
    if (!resizeState || typeof window === 'undefined') {
      return undefined;
    }

    const handleMouseMove = (event) => {
      const nextWidth = resizeState.width + (event.clientX - resizeState.x);
      const nextHeight = resizeState.height + (event.clientY - resizeState.y);
      setPanelSize({
        width: Math.min(Math.max(nextWidth, 520), window.innerWidth - 28),
        height: Math.min(Math.max(nextHeight, 420), window.innerHeight - 70),
      });
    };

    const handleMouseUp = () => {
      setResizeState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState]);

  const selectedApp = appOptions.find((app) => app.id === selectedAppId) || null;
  const selectedSequence = (content.sequences || []).find((sequence) => sequence.id === selectedSequenceId) || null;

  const getSequenceStepCollapseKey = (sequenceId, stepIndex) => `${sequenceId}:${stepIndex}`;

  const toggleSequenceStepCollapsed = (sequenceId, stepIndex) => {
    const key = getSequenceStepCollapseKey(sequenceId, stepIndex);
    setCollapsedSequenceStepIds((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveDraft = () => {
    onSaveDraft();
    if (!selectedSequence) {
      return;
    }

    const nextCollapsed = { ...collapsedSequenceStepIds };
    (selectedSequence.steps || []).forEach((_, stepIndex) => {
      nextCollapsed[getSequenceStepCollapseKey(selectedSequence.id, stepIndex)] = true;
    });
    setCollapsedSequenceStepIds(nextCollapsed);
  };

  const updateApp = (appId, field, value) => {
    onConfigChange((prev) => ({
      ...prev,
      apps: prev.apps.map((app) => (app.id === appId ? { ...app, [field]: value } : app)),
    }));
  };

  const updateAppData = (key, updater) => {
    onContentChange((prev) => ({
      ...prev,
      appData: {
        ...(prev.appData || {}),
        [key]: updater(prev.appData?.[key] || {}),
      },
    }));
  };

  const addTerminalLine = () => {
    updateAppData('terminal', (terminal) => ({
      ...terminal,
      seedLines: [
        ...(terminal.seedLines || []),
        { id: `terminal_${Date.now()}`, text: '> > C:\\Users\\G> новая строка' },
      ],
    }));
  };

  const updateTerminalLine = (lineId, text) => {
    updateAppData('terminal', (terminal) => ({
      ...terminal,
      seedLines: (terminal.seedLines || []).map((line) => (
        line.id === lineId ? { ...line, text } : line
      )),
    }));
  };

  const deleteTerminalLine = (lineId) => {
    updateAppData('terminal', (terminal) => ({
      ...terminal,
      seedLines: (terminal.seedLines || []).filter((line) => line.id !== lineId),
    }));
  };

  const addNote = () => {
    updateAppData('notes', (notes) => ({
      ...notes,
      seedNotes: [
        ...(notes.seedNotes || []),
        {
          id: `note_${Date.now()}`,
          title: 'Новая заметка',
          preview: 'Короткое превью',
          body: 'Текст заметки',
        },
      ],
    }));
  };

  const updateNote = (noteId, field, value) => {
    updateAppData('notes', (notes) => ({
      ...notes,
      seedNotes: (notes.seedNotes || []).map((note) => (
        note.id === noteId ? { ...note, [field]: value } : note
      )),
    }));
  };

  const deleteNote = (noteId) => {
    updateAppData('notes', (notes) => ({
      ...notes,
      seedNotes: (notes.seedNotes || []).filter((note) => note.id !== noteId),
    }));
  };

  const addCalendarEvent = () => {
    updateAppData('calendar', (calendar) => ({
      ...calendar,
      seedEvents: [
        ...(calendar.seedEvents || []),
        {
          id: `calendar_${Date.now()}`,
          title: 'Новое событие',
          note: 'Описание события',
          offset: 0,
        },
      ],
    }));
  };

  const updateCalendarEvent = (eventId, field, value) => {
    updateAppData('calendar', (calendar) => ({
      ...calendar,
      seedEvents: (calendar.seedEvents || []).map((event) => (
        event.id === eventId
          ? { ...event, [field]: field === 'offset' ? Number(value) : value }
          : event
      )),
    }));
  };

  const deleteCalendarEvent = (eventId) => {
    updateAppData('calendar', (calendar) => ({
      ...calendar,
      seedEvents: (calendar.seedEvents || []).filter((event) => event.id !== eventId),
    }));
  };

  const addWorkSeedTask = () => {
    updateAppData('workConveyor', (workConveyor) => ({
      ...workConveyor,
      seedTasks: [
        ...(workConveyor.seedTasks || []),
        {
          id: `task_${Date.now()}`,
          title: 'Новая задача',
          prompt: 'Описание задачи',
          targetText: 'Заранее подготовленный текст ответа',
        },
      ],
    }));
  };

  const updateWorkSeedTask = (taskId, field, value) => {
    updateAppData('workConveyor', (workConveyor) => ({
      ...workConveyor,
      seedTasks: (workConveyor.seedTasks || []).map((task) => (
        task.id === taskId ? { ...task, [field]: value } : task
      )),
    }));
  };

  const deleteWorkSeedTask = (taskId) => {
    updateAppData('workConveyor', (workConveyor) => ({
      ...workConveyor,
      seedTasks: (workConveyor.seedTasks || []).filter((task) => task.id !== taskId),
    }));
  };

  const copyExport = async () => {
    const payload = JSON.stringify({ config, content }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setExportCopied(true);
      window.setTimeout(() => setExportCopied(false), 1200);
    } catch {
      setExportCopied(false);
    }
  };

  const updateSequence = (sequenceId, updater) => {
    onContentChange((prev) => ({
      ...prev,
      sequences: (prev.sequences || []).map((sequence) => (
        sequence.id === sequenceId ? updater(sequence) : sequence
      )),
    }));
  };

  const addSequence = () => {
    const id = `sequence_${Date.now()}`;
    onContentChange((prev) => ({
      ...prev,
      sequences: [
        ...(prev.sequences || []),
        {
          id,
          title: 'Новая последовательность',
          trigger: '',
          steps: [{ at: 0, type: 'openApp', appId: 'app3' }],
        },
      ],
    }));
    setSelectedSequenceId(id);
  };

  const deleteSequence = () => {
    if (!selectedSequence) {
      return;
    }

    onContentChange((prev) => ({
      ...prev,
      sequences: (prev.sequences || []).filter((sequence) => sequence.id !== selectedSequence.id),
    }));
  };

  const updateSequenceField = (field, value) => {
    updateSequence(selectedSequenceId, (sequence) => ({
      ...sequence,
      [field]: value,
    }));
  };

  const updateSequenceStep = (stepIndex, field, value) => {
    updateSequence(selectedSequenceId, (sequence) => ({
      ...sequence,
      steps: (sequence.steps || []).map((step, index) => (
        index === stepIndex ? { ...step, [field]: field === 'at' ? Number(value) : value } : step
      )),
    }));
  };

  const addSequenceStep = () => {
    updateSequence(selectedSequenceId, (sequence) => ({
      ...sequence,
      steps: [...(sequence.steps || []), { at: 0, type: 'setFlag', key: 'newFlag', value: true }],
    }));
  };

  const deleteSequenceStep = (stepIndex) => {
    updateSequence(selectedSequenceId, (sequence) => ({
      ...sequence,
      steps: (sequence.steps || []).filter((_, index) => index !== stepIndex),
    }));
  };

  return (
    <>
      <button
        type="button"
        className="editor-toggle"
        onClick={onToggle}
      >
        {visible ? 'Скрыть редактор' : 'Показать редактор'}
      </button>
      <aside
        className={`editor-panel${visible ? '' : ' is-hidden'}`}
        style={{
          width: `${panelSize.width}px`,
          height: `${panelSize.height}px`,
        }}
        aria-hidden={!visible}
      >
        <div className="editor-header">
          <div className="editor-status-row">
            <button type="button" className="editor-save-btn" onClick={handleSaveDraft} disabled={!hasUnsavedChanges}>
              Сохранить
            </button>
          </div>
        </div>

        <div className="editor-tabs">
          {['apps', 'beats', 'sequences', 'issues'].map((item) => (
            <button
              key={item}
              type="button"
              className={`editor-tab${section === item ? ' is-active' : ''}`}
              onClick={() => setSection(item)}
            >
              {SECTION_LABELS[item] || item}
            </button>
          ))}
        </div>

        <div className="editor-content">
          {section === 'apps' && (
            <div className="editor-section">
              <div className="editor-row">
                <label htmlFor="editor-app-select" className="editor-label">Приложение</label>
                <select
                  id="editor-app-select"
                  className="editor-select"
                  value={selectedAppId}
                  onChange={(event) => setSelectedAppId(event.target.value)}
                >
                  {appOptions.map((app) => (
                    <option key={app.id} value={app.id}>{app.title || app.id}</option>
                  ))}
                </select>
              </div>

              {selectedApp && (
                <div key={selectedApp.id} className="editor-card">
                  <div className="editor-card-title">{selectedApp.title || selectedApp.id}</div>
                  <div className="editor-card-meta">Служебный ID: {selectedApp.id}</div>

                  <label className="editor-field">
                    <span className="editor-field-label">Название</span>
                    <input
                      className="editor-input"
                      value={selectedApp.title}
                      onChange={(event) => updateApp(selectedApp.id, 'title', event.target.value)}
                    />
                  </label>

                  <label className="editor-field">
                    <span className="editor-field-label">Тип</span>
                    <select
                      className="editor-select"
                      value={selectedApp.type}
                      onChange={(event) => updateApp(selectedApp.id, 'type', event.target.value)}
                    >
                      {APP_TYPE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>

                  {selectedApp.type === 'terminal' && (
                    <>
                      <label className="editor-field">
                        <span className="editor-field-label">Плейсхолдер</span>
                        <input
                          className="editor-input"
                          value={content.appData?.terminal?.placeholder || ''}
                          onChange={(event) => updateAppData('terminal', (terminal) => ({
                            ...terminal,
                            placeholder: event.target.value,
                          }))}
                        />
                      </label>

                      <div className="editor-actions">
                        <button type="button" className="editor-action-btn" onClick={addTerminalLine}>
                          Добавить строку терминала
                        </button>
                      </div>

                      {(content.appData?.terminal?.seedLines || []).map((line) => (
                        <div key={line.id} className="editor-subcard">
                          <label className="editor-field">
                            <span className="editor-field-label">Строка терминала</span>
                            <textarea
                              className="editor-textarea"
                              value={line.text}
                              onChange={(event) => updateTerminalLine(line.id, event.target.value)}
                            />
                          </label>
                          <button
                            type="button"
                            className="editor-icon-btn danger"
                            onClick={() => deleteTerminalLine(line.id)}
                          >
                            Удалить строку
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {selectedApp.type === 'notes' && (
                    <>
                      <div className="editor-actions">
                        <button type="button" className="editor-action-btn" onClick={addNote}>
                          Добавить заметку
                        </button>
                      </div>

                      {(content.appData?.notes?.seedNotes || []).map((note) => (
                        <div key={note.id} className="editor-subcard">
                          <label className="editor-field">
                            <span className="editor-field-label">Заголовок</span>
                            <input
                              className="editor-input"
                              value={note.title || ''}
                              onChange={(event) => updateNote(note.id, 'title', event.target.value)}
                            />
                          </label>

                          <label className="editor-field">
                            <span className="editor-field-label">Превью</span>
                            <input
                              className="editor-input"
                              value={note.preview || ''}
                              onChange={(event) => updateNote(note.id, 'preview', event.target.value)}
                            />
                          </label>

                          <label className="editor-field">
                            <span className="editor-field-label">Текст заметки</span>
                            <textarea
                              className="editor-textarea"
                              value={note.body || ''}
                              onChange={(event) => updateNote(note.id, 'body', event.target.value)}
                            />
                          </label>

                          <button
                            type="button"
                            className="editor-icon-btn danger"
                            onClick={() => deleteNote(note.id)}
                          >
                            Удалить заметку
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {selectedApp.type === 'calendar' && (
                    <>
                      <div className="editor-actions">
                        <button type="button" className="editor-action-btn" onClick={addCalendarEvent}>
                          Добавить событие
                        </button>
                      </div>

                      {(content.appData?.calendar?.seedEvents || []).map((calendarEvent) => (
                        <div key={calendarEvent.id} className="editor-subcard">
                          <label className="editor-field">
                            <span className="editor-field-label">Название события</span>
                            <input
                              className="editor-input"
                              value={calendarEvent.title || ''}
                              onChange={(event) => updateCalendarEvent(calendarEvent.id, 'title', event.target.value)}
                            />
                          </label>

                          <label className="editor-field">
                            <span className="editor-field-label">Описание</span>
                            <textarea
                              className="editor-textarea"
                              value={calendarEvent.note || ''}
                              onChange={(event) => updateCalendarEvent(calendarEvent.id, 'note', event.target.value)}
                            />
                          </label>

                          <label className="editor-field">
                            <span className="editor-field-label">Сдвиг в днях от сегодня</span>
                            <input
                              className="editor-input"
                              type="number"
                              value={calendarEvent.offset ?? 0}
                              onChange={(event) => updateCalendarEvent(calendarEvent.id, 'offset', event.target.value)}
                            />
                          </label>

                          <button
                            type="button"
                            className="editor-icon-btn danger"
                            onClick={() => deleteCalendarEvent(calendarEvent.id)}
                          >
                            Удалить событие
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {selectedApp.type === 'work-conveyor' && (
                    <>
                      <label className="editor-field">
                        <span className="editor-field-label">Текст пустого состояния</span>
                        <input
                          className="editor-input"
                          value={content.appData?.workConveyor?.emptyText || ''}
                          onChange={(event) => updateAppData('workConveyor', (workConveyor) => ({
                            ...workConveyor,
                            emptyText: event.target.value,
                          }))}
                        />
                      </label>

                      <label className="editor-field">
                        <span className="editor-field-label">Текст кнопки отправки</span>
                        <input
                          className="editor-input"
                          value={content.appData?.workConveyor?.submitLabel || ''}
                          onChange={(event) => updateAppData('workConveyor', (workConveyor) => ({
                            ...workConveyor,
                            submitLabel: event.target.value,
                          }))}
                        />
                      </label>

                      <div className="editor-actions">
                        <button type="button" className="editor-action-btn" onClick={addWorkSeedTask}>
                          Добавить стартовую задачу
                        </button>
                      </div>

                      {(content.appData?.workConveyor?.seedTasks || []).map((task) => (
                        <div key={task.id} className="editor-subcard">
                          <label className="editor-field">
                            <span className="editor-field-label">Название задачи</span>
                            <input
                              className="editor-input"
                              value={task.title}
                              onChange={(event) => updateWorkSeedTask(task.id, 'title', event.target.value)}
                            />
                          </label>

                          <label className="editor-field">
                            <span className="editor-field-label">Описание задачи</span>
                            <textarea
                              className="editor-textarea"
                              value={task.prompt || ''}
                              onChange={(event) => updateWorkSeedTask(task.id, 'prompt', event.target.value)}
                            />
                          </label>

                          <label className="editor-field">
                            <span className="editor-field-label">Текст для набора</span>
                            <textarea
                              className="editor-textarea"
                              value={task.targetText || ''}
                              onChange={(event) => updateWorkSeedTask(task.id, 'targetText', event.target.value)}
                            />
                          </label>

                          <button
                            type="button"
                            className="editor-icon-btn danger"
                            onClick={() => deleteWorkSeedTask(task.id)}
                          >
                            Удалить задачу
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {section === 'beats' && (
            <MessengerScriptEditor
              content={content}
              onContentChange={onContentChange}
              config={config}
            />
          )}

          {section === 'sequences' && (
            <div className="editor-section">
              <div className="editor-row">
                <label htmlFor="editor-sequence-select" className="editor-label">Последовательность</label>
                <select
                  id="editor-sequence-select"
                  className="editor-select"
                  value={selectedSequenceId}
                  onChange={(event) => setSelectedSequenceId(event.target.value)}
                >
                  {sequenceIds.map((sequenceId) => (
                    <option key={sequenceId} value={sequenceId}>
                      {(content.sequences || []).find((sequence) => sequence.id === sequenceId)?.title || sequenceId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="editor-actions">
                <button type="button" className="editor-action-btn" onClick={addSequence}>
                  Добавить последовательность
                </button>
                <button
                  type="button"
                  className="editor-action-btn danger"
                  onClick={deleteSequence}
                  disabled={!selectedSequence}
                >
                  Удалить последовательность
                </button>
              </div>

              {selectedSequence ? (
                <div className="editor-section">
                  <label className="editor-field">
                    <span className="editor-field-label">Название последовательности</span>
                    <input
                      className="editor-input"
                      value={selectedSequence.title || ''}
                      onChange={(event) => updateSequenceField('title', event.target.value)}
                      placeholder={selectedSequence.id}
                    />
                  </label>

                  <label className="editor-field">
                    <span className="editor-field-label">Запуск</span>
                    <select
                      className="editor-select"
                      value={selectedSequence.trigger || ''}
                      onChange={(event) => updateSequenceField('trigger', event.target.value)}
                    >
                      {SEQUENCE_TRIGGER_OPTIONS.map((item) => (
                        <option key={item.value || 'none'} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>

                  <div className="editor-actions">
                    <button type="button" className="editor-action-btn" onClick={addSequenceStep}>
                      Добавить шаг
                    </button>
                  </div>

                  {(selectedSequence.steps || []).map((step, stepIndex) => {
                    const collapseKey = getSequenceStepCollapseKey(selectedSequence.id, stepIndex);
                    const isCollapsed = !!collapsedSequenceStepIds[collapseKey];

                    return (
                      <div key={`${selectedSequence.id}-step-${stepIndex}`} className="editor-card">
                        <div className="editor-card-head">
                          <div>
                            <div className="editor-card-title">Шаг {stepIndex + 1}</div>
                            <div className="editor-card-meta">{step.type}</div>
                          </div>

                          <div className="editor-actions">
                            <button
                              type="button"
                              className="editor-icon-btn"
                              onClick={() => toggleSequenceStepCollapsed(selectedSequence.id, stepIndex)}
                            >
                              {isCollapsed ? 'Развернуть' : 'Свернуть'}
                            </button>
                            <button
                              type="button"
                              className="editor-icon-btn danger"
                              onClick={() => deleteSequenceStep(stepIndex)}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>

                        {isCollapsed ? (
                          <div className="editor-collapsed-summary">
                            {step.text || step.title || step.key || `Шаг ${stepIndex + 1}`}
                          </div>
                        ) : (
                          <>
                            <label className="editor-field">
                              <span className="editor-field-label">Старт, мс</span>
                              <input
                                className="editor-input"
                                type="number"
                                value={step.at || 0}
                                onChange={(event) => updateSequenceStep(stepIndex, 'at', event.target.value)}
                              />
                            </label>

                            <label className="editor-field">
                              <span className="editor-field-label">Тип</span>
                              <select
                                className="editor-select"
                                value={step.type || 'setFlag'}
                                onChange={(event) => updateSequenceStep(stepIndex, 'type', event.target.value)}
                              >
                                {SEQUENCE_STEP_OPTIONS.map((item) => (
                                  <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                              </select>
                            </label>

                            {(step.type === 'openApp' || step.type === 'focusApp' || step.type === 'showNotification') && (
                              <label className="editor-field">
                                <span className="editor-field-label">Приложение</span>
                                <select
                                  className="editor-select"
                                  value={step.appId || ''}
                                  onChange={(event) => updateSequenceStep(stepIndex, 'appId', event.target.value)}
                                >
                                  <option value="">Выберите приложение</option>
                                  {appOptions.map((app) => (
                                    <option key={app.id} value={app.id}>{app.title}</option>
                                  ))}
                                </select>
                              </label>
                            )}

                            {step.type === 'setFlag' && (
                              <>
                                <label className="editor-field">
                                  <span className="editor-field-label">Имя флага</span>
                                  <input
                                    className="editor-input"
                                    value={step.key || ''}
                                    onChange={(event) => updateSequenceStep(stepIndex, 'key', event.target.value)}
                                  />
                                </label>
                                <label className="editor-field">
                                  <span className="editor-field-label">Значение флага</span>
                                  <input
                                    className="editor-input"
                                    value={String(step.value ?? '')}
                                    onChange={(event) => updateSequenceStep(stepIndex, 'value', event.target.value)}
                                  />
                                </label>
                              </>
                            )}

                            {(step.type === 'pushTerminalLine' || step.type === 'showNotification') && (
                              <label className="editor-field">
                                <span className="editor-field-label">Текст</span>
                                <input
                                  className="editor-input"
                                  value={step.text || ''}
                                  onChange={(event) => updateSequenceStep(stepIndex, 'text', event.target.value)}
                                />
                              </label>
                            )}

                            {(step.type === 'showTyping' || step.type === 'delay') && (
                              <label className="editor-field">
                                <span className="editor-field-label">Длительность, мс</span>
                                <input
                                  className="editor-input"
                                  type="number"
                                  value={Number(step.durationMs || 0)}
                                  onChange={(event) => updateSequenceStep(stepIndex, 'durationMs', Number(event.target.value))}
                                />
                              </label>
                            )}

                            {step.type === 'showTyping' && (
                              <label className="editor-field">
                                <span className="editor-field-label">Чат</span>
                                <input
                                  className="editor-input"
                                  value={step.chatId || ''}
                                  onChange={(event) => updateSequenceStep(stepIndex, 'chatId', event.target.value)}
                                />
                              </label>
                            )}

                            {step.type === 'startWorkTask' && (
                              <>
                                <label className="editor-field">
                                  <span className="editor-field-label">Название задачи</span>
                                  <input
                                    className="editor-input"
                                    value={step.title || ''}
                                    onChange={(event) => updateSequenceStep(stepIndex, 'title', event.target.value)}
                                  />
                                </label>
                                <label className="editor-field">
                                  <span className="editor-field-label">Описание задачи</span>
                                  <textarea
                                    className="editor-textarea"
                                    value={step.prompt || ''}
                                    onChange={(event) => updateSequenceStep(stepIndex, 'prompt', event.target.value)}
                                  />
                                </label>
                                <label className="editor-field">
                                  <span className="editor-field-label">Текст для набора</span>
                                  <textarea
                                    className="editor-textarea"
                                    value={step.targetText || ''}
                                    onChange={(event) => updateSequenceStep(stepIndex, 'targetText', event.target.value)}
                                  />
                                </label>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="editor-empty">Последовательность не выбрана.</div>
              )}
            </div>
          )}

          {section === 'issues' && (
            <div className="editor-section">
              <div className="editor-section-title">Проверка</div>
              {issues.length === 0 ? (
                <div className="editor-empty">Ошибок не найдено.</div>
              ) : (
                <div className="editor-issues">
                  {issues.map((issue, index) => (
                    <div key={`${issue.path}-${index}`} className={`editor-issue issue-${issue.level}`}>
                      <div className="editor-issue-path">{issue.path}</div>
                      <div className="editor-issue-message">{issue.message}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="editor-section-title">Предпросмотр экспорта</div>
              <div className="editor-actions">
                <button type="button" className="editor-action-btn" onClick={copyExport}>
                  {exportCopied ? 'Скопировано' : 'Скопировать JSON'}
                </button>
              </div>
              <JsonBlock value={{ config, content }} />
            </div>
          )}
        </div>

        <div className="editor-footer">
          <button type="button" className="editor-link-btn" onClick={onRestoreLastSnapshot} disabled={!snapshotCount}>
            Восстановить снимок
          </button>
          <button type="button" className="editor-link-btn" onClick={onDownloadScenarioJson}>
            Скачать JSON
          </button>
          <button type="button" className="editor-link-btn" onClick={() => importInputRef.current?.click()}>
            Импорт JSON
          </button>
          <button type="button" className="editor-link-btn" onClick={onResetDraft}>
            Сбросить черновик
          </button>
        </div>

        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            try {
              await onImportScenarioJson(file);
            } catch {
              // ignore malformed import files
            }

            event.target.value = '';
          }}
        />

        <div
          className="editor-resize-handle"
          onMouseDown={(event) => {
            event.preventDefault();
            setResizeState({
              x: event.clientX,
              y: event.clientY,
              width: panelSize.width,
              height: panelSize.height,
            });
          }}
          role="presentation"
        />
      </aside>
    </>
  );
}
