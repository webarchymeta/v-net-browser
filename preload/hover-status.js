var ipc = require('electron').ipcRenderer;

function setStatus(status) {
    ipc.sendToHost('status', status);
}

window.addEventListener('mouseover', function(e) {
    // watch for mouseovers of anchor elements
    var el = e.target;
    window.__current_href = undefined;
    window.__current_img = undefined;
    while (el) {
        if (el.tagName == 'A') {
            // set to title or href
            if (el.getAttribute('title'))
                setStatus(el.getAttribute('title'));
            else if (el.href)
                setStatus(el.href);
            window.__current_href = el.href;
            return;
        } else if (el.tagName === 'IMG') {
            window.__current_img = el.src;
        }
        el = el.parentNode;
    }
    setStatus(false);
});