### Overall Architecture:

Messenger -> Bot -><- ReqProcessor -> OutgoingWebHook -> ResProcessor -> Bot -> Messenger

### Testing if the API server is up
This is the routes/test.js
1. Deploy the API app and ping GET https://<host>/api/test/hello-world

### Running the Telegram Bot:
This is routes/telegram.js
1. Deploy the API app and get the https host URL 
2. Set environment variables: BOT_API_TOKEN (As given by the telegram bot), MY_TOKEN (Anything we like)
3. For the telegram bot, setWebhook should be set as https://<host>/api/telegram/receive/<mytoken>
4. To send messages to the user chatting with the bot use the https://<host>/api/telegram/send/<mytoken> POST method.

