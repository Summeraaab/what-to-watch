// 内置精选片库（离线可用）：三段数据合并
const LIBRARY = DATA_1.concat(DATA_2, DATA_3);
LIBRARY.forEach(function (x) { x.src = 'local'; });
