# COS-Career Opportunities with Science | Career & Admissions

This dashboard serves Class 12 science students preparing for the 2027 intake. Students can browse career paths, take a nine-question exploration quiz, filter entrance exam routes, open official application forms, and compare historical college cutoffs. The quiz uses two interest questions and seven short sample tasks. It keeps responses in the browser tab.

## Publish on GitHub Pages

1. Create a GitHub repository or use the academy’s existing repository. Upload this ZIP’s extracted contents to its `main` branch. Keep the `docs` and `backend` directories at the repository root.
2. Under **Settings → Pages**, set **Source** to **Deploy from a branch**, select `main` and `/docs`, and save. Only the `docs` directory is served by GitHub Pages.
3. Visit the published Pages URL and test the career quiz, exam filters and official links. The admissions dashboard works as soon as Pages is published.

[GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

## Enable weekend counselling

1. Follow the [booking setup](backend/README.md) to deploy the Google Apps Script web app with a private Google Sheet and configure the owner email and Meta WhatsApp Business alerts.
2. Set `bookingUrl` in `docs/config.js` to the deployed Apps Script `/exec` URL and push the change. The dashboard opens the booking page in a new tab.
3. Submit one test booking, verify the Google Sheet reservation and both alerts, and cancel that test slot in the Sheet. For live reservations, create the Calendar event and Google Meet manually using the student email in the private Sheet.

The booking calendar offers four starts per window on Saturdays and Sundays, in India Standard Time. Morning starts are 11:00, 11:40, 12:20 and 13:00. Afternoon starts are 16:00, 16:40, 17:20 and 18:00. Each session lasts 40 minutes.

## Update the admissions data

Edit `docs/admissions.js` and update `checkedOn` after verifying notices. Use the current-cycle portal or notice for every `Open` or `Upcoming` label. Keep previous-year fees explicitly dated and include the quota, category, round and metric for historical college benchmarks. Update the form-filling session date and checklist in `docs/index.html` when the event changes. Maharashtra and major national routes are the primary focus.

## Run locally

From the extracted folder, open `docs/index.html` in a browser or serve `docs` with `python -m http.server 8765 --directory docs`. Run the mocked booking tests with `node --test backend/booking.test.cjs`.
