// ==UserScript==
// @name         YouTube 捲動自動浮動小窗 (v5.20 精準局部排版優化版)
// @namespace    http://tampermonkey.net/
// @version      5.20
// @description  基於 100% 成功的 5.16 Final 核心。僅對影片原位「局部外殼」實施寬高限制，完美保護頂部橫幅，排版絕不塌陷過寬
// @author       AI Assistant
// @match        https://*.youtube.com/watch*
// @icon         https://www.google.com/s2/favicons?domain=youtube.com
// @grant        none
// @run-at       document-end
// ==/UserScript== 

(function() {
'use strict'; 

// 定義所有可切換的尺寸（從大到小排列，與 Final 版完全一致）
const sizes = [
{ w: 1000, h: 562 }, // 0: 最大尺寸（預設初始尺寸）
{ w: 850,  h: 478 }, // 1
{ w: 700,  h: 394 }, // 2
{ w: 550,  h: 310 }, // 3
{ w: 400,  h: 225 }  // 4: 最小尺寸（紅框就是這個大小）
];

let sizeIndex = 0;

const style = document.createElement('style');
style.innerHTML = `
/* 1. 浮動小窗大容器 - 完全沿用 Final 版 */
.force-bili-pip {
position: fixed !important;
bottom: 24px !important;
right: 24px !important;
width: 1000px !important;
height: 562px !important;
z-index: 2147483647 !important;
box-shadow: 0px 10px 40px rgba(0,0,0,0.6) !important;
border-radius: 12px !important;
background-color: #000 !important;
transition: none !important;
animation: none !important;
transform: none !important;
}
.force-bili-pip.user-zooming {
    transition: width 0.12s ease-out, height 0.12s ease-out !important;
}

/* 提示字樣 */
.force-bili-pip::before {
    content: "提示: 按住 Ctrl + 滑鼠滾輪 可縮放大小";
    position: absolute;
    top: -25px;
    right: 10px;
    background: rgba(0,0,0,0.8);
    color: #fff;
    padding: 2px 8px;
    font-size: 11px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
    z-index: 2147483647;
}
.force-bili-pip:hover::before {
    opacity: 1;
}

/* 2. 解鎖阻先節點 */
.yt-pip-parent-unlock {
    z-index: 99999 !important;
    overflow: visible !important;
}

/* 【核心修改：高隔離度局部尺寸優化】 */
/* 我們絕對不對通用 div 下達 transparent，而是指名道姓針對 YouTube 的影片原生大盒子（ytd-player 與 #player-container）進行寬高約束 */
/* 這樣做能 100% 繞開頂部橫幅 ytd-masthead，確保導覽列絕對不會變透明，同時強制原位黑框縮小不占寬度 */
ytd-player.yt-pip-parent-unlock,
#player-container.yt-pip-parent-unlock,
#player-container-outer.yt-pip-parent-unlock,
#player-theater-container.yt-pip-parent-unlock {
    max-height: 562px !important;     /* 高度強制收緊在標準 16:9 內 */
    max-width: 100% !important;       /* 寬度強制限制，防止劇院模式下橫向無限撐大 */
    width: 100% !important;           /* 寬度收緊 */
    height: auto !important;
    min-height: 0 !important;
    padding-bottom: 0 !important; 
    margin-bottom: 0 !important;
    background: transparent !important; /* 只讓這幾個播放器黑底變透明 */
    box-shadow: none !important;
}

/* 3. 強制小窗內的所有影音容器填滿 */
.force-bili-pip video,
.force-bili-pip .html5-video-container {
    width: 100% !important;
    height: 100% !important;
    left: 0 !important;
    top: 0 !important;
    object-fit: contain !important;
    transform: none !important; 
    transition: none !important;
    animation: none !important;
}

.force-bili-pip .ytp-chrome-bottom {
    width: 96% !important;
    left: 2% !important;
    height: 40px !important;
    top: auto !important;
    bottom: 0 !important;
    transition: none !important;
}

.force-bili-pip #cinematic, 
.force-bili-pip .ytp-glow-effect,
.force-bili-pip canvas {
    display: none !important;
    opacity: 0 !important;
}

/* 4. 半透明紅框預覽元件 */
.pip-min-size-preview {
    position: absolute !important;
    bottom: 0 !important;
    right: 0 !important;
    width: 400px !important;
    height: 225px !important;
    border: 3px solid rgba(255, 0, 0, 0.8) !important;
    background-color: rgba(255, 0, 0, 0.15) !important; 
    border-radius: 0 0 12px 0 !important;
    box-sizing: border-box !important;
    display: none !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
}

.pip-min-size-preview::after {
    content: "⤡" !important; 
    position: absolute !important;
    top: 6px !important;     
    left: 8px !important;    
    background: none !important;
    border: none !important;
    box-shadow: none !important;
    color: rgba(255, 0, 0, 0.28) !important;
    text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.4) !important;
    font-size: 22px !important; 
    font-weight: bold !important;
}

.force-bili-pip.show-preview .pip-min-size-preview {
    display: block !important;
}

`;
document.head.appendChild(style);

// 【完全回歸 Final 版最穩定的 JavaScript 坐標偵測核心】
function toggleParentUnlock(element, add) {
let parent = element.parentElement;
while (parent && parent.tagName !== 'BODY') {
if (add) {
parent.classList.add('yt-pip-parent-unlock');
} else {
parent.classList.remove('yt-pip-parent-unlock');
}
parent = parent.parentElement;
}
}

function updatePipSize(player, direction) {
if (direction === 'zoomIn') {
if (sizeIndex > 0) {
sizeIndex--;
} else {
return;
}
} else if (direction === 'zoomOut') {
if (sizeIndex < sizes.length - 1) {
sizeIndex++;
} else {
return;
}
}
player.classList.add('user-zooming');
player.style.setProperty('width', `${sizes[sizeIndex].w}px`, 'important');
player.style.setProperty('height', `${sizes[sizeIndex].h}px`, 'important');
window.dispatchEvent(new Event('resize'));

}

function handleKeyDown(e, player) {
if (e.key === 'Control') {
player.classList.add('show-preview');
}
}

function handleKeyUp(e, player) {
if (e.key === 'Control') {
player.classList.remove('show-preview');
}
}

window.addEventListener('scroll', () => {
const videoElement = document.querySelector('video');
const playerContainer = document.querySelector('#player-container-outer, #player-container, ytd-player');
if (!videoElement || !playerContainer) return;

const containerRect = playerContainer.getBoundingClientRect();
const actualPlayer = videoElement.closest('.html5-video-player');

if (!actualPlayer) return;

if (containerRect.bottom < 0) {
    if (!actualPlayer.classList.contains('force-bili-pip')) {
        actualPlayer.classList.add('force-bili-pip');
        toggleParentUnlock(actualPlayer, true);

        let previewBox = actualPlayer.querySelector('.pip-min-size-preview');
        if (!previewBox) {
            previewBox = document.createElement('div');
            previewBox.className = 'pip-min-size-preview';
            actualPlayer.appendChild(previewBox);
        }

        actualPlayer.onwheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                if (e.deltaY < 0) {
                    updatePipSize(actualPlayer, 'zoomIn');  
                } else {
                    updatePipSize(actualPlayer, 'zoomOut'); 
                }
            }
        };

        window.addEventListener('keydown', (e) => handleKeyDown(e, actualPlayer));
        window.addEventListener('keyup', (e) => handleKeyUp(e, actualPlayer));
        
        actualPlayer.onmouseleave = () => {
            actualPlayer.classList.remove('show-preview');
        };

        window.dispatchEvent(new Event('resize'));
    }
} else {
    if (actualPlayer.classList.contains('force-bili-pip')) {
        actualPlayer.classList.remove('force-bili-pip');
        actualPlayer.classList.remove('user-zooming');
        actualPlayer.classList.remove('show-preview');
        toggleParentUnlock(actualPlayer, false);
        
        actualPlayer.onwheel = null;
        actualPlayer.onmouseleave = null;
        window.removeEventListener('keydown', (e) => handleKeyDown(e, actualPlayer));
        window.removeEventListener('keyup', (e) => handleKeyUp(e, actualPlayer));
        
        const previewBox = actualPlayer.querySelector('.pip-min-size-preview');
        if (previewBox) previewBox.remove();

        sizeIndex = 0;
        actualPlayer.style.removeProperty('width');
        actualPlayer.style.removeProperty('height');

        window.dispatchEvent(new Event('resize'));
    }
}

});

})();
