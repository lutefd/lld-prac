# Settings

Users change theme, interface language (en / pt-BR), editor options, and text size; choices persist in the browser.

## Sub-features

- `settings-defaults` browser locale and system theme are the defaults.
- `settings-override` explicit theme/language choices persist across reload.
- `settings-no-reset` changing settings does not replace the open workspace.

## How to get to it (user POV)

- Click the `Settings` button (`Configurações` in Portuguese) on the roadmap or practice toolbar; dialog named `Settings`; close with `Close settings`.

## Driving it with Playwright

Preconditions: doctor exits 0.

- **Locale + theme.** Run `npx playwright test tests/e2e/preferences.spec.ts`. A `pt-BR`/light context shows `Pequenos passos. Projetos melhores.`; choosing `Escuro` sets `html[data-theme=dark]`; switching language to English and reloading keeps both.

## Gotchas

- Buttons are localized: use the label matching the current language.
- Screenshots (`test-results/roadmap-pt-light.png`) need `animations: "disabled"`.
