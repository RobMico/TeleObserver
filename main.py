from telethon import TelegramClient, events, tl
import asyncio
import aiopg


API_ID = '29632218'
API_HASH = '5687f1ed2316c5524159d94052d562c4'
ADMIN_ID = 628902357


if __name__ == '__main__':
    client = TelegramClient('anon', API_ID, API_HASH)
    client.start()

    @client.on(events.NewMessage)
    async def my_event_handler(event):
        if(event.sender_id==event.chat_id and event.chat_id == ADMIN_ID):
            print("HELLO ADMIN")
            return
        elif(event.sender_id==event.chat_id):
            print("SOME BASTRADS")
            return
        print(f"CHAT ID:{event.chat_id}, SENDER ID:{event.sender_id}")        
        print(event.message.get)    
    client.run_until_disconnected()

#Message(id=18, peer_id=PeerChat(chat_id=851825172), date=datetime.datetime(2022, 12, 3, 16, 53, 51, tzinfo=datetime.timezone.utc), message='dd', out=False, mentioned=False, media_unread=False, silent=False, post=None, from_scheduled=None, legacy=None, edit_hide=None, pinned=None, noforwards=None, from_id=PeerUser(user_id=628902357), fwd_from=None, via_bot_id=None, reply_to=None, media=None, reply_markup=None, entities=[], views=None, forwards=None, replies=None, edit_date=None, post_author=None, grouped_id=None, reactions=None, restriction_reason=[], ttl_period=None)