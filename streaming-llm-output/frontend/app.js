const socket = io("http://localhost:3000");

let startTime = null;
const topic = "Redis";

function setDurationLabel() {
    const durationDiv = document.getElementById("duration");
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    durationDiv.innerText = duration;
}

function askQuestionWithoutStream(_question) {
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
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

function onChunkReceived(chunk) {
    const outputDiv = document.getElementById("output");
    outputDiv.innerHTML += chunk;

    if (chunk.match("START:")) {
        setDurationLabel();
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
        // Use socket to emit the question
        socket.emit("askQuestion", {
            topic: topic,
            topicQuestion: question,
        });
    }
}

function onPageLoad() {
    socket.on("chunk", (chunk) => {
        console.log("chunk:", chunk);
        onChunkReceived(chunk);
    });
}

