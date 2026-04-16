import meta from './schema/v2/meta.json';
import apps from './schema/v2/apps.json';
import acts from './schema/v2/acts.json';
import chats from './schema/v2/chats.json';
import assets from './schema/v2/assets.json';
import evidence from './schema/v2/evidence.json';
import appData from './schema/v2/appData.json';
import sequences from './schema/v2/sequences.json';
import act1Scenes from './schema/v2/scenes/act1.json';

const groupScenesByChat = (scenes) => (
  scenes.reduce((acc, scene) => {
    if (!scene.chatId) return acc;
    if (!acc[scene.chatId]) {
      acc[scene.chatId] = [];
    }
    acc[scene.chatId].push(scene);
    return acc;
  }, {})
);

const buildMessengerScripts = (chatList, scenes) => {
  const scenesByChat = groupScenesByChat(scenes);

  return Object.fromEntries(
    chatList.map((chat) => {
      const scriptScenes = scenesByChat[chat.id] || [];
      return [chat.id, {
        id: chat.id,
        title: chat.title,
        startSceneId: scriptScenes[0]?.id || '',
        scenes: scriptScenes,
      }];
    })
  );
};

export const STORY_SCHEMA_V2 = {
  meta,
  apps,
  acts,
  chats,
  assets,
  evidence,
  appData,
  sequences,
  scenes: [
    ...act1Scenes
  ],
};

export const buildStoryContentFromSchema = (schema) => ({
  version: schema.meta.contentVersion,
  apps: schema.apps.map((app) => ({
    id: app.id,
    title: app.title,
  })),
  messenger: {
    chats: schema.chats,
    scripts: buildMessengerScripts(schema.chats, schema.scenes),
  },
  appData: schema.appData,
  sequences: schema.sequences,
  schemaV2: schema,
});
