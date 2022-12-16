const { TelegramClient, sessions, Api } = require("telegram");
const { NewMessage, NewMessageEvent } = require("telegram/events");
const logger = require('./logger');
const DbWorker = require('./DbWorker');


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

let tempPrivChannelId; //in order not to get a ban when receiving several forwards from a private channel, we save channel id on the first message, next messages will not be proceed

let MessagesHandler = {
    init: async function (JoinChannelFunc) {
        this.JoinChannel = JoinChannelFunc;
        global.tgClient.addEventHandler(this.NewMessageHandler, new NewMessage({}));
    },
    async _checkCannelName(name) {
        try {
            let check = await DbWorker.isChannelProssed({ link: name });
            if (!check) {
                let res = await global.tgClient.invoke(
                    new Api.channels.GetFullChannel({
                        channel: name
                    })
                );
                let id = "C" + res.fullChat.id.value;
                try {
                    await DbWorker.saveChannel({ id: id, channelId: id, link: name });
                } catch (ex) {
                    if (ex.code && ex.code == 23505)//if such channel id found in db but links not mach, replace link to last
                    {
                        await DbWorker.updateChannelLink(id, name);
                    }
                }
            }
        } catch (ex) { }
    },
    async _checkChatHash(hash) {
        let check = await DbWorker.isChannelProssed({ link: "+" + hash });
        if (!check) {
            try {
                await DbWorker.saveChannel({ link: ("+" + hash) });
            } catch (ex) { }
        }
    },
    async _checkMessage(message, checkShort = false) {
        if (message.includes('t.me/')) {
            let regexp = /t\.me\/\+[a-zA-Z0-9_-]{16}/g;//t.me/+hash
            let res = message.match(regexp);
            if (res) {
                for (let link of res) {
                    await this._checkChatHash(link.replace('t.me/+', ''));
                }
            }

            regexp = /t\.me\/[a-zA-Z0-9_]{5,30}/g;//t.me/chanel_name
            res = message.match(regexp);
            if (res) {
                for (let link of res) {
                    await this._checkCannelName(link.slice(5));
                }
            }
        }

        if (checkShort && message.includes('@')) {//check @chanel_name
            const regexp = /@[0-9a-zA-Z_]{5,32}/g;//0-9 a-z size:5-32
            let res = message.match(regexp);
            if (res) {
                for (let name of res) {
                    await this._checkCannelName(name.slice(1));
                }
            }
        }
    },
    async _checkForward(fwd) {
        if (!fwd) {
            return '';
        }
        if (!!fwd.fromId.channelId) {
            let check = await DbWorker.isChannelProssed({ id: getId(fwd.fromId) });
            if (!check && getId(fwd.fromId) != tempPrivChannelId) {
                try {
                    let res = await global.tgClient.invoke(
                        new Api.channels.GetFullChannel({
                            channel: getId(fwd.fromId, true)
                        })
                    );
                    for (let x of res.chats) {
                        if (x.username) {
                            let id = "C" + x.id.value;
                            await DbWorker.saveChannel({ id: id, channelId: id, link: x.username });
                        }
                    }
                } catch (ex) {
                    if (ex.errorMessage && ex.errorMessage == 'CHANNEL_PRIVATE') {
                        tempPrivChannelId = getId(fwd.fromId);
                    }
                }
            }
        }
        return 'F_' + getId(fwd.fromId) + ';';
    },
    async _checkReply(repl) {
        if (!repl) {
            return '';
        }
        return 'R_' + repl.replyToMsgId + ';';
    },
    async _checkMedia(message) {
        if (!global.scrapper.mediaBinUsername) {
            const result = await global.tgClient.invoke(
                new Api.channels.GetChannels({
                    id: ["-100" + global.scrapper.mediaBin],
                })
            );
            if (result.chats) {
                global.scrapper.mediaBinUsername = result.chats[0].username;
            }
            else {
                throw new Error("Media bin not found");
            }
        }
        if (message.media) {
            const response = await global.tgClient.invoke(
                new Api.messages.ForwardMessages({
                    toPeer: global.scrapper.mediaBinUsername,
                    fromPeer: message.peerId,
                    id: [message.id],
                })
            );
            try {
                return 'M_' + response.updates[0].id + ';';
            } catch (ex) {
                //logger
            }
        }
        return '';
    },
    async _doAdmin(event) {
        let message = event.message.message.split(' ');
        let command = message[0];

        // if (command == '\\sql') {//Executing received sql
        //     let sql = message.message.slice(5);
        //     const sender = await message.getSender();
        //     try {
        //         let res = await global.pgPool.query(sql);
        //         await global.tgClient.sendMessage(sender, { message: JSON.stringify(res) })
        //     } catch (ex) {
        //         await global.tgClient.sendMessage(sender, { message: ex.message })
        //     }

        // }

        if (command == '\\invite') {//Join by link
            const sender = await event.message.getSender();
            try {
                for (let i = 1; i < message.length; i++) {
                    await this.JoinChannel(message[i]);
                }
                //await this._checkMessage(message.message, true, false);
                //await global.tgClient.sendMessage(sender, { message: 'OK' });
            } catch (ex) {
                await global.tgClient.sendMessage(sender, { message: ex.message });
            }
        }
        console.log("HELLO ADMIN");
    },
    async _doGroup(event) {
        const message = event.message;
        if (getId(message.peerId, true) == global.scrapper.mediaBin) {
            return;
        }
        //if(message.peerId)
        //??If album there are not message??
        if (!message.id) {
            return
        }
        let senderId = getId(message.fromId), chatId = getId(message.peerId), additionalData = '';

        global.scrapper.checkMedia && (additionalData += await this._checkMedia(message));

        if (!message.message && !additionalData) {
            return;
        }
        this._checkMessage(message.message);
        global.scrapper.checkForward && (additionalData += await this._checkForward(message.fwdFrom));
        global.scrapper.checkReplies && (additionalData += await this._checkReply(message.replyTo));

        if(event.originalUpdate)
        {
            await DbWorker.saveMessage(chatId + '_' + message.id, message.message, senderId, chatId, message.date, additionalData);
        }
        else{
            try{
                await DbWorker.saveMessage(chatId + '_' + message.id, message.message, senderId, chatId, message.date, additionalData);
            }catch{}
        }
        console.log("CHAT MESSAGE");
    },
    async _doChanels(event) {
        const message = event.message;
        if (!message.id) {
            return
        }
        let senderId = message.fromId ? getId(message.fromId) : '', chatId = getId(message.peerId), additionalData = '';

        global.scrapper.checkMedia && (additionalData += await this._checkMedia(message));
        if (!message.message && !additionalData) {
            return;
        }

        this._checkMessage(message.message, true);
        global.scrapper.checkForward && (additionalData += await this._checkForward(message.fwdFrom));
        global.scrapper.checkReplies && (additionalData += await this._checkReply(message.replyTo));


        if(event.originalUpdate)
        {
            await DbWorker.saveMessage(chatId + '_' + message.id, message.message, senderId, chatId, message.date, additionalData);
        }
        else{
            try{
                await DbWorker.saveMessage(chatId + '_' + message.id, message.message, senderId, chatId, message.date, additionalData);
            }catch{}
        }
        console.log("CHANEL MESSAGE");
    },
    get NewMessageHandler(){
        return this.newMessageHandler.bind(this);
    },
    async newMessageHandler(event) {
        try {
            const message = event.message;
            if (message.peerId instanceof Api.PeerChat) {
                return await this._doGroup(event);
            }
            if (message.peerId instanceof Api.PeerChannel) {
                if (event.message.fromId) {
                    return await this._doGroup(event);
                }
                else {
                    return await this._doChanels(event)
                }
            }
            if (message.peerId instanceof Api.PeerUser) {
                if (message.peerId.userId.value == global.scrapper.ADMIN_ID) {//If received command from admin
                    return await this._doAdmin(event);
                }
                return;//if received message not from admin
            }
        } catch (ex) {
            logger.error('EX', [event, ex.message]);
        }
    }
}
module.exports = MessagesHandler;