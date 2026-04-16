const DEFAULT_APP_DATA = {
  notes: {
    seedNotes: [
      { id: 'note1', title: 'Список дел', preview: 'Купить, позвонить, написать', body: 'Купить хлеб и молоко. Позвонить Ане. Написать команде про обновление.' },
      { id: 'note2', title: 'Идеи', preview: 'Геймплей и атмосфера', body: 'Сделать переходы мягче. Добавить шумы города. Спрятать пасхалки в окнах.' },
      { id: 'note3', title: 'Наброски', preview: 'Сюжетные точки', body: 'Начало - тишина. Середина - перегруз. Конец - выбор.' },
      { id: 'note4', title: 'Мысли', preview: 'Про внимание', body: 'Внимание - ограниченный ресурс. Игрок сам выбирает, чем его тратить.' },
      { id: 'note5', title: 'Тексты', preview: 'Короткие фразы', body: 'Сейчас тишина кажется громкой. Мы сами находим шум.' },
      { id: 'note6', title: 'Референсы', preview: 'Кино, музыка', body: 'Плейлисты для сцены старта и финала. Фильмы: "Она", "Социальная сеть".' },
      { id: 'note7', title: 'Правки', preview: 'UI/UX', body: 'Упростить навигацию. Скрыть второстепенные кнопки. Увеличить контраст.' },
      { id: 'note8', title: 'Логика', preview: 'Состояния', body: 'Старт, середина, конец. Сохранять прогресс автоматически.' },
      { id: 'note9', title: 'Диалоги', preview: 'Персонажи', body: 'Короткие реплики, без лишних слов. Важна пауза между сообщениями.' },
      { id: 'note10', title: 'TODO', preview: 'Следующие шаги', body: 'Дополировать иконки. Подготовить билд. Добавить тексты уведомлений.' },
      { id: 'note11', title: 'Ночь', preview: 'Атмосфера', body: 'Теплый свет окон, редкие звуки, пустые улицы.' },
      { id: 'note12', title: 'Звук', preview: 'Сэмплы', body: 'Клавиши, уведомления, гул города. Без перегруза.' },
      { id: 'note13', title: 'Сцены', preview: 'Переходы', body: 'Переходы должны быть плавными и незаметными, без резких вспышек.' },
      { id: 'note14', title: 'Тон', preview: 'Голос игры', body: 'Спокойный, тихий, уверенный. Без агрессии.' },
      { id: 'note15', title: 'Мета', preview: 'Смысл', body: 'Игра - зеркало привычек. Чем дольше смотришь, тем яснее.' },
    ],
  },
  calendar: {
    seedEvents: [
      { id: 'cal-interview-today', title: 'Собеседование', note: 'сегодня точно!', offset: 0 },
      { id: 'cal-work', title: 'Общие рабочие задачи', note: 'созвоны, статусы, правки', offset: 0 },
      { id: 'cal-friend', title: 'Встреча с другом', note: 'поиграть / погулять / созвониться', offset: 1 },
      { id: 'cal-mom', title: 'Поездка к маме', note: 'в числе прочих дел', offset: 4 },
      { id: 'cal-interview-past', title: 'Собеседование', note: 'кажется, не состоялось', offset: -7 },
    ],
  },
  terminal: {
    seedLines: [],
    placeholder: '> > C:\\Users\\G> ожидание ввода...',
  },
  workConveyor: {
    seedTasks: [],
    submitLabel: 'Отправить',
    emptyText: 'Пока задач нет.',
  },
};

export const normalizeEditorContent = (content, fallbackContent = content) => {
  const fallbackApps = fallbackContent?.apps || [];
  const sourceApps = content?.apps || fallbackApps;
  const fallbackAppIds = new Set(fallbackApps.map((app) => app.id));
  const apps = fallbackApps.map((fallbackApp) => {
    const sourceApp = sourceApps.find((app) => app.id === fallbackApp.id && fallbackAppIds.has(app.id));
    return sourceApp ? { ...fallbackApp, ...sourceApp } : fallbackApp;
  });

  const fallbackChats = fallbackContent?.messenger?.chats || [];
  const sourceChats = content?.messenger?.chats || fallbackChats;
  const chats = fallbackChats.map((fallbackChat) => {
    const sourceChat = sourceChats.find((chat) => chat.id === fallbackChat.id);
    return sourceChat ? { ...fallbackChat, ...sourceChat } : fallbackChat;
  });

  const fallbackScripts = fallbackContent?.messenger?.scripts || {};
  const sourceScripts = content?.messenger?.scripts || {};
  const scripts = Object.fromEntries(
    chats.map((chat) => {
      const fallbackScript = fallbackScripts[chat.id] || {
        id: chat.id,
        title: chat.title,
        startSceneId: '',
        scenes: [],
      };
      const sourceScript = sourceScripts[chat.id] || {};
      const scenes = Array.isArray(sourceScript.scenes)
        ? sourceScript.scenes
        : Array.isArray(fallbackScript.scenes)
          ? fallbackScript.scenes
          : [];
      const requestedStartSceneId = sourceScript.startSceneId || fallbackScript.startSceneId || scenes[0]?.id || '';
      const hasStartScene = scenes.some((scene) => scene.id === requestedStartSceneId);

      return [chat.id, {
        ...fallbackScript,
        ...sourceScript,
        id: chat.id,
        title: sourceScript.title || chat.title,
        scenes,
        startSceneId: hasStartScene ? requestedStartSceneId : (scenes[0]?.id || ''),
      }];
    }),
  );

  return {
    ...fallbackContent,
    ...content,
    version: fallbackContent?.version || content?.version,
    apps,
    messenger: {
      ...(fallbackContent?.messenger || {}),
      ...(content?.messenger || {}),
      chats,
      scripts,
    },
    appData: {
      notes: {
        ...DEFAULT_APP_DATA.notes,
        ...(content?.appData?.notes || {}),
        seedNotes: content?.appData?.notes?.seedNotes || DEFAULT_APP_DATA.notes.seedNotes,
      },
      calendar: {
        ...DEFAULT_APP_DATA.calendar,
        ...(content?.appData?.calendar || {}),
        seedEvents: content?.appData?.calendar?.seedEvents || DEFAULT_APP_DATA.calendar.seedEvents,
      },
      terminal: {
        ...DEFAULT_APP_DATA.terminal,
        ...(content?.appData?.terminal || {}),
        seedLines: content?.appData?.terminal?.seedLines || DEFAULT_APP_DATA.terminal.seedLines,
      },
      workConveyor: {
        ...DEFAULT_APP_DATA.workConveyor,
        ...(content?.appData?.workConveyor || {}),
        seedTasks: content?.appData?.workConveyor?.seedTasks || DEFAULT_APP_DATA.workConveyor.seedTasks,
      },
    },
    sequences: Array.isArray(content?.sequences) ? content.sequences : (fallbackContent?.sequences || []),
  };
};

export const normalizeEditorConfig = (config, fallbackConfig) => ({
  ...fallbackConfig,
  ...config,
  apps: (() => {
    const fallbackApps = fallbackConfig?.apps || [];
    const configuredApps = config?.apps || fallbackApps;
    const fallbackAppIds = new Set(fallbackApps.map((app) => app.id));
    const filteredConfiguredApps = configuredApps.filter((app) => fallbackAppIds.has(app.id));

    return fallbackApps.map((fallbackApp) => {
      const configuredApp = filteredConfiguredApps.find((app) => app.id === fallbackApp.id);
      return configuredApp ? { ...fallbackApp, ...configuredApp } : fallbackApp;
    });
  })(),
  timings: {
    ...fallbackConfig.timings,
    ...(config?.timings || {}),
  },
  typingPresets: {
    ...fallbackConfig.typingPresets,
    ...(config?.typingPresets || {}),
  },
});
