const socket = io("http://localhost:3000");

let startTime = null;
const topic = "Redis";

function showLoader(isShow) {
    const loaderDiv = document.getElementById("loader");
    if (isShow) {
        loaderDiv.style.display = "flex";
    }
    else {
        loaderDiv.style.display = "none";
    }
}

function setDurationLabel() {
    const durationDiv = document.getElementById("duration");
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    durationDiv.innerText = duration;
}

function askQuestionWithoutStream(_question) {
    showLoader(true);

    fetch("http://localhost:3000/askQuestionWithoutStream", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            topic: topic,
            topicQuestion: _question,
        }),
    })
        .then((response) => response.json())
        .then((data) => {
            const outputDiv = document.getElementById("output");
            // Append API response to the DOM
            outputDiv.innerHTML = data.output;

            setDurationLabel();
            showLoader(false);
        })
        .catch((error) => {
            showLoader(false);
            console.error("Error:", error);
        });
}

function onChunkReceived(chunk) {
    const outputDiv = document.getElementById("output");
    outputDiv.innerHTML += chunk;

    if (chunk.match("START:")) {
        setDurationLabel();
        // showLoader(false);
    }
    if (chunk.match("START:") || chunk.match("END:")) {
        showLoader(false);
    }
}

function onSearch() {
    const outputDiv = document.getElementById("output");
    const durationDiv = document.getElementById("duration");

    const question = document.getElementById("question").value;
    const isWithoutStream = document.getElementById("withoutStream").checked;
    startTime = new Date();

    // Clear previous output
    outputDiv.innerHTML = "";
    durationDiv.innerText = "";

    if (isWithoutStream) {
        // Call the /askQuestionWithoutStream API
        askQuestionWithoutStream(question);

    } else {
        showLoader(true);
        // Use socket to emit the question
        socket.emit("askQuestion", {
            topic: topic,
            topicQuestion: question,
        });
    }
}

function onPageLoad() {
    showLoader(false);

    socket.on("chunk", (chunk) => {
        console.log("chunk:", chunk);
        onChunkReceived(chunk);
    });

    socket.on('connect', () => {
        //say reconnect
        console.log('Connected to server');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    socket.on('error', (error) => {
        console.log('Socket error:', error);
    });
}

