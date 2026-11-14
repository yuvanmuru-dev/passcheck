import asyncio, json
clients=set()
async def publish(name, data):
    event=f"event: {name}\ndata: {json.dumps(data, separators=(',',':'))}\n\n"
    for q in tuple(clients):
        try: q.put_nowait(event)
        except asyncio.QueueFull: pass
