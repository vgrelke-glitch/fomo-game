# Deploy

Проект подготовлен под Netlify, сайт `фомо-гейм`.

## Конфиг

Netlify берет настройки из `netlify.toml`:

- `Build command`: `npm run build`
- `Publish directory`: `build`
- SPA-роуты перенаправляются на `/index.html`
- `/static/*` и `/files/*` получают cache headers

Локальная привязка Netlify уже есть в `.netlify/state.json`.

## Перед отгрузкой

```bash
npm run story:check
npm run build
```

Готовая production-сборка лежит в `build`.

## Отгрузка

Если Netlify CLI установлен и авторизован:

```bash
netlify deploy --prod --dir=build
```

Если CLI не установлен, можно загрузить папку `build` вручную через Netlify Deploys для проекта `фомо-гейм`.
