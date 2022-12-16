let DbWorker = require('./DbWorker');
const { Api } = require("telegram");
const { NewMessage, NewMessageEvent } = require("telegram/events");

let wait = (time) => {
    return new Promise((res, rej) => {
        setTimeout(() => { res() }, time);
    })
}
let rnd = (min, max) => {
    return min + Math.floor(Math.random() * (max - min));
}


let manager = {
    bots: [],
    init() {
        this.getBots();
        setTimeout(this.DoJob, 10 * 1000);//wait 60 sec on start
        global.tgClient.addEventHandler(this.AdminHandler.bind(this), new NewMessage({ fromUsers: global.config.controller.admins }));
    },
    async getBots() {
        let bots = global.tgClient.iterParticipants(global.config.controller.botsChat, { limit: 10 });
        for await (const x of bots) {
            if (x.id != global.myId) {
                this.bots.push({ id: x.id.value, username: x.username, count: 0 });
            }
        }

        let res = await DbWorker.getChannelBots();
        for (let x of res.rows) {
            if (x.botid) {
                let temp = this.bots.find(e => e.id == x.botid);
                temp.count += parseInt(x.count);
            }
        }
    },
    get DoJob() {
        return this.doJob.bind(this);
    },
    async doJob() {
        setTimeout(this.DoJob, global.config.controller.timeout);
        let channels = await DbWorker.getChannelEmpty(this.bots.length);
        for (let i = 0; i < this.bots.length && i < channels.rows.length; i++) {
            console.log("SENDING ", channels.rows[i].id, this.bots[i].username);
            await global.tgClient.sendMessage(this.bots[i].username, { message: "\\invite *" + channels.rows[i].id });
            
            let timeout = rnd(10000, 30000)
            
            await wait(timeout);
        }
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

    async AdminHandler(event) {
        try {
            if (event.message.peerId.userId) {
                let args = event.message.message.split(' ');
                let command = args.shift();

                if (command == '\\invite') {
                    for(let x of args)
                    {
                        if(x[0]=='+')
                        {
                            await this._checkChatHash(x.slice(1));
                        }
                        else{
                            await this._checkCannelName(x);
                            await wait(2000);//wait 2 sec
                        }
                    }
                    await global.tgClient.sendMessage(event.message.peerId, {message:'OK'});
                }
            }
        } catch { }
    }
}

module.exports = manager;