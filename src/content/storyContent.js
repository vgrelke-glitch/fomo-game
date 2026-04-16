import { buildStoryContentFromSchema, STORY_SCHEMA_V2 } from './storySchemaV2';

export const STORY_CONTENT_VERSION = STORY_SCHEMA_V2.meta.contentVersion;
export const STORY_CONTENT = buildStoryContentFromSchema(STORY_SCHEMA_V2);

export { STORY_SCHEMA_V2 };
