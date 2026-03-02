# DankSite — Interactive CLI Portfolio

An interactive terminal-style portfolio website that emulates the Claude Code CLI experience. Built with vanilla HTML/CSS/JS — no build step, no dependencies, just GitHub Pages.

## 🚀 Live Site

Visit: `https://dwdankworth.github.io/DankSite`

## 🖥️ Features

- **Interactive terminal** — type commands and see streaming LLM-style responses
- **Claude-inspired theme** — warm beige/orange on dark navy
- **Token-by-token streaming** — text appears progressively like an AI responding
- **Command history** — up/down arrows to cycle through previous commands
- **Tab autocomplete** — start typing and press Tab to complete
- **Easter eggs** — try `sudo`, `coffee`, `matrix`, and more 👀
- **Mobile support** — tappable command chips on small screens
- **Zero build step** — pure HTML/CSS/JS, deploys directly to GitHub Pages

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `help` | Show all available commands |
| `bio` | About me — education, experience, interests |
| `projects` | List all projects |
| `project <n>` | Details on a specific project |
| `skills` | Technical skills breakdown |
| `contact` | How to reach me |
| `clear` | Clear the terminal |

## ✏️ Customizing Content

All content lives in **`data/content.json`**. Edit this single file to update:

- Your name and title
- Bio sections (education, experience, interests)
- Projects (title, description, tech stack, links)
- Skills (categorized)
- Contact links (GitHub, LinkedIn, email, Twitter/X)

Placeholder text is marked with `[PLACEHOLDER]` — search and replace with your real info.

## 🛠️ Local Development

Just open `index.html` in a browser. No server required for basic testing.

For live reload during development:
```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```

## 📦 Deploying to GitHub Pages

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Under "Source", select **Deploy from a branch**
4. Choose `main` branch and `/ (root)` folder
5. Click **Save** — your site will be live in ~1 minute

### Custom Domain (Optional)

1. Add a `CNAME` file with your domain: `echo "yourdomain.com" > CNAME`
2. Configure DNS with your registrar (A records or CNAME)
3. In GitHub Pages settings, enter your custom domain

## 📄 License

MIT
