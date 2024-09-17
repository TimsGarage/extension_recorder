let mediaRecorder;
let chunks = [];
let recordingTimeout;

const recordButton = document.getElementById('nereus_recordButton');

if(localStorage.getItem('recording') === 'true') {
    document.getElementById('nereus_recordButton').disabled = true;
    document.getElementById('nereus_durationInput').disabled = true;
    document.getElementById('nereus_statusMessage').innerText = 'Recording...';
}

document.getElementById("nereus_resetButton").addEventListener("click", async function() {
    localStorage.setItem('recording', 'false');
    document.getElementById('nereus_recordButton').disabled = false;
    document.getElementById('nereus_durationInput').disabled = false;
    document.getElementById('nereus_statusMessage').innerText = 'Ready to record';
});

document.getElementById("nereus_controlsButton").addEventListener("click", async function() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => { 
            const video = document.querySelector('video');
            if (video) {
                video.controls = true;
                // Remove all neighboring html elements
                const elements = Array.from(video.parentElement.children);
                elements.forEach((element) => {
                    if (element !== video) {
                        element.remove();
                    }
                });
            }
        }
    });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log(sender.tab ?
                "from a content script:" + sender.tab.url :
                "from the extension");
    if (request.message === "stop recording") {
        localStorage.setItem('recording', 'false');
        document.getElementById('nereus_recordButton').disabled = false;
        document.getElementById('nereus_durationInput').disabled = false;
        document.getElementById('nereus_statusMessage').innerText = 'Recording stopped';
    }
});

recordButton.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const duration = document.getElementById('nereus_durationInput').value || 0;
    
    document.getElementById('nereus_statusMessage').innerText = 'Recording...';
    document.getElementById('nereus_recordButton').disabled = true;
    document.getElementById('nereus_durationInput').disabled = true;

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: startRecording,
        args: [parseInt(duration)]
    }).then((res) => {
        console.log(res);
        localStorage.setItem('recording', 'true');
    }).catch((err) => {
        console.error(err);
    });
});

function startRecording(duration) {
    const video = document.querySelector('video');
    
    if (!video) {
        alert('No video element found!');
        return;
    }

    const stream = video.captureStream();
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    
    console.log("recording for " + duration + " seconds")
    recordingTimeout = setTimeout(() => {
        console.log("stopping")
        mediaRecorder.stop();
        // Send a message to the background script
        chrome.runtime.sendMessage({ message: "stop recording" });
    }, duration * 1000); // Convert seconds to milliseconds

    mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'recorded-video.mp4';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    };

    video.addEventListener("pause", (e) => {
        console.log("video paused")
        mediaRecorder.stop();
        clearTimeout(recordingTimeout);
        chrome.runtime.sendMessage({ message: "stop recording" });
    })

    mediaRecorder.start();
    return true
}