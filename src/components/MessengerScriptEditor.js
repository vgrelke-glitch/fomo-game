import React, { useEffect, useMemo, useState } from 'react';

const EVENT_TYPE_OPTIONS = [
  { value: 'message_other', label: 'Сообщение оппонента' },
  { value: 'message_player', label: 'Сообщение игрока' },
  { value: 'effect', label: 'Эффект' },
  { value: 'scene_end', label: 'Конец сцены' },
];

const EFFECT_TYPE_OPTIONS = [
  { value: 'pushTerminalLine', label: 'Строка в терминал' },
  { value: 'openApp', label: 'Открыть приложение' },
  { value: 'focusApp', label: 'Фокус на приложение' },
  { value: 'showNotification', label: 'Уведомление' },
  { value: 'setFlag', label: 'Поставить флаг' },
  { value: 'queueSequence', label: 'Запустить последовательность' },
];

const buildUid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const buildSceneId = () => buildUid('scene');
const buildEventId = (type) => buildUid(type);
const buildEffectId = () => buildUid('fx');

const createScene = (index) => ({
  id: buildSceneId(),
  title: `Сцена ${index + 1}`,
  dateLabel: 'Сегодня',
  nextSceneId: '',
  events: [],
});

const createEffect = (type = 'pushTerminalLine') => {
  switch (type) {
    case 'openApp':
      return { id: buildEffectId(), type, appId: 'app7' };
    case 'focusApp':
      return { id: buildEffectId(), type, appId: 'app7' };
    case 'showNotification':
      return { id: buildEffectId(), type, appId: 'app3', text: 'Новое сообщение' };
    case 'setFlag':
      return { id: buildEffectId(), type, key: 'newFlag', value: true };
    case 'queueSequence':
      return { id: buildEffectId(), type, sequenceId: '' };
    case 'pushTerminalLine':
    default:
      return { id: buildEffectId(), type: 'pushTerminalLine', text: '>> C:\\Users\\G> новая строка' };
  }
};

const createEvent = (type) => {
  const base = {
    id: buildEventId(type),
    type,
    delayMs: 0,
    waitForEventId: '',
  };

  switch (type) {
    case 'message_other':
      return {
        ...base,
        text: 'Новое сообщение оппонента',
        typingSpeedMs: 40,
      };
    case 'message_player':
      return {
        ...base,
        text: 'Новое сообщение игрока',
        onFocusEffects: [],
        onSendEffects: [],
      };
    case 'effect':
      return {
        ...base,
        effects: [createEffect()],
      };
    case 'scene_end':
    default:
      return base;
  }
};

const normalizeLegacyEvent = (event) => {
  if (event?.type !== 'command') return event;
  return {
    id: event.id,
    type: 'effect',
    delayMs: event.delayMs || 0,
    waitForEventId: event.waitForEventId || '',
    effects: event.text ? [{ id: buildEffectId(), type: 'pushTerminalLine', text: event.text }] : [],
  };
};

const getEventTypeLabel = (type) => EVENT_TYPE_OPTIONS.find((item) => item.value === type)?.label || (type === 'command' ? 'Эффект' : type);

const getEventMeta = (event) => {
  if (!event) return '';
  if (event.type === 'effect') {
    return `${(event.effects || []).length} эффект(ов)`;
  }
  if (event.type === 'scene_end') {
    return 'Сцена завершится и перейдет в idle';
  }
  const text = (event.text || '').trim();
  return text ? text.slice(0, 80) : 'Без текста';
};

const normalizeEventForType = (event, nextType) => {
  const nextEvent = createEvent(nextType);
  return {
    ...nextEvent,
    id: event.id,
    delayMs: event.delayMs || 0,
    waitForEventId: event.waitForEventId || '',
    text: nextType === 'message_other' || nextType === 'message_player'
      ? (event.text || nextEvent.text)
      : undefined,
    typingSpeedMs: nextType === 'message_other' ? (event.typingSpeedMs || nextEvent.typingSpeedMs) : undefined,
    onFocusEffects: nextType === 'message_player' ? (event.onFocusEffects || []) : undefined,
    onSendEffects: nextType === 'message_player' ? (event.onSendEffects || []) : undefined,
    effects: nextType === 'effect' ? (event.effects || nextEvent.effects) : undefined,
  };
};

function EffectListEditor({ effects, onChange, appOptions, sequenceOptions }) {
  const updateEffect = (effectId, updater) => {
    onChange((effects || []).map((effect) => (effect.id === effectId ? updater(effect) : effect)));
  };

  const addEffect = () => {
    onChange([...(effects || []), createEffect()]);
  };

  const removeEffect = (effectId) => {
    onChange((effects || []).filter((effect) => effect.id !== effectId));
  };

  return (
    <div className="editor-section">
      {(effects || []).map((effect, index) => (
        <div key={effect.id} className="editor-preview-card">
          <div className="editor-card-head">
            <div>
              <div className="editor-card-title">
                {index + 1}. {EFFECT_TYPE_OPTIONS.find((item) => item.value === effect.type)?.label || effect.type}
              </div>
            </div>
            <button type="button" className="editor-icon-btn danger" onClick={() => removeEffect(effect.id)}>
              Удалить
            </button>
          </div>

          <label className="editor-field">
            <span className="editor-field-label">Тип эффекта</span>
            <select
              className="editor-select"
              value={effect.type}
              onChange={(e) => updateEffect(effect.id, () => ({ ...createEffect(e.target.value), id: effect.id }))}
            >
              {EFFECT_TYPE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          {effect.type === 'pushTerminalLine' && (
            <label className="editor-field">
              <span className="editor-field-label">Текст строки</span>
              <textarea
                className="editor-textarea"
                value={effect.text || ''}
                onChange={(e) => updateEffect(effect.id, (prev) => ({ ...prev, text: e.target.value }))}
              />
            </label>
          )}

          {(effect.type === 'openApp' || effect.type === 'focusApp' || effect.type === 'showNotification') && (
            <label className="editor-field">
              <span className="editor-field-label">Приложение</span>
              <select
                className="editor-select"
                value={effect.appId || ''}
                onChange={(e) => updateEffect(effect.id, (prev) => ({ ...prev, appId: e.target.value }))}
              >
                {appOptions.map((app) => (
                  <option key={app.id} value={app.id}>{app.title || app.id}</option>
                ))}
              </select>
            </label>
          )}

          {effect.type === 'showNotification' && (
            <label className="editor-field">
              <span className="editor-field-label">Текст уведомления</span>
              <input
                className="editor-input"
                value={effect.text || ''}
                onChange={(e) => updateEffect(effect.id, (prev) => ({ ...prev, text: e.target.value }))}
              />
            </label>
          )}

          {effect.type === 'setFlag' && (
            <>
              <label className="editor-field">
                <span className="editor-field-label">Ключ флага</span>
                <input
                  className="editor-input"
                  value={effect.key || ''}
                  onChange={(e) => updateEffect(effect.id, (prev) => ({ ...prev, key: e.target.value }))}
                />
              </label>
              <label className="editor-field">
                <span className="editor-field-label">Значение</span>
                <select
                  className="editor-select"
                  value={String(effect.value)}
                  onChange={(e) => updateEffect(effect.id, (prev) => ({ ...prev, value: e.target.value === 'true' }))}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
            </>
          )}

          {effect.type === 'queueSequence' && (
            <label className="editor-field">
              <span className="editor-field-label">Последовательность</span>
              <select
                className="editor-select"
                value={effect.sequenceId || ''}
                onChange={(e) => updateEffect(effect.id, (prev) => ({ ...prev, sequenceId: e.target.value }))}
              >
                <option value="">Не выбрана</option>
                {sequenceOptions.map((sequence) => (
                  <option key={sequence.id} value={sequence.id}>{sequence.id}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      ))}

      <div className="editor-actions">
        <button type="button" className="editor-action-btn" onClick={addEffect}>
          Добавить эффект
        </button>
      </div>
    </div>
  );
}

export default function MessengerScriptEditor({ content, onContentChange, config }) {
  const chatOptions = useMemo(() => content.messenger?.chats || [], [content.messenger]);
  const sequenceOptions = content.sequences || [];
  const appOptions = config?.apps || [];
  const [selectedChatId, setSelectedChatId] = useState(chatOptions[0]?.id || '');
  const [selectedSceneId, setSelectedSceneId] = useState('');

  const selectedChat = chatOptions.find((chat) => chat.id === selectedChatId) || null;
  const script = useMemo(
    () => content.messenger?.scripts?.[selectedChatId] || { scenes: [] },
    [content.messenger, selectedChatId],
  );
  const scenes = useMemo(() => script.scenes || [], [script]);
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0] || null;

  useEffect(() => {
    if (!selectedChatId && chatOptions[0]?.id) {
      setSelectedChatId(chatOptions[0].id);
    }
  }, [chatOptions, selectedChatId]);

  useEffect(() => {
    if (!scenes.length) {
      if (selectedSceneId) setSelectedSceneId('');
      return;
    }
    if (!selectedScene || !selectedSceneId) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [scenes, selectedScene, selectedSceneId]);

  const updateChat = (field, value) => {
    onContentChange((prev) => ({
      ...prev,
      messenger: {
        ...prev.messenger,
        chats: (prev.messenger?.chats || []).map((chat) => (
          chat.id === selectedChatId ? { ...chat, [field]: value } : chat
        )),
      },
    }));
  };

  const updateScript = (updater) => {
    onContentChange((prev) => ({
      ...prev,
      messenger: {
        ...prev.messenger,
        scripts: {
          ...(prev.messenger?.scripts || {}),
          [selectedChatId]: updater(prev.messenger?.scripts?.[selectedChatId] || { id: selectedChatId, scenes: [] }),
        },
      },
    }));
  };

  const updateScene = (sceneId, updater) => {
    updateScript((prevScript) => ({
      ...prevScript,
      scenes: (prevScript.scenes || []).map((scene) => (scene.id === sceneId ? updater(scene) : scene)),
    }));
  };

  const updateEvent = (eventId, updater) => {
    if (!selectedScene) return;
    updateScene(selectedScene.id, (prevScene) => ({
      ...prevScene,
      events: (prevScene.events || []).map((event) => (event.id === eventId ? updater(event) : event)),
    }));
  };

  const addScene = () => {
    const nextScene = createScene(scenes.length);
    updateScript((prevScript) => ({
      ...prevScript,
      startSceneId: prevScript.startSceneId || nextScene.id,
      scenes: [...(prevScript.scenes || []), nextScene],
    }));
    setSelectedSceneId(nextScene.id);
  };

  const deleteScene = (sceneId) => {
    updateScript((prevScript) => {
      const nextScenes = (prevScript.scenes || [])
        .filter((scene) => scene.id !== sceneId)
        .map((scene) => ({
          ...scene,
          nextSceneId: scene.nextSceneId === sceneId ? '' : scene.nextSceneId || '',
        }));
      const fallbackSceneId = nextScenes[0]?.id || '';
      return {
        ...prevScript,
        startSceneId: prevScript.startSceneId === sceneId ? fallbackSceneId : prevScript.startSceneId,
        scenes: nextScenes,
      };
    });

    if (selectedSceneId === sceneId) {
      setSelectedSceneId(scenes.find((scene) => scene.id !== sceneId)?.id || '');
    }
  };

  const addEvent = (type) => {
    if (!selectedScene) return;
    updateScene(selectedScene.id, (prevScene) => ({
      ...prevScene,
      events: [...(prevScene.events || []), createEvent(type)],
    }));
  };

  const deleteEvent = (eventId) => {
    if (!selectedScene) return;
    updateScene(selectedScene.id, (prevScene) => ({
      ...prevScene,
      events: (prevScene.events || []).filter((event) => event.id !== eventId),
    }));
  };

  if (!selectedChat) {
    return <div className="editor-empty">Нет чатов для редактирования.</div>;
  }

  return (
    <div className="editor-section">
      <div className="editor-row">
        <label htmlFor="messenger-chat-select" className="editor-label">Чат</label>
        <select
          id="messenger-chat-select"
          className="editor-select"
          value={selectedChatId}
          onChange={(e) => setSelectedChatId(e.target.value)}
        >
          {chatOptions.map((chat) => (
            <option key={chat.id} value={chat.id}>{chat.title}</option>
          ))}
        </select>
      </div>

      <div className="editor-preview-card">
        <div className="editor-section-title">Настройки чата</div>
        <label className="editor-field">
          <span className="editor-field-label">Название</span>
          <input className="editor-input" value={selectedChat.title || ''} onChange={(e) => updateChat('title', e.target.value)} />
        </label>
        <label className="editor-field">
          <span className="editor-field-label">Стартовая сцена</span>
          <select
            className="editor-select"
            value={script.startSceneId || ''}
            onChange={(e) => updateScript((prevScript) => ({ ...prevScript, startSceneId: e.target.value }))}
          >
            <option value="">Не выбрана</option>
            {scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>{scene.title}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="editor-preview-card">
        <div className="editor-section-title">Сцены</div>
        <div className="editor-row">
          <label htmlFor="messenger-scene-select" className="editor-label">Текущая сцена</label>
          <select
            id="messenger-scene-select"
            className="editor-select"
            value={selectedScene?.id || ''}
            onChange={(e) => setSelectedSceneId(e.target.value)}
          >
            <option value="">Не выбрана</option>
            {scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>{scene.title}</option>
            ))}
          </select>
        </div>
        <div className="editor-actions">
          <button type="button" className="editor-action-btn" onClick={addScene}>Добавить сцену</button>
          {selectedScene && (
            <button type="button" className="editor-action-btn danger" onClick={() => deleteScene(selectedScene.id)}>
              Удалить сцену
            </button>
          )}
        </div>
        {selectedScene ? (
          <>
            <label className="editor-field">
              <span className="editor-field-label">Название сцены</span>
              <input
                className="editor-input"
                value={selectedScene.title || ''}
                onChange={(e) => updateScene(selectedScene.id, (prevScene) => ({ ...prevScene, title: e.target.value }))}
              />
            </label>
            <label className="editor-field">
              <span className="editor-field-label">Подпись даты</span>
              <input
                className="editor-input"
                value={selectedScene.dateLabel || ''}
                onChange={(e) => updateScene(selectedScene.id, (prevScene) => ({ ...prevScene, dateLabel: e.target.value }))}
              />
            </label>
            <label className="editor-field">
              <span className="editor-field-label">Следующая сцена</span>
              <select
                className="editor-select"
                value={selectedScene.nextSceneId || ''}
                onChange={(e) => updateScene(selectedScene.id, (prevScene) => ({ ...prevScene, nextSceneId: e.target.value }))}
              >
                <option value="">Нет</option>
                {scenes.filter((scene) => scene.id !== selectedScene.id).map((scene) => (
                  <option key={scene.id} value={scene.id}>{scene.title}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <div className="editor-empty">Сцен пока нет. Добавьте первую сцену.</div>
        )}
      </div>

      {selectedScene ? (
        <>
          <div className="editor-actions">
            <button type="button" className="editor-action-btn" onClick={() => addEvent('message_other')}>
              Добавить сообщение оппонента
            </button>
            <button type="button" className="editor-action-btn" onClick={() => addEvent('message_player')}>
              Добавить сообщение игрока
            </button>
            <button type="button" className="editor-action-btn" onClick={() => addEvent('effect')}>
              Добавить эффект
            </button>
            <button type="button" className="editor-action-btn" onClick={() => addEvent('scene_end')}>
              Добавить конец сцены
            </button>
          </div>

          <div className="editor-preview-card">
            <div className="editor-section-title">События сцены</div>
            {(selectedScene.events || []).length === 0 ? (
              <div className="editor-empty">В этой сцене пока нет событий.</div>
            ) : (
              (selectedScene.events || []).map((event, index) => {
                const safeEvent = normalizeLegacyEvent(event);
                const previousSceneEvent = selectedScene.events[index - 1] || null;
                const previousEvent = previousSceneEvent ? normalizeLegacyEvent(previousSceneEvent) : null;
                const dependencyMode = previousEvent && safeEvent.waitForEventId === previousEvent.id
                  ? 'previous'
                  : '';

                return (
                  <div key={event.id} className="editor-card">
                    <div className="editor-card-head">
                      <div>
                        <div className="editor-card-title">{index + 1}. {getEventTypeLabel(safeEvent.type)}</div>
                        <div className="editor-card-meta">{getEventMeta(safeEvent)}</div>
                      </div>
                      <button type="button" className="editor-icon-btn danger" onClick={() => deleteEvent(event.id)}>
                        Удалить
                      </button>
                    </div>

                    <label className="editor-field">
                      <span className="editor-field-label">Тип события</span>
                      <select
                        className="editor-select"
                        value={safeEvent.type}
                        onChange={(e) => updateEvent(event.id, (prevEvent) => normalizeEventForType(normalizeLegacyEvent(prevEvent), e.target.value))}
                      >
                        {EVENT_TYPE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>

                    {(safeEvent.type === 'message_other' || safeEvent.type === 'message_player') && (
                      <label className="editor-field">
                        <span className="editor-field-label">Текст сообщения</span>
                        <textarea
                          className="editor-textarea"
                          value={safeEvent.text || ''}
                          onChange={(e) => updateEvent(event.id, (prevEvent) => ({ ...normalizeLegacyEvent(prevEvent), text: e.target.value }))}
                        />
                      </label>
                    )}

                    {safeEvent.type !== 'scene_end' && (
                      <label className="editor-field">
                        <span className="editor-field-label">Пауза перед событием, мс</span>
                        <input
                          className="editor-input"
                          type="number"
                          value={event.delayMs ?? 0}
                          onChange={(e) => updateEvent(event.id, (prevEvent) => ({ ...prevEvent, delayMs: Number(e.target.value) || 0 }))}
                        />
                      </label>
                    )}

                    {safeEvent.type === 'message_other' && (
                      <label className="editor-field">
                        <span className="editor-field-label">Скорость набора, мс на символ</span>
                        <input
                          className="editor-input"
                          type="number"
                          value={safeEvent.typingSpeedMs ?? 40}
                          onChange={(e) => updateEvent(event.id, (prevEvent) => ({
                            ...normalizeLegacyEvent(prevEvent),
                            typingSpeedMs: Number(e.target.value) || 0,
                          }))}
                        />
                      </label>
                    )}

                    {safeEvent.type === 'message_player' && (
                      <>
                        <div className="editor-section-title">При фокусе</div>
                        <EffectListEditor
                          effects={safeEvent.onFocusEffects || []}
                          onChange={(nextEffects) => updateEvent(event.id, (prevEvent) => ({
                            ...normalizeLegacyEvent(prevEvent),
                            onFocusEffects: nextEffects,
                          }))}
                          appOptions={appOptions}
                          sequenceOptions={sequenceOptions}
                        />
                        <div className="editor-section-title">При отправке</div>
                        <EffectListEditor
                          effects={safeEvent.onSendEffects || []}
                          onChange={(nextEffects) => updateEvent(event.id, (prevEvent) => ({
                            ...normalizeLegacyEvent(prevEvent),
                            onSendEffects: nextEffects,
                          }))}
                          appOptions={appOptions}
                          sequenceOptions={sequenceOptions}
                        />
                      </>
                    )}

                    {safeEvent.type === 'effect' && (
                      <>
                        <div className="editor-section-title">Эффекты</div>
                        <EffectListEditor
                          effects={safeEvent.effects || []}
                          onChange={(nextEffects) => updateEvent(event.id, (prevEvent) => ({
                            ...normalizeLegacyEvent(prevEvent),
                            effects: nextEffects,
                          }))}
                          appOptions={appOptions}
                          sequenceOptions={sequenceOptions}
                        />
                      </>
                    )}

                    {safeEvent.type !== 'scene_end' && (
                      <label className="editor-field">
                        <span className="editor-field-label">Порядок запуска</span>
                        <select
                          className="editor-select"
                          value={dependencyMode}
                          onChange={(e) => updateEvent(event.id, (prevEvent) => ({
                            ...normalizeLegacyEvent(prevEvent),
                            waitForEventId: e.target.value === 'previous' ? (previousEvent?.id || '') : '',
                          }))}
                        >
                          <option value="">Сразу по очереди</option>
                          {previousEvent && (
                            <option value="previous">
                              После предыдущего: {index}. {getEventTypeLabel(previousEvent.type)}
                            </option>
                          )}
                        </select>
                      </label>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
