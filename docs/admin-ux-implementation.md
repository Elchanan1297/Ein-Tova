# Admin UI redesign

Implement this redesign in the Angular admin interface. The goal is to make administration easier to scan and operate during the event by giving data-heavy screens room, replacing the crowded top navigation, and making each settings task easy to find.

This brief is English-only. Keep the product UI in its existing Hebrew RTL layout, with existing labels where they still fit. Use natural Hebrew for any new visible labels and accessible names.

## 1. Use the available viewport

- Start in `web/src/app/features/admin/layout/admin-shell.ts`. Replace the shell-wide 960px content cap with a flexible main area that fills the space beside the sidebar. Use responsive gutters and allow the content column to shrink as needed.
- Give the dashboard, guest and question tables, and photo management the available width. Keep individual forms, dialogs, prose, and controls at a comfortable reading and interaction width. On wide screens, use multiple columns for related fields when they fit.
- At phone and tablet widths, let content reflow. If a wide table needs horizontal scrolling, confine it to the table container. Check overflow with long labels, chart legends, and validation messages.

## 2. Replace the top link row with a right-side navigation panel

- Keep the existing admin destinations and their URLs. Keep the brand link and sign-out reachable. Use the existing router and active-link behavior, including active parent highlighting on nested Content routes.
- On desktop, show labeled navigation by default. Provide an explicit button to collapse and reopen it, and give the reclaimed width back to the main area. If navigation remains visible as icons when collapsed, each destination must still have an accessible name and a label discoverable by pointer and keyboard.
- On phone and tablet layouts where a sidebar would crowd the page, open it as an overlay using a button in the compact header. Close it on destination selection, Escape, backdrop click, or the close button. While open, manage focus and prevent interaction with the background. Restore focus to the trigger when dismissed without navigation. After navigation, make focus land at a predictable point in the destination.
- Use RTL-aware positioning and logical CSS properties. Expose the toggle's expanded state and the current destination to assistive technology. All navigation must work by click, tap, and keyboard.

## 3. Split Settings and Game into local tabs

Keep `/admin/settings` as a single settings workflow. Default to Game Availability and display one panel at a time. Keep the tabs visually distinct from sidebar navigation. Let tab labels wrap or use a locally scrollable tab strip on narrow screens, with the selected tab kept in view.

| Tab | Existing controls |
| --- | --- |
| Game Availability | Live game status and counts, Open Now and Close Now, game mode, and conditional opening and closing times |
| Question Settings | Question count and active-question guidance, facts title count, time per question, and additional phone time |
| Voices and Leaderboard | Voice probability and family ranking, with network grace time under the existing Advanced disclosure |
| AI Insights | Enable switch, hourly call limit, and existing guidance |
| Maintenance | Game reset, its consequences, the current started count when available, and the existing single-guest reset guidance |

- Use accessible tab semantics and keyboard interaction. Ensure only the active panel is available to keyboard and assistive technology, and make arrow navigation follow the visual RTL order.
- Keep a single settings draft, saved baseline, and save/cancel bar across all tabs. Switching tabs must preserve edits and must not save, refetch settings, or reset the dirty state. Save must send only changed fields across the entire form. Cancel must restore the saved baseline. Keep unsaved changes and save results visible whichever tab is selected.
- Preserve the immediate Open Now and Close Now actions. They must update game mode without saving or overwriting unrelated draft changes. Preserve load, retry, busy, and error handling, along with the existing date and numeric conversions and validation rules.
- `settings-page.ts` reads question and player counts and triggers refresh through `viewChild(GameStatsPanel)`. Keep that live data and the refresh path available across tab changes. For example, keep the stats component mounted inside the hidden Game Availability panel, or move the data to the settings page and pass it to the panel.
- When a save error identifies a field, reveal its tab and any collapsed section containing it, then make the field easy to locate. Keep the error readable and announced even when it came from a different tab.
- Preserve the reset confirmation and cancellation flow. Disarm confirmation when leaving Maintenance so returning to it never leaves a destructive action armed. Verify reset with isolated test data only.

## 4. Improve spacing and status feedback

- Use consistent spacing for headings, groups, fields, and actions. Leave larger gaps between groups than between a label, its control, and helper text. Keep mobile forms single-column where needed. Give buttons enough space to wrap without collisions.
- Fit the save bar within the settings content area, including with the sidebar expanded. Make it usable on narrow screens and reserve space for it so it does not cover the final field, a message, or the reset controls. Respect mobile safe-area insets.
- Keep the existing logo, midnight/gold/cream palette, typography, and glass treatment. Use gold for primary actions, selection, and brand emphasis. Use distinct semantic colors for success, warning, and error/destructive states where they improve comprehension. Apply them to existing feedback such as save results, question-count warnings, and reset.
- Pair status color with text and, where helpful, an icon from the existing icon component. Check readable contrast against dark and translucent surfaces, including focus and active states. Honor reduced-motion preferences.

## Scope and code entry points

Paths are relative to the project directory containing `CLAUDE.md`.

- `web/src/app/features/admin/layout/admin-shell.ts` owns the shell, navigation, and sign-out.
- `web/src/app/features/admin/admin.routes.ts` defines the existing destinations. Preserve route guards, the default settings redirect, login, and the standalone Save the Date preview.
- `web/src/app/features/admin/settings/settings-page.{ts,html,scss}` owns the settings form and actions. Reuse the existing loader, controls, and API methods. Follow the standalone, OnPush, and Signals conventions.
- `web/src/app/features/admin/settings/ui/game-stats.ts` supplies live stats used in multiple settings sections.
- `web/src/styles/tokens.css` and `web/src/styles/glass.css` define the theme. Scope new layout and status rules to admin where possible. The dashboard also renders for guests, so keep admin-specific width or spacing changes in the admin shell or wrapper.
- Keep the implementation frontend-only. Preserve API contracts, game behavior, the guest interface, and the presentation. Work with existing local changes and avoid unrelated cleanup or new dependencies.

## Acceptance checks

Run `npm run build` from `web/`. Verify in a browser at a narrow phone width, in iPad mini portrait and landscape, and at a wide desktop size. Check the following against the normal admin entry points.

1. Direct URLs, sidebar links, browser Back, nested Content navigation, sign-out, and standalone preview still work.
2. The desktop sidebar collapses and returns usable width to the page. The mobile overlay opens and closes by touch and keyboard, restores focus on dismissal, and leaves no horizontal page overflow. Dashboard and table views can use the added space.
3. Only one settings panel is shown at a time. Keyboard users can reach every tab and control, and focus and selected indicators remain clear in RTL.
4. Edit fields on two tabs, switch between them, and save. Verify that one save sends only the changed fields and that the values persist after reload. Repeat with Cancel and verify that both edits revert. Trigger a save failure associated with a field on another tab and verify the error and field are reachable.
5. With an unsaved edit on a different tab, exercise Open Now or Close Now in a development environment. Verify that only game mode is applied immediately, the draft remains editable, and live stats still refresh. Check that question guidance and Maintenance counts still appear after switching tabs.
6. In isolated test data, verify the first reset click only arms confirmation. Verify cancellation and leaving Maintenance both disarm it. Verify the confirmed reset updates the status and stats.
7. Verify that the save bar stays readable and reachable without covering controls. Check that success, warning, error, and destructive feedback remain understandable without relying on color.

Report the changes, verification performed, and any checks that could not be completed.
