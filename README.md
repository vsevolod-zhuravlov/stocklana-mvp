# Stocklana — the wallet that talks back

A voice-first, mobile-first Solana wallet that someone with no crypto experience — including a blind user relying entirely on a screen reader — can use with the phone screen off. Sign in, get a wallet, buy SOL with Apple Pay or Google Pay, and buy a tokenized stock, all by talking to an AI guide.

The point is not voice commands mapped to a menu. It is a conversational agent with tool calling that both explains concepts in open dialogue and executes wallet actions, so it feels like talking to someone knowledgeable rather than driving a UI by voice.

## Accessibility decisions worth knowing

These are the choices that make the difference between "works with a screen reader" and "usable with your eyes shut".

**No custom text-to-speech.** The assistant's replies are written into an `aria-live="assertive"` region and the user's own screen reader speaks them, in the voice and at the speed they already configured. A `speechSynthesis` voice would fight TalkBack for audio focus and talk over it.

**Microphone state is a tone, not a word.** The screen reader plays through the same speaker the microphone listens to, so announcing "listening" at the moment the mic opens gets transcribed straight back as user input. Rising and falling tones (`src/lib/earcons.ts`) convey mic state without polluting the transcript.

**The transcript does not announce.** `Transcript` is a `role="log"` with `aria-live="off"`. Replies are announced exactly once, through the dedicated live region; the log stays navigable for anyone who wants to review it.

**Push-to-talk toggles, it does not hold.** Press-and-hold gestures are intercepted by TalkBack and VoiceOver, and they are hard work for anyone with a motor impairment. One tap starts, one tap sends.

**Four ways in, always.** Speech, one large tap target, suggestion buttons and a text box all reach the same agent. If recognition fails, nothing is lost.

**Every payment is read back before it happens.** The agent states the amount and waits for a spoken "yes" or a tap on a high-contrast Confirm button. The server additionally refuses to prepare and confirm an action in the same turn, so a prompt-injection or a model slip cannot spend money without the user being asked.

**Settlement is announced unprompted.** After a card payment the user has no way to see the deposit land, so the client polls and announces it the moment it does.

## Architecture

```
Browser                                Next.js server                      External
──────────────────────────────────     ─────────────────────────────       ────────────────
SpeechRecognition (STT)
        │ transcript
        ▼
   POST /api/chat ──────────────────►  runAgent()
                                         │ system prompt + history + tools
                                         ├─────────────────────────────────► Claude / GPT
                                         │ ◄──── text or tool_use
                                         │
                                         ├─ get_balance ───────────────────► Helius RPC
                                         ├─ start_onramp ──────────────────► Onramper URL
                                         ├─ buy_stock ─────────────────────► Jupiter quote
                                         └─ confirm_pending_action
                                              │ returns a ClientAction
        ◄──────────────────────────────  reply + pendingAction + clientAction
        │
        ├─ aria-live region  ──► screen reader speaks
        ├─ open_onramp   ──► iframe with allow="payment" ──► Apple Pay / Google Pay sheet
        └─ sign_and_send ──► Privy embedded wallet signs ──► Solana
```

The private key never reaches the server. The backend only ever prepares unsigned transactions; the browser signs them with the Privy embedded wallet and submits.

`pendingAction` lives on the client and is echoed back with each turn, so the API routes are stateless and survive serverless cold starts.

### Tools available to the model

| Tool | What it does |
| --- | --- |
| `explain(topic)` | Returns a grounded house explanation of wallets, SOL, Solana, tokenized stocks, security, fees, the on-ramp, or the test network. Keeps answers consistent between turns. |
| `get_balance()` | Live SOL and tokenized-stock balances plus USD values, read from the RPC provider. |
| `start_onramp(usd_amount)` | **Prepares only.** Creates a payment session and a pre-filled Onramper URL. |
| `check_payment_status(session_id)` | Whether the card payment settled and the SOL arrived. |
| `buy_stock(ticker, usd_amount)` | **Prepares only.** Resolves the ticker, prices the trade, checks the balance covers it. |
| `confirm_pending_action()` | Executes what was prepared. Rejected by the server if called in the same turn as the preparation. |
| `cancel_action()` | Discards the prepared action. |

## Setup

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

### Keys you need

| Service | Variable | Where | Notes |
| --- | --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | console.anthropic.com | Server-only. Set `LLM_PROVIDER=openai` and `OPENAI_API_KEY` to swap providers. |
| Privy | `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` | dashboard.privy.io | Enable email OTP, passkey, and Solana embedded wallets. |
| Solana RPC | `SOLANA_RPC_URL` | helius.dev or quicknode.com | Free tier is plenty. Do not use the public RPC — rate limits will break the demo. |
| Onramper | `NEXT_PUBLIC_ONRAMPER_API_KEY` | onramper.com dashboard | Use a sandbox `pk_test_` key to bypass KYC, and enable Apple Pay / Google Pay in routing. |
| Jupiter | `JUPITER_API_KEY` | dev.jup.ag | Optional. Without it the lite tier is used. |

The app degrades honestly rather than crashing: a missing Privy app ID shows a setup screen, a missing LLM key makes the assistant say it is not connected, and a missing Onramper key makes `start_onramp` report that card payments are unavailable.

### HTTPS is mandatory

`SpeechRecognition` will not get microphone access over plain HTTP. For local testing on a real phone:

```bash
npx localtunnel --port 3000     # or: ngrok http 3000 / cloudflared tunnel --url http://localhost:3000
```

Vercel gives you HTTPS by default in production.

## Demo mode, and what is real

Default configuration is Solana **devnet** with `NEXT_PUBLIC_DEMO_MODE=true`. What that means precisely:

- **Wallet, signing, balances, transactions: real.** Real devnet transactions, real signatures, real explorer links.
- **The card payment: sandbox.** Onramper's sandbox skips live KYC, which is impossible to complete eyes-free during a recording.
- **The deposit: simulated.** A sandbox payment cannot deliver devnet SOL, so once the payment sheet closes the server delivers test SOL from a treasury keypair (`DEMO_TREASURY_SECRET_KEY`) or, failing that, the devnet faucet. **Set the treasury key** — the public faucet is rate limited and will fail during a live demo:

```bash
solana-keygen new --outfile demo-treasury.json
solana airdrop 2 --keypair demo-treasury.json --url devnet
# paste the file's contents as DEMO_TREASURY_SECRET_KEY
```

- **The stock purchase: a devnet stand-in.** xStocks tokens only exist on mainnet, so on devnet the quoted SOL really leaves the wallet to `DEMO_VAULT_ADDRESS` with a memo recording the intended trade. The pricing is a real Jupiter mainnet quote, and the signing, confirmation and spoken-receipt path is identical to the real thing.

Set `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta` and the same code path runs a real Jupiter swap into the real xStocks mint, with real money.

Supported assets are listed in `src/lib/solana/tokens.ts`: AAPLx, TSLAx, NVDAx and SPYx. Confirm a mint is routable on Jupiter before adding it.

## Test this before trusting the demo

The riskiest unknown is not the wallet code, it is whether speech and the screen reader cooperate on the actual phone you record with.

1. **Speech plus TalkBack, as an installed PWA.** Deploy, add to home screen, turn TalkBack on, and check that a spoken question gets a spoken answer. Do this before anything else. A browser tab behaves differently from an installed PWA.
2. **Focus across the payment sheet.** Trigger the on-ramp, let the Google Pay sheet take over, dismiss it, and confirm focus lands back on the push-to-talk button and the settlement is announced.
3. **Screen off.** Complete a full buy with the screen off and your eyes closed. Anything you had to look at is a bug.
4. **Permission denied.** Refuse the microphone prompt and confirm the fallback is explained out loud.

## Project layout

```
src/
  app/
    page.tsx                  landing page: pitch and demo video
    app/                      the PWA itself (auth -> conversation)
    api/
      chat/                   the tool-calling loop
      balance/                RPC balance lookup
      onramp/status/          settlement polling, drives the proactive announcement
      onramp/webhook/         real Onramper settlement callbacks
  components/
    ConversationScreen.tsx    orchestrates speech, agent, signing and announcements
    LiveAnnouncer.tsx         the aria-live regions
    PushToTalk.tsx            the primary control
    ConfirmBar.tsx            visual Confirm / Cancel alongside the spoken prompt
    OnrampDialog.tsx          focus-trapped payment widget host
  hooks/useSpeechRecognition.ts
  lib/
    agent/                    system prompt, tool schemas, executor, provider adapters
    solana/                   RPC, token registry, transaction building
    jupiter.ts  onramper.ts  payments.ts  earcons.ts
```

## Scripts

```bash
npm run dev      # local dev server
npm run build    # production build
npm run lint     # eslint
npm run icons    # regenerate PWA icons from public/icon.svg
```

## Known limits

- Payment sessions are held in an in-memory `Map`. Fine for a demo; move to Redis or Vercel KV before this sees more than one server instance.
- `SpeechRecognition` is Chromium-only in practice. Safari on iOS supports it inconsistently, which is why the typed and tap fallbacks are always present.
- The agent is deliberately scoped to explaining, checking balance, buying SOL and buying a supported tokenized stock. It redirects everything else, including which stock to pick.

Not investment advice.
