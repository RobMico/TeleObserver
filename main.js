const { TelegramClient, sessions, Api } = require("telegram")
const { NewMessage, NewMessageEvent } = require("telegram/events")
const { Pool, Client } = require('pg');
const fs = require('fs');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});


//load config
let config = fs.readFileSync(__dirname + '/config.json');
config = JSON.parse(config);
const { API_ID, API_HASH, ADMIN_ID, dbUser, dbPass, dbName, dbHost, dbPort } = config;

//TODO
const stringSession = new sessions.StringSession("1AgAOMTQ5LjE1NC4xNjcuNDEBu3aa8GTNIue86wvlX4lvgNLIO7OFCkDiwFCDAERfgRfqp8UnwwN/TmkYeRynezEZSvp8BG2cbjpz4y6U8t1Fu2DTAFbEo5I3SN0t8PaPMwmZeAhJ97k99bl9BajMcRADvK/X5cLgD+05ncLzsYVmsC2cUNP+Tw1qc+Kc8iBHIAq2OpOLLB0klS3vkOIfJ4MXiVQTD5hASnnO6xpkmdsIa4lJFcqjIg5Hj9m+czHYVsNusSm8Na3IdoafSog18n4pMDSnm05GtkyEV8MjhrA98o9zcg4LL4YrOtAeptL9iK3XhvybA/27L79gdqWQJABOZ5yyuS0e4xrfuTUySGIkGsk=");
const pool = new Pool({
    user: dbUser,
    host: dbHost,
    database: dbName,
    password: dbPass,
    port: dbPort
});



const client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
});

//promise inpute
const input = (text) => {
    return new Promise((resolve, reject) => {
        readline.question(text, res => {
            resolve(res);
        });
    });
}
//zxcvbnddd
let newMessageHandler = async (event) => {
    let message = event.message;
    if (!message.fromId)//If chanel
    {
        return;
    }

    if (event.className == 'UpdateShortMessage') {//if chat
        //If received command from admin
        if (message.peerId.userId.value == ADMIN_ID) {
            let command = message.message.split(' ', 1)[0];
            //Executing received sql
            if (command == '\\sql') {
                let sql = message.message.slice(5);
                const sender = await message.getSender();
                try {
                    let res = await pool.query(sql);
                    await client.sendMessage(sender, { message: JSON.stringify(res) })
                } catch (ex) {
                    await client.sendMessage(sender, { message: ex.message })
                }

            }
            //Join by link
            if (command == '\\invite') {
                let link = message.message.slice(8);
                const sender = await message.getSender();
                try {
                    let res = await client.invoke(
                        new Api.messages.ImportChatInvite({
                            hash: link.replace('https://t.me/+', '')
                        })
                    );
                    await client.sendMessage(sender, { message: 'OK' });
                }
                catch (ex) {
                    await client.sendMessage(sender, { message: ex.message });
                }

            }
            console.log("HELLO ADMIN");
            return;
        }//if received message not from admin
        else {
            console.log("FUCK OFF");
            return;
        }
    }

    {//else - public or private group
        let senderId, chatId;
        {
            if (message.fromId.userId) {
                senderId = message.fromId.userId.value;
            }
            if (message.fromId.chatId) {
                senderId = -message.fromId.chatId.value;
            }
            if (message.fromId.channelId) {
                //chanel id format -100+id?
                senderId = -message.fromId.channelId.value;
            }
            if (message.peerId.channelId) {
                chatId = message.peerId.channelId.value;
            }
            if (message.peerId.chatId) {
                chatId = -message.peerId.chatId.value;
            }
        }

        //If media there are not message
        if (!message.message) {
            return
        }

        if (message.message.includes('t.me/')) {
            //t.me/+hash
            let regexp = /t\.me\/\+[a-zA-Z0-9_]{16}/g;
            let res = message.message.match(regexp);
            if (res) {
                for (link of res) {
                    console.log(`Join ${link}`);
                    try {
                        await client.invoke(
                            new Api.messages.ImportChatInvite({
                                hash: link.replace('t.me/+', '')
                            })
                        );
                    } catch { }
                }
            }

            //t.me/chanel_name
            regexp = /t\.me\/[a-zA-Z0-9_]{5,30}/g;
            res = message.message.match(regexp);
            if (res) {
                for (name of res) {
                    try {
                        const result = await client.invoke(new Api.channels.JoinChannel({
                            channel:name.slice(5)//t.me/
                        }));
                    } catch(ex) {}
                }
            }

        }

        //check @chanel_name
        if (false && message.message.includes('@')) {
            //0-9 a-z size:5-30
            const regexp = /@[0-9a-zA-Z_]{5,30}/g;
            let res = message.message.match(regexp);
            if (res) {
                for (name of res) {
                    try {
                        const result = await client.invoke(new Api.channels.JoinChannel({
                            channel:name.slice(1)
                        }));
                    } catch(ex) {}
                }
            }
        }

        //Saving to db
        await pool.query("INSERT INTO Messages (id, message, userId, chatId, date) VALUES ($1, $2, $3, $4, $5);",
            [message.date + '_' + message.id, message.message, senderId, chatId, new Date(message.date)]);
        console.log("CHAT MESSAGE");
    }
}

let program = async () => {
    let res = await pool.query("SELECT 1+1;");
    console.log(res)
    await client.start({
        phoneNumber: async () => await input("Please enter your number: "),
        password: async () => await input("Please enter your password: "),
        phoneCode: async () =>
            await input("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });
    console.log("You should now be connected.");
    console.log(client.session.save()); // Save this string to avoid logging in again
    //await client.sendMessage("me", { message: "Hello!" });
    client.addEventHandler(newMessageHandler, new NewMessage({}));

}
program();