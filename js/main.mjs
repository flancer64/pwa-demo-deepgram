// MODULE'S IMPORT
import {Deepgram} from './lib/deepgram.browser.sdk.mjs';

// MODULE'S VARS
const CSS_INFO = 'info';
const DATA_API = 'apiKey';
const DATA_LANG = 'lang';
const DEF_LANG = 'en';
const DEF_TIME_SLICE = 500; // send audio to Deepgram every X milliseconds
const DEF_TIMEOUT_STOP = 60000; // stop recording to prevent timeless spending of Deepgram fund
const ID_API_KEY = 'txtApiKey';
const ID_BTN_HELP = 'btnHelp';
const ID_BTN_START = 'btnStart';
const ID_BTN_STOP = 'btnStop';
const ID_HEADER_LAST = 'headerLast';
const ID_LANG = 'txtLang';
const STORE_CONFIG = 'config';
const URL_HELP = 'https://flancer32.com/6fa4068878e0';

let deepgramSocket;
/** @type {MediaRecorder} */
let mediaRecorder;
let timer;

const _formatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
});

// MODULE'S FUNCS

/**
 * Change buttons enabled/disabled state.
 * @param {boolean} ifActive
 */
function buttonsState(ifActive) {
    const elStart = document.getElementById(ID_BTN_START);
    const elStop = document.getElementById(ID_BTN_STOP);
    elStart.disabled = Boolean(ifActive);
    elStop.disabled = !elStart.disabled;
}

/**
 * Print information message on UI.
 * @param {string} msg
 */
function printInfo(msg) {
    console.log(msg);
    document.querySelector(`.${CSS_INFO}`).innerText = msg;
}

/**
 * Print transcription from Deepgram response to UI.
 * @param {Object} dgResp
 */
function printResult(dgResp) {
    // print out full data to console
    console.log(dgResp);
    // get data from Deepgram response
    const start = _formatter.format(dgResp?.start);
    const duration = _formatter.format(dgResp?.duration);
    const transcript = dgResp?.channel?.alternatives[0]?.transcript;
    if (transcript) {
        // add log record to results (text => duration => start)
        const elHead = document.getElementById(ID_HEADER_LAST);
        // text
        const elText = document.createElement('div');
        elText.innerText = transcript;
        elHead.after(elText);
        // duration
        const elDuration = document.createElement('div');
        elDuration.innerText = duration;
        elHead.after(elDuration);
        // start
        const elStart = document.createElement('div');
        elStart.innerText = start;
        elHead.after(elStart);
    }
}

/**
 * Initialize UI on application start.
 */
async function initUi() {
    buttonsState(false);
    // add event listeners to buttons
    document.getElementById(ID_BTN_HELP).addEventListener('click', onHelp);
    document.getElementById(ID_BTN_START).addEventListener('click', onStart);
    document.getElementById(ID_BTN_STOP).addEventListener('click', onStop);
    // load configuration form local storage
    const json = localStorage.getItem(STORE_CONFIG);
    if (json) {
        const config = JSON.parse(json);
        document.getElementById(ID_API_KEY).value = config[DATA_API];
        document.getElementById(ID_LANG).value = config[DATA_LANG] ?? DEF_LANG;
    } else {
        document.getElementById(ID_LANG).value = DEF_LANG;
    }
}

function onHelp() {
    window.open(URL_HELP, '_blank');
}

function onStart() {
    // VARS
    const API_KEY = document.getElementById(ID_API_KEY).value;
    const LANG = document.getElementById(ID_LANG).value;

    // FUNCS

    /**
     * Clean 'results' block on UI.
     */
    function cleanResults() {
        const elHead = document.getElementById(ID_HEADER_LAST);
        while (elHead.nextElementSibling)
            elHead.nextElementSibling.remove();
    }

    /**
     * @param {MessageEvent} message
     */
    function onSocketMessage(message) {
        const received = JSON.parse(message.data);
        printResult(received);
    }

    function onSocketOpen() {
        // FUNCS

        /**
         * @param {MediaStream} stream
         */
        function processMediaStream(stream) {
            mediaRecorder = new MediaRecorder(stream, {
                audioBitsPerSecond: 128000,
                mimeType: 'audio/webm',
            });
            mediaRecorder.addEventListener('dataavailable', async (event) => {
                if (event.data.size > 0 && deepgramSocket.readyState === 1) {
                    deepgramSocket.send(event.data);
                }
            });
            mediaRecorder.start(DEF_TIME_SLICE);
            printInfo(`Audio recording is started.`);
        }

        // MAIN
        printInfo(`Deepgram socket is opened.`);
        navigator.mediaDevices
            .getUserMedia({audio: true})
            .then(processMediaStream);
    }

    // MAIN
    printInfo(`"Start" button is pressed.`);
    buttonsState(true);
    cleanResults();
    try {
        // save config to localStore
        const config = {[DATA_API]: API_KEY, [DATA_LANG]: LANG};
        const json = JSON.stringify(config);
        localStorage.setItem(STORE_CONFIG, json);
        // open Deepgram socket
        const deepgram = new Deepgram(API_KEY);
        deepgramSocket = deepgram.transcription.live({
            punctuate: true,
            language: LANG,
        });
        deepgramSocket.addEventListener('open', onSocketOpen);
        deepgramSocket.addEventListener('message', onSocketMessage);
        // start timer to stop recording after 1 min. to prevent Deepgram extra payment
        timer = setTimeout(() => {
            printInfo(`Stop STT processing on timeout (${DEF_TIMEOUT_STOP} ms).`);
            onStop();
        }, DEF_TIMEOUT_STOP);
    } catch (e) {
        printInfo(e.message);
    }
}

function onStop() {
    // FUNCS
    /**
     * @param {MediaRecorder} rec
     */
    function stopRecorder(rec) {
        if (
            (typeof rec?.stop === 'function') &&
            (rec?.state !== 'inactive')
        ) rec.stop();
        // close audio stream
        const tracks = rec?.stream?.getTracks() ?? [];
        tracks.forEach((track) => track.stop());
    }

    // MAIN
    printInfo(`Stop STT processing.`);
    if (timer) clearTimeout(timer);
    if (typeof deepgramSocket?.finish == 'function') deepgramSocket.finish();
    buttonsState(false);
    stopRecorder(mediaRecorder);
}

// MAIN
export {
    initUi,
}