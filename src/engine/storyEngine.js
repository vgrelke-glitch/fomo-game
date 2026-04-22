export const STORY_SAVE_SLOTS = {
  main: 'fomo_player_save_main_v1',
  dev: 'fomo_dev_session_v1',
};
const LEGACY_STORY_SAVE_KEY = 'story_state_v1';

const getMessengerScripts = (content) => content?.messenger?.scripts || {};
const getVisibleChatIds = (content) => (
  (content?.messenger?.chats || [])
    .filter((chat) => !chat.hiddenByDefault)
    .map((chat) => chat.id)
);
const getDefaultActiveChatId = (content) => getVisibleChatIds(content)[0] || content?.messenger?.chats?.[0]?.id || '';
const normalizeWorkTaskText = (value) => (typeof value === 'string' ? value.trim() : '');
const getWorkTaskFingerprint = (task) => (
  [
    normalizeWorkTaskText(task?.title),
    normalizeWorkTaskText(task?.prompt),
    normalizeWorkTaskText(task?.targetText),
  ].join('::')
);
const dedupeWorkTasks = (tasks = []) => {
  const seenIds = new Set();
  const seenFingerprints = new Set();

  return tasks.filter((task) => {
    if (!task) return false;

    const taskId = normalizeWorkTaskText(task.id);
    const fingerprint = getWorkTaskFingerprint(task);

    if (taskId && seenIds.has(taskId)) return false;
    if (seenFingerprints.has(fingerprint)) return false;

    if (taskId) seenIds.add(taskId);
    seenFingerprints.add(fingerprint);
    return true;
  });
};

export const getScriptStartSceneId = (script) => {
  if (!script) return '';
  if (script.startSceneId) return script.startSceneId;
  return script.scenes?.[0]?.id || '';
};

export const getScriptSceneById = (script, sceneId) => (
  (script?.scenes || []).find((scene) => scene.id === sceneId) || null
);

export const getActiveMessengerScene = (content, messengerState, chatId) => {
  const script = getMessengerScripts(content)[chatId];
  const sceneId = messengerState?.sceneIdByChat?.[chatId] || getScriptStartSceneId(script);
  return getScriptSceneById(script, sceneId);
};

const buildSeededMessengerState = (content) => {
  const scripts = getMessengerScripts(content);
  const chats = content?.messenger?.chats || [];

  const seed = {
    sceneIdByChat: {},
    eventIndexByChat: {},
    historyByChat: {},
    completedEventIds: [],
  };

  chats.forEach((chat) => {
    const script = scripts[chat.id];
    const sceneId = getScriptStartSceneId(script);
    const scene = getScriptSceneById(script, sceneId);
    const seededEventIds = chat.seedHistoryEventIds || [];
    const seededSet = new Set(seededEventIds);
    const history = [];
    let eventIndex = 0;

    (scene?.events || []).forEach((event, index) => {
      if (!seededSet.has(event.id) || index !== eventIndex) {
        return;
      }

      if (event.type === 'message_other') {
        history.push({
          id: event.id,
          direction: 'incoming',
          text: event.text || '',
        });
      }

      seed.completedEventIds.push(event.id);
      eventIndex += 1;
    });

    seed.sceneIdByChat[chat.id] = sceneId;
    seed.eventIndexByChat[chat.id] = eventIndex;
    seed.historyByChat[chat.id] = history;
  });

  return seed;
};

export const createDefaultStoryState = (content) => {
  const seededMessengerState = buildSeededMessengerState(content);

  return {
  contentVersion: content.version,
  currentNodeId: null,
  flags: {},
  autoStartedSequenceIds: [],
  messenger: {
    sceneIdByChat: seededMessengerState.sceneIdByChat,
    eventIndexByChat: seededMessengerState.eventIndexByChat,
    historyByChat: seededMessengerState.historyByChat,
    completedEventIds: seededMessengerState.completedEventIds,
    processedEventIds: [],
    focusEffectEventIds: [],
    typingByChat: {},
    choiceStateByEventId: {},
    queuedPhotoRepliesByChat: {},
    photoReplyInFlightByChat: {},
    unreadChatIds: [],
  },
  unlockedChats: content.messenger.chats
    .filter((chat) => !chat.hiddenByDefault)
    .map((chat) => chat.id),
  unlockedApps: content.apps.map((app) => app.id),
  ui: {
    activeChatId: getDefaultActiveChatId(content),
    view: 'prologue',
    gameScreen: 'game',
    openApps: {},
    minimizedApps: {},
    focusedAppId: null,
    iconPositions: {},
    windowState: {},
  },
  notifications: [],
  queuedSequences: [],
  terminal: {
    lines: [],
    prompt: null,
  },
  work: {
    tasks: [],
    typedTextByTask: {},
    taskNumbers: {},
    activeTaskId: null,
    submittedTaskIds: [],
    efficiency: 24,
    balance: 2514,
    lastInteractionAt: Date.now(),
    lastTaskActivityAt: Date.now(),
    messages: [],
  },
  };
};

export const loadStoryState = (content, slot = 'main') => {
  if (typeof window === 'undefined') return createDefaultStoryState(content);

  try {
    const storageKey = STORY_SAVE_SLOTS[slot] || STORY_SAVE_SLOTS.main;
    const raw = window.localStorage.getItem(storageKey) || (
      slot === 'main' ? window.localStorage.getItem(LEGACY_STORY_SAVE_KEY) : null
    );
    if (!raw) return createDefaultStoryState(content);

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.contentVersion !== content.version) {
      return createDefaultStoryState(content);
    }

    const nextState = {
      ...createDefaultStoryState(content),
      ...parsed,
      autoStartedSequenceIds: Array.isArray(parsed.autoStartedSequenceIds) ? parsed.autoStartedSequenceIds : [],
      ui: {
        ...createDefaultStoryState(content).ui,
        ...(parsed.ui || {}),
      },
      flags: {
        ...(parsed?.flags || {}),
      },
      messenger: {
        ...createDefaultStoryState(content).messenger,
        ...(parsed.messenger || {}),
        choiceStateByEventId: {
          ...createDefaultStoryState(content).messenger.choiceStateByEventId,
          ...(parsed.messenger?.choiceStateByEventId || {}),
        },
      },
      terminal: {
        ...createDefaultStoryState(content).terminal,
        ...(parsed.terminal || {}),
      },
      work: {
        ...createDefaultStoryState(content).work,
        ...(parsed.work || {}),
        tasks: dedupeWorkTasks(parsed.work?.tasks || []),
      },
    };
    if (slot === 'main' && !window.localStorage.getItem(storageKey)) {
      saveStoryState(nextState, slot);
      window.localStorage.removeItem(LEGACY_STORY_SAVE_KEY);
    }
    return nextState;
  } catch {
    return createDefaultStoryState(content);
  }
};

export const saveStoryState = (state, slot = 'main') => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORY_SAVE_SLOTS[slot] || STORY_SAVE_SLOTS.main, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
};

export const clearStoryState = (slot = 'main') => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORY_SAVE_SLOTS[slot] || STORY_SAVE_SLOTS.main);
  } catch {
    // ignore storage failures
  }
};

export const applyStoryEffects = (state, effects = []) => {
  return effects.reduce((nextState, effect) => {
    switch (effect.type) {
      case 'setFlag':
        return {
          ...nextState,
          flags: {
            ...nextState.flags,
            [effect.key]: effect.value,
          },
        };
      case 'openApp':
        return {
          ...nextState,
          ui: {
            ...nextState.ui,
            openApps: {
              ...nextState.ui.openApps,
              [effect.appId]: true,
            },
            minimizedApps: {
              ...nextState.ui.minimizedApps,
              [effect.appId]: false,
            },
          },
        };
      case 'focusApp':
        return {
          ...nextState,
          ui: {
            ...nextState.ui,
            focusedAppId: effect.appId,
          },
        };
      case 'flashScreen':
        return {
          ...nextState,
          ui: {
            ...nextState.ui,
            screenFlashUntil: Date.now() + Math.max(0, Number(effect.durationMs || 0)),
          },
        };
      case 'showNotification':
        return {
          ...nextState,
          notifications: [
            ...nextState.notifications,
            {
              id: effect.id || `${effect.appId || 'app'}-${Date.now()}`,
              appId: effect.appId || null,
              text: effect.text || '',
            },
          ],
        };
      case 'queueSequence':
        return {
          ...nextState,
          queuedSequences: [...nextState.queuedSequences, effect.sequenceId],
        };
      case 'unlockChat': {
        const nextUnlockedChats = Array.from(new Set([...(nextState.unlockedChats || []), effect.chatId].filter(Boolean)));
        return {
          ...nextState,
          unlockedChats: nextUnlockedChats,
          ui: {
            ...nextState.ui,
            activeChatId: effect.chatId || nextState.ui?.activeChatId || '',
          },
        };
      }
      case 'pushTerminalLine':
        return {
          ...nextState,
          ui: {
            ...nextState.ui,
            openApps: {
              ...nextState.ui.openApps,
              app7: true,
            },
            minimizedApps: {
              ...nextState.ui.minimizedApps,
              app7: false,
            },
            focusedAppId: 'app7',
          },
          terminal: {
            ...nextState.terminal,
            lines: [
              ...(nextState.terminal?.lines || []),
              {
                id: effect.id || `terminal-${Date.now()}`,
                text: effect.text || '',
                status: 'pending',
              },
            ],
          },
        };
      case 'startWorkTask': {
        const nextTask = {
          id: effect.taskId || `task-${Date.now()}`,
          title: effect.title || 'Новая задача',
          prompt: effect.prompt || '',
          targetText: effect.targetText || '',
        };
        const existingTasks = nextState.work?.tasks || [];
        const nextFingerprint = getWorkTaskFingerprint(nextTask);
        const duplicateTask = existingTasks.find((task) => (
          (nextTask.id && task?.id === nextTask.id) || getWorkTaskFingerprint(task) === nextFingerprint
        ));

        if (duplicateTask) {
          return {
            ...nextState,
            work: {
              ...nextState.work,
              activeTaskId: duplicateTask.id || nextTask.id,
            },
          };
        }

        return {
          ...nextState,
          work: {
            ...nextState.work,
            tasks: [
              ...existingTasks,
              nextTask,
            ],
            activeTaskId: nextTask.id,
          },
        };
      }
      default:
        return nextState;
    }
  }, state);
};

export const consumeQueuedSequence = (state, sequenceId) => ({
  ...state,
  queuedSequences: (state.queuedSequences || []).filter((id) => id !== sequenceId),
});

export const completeMessengerScriptEvent = (state, content, chatId, eventId, options = {}) => {
  const script = getMessengerScripts(content)[chatId];
  const sceneId = state.messenger.sceneIdByChat?.[chatId] || getScriptStartSceneId(script);
  const currentScene = getScriptSceneById(script, sceneId);
  const currentIndex = state.messenger.eventIndexByChat?.[chatId] || 0;
  const currentEvent = currentScene?.events?.[currentIndex];
  if (!script || !currentScene || !currentEvent || currentEvent.id !== eventId) return state;

  const historyEntry = options.historyEntry || null;
  const isLastEventInScene = currentIndex + 1 >= (currentScene.events?.length || 0);
  const nextSceneId = isLastEventInScene ? (currentScene.nextSceneId || sceneId) : sceneId;
  const nextScene = getScriptSceneById(script, nextSceneId);
  const nextEventIndex = isLastEventInScene
    ? (nextSceneId !== sceneId && nextScene ? 0 : currentIndex + 1)
    : currentIndex + 1;

  let nextState = {
    ...state,
    messenger: {
      ...state.messenger,
      sceneIdByChat: {
        ...state.messenger.sceneIdByChat,
        [chatId]: nextSceneId,
      },
      eventIndexByChat: {
        ...state.messenger.eventIndexByChat,
        [chatId]: nextEventIndex,
      },
      historyByChat: historyEntry ? {
        ...state.messenger.historyByChat,
        [chatId]: [
          ...(state.messenger.historyByChat?.[chatId] || []),
          historyEntry,
        ],
      } : state.messenger.historyByChat,
      completedEventIds: [...(state.messenger.completedEventIds || []), eventId],
      typingByChat: {
        ...(state.messenger.typingByChat || {}),
        [chatId]: {
          active: false,
          durationMs: 0,
        },
      },
    },
  };

  const effectList = currentEvent.type === 'effect' || currentEvent.type === 'command'
    ? (currentEvent.effects || [])
    : currentEvent.type === 'message_player'
      ? (currentEvent.onSendEffects || [])
      : [];

  if (currentEvent.type === 'command' && effectList.length === 0 && currentEvent.text) {
    nextState = applyStoryEffects(nextState, [
      { type: 'openApp', appId: 'app7' },
      { type: 'focusApp', appId: 'app7' },
      { type: 'pushTerminalLine', text: currentEvent.text },
    ]);
    return nextState;
  }

  if (effectList.length > 0) {
    nextState = applyStoryEffects(nextState, effectList);
  }

  return nextState;
};
