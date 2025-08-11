// popup.js
// Khi người dùng bấm nút "Scan board", popup sẽ:
// 1) tìm tab hiện tại
// 2) gửi message {type: "getBoard"} tới content script
// 3) nhận về matrix và hiển thị

document.addEventListener("DOMContentLoaded", function () {
    const status = document.getElementById("status");
    const highlightBtn = document.getElementById("highlightBtn");
    const autoSuggest = document.getElementById("autoSuggest");

    // Khôi phục trạng thái auto từ localStorage
    autoSuggest.checked = localStorage.getItem('autoSuggest') === 'true';

    // Lưu trạng thái mỗi khi thay đổi và gửi yêu cầu bật/tắt auto tới content script
    autoSuggest.addEventListener('change', function () {
        localStorage.setItem('autoSuggest', autoSuggest.checked ? 'true' : 'false');
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs || tabs.length === 0) return;
            const tabId = tabs[0].id;
            chrome.tabs.sendMessage(tabId, { type: autoSuggest.checked ? "startAutoHighlight" : "stopAutoHighlight" });
        });
    });

    function showSpinner(show) {
        const spinner = document.getElementById("spinner");
        if (spinner) spinner.style.display = show ? "inline-block" : "none";
    }
    function sendHighlight() {
        showSpinner(true);
        status.textContent = "Đang gửi yêu cầu highlight...";
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs || tabs.length === 0) {
                showSpinner(false);
                status.textContent = "Không tìm thấy tab active.";
                return;
            }
            const tabId = tabs[0].id;
            chrome.tabs.sendMessage(tabId, { type: "highlightPair" }, function (response) {
                showSpinner(false);
                if (response && response.ok) {
                    status.innerHTML = '<span style="color:#2ecc40;font-weight:bold;">Đã highlight!</span>';
                } else {
                    status.textContent = "Không highlight được!";
                }
            });
        });
    }
    highlightBtn.addEventListener("click", sendHighlight);

    // Khi mở popup, nếu autoSuggest đang bật thì gửi yêu cầu bật auto tới content script
    if (autoSuggest.checked) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs || tabs.length === 0) return;
            const tabId = tabs[0].id;
            chrome.tabs.sendMessage(tabId, { type: "startAutoHighlight" });
        });
    }
});
