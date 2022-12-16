const { TelegramClient, sessions, Api } = require("telegram");
const { NewMessage, NewMessageEvent } = require("telegram/events");
const logger = require('./logger');
const DbWorker = require('./DbWorker');

let channelManager = {
    calledDeffered: false,
    timeout: 0,//.JoinChannelCooldown,
    lastTime: 0,
    linksQueue: [],
    async scanChannel(channelPeer) {
        for await (const message of global.tgClient.iterMessages(channelPeer)) {
            await this.oldMessagesHandler({message:message});
        } 
    },
    async scanChat(chatPeer) {
        for await (const message of global.tgClient.iterMessages(chatPeer)) {
            await this.oldMessagesHandler({message:message});
        }
    },
    init(oldMessagesHandler) {
        this.oldMessagesHandler=oldMessagesHandler;
        this.timeout = global.scrapper.JoinChannelCooldown;
        //this.scanChannel(new Api.InputPeerChannel({channelId:1866623620n, accessHash:-5563280531862900358n}));
    },
    get JoinTo() {
        return this._join.bind(this);
    },
    async _join(link) {//links queue push wrap, run doJoinWrap on timeout, no changes needed
        this.linksQueue.push(link);
        if (Date.now() < this.lastTime + this.timeout) {
            if (!this.calledDeffered) {
                this.calledDeffered = true;
                setTimeout(this._doJoinWrap.bind(this), (this.lastTime + this.timeout - Date.now()))
            }
        }
        else {
            this._doJoinWrap();
        }
    },
    async _doJoinWrap() {
        let link;
        try {
            link = this.linksQueue.shift();
            this.lastTime = Date.now();
            if (link[0] == "*") {
                let channel = await DbWorker.getChannel(link.slice(1));
                if (channel.length != 1) {
                    throw new Error("No such row");
                }
                if (channel[0].botid) {
                    throw new Error("This channel already proceed");
                }
                link = channel[0].link;
                try {
                    if (link[0] == "+") {
                        await this._doJoinCore({ hash: link.slice(1), catchEx: false, rowId: channel[0].id });
                    }
                    else {
                        await this._doJoinCore({ name: link, catchEx: false, rowId: channel[0].id });
                    }
                } catch (ex) { }
            }

            if (this.linksQueue.length > 0) {
                this.calledDeffered = true;
                setTimeout(this._doJoinWrap.bind(this), this.timeout);
            }
            else {
                this.calledDeffered = false;
            }
        } catch (ex) {
            logger.error('join failed', {
                exMessage: ex.message,
                calledDeffered: this.calledDeffered,
                timeout: this.timeout,
                lastTime: this.lastTime,
                link: link,
                time: Date.now(),
                queue: this.linksQueue
            });
        }
    },
    async _doJoinCore({ name = '', hash = '', catchEx = true, rowId = null }) {
        let res, id;
        if (name) {
            try {
                res = await global.tgClient.invoke(new Api.channels.JoinChannel({
                    channel: name
                }));
                id = res.chats[0].id;
                await DbWorker.updateChannelRow({ id: rowId, botId: global.myId });
                if (res.chats[0].className == 'Channel') {
                    this.scanChat(new Api.InputPeerChannel({ channelId: res.chats[0].id, accessHash: res.chats[0].accessHash }));
                }
                else {
                    this.scanChat(new Api.InputPeerChat({ chatId: res.chats[0].id, accessHash: res.chats[0].accessHash }));
                }


                res = await global.tgClient.invoke(
                    new Api.channels.GetFullChannel({
                        channel: name,
                    }));
            } catch (ex) {
                await DbWorker.updateChannelRow({ id: rowId, botId:global.myId , error:ex.message });
                logger.warn("Channel join ex", [ex.message, rowId]);
                if (!catchEx) {
                    throw ex;
                }
            }
        }
        if (hash) {
            try {
                res = await global.tgClient.invoke(
                    new Api.messages.ImportChatInvite({
                        hash: hash
                    })
                );
                let channelId = res.chats[0].id.value;
                id = res.chats[0].id;
                if (res.chats[0].className == 'Channel') {
                    channelId = "C" + channelId;
                }
                if (res.chats[0].className == 'Chat') {
                    channelId = "G" + channelId;
                }
                await DbWorker.updateChannelRow({ id: rowId, botId: global.myId, channelId: channelId });

                if (res.chats[0].className == 'Channel') {
                    this.scanChat(new Api.InputPeerChannel({ channelId: res.chats[0].id, accessHash: res.chats[0].accessHash }));
                }
                else {
                    this.scanChat(new Api.InputPeerChat({ chatId: res.chats[0].id, accessHash: res.chats[0].accessHash }));
                }

                if (res.chats[0].className == 'Channel') {
                    res = await global.tgClient.invoke(
                        new Api.channels.GetFullChannel({
                            channel: new Api.InputPeerChannel({ channelId: res.chats[0].id, accessHash: res.chats[0].accessHash }),
                        })
                    );
                }

            } catch (ex) {
                if (ex.errorMessage && ex.errorMessage == 'USER_ALREADY_PARTICIPANT') {
                    await DbWorker.updateChannelRow({ id: rowId, botId: global.myId });
                }
                else {
                    await DbWorker.updateChannelRow({ id: rowId, botId:global.myId, error: ex.message });
                }
                logger.warn("Chat invite ex", [ex.message, rowId]);
                if (!catchEx) {
                    throw ex;
                }
            }
        }

        if (res) {//join subchanels
            for (let x of res.chats) {
                if (x.id.value != id.value) {
                    try {
                        await global.tgClient.invoke(new Api.channels.JoinChannel({
                            channel: x.id
                        }));
                        await DbWorker.saveChannel({ id: "C" + x.id, channelId: "C" + x.id, link: rowId, botId: global.myId });
                        if (x.className == 'Channel') {
                            this.scanChat(new Api.InputPeerChannel({ channelId: x.id, accessHash: x.accessHash }));
                        }
                        else {
                            this.scanChat(new Api.InputPeerChat({ chatId: x.id, accessHash: x.accessHash }));
                        }

                        //await this.SaveLink(x.id);
                    } catch (ex) {
                        logger.warn('Join sub failed', [ex, rowId]);
                    }
                }
            }
        }
    }
}

module.exports = channelManager;