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


document.getElementById("nereus_dev").addEventListener("click", async function() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => { 
            const video = document.querySelector('video');
            if (video) {
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
    let displayedTimeout = undefined;
    
    if (!video) {
        alert('No video element found!');
        return;
    }

    // Inject the timer
    video.parentElement.style.position = "relative";
    const timer = document.createElement("div")
    timer.style.position = "absolute"
    timer.style = "position: absolute; top: 5px; right: 5px; background-color: #000; color: #fff; padding: 5px; border-radius: 5px; z-index: 1000; opacity: 1; font-size: .85rem;"
    video.parentElement.appendChild(timer)

    timer.innerText = '0:00';

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
        let timeSeconds = duration * 60;
        recordingTimeout = setTimeout(() => {
            console.log("stopping")
            mediaRecorder.stop();
            clearInterval(displayedTimeout);
            timer.innerText = 'Stopped';
            chrome.runtime.sendMessage({ message: "stop recording" });
        }, timeSeconds * 1000); // Convert seconds to milliseconds
        
        let timeLeft = timeSeconds;
        displayedTimeout = setInterval(() => {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timer.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }, 1000);
    }else {
        let timeRecording = 0;
        displayedTimeout = setInterval(() => {
            timeRecording++;
            const minutes = Math.floor(timeRecording / 60);
            const seconds = timeRecording % 60;
            timer.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }, 1000);
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
        if(recordingTimeout){ 
            clearTimeout(recordingTimeout); 
        }
        clearInterval(displayedTimeout);
        timer.innerText = 'Stopped';
    })

    mediaRecorder.start();
    return true
}