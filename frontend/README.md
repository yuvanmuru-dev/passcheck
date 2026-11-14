# PassCheck frontend

Run `npm ci` and `npm run dev` in this directory, then open [the demo board](http://localhost:3000/?demo=1). The default mode uses interactive sample data and manager PIN `4242`. Mock changes are stored in the browser tab. Sample evidence has descriptions and does not include camera images.

To connect FastAPI, copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_API_BASE=http://localhost:8000`, and restart Next.js. The manager PIN comes from the backend. Set `WEBHOOK_SECRET` to the backend's value in a demo environment to enable the signed **New order** action.

Set `NOTIFY_KEY` to the backend's value to enable `/api/notify`. For Photon, set `PHOTON_PROJECT_ID`, use the project secret as `PHOTON_API_KEY`, and set `PHOTON_TO` to the recipient's phone number. Register the recipient with the project when using a shared Photon line. For Telegram, set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. The route tries Photon first, then Telegram. [Photon iMessage setup](https://github.com/photon-hq/skills/blob/main/skills/spectrum/providers/imessage.md)
