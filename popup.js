let chunks = [];

const recordButton = document.getElementById('nereus_recordButton');

if(localStorage.getItem('recording') === 'true') {
    document.getElementById('nereus_recordButton').disabled = true;
    document.getElementById('nereus_stopButton').disabled = false;
    document.getElementById('nereus_durationInput').disabled = true;
    document.getElementById('nereus_statusMessage').innerText = 'Recording...';
}

document.getElementById("nereus_resetButton").addEventListener("click", async function() {
    localStorage.setItem('recording', 'false');
    document.getElementById('nereus_recordButton').disabled = false;
    document.getElementById('nereus_stopButton').disabled = true;
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
                // video.parentElement.style.position = "relative";
                const elements = Array.from(video.parentElement.children);
                elements.forEach((element) => {
                    if (element !== video) {
                        element.remove();
                    }
                });
                // const button = document.createElement("button")
                // button.textContent = "Clickedi"
                // button.style.position = "absolute"
                // button.style = "position: absolute; top: 0; right: 0;"
                // video.parentElement.appendChild(button)
            }
        }
    });
});

document.getElementById("nereus_stopButton").addEventListener("click", async function() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => { 
            const video = document.querySelector('video');
            if (video) {
                video.pause();
                video.play();
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
        document.getElementById('nereus_stopButton').disabled = true;
        document.getElementById('nereus_durationInput').disabled = false;
        document.getElementById('nereus_statusMessage').innerText = 'Recording stopped';
    }
});

recordButton.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const duration = document.getElementById('nereus_durationInput').value || 0;
    
    document.getElementById('nereus_statusMessage').innerText = 'Recording...';
    document.getElementById('nereus_recordButton').disabled = true;
    document.getElementById('nereus_stopButton').disabled = false;
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
    let recordingTimeout = undefined;
    
    if (!video) {
        alert('No video element found!');
        return;
    }

    const options = {
        mimeType: 'video/webm; codecs=vp8',
        videoBitsPerSecond: 2500000, // Adjust bitrate as needed
    };
    const stream = video.captureStream();
    let mediaRecorder = new MediaRecorder(stream, options);
    let chunks = [];
    
    console.log("Recording till stop is pressed")
    if(duration != 0) {
        console.log("Recording for " + duration + " seconds")
        recordingTimeout = setTimeout(() => {
            console.log("stopping")
            mediaRecorder.stop();
            chrome.runtime.sendMessage({ message: "stop recording" });
        }, duration * 1000 * 60); // Convert seconds to milliseconds
    }

    mediaRecorder.ondataavailable = (event) => {
        if(event.data.size > 0) {
            chunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'recorded-video.webm';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    };

    video.addEventListener("pause", (e) => {
        console.log("video stopped due to pause")
        mediaRecorder.stop();
        chrome.runtime.sendMessage({ message: "stop recording" });
        if(recordingTimeout){ clearTimeout(recordingTimeout); }
    })

    mediaRecorder.start();
    return true
}