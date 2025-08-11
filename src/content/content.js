// content.js

// Script chạy trực tiếp trong trang web (content script).
// Nhiệm vụ: tìm container bàn chơi, đọc từng ô, lấy src của <img> hoặc xác định ô bị ẩn,
// chuyển src thành số (ví dụ "pieces32.png" -> 32) hoặc -1 nếu ô bị xóa (visibility:hidden),
// sắp xếp theo HÀNG (top tăng dần) rồi CỘT (left tăng dần) để tạo ra ma trận 2D.


// Tạo vùng tên để tránh xung đột biến toàn cục
(function () {
    if (window.frameElement && window.frameElement.id !== "fullscreen") {
        // Không phải iframe game -> thoát
        return;
    }

    if (window.__pikachu_helper_injected) {
        // Đã inject rồi, không chạy lại
        return;
    }
    window.__pikachu_helper_injected = true;

    // Bản đồ để gán id fallback nếu không tìm được số trong tên file
    const fallbackMap = {};       // { "filename.png": 1001, ... }
    let nextFallbackId = 1000;    // bắt đầu cấp id fallback từ 1000

    // --- HÀM HỖ TRỢ ----------------------------------------------
    /**
     * Chèn một vòng toàn số -1 bao quanh ma trận gốc
     * matrix: ma trận 2D số nguyên
     * Trả về ma trận mới đã pad
     */
    function padMatrixWithBorder(matrix) {
        if (!matrix || matrix.length === 0) return [];
        const rows = matrix.length;
        const cols = matrix[0].length;
        const newMatrix = [];
        // Thêm hàng trên cùng toàn -1
        newMatrix.push(Array(cols + 2).fill(-1));
        for (let i = 0; i < rows; i++) {
            newMatrix.push([-1, ...matrix[i], -1]);
        }
        // Thêm hàng dưới cùng toàn -1
        newMatrix.push(Array(cols + 2).fill(-1));
        return newMatrix;
    }

    /**
     * Lấy tên file từ src (bỏ path, bỏ query string)
     * ví dụ: "https://.../images/pieces32.png?abc" => "pieces32.png"
     */
    function normalizeFilename(src) {
        if (!src) return "";
        // loại bỏ query string và hash
        const noQuery = src.split("?")[0].split("#")[0];
        // lấy phần cuối sau dấu '/'
        const parts = noQuery.split("/");
        return parts[parts.length - 1] || noQuery;
    }

    /**
     * Cố gắng trích số từ tên file.
     * - Nếu filename dạng pieces32.png => trả về 32 (kiểu number)
     * - Nếu không tìm thấy => trả về null
     */
    function extractNumberFromFilename(filename) {
        if (!filename) return null;
        // tìm dãy số ngay trước phần mở rộng .png/.jpg/... (thông dụng)
        let m = filename.match(/(\d+)(?=\.[a-zA-Z]{1,5}$)/);
        if (m) return parseInt(m[1], 10);
        // nếu không match theo pattern trên, thử match bất kỳ số nào
        m = filename.match(/(\d+)/);
        if (m) return parseInt(m[1], 10);
        return null;
    }

    /**
     * Tìm container lớn chứa các ô (div position:absolute).
     * Chiến lược:
     *  - Duyệt tất cả các <div> trên page,
     *  - Chọn div có nhiều con là position:absolute nhất => rất có khả năng là board.
     * Trả về DOM element hoặc null nếu không tìm được.
     */
    function findBoardContainer() {
        // Ưu tiên tìm đúng container theo id/class
        const boardTd = document.getElementById('board');
        if (boardTd) {
            const relDiv = boardTd.querySelector('div[style*="position: relative"]');
            if (relDiv) return relDiv;
        }
        // Nếu không tìm thấy, fallback về cách cũ
        const allDivs = Array.from(document.querySelectorAll("div"));
        let best = null;
        let bestCount = 0;

        for (const d of allDivs) {
            // đếm số con trực tiếp của d mà có position:absolute (dùng getComputedStyle để an toàn)
            const children = Array.from(d.children);
            let absCount = 0;
            for (const c of children) {
                try {
                    const cs = window.getComputedStyle(c);
                    if (cs && cs.position === "absolute") absCount++;
                } catch (e) {
                    // lặp tiếp nếu lỗi getComputedStyle
                }
            }
            // chọn div có nhiều children absolute nhất
            if (absCount > bestCount) {
                bestCount = absCount;
                best = d;
            }
        }

        // nếu bestCount quá nhỏ (ví dụ < 10) có thể không phải board -> vẫn trả về best (hoặc null)
        return best;
    }

    /**
     * Hàm đọc từng ô từ container:
     * - Lấy left, top (số px)
     * - Lấy visibility (tính bằng getComputedStyle để chính xác)
     * - Nếu visibility === 'hidden' -> id = -1
     * - Ngược lại lấy img.src -> chuyển thành số (extractNumberFromFilename)
     * - Trả về mảng cell: { left: number, top: number, id: number, dom: HTMLElement }
     */
    function parseCellsFromContainer(container) {
        const result = [];
        if (!container) return result;

        // Chỉ lấy các div con position:absolute chứa <img>
        const children = Array.from(container.querySelectorAll('div[style*="position: absolute"]'));
        for (const child of children) {
            // tìm phần tử <img> bên trong ô (nếu không có img thì bỏ qua)
            const img = child.querySelector("img");
            if (!img) continue;

            // Lấy giá trị left/top từ style inline
            let left = 0;
            let top = 0;
            if (child.style && child.style.left) left = parseFloat(child.style.left);
            if (child.style && child.style.top) top = parseFloat(child.style.top);

            // Lấy visibility chính xác bằng computed style
            let visibility = "visible";
            try {
                visibility = (window.getComputedStyle(child).visibility || "visible").trim();
            } catch (e) {
                visibility = "visible";
            }

            // Nếu ô bị ẩn (người chơi đã chọn) => id = -1
            if (visibility === "hidden") {
                result.push({ left, top, id: -1, dom: child });
                continue;
            }

            // Nếu visible thì lấy src và trích số từ filename
            const filename = normalizeFilename(img.src);
            const num = extractNumberFromFilename(filename);

            if (num !== null) {
                // tìm được số rõ ràng => dùng số đó
                result.push({ left, top, id: num, dom: child });
            } else {
                // không tìm được số trong tên file -> dùng fallback mapping để gán id duy nhất
                if (!fallbackMap[filename]) {
                    fallbackMap[filename] = nextFallbackId++;
                }
                result.push({ left, top, id: fallbackMap[filename], dom: child });
            }
        }
        return result;
    }

    /**
     * Nhóm các ô theo 'top' để thành hàng.
     * Vì giá trị top có thể hơi khác do làm tròn, ta nhóm các top nằm trong tolerance (px) thành 1 hàng.
     * - cells: mảng {left, top, id, dom}
     * - tol: sai số tính bằng pixel (ví dụ 6)
     * Trả về mảng các hàng: mỗi hàng là mảng các cell đã sort theo left tăng dần.
     */
    function groupRowsByTop(cells, tol = 6) {
        // groups: [{ representative: number, items: [cell,...] }, ...]
        const groups = [];

        for (const c of cells) {
            let placed = false;
            for (const g of groups) {
                if (Math.abs(g.representative - c.top) <= tol) {
                    // nếu top gần representative thì thêm vào nhóm đó
                    g.items.push(c);
                    // cập nhật representative (trung bình đơn giản)
                    g.representative = g.items.reduce((s, it) => s + it.top, 0) / g.items.length;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                groups.push({ representative: c.top, items: [c] });
            }
        }

        // sắp xếp các hàng theo representative (tức top tăng dần)
        groups.sort((a, b) => a.representative - b.representative);

        // return mảng các hàng, mỗi hàng sắp xếp theo left tăng dần
        return groups.map(g => g.items.sort((x, y) => x.left - y.left));
    }

    /**
     * Từ mảng rows (mỗi row là mảng cell đã sắp xếp) -> tạo ma trận 2D chỉ gồm id (số).
     * Nếu số cột mỗi hàng khác nhau, ta sẽ pad bằng -1 ở cuối để thành dạng chữ nhật.
     */
    function buildMatrixFromRows(rows) {
        if (!rows || rows.length === 0) return [];
        const maxCols = Math.max(...rows.map(r => r.length));
        const matrix = rows.map(row => {
            const arr = row.map(c => c.id);
            // nếu hàng ngắn hơn maxCols => pad bằng -1
            while (arr.length < maxCols) arr.push(-1);
            return arr;
        });
        return matrix;
    }

    /**
     * Hàm chính: quét bảng và trả về ma trận số nguyên
     * - Tự động tìm container
     * - Trả về { matrix: [...], meta: { rows, cols, rawCellsCount } }
     */
    // Hàm chờ container và cells xuất hiện
    async function waitForBoard(maxWaitMs = 5000, checkIntervalMs = 100) {
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
            const container = findBoardContainer();
            if (container) {
                const cells = parseCellsFromContainer(container);
                if (cells && cells.length > 0) {
                    return { container, cells }; // Đã có dữ liệu
                }
            }
            await new Promise(r => setTimeout(r, checkIntervalMs)); // chờ rồi kiểm tra lại
        }
        return null; // Hết thời gian mà chưa thấy
    }

    async function scanBoardToMatrix() {
        // 1) Đợi cho tới khi có container + cells
        const boardData = await waitForBoard(5000, 200); // chờ tối đa 5s, kiểm tra mỗi 200ms
        if (!boardData) {
            // console.warn("[pikachu-helper] Không tìm thấy container hoặc cells sau thời gian chờ.", new Error().stack);
            return { matrix: null, error: "NoBoard" };
        }

        const { container, cells } = boardData;

        // 2) group theo hàng (top)
        const cellRows = groupRowsByTop(cells, 6); // 6px tolerance

        // 3) build matrix 2D
        const matrix = buildMatrixFromRows(cellRows);

        // 4) log debug
        // console.log("[pikachu-helper] cells count:", cells.length);
        // console.log("[pikachu-helper] rows:", cellRows.length, "cols (max):", matrix.length > 0 ? matrix[0].length : 0);
        // console.log("[pikachu-helper] matrix:", matrix);

        return {
            matrix: matrix,
            cellRows: cellRows,
            meta: {
                rawCellsCount: cells.length,
                rows: cellRows.length,
                cols: matrix.length > 0 ? matrix[0].length : 0
            }
        };
    }

    // --- Expose API qua messaging để popup có thể request ---

    // Lắng nghe message từ extension (popup hoặc background)
    // chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    //     if (message && message.type === "getBoard") {
    //         scanBoardToMatrix().then(res => {
    //             sendResponse(res);
    //         });
    //         return true; // Giữ kết nối cho async
    //     }
    // });

    // Ngoài ra, để tiện debug bạn có thể gọi window.__pikachu_scanBoard() trong console
    window.__pikachu_scanBoard = function () {
        return scanBoardToMatrix();
    };

    // Optionally: bạn có thể bật observer nếu muốn extension tự động cập nhật khi DOM thay đổi.
    // Mình để comment để bạn quyết định có bật hay không.
    /*
    const observer = new MutationObserver((mutations) => {
        // mỗi lần DOM biến động nặng (thêm/bớt node) -> bạn có thể gửi message tới background/popup
        // Mình không tự động gửi đi để tránh spam; nếu muốn, có thể chrome.runtime.sendMessage(...)
    });
    const board = findBoardContainer();
    if (board) {
        observer.observe(board, { childList: true, subtree: false });
    }
    */

    // Kiểm tra có thể nối 2 ô (i1, j1) và (i2, j2) theo luật Pikachu
    function canConnect(matrix, i1, j1, i2, j2) {
        if (matrix[i1]?.[j1] !== matrix[i2]?.[j2] || matrix[i1]?.[j1] === -1) return false;
        if (i1 === i2 && j1 === j2) return false;
        const rows = matrix.length, cols = matrix[0].length;
        // Kiểm tra đường thẳng giữa 2 điểm, không bị chắn
        function clearLine(x1, y1, x2, y2) {
            if (x1 === x2) {
                let yStart = y1, yEnd = y2;
                if (yStart > yEnd) [yStart, yEnd] = [yEnd, yStart];
                for (let y = yStart + 1; y < yEnd; y++) {
                    if (x1 < 0 || x1 >= rows || y < 0 || y >= cols) continue;
                    if (matrix[x1][y] !== -1) return false;
                }
                return true;
            }
            if (y1 === y2) {
                let xStart = x1, xEnd = x2;
                if (xStart > xEnd) [xStart, xEnd] = [xEnd, xStart];
                for (let x = xStart + 1; x < xEnd; x++) {
                    if (x < 0 || x >= rows || y1 < 0 || y1 >= cols) continue;
                    if (matrix[x][y1] !== -1) return false;
                }
                return true;
            }
            return false;
        }
        // 0 đoạn thẳng
        if (clearLine(i1, j1, i2, j2)) return true;
        // 1 góc
        if (
            (matrix[i1]?.[j2] === -1) &&
            clearLine(i1, j1, i1, j2) &&
            clearLine(i1, j2, i2, j2)
        ) return true;
        if (
            (matrix[i2]?.[j1] === -1) &&
            clearLine(i1, j1, i2, j1) &&
            clearLine(i2, j1, i2, j2)
        ) return true;
        // 2 góc
        for (let k = 0; k < rows; k++) {
            if (
                matrix[k]?.[j1] === -1 &&
                matrix[k]?.[j2] === -1 &&
                clearLine(i1, j1, k, j1) &&
                clearLine(k, j1, k, j2) &&
                clearLine(k, j2, i2, j2)
            ) return true;
        }
        for (let k = 0; k < cols; k++) {
            if (
                matrix[i1]?.[k] === -1 &&
                matrix[i2]?.[k] === -1 &&
                clearLine(i1, j1, i1, k) &&
                clearLine(i1, k, i2, k) &&
                clearLine(i2, k, i2, j2)
            ) return true;
        }
        // Border: thử nối ra ngoài viền
        // Trên
        if (
            i1 === 0 && i2 === 0 &&
            clearLine(i1, j1, -1, j1) &&
            clearLine(-1, j1, -1, j2) &&
            clearLine(-1, j2, i2, j2)
        ) return true;
        // Dưới
        if (
            i1 === rows - 1 && i2 === rows - 1 &&
            clearLine(i1, j1, rows, j1) &&
            clearLine(rows, j1, rows, j2) &&
            clearLine(rows, j2, i2, j2)
        ) return true;
        // Trái
        if (
            j1 === 0 && j2 === 0 &&
            clearLine(i1, j1, i1, -1) &&
            clearLine(i1, -1, i2, -1) &&
            clearLine(i2, -1, i2, j2)
        ) return true;
        // Phải
        if (
            j1 === cols - 1 && j2 === cols - 1 &&
            clearLine(i1, j1, i1, cols) &&
            clearLine(i1, cols, i2, cols) &&
            clearLine(i2, cols, i2, j2)
        ) return true;
        return false;
    }

    // Tìm và highlight cặp đầu tiên
    function findAndHighlightPair(matrix, cellRows) {
        // Pad matrix với viền ngoài -1
        const paddedMatrix = padMatrixWithBorder(matrix);
        for (let i1 = 0; i1 < matrix.length; i1++) {
            for (let j1 = 0; j1 < matrix[0].length; j1++) {
                if (matrix[i1][j1] === -1) continue;
                for (let i2 = 0; i2 < matrix.length; i2++) {
                    for (let j2 = 0; j2 < matrix[0].length; j2++) {
                        if (i1 === i2 && j1 === j2) continue;
                        // Chuyển chỉ số sang paddedMatrix (cộng thêm 1)
                        if (canConnect(paddedMatrix, i1 + 1, j1 + 1, i2 + 1, j2 + 1)) {
                            // Kiểm tra chỉ số hợp lệ trước khi truy cập cellRows
                            if (cellRows[i1] && cellRows[i1][j1] && cellRows[i2] && cellRows[i2][j2]) {
                                const cell1 = cellRows[i1][j1].dom;
                                const cell2 = cellRows[i2][j2].dom;
                                cell1.style.boxShadow = "0 0 10px 5px yellow";
                                cell2.style.boxShadow = "0 0 10px 5px yellow";
                                setTimeout(() => {
                                    cell1.style.boxShadow = "";
                                    cell2.style.boxShadow = "";
                                }, 1000);
                                return;
                            }
                        }
                    }
                }
            }
        }
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message && message.type === "getBoard") {
            scanBoardToMatrix().then(res => {
                sendResponse(res);
            });
            return true;
        }
        if (message && message.type === "highlightPair") {
            scanBoardToMatrix().then(res => {
                if (res && res.matrix && res.cellRows) {
                    findAndHighlightPair(res.matrix, res.cellRows);
                    sendResponse({ ok: true });
                } else {
                    sendResponse({ ok: false });
                }
            });
            return true;
        }
        // Tự động gợi ý liên tục
        if (message && message.type === "startAutoHighlight") {
            if (!window.__pikachu_auto_highlight_timer) {
                window.__pikachu_auto_highlight_timer = setInterval(() => {
                    scanBoardToMatrix().then(res => {
                        if (res && res.matrix && res.cellRows) {
                            findAndHighlightPair(res.matrix, res.cellRows);
                        }
                    });
                }, 2000);
            }
            sendResponse({ ok: true });
            return true;
        }
        if (message && message.type === "stopAutoHighlight") {
            if (window.__pikachu_auto_highlight_timer) {
                clearInterval(window.__pikachu_auto_highlight_timer);
                window.__pikachu_auto_highlight_timer = null;
            }
            sendResponse({ ok: true });
            return true;
        }
    });

})(); // end IIFE
