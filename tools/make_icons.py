import os
from PIL import Image, ImageDraw
S=1024
O=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'icons')
os.makedirs(O,exist_ok=True)
def art(k=1.0,rounded=True):
    im=Image.new('RGBA',(S,S))
    d=ImageDraw.Draw(im)
    for y in range(S):
        t=y/(S-1)
        d.line([(0,y),(S,y)],fill=(int(27-18*t),int(30-20*t),int(40-26*t),255))
    if rounded:
        m=Image.new('L',(S,S),0)
        ImageDraw.Draw(m).rounded_rectangle([0,0,S-1,S-1],radius=int(S*.22),fill=255)
        im.putalpha(m)
    c=S/2;rw=S*.56*k;rh=S*.40*k
    d.rounded_rectangle([c-rw/2,c-rh/2,c+rw/2,c+rh/2],radius=int(S*.055*k),outline=(196,133,62),width=int(S*.022*k))
    tw=rw*.30;th=rh*.46;tx=c+tw*.18
    d.polygon([(tx-tw/2,c-th/2),(tx-tw/2,c+th/2),(tx+tw/2,c)],fill=(245,177,94))
    return im
for px,name,k,r in ((192,'icon-192.png',1,True),(180,'icon-180.png',1,True),(512,'icon-512.png',.78,False)):
    art(k,r).resize((px,px),Image.LANCZOS).save(os.path.join(O,name))
