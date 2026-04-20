import React, { useState, useRef, useEffect } from 'react';
import logo from './logo.svg';
import { useMemo, useCallback } from 'react';
import iconNotes from './icons/заметки.png';
import iconMessenger from './icons/мессенджер 3.png';
import iconSocial from './icons/соцсеть 1.png';
import iconCalendar from './icons/календарь 1.png';
import iconConveyor from './icons/конвейер.png';
import iconExit from './icons/выход 2.png';
import AppWindowContent from './components/AppWindowContent';
import DesktopIcon from './components/DesktopIcon';
import DesktopWindow from './components/DesktopWindow';
import DevEditorPanel from './components/DevEditorPanel';
import { STORY_CONTENT } from './content/storyContent';
import { getEditorAppConfig, STORY_EDITOR_CONFIG } from './content/storyEditorConfig';
import {
  applyStoryEffects,
  clearStoryState,
  completeMessengerScriptEvent,
  consumeQueuedSequence,
  createDefaultStoryState,
  getActiveMessengerScene,
  loadStoryState,
  saveStoryState,
} from './engine/storyEngine';
import { normalizeEditorConfig, normalizeEditorContent } from './engine/editorDraft';
import { validateStoryContent } from './engine/storyValidation';
import './App.css';

const INITIAL_EDITOR_CONTENT = normalizeEditorContent(STORY_CONTENT, STORY_CONTENT);
const INITIAL_EDITOR_CONFIG = normalizeEditorConfig(STORY_EDITOR_CONFIG, STORY_EDITOR_CONFIG);
const PROLOGUE_AUDIO_SRC = '/files/audio/intro.mp3';

const ICON_IMAGE_BY_ID = {
  app1: iconNotes,
  app3: iconMessenger,
  app4: iconSocial,
  app5: iconConveyor,
  app6: iconCalendar,
  exit: iconExit,
};
const ICON_IMAGE_BY_TYPE = {
  notes: iconNotes,
  messenger: iconMessenger,
  social: iconSocial,
  'work-conveyor': iconConveyor,
  calendar: iconCalendar,
  exit: iconExit,
};
const EDITOR_DRAFT_STORAGE_KEY = 'story_editor_draft_v1';
const EDITOR_LAST_GOOD_STORAGE_KEY = 'story_editor_last_good_v1';
const EDITOR_SNAPSHOTS_STORAGE_KEY = 'story_editor_snapshots_v1';
const EDITOR_RECOVERY_STORAGE_KEY = 'story_editor_recovery_v1';
const EDITOR_MAX_SNAPSHOTS = 20;
const LEGACY_EDITOR_STORAGE_KEYS = [
  EDITOR_DRAFT_STORAGE_KEY,
  EDITOR_LAST_GOOD_STORAGE_KEY,
  EDITOR_SNAPSHOTS_STORAGE_KEY,
  EDITOR_RECOVERY_STORAGE_KEY,
];
const clearLegacyEditorStorage = () => {
  if (typeof window === 'undefined') return;
  LEGACY_EDITOR_STORAGE_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage failures
    }
  });
};
const DEFAULT_WINDOW_SIZE = { width: 900, height: 620 };
const SOCIAL_PEOPLE = [
  { name: 'Лера', handle: 'lera' },
  { name: 'Макс', handle: 'max' },
  { name: 'Саша', handle: 'sasha' },
  { name: 'Ира', handle: 'ira' },
  { name: 'Костя', handle: 'kostya' },
  { name: 'Мила', handle: 'mila' },
  { name: 'Тим', handle: 'tim' },
  { name: 'Даша', handle: 'dasha' },
];
const SOCIAL_CAPTIONS = [
  'город после дождя. звук шин и теплый свет витрин.',
  'сохранить это состояние, пока оно не разошлось по делам.',
  'медленные шаги, быстрые мысли. оставляю тут.',
  'ночь раздвигает шум, остается только ритм.',
  'сегодня хочется меньше текста и больше воздуха.',
  'все вокруг растянулось, но я запомнил кадр.',
  'чуть-чуть ближе к себе, чуть дальше от ленты.',
  'когда все ускоряется, выбираю паузу.',
  'случайная тень, нужный цвет, мгновенный кадр.',
  'день складывается из мелких деталей, как этот.',
];
const getVisibleChatList = (content, unlockedChatIds = []) => {
  const unlockedSet = new Set(unlockedChatIds);
  return (content?.messenger?.chats || []).filter((chat) => unlockedSet.has(chat.id));
};
const getPreferredActiveChatId = (content, unlockedChatIds = [], requestedChatId = '') => {
  const visibleChats = getVisibleChatList(content, unlockedChatIds);
  if (requestedChatId && visibleChats.some((chat) => chat.id === requestedChatId)) {
    return requestedChatId;
  }
  return visibleChats[0]?.id || content?.messenger?.chats?.[0]?.id || 'chat1';
};
const normalizeWorkTaskText = (value) => (typeof value === 'string' ? value.trim() : '');
const getWorkTaskFingerprint = (task) => (
  [
    normalizeWorkTaskText(task?.title),
    normalizeWorkTaskText(task?.prompt),
    normalizeWorkTaskText(task?.targetText),
  ].join('::')
);
const getUniqueWorkTasks = (seedTasks = [], runtimeTasks = []) => {
  const taskMap = new Map();
  [...seedTasks, ...runtimeTasks].forEach((task) => {
    if (!task?.id) return;
    const fingerprint = getWorkTaskFingerprint(task);
    const duplicateTask = Array.from(taskMap.values()).some((existingTask) => (
      existingTask.id === task.id || getWorkTaskFingerprint(existingTask) === fingerprint
    ));
    if (duplicateTask) return;
    taskMap.set(task.id, task);
  });
  return Array.from(taskMap.values());
};
const CONVEYOR_EFFICIENCY_MIN = 10;
const CONVEYOR_EFFICIENCY_MAX = 89;
const CONVEYOR_EFFICIENCY_START = 24;
const CONVEYOR_EFFICIENCY_PENALTY_WINDOW_MS = 2 * 60 * 1000;
const CONVEYOR_EFFICIENCY_GAIN_SUBMIT = 4;
const CONVEYOR_MESSAGES_LIMIT = 3;
const WINDOW_DRAG_PADDING = 12;
const WINDOW_VISIBLE_HEADER_GAP = 18;
const CONVEYOR_TASK_NUMBER_MIN = 1;
const CONVEYOR_TASK_NUMBER_MAX = 2500;
const TERMINAL_ADVENTURE_PROMPT_ID = 'terminal-adventure-confirm';
const TERMINAL_ADVENTURE_CHOICE_EVENT_ID = 'k_066';
const TERMINAL_ADVENTURE_PLAYER_EVENT_ID = 'k_067';
const TERMINAL_ADVENTURE_CHAT_ID = 'chat-k';
const TERMINAL_ADVENTURE_ACCEPT_TEXT = 'Да';
const TERMINAL_ADVENTURE_ACCEPT_DELAY_MS = 2000;
const TERMINAL_ADVENTURE_TYPE_INTERVAL_MS = 120;
const TERMINAL_ADVENTURE_AUTO_REPLY_TEXT = 'Я в деле!';
const TERMINAL_ADVENTURE_AUTO_REPLY_DELAY_MS = 700;
const TERMINAL_ADVENTURE_AUTO_REPLY_TYPE_INTERVAL_MS = 85;
const TERMINAL_ADVENTURE_DECLINE_TEXT = 'Звучит отлично, но я очень занят сейчас';
const TERMINAL_ADVENTURE_DECLINE_EXTRA_TAPS = 5;
const TERMINAL_PROTOCOL_ELLIPSIS_TEXT = '...';
const TERMINAL_PROTOCOL_ELLIPSIS_4_SPEED_MS = 500;
const TERMINAL_PROTOCOL_ELLIPSIS_6_SPEED_MS = 500;
const TERMINAL_PROTOCOL_ELLIPSIS_7_SPEED_MS = 500;
const TERMINAL_PROTOCOL_RETRY_DELAY_MS = 2000;
const TERMINAL_PROTOCOL_ENDING_TEXT = 'НАЧАЛО: Погоня за звездой';
const TERMINAL_PROTOCOL_ENDING_DELAY_MS = 2000;
const PERSISTENT_NOTIFICATION_LIFETIME_MS = 5000;
const SOCIAL_FIRST_OPEN_TERMINAL_TEXT = `Я знаю даже, как сейчас дела у нескольких случайных,
Совершенно незнакомых мне людей`;
const SOCIAL_SCROLL_TERMINAL_TEXT = 'да, отдохни немного, расслабь ум';
const SOCIAL_SCROLL_TERMINAL_DELAY_MS = 10000;

const CONVEYOR_AMBIENT_NOTIFICATION_INTERVAL_MS = 30000;
const CONVEYOR_AMBIENT_NOTIFICATION_COOLDOWN_MS = 60000;
const CONVEYOR_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const CONVEYOR_IDLE_WINDOW_MS = 5 * 60 * 1000;
const CONVEYOR_AMBIENT_POOLS = {
  active: {
    chance: 0.3,
    items: [
      { tone: 'success', text: 'Доступны новые задачи.' },
      { tone: 'success', text: 'Новые задания поступили в поток!' },
      { tone: 'success', text: 'Вы в топ 34% сотрудников' },
      { tone: 'success', text: 'Ваш вклад важен.' },
      { tone: 'success', text: 'Система ценит вашу активность.' },
      { tone: 'success', text: 'Мария только что получила повышение!' },
      { tone: 'success', text: 'Активность пользователя повышена.' },
      { tone: 'success', text: 'Отличная динамика выполнения задач!' },
      { tone: 'neutral', text: 'Задача отправлена в обработку.' },
      { tone: 'neutral', text: 'Текст добавлен в общий поток.' },
      { tone: 'neutral', text: 'Проверка текста завершена.' },
      { tone: 'neutral', text: 'Система обновляет показатели.' },
      { tone: 'neutral', text: 'Поток задач обновлен.' },
      { tone: 'neutral', text: 'Обновление статистики.' },
      { tone: 'neutral', text: 'Активность пользователя зафиксирована.' },
      { tone: 'neutral', text: 'Система обновляет данные.' },
      { tone: 'neutral', text: 'Новые задачи готовы.' },
      { tone: 'neutral', text: 'Рабочий поток стабилен.' },
      { tone: 'neutral', text: 'Система обновляет показатели.' },
      { tone: 'neutral', text: 'Проверка активности пользователя.' },
      { tone: 'neutral', text: 'Обновление статистики завершено.' },
      { tone: 'neutral', text: 'Поток задач синхронизирован.' },
    ],
  },
  idle: {
    chance: 0.4,
    items: [
      { tone: 'neutral', text: 'Новые задания поступили в поток!' },
      { tone: 'neutral', text: 'Другие пользователи продолжают работу.' },
      { tone: 'warning', text: 'Вы в топ 67% сотрудников' },
      { tone: 'warning', text: 'Вы работаете быстрее/медленнее большинства пользователей.' },
      { tone: 'warning', text: 'Некоторые пользователи работают быстрее вас.' },
      { tone: 'warning', text: 'Показатель активности снижается.' },
      { tone: 'neutral', text: 'Поток задач обновлен.' },
      { tone: 'neutral', text: 'Система обновляет данные.' },
      { tone: 'neutral', text: 'Новые задачи готовы.' },
      { tone: 'neutral', text: 'Проверка активности пользователя.' },
    ],
  },
  longIdle: {
    chance: 0.7,
    items: [
      { tone: 'warning', text: 'Ваша эффективность падает.' },
      { tone: 'warning', text: 'Вы в топ 67% сотрудников' },
      { tone: 'warning', text: 'Вы работаете быстрее/медленнее большинства пользователей.' },
      { tone: 'warning', text: 'Ваша продуктивность снизилась.' },
      { tone: 'warning', text: 'Некоторые пользователи работают быстрее вас.' },
      { tone: 'warning', text: 'Алексей выполнил 245 задач сегодня' },
      { tone: 'warning', text: 'Показатель активности снижается.' },
      { tone: 'warning', text: 'Ваша позиция в рейтинге ухудшилась.' },
      { tone: 'warning', text: 'Другие пользователи продолжают работу.' },
      { tone: 'neutral', text: 'Поток задач синхронизирован.' },
    ],
  },
};

const getRandomConveyorTaskNumber = (taskNumbers = {}) => {
  const assignedNumbers = new Set(
    Object.values(taskNumbers).filter((value) => (
      Number.isInteger(value)
      && value >= CONVEYOR_TASK_NUMBER_MIN
      && value <= CONVEYOR_TASK_NUMBER_MAX
    )),
  );

  if (assignedNumbers.size >= (CONVEYOR_TASK_NUMBER_MAX - CONVEYOR_TASK_NUMBER_MIN + 1)) {
    return CONVEYOR_TASK_NUMBER_MIN;
  }

  let nextNumber = CONVEYOR_TASK_NUMBER_MIN;
  do {
    nextNumber = Math.floor(
      Math.random() * (CONVEYOR_TASK_NUMBER_MAX - CONVEYOR_TASK_NUMBER_MIN + 1),
    ) + CONVEYOR_TASK_NUMBER_MIN;
  } while (assignedNumbers.has(nextNumber));

  return nextNumber;
};

const getRandomArrayItem = (items = [], excludeText = '') => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const filteredItems = excludeText
    ? items.filter((item) => item?.text !== excludeText)
    : items;
  const source = filteredItems.length > 0 ? filteredItems : items;
  return source[Math.floor(Math.random() * source.length)] || null;
};

const getNextMessengerCharIndex = (targetText = '', typedText = '') => {
  let nextIndex = typedText.length;
  while (targetText[nextIndex] === ' ') {
    nextIndex += 1;
  }
  return nextIndex;
};

const appendNextMessengerChar = (typedText = '', targetText = '') => {
  let nextText = typedText;
  let nextIndex = typedText.length;

  while (targetText[nextIndex] === ' ') {
    nextText += ' ';
    nextIndex += 1;
  }

  const nextChar = targetText[nextIndex] || '';
  if (!nextChar) return nextText;
  return `${nextText}${nextChar}`;
};

const trimMessengerTypedText = (typedText = '', targetText = '') => {
  if (!typedText) return '';

  let nextText = typedText.slice(0, -1);
  while (nextText && targetText[nextText.length] === ' ') {
    nextText = nextText.slice(0, -1);
  }

  return nextText;
};

const getCreditsFromCompletionMessage = (message = '') => {
  if (typeof message !== 'string' || !message) return null;
  const match = message.match(/\+\s*(\d+)/);
  if (!match) return null;
  const parsedValue = Number(match[1]);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeAdventureDraftText = (value = '') => (
  typeof value === 'string'
    ? value.trim().replace(/[.!?…]+$/u, '')
    : ''
);

const createTerminalProtocolLine = (text, { id, typeSpeedMs, delayMs = 0 } = {}) => ({
  id: id || `terminal-protocol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  text,
  status: 'pending',
  typeSpeedMs,
  delayMs,
});

const getTerminalLineDurationMs = (line) => {
  if (!line?.text) return 0;
  return Math.max(0, Math.ceil((line.text || '').length * Number(line.typeSpeedMs || 22)));
};

const getAdventureShownDiagnosticKeys = (yesCount = 0) => {
  const keys = [];
  if (yesCount >= 1) {
    keys.push('ratio', 'book', 'reject');
  }
  if (yesCount >= 2) {
    keys.push('calendar', 'reject');
  }
  if (yesCount >= 3) {
    keys.push('mom', 'reject');
  }
  return keys;
};

const ensureConveyorTaskNumbers = (tasks = [], taskNumbers = {}) => {
  let nextTaskNumbers = taskNumbers;

  tasks.forEach((task) => {
    if (!task?.id || Number.isInteger(nextTaskNumbers?.[task.id])) return;

    if (nextTaskNumbers === taskNumbers) {
      nextTaskNumbers = { ...taskNumbers };
    }

    nextTaskNumbers[task.id] = getRandomConveyorTaskNumber(nextTaskNumbers);
  });

  return nextTaskNumbers;
};

function App() {
  const isDev = process.env.NODE_ENV !== 'production';
  const initialPathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isDevRoute = isDev && initialPathname.startsWith('/dev');
  const runtimeSlot = isDevRoute ? 'dev' : 'main';
  const [editorContent, setEditorContent] = useState(INITIAL_EDITOR_CONTENT);
  const [editorConfig, setEditorConfig] = useState(INITIAL_EDITOR_CONFIG);
  const [storyState, setStoryState] = useState(() => loadStoryState(INITIAL_EDITOR_CONTENT, runtimeSlot));
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorDraftSavedAt, setEditorDraftSavedAt] = useState(null);
  const [editorAutoSavedAt, setEditorAutoSavedAt] = useState(null);
  const [editorLastGoodSavedAt, setEditorLastGoodSavedAt] = useState(null);
  const [editorSnapshots, setEditorSnapshots] = useState([]);
  const [editorDraftBaseline, setEditorDraftBaseline] = useState(() => (
    JSON.stringify({
      config: INITIAL_EDITOR_CONFIG,
      content: INITIAL_EDITOR_CONTENT,
    })
  ));

  useEffect(() => {
    if (!isDev) return;
    setEditorContent(INITIAL_EDITOR_CONTENT);
    setEditorConfig(INITIAL_EDITOR_CONFIG);
  }, [isDev, INITIAL_EDITOR_CONTENT, INITIAL_EDITOR_CONFIG]);
  const landingInfo = [
    'FoMO (Fear of Missing Out) — это страх упущенных возможностей, ощущение, что где-то прямо сейчас происходит что-то более важное, интересное и ценное, чем то, чем человек занят в данный момент. В цифровую эпоху этот страх усиливается постоянным потоком уведомлений, новостей и образов чужой жизни, превращаясь в фоновую тревогу и хроническое чувство неудовлетворенности. FoMO заставляет нас непрерывно проверять экран, сравнивать себя с другими и терять контакт с собственным опытом, постепенно превращая внимание в главный ресурс современной жизни.Мы живем в мире, где почти невозможно просто быть. Каждый момент сопровождается ощущением, что где-то происходит что-то более важное, интересное, насыщенное и значимое. Чужие жизни мерцают в экране, складываясь в бесконечную ленту событий, достижений, встреч и возможностей. На этом фоне собственная реальность начинает казаться бледной, медленной и недостаточной. Так возникает FoMO — страх упущенных возможностей.',
    'FoMO (Fear of Missing Out) — это не продукт цифровой эпохи. Это древний человеческий страх оказаться вне стаи, вне событий, вне жизни. Однако именно цифровая среда превратила его в постоянный фон существования. Социальные сети, мессенджеры, алгоритмы рекомендаций и бесконечные ленты обновлений создают ощущение непрерывного движения, в котором невозможно сделать паузу, не испытывая тревоги. Каждый пропущенный пост, сторис или сообщение начинает ощущаться как потеря — социальной связи, статуса, значимости, опыта.',
    'Современные способы борьбы с этим состоянием кажутся грубыми и неэффективными. Советы «отложить телефон», «ограничить экранное время» или «уйти в цифровой детокс» предлагают механическое решение, не затрагивающее корень проблемы. Они воспринимают FoMO как вредную привычку, тогда как на самом деле это сложный психологический механизм, связанный с фундаментальными человеческими потребностями: в автономии, принадлежности и ощущении собственной ценности. Запреты не снимают тревогу, а лишь временно заглушают ее, после чего она возвращается в усиленной форме.',
    'FoMO — это парализующий страх, который делает человека хронически неудовлетворенным настоящим. Он мешает сосредоточиться, обесценивает текущий опыт, подталкивает к постоянному сравнению себя с другими и формирует ощущение, что жизнь проходит где-то мимо. В русскоязычном культурном поле этот феномен практически не осмыслен: отсутствует устоявшийся термин, нет развитой рефлексии, а значит, и пространства для диалога. Между тем FoMO становится одной из ключевых форм современной тревожности, особенно среди молодых пользователей цифровых сред.',
    'Проект «Фомо» — это попытка создать такое пространство для размышления и переживания. Вместо рационального объяснения и морализаторства проект предлагает опыт: интерактивную симуляцию цифрового мира, в которой пользователь сталкивается с механизмами захвата внимания, иллюзией бесконечного выбора и ощущением постоянной срочности. Формат веб-проекта выбран не случайно: именно в браузере — привычной среде онлайн-жизни — можно наиболее точно воспроизвести архитектуру FoMO и вовлечь пользователя не как наблюдателя, а как участника происходящего.',
    'Внутри проекта цифровая среда предстает как самовоспроизводящийся организм, бесконечно генерирующий поводы для вовлечения. Здесь алгоритмы не просто предлагают контент — они формируют эмоциональный ландшафт, в котором тревога становится нормой, а внимание — валютой. Использование нейросетевых технологий усиливает этот эффект: бесконечная генерация образов, текстов и событий подчеркивает масштаб и безличность цифрового потока, в котором человеческое внимание растворяется, теряя ориентиры.',
    'Цель проекта — не борьба с цифровыми технологиями и не романтизация «аналоговой жизни». Напротив, он стремится к более тонкому диалогу: к исследованию того, как именно цифровая среда формирует наши реакции, ожидания и тревоги, и какие ненасильственные способы адаптации возможны. Проект не предлагает «отключиться» — он предлагает заметить, как мы включены.',
    '«Фомо» — это интерактивный веб-проект и одновременно исследование механик цифрового внимания. Его задача — не только воспроизвести состояние FoMO, но и создать пространство для замедления, осознания и возвращения автономии. В финале пользователь сталкивается не с победой или поражением, а с паузой — редкой возможностью остаться наедине с собственным вниманием и почувствовать его границы.',
    'В условиях стремительного развития нейросетевых технологий цифровое внимание приобретает новые формы. Генеративные алгоритмы делают цифровой мир еще более плотным, насыщенным и самодостаточным. Отражая этот бесконечный поток внутри проекта, автор стремится не только исследовать феномен FoMO, но и расширить представление о выразительных возможностях современных веб-инструментов. Таким образом, «Фомо» становится пространством пересечения искусства, технологии и психологического исследования — попыткой говорить о тревоге не языком запретов, а языком опыта.',
  ];
  const PROLOGUE_TEXT = `Это было самое жаркое лето за последние 11 лет. Мы почти не были знакомы, но они почему-то тогда решили позвать меня с собой. Каждую ночь мы спали в разных местах — на каменном склоне горы, в широком поле среди облаков и в густом кедровом лесу.
Ночью, когда становилось тихо, я выбирался из палатки посидеть в одиночестве, в темноте, под звездами, чтобы убедиться, что это и вправду происходит именно со мной.
`;
  const icons = useMemo(
    () => editorConfig.apps
      .filter((app) => app.id !== 'exit')
      .map((app) => ({
        id: app.id,
        title: app.title || getEditorAppConfig(app.id)?.title || app.id,
        img: ICON_IMAGE_BY_ID[app.id] || ICON_IMAGE_BY_TYPE[app.type] || null,
        hideLabel: app.id === 'app7',
      })),
    [editorConfig.apps],
  );
  const validationIssues = useMemo(
    () => (isDevRoute ? validateStoryContent(editorContent, editorConfig) : []),
    [editorConfig, editorContent, isDevRoute],
  );
  const editorDraftSnapshot = useMemo(
    () => (
      isDevRoute
        ? JSON.stringify({
          config: editorConfig,
          content: editorContent,
        })
        : editorDraftBaseline
    ),
    [editorConfig, editorContent, editorDraftBaseline, isDevRoute],
  );
  const hasUnsavedEditorChanges = editorDraftSnapshot !== editorDraftBaseline;

  // This beat runner must not depend on the full messenger object:
  // typing state updates would cancel scheduled deliveries before the message arrives.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // This beat runner must not depend on the full messenger object:
  // typing state updates would cancel scheduled deliveries before the message arrives.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    clearLegacyEditorStorage();
  }, []);

  const persistEditorSnapshot = ({ reason = 'autosave', markAsLastGood = false } = {}) => {
    const savedAt = Date.now();
    const nextSnapshot = {
      id: `snapshot_${savedAt}`,
      savedAt,
      reason,
      config: editorConfig,
      content: editorContent,
    };
    setEditorAutoSavedAt(savedAt);

    setEditorSnapshots((prev) => {
      const previousSnapshots = Array.isArray(prev) ? prev : [];
      const lastSnapshot = previousSnapshots[previousSnapshots.length - 1];
      const hasChangedSinceLast = !lastSnapshot
        || JSON.stringify({
          config: lastSnapshot.config,
          content: lastSnapshot.content,
        }) !== editorDraftSnapshot;

      if (!hasChangedSinceLast) return previousSnapshots;

      return [...previousSnapshots, nextSnapshot].slice(-EDITOR_MAX_SNAPSHOTS);
    });

    if (markAsLastGood) {
      setEditorLastGoodSavedAt(savedAt);
      setEditorDraftSavedAt(savedAt);
      setEditorDraftBaseline(editorDraftSnapshot);
    }

    return savedAt;
  };

  const GAME_ICON_ID = 'app1';
  const EXIT_ICON_ID = 'exit';

  const desktopRef = useRef(null);
  const frameRef = useRef(null);
  const scaleRef = useRef(1);
  const desktopRectRef = useRef(null);
  const iconSizeRef = useRef({ width: 170, height: 142 });
  const lastBoundsRef = useRef(null);
  const socialFeedRef = useRef(null);
  const socialPostIndexRef = useRef(0);
  const socialLoadingRef = useRef(false);
  const socialScrollPromptTimerRef = useRef(null);
  const runningSequencesRef = useRef(new Set());
  const sequenceTimersRef = useRef([]);
  const beatAdvanceTimerRef = useRef(null);
  const beatRevealTimersRef = useRef([]);
  const typingTimersRef = useRef({});
  const workSubmitTimersRef = useRef([]);
  const conveyorNotifTimersRef = useRef([]);
  const conveyorTerminalTimersRef = useRef([]);
  const terminalLineCountRef = useRef(null);
  const messengerThreadRef = useRef(null);
  const messengerInputFieldRef = useRef(null);
  const triggeredMessageFocusEffectsRef = useRef(new Set());
  const messengerInputStickyFocusRef = useRef(false);
  const messengerInputRestorePendingRef = useRef(false);
  const conveyorVisibilityRef = useRef({ visible: false, frontmost: false });
  const socialVisibilityRef = useRef(false);
  const calendarVisibilityRef = useRef(false);
  const conveyorEngagementGainRef = useRef(null);
  const getDefaultIconPositions = useCallback((savedPositions = {}) => {
    const map = {};
    const defaultPositionsById = {
      app1: { x: 70, y: 760 },
      app3: { x: 1510, y: 910 },
      app4: { x: 1615, y: 760 },
      app5: { x: 870, y: 430 },
      app6: { x: 1720, y: 120 },
      exit: { x: 640, y: 930 },
      app7: { x: 220, y: 56 },
    };

    icons.forEach((it, i) => {
      map[it.id] = defaultPositionsById[it.id] || { x: 48, y: 56 + i * 170 };
    });
    Object.keys(savedPositions || {}).forEach((key) => {
      const item = savedPositions[key];
      if (map[key] && item && typeof item.x === 'number' && typeof item.y === 'number') {
        map[key] = { x: item.x, y: item.y };
      }
    });
    return map;
  }, [icons]);

  const getDefaultWindowState = useCallback((savedWindowState = {}) => {
    const map = {};
    icons.forEach((it) => {
      map[it.id] = {
        size: DEFAULT_WINDOW_SIZE,
        pos: { x: 120 + Math.random() * 80, y: 80 + Math.random() * 60 },
        z: 1,
      };
    });
    Object.keys(savedWindowState || {}).forEach((key) => {
      const item = savedWindowState[key];
      if (!map[key] || !item) return;
      map[key] = {
        ...map[key],
        size: item.size && typeof item.size.width === 'number' && typeof item.size.height === 'number'
          ? item.size
          : map[key].size,
        pos: item.pos && typeof item.pos.x === 'number' && typeof item.pos.y === 'number'
          ? item.pos
          : map[key].pos,
        z: typeof item.z === 'number' ? item.z : map[key].z,
      };
    });
    return map;
  }, [icons]);

  const [gameProgress, setGameProgress] = useState(() => storyState.flags.gameProgress || 'start');
  const [gameScreen, setGameScreen] = useState(() => storyState.ui.gameScreen || 'game');
  const [view, setView] = useState(() => storyState.ui.view || 'desktop');
  const [prologueStarted, setPrologueStarted] = useState(false);
  const [prologueIndex, setPrologueIndex] = useState(0);
  const [prologueDone, setPrologueDone] = useState(false);
  const [endingStarted, setEndingStarted] = useState(false);
  const [endingIndex, setEndingIndex] = useState(0);
  const [endingDone, setEndingDone] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifVariant, setNotifVariant] = useState('initial');
  const [toastLeaving, setToastLeaving] = useState(false);
  const [screenFlashActive, setScreenFlashActive] = useState(false);
  const [typedByChat, setTypedByChat] = useState({});
  const [adventureDeclineInputState, setAdventureDeclineInputState] = useState(null);
  const [activeNoteId, setActiveNoteId] = useState('note1');
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [activeChatId, setActiveChatId] = useState(() => (
    storyState.ui.activeChatId || editorContent.messenger.chats[0]?.id || 'chat1'
  ));
  const [activeWorkTaskId, setActiveWorkTaskId] = useState(null);
  const [workSubmitFeedback, setWorkSubmitFeedback] = useState(null);
  const [socialPosts, setSocialPosts] = useState([]);
  const [persistentNotifs, setPersistentNotifs] = useState([]);
  const openRef = useRef({});
  const minimizedRef = useRef({});
  const terminalPromptTimersRef = useRef([]);
  const persistentNotifTimersRef = useRef([]);
  const screenFlashTimerRef = useRef(null);
  const prologueAudioRef = useRef(null);
  const prologueAudioStartedRef = useRef(false);

  const bringToFront = useCallback((id) => {
    setWinState((s) => {
      const maxZ = Math.max(...Object.values(s).map((w) => w.z || 1));
      return { ...s, [id]: { ...s[id], z: maxZ + 1 } };
    });
  }, []);

  const openWindow = useCallback((id) => {
    bringToFront(id);
    setWinState((s) => ({
      ...s,
      [id]: { ...s[id], size: DEFAULT_WINDOW_SIZE },
    }));
    setOpen((p) => ({ ...p, [id]: true }));
    setMinimized((p) => ({ ...p, [id]: false }));
  }, [bringToFront]);

  const getDragBounds = useCallback(() => {
    const size = iconSizeRef.current;
    const desktop = desktopRef.current;
    const frame = frameRef.current;
    const padding = WINDOW_DRAG_PADDING;
    if (!desktop || !frame) {
      return {
        minX: padding,
        minY: padding,
        maxX: Math.max(padding, 1920 - size.width - padding),
        maxY: Math.max(padding, 1080 - size.height - padding),
      };
    }
    const desktopRect = desktopRectRef.current || desktop.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const scale = scaleRef.current || desktopRect.width / 1920 || 1;
    return {
      minX: (frameRect.left - desktopRect.left) / scale + padding,
      minY: (frameRect.top - desktopRect.top) / scale + padding,
      maxX: (frameRect.right - desktopRect.left) / scale - size.width - padding,
      maxY: (frameRect.bottom - desktopRect.top) / scale - size.height - padding,
    };
  }, []);

  const handleIconMeasure = (el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scale = scaleRef.current || 1;
    const width = rect.width / scale;
    const height = rect.height / scale;
    if (width > 0 && height > 0) {
      iconSizeRef.current = { width, height };
    }
  };

  const clampIconPosition = useCallback((pos) => {
    const bounds = getDragBounds();
    return {
      x: Math.min(bounds.maxX, Math.max(bounds.minX, pos.x)),
      y: Math.min(bounds.maxY, Math.max(bounds.minY, pos.y)),
    };
  }, [getDragBounds]);

  const getDesktopPoint = (e) => {
    const desktop = desktopRef.current;
    if (!desktop) return null;
    const rect = desktopRectRef.current || desktop.getBoundingClientRect();
    const scale = scaleRef.current || rect.width / 1920;
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  const clampWindowPosition = (pos, size) => {
    const desktop = desktopRef.current;
    const frame = frameRef.current;
    const padding = WINDOW_DRAG_PADDING;
    if (!desktop || !frame) {
      return {
        x: Math.max(padding, pos.x),
        y: Math.max(padding + WINDOW_VISIBLE_HEADER_GAP, pos.y),
      };
    }
    const desktopRect = desktopRectRef.current || desktop.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const scale = scaleRef.current || desktopRect.width / 1920 || 1;
    const minX = (frameRect.left - desktopRect.left) / scale + padding;
    const minY = (frameRect.top - desktopRect.top) / scale + padding + WINDOW_VISIBLE_HEADER_GAP;
    const rawMaxX = (frameRect.right - desktopRect.left) / scale - size.width - padding;
    const rawMaxY = (frameRect.bottom - desktopRect.top) / scale - size.height - padding;
    const maxX = Math.max(minX, rawMaxX);
    const maxY = Math.max(minY, rawMaxY);
    return {
      x: Math.min(maxX, Math.max(minX, pos.x)),
      y: Math.min(maxY, Math.max(minY, pos.y)),
    };
  };

  // positions for icons (place in left column inside working area)
  const [positions, setPositions] = useState(() => getDefaultIconPositions(storyState.ui.iconPositions || {}));

  const [open, setOpen] = useState(() => storyState.ui.openApps || {});
  const [minimized, setMinimized] = useState(() => {
    const map = {};
    icons.forEach((it) => {
      map[it.id] = storyState.ui.minimizedApps?.[it.id] || false;
    });
    return map;
  });

  // sizes and positions for windows
  const [winState, setWinState] = useState(() => getDefaultWindowState(storyState.ui.windowState || {}));

  const persistRuntimeState = useCallback((nextState) => {
    saveStoryState(nextState, runtimeSlot);
  }, [runtimeSlot]);

  const runStoryEffects = useCallback((effects) => {
    setStoryState((prev) => {
      const nextState = applyStoryEffects(prev, effects);
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [persistRuntimeState]);

  const triggerMessengerMessageFocusEffects = useCallback((chatId, event) => {
    if (!chatId || !event?.id) return;
    const effectKey = `${chatId}:${event.id}`;

    setStoryState((prev) => {
      const processedFocusEffectIds = prev.messenger?.focusEffectEventIds || [];
      if (processedFocusEffectIds.includes(effectKey)) {
        triggeredMessageFocusEffectsRef.current.add(effectKey);
        return prev;
      }

      triggeredMessageFocusEffectsRef.current.add(effectKey);

      const nextMessengerState = {
        ...prev.messenger,
        focusEffectEventIds: [...processedFocusEffectIds, effectKey],
      };
      const nextStateBase = {
        ...prev,
        messenger: nextMessengerState,
      };
      const nextState = event.onFocusEffects?.length
        ? applyStoryEffects(nextStateBase, event.onFocusEffects)
        : nextStateBase;

      persistRuntimeState(nextState);
      return nextState;
    });
  }, [persistRuntimeState]);

  const isMessengerWindowVisible = useCallback(
    () => !!openRef.current.app3 && !minimizedRef.current.app3,
    [],
  );

  const isMessengerWindowFrontmost = useCallback(() => {
    if (!openRef.current.app3 || minimizedRef.current.app3) return false;
    const messengerZ = winState?.app3?.z || 0;
    const maxZ = Math.max(...Object.values(winState || {}).map((windowItem) => windowItem?.z || 0), 0);
    return messengerZ >= maxZ;
  }, [winState]);

  const clearUnreadChat = useCallback((chatId) => {
    if (!chatId) return;
    setStoryState((prev) => {
      const unreadChatIds = prev.messenger?.unreadChatIds || [];
      if (!unreadChatIds.includes(chatId)) return prev;
      const nextState = {
        ...prev,
        messenger: {
          ...prev.messenger,
          unreadChatIds: unreadChatIds.filter((id) => id !== chatId),
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [persistRuntimeState]);

  const applyConveyorEfficiencyEvent = useCallback((gain = 0, reason = 'open') => {
    const now = Date.now();

    setStoryState((prev) => {
      const currentEfficiency = typeof prev.work?.efficiency === 'number'
        ? prev.work.efficiency
        : CONVEYOR_EFFICIENCY_START;
      const lastInteractionAt = prev.work?.lastInteractionAt || now;
      const idleMs = Math.max(0, now - lastInteractionAt);
      const penalty = Math.floor(idleMs / CONVEYOR_EFFICIENCY_PENALTY_WINDOW_MS);
      const penalizedEfficiency = Math.max(
        CONVEYOR_EFFICIENCY_MIN,
        Math.min(CONVEYOR_EFFICIENCY_MAX, currentEfficiency - penalty),
      );
      const nextEfficiency = Math.max(
        CONVEYOR_EFFICIENCY_MIN,
        Math.min(CONVEYOR_EFFICIENCY_MAX, penalizedEfficiency + gain),
      );

      const nextState = {
        ...prev,
        work: {
          ...prev.work,
          efficiency: nextEfficiency,
          lastInteractionAt: now,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [persistRuntimeState]);

  const findScriptEventById = useCallback((chatId, eventId) => {
    const script = editorContent.messenger?.scripts?.[chatId];
    if (!script || !eventId) return null;
    for (const scene of (script.scenes || [])) {
      const event = (scene.events || []).find((item) => item.id === eventId);
      if (event) return event;
    }
    return null;
  }, [editorContent.messenger]);

  const dismissPersistentNotif = useCallback((notifId) => {
    if (!notifId) return;
    setPersistentNotifs((prev) => prev.filter((notif) => notif.id !== notifId));
    const timerEntry = persistentNotifTimersRef.current.find((entry) => entry.id === notifId);
    if (timerEntry) {
      window.clearTimeout(timerEntry.timerId);
      persistentNotifTimersRef.current = persistentNotifTimersRef.current.filter((entry) => entry.id !== notifId);
    }
  }, []);

  const pushPersistentNotif = useCallback(({ title, text, appId = 'app3', chatId = null, autoDismiss = true }) => {
    const notifId = `notif-${appId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPersistentNotifs((prev) => ([
      ...prev,
      {
        id: notifId,
        title: title || 'Уведомление',
        text: text || '',
        appId,
        chatId,
      },
    ]));
    if (!autoDismiss) return;
    const timerId = window.setTimeout(() => {
      setPersistentNotifs((prev) => prev.filter((notif) => notif.id !== notifId));
      persistentNotifTimersRef.current = persistentNotifTimersRef.current.filter((entry) => entry.id !== notifId);
    }, PERSISTENT_NOTIFICATION_LIFETIME_MS);
    persistentNotifTimersRef.current.push({ id: notifId, timerId });
  }, []);

  const pushConveyorSystemNotification = useCallback((message) => {
    if (!message?.text) return;
    const now = Date.now();

    setStoryState((prev) => {
      const nextMessages = [
        {
          id: `conveyor-msg-${now}-${Math.random().toString(36).slice(2, 6)}`,
          tone: message.tone || 'neutral',
          time: 'Конвейер',
          text: message.text,
        },
        ...(prev.work?.messages || []),
      ].slice(0, CONVEYOR_MESSAGES_LIMIT);
      const nextState = {
        ...prev,
        flags: {
          ...(prev.flags || {}),
          conveyorLastNotificationAt: now,
        },
        work: {
          ...prev.work,
          messages: nextMessages,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });

    pushPersistentNotif({
      title: 'Конвейер',
      text: message.text,
      appId: 'app5',
    });
  }, [persistRuntimeState, pushPersistentNotif]);

  const submitMessengerScriptEvent = useCallback((chatId, eventId, historyEntry = null) => {
    const scriptEvent = findScriptEventById(chatId, eventId);
    const isIncomingMessage = scriptEvent?.type === 'message_other' && historyEntry?.direction === 'incoming';
    const shouldSuppressAttention = isMessengerWindowFrontmost();

    setStoryState((prev) => {
      let nextState = completeMessengerScriptEvent(prev, editorContent, chatId, eventId, {
        historyEntry,
      });
      if (isIncomingMessage && !shouldSuppressAttention) {
        const unreadChatIds = Array.from(new Set([...(nextState.messenger?.unreadChatIds || []), chatId]));
        nextState = {
          ...nextState,
          messenger: {
            ...nextState.messenger,
            unreadChatIds,
          },
        };
      }
      persistRuntimeState(nextState);
      return nextState;
    });

    if (isIncomingMessage && !shouldSuppressAttention) {
      const chatTitle = editorContent.messenger.chats.find((chat) => chat.id === chatId)?.title || 'Мессенджер';
      pushPersistentNotif({
        title: chatTitle,
        text: historyEntry?.text || scriptEvent?.text || 'Новое сообщение',
        appId: 'app3',
        chatId,
        autoDismiss: !(chatId === 'chat-k' && eventId === 'k_001'),
      });
    }
  }, [editorContent, findScriptEventById, isMessengerWindowFrontmost, persistRuntimeState, pushPersistentNotif]);

  const setTerminalPromptState = useCallback((updater) => {
    setStoryState((prev) => {
      const currentPrompt = prev.terminal?.prompt || null;
      const nextPrompt = typeof updater === 'function' ? updater(currentPrompt, prev) : updater;
      if (nextPrompt === currentPrompt) return prev;
      const nextState = {
        ...prev,
        terminal: {
          ...prev.terminal,
          prompt: nextPrompt,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [persistRuntimeState]);

  const appendTerminalLines = useCallback((lines = []) => {
    const safeLines = lines.filter(Boolean);
    if (safeLines.length === 0) return;

    setStoryState((prev) => {
      const nextState = {
        ...prev,
        terminal: {
          ...prev.terminal,
          lines: [
            ...(prev.terminal?.lines || []),
            ...safeLines,
          ],
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [persistRuntimeState]);

  const scheduleAdventureAction = useCallback((delayMs, action) => {
    const timerId = window.setTimeout(() => {
      action();
      terminalPromptTimersRef.current = terminalPromptTimersRef.current.filter((entry) => entry !== timerId);
    }, Math.max(0, delayMs));
    terminalPromptTimersRef.current.push(timerId);
    return timerId;
  }, []);

  const openCalendarWindowForProtocol = useCallback(() => {
    const isCalendarOpen = !!openRef.current?.app6 && !minimizedRef.current?.app6;
    if (isCalendarOpen) {
      bringToFront('app6');
      return;
    }
    openWindow('app6');
  }, [bringToFront, openWindow]);

  const updateAdventureProtocolPrompt = useCallback((updater) => {
    setTerminalPromptState((currentPrompt) => {
      if (!currentPrompt || currentPrompt.id !== TERMINAL_ADVENTURE_PROMPT_ID) {
        return currentPrompt;
      }
      return typeof updater === 'function' ? updater(currentPrompt) : updater;
    });
  }, [setTerminalPromptState]);

  const dismissPersistentNotifLegacy = useCallback((notifId) => {
    if (!notifId) return;
    setPersistentNotifs((prev) => prev.filter((notif) => notif.id !== notifId));
    const timerEntry = persistentNotifTimersRef.current.find((entry) => entry.id === notifId);
    if (timerEntry) {
      window.clearTimeout(timerEntry.timerId);
      persistentNotifTimersRef.current = persistentNotifTimersRef.current.filter((entry) => entry.id !== notifId);
    }
  }, []);

  const pushPersistentNotifLegacy = useCallback(({ title, text, appId = 'app3', chatId = null }) => {
    const notifId = `notif-${appId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPersistentNotifs((prev) => ([
      ...prev,
      {
        id: notifId,
        title: title || 'Уведомление',
        text: text || '',
        appId,
        chatId,
      },
    ]));
    const timerId = window.setTimeout(() => {
      setPersistentNotifs((prev) => prev.filter((notif) => notif.id !== notifId));
      persistentNotifTimersRef.current = persistentNotifTimersRef.current.filter((entry) => entry.id !== notifId);
    }, PERSISTENT_NOTIFICATION_LIFETIME_MS);
    persistentNotifTimersRef.current.push({ id: notifId, timerId });
  }, []);

  const typeMessengerMessageKey = (chatId, eventId, targetText, event) => {
    if (!chatId || !eventId || !event) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.repeat) {
      event.preventDefault();
      return;
    }

    const currentText = typedByChat[chatId] || '';

    if (event.key === 'Backspace') {
      event.preventDefault();
      setTypedByChat((prev) => ({
        ...prev,
        [chatId]: trimMessengerTypedText(currentText, targetText),
      }));
      return;
    }

    if (currentText.length >= targetText.length) {
      event.preventDefault();
      return;
    }

    const remainingText = targetText.slice(currentText.length);
    if (/^[\p{L}\p{N}]?[.!?…]*$/u.test(remainingText)) {
      event.preventDefault();
      setTypedByChat((prev) => ({
        ...prev,
        [chatId]: targetText,
      }));
      return;
    }

    const nextCharIndex = getNextMessengerCharIndex(targetText, currentText);
    const nextChar = targetText[nextCharIndex] || '';
    if (!nextChar) return;

    const isProgressKey = event.key.length === 1 || event.key === 'Enter' || event.key === 'Tab';
    if (!isProgressKey || event.key === ' ') return;

    event.preventDefault();
    setTypedByChat((prev) => ({
      ...prev,
      [chatId]: appendNextMessengerChar(prev[chatId] || '', targetText),
    }));
  };

  const typeMessengerChoiceKey = (chatId, choiceEventId, choice, event) => {
    if (!chatId || !choiceEventId || !choice || !event) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.repeat) {
      event.preventDefault();
      return;
    }

    const currentText = typedByChat[chatId] || '';
    const resolveTargetText = (option) => option.resultText || option.label || '';
    const choiceState = storyState.messenger?.choiceStateByEventId?.[choiceEventId] || {
      disabledOptionIds: [],
      selectedOptionId: '',
    };
    const availableOptions = (choice.options || []).filter((option) => (
      !(choiceState.disabledOptionIds || []).includes(option.id)
    ));
    const selectedOption = availableOptions.find((option) => option.id === choiceState.selectedOptionId) || null;

    if (event.key === 'Backspace') {
      event.preventDefault();
      const targetText = selectedOption ? resolveTargetText(selectedOption) : '';
      const nextText = trimMessengerTypedText(currentText, targetText);
      setTypedByChat((prev) => ({
        ...prev,
        [chatId]: nextText,
      }));
      if (!nextText.length && selectedOption) {
        updateMessengerChoiceState(choiceEventId, (prev) => ({
          ...prev,
          selectedOptionId: '',
        }));
      }
      return;
    }

    const normalizedKey = (event.key || '').toLowerCase();
    const isProgressKey = event.key.length === 1 || event.key === 'Enter' || event.key === 'Tab';
    if (!isProgressKey || event.key === ' ') {
      event.preventDefault();
      return;
    }

    const nextOption = selectedOption || availableOptions.find((option) => {
      const optionText = resolveTargetText(option);
      const expectedChar = optionText[getNextMessengerCharIndex(optionText, currentText)] || '';
      return expectedChar.toLowerCase() === normalizedKey;
    }) || null;

    if (!nextOption) {
      event.preventDefault();
      return;
    }

    if (!selectedOption || selectedOption.id !== nextOption.id) {
      updateMessengerChoiceState(choiceEventId, (prev) => ({
        ...prev,
        selectedOptionId: nextOption.id,
      }));
    }

    const targetText = resolveTargetText(nextOption);
    const nextChar = targetText[getNextMessengerCharIndex(targetText, currentText)] || '';
    if (!nextChar) {
      event.preventDefault();
      return;
    }

    if (nextChar.toLowerCase() !== normalizedKey) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setTypedByChat((prev) => ({
      ...prev,
      [chatId]: appendNextMessengerChar(prev[chatId] || '', targetText),
    }));
  };

  const submitMessengerMessage = (chatId, eventId, targetText, pendingPlayerEvent = null) => {
    if (!chatId || !eventId) return;
    const currentText = typedByChat[chatId] || '';
    if (currentText.length < targetText.length) return;
    const terminalPrompt = storyState.terminal?.prompt;

    if (
      chatId === TERMINAL_ADVENTURE_CHAT_ID
      && eventId === TERMINAL_ADVENTURE_PLAYER_EVENT_ID
      && terminalPrompt?.id === TERMINAL_ADVENTURE_PROMPT_ID
      && terminalPrompt.stage === 'accept-ready'
    ) {
      setTypedByChat((prev) => ({
        ...prev,
        [chatId]: '',
      }));
      setTerminalPromptState(null);
      submitMessengerScriptEvent(chatId, eventId, {
        id: `${eventId}-reply`,
        direction: 'outgoing',
        text: TERMINAL_ADVENTURE_AUTO_REPLY_TEXT,
      });
      return;
    }

    const sendBehavior = pendingPlayerEvent?.schema?.sendBehavior || '';
    if (sendBehavior === 'blocked_and_wiped') {
      setTypedByChat((prev) => ({
        ...prev,
        [chatId]: '',
      }));
      submitMessengerScriptEvent(chatId, eventId, null);
      return;
    }

    setTypedByChat((prev) => ({
      ...prev,
      [chatId]: '',
    }));
    submitMessengerScriptEvent(chatId, eventId, {
      id: `${eventId}-reply`,
      direction: 'outgoing',
      text: targetText,
    });
  };

  const updateMessengerChoiceState = (eventId, updater) => {
    if (!eventId) return;
    setStoryState((prev) => {
      const current = prev.messenger?.choiceStateByEventId?.[eventId] || {
        disabledOptionIds: [],
        selectedOptionId: '',
      };
      const nextChoiceState = typeof updater === 'function' ? updater(current) : updater;
      const nextState = {
        ...prev,
        messenger: {
          ...prev.messenger,
          choiceStateByEventId: {
            ...(prev.messenger?.choiceStateByEventId || {}),
            [eventId]: nextChoiceState,
          },
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  };

  const clearTerminalPromptTimers = useCallback(() => {
    terminalPromptTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    terminalPromptTimersRef.current = [];
  }, []);

  const submitMessengerChoice = ({ chatId, choiceEventId, choice, pendingPlayerEvent }) => {
    if (!chatId || !choiceEventId || !choice) return;

    const currentChoiceState = storyState.messenger?.choiceStateByEventId?.[choiceEventId] || {
      disabledOptionIds: [],
      selectedOptionId: '',
    };
    const option = (choice.options || []).find((item) => item.id === currentChoiceState.selectedOptionId) || null;
    if (!option || (currentChoiceState.disabledOptionIds || []).includes(option.id)) return;
    const targetText = option.resultText || option.label || '';
    const currentText = typedByChat[chatId] || '';
    if (!targetText || currentText.length < targetText.length) return;

    if (option.id === 'yes' && pendingPlayerEvent) {
      setTypedByChat((prev) => ({
        ...prev,
        [chatId]: '',
      }));
      updateMessengerChoiceState(choiceEventId, (prev) => ({
        ...prev,
        selectedOptionId: option.id,
      }));
      submitMessengerScriptEvent(chatId, pendingPlayerEvent.id, {
        id: `${pendingPlayerEvent.id}-reply`,
        direction: 'outgoing',
        text: targetText,
      });
      return;
    }

    const rejectedEffects = (option.rejectedEffects || [])
      .filter(Boolean)
      .map((text, index) => ({
        type: 'pushTerminalLine',
        id: `${choiceEventId}-${option.id}-${index}`,
        text,
      }));

    if (rejectedEffects.length > 0) {
      runStoryEffects(rejectedEffects);
    }

    setTypedByChat((prev) => ({
      ...prev,
      [chatId]: '',
    }));
    updateMessengerChoiceState(choiceEventId, (prev) => ({
      ...prev,
      selectedOptionId: '',
      disabledOptionIds: [...new Set([...(prev.disabledOptionIds || []), option.id])],
    }));
  };

  const resetAdventureTerminalPrompt = useCallback(() => {
    updateAdventureProtocolPrompt((prompt) => {
      if (!prompt) return prompt;
      if (
        prompt.stage === 'choice'
        && prompt.allowMessengerInput === false
        && prompt.declineSubmitAttempted === false
        && prompt.noSequenceStarted === false
      ) {
        return prompt;
      }
      return {
        ...prompt,
        stage: 'choice',
        allowMessengerInput: false,
        declineSubmitAttempted: false,
        noSequenceStarted: false,
      };
    });
  }, [updateAdventureProtocolPrompt]);

  const startAdventureAcceptanceDraftFlow = useCallback(() => {
    const isMessengerOpen = !!openRef.current?.app3 && !minimizedRef.current?.app3;
    if (isMessengerOpen) {
      bringToFront('app3');
    } else {
      openWindow('app3');
    }
    setActiveChatId(TERMINAL_ADVENTURE_CHAT_ID);
    setTypedByChat((prev) => ({
      ...prev,
      [TERMINAL_ADVENTURE_CHAT_ID]: '',
    }));
    setAdventureDeclineInputState(null);
    updateAdventureProtocolPrompt((currentPrompt) => ({
      ...currentPrompt,
      stage: 'accept-ready',
      allowMessengerInput: true,
    }));
    messengerInputStickyFocusRef.current = true;
    messengerInputRestorePendingRef.current = false;
    window.setTimeout(() => {
      messengerInputFieldRef.current?.focus();
    }, 0);
  }, [bringToFront, openWindow, updateAdventureProtocolPrompt]);

  const startAdventureAcceptanceFlow = useCallback(() => {
    const isMessengerOpen = !!openRef.current?.app3 && !minimizedRef.current?.app3;
    if (isMessengerOpen) {
      bringToFront('app3');
    } else {
      openWindow('app3');
    }
    setActiveChatId(TERMINAL_ADVENTURE_CHAT_ID);
    setTerminalPromptState(null);
    updateMessengerChoiceState(TERMINAL_ADVENTURE_CHOICE_EVENT_ID, (prev) => ({
      ...prev,
      selectedOptionId: 'yes',
    }));

    let typedLength = 0;
    const typeTimerId = window.setInterval(() => {
      typedLength += 1;
      const nextText = TERMINAL_ADVENTURE_AUTO_REPLY_TEXT.slice(0, typedLength);
      setTypedByChat((prev) => ({
        ...prev,
        [TERMINAL_ADVENTURE_CHAT_ID]: nextText,
      }));

      if (typedLength < TERMINAL_ADVENTURE_AUTO_REPLY_TEXT.length) {
        return;
      }

      window.clearInterval(typeTimerId);
      terminalPromptTimersRef.current = terminalPromptTimersRef.current.filter((timerId) => timerId !== typeTimerId);

      scheduleAdventureAction(TERMINAL_ADVENTURE_AUTO_REPLY_DELAY_MS, () => {
        setTypedByChat((prev) => ({
          ...prev,
          [TERMINAL_ADVENTURE_CHAT_ID]: '',
        }));
        submitMessengerScriptEvent(TERMINAL_ADVENTURE_CHAT_ID, TERMINAL_ADVENTURE_PLAYER_EVENT_ID, {
          id: `${TERMINAL_ADVENTURE_PLAYER_EVENT_ID}-reply`,
          direction: 'outgoing',
          text: TERMINAL_ADVENTURE_AUTO_REPLY_TEXT,
        });
      });
    }, TERMINAL_ADVENTURE_AUTO_REPLY_TYPE_INTERVAL_MS);

    terminalPromptTimersRef.current.push(typeTimerId);
  }, [
    bringToFront,
    openWindow,
    scheduleAdventureAction,
    setTerminalPromptState,
    submitMessengerScriptEvent,
    updateMessengerChoiceState,
  ]);

  const runAdventureDeclinePostSequence = useCallback((yesCount = 0) => {
    const shownKeys = new Set(getAdventureShownDiagnosticKeys(yesCount));
    const scheduleLine = (delayMs, text, key = '') => {
      if (key && shownKeys.has(key)) return;
      scheduleAdventureAction(delayMs, () => {
        appendTerminalLines([createTerminalProtocolLine(text)]);
      });
    };

    const shouldOpenCalendar = !shownKeys.has('calendar');
    scheduleLine(0, '>> почему не отправляешь?');
    scheduleLine(2000, '>>...Соотношение актуальных и желаемых успехов: 0:17475...', 'ratio');
    scheduleLine(6000, '>> думаешь, так просто написать книгу?', 'book');
    scheduleLine(10000, 'дела сами себя не переделают!');

    let timelineMs = 13000;
    if (shouldOpenCalendar) {
      scheduleAdventureAction(timelineMs, openCalendarWindowForProtocol);
      scheduleLine(timelineMs + 1000, '>>  это что, похоже на «есть время»?', 'calendar');
      timelineMs += 1000;
    }

    scheduleAdventureAction(timelineMs, () => {
      appendTerminalLines([
        createTerminalProtocolLine(TERMINAL_PROTOCOL_ELLIPSIS_TEXT, {
          typeSpeedMs: TERMINAL_PROTOCOL_ELLIPSIS_4_SPEED_MS,
        }),
      ]);
    });
    timelineMs += 4000;
    scheduleLine(timelineMs, '>> ты две недели не покупаешь билеты к маме, потому, что не можешь разобрать завалы', 'mom');
    timelineMs += shownKeys.has('mom') ? 0 : (22 * '>> ты две недели не покупаешь билеты к маме, потому, что не можешь разобрать завалы'.length);
    scheduleAdventureAction(timelineMs, () => {
      appendTerminalLines([
        createTerminalProtocolLine(TERMINAL_PROTOCOL_ELLIPSIS_TEXT, {
          typeSpeedMs: TERMINAL_PROTOCOL_ELLIPSIS_6_SPEED_MS,
        }),
      ]);
    });
    timelineMs += 6000;
    scheduleLine(timelineMs, '>> ???');
    timelineMs += (22 * '>> ???'.length);
    scheduleLine(timelineMs, '>> окей. неважно. одним днем меньше – у тебя же их бесконечность');
    timelineMs += (22 * '>> окей. неважно. одним днем меньше – у тебя же их бесконечность'.length);
    scheduleAdventureAction(timelineMs + 600, startAdventureAcceptanceDraftFlow);
  }, [appendTerminalLines, openCalendarWindowForProtocol, scheduleAdventureAction, startAdventureAcceptanceDraftFlow]);

  const handleAdventureDeclineSubmitAttempt = useCallback((chatId) => {
    const prompt = storyState.terminal?.prompt;
    if (!chatId || !prompt || prompt.id !== TERMINAL_ADVENTURE_PROMPT_ID || prompt.stage !== 'decline-typing') {
      return;
    }

    setStoryState((prev) => {
      const currentPrompt = prev.terminal?.prompt;
      if (!currentPrompt || currentPrompt.id !== TERMINAL_ADVENTURE_PROMPT_ID || currentPrompt.stage !== 'decline-typing') {
        return prev;
      }

      const currentText = typedByChat[chatId] || '';
      const nextState = {
        ...prev,
        messenger: {
          ...prev.messenger,
          historyByChat: {
            ...(prev.messenger?.historyByChat || {}),
            [chatId]: [
              ...(prev.messenger?.historyByChat?.[chatId] || []),
              {
                id: `${TERMINAL_ADVENTURE_PLAYER_EVENT_ID}-decline-draft`,
                direction: 'outgoing',
                text: currentText,
              },
            ],
          },
        },
        terminal: {
          ...prev.terminal,
          prompt: {
            ...currentPrompt,
            stage: 'processing',
            allowMessengerInput: false,
            declineSubmitAttempted: true,
            noSequenceStarted: true,
          },
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });

    setTypedByChat((prev) => ({
      ...prev,
      [chatId]: '',
    }));
    runAdventureDeclinePostSequence(prompt.yesCount || 0);
  }, [persistRuntimeState, runAdventureDeclinePostSequence, setStoryState, storyState.terminal?.prompt, typedByChat]);

  const handleAdventureDeclineEraseKey = useCallback((chatId) => {
    const prompt = storyState.terminal?.prompt;
    if (
      !chatId
      || !prompt
      || prompt.id !== TERMINAL_ADVENTURE_PROMPT_ID
      || !['decline-typing', 'decline-erasing'].includes(prompt.stage)
    ) {
      return;
    }

    const currentText = typedByChat[chatId] || '';
    const nextText = currentText.slice(0, -1);
    setTypedByChat((prev) => ({
      ...prev,
      [chatId]: nextText,
    }));

    if (prompt.stage !== 'decline-erasing') {
      updateAdventureProtocolPrompt((currentPrompt) => ({
        ...currentPrompt,
        stage: 'decline-erasing',
        allowMessengerInput: true,
        declineSubmitAttempted: true,
        noSequenceStarted: false,
      }));
    }

    if (nextText.length > 0 || prompt.noSequenceStarted) {
      return;
    }

    updateAdventureProtocolPrompt((currentPrompt) => ({
      ...currentPrompt,
      stage: 'processing',
      allowMessengerInput: false,
      noSequenceStarted: true,
    }));
    runAdventureDeclinePostSequence(prompt.yesCount || 0);
  }, [runAdventureDeclinePostSequence, storyState.terminal?.prompt, typedByChat, updateAdventureProtocolPrompt]);

  const rejectAdventureTerminalPrompt = useCallback(() => {
    const prompt = storyState.terminal?.prompt;
    if (!prompt || prompt.id !== TERMINAL_ADVENTURE_PROMPT_ID || prompt.stage !== 'choice') {
      return;
    }

    clearTerminalPromptTimers();
    runStoryEffects([{ type: 'flashScreen', durationMs: 1000 }]);
    appendTerminalLines([
      createTerminalProtocolLine('это вполне разумное решение!'),
    ]);
    updateAdventureProtocolPrompt((currentPrompt) => ({
      ...currentPrompt,
      stage: 'decline-typing',
      allowMessengerInput: true,
      declineSubmitAttempted: false,
      noSequenceStarted: false,
    }));

    const isMessengerOpen = !!openRef.current?.app3 && !minimizedRef.current?.app3;
    if (isMessengerOpen) {
      bringToFront('app3');
    } else {
      openWindow('app3');
    }
    setActiveChatId(TERMINAL_ADVENTURE_CHAT_ID);
    setTypedByChat((prev) => ({
      ...prev,
      [TERMINAL_ADVENTURE_CHAT_ID]: '',
    }));
    setAdventureDeclineInputState({
      mode: 'typing',
      extraTapsRemaining: TERMINAL_ADVENTURE_DECLINE_EXTRA_TAPS,
    });
    return;

    setStoryState((prev) => {
      const prompt = prev.terminal?.prompt;
      if (!prompt || prompt.id !== TERMINAL_ADVENTURE_PROMPT_ID || prompt.noDisabled) {
        return prev;
      }

      const rejectedEffects = [
        'ЗАПРОС НА ОТКАЗ ПРИНЯТ. ЗАПУСК ДИАГНОСТИКИ...',
        'АНАЛИЗ ПОВЕДЕНЧЕСКИХ МЕТРИК:',
        '...Соотношение чужих и личных успехов: 17475...',
        '...Попыток физического контакта с реальным миром: 2 (неудачно).',
        'ЗАПРОС НА ОТКАЗ ОТКЛОНЕН СИСТЕМОЙ. Попробуйте еще раз.',
      ];

      const nextState = {
        ...prev,
        messenger: {
          ...prev.messenger,
          choiceStateByEventId: {
            ...(prev.messenger?.choiceStateByEventId || {}),
            [TERMINAL_ADVENTURE_CHOICE_EVENT_ID]: {
              disabledOptionIds: ['no'],
              selectedOptionId: '',
            },
          },
        },
        terminal: {
          ...prev.terminal,
          lines: [
            ...(prev.terminal?.lines || []),
            ...rejectedEffects.map((text, index) => ({
              id: `${TERMINAL_ADVENTURE_PROMPT_ID}-reject-${index}`,
              text,
              status: 'pending',
            })),
          ],
          prompt: {
            ...prompt,
            noDisabled: true,
            stage: 'rejected',
          },
        },
      };

      persistRuntimeState(nextState);
      return nextState;
    });
  }, [
    appendTerminalLines,
    bringToFront,
    clearTerminalPromptTimers,
    openWindow,
    persistRuntimeState,
    runStoryEffects,
    setActiveChatId,
    storyState.terminal?.prompt,
    updateAdventureProtocolPrompt,
  ]);

  const acceptAdventureTerminalPrompt = useCallback(() => {
    clearTerminalPromptTimers();

    const prompt = storyState.terminal?.prompt;
    if (!prompt || prompt.id !== TERMINAL_ADVENTURE_PROMPT_ID || prompt.stage !== 'choice') {
      return;
    }

    const nextYesCount = (prompt.yesCount || 0) + 1;
    updateAdventureProtocolPrompt((currentPrompt) => ({
      ...currentPrompt,
      stage: 'processing',
      yesCount: nextYesCount,
    }));

    const appendProtocolLines = (delayMs, lines) => {
      scheduleAdventureAction(delayMs, () => {
        appendTerminalLines(lines);
      });
    };

    if (nextYesCount === 1) {
      const ellipsisLine = createTerminalProtocolLine(TERMINAL_PROTOCOL_ELLIPSIS_TEXT, {
        typeSpeedMs: TERMINAL_PROTOCOL_ELLIPSIS_4_SPEED_MS,
      });
      const diagnosticLines = [
        createTerminalProtocolLine('ЗАПРОС ПРИНЯТ. ЗАПУСК ДИАГНОСТИКИ...'),
        createTerminalProtocolLine('>> активация протокола «TODO»:'),
        createTerminalProtocolLine('>> АНАЛИЗ ТЕКУЩЕГО ПОЛОЖЕНИЯ…'),
        createTerminalProtocolLine('TODO>>...Соотношение актуальных и желаемых успехов: 0:17475...'),
        createTerminalProtocolLine('TODO>> думаешь, так просто написать книгу?'),
        createTerminalProtocolLine('РЕКОМЕНДАЦИЯ СИСТЕМЫ: Отклонить запрос'),
      ];
      appendTerminalLines([ellipsisLine]);
      appendProtocolLines(getTerminalLineDurationMs(ellipsisLine), diagnosticLines);
      const totalDurationMs = getTerminalLineDurationMs(ellipsisLine)
        + diagnosticLines.reduce((sum, line) => sum + getTerminalLineDurationMs(line), 0);
      scheduleAdventureAction(totalDurationMs + TERMINAL_PROTOCOL_RETRY_DELAY_MS, resetAdventureTerminalPrompt);
      return;
    }

    if (nextYesCount === 2) {
      const ellipsisLine = createTerminalProtocolLine(TERMINAL_PROTOCOL_ELLIPSIS_TEXT, {
        typeSpeedMs: TERMINAL_PROTOCOL_ELLIPSIS_4_SPEED_MS,
      });
      const calendarLines = [
        createTerminalProtocolLine('TODO>>  это что, похоже на «есть время»?'),
        createTerminalProtocolLine('РЕКОМЕНДАЦИЯ СИСТЕМЫ: Отклонить запрос'),
      ];
      appendTerminalLines([ellipsisLine]);
      scheduleAdventureAction(getTerminalLineDurationMs(ellipsisLine), openCalendarWindowForProtocol);
      appendProtocolLines(getTerminalLineDurationMs(ellipsisLine) + 1000, calendarLines);
      const totalDurationMs = getTerminalLineDurationMs(ellipsisLine)
        + 1000
        + calendarLines.reduce((sum, line) => sum + getTerminalLineDurationMs(line), 0);
      scheduleAdventureAction(totalDurationMs + TERMINAL_PROTOCOL_RETRY_DELAY_MS, resetAdventureTerminalPrompt);
      return;
    }

    if (nextYesCount === 3) {
      const ellipsisLine = createTerminalProtocolLine(TERMINAL_PROTOCOL_ELLIPSIS_TEXT, {
        typeSpeedMs: TERMINAL_PROTOCOL_ELLIPSIS_4_SPEED_MS,
      });
      const momLines = [
        createTerminalProtocolLine('TODO>> ты две недели не покупаешь билеты к маме, потому, что не можешь разобрать завалы'),
        createTerminalProtocolLine('РЕКОМЕНДАЦИЯ СИСТЕМЫ: ОТКЛОНИТЬ ЗАПРОС'),
      ];
      appendTerminalLines([ellipsisLine]);
      appendProtocolLines(getTerminalLineDurationMs(ellipsisLine), momLines);
      const totalDurationMs = getTerminalLineDurationMs(ellipsisLine)
        + momLines.reduce((sum, line) => sum + getTerminalLineDurationMs(line), 0);
      scheduleAdventureAction(totalDurationMs + TERMINAL_PROTOCOL_RETRY_DELAY_MS, resetAdventureTerminalPrompt);
      return;
    }

    const ellipsisLine = createTerminalProtocolLine(TERMINAL_PROTOCOL_ELLIPSIS_TEXT, {
      typeSpeedMs: TERMINAL_PROTOCOL_ELLIPSIS_6_SPEED_MS,
    });
    const finishLines = [
      createTerminalProtocolLine('>> ???'),
      createTerminalProtocolLine('>> окей. неважно. одним днем меньше – у тебя же их бесконечность'),
    ];
    appendTerminalLines([ellipsisLine]);
    appendProtocolLines(getTerminalLineDurationMs(ellipsisLine), finishLines);
    const totalDurationMs = getTerminalLineDurationMs(ellipsisLine)
      + finishLines.reduce((sum, line) => sum + getTerminalLineDurationMs(line), 0);
    scheduleAdventureAction(totalDurationMs + 600, startAdventureAcceptanceDraftFlow);
    return;

    setStoryState((prev) => {
      const prompt = prev.terminal?.prompt;
      if (!prompt || prompt.id !== TERMINAL_ADVENTURE_PROMPT_ID || prompt.stage === 'accept-pending') {
        return prev;
      }
      const nextState = {
        ...prev,
        terminal: {
          ...prev.terminal,
          prompt: {
            ...prompt,
            stage: 'accept-pending',
          },
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });

    const openMessengerTimerId = window.setTimeout(() => {
      setTerminalPromptState(null);
      const isMessengerOpen = !!openRef.current?.app3 && !minimizedRef.current?.app3;
      if (isMessengerOpen) {
        bringToFront('app3');
      } else {
        openWindow('app3');
      }
      setActiveChatId(TERMINAL_ADVENTURE_CHAT_ID);
      updateMessengerChoiceState(TERMINAL_ADVENTURE_CHOICE_EVENT_ID, (prev) => ({
        ...prev,
        selectedOptionId: 'yes',
      }));

      let typedLength = 0;
      const typeTimerId = window.setInterval(() => {
        typedLength += 1;
        const nextText = TERMINAL_ADVENTURE_ACCEPT_TEXT.slice(0, typedLength);
        setTypedByChat((prev) => ({
          ...prev,
          [TERMINAL_ADVENTURE_CHAT_ID]: nextText,
        }));

        if (typedLength < TERMINAL_ADVENTURE_ACCEPT_TEXT.length) {
          return;
        }

        window.clearInterval(typeTimerId);
        terminalPromptTimersRef.current = terminalPromptTimersRef.current.filter((timerId) => timerId !== typeTimerId);

        setTypedByChat((prev) => ({
          ...prev,
          [TERMINAL_ADVENTURE_CHAT_ID]: '',
        }));
        submitMessengerScriptEvent(TERMINAL_ADVENTURE_CHAT_ID, TERMINAL_ADVENTURE_PLAYER_EVENT_ID, {
          id: `${TERMINAL_ADVENTURE_PLAYER_EVENT_ID}-reply`,
          direction: 'outgoing',
          text: TERMINAL_ADVENTURE_ACCEPT_TEXT,
        });
      }, TERMINAL_ADVENTURE_TYPE_INTERVAL_MS);

      terminalPromptTimersRef.current.push(typeTimerId);
    }, TERMINAL_ADVENTURE_ACCEPT_DELAY_MS);

    terminalPromptTimersRef.current.push(openMessengerTimerId);
  }, [
    appendTerminalLines,
    clearTerminalPromptTimers,
    openCalendarWindowForProtocol,
    resetAdventureTerminalPrompt,
    scheduleAdventureAction,
    startAdventureAcceptanceDraftFlow,
    storyState.terminal?.prompt,
    updateAdventureProtocolPrompt,
  ]);

  const markSequenceConsumed = useCallback((sequenceId) => {
    setStoryState((prev) => {
      const nextState = consumeQueuedSequence(prev, sequenceId);
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [persistRuntimeState]);

  const completeTerminalLine = useCallback((lineId) => {
    if (!lineId) return;
    setStoryState((prev) => {
      const nextState = {
        ...prev,
        terminal: {
          ...prev.terminal,
          lines: (prev.terminal?.lines || []).map((line) => (
            line.id === lineId ? { ...line, status: 'done' } : line
          )),
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [persistRuntimeState]);

  const selectWorkTask = (taskId) => {
    setActiveWorkTaskId(taskId);
    setStoryState((prev) => {
      const nextState = {
        ...prev,
        work: {
          ...prev.work,
          activeTaskId: taskId,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  };

  const typeWorkTaskKey = (taskId, event) => {
    if (!taskId || !event) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.repeat) {
      event.preventDefault();
      return;
    }

    const allTasks = getUniqueWorkTasks(
      editorContent.appData?.workConveyor?.seedTasks || [],
      storyState.work?.tasks || [],
    );
    const activeTask = allTasks.find((task) => task.id === taskId);
    if (!activeTask) return;

    const targetText = activeTask.targetText || '';
    const currentText = storyState.work?.typedTextByTask?.[taskId] || '';

    if (event.key === 'Backspace') {
      event.preventDefault();
      const now = Date.now();
      setStoryState((prev) => {
        const nextState = {
          ...prev,
          work: {
            ...prev.work,
            lastTaskActivityAt: now,
            typedTextByTask: {
              ...(prev.work?.typedTextByTask || {}),
              [taskId]: currentText.slice(0, -1),
            },
          },
        };
        persistRuntimeState(nextState);
        return nextState;
      });
      return;
    }

    if (currentText.length >= targetText.length) {
      event.preventDefault();
      return;
    }

    const isProgressKey = event.key.length === 1 || event.key === 'Enter' || event.key === 'Tab';
    if (!isProgressKey) return;

    event.preventDefault();
    const nextChar = targetText[currentText.length] || '';
    const now = Date.now();

    setStoryState((prev) => {
      const previousTyped = prev.work?.typedTextByTask?.[taskId] || '';
      const nextState = {
        ...prev,
        work: {
          ...prev.work,
          activeTaskId: taskId,
          lastTaskActivityAt: now,
          typedTextByTask: {
            ...(prev.work?.typedTextByTask || {}),
            [taskId]: `${previousTyped}${nextChar}`,
          },
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  };

  const submitWorkTask = (taskId) => {
    if (!taskId) return;

    const seedTasks = editorContent.appData?.workConveyor?.seedTasks || [];
    const queuedTasks = editorContent.appData?.workConveyor?.queuedTasks || [];
    const allTasks = getUniqueWorkTasks(
      seedTasks,
      storyState.work?.tasks || [],
    );
    const activeTask = allTasks.find((task) => task.id === taskId);
    if (!activeTask) return;

    const targetText = activeTask.targetText || '';
    const currentText = storyState.work?.typedTextByTask?.[taskId] || '';
    const isComplete = currentText.length >= targetText.length;
    if (!isComplete) return;
    const rewardCredits = Number(activeTask.rewardCredits) || 0;
    const efficiencyBonus = Number(activeTask.efficiencyBonus) || 0;
    const creditedAmount = getCreditsFromCompletionMessage(activeTask.completionMessage || '') ?? rewardCredits;
    const completionMessage = activeTask.completionMessage || '✔ текст принят';
    const terminalMessagesOnSubmit = Array.isArray(activeTask.terminalMessagesOnSubmit)
      ? activeTask.terminalMessagesOnSubmit
      : (activeTask.terminalMessageOnSubmit
        ? [{ text: activeTask.terminalMessageOnSubmit, delayMs: 0 }]
        : (activeTask.id === 'act1-task-dogs'
          ? [{ text: '> > C:\\Users\\G> Великолепно. Мой magnum opus.', delayMs: 0 }]
          : []));
    const immediateTerminalMessages = terminalMessagesOnSubmit.filter((entry) => Number(entry?.delayMs || 0) <= 0);
    const delayedTerminalMessages = terminalMessagesOnSubmit.filter((entry) => Number(entry?.delayMs || 0) > 0);
    const nextQueuedTask = queuedTasks.find((task) => {
      const fingerprint = getWorkTaskFingerprint(task);
      return !allTasks.some((existingTask) => (
        existingTask.id === task.id || getWorkTaskFingerprint(existingTask) === fingerprint
      ));
    }) || null;

    setStoryState((prev) => {
      const submittedTaskIds = prev.work?.submittedTaskIds || [];
      if (submittedTaskIds.includes(taskId)) return prev;

      const nextRuntimeTasks = nextQueuedTask
        ? [...(prev.work?.tasks || []), nextQueuedTask]
        : (prev.work?.tasks || []);
      const nextMessages = [
        {
          id: `conveyor-msg-${Date.now()}-completion`,
          tone: 'success',
          time: 'Конвейер',
          text: completionMessage,
        },
        ...(prev.work?.messages || []),
      ].slice(0, CONVEYOR_MESSAGES_LIMIT);
      const currentEfficiency = typeof prev.work?.efficiency === 'number'
        ? prev.work.efficiency
        : CONVEYOR_EFFICIENCY_START;
      const nextTerminalLines = [
        ...(prev.terminal?.lines || []),
        ...immediateTerminalMessages.map((entry, index) => ({
          id: `terminal-conveyor-${taskId}-${index}`,
          text: entry.text || '',
          status: 'pending',
        })),
      ];
      const nextState = {
        ...prev,
        flags: {
          ...(prev.flags || {}),
          conveyorLastNotificationAt: Date.now(),
        },
        terminal: {
          ...prev.terminal,
          lines: nextTerminalLines,
        },
        work: {
          ...prev.work,
          submittedTaskIds: [...submittedTaskIds, taskId],
          tasks: nextRuntimeTasks,
          activeTaskId: nextQueuedTask?.id || prev.work?.activeTaskId || taskId,
          lastTaskActivityAt: Date.now(),
          balance: (typeof prev.work?.balance === 'number' ? prev.work.balance : 2514) + creditedAmount,
          efficiency: Math.max(
            CONVEYOR_EFFICIENCY_MIN,
            Math.min(CONVEYOR_EFFICIENCY_MAX, currentEfficiency + efficiencyBonus),
          ),
          messages: nextMessages,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });

    conveyorNotifTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    conveyorNotifTimersRef.current = [];
    conveyorTerminalTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    conveyorTerminalTimersRef.current = [];

    pushPersistentNotif({
      title: 'Конвейер',
      text: completionMessage,
      appId: 'app5',
    });

    if (nextQueuedTask) {
      const nextTaskNotifTimerId = window.setTimeout(() => {
        setStoryState((prev) => {
          const nextState = {
            ...prev,
            flags: {
              ...(prev.flags || {}),
              conveyorLastNotificationAt: Date.now(),
            },
            work: {
              ...prev.work,
              messages: [
                {
                  id: `conveyor-msg-${Date.now()}-next-task`,
                  tone: 'neutral',
                  time: 'Конвейер',
                  text: nextQueuedTask.title || 'Новая задача',
                },
                ...(prev.work?.messages || []),
              ].slice(0, CONVEYOR_MESSAGES_LIMIT),
            },
          };
          persistRuntimeState(nextState);
          return nextState;
        });
        pushPersistentNotif({
          title: 'Конвейер',
          text: nextQueuedTask.title || 'Новая задача',
          appId: 'app5',
        });
        conveyorNotifTimersRef.current = conveyorNotifTimersRef.current.filter((timerId) => timerId !== nextTaskNotifTimerId);
      }, 5000);

      conveyorNotifTimersRef.current.push(nextTaskNotifTimerId);
    }

    delayedTerminalMessages.forEach((entry, index) => {
      const delayMs = Number(entry?.delayMs || 0);
      if (!delayMs || !entry?.text) return;
      const terminalTimerId = window.setTimeout(() => {
        setStoryState((prev) => {
          const nextLineId = `terminal-conveyor-${taskId}-${immediateTerminalMessages.length + index}`;
          const existingLines = prev.terminal?.lines || [];
          if (existingLines.some((line) => line.id === nextLineId)) {
            return prev;
          }
          const nextState = {
            ...prev,
            terminal: {
              ...prev.terminal,
              lines: [
                ...existingLines,
                {
                  id: nextLineId,
                  text: entry.text,
                  status: 'pending',
                },
              ],
            },
          };
          persistRuntimeState(nextState);
          return nextState;
        });
        conveyorTerminalTimersRef.current = conveyorTerminalTimersRef.current.filter((timerId) => timerId !== terminalTimerId);
      }, delayMs);
      conveyorTerminalTimersRef.current.push(terminalTimerId);
    });
  };

  const submitWorkTaskWithFeedback = (taskId) => {
    if (!taskId) return;
    if (workSubmitFeedback?.taskId === taskId) return;

    setWorkSubmitFeedback({ taskId, stage: 'sending' });

    const checkingTimerId = window.setTimeout(() => {
      setWorkSubmitFeedback((prev) => (
        prev?.taskId === taskId ? { taskId, stage: 'checking' } : prev
      ));
    }, 900);

    const completeTimerId = window.setTimeout(() => {
      applyConveyorEfficiencyEvent(CONVEYOR_EFFICIENCY_GAIN_SUBMIT, 'submit');
      submitWorkTask(taskId);
      setWorkSubmitFeedback((prev) => (prev?.taskId === taskId ? null : prev));
      workSubmitTimersRef.current = workSubmitTimersRef.current.filter((timerId) => (
        timerId !== checkingTimerId && timerId !== completeTimerId
      ));
    }, 1900);

    workSubmitTimersRef.current.push(checkingTimerId, completeTimerId);
  };

  useEffect(() => {
    if (validationIssues.length > 0) {
      // Surface invalid scenario wiring early while the editor is still being built.
      console.warn('Story content validation issues:', validationIssues);
    }
  }, [validationIssues]);

  useEffect(() => {
    const screenFlashUntil = Number(storyState.ui?.screenFlashUntil || 0);
    if (!screenFlashUntil || screenFlashUntil <= Date.now()) {
      setScreenFlashActive(false);
      if (screenFlashTimerRef.current) {
        window.clearTimeout(screenFlashTimerRef.current);
        screenFlashTimerRef.current = null;
      }
      return undefined;
    }

    setScreenFlashActive(true);
    const remainingMs = Math.max(0, screenFlashUntil - Date.now());
    if (screenFlashTimerRef.current) {
      window.clearTimeout(screenFlashTimerRef.current);
    }
    screenFlashTimerRef.current = window.setTimeout(() => {
      setScreenFlashActive(false);
      screenFlashTimerRef.current = null;
    }, remainingMs);

    return () => {
      if (screenFlashTimerRef.current) {
        window.clearTimeout(screenFlashTimerRef.current);
        screenFlashTimerRef.current = null;
      }
    };
  }, [storyState.ui?.screenFlashUntil]);

  useEffect(() => {
    const allTasks = getUniqueWorkTasks(
      editorContent.appData?.workConveyor?.seedTasks || [],
      storyState.work?.tasks || [],
    );
    const submittedTaskIds = storyState.work?.submittedTaskIds || [];
    const pendingTasks = allTasks.filter((task) => !submittedTaskIds.includes(task.id));
    const preferredTaskId = activeWorkTaskId || storyState.work?.activeTaskId;
    const nextActiveTaskId = pendingTasks.find((task) => task.id === preferredTaskId)?.id
      || pendingTasks[pendingTasks.length - 1]?.id
      || allTasks.find((task) => task.id === preferredTaskId)?.id
      || allTasks[allTasks.length - 1]?.id
      || null;
    if (nextActiveTaskId !== activeWorkTaskId) {
      setActiveWorkTaskId(nextActiveTaskId);
    }
  }, [activeWorkTaskId, editorContent.appData, storyState.work]);

  useEffect(() => {
    const allTasks = getUniqueWorkTasks(
      editorContent.appData?.workConveyor?.seedTasks || [],
      storyState.work?.tasks || [],
    );
    const currentTaskNumbers = storyState.work?.taskNumbers || {};
    const nextTaskNumbers = ensureConveyorTaskNumbers(allTasks, currentTaskNumbers);

    if (nextTaskNumbers === currentTaskNumbers) return;

    setStoryState((prev) => {
      const prevTaskNumbers = prev.work?.taskNumbers || {};
      const recalculatedTaskNumbers = ensureConveyorTaskNumbers(
        getUniqueWorkTasks(
          editorContent.appData?.workConveyor?.seedTasks || [],
          prev.work?.tasks || [],
        ),
        prevTaskNumbers,
      );

      if (recalculatedTaskNumbers === prevTaskNumbers) return prev;

      const nextState = {
        ...prev,
        work: {
          ...prev.work,
          taskNumbers: recalculatedTaskNumbers,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [editorContent.appData, persistRuntimeState, storyState.work?.taskNumbers, storyState.work?.tasks]);

  useEffect(() => {
    const seedTasks = editorContent.appData?.workConveyor?.seedTasks || [];
    const queuedTasks = editorContent.appData?.workConveyor?.queuedTasks || [];
    const allowedTasks = [...seedTasks, ...queuedTasks];
    const allowedIds = new Set(allowedTasks.map((task) => task.id).filter(Boolean));
    const allowedFingerprints = new Set(allowedTasks.map((task) => getWorkTaskFingerprint(task)));
    const runtimeTasks = storyState.work?.tasks || [];
    const staleTaskIds = runtimeTasks
      .filter((task) => (
        !allowedIds.has(task.id) && !allowedFingerprints.has(getWorkTaskFingerprint(task))
      ))
      .map((task) => task.id)
      .filter(Boolean);

    if (staleTaskIds.length === 0) return;

    setStoryState((prev) => {
      const prevRuntimeTasks = prev.work?.tasks || [];
      const nextRuntimeTasks = prevRuntimeTasks.filter((task) => (
        allowedIds.has(task.id) || allowedFingerprints.has(getWorkTaskFingerprint(task))
      ));

      if (nextRuntimeTasks.length === prevRuntimeTasks.length) return prev;

      const staleIds = new Set(
        prevRuntimeTasks
          .filter((task) => !nextRuntimeTasks.includes(task))
          .map((task) => task.id)
          .filter(Boolean),
      );
      const nextTypedTextByTask = { ...(prev.work?.typedTextByTask || {}) };
      const nextTaskNumbers = { ...(prev.work?.taskNumbers || {}) };
      staleIds.forEach((taskId) => {
        delete nextTypedTextByTask[taskId];
        delete nextTaskNumbers[taskId];
      });

      const nextSubmittedTaskIds = (prev.work?.submittedTaskIds || []).filter((taskId) => !staleIds.has(taskId));
      const nextActiveTaskId = staleIds.has(prev.work?.activeTaskId)
        ? null
        : prev.work?.activeTaskId || null;

      const nextState = {
        ...prev,
        work: {
          ...prev.work,
          tasks: nextRuntimeTasks,
          typedTextByTask: nextTypedTextByTask,
          taskNumbers: nextTaskNumbers,
          submittedTaskIds: nextSubmittedTaskIds,
          activeTaskId: nextActiveTaskId,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [editorContent.appData, persistRuntimeState, storyState.work?.tasks]);

  useEffect(() => {
    const submittedCount = storyState.work?.submittedTaskIds?.length || 0;
    if (submittedCount < 3) return;
    if (storyState.flags?.kChatUnlockedAfterThirdTask) return;

    setStoryState((prev) => {
      if (prev.flags?.kChatUnlockedAfterThirdTask) return prev;

      const nextState = {
        ...prev,
        unlockedChats: Array.from(new Set([...(prev.unlockedChats || []), 'chat-k'])),
        flags: {
          ...prev.flags,
          kChatUnlockedAfterThirdTask: true,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });

    submitMessengerScriptEvent('chat-k', 'k_001', {
      id: 'k_001',
      direction: 'incoming',
      text: 'привет. Помнишь меня?',
    });
  }, [
    persistRuntimeState,
    storyState.flags,
    storyState.work?.submittedTaskIds,
    submitMessengerScriptEvent,
  ]);

  useEffect(() => {
    const seedTasks = editorContent.appData?.workConveyor?.seedTasks || [];
    const queuedTasks = editorContent.appData?.workConveyor?.queuedTasks || [];
    const allTasks = getUniqueWorkTasks(seedTasks, storyState.work?.tasks || []);
    const submittedTaskIds = storyState.work?.submittedTaskIds || [];
    const hasPendingTask = allTasks.some((task) => !submittedTaskIds.includes(task.id));

    if (hasPendingTask) return;

    const nextQueuedTask = queuedTasks.find((task) => {
      const fingerprint = getWorkTaskFingerprint(task);
      return !allTasks.some((existingTask) => (
        existingTask.id === task.id || getWorkTaskFingerprint(existingTask) === fingerprint
      ));
    }) || null;

    if (!nextQueuedTask) return;

    setStoryState((prev) => {
      const existingTasks = prev.work?.tasks || [];
      const alreadyExists = getUniqueWorkTasks(seedTasks, existingTasks).some((task) => (
        task.id === nextQueuedTask.id || getWorkTaskFingerprint(task) === getWorkTaskFingerprint(nextQueuedTask)
      ));
      if (alreadyExists) return prev;

      const nextState = {
        ...prev,
        work: {
          ...prev.work,
          tasks: [...existingTasks, nextQueuedTask],
          activeTaskId: nextQueuedTask.id,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [editorContent.appData, persistRuntimeState, storyState.work]);

  useEffect(() => () => {
    workSubmitTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    workSubmitTimersRef.current = [];
    conveyorNotifTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    conveyorNotifTimersRef.current = [];
    conveyorTerminalTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    conveyorTerminalTimersRef.current = [];
  }, []);

  const saveEditorDraft = () => {
    persistEditorSnapshot({ reason: 'manual', markAsLastGood: true });
  };

  const restoreEditorFromSnapshot = (snapshot) => {
    if (!snapshot?.content || !snapshot?.config) return;

    const nextContent = normalizeEditorContent(snapshot.content, STORY_CONTENT);
    const nextConfig = normalizeEditorConfig(snapshot.config, STORY_EDITOR_CONFIG);
    setEditorContent(nextContent);
    setEditorConfig(nextConfig);
    setEditorAutoSavedAt(snapshot.savedAt || Date.now());
  };

  const restoreLastEditorSnapshot = () => {
    const latestSnapshot = editorSnapshots[editorSnapshots.length - 1];
    restoreEditorFromSnapshot(latestSnapshot);
  };

  const downloadEditorScenarioJson = () => {
    if (typeof window === 'undefined') return;

    const payload = JSON.stringify({
      version: editorContent.version,
      appData: editorContent.appData,
      messenger: editorContent.messenger,
      sequences: editorContent.sequences,
      apps: editorContent.apps,
    }, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const href = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `fomo-scenario-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(href);
  };

  const importEditorScenarioJson = async (file) => {
    if (!file) return;

    const raw = await file.text();
    const parsed = JSON.parse(raw);
    const nextConfig = normalizeEditorConfig(parsed.config || STORY_EDITOR_CONFIG, STORY_EDITOR_CONFIG);
    const nextContent = normalizeEditorContent(parsed.content || parsed, STORY_CONTENT);

    setEditorConfig(nextConfig);
    setEditorContent(nextContent);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedAt = Date.now();
      const nextSnapshot = {
        id: `snapshot_${savedAt}`,
        savedAt,
        reason: 'autosave',
        config: editorConfig,
        content: editorContent,
      };

      setEditorAutoSavedAt(savedAt);
      setEditorSnapshots((prev) => {
        const previousSnapshots = Array.isArray(prev) ? prev : [];
        const lastSnapshot = previousSnapshots[previousSnapshots.length - 1];
        const hasChangedSinceLast = !lastSnapshot
          || JSON.stringify({
            config: lastSnapshot.config,
            content: lastSnapshot.content,
          }) !== editorDraftSnapshot;

        if (!hasChangedSinceLast) return previousSnapshots;

        return [...previousSnapshots, nextSnapshot].slice(-EDITOR_MAX_SNAPSHOTS);
      });
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [editorConfig, editorContent, editorDraftSnapshot]);

  useEffect(() => {
    const unlockedChatIds = new Set(storyState.unlockedChats || []);
    const visibleChats = (editorContent.messenger.chats || []).filter((chat) => unlockedChatIds.has(chat.id));
    const visibleChatIds = new Set(visibleChats.map((chat) => chat.id));
    if (visibleChats.length === 0) return;
    if (!visibleChatIds.has(activeChatId)) {
      setActiveChatId(visibleChats[0].id);
    }
  }, [activeChatId, editorContent.messenger.chats, storyState.unlockedChats]);

  useEffect(() => {
    if (!activeChatId || storyState.ui?.activeChatId === activeChatId) return;
    setStoryState((prev) => {
      const nextState = {
        ...prev,
        ui: {
          ...prev.ui,
          activeChatId,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [activeChatId, persistRuntimeState, storyState.ui?.activeChatId]);

  useEffect(() => {
    if (!open['app4'] || minimized['app4']) return () => {};

    const socialSequence = (editorContent.sequences || []).find((sequence) => sequence.schemaTrigger === 'app:open:app4');
    if (!socialSequence) return () => {};

    setStoryState((prev) => {
      const queuedIds = new Set(prev.queuedSequences || []);
      const alreadyStarted = new Set(prev.autoStartedSequenceIds || []);
      const alreadyUnlocked = (prev.unlockedChats || []).includes('chat-k');

      if (queuedIds.has(socialSequence.id) || alreadyStarted.has(socialSequence.id) || alreadyUnlocked) {
        return prev;
      }

      const nextState = {
        ...prev,
        autoStartedSequenceIds: [...(prev.autoStartedSequenceIds || []), socialSequence.id],
        queuedSequences: [...(prev.queuedSequences || []), socialSequence.id],
      };
      persistRuntimeState(nextState);
      return nextState;
    });

    return () => {};
  }, [editorContent.sequences, minimized, open, persistRuntimeState]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    minimizedRef.current = minimized;
  }, [minimized]);

  useEffect(() => {
    const messengerAppId = 'app3';
    const isMessengerVisible = !!open[messengerAppId] && !minimized[messengerAppId];
    if (!isMessengerVisible) return;

    const activeFeed = messengerThreadRef.current;

    if (!activeFeed) return;

    const scrollToBottom = () => {
      activeFeed.scrollTop = activeFeed.scrollHeight;
    };

    scrollToBottom();
    const frameId = window.requestAnimationFrame(scrollToBottom);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    activeChatId,
    open,
    minimized,
    storyState.messenger?.historyByChat,
    storyState.messenger?.typingByChat,
  ]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setStoryState((prev) => {
      const nextSceneIdByChat = { ...(prev.messenger?.sceneIdByChat || {}) };
      const nextEventIndexByChat = { ...(prev.messenger?.eventIndexByChat || {}) };
      let hasChanges = false;

      (editorContent.messenger?.chats || []).forEach((chat) => {
        const script = editorContent.messenger?.scripts?.[chat.id];
        const sceneIds = new Set((script?.scenes || []).map((scene) => scene.id));
        const startSceneId = script?.startSceneId || script?.scenes?.[0]?.id || '';
        const currentSceneId = nextSceneIdByChat[chat.id];
        const hasChatProgress = (prev.messenger?.historyByChat?.[chat.id] || []).length > 0
          || (prev.messenger?.completedEventIds || []).some((eventId) => (
            (script?.scenes || []).some((scene) => (scene.events || []).some((event) => event.id === eventId))
          ));

        if (!sceneIds.size) {
          if (currentSceneId || nextEventIndexByChat[chat.id]) {
            nextSceneIdByChat[chat.id] = '';
            nextEventIndexByChat[chat.id] = 0;
            hasChanges = true;
          }
          return;
        }

        if (!currentSceneId || !sceneIds.has(currentSceneId) || !hasChatProgress) {
          if (nextSceneIdByChat[chat.id] !== startSceneId || nextEventIndexByChat[chat.id] !== 0) {
            nextSceneIdByChat[chat.id] = startSceneId;
            nextEventIndexByChat[chat.id] = 0;
            hasChanges = true;
          }
          return;
        }

        const currentScene = (script?.scenes || []).find((scene) => scene.id === currentSceneId);
        const currentEventIndex = nextEventIndexByChat[chat.id] || 0;
        const currentEvent = currentScene?.events?.[currentEventIndex] || null;
        const lastSceneEvent = currentScene?.events?.[(currentScene?.events?.length || 1) - 1] || null;
        const hasOutgoingReply = !!(prev.messenger?.historyByChat?.[chat.id] || []).some(
          (entry) => entry?.id === `${lastSceneEvent?.id}-reply`
        );

        if (!currentEvent && lastSceneEvent?.type === 'message_player' && !hasOutgoingReply) {
          const repairedIndex = Math.max(0, (currentScene?.events?.length || 1) - 1);
          if (nextEventIndexByChat[chat.id] !== repairedIndex) {
            nextEventIndexByChat[chat.id] = repairedIndex;
            hasChanges = true;
          }
        }
      });

      if (!hasChanges) return prev;

      const nextState = {
        ...prev,
        messenger: {
          ...prev.messenger,
          sceneIdByChat: nextSceneIdByChat,
          eventIndexByChat: nextEventIndexByChat,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [editorContent.messenger, persistRuntimeState]);

  useEffect(() => {
    const incomingTextByEventId = new Map();
    const outgoingTextByEventId = new Map();
    const validHistoryIdsByChat = new Map();

    Object.entries(editorContent.messenger?.scripts || {}).forEach(([chatId, script]) => {
      const validIds = new Set();
      (script?.scenes || []).forEach((scene) => {
        (scene.events || []).forEach((event) => {
          if (event.type === 'message_other') {
            incomingTextByEventId.set(event.id, event.text || '');
            validIds.add(event.id);
          }
          if (event.type === 'message_player') {
            outgoingTextByEventId.set(`${event.id}-reply`, event.text || '');
            validIds.add(`${event.id}-reply`);
          }
        });
      });
      validHistoryIdsByChat.set(chatId, validIds);
    });

    setStoryState((prev) => {
      const historyByChat = prev.messenger?.historyByChat || {};
      let hasChanges = false;
      const nextHistoryByChat = Object.fromEntries(
        Object.entries(historyByChat).map(([chatId, history]) => {
          const validIds = validHistoryIdsByChat.get(chatId);
          const nextHistory = (history || []).filter((entry) => {
            if (!validIds || !entry?.id) return true;
            const shouldKeep = validIds.has(entry.id);
            if (!shouldKeep) {
              hasChanges = true;
            }
            return shouldKeep;
          }).map((entry) => {
            const nextIncomingText = incomingTextByEventId.get(entry.id);
            if (typeof nextIncomingText === 'string' && entry.direction === 'incoming' && entry.text !== nextIncomingText) {
              hasChanges = true;
              return { ...entry, text: nextIncomingText };
            }

            const nextOutgoingText = outgoingTextByEventId.get(entry.id);
            if (typeof nextOutgoingText === 'string' && entry.direction === 'outgoing' && entry.text !== nextOutgoingText) {
              hasChanges = true;
              return { ...entry, text: nextOutgoingText };
            }

            return entry;
          });
          return [chatId, nextHistory];
        }),
      );

      if (!hasChanges) return prev;

      const nextState = {
        ...prev,
        messenger: {
          ...prev.messenger,
          historyByChat: nextHistoryByChat,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [editorContent.messenger, persistRuntimeState]);


  // dragging icons
  const dragRef = useRef({ draggingId: null, offsetX: 0, offsetY: 0 });

  const onIconMouseDown = (e, id) => {
    e.preventDefault();
    const p = getDesktopPoint(e);
    if (!p) return;
    const pos = positions[id] || { x: 0, y: 0 };
    dragRef.current = { draggingId: id, offsetX: p.x - pos.x, offsetY: p.y - pos.y };
  };

  // moving windows
  const moveRef = useRef({ movingId: null, startX: 0, startY: 0, origX: 0, origY: 0 });

  const onWindowStartMove = (e, id) => {
    e.preventDefault();
    const p = getDesktopPoint(e);
    if (!p) return;
    const pos = winState[id].pos;
    moveRef.current = { movingId: id, startX: p.x, startY: p.y, origX: pos.x, origY: pos.y };
  };

  // resizing windows
  const resizeRef = useRef({
    resizingId: null,
    startX: 0,
    startY: 0,
    origW: 0,
    origH: 0,
    origX: 0,
    origY: 0,
    dir: { x: 0, y: 0 },
  });

  const onWindowStartResize = (e, id, dir) => {
    e.preventDefault();
    e.stopPropagation();
    const p = getDesktopPoint(e);
    if (!p) return;
    const size = winState[id].size;
    const pos = winState[id].pos;
    resizeRef.current = {
      resizingId: id,
      startX: p.x,
      startY: p.y,
      origW: size.width,
      origH: size.height,
      origX: pos.x,
      origY: pos.y,
      dir: dir || { x: 0, y: 0 },
    };
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      const p = getDesktopPoint(e);
      if (!p) return;
      // icon dragging
      if (dragRef.current.draggingId) {
        const id = dragRef.current.draggingId;
        const nx = p.x - dragRef.current.offsetX;
        const ny = p.y - dragRef.current.offsetY;
        const nextPos = clampIconPosition({ x: nx, y: ny });
        setPositions((p) => ({ ...p, [id]: nextPos }));
      }

      // window moving
      if (moveRef.current.movingId) {
        const id = moveRef.current.movingId;
        const dx = p.x - moveRef.current.startX;
        const dy = p.y - moveRef.current.startY;
        const size = winState[id].size;
        const nextPos = clampWindowPosition(
          { x: moveRef.current.origX + dx, y: moveRef.current.origY + dy },
          size
        );
        setWinState((s) => ({
          ...s,
          [id]: { ...s[id], pos: nextPos },
        }));
      }

      // window resizing
      if (resizeRef.current.resizingId) {
        const id = resizeRef.current.resizingId;
        const dx = p.x - resizeRef.current.startX;
        const dy = p.y - resizeRef.current.startY;
        const minW = 160;
        const minH = 120;
        let newW = resizeRef.current.origW;
        let newH = resizeRef.current.origH;
        let newX = resizeRef.current.origX;
        let newY = resizeRef.current.origY;
        const dir = resizeRef.current.dir || { x: 0, y: 0 };

        if (dir.x === 1) {
          newW = resizeRef.current.origW + dx;
        } else if (dir.x === -1) {
          newW = resizeRef.current.origW - dx;
          newX = resizeRef.current.origX + dx;
        }

        if (dir.y === 1) {
          newH = resizeRef.current.origH + dy;
        } else if (dir.y === -1) {
          newH = resizeRef.current.origH - dy;
          newY = resizeRef.current.origY + dy;
        }

        if (newW < minW) {
          if (dir.x === -1) {
            newX -= (minW - newW);
          }
          newW = minW;
        }
        if (newH < minH) {
          if (dir.y === -1) {
            newY -= (minH - newH);
          }
          newH = minH;
        }

        const nextPos = clampWindowPosition({ x: newX, y: newY }, { width: newW, height: newH });
        setWinState((s) => ({
          ...s,
          [id]: {
            ...s[id],
            size: {
              width: newW,
              height: newH,
            },
            pos: nextPos,
          },
        }));
      }

    };

    const onMouseUp = () => {
      dragRef.current.draggingId = null;
      moveRef.current.movingId = null;
      resizeRef.current.resizingId = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [clampIconPosition, positions, winState]);

  useEffect(() => {
    setStoryState((prev) => {
      const nextState = {
        ...prev,
        flags: {
          ...prev.flags,
          gameProgress,
        },
        ui: {
          ...prev.ui,
          activeChatId,
          view,
          gameScreen,
          openApps: open,
          minimizedApps: minimized,
          iconPositions: positions,
          windowState: winState,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [activeChatId, gameProgress, gameScreen, minimized, open, persistRuntimeState, positions, view, winState]);

  useEffect(() => () => {
    if (sequenceTimersRef.current.length > 0) {
      sequenceTimersRef.current.forEach((id) => clearTimeout(id));
      sequenceTimersRef.current = [];
    }
    if (beatAdvanceTimerRef.current) {
      clearTimeout(beatAdvanceTimerRef.current);
      beatAdvanceTimerRef.current = null;
    }
    Object.values(typingTimersRef.current).forEach((id) => clearTimeout(id));
    typingTimersRef.current = {};
    clearTerminalPromptTimers();
    persistentNotifTimersRef.current.forEach((entry) => window.clearTimeout(entry.timerId));
    persistentNotifTimersRef.current = [];
    if (prologueAudioRef.current) {
      prologueAudioRef.current.pause();
      prologueAudioRef.current.src = '';
      prologueAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (view !== 'prologue') return;
    if (prologueAudioRef.current) return;
    const audio = new Audio(PROLOGUE_AUDIO_SRC);
    audio.preload = 'auto';
    audio.loop = false;
    prologueAudioRef.current = audio;
  }, [view]);

  useEffect(() => {
    if (view === 'prologue' || view === 'ending') {
      setShowNotif(false);
      setToastLeaving(false);
      if (view === 'prologue' && !prologueStarted) {
        setPrologueStarted(true);
        setPrologueIndex(0);
        setPrologueDone(false);
      }
      if (view === 'ending' && !endingStarted) {
        setEndingStarted(true);
        setEndingIndex(0);
        setEndingDone(false);
      }
      return;
    }

    if (view !== 'landing') {
      setShowNotif(false);
      setToastLeaving(false);
      return;
    }

    let cancelled = false;
    let timerId;

    const startCycle = () => {
      if (cancelled) return;
      timerId = setTimeout(() => {
        setShowNotif(true);
        setToastLeaving(false);
        timerId = setTimeout(() => {
          setToastLeaving(true);
          timerId = setTimeout(() => {
            setShowNotif(false);
            setToastLeaving(false);
            startCycle();
          }, 320);
        }, 10000);
      }, 5000);
    };

    startCycle();
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [endingStarted, notifVariant, prologueStarted, view]);

  useEffect(() => {
    if (view !== 'prologue') return;
    if (!prologueStarted || prologueDone) return;
    const intervalId = setInterval(() => {
      setPrologueIndex((prev) => {
        if (prev >= PROLOGUE_TEXT.length) {
          clearInterval(intervalId);
          setPrologueDone(true);
          return prev;
        }
        return prev + 1;
      });
    }, 28);
    return () => clearInterval(intervalId);
  }, [view, prologueStarted, prologueDone, PROLOGUE_TEXT.length]);

  useEffect(() => {
    if (view !== 'ending') return;
    if (!endingStarted || endingDone) return;
    const intervalId = setInterval(() => {
      setEndingIndex((prev) => {
        if (prev >= TERMINAL_PROTOCOL_ENDING_TEXT.length) {
          clearInterval(intervalId);
          setEndingDone(true);
          return prev;
        }
        return prev + 1;
      });
    }, 40);
    return () => clearInterval(intervalId);
  }, [endingDone, endingStarted, view]);

  const closeWindow = (id) => {
    setOpen((p) => ({ ...p, [id]: false }));
    setMinimized((p) => ({ ...p, [id]: false }));
    if (id === GAME_ICON_ID) {
      setGameScreen('start');
    }
  };

  useEffect(() => {
    const queued = storyState.queuedSequences || [];
    if (queued.length === 0) return () => {};

    queued.forEach((sequenceId) => {
      if (runningSequencesRef.current.has(sequenceId)) return;

      const sequence = editorContent.sequences.find((item) => item.id === sequenceId);
      if (!sequence) {
        markSequenceConsumed(sequenceId);
        return;
      }

      runningSequencesRef.current.add(sequenceId);
      sequence.steps.forEach((step) => {
        const timerId = window.setTimeout(() => {
          if (step.type === 'openApp') {
            openWindow(step.appId);
            return;
          }
          if (step.type === 'focusApp') {
            openWindow(step.appId);
            bringToFront(step.appId);
            return;
          }
          if (step.type === 'deliverChatEvent') {
            const scriptEvent = findScriptEventById(step.chatId, step.eventId);
            if (!scriptEvent) return;
            const historyEntry = scriptEvent.type === 'message_other'
              ? {
                id: scriptEvent.id,
                direction: 'incoming',
                text: scriptEvent.text || '',
              }
              : null;
            submitMessengerScriptEvent(step.chatId, step.eventId, historyEntry);
            return;
          }
          runStoryEffects([step]);
        }, step.at || 0);
        sequenceTimersRef.current.push(timerId);
      });

      const lastAt = Math.max(...sequence.steps.map((step) => step.at || 0), 0);
      const finishTimerId = window.setTimeout(() => {
        runningSequencesRef.current.delete(sequenceId);
        markSequenceConsumed(sequenceId);
      }, lastAt + 80);
      sequenceTimersRef.current.push(finishTimerId);
    });

    return () => {};
  }, [
    bringToFront,
    editorContent.sequences,
    findScriptEventById,
    markSequenceConsumed,
    openWindow,
    runStoryEffects,
    storyState.queuedSequences,
    submitMessengerScriptEvent,
  ]);

  useEffect(() => {
    if (storyState.ui?.view !== 'desktop') return;

    const startupSequenceIds = (editorContent.sequences || [])
      .filter((sequence) => sequence.trigger === 'desktop:start')
      .map((sequence) => sequence.id);

    if (startupSequenceIds.length === 0) return;

    setStoryState((prev) => {
      const startedIds = new Set(prev.autoStartedSequenceIds || []);
      const queuedIds = new Set(prev.queuedSequences || []);
      const nextSequenceIds = startupSequenceIds.filter((sequenceId) => !startedIds.has(sequenceId) && !queuedIds.has(sequenceId));

      if (nextSequenceIds.length === 0) return prev;

      return {
        ...prev,
        autoStartedSequenceIds: [...(prev.autoStartedSequenceIds || []), ...nextSequenceIds],
        queuedSequences: [...(prev.queuedSequences || []), ...nextSequenceIds],
      };
    });
  }, [editorContent.sequences, storyState.ui?.view]);

  const minimizeWindow = (id) => {
    setMinimized((p) => ({ ...p, [id]: true }));
  };

  useEffect(() => {
    const isVisible = !!open.app5 && !minimized.app5;
    const maxZ = Math.max(0, ...Object.values(winState || {}).map((windowState) => windowState?.z || 0));
    const isFrontmost = isVisible && (winState.app5?.z || 0) >= maxZ;

    conveyorEngagementGainRef.current = null;
    conveyorVisibilityRef.current = {
      visible: isVisible,
      frontmost: isFrontmost,
    };
  }, [minimized, open, winState]);

  useEffect(() => {
    const isSocialVisible = !!open.app4 && !minimized.app4;
    const wasSocialVisible = socialVisibilityRef.current;
    const alreadyLogged = !!storyState.flags?.socialFirstOpenTerminalLogged;

    if (isSocialVisible && !wasSocialVisible && !alreadyLogged) {
      setStoryState((prev) => {
        if (prev.flags?.socialFirstOpenTerminalLogged) return prev;
        const nextState = {
          ...prev,
          flags: {
            ...(prev.flags || {}),
            socialFirstOpenTerminalLogged: true,
          },
          terminal: {
            ...prev.terminal,
            lines: [
              ...(prev.terminal?.lines || []),
              {
                id: `terminal-social-open-${Date.now()}`,
                text: SOCIAL_FIRST_OPEN_TERMINAL_TEXT,
                status: 'pending',
              },
            ],
          },
        };
        persistRuntimeState(nextState);
        return nextState;
      });
    }

    socialVisibilityRef.current = isSocialVisible;
    if (!isSocialVisible && socialScrollPromptTimerRef.current) {
      window.clearTimeout(socialScrollPromptTimerRef.current);
      socialScrollPromptTimerRef.current = null;
    }
  }, [minimized.app4, open.app4, persistRuntimeState, storyState.flags]);

  useEffect(() => {
    const ambientNotificationsEnabled = storyState.flags?.conveyorAmbientNotificationsEnabled !== false;
    if (!ambientNotificationsEnabled) return () => {};

    const tick = () => {
      if (storyState.terminal?.prompt?.active) return;

      const now = Date.now();
      const lastNotificationAt = Number(storyState.flags?.conveyorLastNotificationAt || 0);
      if (lastNotificationAt && (now - lastNotificationAt) < CONVEYOR_AMBIENT_NOTIFICATION_COOLDOWN_MS) {
        return;
      }

      const lastTaskActivityAt = Number(
        storyState.work?.lastTaskActivityAt
        || storyState.work?.lastInteractionAt
        || 0,
      );
      const idleMs = Math.max(0, now - lastTaskActivityAt);

      const pool = idleMs < CONVEYOR_ACTIVE_WINDOW_MS
        ? CONVEYOR_AMBIENT_POOLS.active
        : (idleMs < CONVEYOR_IDLE_WINDOW_MS
          ? CONVEYOR_AMBIENT_POOLS.idle
          : CONVEYOR_AMBIENT_POOLS.longIdle);

      if (!pool || Math.random() >= Number(pool.chance || 0)) return;

      const lastMessageText = storyState.work?.messages?.[0]?.text || '';
      const nextMessage = getRandomArrayItem(pool.items, lastMessageText);
      if (!nextMessage?.text) return;

      pushConveyorSystemNotification(nextMessage);
    };

    const intervalId = window.setInterval(tick, CONVEYOR_AMBIENT_NOTIFICATION_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [
    pushConveyorSystemNotification,
    storyState.flags,
    storyState.terminal?.prompt?.active,
    storyState.work?.lastInteractionAt,
    storyState.work?.lastTaskActivityAt,
    storyState.work?.messages,
  ]);

  const restoreDefaultRuntimeState = useCallback((nextStoryState, nextGameScreen = 'game') => {
    setStoryState(nextStoryState);
    setGameProgress(nextStoryState.flags.gameProgress || 'start');
    setGameScreen(nextGameScreen);
    setView(nextStoryState.ui.view || 'desktop');
    setActiveChatId(getPreferredActiveChatId(
      editorContent,
      nextStoryState.unlockedChats || [],
      nextStoryState.ui.activeChatId || '',
    ));
    setOpen(nextStoryState.ui.openApps || {});
    setMinimized(nextStoryState.ui.minimizedApps || {});
    setPositions(getDefaultIconPositions(nextStoryState.ui.iconPositions || {}));
    setWinState(getDefaultWindowState(nextStoryState.ui.windowState || {}));
    setTypedByChat({});
    setAdventureDeclineInputState(null);
    triggeredMessageFocusEffectsRef.current = new Set();
    conveyorVisibilityRef.current = { visible: false, frontmost: false };
    conveyorEngagementGainRef.current = null;
    conveyorNotifTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    conveyorNotifTimersRef.current = [];
    conveyorTerminalTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    conveyorTerminalTimersRef.current = [];
    terminalPromptTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    terminalPromptTimersRef.current = [];
  }, [editorContent, getDefaultIconPositions, getDefaultWindowState]);

  const launchDevFromStart = () => {
    if (!isDevRoute) return;
    clearStoryState('dev');
    const nextState = createDefaultStoryState(INITIAL_EDITOR_CONTENT);
    saveStoryState(nextState, 'dev');
    restoreDefaultRuntimeState(nextState, 'game');
  };
  const launchDevAtAdventurePrompt = () => {
    if (!isDevRoute) return;

    const baseState = createDefaultStoryState(INITIAL_EDITOR_CONTENT);
    const script = INITIAL_EDITOR_CONTENT.messenger?.scripts?.[TERMINAL_ADVENTURE_CHAT_ID];
    const startSceneId = script?.startSceneId || script?.scenes?.[0]?.id || '';
    const scene = (script?.scenes || []).find((item) => item.id === startSceneId) || null;

    if (!scene) {
      launchDevFromStart();
      return;
    }

    const pendingPlayerEventIndex = (scene.events || []).findIndex(
      (event) => event.id === TERMINAL_ADVENTURE_PLAYER_EVENT_ID,
    );

    if (pendingPlayerEventIndex < 0) {
      launchDevFromStart();
      return;
    }

    const completedEvents = (scene.events || []).slice(0, pendingPlayerEventIndex);
    const completedEventIds = new Set(completedEvents.map((event) => event.id));
    const adventureHistory = completedEvents.reduce((history, event) => {
      if (event.type === 'message_other') {
        history.push({
          id: event.id,
          direction: 'incoming',
          text: event.text || '',
        });
      } else if (event.type === 'message_player') {
        history.push({
          id: event.id,
          direction: 'outgoing',
          text: event.text || '',
        });
      }

      return history;
    }, []);

    const nextStateWithUi = applyStoryEffects(baseState, [
      { type: 'unlockChat', chatId: TERMINAL_ADVENTURE_CHAT_ID },
      { type: 'openApp', appId: 'app3' },
      { type: 'openApp', appId: 'app7' },
      { type: 'focusApp', appId: 'app3' },
      { type: 'focusApp', appId: 'app7' },
    ]);

    const nextState = {
      ...nextStateWithUi,
      flags: {
        ...nextStateWithUi.flags,
        gameProgress: 'desktop',
      },
      messenger: {
        ...nextStateWithUi.messenger,
        sceneIdByChat: {
          ...nextStateWithUi.messenger.sceneIdByChat,
          [TERMINAL_ADVENTURE_CHAT_ID]: startSceneId,
        },
        eventIndexByChat: {
          ...nextStateWithUi.messenger.eventIndexByChat,
          [TERMINAL_ADVENTURE_CHAT_ID]: pendingPlayerEventIndex,
        },
        historyByChat: {
          ...nextStateWithUi.messenger.historyByChat,
          [TERMINAL_ADVENTURE_CHAT_ID]: adventureHistory,
        },
        completedEventIds: [
          ...(nextStateWithUi.messenger.completedEventIds || []).filter((eventId) => !completedEventIds.has(eventId)),
          ...completedEvents.map((event) => event.id),
        ],
        processedEventIds: [],
        focusEffectEventIds: [],
        typingByChat: {
          ...nextStateWithUi.messenger.typingByChat,
          [TERMINAL_ADVENTURE_CHAT_ID]: {
            active: false,
            durationMs: 0,
          },
        },
      },
      terminal: {
        ...nextStateWithUi.terminal,
        lines: [
          ...(nextStateWithUi.terminal?.lines || []),
          {
            id: `${TERMINAL_ADVENTURE_PROMPT_ID}-seed-ellipsis`,
            text: '… …',
          },
          {
            id: `${TERMINAL_ADVENTURE_PROMPT_ID}-seed-prompt`,
            text: '> > запустить_процесс: приключение.ехе?..',
          },
        ],
        prompt: null,
      },
      ui: {
        ...nextStateWithUi.ui,
        view: 'desktop',
        gameScreen: 'game',
        activeChatId: TERMINAL_ADVENTURE_CHAT_ID,
      },
    };

    clearStoryState('dev');
    saveStoryState(nextState, 'dev');
    restoreDefaultRuntimeState(nextState, 'game');
  };
  const resetPlayerProgress = () => {
    clearStoryState('main');
  };
  const openPlayerViewFromStart = () => {
    if (typeof window === 'undefined') return;
    clearStoryState('main');
    window.open(`${window.location.origin}/`, '_blank', 'noopener,noreferrer');
  };
  const openPlayerView = () => {
    if (typeof window === 'undefined') return;
    window.open(`${window.location.origin}/`, '_blank', 'noopener,noreferrer');
  };
  useEffect(() => {
    const nextState = loadStoryState(editorContent, runtimeSlot);
    restoreDefaultRuntimeState(nextState, nextState.ui.gameScreen || 'game');
  }, [editorContent, restoreDefaultRuntimeState, runtimeSlot]);
  const messengerChats = editorContent.messenger.chats
    .filter((chat) => storyState.unlockedChats.includes(chat.id))
    .map((chat) => {
      const history = storyState.messenger.historyByChat?.[chat.id] || [];
      const latestHistoryText = history[history.length - 1]?.text || '';
      const unreadChatIds = storyState.messenger?.unreadChatIds || [];
      return {
        ...chat,
        preview: latestHistoryText,
        isUnread: unreadChatIds.includes(chat.id),
      };
    });

  const notes = useMemo(
    () => editorContent.appData?.notes?.seedNotes || [],
    [editorContent.appData?.notes?.seedNotes],
  );
  const calendarWeekdays = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const calendarMonthNames = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ];
  const calendarMonthGenitive = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ];
  const calendarEventSeeds = editorContent.appData?.calendar?.seedEvents || [];
  const currentDate = useMemo(() => new Date(), []);
  const getCalendarViewDate = useCallback(() => (
    new Date(currentDate.getFullYear(), currentDate.getMonth() + calendarMonthOffset, 1)
  ), [calendarMonthOffset, currentDate]);
  const canViewPreviousCalendarMonth = calendarMonthOffset > -2;
  const canViewNextCalendarMonth = calendarMonthOffset < 0;
  const goToPreviousCalendarMonth = useCallback(() => {
    setCalendarMonthOffset((prev) => Math.max(-2, prev - 1));
  }, []);
  const goToNextCalendarMonth = useCallback(() => {
    setCalendarMonthOffset((prev) => Math.min(0, prev + 1));
  }, []);
  const resetCalendarMonth = useCallback(() => {
    setCalendarMonthOffset(0);
  }, []);
  useEffect(() => {
    if (!notes.length) {
      if (activeNoteId !== '') {
        setActiveNoteId('');
      }
      return;
    }

    if (!notes.some((note) => note.id === activeNoteId)) {
      setActiveNoteId(notes[0].id);
    }
  }, [activeNoteId, notes]);

  const selectNote = (note) => {
    if (!note?.id) return;

    setActiveNoteId(note.id);

    const noteTerminalEffects = {
      'note-act1-16': {
        lineId: 'note-act1-16-terminal-memory',
        text: '> > C:\\Users\\G> официально невозможно уже вспомнить, что это был за вечер',
      },
      'note-act1-34': {
        lineId: 'note-act1-34-terminal-memory',
        text: '> > C:\\Users\\G> а кто-то прыгает с парашютом прямо сейчас!',
      },
    };
    const terminalEffect = noteTerminalEffects[note.id];
    if (!terminalEffect) return;

    setStoryState((prev) => {
      const existingLines = prev.terminal?.lines || [];
      if (existingLines.some((line) => line.id === terminalEffect.lineId)) {
        return prev;
      }

      const nextState = {
        ...prev,
        terminal: {
          ...prev.terminal,
          lines: [
            ...existingLines,
            {
              id: terminalEffect.lineId,
              text: terminalEffect.text,
              status: 'pending',
            },
          ],
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  };

  const createSocialPost = useCallback((index) => {
    const person = SOCIAL_PEOPLE[index % SOCIAL_PEOPLE.length];
    const caption = SOCIAL_CAPTIONS[index % SOCIAL_CAPTIONS.length];
    const likes = 120 + ((index * 37) % 1200);
    const hours = (index % 12) + 1;
    return {
      id: `post-${index}`,
      user: person.name,
      handle: person.handle,
      caption,
      likes,
      time: `${hours}ч`,
      image: `https://picsum.photos/seed/fomo-${index}/900/1100`,
    };
  }, []);
  const createSocialBatch = useCallback((count) => {
    const start = socialPostIndexRef.current;
    const next = Array.from({ length: count }, (_, i) => createSocialPost(start + i));
    socialPostIndexRef.current = start + count;
    return next;
  }, [createSocialPost]);


  const renderNotesBody = () => {
    const active = notes.find((n) => n.id === activeNoteId) || notes[0] || null;
    return (
      <div className="notes">
        <div className="notes-list notes-list--masonry">
          {notes.map((note) => (
            <button
              key={note.id}
              className={`note-item${note.id === active?.id ? ' active' : ''}`}
              onClick={() => selectNote(note)}
              type="button"
            >
              {note.title ? <div className="note-title">{note.title}</div> : null}
              <div className="note-preview">{note.preview || note.body}</div>
            </button>
          ))}
        </div>
        <div className="note-view">
          {active ? (
            <>
              {active.title ? <div className="note-view-title">{active.title}</div> : null}
              <div className="note-body">{active.body}</div>
            </>
          ) : (
            <div className="note-body">Пока заметок нет.</div>
          )}
        </div>
      </div>
    );
  };

  const renderMessengerBody = () => {
    const active = messengerChats.find((c) => c.id === activeChatId) || messengerChats[0];
    const threadDateLabel = 'Сегодня';
    const script = editorContent.messenger.scripts?.[active.id] || null;
        const activeScene = getActiveMessengerScene(editorContent, storyState.messenger, active.id);
        const history = storyState.messenger.historyByChat?.[active.id] || [];
        const currentEventIndex = storyState.messenger.eventIndexByChat?.[active.id] || 0;
        const nextEvent = activeScene?.events?.[currentEventIndex] || null;
        const completedEventIds = storyState.messenger.completedEventIds || [];
        const isWaitingForDependency = !!nextEvent?.waitForEventId && !completedEventIds.includes(nextEvent.waitForEventId);
        const pendingPlayerEvent = nextEvent?.type === 'message_player' && !isWaitingForDependency ? nextEvent : null;
        const previousEvent = currentEventIndex > 0
          ? activeScene?.events?.[currentEventIndex - 1] || null
          : null;
        const pendingChoice = pendingPlayerEvent && previousEvent?.schema?.choice
          ? previousEvent.schema.choice
          : null;
        const isTerminalPromptChoice = pendingChoice?.presentation === 'terminal_prompt';
        const terminalPrompt = storyState.terminal?.prompt;
        const isAdventureTerminalPrompt = isTerminalPromptChoice
          && previousEvent?.id === TERMINAL_ADVENTURE_CHOICE_EVENT_ID
          && active.id === TERMINAL_ADVENTURE_CHAT_ID;
        const isAdventureDeclineTyping = isAdventureTerminalPrompt && terminalPrompt?.stage === 'decline-typing';
        const isAdventureDeclineErasing = isAdventureTerminalPrompt && terminalPrompt?.stage === 'decline-erasing';
        const isAdventureAcceptanceRetyping = isAdventureTerminalPrompt && terminalPrompt?.stage === 'accept-retyping';
        const isAdventureAcceptanceReady = isAdventureTerminalPrompt && terminalPrompt?.stage === 'accept-ready';
        const isAdventureDeclineFlow = isAdventureDeclineTyping || isAdventureDeclineErasing;
        const isAdventureDraftVisibleFlow = isAdventureDeclineFlow || isAdventureAcceptanceRetyping || isAdventureAcceptanceReady;
        const isAdventureEditableFlow = isAdventureDeclineTyping || isAdventureAcceptanceReady;
        const adventureDeclineMode = adventureDeclineInputState?.mode || 'typing';
        const adventureDeclineExtraTapsRemaining = Math.max(0, adventureDeclineInputState?.extraTapsRemaining || 0);
        const pendingChoiceState = pendingChoice
          ? (storyState.messenger?.choiceStateByEventId?.[previousEvent.id] || {
            disabledOptionIds: [],
            selectedOptionId: '',
          })
          : null;
        const selectedChoiceOption = pendingChoice
          ? pendingChoice.options.find((option) => (
            option.id === pendingChoiceState?.selectedOptionId
            && !(pendingChoiceState?.disabledOptionIds || []).includes(option.id)
          )) || null
          : null;
        const typedMessengerText = pendingPlayerEvent ? (typedByChat[active.id] || '') : '';
        const isAdventureDeclineTextComplete = typedMessengerText.length >= TERMINAL_ADVENTURE_DECLINE_TEXT.length;
        const isAdventureDeclineBufferComplete = isAdventureDeclineTextComplete && adventureDeclineExtraTapsRemaining === 0;
        const targetText = isAdventureAcceptanceRetyping || isAdventureAcceptanceReady
          ? TERMINAL_ADVENTURE_AUTO_REPLY_TEXT
          : isAdventureDeclineFlow
          ? TERMINAL_ADVENTURE_DECLINE_TEXT
          : pendingChoice
          ? (selectedChoiceOption?.resultText || selectedChoiceOption?.label || '')
          : (pendingPlayerEvent?.text || '');
        const isMessengerInputBlockedByTerminalPrompt = isTerminalPromptChoice && !isAdventureEditableFlow;
        const isPendingTapComplete = pendingPlayerEvent
          ? typedMessengerText.length >= targetText.length && targetText.length > 0
          : false;
        const threadDate = activeScene?.dateLabel || threadDateLabel;
        const typingState = storyState.messenger?.typingByChat?.[active.id];
        const isSceneFinished = !!script && !nextEvent;
        const idleInputText = isSceneFinished ? 'пока сказать нечего' : '';
        const inputValue = isMessengerInputBlockedByTerminalPrompt
          ? (isAdventureDraftVisibleFlow ? typedMessengerText : '')
          : isAdventureDraftVisibleFlow
          ? typedMessengerText
          : pendingChoice && !typedMessengerText
          ? 'напишите ответ...'
          : pendingPlayerEvent
            ? typedMessengerText
            : idleInputText;
        const canSubmitMessage = !!pendingPlayerEvent
          && !isMessengerInputBlockedByTerminalPrompt
          && (!pendingChoice || !!selectedChoiceOption || isAdventureDraftVisibleFlow)
          && !isAdventureDeclineFlow
          && isPendingTapComplete;
        return (
            <div className="messenger">
              <div className="messenger-list">
                {messengerChats.map((chat) => (
                  <button
                    key={chat.id}
                    className={`chat-item${chat.id === active.id ? ' active' : ''}${chat.isUnread ? ' is-unread' : ''}`}
                    onMouseDown={() => {
                      messengerInputRestorePendingRef.current = messengerInputStickyFocusRef.current && isMessengerWindowFrontmost();
                    }}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      clearUnreadChat(chat.id);
                    }}
                    type="button"
                  >
                    <div className="chat-title">{chat.title}</div>
                    <div className="chat-preview">{chat.preview}</div>
                  </button>
                ))}
              </div>
              <div className="messenger-thread">
                <div className="thread-title">{active.title}</div>
                <div className="thread-messages" ref={messengerThreadRef}>
                  <div className="thread-date">{threadDate}</div>
                  {history.length > 0 ? history.map((msg, i) => (
                    <div
                      key={msg.id || `${active.id}-${i}`}
                      className={`thread-message ${msg.direction === 'outgoing' ? 'outgoing' : 'incoming'}`}
                    >
                      {msg.text}
                    </div>
                  )) : null}
                  {typingState?.active && (
                    <div className="thread-message incoming thread-typing" aria-label="typing">
                      <span className="typing-dots">
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  )}
                </div>
                <div className={`thread-input${pendingPlayerEvent || pendingChoice ? '' : ' thread-input--disabled'}`}>
                  <div
                    ref={messengerInputFieldRef}
                    className={`thread-input-field${pendingPlayerEvent && !isMessengerInputBlockedByTerminalPrompt ? ' is-active' : ''}${!pendingPlayerEvent && inputValue ? ' is-idle' : ''}${isMessengerInputBlockedByTerminalPrompt ? ' is-locked' : ''}`}
                    role="textbox"
                    aria-readonly="true"
                    tabIndex={isMessengerInputBlockedByTerminalPrompt ? -1 : 0}
                    onFocus={() => {
                      if (isMessengerInputBlockedByTerminalPrompt || !pendingPlayerEvent) return;
                      messengerInputStickyFocusRef.current = true;
                    }}
                    onBlur={() => {
                      if (messengerInputRestorePendingRef.current) return;
                      messengerInputStickyFocusRef.current = false;
                    }}
                    onKeyDown={(e) => {
                      if (isMessengerInputBlockedByTerminalPrompt) {
                        e.preventDefault();
                        return;
                      }
                      if (!pendingPlayerEvent) {
                        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Tab' || e.key === ' ') {
                          e.preventDefault();
                        }
                        return;
                      }
                      if (isAdventureDeclineTyping) {
                        const isProgressKey = e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Tab' || e.key === ' ';
                        if (!isProgressKey) return;
                        e.preventDefault();

                        if (adventureDeclineMode === 'erasing') {
                          const nextText = typedMessengerText.slice(0, -1);
                          setTypedByChat((prev) => ({
                            ...prev,
                            [active.id]: nextText,
                          }));

                          if (nextText.length === 0 && !(terminalPrompt?.noSequenceStarted)) {
                            setAdventureDeclineInputState(null);
                            updateAdventureProtocolPrompt((currentPrompt) => ({
                              ...currentPrompt,
                              stage: 'processing',
                              allowMessengerInput: false,
                              noSequenceStarted: true,
                            }));
                            runAdventureDeclinePostSequence(terminalPrompt?.yesCount || 0);
                          }
                          return;
                        }

                        if (!isAdventureDeclineTextComplete) {
                          typeMessengerMessageKey(active.id, pendingPlayerEvent.id, targetText, e);
                          return;
                        }

                        if (adventureDeclineMode === 'typing' && adventureDeclineExtraTapsRemaining > 0) {
                          setAdventureDeclineInputState((prev) => ({
                            ...(prev || { mode: 'typing', extraTapsRemaining: TERMINAL_ADVENTURE_DECLINE_EXTRA_TAPS }),
                            mode: 'typing',
                            extraTapsRemaining: Math.max(0, (prev?.extraTapsRemaining || 0) - 1),
                          }));
                          return;
                        }

                        if (adventureDeclineMode === 'typing' && isAdventureDeclineBufferComplete) {
                          setAdventureDeclineInputState((prev) => ({
                            ...(prev || { mode: 'typing', extraTapsRemaining: 0 }),
                            mode: 'erasing',
                            extraTapsRemaining: 0,
                          }));
                        }

                        const nextText = typedMessengerText.slice(0, -1);
                        setTypedByChat((prev) => ({
                          ...prev,
                          [active.id]: nextText,
                        }));

                        if (nextText.length === 0 && !(terminalPrompt?.noSequenceStarted)) {
                          e.preventDefault();
                          setAdventureDeclineInputState(null);
                          updateAdventureProtocolPrompt((currentPrompt) => ({
                            ...currentPrompt,
                            stage: 'processing',
                            allowMessengerInput: false,
                            noSequenceStarted: true,
                          }));
                          runAdventureDeclinePostSequence(terminalPrompt?.yesCount || 0);
                        }
                        return;
                      }
                      if (e.key === 'Enter' && canSubmitMessage) {
                        e.preventDefault();
                        if (pendingChoice && !isAdventureAcceptanceReady) {
                          submitMessengerChoice({
                            chatId: active.id,
                            choiceEventId: previousEvent.id,
                            choice: pendingChoice,
                            pendingPlayerEvent,
                          });
                          return;
                        }
                        submitMessengerMessage(active.id, pendingPlayerEvent.id, targetText, pendingPlayerEvent);
                        return;
                      }
                      if (pendingChoice && !isAdventureAcceptanceReady) {
                        typeMessengerChoiceKey(active.id, previousEvent.id, pendingChoice, e);
                        return;
                      }
                      typeMessengerMessageKey(active.id, pendingPlayerEvent.id, targetText, e);
                    }}
                    onMouseDown={() => {
                      if (isMessengerInputBlockedByTerminalPrompt) return;
                      if (!pendingPlayerEvent) return;
                      messengerInputStickyFocusRef.current = true;
                      messengerInputRestorePendingRef.current = false;
                      messengerInputFieldRef.current?.focus();
                      triggerMessengerMessageFocusEffects(active.id, pendingPlayerEvent);
                    }}
                  >
                    <span className="thread-input-content">
                      <span className="thread-input-text">{inputValue}</span>
                      {pendingPlayerEvent && !isMessengerInputBlockedByTerminalPrompt && <span className="thread-input-caret" aria-hidden="true" />}
                    </span>
                  </div>
                    <button
                      type="button"
                      disabled={!canSubmitMessage}
                      onClick={() => {
                        if (isMessengerInputBlockedByTerminalPrompt) return;
                        if (!pendingPlayerEvent) return;
                      if (isAdventureDeclineTyping) {
                        handleAdventureDeclineSubmitAttempt(active.id);
                        return;
                      }
                      if (pendingChoice && !isAdventureAcceptanceReady) {
                        submitMessengerChoice({
                          chatId: active.id,
                          choiceEventId: previousEvent.id,
                          choice: pendingChoice,
                          pendingPlayerEvent,
                        });
                        return;
                      }
                      submitMessengerMessage(active.id, pendingPlayerEvent.id, targetText, pendingPlayerEvent);
                    }}
                  >
                    Отправить
                  </button>
                </div>
              </div>
            </div>
        );
  };
  const renderCalendarBody = () => {
    const today = currentDate;
    const viewDate = getCalendarViewDate();
    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();
    const monthLabel = calendarMonthNames[viewMonth];
    const firstDay = new Date(viewYear, viewMonth, 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const isSameDay = (a, b) =>
      a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
    const events = calendarEventSeeds.map((item) => ({
      ...item,
      date: new Date(viewYear, viewMonth, today.getDate() + item.offset),
    }));
    const formatAgendaDate = (date) => `${date.getDate()} ${calendarMonthGenitive[date.getMonth()]}`;
    const cells = Array.from({ length: 42 }, (_, index) => {
      let date;
      let inMonth = true;
      if (index < firstWeekday) {
        date = new Date(viewYear, viewMonth, 1);
        inMonth = false;
      } else if (index >= firstWeekday + daysInMonth) {
        date = new Date(viewYear, viewMonth, daysInMonth);
        inMonth = false;
      } else {
        const day = index - firstWeekday + 1;
        date = new Date(viewYear, viewMonth, day);
      }
      const weekend = [5, 6].includes((index % 7));
      const dayEvents = events.filter((ev) => isSameDay(ev.date, date));
      return {
        key: `${date.toISOString()}-${index}`,
        date,
        inMonth,
        weekend,
        isToday: isSameDay(date, today),
        events: dayEvents,
      };
    });
    const agenda = [...events].sort((a, b) => a.date - b.date);

    return (
      <div className="calendar">
        <div className="calendar-shell">
          <div className="calendar-header">
            <button className="calendar-nav" type="button" aria-label="Назад" onClick={goToPreviousCalendarMonth} disabled={!canViewPreviousCalendarMonth}>‹</button>
            <div className="calendar-month">{monthLabel}</div>
            <button className="calendar-nav" type="button" aria-label="Вперед" onClick={goToNextCalendarMonth} disabled={!canViewNextCalendarMonth}>›</button>
          </div>
          <div className="calendar-weekdays">
            {calendarWeekdays.map((day) => (
              <div className="calendar-weekday" key={day}>{day}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((cell) => (
              <div
                key={cell.key}
                className={`calendar-cell${cell.inMonth ? '' : ' is-out'}${cell.isToday ? ' is-today' : ''}${cell.weekend ? ' is-weekend' : ''}`}
              >
                <span className="calendar-date">{cell.inMonth ? cell.date.getDate() : ''}</span>
                {cell.inMonth && cell.events.length > 0 && (
                  <div className="calendar-dots">
                    {cell.events.map((event) => (
                      <span className="calendar-dot" key={event.id} title={event.title} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="calendar-agenda">
          <div className="calendar-agenda-title">События</div>
          {agenda.map((event) => (
            <div className="calendar-agenda-item" key={event.id}>
              <div className="calendar-agenda-date">{formatAgendaDate(event.date)}</div>
              <div className="calendar-agenda-content">
                <div className="calendar-agenda-name">{event.title}</div>
                <div className="calendar-agenda-note">{event.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCalendarBodyDesktop = () => {
    const today = currentDate;
    const viewDate = getCalendarViewDate();
    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();
    const monthLabel = calendarMonthNames[viewMonth];
    const firstDay = new Date(viewYear, viewMonth, 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const eventColors = ['green', 'yellow', 'red', 'blue', 'purple', 'gray'];
    const isSameDay = (a, b) => (
      a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate()
    );
    const formatEventTime = (value) => {
      if (!value) return '';
      if (/^\d{1,2}:\d{2}$/.test(value)) return value;
      if (/^\d{1,2}$/.test(value)) return `${value}:00`;
      return value;
    };

    const events = calendarEventSeeds.map((item) => ({
      ...item,
      date: new Date(viewYear, viewMonth, today.getDate() + item.offset),
      color: eventColors[Math.abs(item.offset) % eventColors.length],
    }));
    const weeklyWateringEvents = Array.from({ length: daysInMonth }, (_, dayIndex) => dayIndex + 1)
      .map((day) => new Date(viewYear, viewMonth, day))
      .filter((date) => date.getDay() === 3)
      .map((date, index) => ({
        id: `calendar-water-plant-${viewYear}-${viewMonth + 1}-${index}`,
        title: 'полить цветок',
        note: '',
        date,
        color: 'gray',
      }));
    const allEvents = [...events, ...weeklyWateringEvents];

    const cells = Array.from({ length: 42 }, (_, index) => {
      let date;
      let inMonth = true;

      if (index < firstWeekday) {
        date = new Date(viewYear, viewMonth, 1);
        inMonth = false;
      } else if (index >= firstWeekday + daysInMonth) {
        date = new Date(viewYear, viewMonth, daysInMonth);
        inMonth = false;
      } else {
        const day = index - firstWeekday + 1;
        date = new Date(viewYear, viewMonth, day);
      }

      const weekend = [5, 6].includes(index % 7);
      const dayEvents = allEvents.filter((ev) => isSameDay(ev.date, date));

      return {
        key: `${date.toISOString()}-${index}`,
        date,
        inMonth,
        weekend,
        isToday: isSameDay(date, today),
        events: dayEvents.slice(0, 3),
        extraCount: Math.max(0, dayEvents.length - 3),
      };
    });

    return (
      <div className="calendar calendar--dark">
        <div className="calendar-shell calendar-shell--desktop">
          <div className="calendar-header calendar-header--desktop">
            <div className="calendar-month-block">
              <div className="calendar-month-name">{monthLabel}</div>
            </div>
            <div className="calendar-header-actions">
              <button className="calendar-nav calendar-nav--ghost" type="button" aria-label="Previous" onClick={goToPreviousCalendarMonth} disabled={!canViewPreviousCalendarMonth}>‹</button>
              <button className="calendar-today-btn" type="button" onClick={resetCalendarMonth} disabled={!canViewNextCalendarMonth}>Today</button>
              <button className="calendar-nav calendar-nav--ghost" type="button" aria-label="Next" onClick={goToNextCalendarMonth} disabled={!canViewNextCalendarMonth}>›</button>
            </div>
          </div>

          <div className="calendar-weekdays">
            {calendarWeekdays.map((day) => (
              <div className="calendar-weekday" key={day}>{day}</div>
            ))}
          </div>

          <div className="calendar-grid">
            {cells.map((cell) => (
              <div
                key={cell.key}
                className={`calendar-cell${cell.inMonth ? '' : ' is-out'}${cell.isToday ? ' is-today' : ''}${cell.weekend ? ' is-weekend' : ''}`}
              >
                <div className="calendar-cell-head">
                  <span className="calendar-date">{cell.inMonth ? cell.date.getDate() : ''}</span>
                </div>
                <div className="calendar-events">
                  {cell.inMonth && cell.events.map((event) => (
                    <div className={`calendar-event-pill is-${event.color}`} key={event.id} title={event.title}>
                      <span className="calendar-event-title">{event.title}</span>
                      <span className="calendar-event-time">{formatEventTime(event.note)}</span>
                    </div>
                  ))}
                  {cell.inMonth && cell.extraCount > 0 ? (
                    <div className="calendar-more">+{cell.extraCount} more</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const loadMoreSocial = useCallback(() => {
    if (socialLoadingRef.current) return;
    socialLoadingRef.current = true;
    setSocialPosts((prev) => [...prev, ...createSocialBatch(6)]);
    requestAnimationFrame(() => {
      socialLoadingRef.current = false;
    });
  }, [createSocialBatch]);

  const renderSocialBody = () => {
    const onSocialScroll = (e) => {
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 220) {
        loadMoreSocial();
      }

      if (socialScrollPromptTimerRef.current || storyState.flags?.socialScrollTerminalLogged) {
        return;
      }

      socialScrollPromptTimerRef.current = window.setTimeout(() => {
        socialScrollPromptTimerRef.current = null;
        if (storyState.flags?.socialScrollTerminalLogged) return;
        if (!openRef.current?.app4 || minimizedRef.current?.app4) return;

        setStoryState((prev) => {
          if (prev.flags?.socialScrollTerminalLogged) return prev;
          const nextState = {
            ...prev,
            flags: {
              ...(prev.flags || {}),
              socialScrollTerminalLogged: true,
            },
            terminal: {
              ...prev.terminal,
              lines: [
                ...(prev.terminal?.lines || []),
                {
                  id: `terminal-social-scroll-${Date.now()}`,
                  text: SOCIAL_SCROLL_TERMINAL_TEXT,
                  status: 'pending',
                },
              ],
            },
          };
          persistRuntimeState(nextState);
          return nextState;
        });
      }, SOCIAL_SCROLL_TERMINAL_DELAY_MS);
    };
    return (
      <div className="social">
        <div className="social-top">
          <div className="social-brand">Лента</div>
          <div className="social-actions">
            <button className="social-action" type="button">+</button>
            <button className="social-action" type="button">o</button>
          </div>
        </div>
        <div className="social-stories">
          {SOCIAL_PEOPLE.map((person) => (
            <div className="social-story" key={person.handle}>
              <div className="social-story-avatar">{person.name.slice(0, 1)}</div>
              <div className="social-story-name">{person.name}</div>
            </div>
          ))}
        </div>
        <div className="social-feed" onScroll={onSocialScroll} ref={socialFeedRef}>
          {socialPosts.map((post) => (
            <div className="social-post" key={post.id}>
              <div className="social-post-head">
                <div className="social-avatar">{post.user.slice(0, 1)}</div>
                <div className="social-user-meta">
                  <div className="social-user">{post.user}</div>
                  <div className="social-handle">@{post.handle} · {post.time}</div>
                </div>
              </div>
              <div className="social-image-wrap">
                <img src={post.image} alt={post.caption} />
              </div>
              <div className="social-actions-row">
                <button type="button">Нравится</button>
                <button type="button">Коммент</button>
                <button type="button">Сохранить</button>
              </div>
              <div className="social-caption">
                <span className="social-user">{post.user}</span> {post.caption}
              </div>
              <div className="social-meta">{post.likes} лайков</div>
            </div>
          ))}
          <div className="social-loader">Лента бесконечная...</div>
        </div>
      </div>
    );
  };

  const getAppType = (appId) => (
    editorConfig.apps.find((app) => app.id === appId)?.type || null
  );

  const openDesktop = () => {
    if (view === 'desktop') return;
    setPrologueStarted(false);
    setPrologueIndex(0);
    setPrologueDone(false);
    setView('desktop');
    setShowNotif(false);
    setPersistentNotifs([]);
    persistentNotifTimersRef.current.forEach((entry) => window.clearTimeout(entry.timerId));
    persistentNotifTimersRef.current = [];
    setStoryState((prev) => {
      const startupSequenceIds = (editorContent.sequences || [])
        .filter((sequence) => sequence.trigger === 'desktop:start')
        .map((sequence) => sequence.id);
      const startedIds = new Set(prev.autoStartedSequenceIds || []);
      const queuedIds = new Set(prev.queuedSequences || []);
      const nextSequenceIds = startupSequenceIds.filter((sequenceId) => !startedIds.has(sequenceId) && !queuedIds.has(sequenceId));

      if (nextSequenceIds.length === 0) {
        return prev;
      }

      const nextState = {
        ...prev,
        autoStartedSequenceIds: [...(prev.autoStartedSequenceIds || []), ...nextSequenceIds],
        queuedSequences: [...(prev.queuedSequences || []), ...nextSequenceIds],
      };
      persistRuntimeState(nextState);
      return nextState;
    });
    runStoryEffects([
      { type: 'setFlag', key: 'desktopOpened', value: true },
    ]);
  };

  const handlePrologueClick = () => {
    if (view !== 'prologue') return;
    if (!prologueAudioStartedRef.current && prologueAudioRef.current) {
      prologueAudioStartedRef.current = true;
      const playPromise = prologueAudioRef.current.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          prologueAudioStartedRef.current = false;
        });
      }
    }
    if (prologueDone) {
      openDesktop();
      return;
    }
    setPrologueIndex(PROLOGUE_TEXT.length);
    setPrologueDone(true);
  };

  const renderExitBody = () => (
    <div className="game-panel">
      <div className="game-title">ты точно этого хочешь? правда?((</div>
      <div className="game-actions">
        <button
          className="game-btn"
          onClick={() => {
            setOpen((p) => ({ ...p, [EXIT_ICON_ID]: false }));
            setView('landing');
            setNotifVariant('return');
          }}
        >
          уйти
        </button>
      </div>
    </div>
  );

  // scale desktop to fit frame when frame is smaller than 1920x1080
  useEffect(() => {
    if (view !== 'desktop') return;
    const frame = frameRef.current;
    const desktop = desktopRef.current;
    if (!frame || !desktop) return;
    let rafId = 0;
    const updateScale = () => {
      const fw = frame.clientWidth;
      const fh = frame.clientHeight;
      const s = Math.min(fw / 1920, fh / 1080, 1);
      desktop.style.transform = `scale(${s})`;
      desktop.style.transformOrigin = 'center center';
      scaleRef.current = s;
      desktopRectRef.current = desktop.getBoundingClientRect();
      const prevBounds = lastBoundsRef.current;
      const nextBounds = getDragBounds();
      if (prevBounds) {
        setPositions((prev) => {
          const next = { ...prev };
          const prevW = Math.max(1, prevBounds.maxX - prevBounds.minX);
          const prevH = Math.max(1, prevBounds.maxY - prevBounds.minY);
          const nextW = Math.max(1, nextBounds.maxX - nextBounds.minX);
          const nextH = Math.max(1, nextBounds.maxY - nextBounds.minY);
          icons.forEach((it) => {
            if (next[it.id]) {
              const rx = (next[it.id].x - prevBounds.minX) / prevW;
              const ry = (next[it.id].y - prevBounds.minY) / prevH;
              next[it.id] = clampIconPosition({
                x: nextBounds.minX + rx * nextW,
                y: nextBounds.minY + ry * nextH,
              });
            }
          });
          return next;
        });
      }
      lastBoundsRef.current = nextBounds;
    };
    const scheduleUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateScale);
    };

    scheduleUpdate();
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(frame);
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [clampIconPosition, getDragBounds, icons, view]);


  useEffect(() => {
    if (view !== 'landing') return;
    if (desktopRef.current) {
      desktopRef.current.style.transform = 'none';
    }
    scaleRef.current = 1;
    desktopRectRef.current = null;
  }, [view]);

  useEffect(() => {
    if (socialPosts.length > 0) return;
    setSocialPosts(createSocialBatch(8));
  }, [createSocialBatch, socialPosts.length]);

  useEffect(() => {
    beatRevealTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    beatRevealTimersRef.current = [];

    const completedEventIds = storyState.messenger.completedEventIds || [];
    const eventIndexByChat = storyState.messenger.eventIndexByChat || {};
    const unlockedChatIds = new Set(storyState.unlockedChats || []);
    const currentChatId = activeChatId || storyState.ui?.activeChatId || '';

    (editorContent.messenger.chats || []).forEach((chat) => {
      if (!unlockedChatIds.has(chat.id) || chat.id !== currentChatId) return;
      const activeScene = getActiveMessengerScene(editorContent, storyState.messenger, chat.id);
      if (!activeScene) return;

      const eventIndex = eventIndexByChat[chat.id] || 0;
      const nextEvent = activeScene.events?.[eventIndex];
      if (!nextEvent) return;
      if (nextEvent.waitForEventId && !completedEventIds.includes(nextEvent.waitForEventId)) return;
      if (nextEvent.schema?.autoDeliver === false) return;
      if (nextEvent.type === 'message_player') return;

      const delayMs = Number(nextEvent.delayMs ?? editorConfig.timings.messageGapMs ?? 0);

      if (nextEvent.type === 'message_other') {
        const typingDurationMs = Math.max(0, Math.ceil((nextEvent.text || '').length * Number(nextEvent.typingSpeedMs || 0)));
        const typingTimerId = setTimeout(() => {
          setStoryState((prev) => ({
            ...prev,
            messenger: {
              ...prev.messenger,
              typingByChat: {
                ...(prev.messenger?.typingByChat || {}),
                [chat.id]: {
                  active: true,
                  durationMs: typingDurationMs,
                },
              },
            },
          }));
        }, delayMs);
        beatRevealTimersRef.current.push(typingTimerId);

        const messageTimerId = setTimeout(() => {
          submitMessengerScriptEvent(chat.id, nextEvent.id, {
            id: nextEvent.id,
            direction: 'incoming',
            text: nextEvent.text || '',
          });
        }, delayMs + typingDurationMs);
        beatRevealTimersRef.current.push(messageTimerId);
        return;
      }

      if (nextEvent.type === 'effect' || nextEvent.type === 'command' || nextEvent.type === 'scene_end') {
        const commandTimerId = setTimeout(() => {
          submitMessengerScriptEvent(chat.id, nextEvent.id, null);
        }, delayMs);
        beatRevealTimersRef.current.push(commandTimerId);
      }
    });

    return () => {
      beatRevealTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      beatRevealTimersRef.current = [];
    };
  }, [
    activeChatId,
    editorConfig.timings.messageGapMs,
    editorContent,
    storyState.messenger.completedEventIds,
    storyState.messenger.eventIndexByChat,
    storyState.messenger.sceneIdByChat,
    storyState.ui?.activeChatId,
    storyState.unlockedChats,
    submitMessengerScriptEvent,
  ]);

  useEffect(() => {
    const typingByChat = storyState.messenger?.typingByChat || {};
    Object.entries(typingByChat).forEach(([chatId, typing]) => {
      if (!typing?.active || !typing.durationMs) return;
      if (typingTimersRef.current[chatId]) return;
      typingTimersRef.current[chatId] = setTimeout(() => {
        setStoryState((prev) => ({
          ...prev,
          messenger: {
            ...prev.messenger,
            typingByChat: {
              ...(prev.messenger?.typingByChat || {}),
              [chatId]: {
                ...(prev.messenger?.typingByChat?.[chatId] || {}),
                active: false,
              },
            },
          },
        }));
        clearTimeout(typingTimersRef.current[chatId]);
        delete typingTimersRef.current[chatId];
      }, typing.durationMs);
    });

    return () => {};
  }, [storyState.messenger?.typingByChat]);

  useEffect(() => {
    const currentLineCount = (storyState.terminal?.lines || []).length;
    const previousLineCount = terminalLineCountRef.current;

    if (previousLineCount === null) {
      terminalLineCountRef.current = currentLineCount;
      return;
    }

    if (currentLineCount > previousLineCount && view === 'desktop') {
      openWindow('app7');
      bringToFront('app7');
    }

    terminalLineCountRef.current = currentLineCount;
  }, [bringToFront, openWindow, storyState.terminal?.lines, view]);

  useEffect(() => {
    if (!isMessengerWindowVisible() || !activeChatId) return;
    clearUnreadChat(activeChatId);
  }, [activeChatId, clearUnreadChat, isMessengerWindowVisible, open, minimized, storyState.messenger?.unreadChatIds]);

  useEffect(() => {
    const activeScene = getActiveMessengerScene(editorContent, storyState.messenger, TERMINAL_ADVENTURE_CHAT_ID);
    const currentEventIndex = storyState.messenger?.eventIndexByChat?.[TERMINAL_ADVENTURE_CHAT_ID] || 0;
    const nextEvent = activeScene?.events?.[currentEventIndex] || null;
    const previousEvent = currentEventIndex > 0 ? activeScene?.events?.[currentEventIndex - 1] || null : null;
    const pendingChoice = nextEvent?.type === 'message_player' && previousEvent?.schema?.choice?.presentation === 'terminal_prompt'
      ? previousEvent.schema.choice
      : null;

    if (!pendingChoice || previousEvent?.id !== TERMINAL_ADVENTURE_CHOICE_EVENT_ID || nextEvent?.id !== TERMINAL_ADVENTURE_PLAYER_EVENT_ID) {
      return;
    }

    setStoryState((prev) => {
      const existingPrompt = prev.terminal?.prompt;
      if (existingPrompt?.id === TERMINAL_ADVENTURE_PROMPT_ID) {
        return prev;
      }

      const nextState = {
        ...prev,
        terminal: {
          ...prev.terminal,
          prompt: {
            id: TERMINAL_ADVENTURE_PROMPT_ID,
            active: true,
            stage: 'choice',
            noDisabled: false,
            baseLineCount: (prev.terminal?.lines || []).length,
            chatId: TERMINAL_ADVENTURE_CHAT_ID,
            choiceEventId: TERMINAL_ADVENTURE_CHOICE_EVENT_ID,
            pendingPlayerEventId: TERMINAL_ADVENTURE_PLAYER_EVENT_ID,
            acceptText: TERMINAL_ADVENTURE_ACCEPT_TEXT,
            yesCount: 0,
            allowMessengerInput: false,
            declineSubmitAttempted: false,
            noSequenceStarted: false,
          },
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });

    const isTerminalOpen = !!openRef.current?.app7 && !minimizedRef.current?.app7;
    if (isTerminalOpen) {
      bringToFront('app7');
    } else {
      openWindow('app7');
    }
  }, [
    bringToFront,
    editorContent,
    openWindow,
    persistRuntimeState,
    storyState.messenger,
  ]);

  useEffect(() => {
    const completedEventIds = storyState.messenger?.completedEventIds || [];
    if (!storyState.flags?.acceptedAdventure) return;
    if (!completedEventIds.includes('k_068')) return;
    if (view === 'ending') return;

    const timerId = window.setTimeout(() => {
      setView('ending');
    }, TERMINAL_PROTOCOL_ENDING_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [storyState.flags?.acceptedAdventure, storyState.messenger?.completedEventIds, view]);

  useEffect(() => {
    const completedEventIds = storyState.messenger?.completedEventIds || [];
    if (!completedEventIds.includes('mom_004')) return;
    if (storyState.flags?.momWorkNotifShown) return;

    pushPersistentNotif({
      title: 'Конвейер',
      text: 'Задача',
      appId: 'app5',
    });

    setStoryState((prev) => {
      const nextState = {
        ...prev,
        flags: {
          ...prev.flags,
          momWorkNotifShown: true,
        },
      };
      persistRuntimeState(nextState);
      return nextState;
    });
  }, [persistRuntimeState, pushPersistentNotif, storyState.flags, storyState.messenger?.completedEventIds]);

  useEffect(() => {
    if (!messengerInputStickyFocusRef.current && !messengerInputRestorePendingRef.current) return;
    if (!isMessengerWindowFrontmost()) return;

    const activeChat = messengerChats.find((chat) => chat.id === activeChatId) || messengerChats[0] || null;
    if (!activeChat) return;

    const activeScene = getActiveMessengerScene(editorContent, storyState.messenger, activeChat.id);
    const currentEventIndex = storyState.messenger?.eventIndexByChat?.[activeChat.id] || 0;
    const nextEvent = activeScene?.events?.[currentEventIndex] || null;
    const completedEventIds = storyState.messenger?.completedEventIds || [];
    const isWaitingForDependency = !!nextEvent?.waitForEventId && !completedEventIds.includes(nextEvent.waitForEventId);
    const pendingPlayerEvent = nextEvent?.type === 'message_player' && !isWaitingForDependency ? nextEvent : null;
    const previousEvent = currentEventIndex > 0 ? activeScene?.events?.[currentEventIndex - 1] || null : null;
    const pendingChoice = pendingPlayerEvent && previousEvent?.schema?.choice
      ? previousEvent.schema.choice
      : null;
    const isAdventureDeclineFlow = pendingChoice?.presentation === 'terminal_prompt'
      && previousEvent?.id === TERMINAL_ADVENTURE_CHOICE_EVENT_ID
      && activeChat.id === TERMINAL_ADVENTURE_CHAT_ID
      && ['decline-typing', 'decline-erasing'].includes(storyState.terminal?.prompt?.stage || '');
    const isMessengerInputBlockedByTerminalPrompt = pendingChoice?.presentation === 'terminal_prompt' && !isAdventureDeclineFlow;

    if (!pendingPlayerEvent || isMessengerInputBlockedByTerminalPrompt) {
      messengerInputRestorePendingRef.current = false;
      return;
    }

    const timerId = window.setTimeout(() => {
      messengerInputFieldRef.current?.focus();
      triggerMessengerMessageFocusEffects(activeChat.id, pendingPlayerEvent);
      messengerInputRestorePendingRef.current = false;
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [
    activeChatId,
    editorContent,
    isMessengerWindowFrontmost,
    messengerChats,
    storyState.messenger,
    storyState.terminal?.prompt?.stage,
    triggerMessengerMessageFocusEffects,
  ]);

  const handlePersistentNotifClick = (notif) => {
    if (!notif) return;
    const targetAppId = notif.appId || 'app3';
    if (open[targetAppId]) {
      setMinimized((prev) => ({ ...prev, [targetAppId]: false }));
      bringToFront(targetAppId);
    } else {
      openWindow(targetAppId);
    }
    if (notif.chatId) {
      setActiveChatId(notif.chatId);
      clearUnreadChat(notif.chatId);
    }
    dismissPersistentNotif(notif.id);
  };

  const taskbarTabs = [
    ...icons
      .filter((it) => open[it.id])
      .map((it) => ({ id: it.id, title: it.title, minimized: minimized[it.id] })),
  ];

  return (
    <div className="app-shell">
      {isDevRoute && (
        <>
          <div className="dev-launch-bar">
            <button
              type="button"
              className="dev-launch-btn"
              onClick={launchDevFromStart}
            >
              Dev: запустить сначала
            </button>
            <button
              type="button"
              className="dev-launch-btn"
              onClick={openPlayerViewFromStart}
            >
              Открыть игру с нуля
            </button>
            <button
              type="button"
              className="dev-launch-btn"
              onClick={launchDevAtAdventurePrompt}
            >
              Dev: к приключению
            </button>
            <button
              type="button"
              className="dev-launch-btn dev-launch-btn--ghost"
              onClick={openPlayerView}
            >
              Открыть чистую игру
            </button>
            <button
              type="button"
              className="dev-launch-btn dev-launch-btn--ghost"
              onClick={resetPlayerProgress}
            >
              Сбросить прогресс игрока
            </button>
          </div>
          <DevEditorPanel
            visible={editorVisible}
            onToggle={() => setEditorVisible((prev) => !prev)}
            config={editorConfig}
            content={editorContent}
            onConfigChange={setEditorConfig}
            onContentChange={setEditorContent}
            onSaveDraft={saveEditorDraft}
            onRestoreLastSnapshot={restoreLastEditorSnapshot}
            onDownloadScenarioJson={downloadEditorScenarioJson}
            onImportScenarioJson={importEditorScenarioJson}
            onResetDraft={() => {
              const nextConfig = normalizeEditorConfig(STORY_EDITOR_CONFIG, STORY_EDITOR_CONFIG);
              const nextContent = normalizeEditorContent(STORY_CONTENT, STORY_CONTENT);
              setEditorConfig(nextConfig);
              setEditorContent(nextContent);
              setEditorDraftSavedAt(null);
              setEditorAutoSavedAt(null);
              setEditorLastGoodSavedAt(null);
              setEditorSnapshots([]);
              setEditorDraftBaseline(JSON.stringify({
                config: nextConfig,
                content: nextContent,
              }));
              clearLegacyEditorStorage();
            }}
            savedAt={editorDraftSavedAt}
            autoSavedAt={editorAutoSavedAt}
            lastGoodSavedAt={editorLastGoodSavedAt}
            snapshotCount={editorSnapshots.length}
            hasUnsavedChanges={hasUnsavedEditorChanges}
            issues={validationIssues}
          />
        </>
      )}
      {view === 'prologue' ? (
        <div className="prologue-screen" key="prologue" onClick={handlePrologueClick} role="presentation">
          <div className="prologue-box">
            <div className="prologue-text">
              {prologueStarted ? PROLOGUE_TEXT.slice(0, prologueIndex) : ''}
              {prologueStarted && !prologueDone && <span className="prologue-caret" aria-hidden="true" />}
            </div>
          </div>
        </div>
      ) : view === 'ending' ? (
        <div className="prologue-screen" key="ending" role="presentation">
          <div className="prologue-box">
            <div className="prologue-text">
              {endingStarted ? TERMINAL_PROTOCOL_ENDING_TEXT.slice(0, endingIndex) : ''}
              {endingStarted && !endingDone && <span className="prologue-caret" aria-hidden="true" />}
            </div>
          </div>
        </div>
      ) : view === 'landing' ? (
        <div className="landing" key="landing">
          <div className="landing-card">
            <img src={logo} alt="FOMO" className="landing-logo" />
            <div className="landing-title">FOMO</div>
            <div className="landing-content">
              {landingInfo.length > 0 && (
                <div className="landing-intro-card">
                  <p className="landing-text">{landingInfo[0]}</p>
                </div>
              )}
              {landingInfo.slice(1).map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 12)}`} className="landing-text">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
          {showNotif && (
            <button
              className={`toast${toastLeaving ? ' toast-leave' : ''}`}
              onClick={openDesktop}
              type="button"
            >
              <div className="toast-title">Мессенджер</div>
              <div className="toast-body">{notifVariant === 'initial' ? 'МЕТЕОРИТ ПО БАШКЕ' : 'Текст уведомления будет добавлен'}</div>
            </button>
          )}
        </div>
      ) : (
        <div className="desktop-frame" ref={frameRef} key="desktop">
          {screenFlashActive && <div className="screen-flash" aria-hidden="true" />}
          {persistentNotifs.length > 0 && (
            <div className="toast-stack">
              {persistentNotifs.map((notif, index) => (
                <button
                  key={notif.id}
                  className={`toast toast--stacked${notif.appId === 'app5' ? ' toast--conveyor' : ''}`}
                  style={{
                    position: 'absolute',
                    right: '22px',
                    bottom: `${22 + ((persistentNotifs.length - 1 - index) * 88)}px`,
                    zIndex: 100 + index,
                  }}
                  type="button"
                  onClick={() => handlePersistentNotifClick(notif)}
                >
                  <div className="toast-title">{notif.title}</div>
                  <div className="toast-body">{notif.text}</div>
                </button>
              ))}
            </div>
          )}
          <div className="desktop" ref={desktopRef}>
            <div className="icons">
              {icons.map((it) => (
                <DesktopIcon
                  key={it.id}
                  {...it}
                  pos={positions[it.id]}
                  onMouseDown={onIconMouseDown}
                  onOpen={openWindow}
                  onMeasure={handleIconMeasure}
                />
              ))}
            </div>

            {icons.map((it) => (
              <DesktopWindow
                key={it.id}
                {...it}
                img={getAppType(it.id) === 'calendar' ? null : it.img}
                hideTitle={
                  getAppType(it.id) === 'terminal'
                  || getAppType(it.id) === 'work-conveyor'
                  || getAppType(it.id) === 'notes'
                  || getAppType(it.id) === 'social'
                  || getAppType(it.id) === 'calendar'
                }
                className={getAppType(it.id) === 'terminal'
                  ? 'window--terminal'
                  : getAppType(it.id) === 'work-conveyor'
                    ? 'window--conveyor'
                  : getAppType(it.id) === 'messenger'
                    ? 'window--messenger'
                    : getAppType(it.id) === 'calendar'
                      ? 'window--calendar'
                    : ''}
                visible={!!open[it.id] && !minimized[it.id]}
                size={winState[it.id].size}
                pos={winState[it.id].pos}
                zIndex={winState[it.id].z}
                onClose={(id) => {
                  if (id === 'app7') {
                    window.alert('Терминал нельзя закрыть.');
                    return;
                  }
                  closeWindow(id);
                }}
                onMinimize={minimizeWindow}
                onStartResize={(e, id, dir) => onWindowStartResize(e, id, dir)}
                onStartMove={(e, id) => onWindowStartMove(e, id)}
                onFocus={bringToFront}
                body={
                  <AppWindowContent
                    appType={getAppType(it.id)}
                    editorContent={editorContent}
                    storyState={storyState}
                    onCompleteTerminalLine={completeTerminalLine}
                    terminalPrompt={storyState.terminal?.prompt || null}
                    onAcceptTerminalPrompt={acceptAdventureTerminalPrompt}
                    onRejectTerminalPrompt={rejectAdventureTerminalPrompt}
                    onResetTerminalPrompt={resetAdventureTerminalPrompt}
                    activeWorkTaskId={activeWorkTaskId}
                    workSubmitFeedback={workSubmitFeedback}
                    onSelectWorkTask={selectWorkTask}
                    onTypeWorkTaskKey={typeWorkTaskKey}
                    onSubmitWorkTask={submitWorkTaskWithFeedback}
                    renderNotesBody={renderNotesBody}
                    renderMessengerBody={renderMessengerBody}
                    renderCalendarBody={renderCalendarBodyDesktop}
                    renderSocialBody={renderSocialBody}
                    renderExitBody={renderExitBody}
                  />
                }
              />
            ))}
          </div>
          <div className="taskbar">
            <button type="button" className="taskbar-start">
              Пуск
            </button>
            <div className="taskbar-tabs">
              {taskbarTabs.length === 0 ? (
                <div className="taskbar-empty" aria-hidden="true">
                  —
                </div>
              ) : (
                  taskbarTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`taskbar-tab${tab.minimized ? ' is-minimized' : ''}`}
                      onClick={() => {
                        setMinimized((p) => ({ ...p, [tab.id]: false }));
                        bringToFront(tab.id);
                      }}
                    >
                      {tab.title}
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;





