// ==UserScript==
// @name         Gemini Media Saver (Eng)
// @namespace    http://tampermonkey.net/
// @version      2.5
// @description  Added: persistence of button states after page reload (using localStorage)
// @author       Gemini AI
// @match        https://gemini.google.com/*
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    const iconPhotoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width:18px; height:18px; margin-right:8px;"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0-33-23.5-56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z"/></svg>`;
    const iconTextSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width:18px; height:18px; margin-right:8px;"><path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-560v-160H240v640h480v-480H520ZM240-800v160-160 640-640Z"/></svg>`;

    // Load saved data from localStorage on start
    const STORAGE_KEY = 'gemini_saved_media';
    const savedData = localStorage.getItem(STORAGE_KEY);
    const downloadedMedia = new Set(savedData ? JSON.parse(savedData) : []);

    // Function to save state
    function persistData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(downloadedMedia)));
    }

    function getFormattedTimestamp() {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        return `${date}_${time}`;
    }

    const downloadFile = (url, fileName) => {
        GM_download({
            url: url,
            name: `Gemini/${fileName}`,
            saveAs: false,
            onerror: (err) => console.error("Download error:", err)
        });
    };

    function processElements() {
        // --- 1. PHOTOS ---
        const chatImages = document.querySelectorAll('model-response img, .model-response img');
        chatImages.forEach((img) => {
            if (img.width < 150 || img.closest('.ql-sidebar') || img.closest('mat-sidenav')) return;

            // Use URL as unique key
            const mediaKey = img.src;
            let existingBtn = img.parentElement.querySelector('.gemini-img-save-btn');
            const isSaved = downloadedMedia.has(mediaKey);

            if (existingBtn) {
                if (isSaved && existingBtn.querySelector('span').innerText !== 'Done') {
                    existingBtn.querySelector('span').innerText = 'Done';
                    existingBtn.style.background = '#0d47a1';
                }
                return;
            }

            const imgBtn = document.createElement('button');
            imgBtn.className = 'gemini-img-save-btn';
            imgBtn.innerHTML = `${iconPhotoSVG} <span>${isSaved ? 'Done' : 'Save Photo'}</span>`;
            imgBtn.style.cssText = `
                position: absolute; bottom: 5px; right: 5px; z-index: 1000;
                display: flex; align-items: center; justify-content: center;
                background: ${isSaved ? '#0d47a1' : 'rgba(30, 31, 32, 1)'}; color: white; border: 0px;
                padding: 6px 12px; cursor: pointer; border-radius: 12px; font-size: 12px;
                backdrop-filter: blur(4px); transition: all 0.2s; font-family: "Google Sans", sans-serif;
            `;

            img.parentElement.style.position = 'relative';
            img.parentElement.appendChild(imgBtn);

            imgBtn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                if (downloadedMedia.has(mediaKey)) return;
                downloadFile(img.src, `gemini_photo_${getFormattedTimestamp()}.png`);
                downloadedMedia.add(mediaKey);
                persistData();
                imgBtn.querySelector('span').innerText = 'Done';
                imgBtn.style.background = '#0d47a1';
            };
        });

        // --- 2. TEXT ---
        const responses = document.querySelectorAll('model-response');
        responses.forEach((resp) => {
            const textTarget = resp.querySelector('.model-response-text, .markdown, [data-test-id="model-response-text"]');
            if (!textTarget || textTarget.querySelector('img')) return;

            // Key based on first 50 chars
            const textKey = "text_" + textTarget.innerText.substring(0, 50).replace(/\s/g, '_');
            let existingTxtBtn = resp.querySelector('.gemini-txt-save-btn');
            const isSaved = downloadedMedia.has(textKey);

            if (existingTxtBtn) {
                if (isSaved && existingTxtBtn.querySelector('span').innerText !== 'Saved') {
                    existingTxtBtn.querySelector('span').innerText = 'Saved';
                    existingTxtBtn.style.background = '#2e7d32';
                }
                return;
            }

            let tempText = textTarget.innerText;
            textTarget.querySelectorAll('button').forEach(b => { tempText = tempText.replace(b.innerText, ''); });
            if (tempText.trim().length < 10) return;

            const txtBtn = document.createElement('button');
            txtBtn.className = 'gemini-txt-save-btn';
            txtBtn.innerHTML = `${iconTextSVG} <span>${isSaved ? 'Saved' : 'Save Text'}</span>`;
            txtBtn.style.cssText = `
                display: inline-flex; align-items: center; margin: 15px 0 10px 0;
                padding: 7px 15px; cursor: pointer; background: ${isSaved ? '#2e7d32' : '#1e1e1e'};
                border: 0px; color: #e3e3e3; border-radius: 12px;
                font-size: 12px; transition: background 0.2s; font-family: "Google Sans", sans-serif;
            `;

            textTarget.appendChild(txtBtn);

            txtBtn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                if (downloadedMedia.has(textKey)) return;

                const finalOutput = textTarget.innerText.replace('Save Text', '').replace('Saved', '').trim();
                const blob = new Blob([finalOutput], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);

                downloadFile(url, `gemini_answer_${getFormattedTimestamp()}.txt`);
                downloadedMedia.add(textKey);
                persistData();

                txtBtn.querySelector('span').innerText = 'Saved';
                txtBtn.style.background = '#2e7d32';
            };
        });
    }

    const observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                processElements();
                break;
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    processElements();

})();
