# Settings

Users change theme, interface language (en / pt-BR), editor theme, font and size, and interface text size; choices persist in the browser, not the account. Account settings are not here; they live on `/account` (see [Account](./account.md)).

## Sub-features

- `settings-defaults` browser locale and system theme are the defaults.
- `settings-override` explicit theme/language choices persist across reload.
- `settings-no-reset` changing settings does not replace the open workspace.
- `settings-workspace` on a practice page only, a `Workspace` section adds `Practice timer`, `Exercise library`, `Practice roadmap`, and `Reset this language's solution`.
- `settings-reset-defaults` `Reset defaults` resets editor theme, font, size, and interface text size; theme, language, and timer stay.

## How to get to it (user POV)

- Click the `Settings` button (`Configurações` in Portuguese). It is on the sign-in screen, roadmap, practice toolbar, `/account`, and not-found page. Dialog named `Settings`; close with `Close settings`, `Escape`, or a backdrop click.

## Driving it with Playwright

Preconditions: doctor exits 0.

- **Locale + theme.** Run `npx playwright test tests/e2e/preferences.spec.ts`. Each test signs up a fresh user first. A `pt-BR`/light context shows `Pequenos passos. Projetos melhores.`; choosing `Escuro` sets `html[data-theme=dark]`; switching language to English and reloading keeps both.

## Gotchas

- Buttons are localized: use the label matching the current language.
- Screenshots (`test-results/roadmap-pt-light.png`) need `animations: "disabled"`.
