const { TelegramClient, sessions, Api } = require("telegram");
const stringSession = new sessions.StringSession('');
let API_ID=0, API_HASH='';
const client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
});

let program = async ()=>{
    await client.start({
        phoneNumber: async () => await input("Please enter your number: "),
        password: async () => await input("Please enter your password: "),
        phoneCode: async () =>
            await input("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });
    
    console.log(await client.getMe()); 
}
program();