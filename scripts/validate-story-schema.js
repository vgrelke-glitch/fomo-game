const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const schemaRoot = path.join(root, 'src', 'content', 'schema', 'v2');

const readJson = (relativePath) => {
  const fullPath = path.join(schemaRoot, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
};

const meta = readJson('meta.json');
const apps = readJson('apps.json');
const acts = readJson('acts.json');
const chats = readJson('chats.json');
const sequences = readJson('sequences.json');
const appData = readJson('appData.json');
const act1Scenes = readJson(path.join('scenes', 'act1.json'));

const errors = [];
const warnings = [];

const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const warn = (condition, message) => {
  if (!condition) warnings.push(message);
};

const unique = (items, label) => {
  const seen = new Set();
  items.forEach((item) => {
    if (seen.has(item)) {
      errors.push(`Duplicate ${label}: ${item}`);
    }
    seen.add(item);
  });
};

assert(meta.version === 2, 'meta.version must be 2');
assert(typeof meta.contentVersion === 'number', 'meta.contentVersion must be a number');

unique(apps.map((app) => app.id), 'app id');
unique(acts.map((act) => act.id), 'act id');
unique(chats.map((chat) => chat.id), 'chat id');
unique(sequences.map((sequence) => sequence.id), 'sequence id');
unique(act1Scenes.map((scene) => scene.id), 'scene id');

const appIds = new Set(apps.map((app) => app.id));
const actIds = new Set(acts.map((act) => act.id));
const chatIds = new Set(chats.map((chat) => chat.id));
const hiddenChatIds = new Set(chats.filter((chat) => chat.hiddenByDefault).map((chat) => chat.id));
const sceneIds = new Set(act1Scenes.map((scene) => scene.id));
const eventIds = new Set();
const sceneEventsByChat = new Map();

const supportedSequenceTypes = new Set([
  'openApp',
  'focusApp',
  'setFlag',
  'showNotification',
  'pushTerminalLine',
  'startWorkTask',
  'unlockChat',
  'deliverChatEvent',
]);

const supportedEffectTypes = new Set([
  'openApp',
  'focusApp',
  'showNotification',
  'pushTerminalLine',
  'setFlag',
  'queueSequence',
  'unlockChat',
]);

act1Scenes.forEach((scene) => {
  assert(actIds.has(scene.actId), `Scene ${scene.id} references unknown actId ${scene.actId}`);
  if (scene.chatId) {
    assert(chatIds.has(scene.chatId), `Scene ${scene.id} references unknown chatId ${scene.chatId}`);
  }
  if (scene.nextSceneId) {
    assert(sceneIds.has(scene.nextSceneId), `Scene ${scene.id} references unknown nextSceneId ${scene.nextSceneId}`);
  }

  (scene.events || []).forEach((event) => {
    assert(event.id, `Scene ${scene.id} has event without id`);
    if (event.id) {
      assert(!eventIds.has(event.id), `Duplicate event id ${event.id}`);
      eventIds.add(event.id);
      if (scene.chatId) {
        if (!sceneEventsByChat.has(scene.chatId)) {
          sceneEventsByChat.set(scene.chatId, new Set());
        }
        sceneEventsByChat.get(scene.chatId).add(event.id);
      }
    }

    if (event.type === 'message_other' || event.type === 'message_player') {
      assert(typeof event.text === 'string' && event.text.length > 0, `Event ${event.id} must have text`);
    }

    const effectLists = [];
    if (event.type === 'effect') effectLists.push(event.effects || []);
    if (event.type === 'message_player') {
      effectLists.push(event.onFocusEffects || []);
      effectLists.push(event.onSendEffects || []);
    }

    effectLists.flat().forEach((effect) => {
      assert(supportedEffectTypes.has(effect.type), `Event ${event.id} uses unsupported effect type ${effect.type}`);
      if (effect.appId) {
        assert(appIds.has(effect.appId), `Event ${event.id} references unknown appId ${effect.appId}`);
      }
      if (effect.chatId) {
        assert(chatIds.has(effect.chatId), `Event ${event.id} references unknown chatId ${effect.chatId}`);
      }
    });

    if (event.schema?.choice) {
      const options = event.schema.choice.options || [];
      assert(options.length >= 2, `Choice event ${event.id} must have at least 2 options`);
      unique(options.map((option) => `${event.id}:${option.id}`), 'choice option id');
      options.forEach((option) => {
        assert(option.id, `Choice option in ${event.id} must have id`);
        assert(option.label, `Choice option ${event.id}:${option.id} must have label`);
      });
    }
  });
});

sequences.forEach((sequence) => {
  (sequence.steps || []).forEach((step, index) => {
    assert(supportedSequenceTypes.has(step.type), `Sequence ${sequence.id} step ${index} uses unsupported type ${step.type}`);
    if (step.appId) {
      assert(appIds.has(step.appId), `Sequence ${sequence.id} step ${index} references unknown appId ${step.appId}`);
    }
    if (step.chatId) {
      assert(chatIds.has(step.chatId), `Sequence ${sequence.id} step ${index} references unknown chatId ${step.chatId}`);
    }
    if (step.type === 'deliverChatEvent') {
      const chatEventIds = sceneEventsByChat.get(step.chatId) || new Set();
      assert(step.eventId, `Sequence ${sequence.id} step ${index} must define eventId for deliverChatEvent`);
      assert(chatEventIds.has(step.eventId), `Sequence ${sequence.id} step ${index} references unknown eventId ${step.eventId} for chat ${step.chatId}`);
    }
  });
});

hiddenChatIds.forEach((chatId) => {
  const isUnlockedSomewhere = sequences.some((sequence) => (
    (sequence.steps || []).some((step) => step.type === 'unlockChat' && step.chatId === chatId)
  ));
  warn(isUnlockedSomewhere, `Hidden chat ${chatId} is not unlocked by any sequence yet`);
});

warn(
  Array.isArray(appData?.workConveyor?.seedTasks) && appData.workConveyor.seedTasks.length > 0,
  'No seed work tasks found in appData.workConveyor.seedTasks'
);

const summary = [
  `meta.version=${meta.version}`,
  `apps=${apps.length}`,
  `acts=${acts.length}`,
  `chats=${chats.length}`,
  `sequences=${sequences.length}`,
  `act1_scenes=${act1Scenes.length}`,
  `act1_events=${eventIds.size}`,
].join(', ');

if (errors.length > 0) {
  console.error('Story schema validation failed.');
  console.error(summary);
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  warnings.forEach((warning) => console.error(`WARN: ${warning}`));
  process.exit(1);
}

console.log('Story schema validation passed.');
console.log(summary);
warnings.forEach((warning) => console.log(`WARN: ${warning}`));
