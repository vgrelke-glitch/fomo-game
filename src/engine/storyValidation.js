export const validateStoryContent = (content, editorConfig) => {
  const issues = [];
  const appIds = new Set();
  const sequenceIds = new Set((content?.sequences || []).map((sequence) => sequence.id));
  const scriptEventIds = new Set();
  const sceneIdsByChat = new Map();

  (editorConfig?.apps || []).forEach((app) => {
    if (!app.id) {
      issues.push({ level: 'error', path: 'apps', message: 'App without id' });
      return;
    }
    if (appIds.has(app.id)) {
      issues.push({ level: 'error', path: `apps.${app.id}`, message: 'Duplicate app id' });
    }
    appIds.add(app.id);
  });

  Object.entries(content?.messenger?.scripts || {}).forEach(([chatId, script]) => {
    const scenes = script?.scenes || [];
    const sceneIds = new Set();

    scenes.forEach((scene, sceneIndex) => {
      if (!scene.id) {
        issues.push({
          level: 'error',
          path: `messenger.scripts.${chatId}.scenes.${sceneIndex}`,
          message: 'Scene without id',
        });
        return;
      }

      if (sceneIds.has(scene.id)) {
        issues.push({
          level: 'error',
          path: `messenger.scripts.${chatId}.scenes.${sceneIndex}`,
          message: `Duplicate scene id: ${scene.id}`,
        });
      }
      sceneIds.add(scene.id);

      (scene.events || []).forEach((event, eventIndex) => {
        if (!event.id) {
          issues.push({
            level: 'error',
            path: `messenger.scripts.${chatId}.scenes.${sceneIndex}.events.${eventIndex}`,
            message: 'Event without id',
          });
          return;
        }
        if (scriptEventIds.has(event.id)) {
          issues.push({
            level: 'error',
            path: `messenger.scripts.${chatId}.scenes.${sceneIndex}.events.${eventIndex}`,
            message: `Duplicate event id: ${event.id}`,
          });
        }
        scriptEventIds.add(event.id);
      });
    });

    sceneIdsByChat.set(chatId, sceneIds);

    if (script.startSceneId && !sceneIds.has(script.startSceneId)) {
      issues.push({
        level: 'error',
        path: `messenger.scripts.${chatId}.startSceneId`,
        message: `Unknown startSceneId: ${script.startSceneId}`,
      });
    }
  });

  Object.entries(content?.messenger?.scripts || {}).forEach(([chatId, script]) => {
    const scenes = script?.scenes || [];
    const sceneIds = sceneIdsByChat.get(chatId) || new Set();

    scenes.forEach((scene, sceneIndex) => {
      if (scene.nextSceneId && !sceneIds.has(scene.nextSceneId)) {
        issues.push({
          level: 'error',
          path: `messenger.scripts.${chatId}.scenes.${sceneIndex}.nextSceneId`,
          message: `Unknown nextSceneId: ${scene.nextSceneId}`,
        });
      }

      (scene.events || []).forEach((event, eventIndex) => {
        if (event.waitForEventId && !scriptEventIds.has(event.waitForEventId)) {
          issues.push({
            level: 'error',
            path: `messenger.scripts.${chatId}.scenes.${sceneIndex}.events.${eventIndex}.waitForEventId`,
            message: `Unknown waitForEventId: ${event.waitForEventId}`,
          });
        }
        const eventEffects = [
          ...(event.type === 'effect' ? (event.effects || []) : []),
          ...(event.type === 'message_player' ? (event.onFocusEffects || []) : []),
          ...(event.type === 'message_player' ? (event.onSendEffects || []) : []),
        ];

        eventEffects.forEach((effect, effectIndex) => {
          if ((effect.type === 'openApp' || effect.type === 'focusApp' || effect.type === 'showNotification') && effect.appId && !appIds.has(effect.appId)) {
            issues.push({
              level: 'error',
              path: `messenger.scripts.${chatId}.scenes.${sceneIndex}.events.${eventIndex}.effects.${effectIndex}.appId`,
              message: `Unknown appId: ${effect.appId}`,
            });
          }
          if (effect.type === 'queueSequence' && effect.sequenceId && !sequenceIds.has(effect.sequenceId)) {
            issues.push({
              level: 'error',
              path: `messenger.scripts.${chatId}.scenes.${sceneIndex}.events.${eventIndex}.effects.${effectIndex}.sequenceId`,
              message: `Unknown sequenceId: ${effect.sequenceId}`,
            });
          }
          if (effect.type === 'pushTerminalLine' && !appIds.has('app7')) {
            issues.push({
              level: 'error',
              path: `messenger.scripts.${chatId}.scenes.${sceneIndex}.events.${eventIndex}.effects.${effectIndex}`,
              message: 'Terminal app app7 is missing',
            });
          }
        });
      });
    });
  });

  (content?.sequences || []).forEach((sequence) => {
    (sequence.steps || []).forEach((step, index) => {
      if (step.appId && !appIds.has(step.appId)) {
        issues.push({
          level: 'error',
          path: `sequences.${sequence.id}.steps.${index}`,
          message: `Unknown appId: ${step.appId}`,
        });
      }
      if (step.sequenceId && !sequenceIds.has(step.sequenceId)) {
        issues.push({
          level: 'error',
          path: `sequences.${sequence.id}.steps.${index}`,
          message: `Unknown sequenceId: ${step.sequenceId}`,
        });
      }
      if (step.type === 'deliverChatEvent') {
        const chatScript = content?.messenger?.scripts?.[step.chatId];
        const hasEvent = (chatScript?.scenes || []).some((scene) => (
          (scene.events || []).some((event) => event.id === step.eventId)
        ));
        if (!content?.messenger?.scripts?.[step.chatId]) {
          issues.push({
            level: 'error',
            path: `sequences.${sequence.id}.steps.${index}`,
            message: `Unknown chatId: ${step.chatId}`,
          });
        } else if (!hasEvent) {
          issues.push({
            level: 'error',
            path: `sequences.${sequence.id}.steps.${index}`,
            message: `Unknown eventId for chat ${step.chatId}: ${step.eventId}`,
          });
        }
      }
    });
  });

  return issues;
};
