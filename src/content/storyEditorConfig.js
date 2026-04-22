export const STORY_EDITOR_CONFIG = {
  apps: [
    { id: 'app1', type: 'notes', title: 'Заметки', window: { width: 900, height: 620 } },
    { id: 'app7', type: 'terminal', title: 'Терминал', window: { width: 900, height: 620 } },
    { id: 'app3', type: 'messenger', title: 'Мессенджер', window: { width: 900, height: 620 } },
    { id: 'app4', type: 'social', title: 'Соцсеть', window: { width: 900, height: 620 } },
    { id: 'app5', type: 'work-conveyor', title: 'Конвейер', window: { width: 980, height: 680 } },
    { id: 'app6', type: 'calendar', title: 'Календарь', window: { width: 900, height: 620 } },
    { id: 'exit', type: 'exit', title: 'Выход', window: { width: 900, height: 620 } },
  ],
  timings: {
    messageGapMs: 900,
    typingDurationMs: 1600,
    autoSelectDelayMs: 1000,
    notificationDurationMs: 5000,
    socialAutoscrollDurationMs: 5200,
  },
  typingPresets: {
    short: 900,
    medium: 1600,
    long: 2600,
  },
};

export const getEditorAppConfig = (appId) => (
  STORY_EDITOR_CONFIG.apps.find((app) => app.id === appId) || null
);
