"""Sign a JSON request body and POST it to a PassCheck webhook."""
import argparse, hashlib, hmac, json, os, urllib.request

parser=argparse.ArgumentParser()
parser.add_argument("path",help="JSON payload file")
parser.add_argument("--url",default="http://localhost:8000/api/pos/orders")
args=parser.parse_args()
raw=open(args.path,"rb").read()
secret=os.getenv("WEBHOOK_SECRET","dev-webhook-secret").encode()
sig=hmac.new(secret,raw,hashlib.sha256).hexdigest()
req=urllib.request.Request(args.url,data=raw,headers={"Content-Type":"application/json","X-Signature":sig},method="POST")
with urllib.request.urlopen(req) as response: print(response.status, response.read().decode())
