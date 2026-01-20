# TidyUp 🗂️

AI-powered file organizer. Open source. Your files never leave your machine.

Built at 3am. Couldn't sleep.

## What it does

Drop a folder → AI suggests organization → Review → Click organize.

```
📁 Downloads (chaos)
├── invoice-march.pdf
├── IMG_4521.jpg
├── song.mp3
├── notes.txt
└── setup.exe

       ↓ TidyUp ↓

📁 Downloads (organized)
├── Documents/
│   └── Finance/
│       └── invoice-march.pdf
├── Images/
│   └── Photos/
│       └── IMG_4521.jpg
├── Music/
│   └── song.mp3
├── Documents/
│   └── notes.txt
└── Installers/
    └── setup.exe
```

## Features

- **AI-powered** — Uses GPT-4o-mini to intelligently categorize files
- **Preview first** — Shows you the plan before moving anything
- **Undo anytime** — Made a mistake? One click to revert
- **Privacy first** — Your files never leave your machine. Only filenames are sent to OpenAI for analysis.
- **Open source** — Check the code yourself

## Install

### Download

[Download for macOS](https://github.com/sleepolym/tidyup/releases) · [Download for Windows](https://github.com/sleepolym/tidyup/releases) · [Download for Linux](https://github.com/sleepolym/tidyup/releases)

### Build from source

```bash
git clone https://github.com/sleepolym/tidyup.git
cd tidyup
npm install
npm start
```

## Setup

1. Get an OpenAI API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Enter your key in the app (stored locally, never shared)
3. Drop a folder and organize!

## Privacy

- **Files stay local** — Your actual files never leave your computer
- **Only metadata sent** — Only filenames and extensions are sent to OpenAI for analysis
- **Key stored locally** — Your API key is stored in your local app data
- **Open source** — Verify everything by reading the code

## Cost

Uses GPT-4o-mini (~$0.15 per 1M tokens). Organizing 100 files costs less than $0.01.

## Building

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

## License

MIT — do whatever you want.

---

*Built by [@sleepolym](https://twitter.com/sleepolym). Could change the world. Need a nap first. 💤*
