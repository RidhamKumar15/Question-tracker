# CodeTrail

A static, GitHub Pages-ready coding question tracker for day-wise FAANG interview prep.

## Features

- Day-wise roadmap cards with linked LeetCode and GFG problems
- Checkbox completion tracking saved in `localStorage`
- Overall progress bar and per-day progress indicators
- Search by question, topic, or week
- Filters for day and completion status
- Responsive dark UI with smooth transitions

## Run Locally

```bash
python3 -m http.server 5173
```

Open `http://127.0.0.1:5173/`.

## Deploy on GitHub Pages

1. Push this repository to GitHub.
2. Open repository `Settings`.
3. Go to `Pages`.
4. Choose `Deploy from a branch`.
5. Select the branch and root folder.

The app is fully static and does not require a build step.
