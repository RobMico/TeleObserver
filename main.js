const { TelegramClient, sessions, Api } = require("telegram");
const { Pool } = require('pg');
const fs = require('fs');
const botObj = require('./utils/bot');
require('dotenv').config();
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});
let configFile = 'config.json';

//load config
for(let i=0;i<process.argv.length;i++) {
    if(process.argv[i]=='--config') {
        if(process.argv[i+1]) {
            configFile = process.argv[i+1];
            i++;
        }
    }
    if(process.argv[i]=='--mode') {
        if(process.argv[i+1]) {
            mode = process.argv[i+1];
            i++;
        }
    }
}

let config = fs.readFileSync(configFile, 'utf8');
config = JSON.parse(config);
global.config = config;
global.scrapper = config.scrapper;
const { API_ID, API_HASH, dbUser, dbPass, dbName, dbHost, dbPort, mode } = config;

let session = '';
if(config.sessionStringFile) {
    try{
        session = fs.readFileSync(config.sessionStringFile, 'utf8');
    }catch{}
}
const stringSession = new sessions.StringSession(session);
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

let program = async () => {
    await pool.query("SELECT 1+1;");
    await client.start({
        phoneNumber: async () => await input("Please enter your number: "),
        password: async () => await input("Please enter your password: "),
        phoneCode: async () =>
            await input("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });
    console.log("You should now be connected.");
    if(config.sessionStringFile)
    {
        fs.writeFileSync(config.sessionStringFile, client.session.save(), ()=>{})
    }
    global.pgPool = pool;
    global.tgClient = client;
    global.myId = (await global.tgClient.getMe()).id.value;
    let bot = new botObj(mode);
}
program();