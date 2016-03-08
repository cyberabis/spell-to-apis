### Overall Architecture:

Messenger -> Bot -><- ReqProcessor -><- OutgoingWebHook

### Testing if the API server is up
This is the routes/test.js
1. Deploy the API app and ping GET https://<host>/api/test/hello-world

### Running the Telegram Bot:
This is routes/telegram.js
1. Deploy the API app and get the https host URL 
2. Set environment variables: 
	BOT_API_TOKEN (As given by the telegram bot), 
	TELEGRAM_TOKEN (Anything we like), 
	REQPROCESSOR_TOKEN (The token for ReqProcessor API)
	REQPROCESSOR_HOST_URL (Host where Reqprocessor is running).
3. For the telegram bot, setWebhook should be set as https://<host>/api/telegram/receive/<telegramtoken>
4. To send messages to the user chatting with the bot use the https://<host>/api/telegram/send/<telegramtoken> POST method.

### Running the ReqProcessor:
This is routes/reqprocessor.js
1. Deploy the API app and get the https host URL 
2. Set environment variables: 
	FIREBASE_SECRET (From Firebase)
	REQPROCESSOR_TOKEN (Anything we like), 
	TELEGRAM_TOKEN (The token for our Telegram Bot)
	TELEGRAM_HOST_URL (Host where our Telegram Bot is running).
3. There is only one method POST /:token. This will be called by our Bots.


### Creating a new Bot
1. Copy the Telegram Bot code - routes/telegram.js
2. The API URL should be <host>/api/<source>/
3. There should be 2 API methods of same signature: receive/:token and send/:token.
4. Addition of new Bot needs addition of new env. variables <SOURCE>_TOKEN and <SOURCE>_HOST_URL. These will be required by the ReqProcessor.
5. Add code in ReqProcessor to read new env variables and process for the newly added bots.
