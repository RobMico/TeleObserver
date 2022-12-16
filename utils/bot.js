const { TelegramClient, sessions, Api } = require("telegram");
const { NewMessage, NewMessageEvent } = require("telegram/events");
const logger = require('./logger');
const MessagesHandler = require('./MessagesHandler');
const ChannelManager = require('./ChannelManager');
const ControllerBot = require('./ControllerBot');

let getId = (obj, original = false) => {
    if (obj.userId) {
        if (original) {
            return obj.userId.value;
        }
        return 'U' + obj.userId.value;
    }
    if (obj.channelId) {
        if (original) {
            return obj.channelId.value;
        }
        return 'C' + obj.channelId.value;
    }
    if (obj.chatId) {
        if (original) {
            return obj.chatId.value;
        }
        return 'G' + obj.chatId.value;
    }
    return '';
};
let linkWorker = {
    currentLinks: [],
    timeoutCheck: false,
    timeout: 30 * 60//30 minutes
};

let main = class {
    constructor(mode) {
        if (mode == 'scrapper') {
            ChannelManager.init(MessagesHandler.NewMessageHandler);
            MessagesHandler.init(ChannelManager.JoinTo);
        }
        if(mode=='controller')
        {
            ControllerBot.init();
        }
    }
}

module.exports = main;