# 18: Gap detection and Gap popup

**What to build:** After sleep, wake or a closed app, the user gets one Gap popup for the time nobody logged.

**Blocked by:** 16 Popup with the backward-looking rule

**Status:** resolved

- [x] TypeScript computes the Gap from the tick event. It starts at the later of the last Entry end and the last answered or skipped popup, and cuts out lunch and time outside work hours. With no Gap longer than the popup interval plus a small margin, no Gap popup shows.
- [x] Only the current workday can produce a Gap popup.
- [x] Inside work hours the Gap popup shows at once and replaces the normal tick. Outside work hours it waits for the next start of work hours.
- [x] A accepts the Gap as one Entry. S splits it at times the user gives, and each part has a Category and description. L leaves it empty. The previous Entry shows as a chip. The app saves nothing until the user answers.
- [x] TypeScript tests cover the Gap computation.
