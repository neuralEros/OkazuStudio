(function () {
    function toProportion(val, total) {
        if (!total || total === 0) return 0;
        return val / total;
    }

    function toPixels(prop, total) {
        return prop * total;
    }

    function rotatePoint(p, cx, cy, angleDeg) {
        const rad = angleDeg * Math.PI / 180;
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const dx = p.x - cx;
        const dy = p.y - cy;
        return {
            x: cx + (dx * c - dy * s),
            y: cy + (dx * s + dy * c)
        };
    }

    function getRotatedAABB(w, h, angleDeg) {
        const cx = w / 2;
        const cy = h / 2;
        // Corners: TL, TR, BR, BL
        const corners = [
            { x: 0, y: 0 },
            { x: w, y: 0 },
            { x: w, y: h },
            { x: 0, y: h }
        ].map(p => rotatePoint(p, cx, cy, angleDeg));

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        corners.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
        return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
    }

    function truthToVisualCoords(tx, ty, rot, fullW, fullH) {
        if (rot === 0) return { x: tx, y: ty };
        if (rot === 90) return { x: fullH - ty, y: tx };
        if (rot === 180) return { x: fullW - tx, y: fullH - ty };
        if (rot === 270) return { x: ty, y: fullW - tx };
        return { x: tx, y: ty };
    }

    function visualToTruthCoords(vx, vy, rot, fullW, fullH) {
        let tx = vx;
        let ty = vy;

        if (rot === 90) {
            // Visual X is Truth Y. Visual Width is Truth Height.
            // Origin (0,0) visual is Top-Right of Truth (rotated).
            // tx = vy
            // ty = fh - vx
            tx = vy;
            ty = fullH - vx;
        } else if (rot === 180) {
            tx = fullW - vx;
            ty = fullH - vy;
        } else if (rot === 270) {
            tx = fullW - vy;
            ty = vx;
        }
        return { x: tx, y: ty };
    }

    function truthToVisualRect(r, rot, fullW, fullH) {
        if (rot === 0) return { ...r };
        let vx = r.x, vy = r.y, vw = r.w, vh = r.h;
        if (rot === 90) {
            vx = fullH - (r.y + r.h);
            vy = r.x;
            vw = r.h;
            vh = r.w;
        } else if (rot === 180) {
            vx = fullW - (r.x + r.w);
            vy = fullH - (r.y + r.h);
        } else if (rot === 270) {
            vx = r.y;
            vy = fullW - (r.x + r.w);
            vw = r.h;
            vh = r.w;
        }
        return { x: vx, y: vy, w: vw, h: vh };
    }

    function visualToTruthRect(v, rot, fullW, fullH) {
        if (rot === 0) return { ...v };
        let tx = v.x, ty = v.y, tw = v.w, th = v.h;

        // Inverse logic
        if (rot === 90) {
            // v.x = H - (t.y + t.h)  =>  t.y + t.h = H - v.x  => t.y = H - v.x - t.h
            // v.y = t.x              =>  t.x = v.y
            // v.w = t.h              =>  t.h = v.w
            // v.h = t.w              =>  t.w = v.h
            tw = v.h;
            th = v.w;
            tx = v.y;
            ty = fullH - v.x - th;
        } else if (rot === 180) {
            // v.x = W - (t.x + t.w) => t.x = W - v.x - t.w
            // v.y = H - (t.y + t.h) => t.y = H - v.y - t.h
            tx = fullW - v.x - tw;
            ty = fullH - v.y - th;
        } else if (rot === 270) {
            // v.x = t.y             => t.y = v.x
            // v.y = W - (t.x + t.w) => t.x = W - v.y - t.w
            tw = v.h;
            th = v.w;
            ty = v.x;
            tx = fullW - v.y - tw;
        }
        return { x: tx, y: ty, w: tw, h: th };
    }

    window.Geometry = {
        rotatePoint,
        getRotatedAABB,
        visualToTruthCoords,
        truthToVisualCoords,
        truthToVisualRect,
        visualToTruthRect,
        toProportion,
        toPixels
    };
})();
