let DbWorker = {
    async saveMessage(id, message, senderId, chatId, date, additionalData) {
        await global.pgPool.query("INSERT INTO Messages (id, message, userId, chatId, date, reserved) VALUES ($1, $2, $3, $4, $5, $6);",
            [id, message, senderId, chatId, date, additionalData ? additionalData : null]);//*1000 lol
    },
    async isChannelProssed({id, link}){
        if(id)
        {
            let res = await global.pgPool.query("SELECT 1 FROM ChannelsToBots WHERE channelId=$1 LIMIT 1;", [id]);
            return res.rows.length!=0;
        }
        if(link)
        {
            let res = await global.pgPool.query("SELECT 1 FROM ChannelsToBots WHERE link=$1 LIMIT 1;", [link]);
            return res.rows.length!=0;
        }
    },
    async saveChannel({id=null, channelId=null, link=null, botId=null})
    {
        if(!channelId&&!link)
        {
            return;
        }
        if(!id)
        {
            id = Math.random();
        }
        await global.pgPool.query("INSERT INTO ChannelsToBots (id, channelId, link, botId) VALUES ($1, $2, $3, $4);", [id, channelId, link, botId]);
    },
    updateChannelLink(id, link)
    {
        return global.pgPool.query("UPDATE ChannelsToBots SET link=$2 WHERE id=$1;", [id, link]);
    },
    async getChannel(id){
        let res = await global.pgPool.query("SELECT * FROM ChannelsToBots WHERE id=$1 LIMIT 1;", [id]);
        return res.rows;
    },
    updateChannelRow({id, link=null, botId=null, channelId=null, error=null})
    {
        let queryPart='', counter=2, args=[id];
        if(link)
        {
            queryPart+='link=$'+counter;
            args.push(link);
            counter++;
            
        }
        if(botId)
        {
            queryPart+=(queryPart?',':'')+'botId=$'+counter;
            args.push(botId);
            counter++;
        }
        if(channelId)
        {
            queryPart+=(queryPart?',':'')+'channelId=$'+counter;
            args.push(channelId);
        }
        if(error)
        {
            queryPart+=(queryPart?',':'')+'error=$'+counter;
            args.push(error);
        }
        if(queryPart)
        {
            return global.pgPool.query(`UPDATE ChannelsToBots SET ${queryPart} WHERE id=$1;`, args);
        }
        
    },
    getChannelEmpty(limit=10){
        return global.pgPool.query("SELECT * FROM ChannelsToBots WHERE error IS NULL AND botid IS NULL LIMIT $1;", [limit]);
    },
    getChannelBots(){
        return global.pgPool.query("SELECT botid, COUNT(channelid) FROM ChannelsToBots WHERE error IS NULL GROUP BY botid;");
    }
};

module.exports = DbWorker;