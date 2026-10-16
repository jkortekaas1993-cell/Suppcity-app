import cv2, numpy as np, sys
src, out = sys.argv[1], sys.argv[2]
img = cv2.imread(src, cv2.IMREAD_UNCHANGED)
rgb = img[:, :, :3]
h, w = rgb.shape[:2]
gray = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY)
mask = (gray < 60).astype(np.uint8) * 255          # black skyline pixels
ys = np.where(mask.any(axis=1))[0]; xs = np.where(mask.any(axis=0))[0]
print("bbox", xs.min(), ys.min(), xs.max(), ys.max(), "of", w, h)
crop = mask[ys.min():ys.max()+1, xs.min():xs.max()+1]
cnts, hier = cv2.findContours(crop, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
ch, cw = crop.shape
paths = []
for c in cnts:
    if cv2.contourArea(c) < 30: continue
    c = cv2.approxPolyDP(c, 1.2, True)
    pts = c.reshape(-1, 2)
    paths.append("M" + " L".join(f"{x} {y}" for x, y in pts) + " Z")
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cw} {ch}"><path fill-rule="evenodd" d="{" ".join(paths)}"/></svg>'
open(out, "w").write(svg)
print("contours", len(paths), "bytes", len(svg), "size", cw, ch)
