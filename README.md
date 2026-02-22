# Wealthsimple Deepsearch Extension

## Setup

1. **Install with uv** (virtualenv is at `.venv`):

   ```bash
   uv sync
   ```

2. **Set your API keys** (see below for how to get them):

   ```bash
   export ANTHROPIC_API_KEY="your-anthropic-api-key"
   export PERPLEXITY_API_KEY="your-perplexity-api-key"
   export GOOGLE_API_KEY="your-google-api-key"
   ```

   Or create a `.env` file in the project root with:

   ```
   ANTHROPIC_API_KEY=your-anthropic-api-key
   PERPLEXITY_API_KEY=your-perplexity-api-key
   GOOGLE_API_KEY=your-google-api-key
   ```

   The Perplexity key is used by the `scoped_perplexity_search` tool. The Google key is used by the agent’s LiteLLM model (Gemini). See below for how to get each key.

### How to get an Anthropic API key

1. Go to **[API Keys](https://platform.claude.com/settings/keys)** on the Claude Developer Platform.
2. Sign in or create an Anthropic account if needed.
3. Click **Create Key**.
4. Give the key a name (e.g. “Wealthsimple Deepsearch”), then confirm.
5. Copy the key immediately—it starts with `sk-ant-` and is shown only once. If you lose it, you’ll need to create a new key.
6. Set it in your environment or in a `.env` file as `ANTHROPIC_API_KEY=sk-ant-...`.

### How to get a Perplexity API key

1. Go to **[API Keys](https://www.perplexity.ai/account/api/keys)** on your Perplexity account.
2. Sign in or create a Perplexity account if needed.
3. Click **Create API Key** (or equivalent).
4. Name the key if prompted, then create it.
5. Copy the key and store it securely—it may only be shown once.
6. Set it in your environment or in a `.env` file as `PERPLEXITY_API_KEY=...`.

### How to get a Google API key

The project uses the key with **Google AI Studio** (Gemini API). To get one:

1. Go to **[Google AI Studio](https://aistudio.google.com/)**.
2. Sign in with your Google account.
3. In the left sidebar, open **Get API key** (under “API keys” or “Get started”).
4. Click **Create API key** and choose an existing Google Cloud project or create a new one.
5. Copy the generated key (it may start with `AIza...`). Store it securely.
6. Set it in your environment or in a `.env` file as `GOOGLE_API_KEY=...`.

If you prefer to use a key from **Google Cloud Console** instead: go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials), create an API key, and enable the **Generative Language API** for the project.

## Run

### Gradio UI (run-agent)

Run the agent with the Gradio interface, then open the URL (e.g. http://127.0.0.1:7860) in your browser.

**With Make:**

```bash
make run-agent
```

**Or with uv directly:**

```bash
uv run python -m app.main
```

### FastAPI server (run-server)

Run the same agent as a headless HTTP API (e.g. for the Grease Monkey injector).

**With Make:**

```bash
make run-server
```

**Or with uv directly:**

```bash
uv run uvicorn app.server:app --host 0.0.0.0 --port 8000
```

Then call it with curl:

```bash
curl -X POST http://localhost:8000/run \
     -H "Content-Type: application/json" \
     -d '{"task": "What is the current stock price of Apple (AAPL)?"}'
```

- `GET /health` – health check
- `POST /run` – body `{"task": "your question"}` → `{"result": "..."}`

### Caching (SQLite)

Deep Search responses are cached in a local SQLite database keyed by **company** (parsed from the task’s `Company: ...` line). The next time you click Deep Research for the same company, the server returns the cached result instead of running the agent again.

- **Database location:** `data/deep_search.db` in the project root (created automatically). Override with `DEEPSEARCH_DB_PATH` (e.g. `export DEEPSEARCH_DB_PATH=/path/to/deep_search.db`).

## Models

### Gemini / gemini-2.0-flash

We use **Gemini 2.0 Flash** (`gemini/gemini-2.0-flash`) as the orchestrator model for the agent. It is cheap and fast, and a good starting point for tool-calling and reasoning over search and financial data.

### Anthropic

Anthropic cannot be used as the brain behind the agent because the rate limit set by Anthropic is too low for it to be useful.

### Perplexity

We use Perplexity (via the `scoped_perplexity_search` tool) because it scrapes the entire web and exposes a clean API that returns LLM-friendly results. It also has a partnership with Financial Modelling Prep, which makes it very useful when querying for basic financial information.

## Grease Monkey injector and agent server

The **grease_monkey** userscript runs in the browser (e.g. on Wealthsimple) and talks to the local agent server. Flow:

```
  ┌─────────────────────────────────────────────────────────────────┐
  │  Browser (e.g. Wealthsimple)                                     │
  │  ┌─────────────────────────────────────────────────────────────┐ │
  │  │  grease_monkey.user.js (Tampermonkey / Greasemonkey)         │ │
  │  │  • Injects "Deep Research" button (e.g. under About section)  │ │
  │  │  • User enters/confirms task → POST /run                      │ │
  │  │  • Renders streaming or final result in UI                    │ │
  │  └───────────────────────────┬─────────────────────────────────┘ │
  └──────────────────────────────┼───────────────────────────────────┘
                                 │
                                 │  HTTP  POST /run  {"task": "..."}
                                 │         GET /health
                                 ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  Agent server (uvicorn app.server:app --port 8000)                   │
  │  ┌─────────────────────────────────────────────────────────────┐ │
  │  │  FastAPI  • /health  • /run                                  │ │
  │  │  CodeAgent (Gemini 2.0 Flash) + tools                         │ │
  │  │    → scoped_perplexity_search, yfinance_*, generic_search…   │ │
  │  └─────────────────────────────────────────────────────────────┘ │
  └─────────────────────────────────────────────────────────────────┘
```

1. Install the userscript in Tampermonkey (or Greasemonkey) and ensure the agent server is running (`make run-server` or `uv run uvicorn app.server:app --host 0.0.0.0 --port 8000`).
2. Open a matching page; the script injects the button and checks `/health` to confirm the server is up.
3. User triggers Deep Research; the script sends the task to `POST /run` and displays the agent’s response.

### Where to find the Grease Monkey script

The userscript lives in this repo at:

**`wealthsimple_injector/grease_monkey.user.js`**

### Installing the script in your browser

Follow the same approach as [Wealthsimple Utilities](https://github.com/Bobrinik/wealthsimple_utilities) (Greasemonkey userscripts on Wealthsimple):

1. Install a userscript manager in your browser:
   - **Firefox:** [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
   - **Chrome / Edge:** [Tampermonkey](https://www.tampermonkey.net/)
2. Open the manager and create a **new user script**.
3. Copy the full contents of `wealthsimple_injector/grease_monkey.user.js` into the script editor. Review the code if you want to confirm it only talks to your local agent server and does not send data elsewhere.
4. Save the script.
5. Ensure the agent server is running, then go to the Wealthsimple site (or a matching page). The injected “Deep Research” button should appear where the script places it (e.g. under the About section).

## Project layout

- **`app/`** – Python application package:
  - **`main.py`** – Agent driver: LiteLLMModel (Gemini 2.0 Flash), CodeAgent, and Gradio UI.
  - **`server.py`** – FastAPI app for headless agent: `GET /health`, `POST /run`.
  - **`prompt.py`** – System prompt and instructions for the agent.
  - **`agent_tools.py`** – Custom tools: `scoped_perplexity_search`, `generic_search`, `generate_deep_research_hypothesis`, `output_formatter`.
  - **`yfinance_tools.py`** – yfinance tools (each takes a `ticker`, e.g. AAPL, RY.TO):
    - `ticker_history`, `ticker_info`, `ticker_dividends`, `ticker_splits`, `ticker_calendar`
    - `ticker_financials`, `ticker_quarterly_financials`, `ticker_balance_sheet`, `ticker_quarterly_balance_sheet`
    - `ticker_cashflow`, `ticker_quarterly_cashflow`, `ticker_institutional_holders`, `ticker_sustainability`
    - `ticker_options`, `ticker_option_chain`, `ticker_download`
  - **`test_yfinance_tools.py`** – Test script for yfinance tools.
- **`wealthsimple_injector/`** – Browser userscript that injects the Deep Research UI and calls the agent server:
  - **`grease_monkey.user.js`** – Tampermonkey/Greasemonkey script; install in your browser to use on Wealthsimple (see [Installing the script](#installing-the-script-in-your-browser)).

Run `uv run python -m app.test_yfinance_tools` to verify all yfinance tools (uses ticker AAPL).

## Issues

- **About section only detected on second reload** — The shadow DOM needs to load once before the detection script can find the About section. If the Deep Research button does not appear, reload the page once and it should show up.
- **Deep Research not using all tools; results less deep than Google Deep Search** — The agent is not yet tuned to use all available tools consistently, so the output is qualitatively shallower than Google’s Deep Search. Tuning (prompts, tool selection, and orchestration) is required.
