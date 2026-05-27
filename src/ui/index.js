function clearError() {
    document.getElementById("browser_input_error_label").style.display = "none";
    document.getElementById("other_input_error_label").style.display = "none";
    document.getElementById("browser_input_required_label").style.display = "none";
    document.getElementById("other_input_required_label").style.display = "none";
}

function generateShortUrl() {
    clearError();

    const browserText = document.querySelector("#browser-url-input").value;
    const otherText = document.querySelector("#other-url-input").value;
    const size = 256;
    const foreground = "#000000";
    const background = "#ffffff";

    if (browserText.trim() === "") {
        document.getElementById("browser_input_required_label").style.display = "block";
        return;
    }
    if (otherText.trim() === "") {
        document.getElementById("other_input_required_label").style.display = "block";
        return;
    }

    fetch('/api/shorten', {
        method: 'POST',
        body: JSON.stringify({ browserUrl: browserText, otherUrl: otherText }),
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        if (response.status !== 200) {
            return response.json().then(error => {
                document.getElementById("browser_input_error_label").textContent = `${error.error}`;
                document.getElementById("browser_input_error_label").style.display = "block";
                throw new Error(`${response.status} ${response.statusText} ${error.error}`);
            });
        }
        return response.json();
    })
    .then(data => {
        var shortUrl = data.shortUrl;
        const outputList = document.getElementById("output-list");
        const mockCard = document.getElementById("mock-card");

        const newCard = mockCard.cloneNode(true);
        newCard.style.display = "block";
        newCard.classList.add("fade-in-up");

        const browserField = newCard.querySelector("input[name='browser_text']");
        const otherField = newCard.querySelector("input[name='other_text']");
        const outputField = newCard.querySelector("input[name='output_text']");
        const copyButton = newCard.querySelector(".copybutton");

        browserField.value = browserText;
        otherField.value = otherText;
        outputField.value = shortUrl;

        copyButton.addEventListener("click", () => {
            outputField.select();
            document.execCommand("copy");
        });

        const qrCodeContainer = newCard.querySelector(".qrcode");
        qrCodeContainer.innerHTML = "";
        new QRCode(qrCodeContainer, {
            text: shortUrl,
            width: size,
            height: size,
            colorDark: foreground,
            colorLight: background
        });

        outputList.insertBefore(newCard, outputList.firstChild);
    })
    .catch(error => {
        console.error(error);
    });
}

document.querySelector("#gen").addEventListener("click", () => {
    generateShortUrl();
});
