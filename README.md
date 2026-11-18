# DBMS FAT Prep

DBMS: module priorities and FAT question papers.

## Features

| Page | What you get |
| --- | --- |
| **dbms** (home) | Module-wise priorities with the marks distribution. A topic name with a `link` opens its topic-wise page. |
| **fat** | The nine question papers (A1, A2, B1, B2, E1, F2), one tab per paper, transcribed as printed. A **paper** button on each question opens the scanned page at that question. Double-click a tab to open the original PDF. |
| **topic-wise** | Pick a module (marks shown on each tab), then **All** or a single topic to see every question asked on it. **Open** jumps to the paper. |
| **imp** | Important-notes pictures, plus the **keys** and **features** menus. |
| **distr** | Marks distribution. |

Also: View / Study toggle (ticks and progress saved in your browser), search (`/`), light / dark theme, offline after the first visit. On the topic-wise, imp and distr pages the page-switch buttons stay hidden and fade in as your mouse gets close.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `←` `→` | Home: previous / next module. Topic-wise: previous / next topic (starts at **All**). |
| `J` `K` | Home: next / previous topic card. |
| `Esc` or `Backspace` | Back to the home page from fat, topic-wise, imp, imp or distr. |
| `/` | Focus search. `Esc` in the box clears it. |
| `?` | On the imp page: show the shortcuts menu. |

## Project Structure

```
dbms-fat/
├── public/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js
│   │   └── api.js
│   ├── data/
│   │   ├── modules.json
│   │   ├── papers.json
│   │   └── topics.json
│   ├── papers/
│   │   ├── pdf/     original PDFs
│   │   ├── pages/   page scans for the paper viewer
│   │   └── fig/     diagrams cut from the papers
│   ├── sw.js
│   └── favicon.svg
├── scripts/
│   ├── dev-server.js
│   └── check.js
├── vercel.json
├── package.json
├── .gitignore
└── .editorconfig
```

## How to Run

Requires Node.js 16 or newer. There is nothing to install.

```bash
npm start
```

Then open http://localhost:3000. Run `npm test` before deploying to check the data and links.

## Editing the Data

- `papers.json`: the question papers.
- `modules.json`: module titles, marks and priorities. A topic's optional `link` names the topic-wise topic it opens.
- `topics.json`: topic-wise mapping, one entry per module. Each topic lists references like `B1-Q1(a)` (paper, question, optional part). Paper ids look like `A1-24-25`, so a reference is `A1-24-25-Q3(a)`.

`npm test` fails if any reference or link points at something that doesn't exist.
